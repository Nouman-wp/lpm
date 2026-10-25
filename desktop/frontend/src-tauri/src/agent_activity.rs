//! How long agents worked and how many prompts they were given, read from the
//! same history files as Stats: the weekly recap's hours, prompts and streak.
//!
//! A session's history is a run of timestamped lines. Inside a turn the time
//! between two lines is the agent working, so it counts, up to a cap that keeps
//! a stalled turn (a permission prompt left overnight, a sleeping Mac) from
//! counting as hours of work. The time before a line that opens a turn is the
//! agent waiting on the user, so it never counts. Sessions running at once each
//! count, as agent-hours do.
use crate::agent_activity_claude::collect_claude_beats;
use crate::agent_activity_codex::collect_codex_beats;
use crate::agent_usage::ProjectMatcher;
use chrono::{DateTime, Local};
use std::collections::{BTreeMap, HashMap, HashSet};

/// The most one gap between two lines of a turn counts for.
pub(crate) const IDLE_CAP_MS: i64 = 10 * 60 * 1000;

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum BeatKind {
    /// Something the user typed: opens a turn and counts as a prompt once the
    /// agent answers it.
    Prompt,
    /// Opens a turn without the user typing it: a background task finishing, a
    /// run lpm or an automation started.
    Opener,
    /// The agent itself speaking or calling a tool.
    Answer,
    /// Anything else inside a turn: a tool's result, an interruption.
    Step,
    /// The turn is over; lines until the next one opens are idle.
    End,
}

/// One timestamped line of a session's history.
#[derive(Clone, Debug)]
pub(crate) struct Beat {
    pub(crate) agent: &'static str,
    /// The session it belongs to, a subagent's lines under its parent's.
    pub(crate) thread: String,
    pub(crate) project: String,
    pub(crate) at: i64,
    pub(crate) kind: BeatKind,
}

#[derive(Clone, Default, Debug, PartialEq)]
pub(crate) struct DayActivity {
    pub(crate) agent_ms: i64,
    pub(crate) prompts: u64,
    pub(crate) projects: HashMap<String, i64>,
    /// Agent time by agent ("claude", "codex").
    pub(crate) agents: HashMap<&'static str, i64>,
    pub(crate) threads: HashSet<String>,
}

/// Each local day's activity, by date (YYYY-MM-DD).
pub(crate) type Activity = BTreeMap<String, DayActivity>;

pub(crate) fn local_date(at: i64) -> String {
    DateTime::from_timestamp_millis(at)
        .map(|value| value.with_timezone(&Local).format("%Y-%m-%d").to_string())
        .unwrap_or_default()
}

/// Every agent's activity since `since` (unix millis).
pub(crate) fn collect_activity(since: i64) -> Activity {
    let matcher = ProjectMatcher::load();
    let (claude, codex) = std::thread::scope(|scope| {
        let claude = scope.spawn(|| collect_claude_beats(&matcher, since));
        let codex = collect_codex_beats(&matcher, since);
        (claude.join().unwrap_or_default(), codex)
    });
    let mut beats = claude;
    beats.extend(codex);
    activity(beats, since)
}

pub(crate) fn activity(beats: Vec<Beat>, since: i64) -> Activity {
    let mut threads: HashMap<String, Vec<Beat>> = HashMap::new();
    for beat in beats {
        threads.entry(beat.thread.clone()).or_default().push(beat);
    }
    let mut days = Activity::new();
    for (thread, mut beats) in threads {
        beats.sort_by_key(|beat| beat.at);
        add_thread(&mut days, &thread, &beats, since);
    }
    days
}

fn add_thread(days: &mut Activity, thread: &str, beats: &[Beat], since: i64) {
    let mut idle = true;
    let mut asked: Option<i64> = None;
    let mut previous: Option<i64> = None;
    for beat in beats {
        let opens = matches!(beat.kind, BeatKind::Prompt | BeatKind::Opener);
        if opens {
            idle = false;
            asked = (beat.kind == BeatKind::Prompt).then_some(beat.at);
        } else if !idle {
            if let Some(before) = previous {
                let worked = (beat.at - before).clamp(0, IDLE_CAP_MS);
                if beat.at >= since && worked > 0 {
                    let day = days.entry(local_date(beat.at)).or_default();
                    day.agent_ms += worked;
                    *day.projects.entry(beat.project.clone()).or_default() += worked;
                    *day.agents.entry(beat.agent).or_default() += worked;
                    day.threads.insert(thread.to_string());
                }
            }
            if beat.kind == BeatKind::Answer {
                if let Some(at) = asked.take().filter(|at| *at >= since) {
                    days.entry(local_date(at)).or_default().prompts += 1;
                }
            }
            idle = beat.kind == BeatKind::End;
        }
        previous = Some(beat.at);
    }
}

#[cfg(test)]
#[path = "agent_activity_tests.rs"]
mod tests;
