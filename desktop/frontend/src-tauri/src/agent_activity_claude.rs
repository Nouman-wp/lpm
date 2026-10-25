//! Claude Code's history as beats of agent work. A forked or resumed session
//! copies earlier lines into its own transcript with their ids, so each line
//! counts once, in the transcript written first.
use crate::agent_activity::{Beat, BeatKind};
use crate::agent_usage::{collect_jsonl_files, parse_files_parallel, ProjectMatcher};
use crate::agent_usage_claude::{claude_project_dirs, written_at};
use chrono::DateTime;
use serde::de::{Deserializer, IgnoredAny, SeqAccess, Visitor};
use serde::Deserialize;
use std::borrow::Cow;
use std::collections::hash_map::Entry;
use std::collections::HashMap;
use std::fmt;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;

/// Lines that open a turn without the user typing them.
const NOT_TYPED: &[&str] = &["<task-notification", "<local-command", "Caveat:"];

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Line<'a> {
    #[serde(rename = "type", borrow)]
    kind: Cow<'a, str>,
    #[serde(borrow, default)]
    timestamp: Option<Cow<'a, str>>,
    #[serde(borrow, default)]
    uuid: Option<Cow<'a, str>>,
    #[serde(borrow, default)]
    session_id: Option<Cow<'a, str>>,
    #[serde(borrow, default)]
    cwd: Option<Cow<'a, str>>,
    #[serde(borrow, default)]
    entrypoint: Option<Cow<'a, str>>,
    #[serde(default)]
    is_sidechain: bool,
    #[serde(default)]
    is_meta: bool,
    #[serde(default)]
    is_compact_summary: bool,
    #[serde(default)]
    message: Option<Message>,
}

#[derive(Deserialize, Default)]
struct Message {
    #[serde(default)]
    content: Said,
}

/// A message's content reduced to what tells its line apart: its text, and
/// whether it carries a tool's result. Everything else is skipped unread.
#[derive(Default)]
struct Said {
    text: String,
    tool_result: bool,
}

#[derive(Deserialize)]
struct Block {
    #[serde(rename = "type", default)]
    kind: Option<String>,
    #[serde(default)]
    text: Option<String>,
}

impl<'de> Deserialize<'de> for Said {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct SaidVisitor;
        impl<'de> Visitor<'de> for SaidVisitor {
            type Value = Said;

            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("message content")
            }

            fn visit_str<E>(self, text: &str) -> Result<Said, E> {
                Ok(Said {
                    text: text.to_string(),
                    tool_result: false,
                })
            }

            fn visit_unit<E>(self) -> Result<Said, E> {
                Ok(Said::default())
            }

            fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> Result<Said, A::Error> {
                let mut said = Said::default();
                while let Some(block) = seq.next_element::<Block>()? {
                    match block.kind.as_deref() {
                        Some("tool_result") => said.tool_result = true,
                        Some("text") => said.text.push_str(block.text.as_deref().unwrap_or("")),
                        _ => {}
                    }
                }
                Ok(said)
            }

            fn visit_map<A: serde::de::MapAccess<'de>>(self, mut map: A) -> Result<Said, A::Error> {
                while map.next_entry::<IgnoredAny, IgnoredAny>()?.is_some() {}
                Ok(Said::default())
            }
        }
        deserializer.deserialize_any(SaidVisitor)
    }
}

fn kind_of(line: &Line) -> Option<BeatKind> {
    match line.kind.as_ref() {
        "assistant" => Some(BeatKind::Answer),
        "user" => {
            let said = line.message.as_ref().map(|message| &message.content);
            let opens = !line.is_sidechain
                && !line.is_meta
                && !line.is_compact_summary
                && said.is_some_and(|said| !said.tool_result);
            if !opens {
                return Some(BeatKind::Step);
            }
            let text = said.map_or("", |said| said.text.trim_start());
            if text.starts_with("[Request interrupted") {
                return Some(BeatKind::Step);
            }
            let headless = line
                .entrypoint
                .as_deref()
                .is_some_and(|entry| entry.starts_with("sdk"));
            let typed = !text.is_empty()
                && !headless
                && !NOT_TYPED.iter().any(|prefix| text.starts_with(prefix));
            Some(if typed {
                BeatKind::Prompt
            } else {
                BeatKind::Opener
            })
        }
        _ => None,
    }
}

fn parse_line(line: &str, matcher: &ProjectMatcher) -> Option<(String, Beat)> {
    let parsed: Line = serde_json::from_str(line).ok()?;
    let kind = kind_of(&parsed)?;
    let at = DateTime::parse_from_rfc3339(parsed.timestamp.as_deref()?)
        .ok()?
        .timestamp_millis();
    let project = matcher.project_for(parsed.cwd.as_deref()?)?;
    let session = parsed.session_id.as_deref()?;
    let id = parsed.uuid.as_deref()?.to_string();
    Some((
        id,
        Beat {
            agent: "claude",
            thread: format!("claude\0{session}"),
            project,
            at,
            kind,
        },
    ))
}

pub(crate) struct Written {
    id: String,
    written: i64,
    beat: Beat,
}

pub(crate) fn parse_claude_beats(path: &Path, matcher: &ProjectMatcher) -> Vec<Written> {
    let Ok(file) = File::open(path) else {
        return Vec::new();
    };
    let written = written_at(&file);
    BufReader::new(file)
        .lines()
        .map_while(Result::ok)
        .filter(|line| {
            line.contains("\"type\":\"user\"") || line.contains("\"type\":\"assistant\"")
        })
        .filter_map(|line| parse_line(&line, matcher))
        .map(|(id, beat)| Written { id, written, beat })
        .collect()
}

pub(crate) fn first_written(lines: Vec<Written>) -> Vec<Beat> {
    let mut kept: HashMap<String, Written> = HashMap::new();
    for line in lines {
        match kept.entry(line.id.clone()) {
            Entry::Occupied(mut slot) => {
                let held = slot.get();
                if (line.written, &line.beat.thread) < (held.written, &held.beat.thread) {
                    slot.insert(line);
                }
            }
            Entry::Vacant(slot) => {
                slot.insert(line);
            }
        }
    }
    kept.into_values().map(|line| line.beat).collect()
}

pub(crate) fn collect_claude_beats(matcher: &ProjectMatcher, since: i64) -> Vec<Beat> {
    let mut files = Vec::new();
    for dir in claude_project_dirs() {
        collect_jsonl_files(&dir, Some(since), &mut files);
    }
    first_written(parse_files_parallel(files, |path| {
        parse_claude_beats(path, matcher)
    }))
}

#[cfg(test)]
#[path = "agent_activity_claude_tests.rs"]
mod tests;
