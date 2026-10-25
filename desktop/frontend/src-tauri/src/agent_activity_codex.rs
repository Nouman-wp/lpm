//! Codex's rollouts as beats of agent work. Each rollout is one thread: a
//! subagent's runs beside its parent's, as agents working at once.
use crate::agent_activity::{Beat, BeatKind};
use crate::agent_usage::{collect_jsonl_files, parse_files_parallel, ProjectMatcher};
use chrono::DateTime;
use serde::de::IgnoredAny;
use serde::Deserialize;
use serde_json::Value;
use std::borrow::Cow;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

/// A forked or subagent rollout opens with a copy of its parent's transcript,
/// written in one burst; the turns it replays were already counted there.
const REPLAY_BURST_GAP_MS: i64 = 1_000;

#[derive(Deserialize)]
struct Line<'a> {
    #[serde(borrow, default)]
    timestamp: Option<Cow<'a, str>>,
    #[serde(rename = "type", borrow)]
    kind: Cow<'a, str>,
    #[serde(borrow, default)]
    payload: Payload<'a>,
}

#[derive(Deserialize, Default)]
struct Payload<'a> {
    #[serde(rename = "type", borrow, default)]
    kind: Option<Cow<'a, str>>,
    #[serde(borrow, default)]
    role: Option<Cow<'a, str>>,
    #[serde(borrow, default)]
    id: Option<Cow<'a, str>>,
    #[serde(borrow, default)]
    cwd: Option<Cow<'a, str>>,
    #[serde(default)]
    forked_from_id: Option<IgnoredAny>,
    #[serde(borrow, default)]
    thread_source: Option<Cow<'a, str>>,
    #[serde(default)]
    source: Option<Value>,
    #[serde(default)]
    turn_attribution: Option<Attribution>,
}

#[derive(Deserialize, Default)]
struct Attribution {
    #[serde(default)]
    turn_trigger: Option<String>,
}

struct Thread {
    id: String,
    cwd: String,
    /// Typed into Codex's own TUI or app, so a turn without a trigger (an
    /// older Codex) was the user's.
    interactive: bool,
    forked: bool,
    meta_seen: bool,
}

impl Thread {
    fn meta(&mut self, payload: &Payload) {
        if let Some(cwd) = payload.cwd.as_deref() {
            self.cwd = cwd.to_string();
        }
        if self.meta_seen {
            return;
        }
        self.meta_seen = true;
        if let Some(id) = payload.id.as_deref() {
            self.id = id.to_string();
        }
        let thread_source = payload.thread_source.as_deref();
        self.forked = payload.forked_from_id.is_some() || thread_source == Some("subagent");
        self.interactive = matches!(
            payload.source.as_ref().and_then(Value::as_str),
            Some("cli" | "vscode")
        ) && thread_source.is_none_or(|source| source == "user");
    }

    fn kind(&self, line: &Line) -> Option<BeatKind> {
        let payload = &line.payload;
        let kind = payload.kind.as_deref().unwrap_or("");
        match line.kind.as_ref() {
            "event_msg" => match kind {
                "task_started" => {
                    let trigger = payload
                        .turn_attribution
                        .as_ref()
                        .and_then(|attribution| attribution.turn_trigger.as_deref());
                    let typed = match trigger {
                        Some(trigger) => trigger == "user",
                        None => self.interactive,
                    };
                    Some(if typed {
                        BeatKind::Prompt
                    } else {
                        BeatKind::Opener
                    })
                }
                "task_complete" | "turn_aborted" => Some(BeatKind::End),
                // Re-sent whenever the rate limits refresh, idle or not.
                "token_count" => None,
                _ => Some(BeatKind::Step),
            },
            "response_item" => Some(match (kind, payload.role.as_deref()) {
                ("message", Some("assistant")) => BeatKind::Answer,
                ("message", _) => BeatKind::Step,
                (kind, _) if kind.ends_with("_output") => BeatKind::Step,
                _ => BeatKind::Answer,
            }),
            _ => None,
        }
    }
}

pub(crate) fn parse_codex_beats(path: &Path, matcher: &ProjectMatcher) -> Vec<Beat> {
    let Ok(file) = File::open(path) else {
        return Vec::new();
    };
    let mut thread = Thread {
        id: path
            .file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or("unknown")
            .to_string(),
        cwd: String::new(),
        interactive: false,
        forked: false,
        meta_seen: false,
    };
    let mut beats = Vec::new();
    for raw in BufReader::new(file).lines().map_while(Result::ok) {
        let Ok(line) = serde_json::from_str::<Line>(&raw) else {
            continue;
        };
        match line.kind.as_ref() {
            "session_meta" => {
                thread.meta(&line.payload);
                continue;
            }
            "turn_context" => {
                if let Some(cwd) = line.payload.cwd.as_deref() {
                    thread.cwd = cwd.to_string();
                }
                continue;
            }
            _ => {}
        }
        let Some(kind) = thread.kind(&line) else {
            continue;
        };
        let Some(at) = line
            .timestamp
            .as_deref()
            .and_then(|at| DateTime::parse_from_rfc3339(at).ok())
            .map(|at| at.timestamp_millis())
        else {
            continue;
        };
        let Some(project) = matcher.project_for(&thread.cwd) else {
            continue;
        };
        beats.push(Beat {
            agent: "codex",
            thread: String::new(),
            project,
            at,
            kind,
        });
    }
    let key = format!("codex\0{}", thread.id);
    for beat in &mut beats {
        beat.thread.clone_from(&key);
    }
    if thread.forked {
        unprompt_replay(&mut beats);
    }
    beats
}

/// The replayed turns stay, as moments of no length, but their prompts were
/// the parent's.
fn unprompt_replay(beats: &mut [Beat]) {
    let burst = beats
        .windows(2)
        .take_while(|pair| pair[1].at - pair[0].at < REPLAY_BURST_GAP_MS)
        .count();
    for beat in beats.iter_mut().take(burst + 1) {
        if beat.kind == BeatKind::Prompt {
            beat.kind = BeatKind::Opener;
        }
    }
}

pub(crate) fn collect_codex_beats(matcher: &ProjectMatcher, since: i64) -> Vec<Beat> {
    let root = dirs::home_dir()
        .unwrap_or_default()
        .join(".codex")
        .join("sessions");
    let mut files = Vec::new();
    collect_jsonl_files(&root, Some(since), &mut files);
    parse_files_parallel(files, |path| parse_codex_beats(path, matcher))
}

#[cfg(test)]
#[path = "agent_activity_codex_tests.rs"]
mod tests;
