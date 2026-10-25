use super::*;
use crate::agent_usage::test_matcher;
use serde_json::{json, Value};
use std::io::Write;

fn meta(dir: &Path, source: &str, forked: bool) -> Value {
    let mut payload =
        json!({ "id": "thread", "cwd": dir, "source": source, "thread_source": "user" });
    if forked {
        payload["forked_from_id"] = "parent".into();
    }
    json!({ "timestamp": "2026-10-20T09:00:00Z", "type": "session_meta", "payload": payload })
}

fn event(at: &str, payload: Value) -> Value {
    json!({ "timestamp": at, "type": "event_msg", "payload": payload })
}

fn item(at: &str, payload: Value) -> Value {
    json!({ "timestamp": at, "type": "response_item", "payload": payload })
}

fn started(at: &str, trigger: Option<&str>) -> Value {
    let mut payload = json!({ "type": "task_started", "turn_id": "t" });
    if let Some(trigger) = trigger {
        payload["turn_attribution"] = json!({ "turn_trigger": trigger });
    }
    event(at, payload)
}

fn kinds(dir: &Path, records: &[Value]) -> Vec<BeatKind> {
    let path = dir.join("rollout.jsonl");
    let mut file = File::create(&path).unwrap();
    for record in records {
        writeln!(file, "{record}").unwrap();
    }
    parse_codex_beats(&path, &test_matcher(dir))
        .into_iter()
        .map(|beat| beat.kind)
        .collect()
}

#[test]
fn reads_a_turn_from_start_to_finish() {
    let dir = tempfile::tempdir().unwrap();
    let d = dir.path();
    let records = [
        meta(d, "cli", false),
        started("2026-10-20T09:00:00Z", Some("user")),
        item(
            "2026-10-20T09:00:01Z",
            json!({ "type": "message", "role": "user", "content": [] }),
        ),
        item(
            "2026-10-20T09:00:05Z",
            json!({ "type": "function_call", "name": "shell" }),
        ),
        item(
            "2026-10-20T09:00:09Z",
            json!({ "type": "function_call_output", "output": "ok" }),
        ),
        event(
            "2026-10-20T09:00:10Z",
            json!({ "type": "token_count", "info": null }),
        ),
        item(
            "2026-10-20T09:00:12Z",
            json!({ "type": "message", "role": "assistant", "content": [] }),
        ),
        event(
            "2026-10-20T09:00:13Z",
            json!({ "type": "task_complete", "turn_id": "t" }),
        ),
    ];
    assert_eq!(
        kinds(d, &records),
        [
            BeatKind::Prompt,
            BeatKind::Step,
            BeatKind::Answer,
            BeatKind::Step,
            BeatKind::Answer,
            BeatKind::End
        ]
    );
}

#[test]
fn only_turns_the_user_started_are_prompts() {
    let dir = tempfile::tempdir().unwrap();
    let d = dir.path();
    let records = [
        meta(d, "exec", false),
        started("2026-10-20T09:00:00Z", Some("exec")),
        started("2026-10-20T09:01:00Z", Some("guardian_review")),
        started("2026-10-20T09:02:00Z", None),
    ];
    assert_eq!(kinds(d, &records), [BeatKind::Opener; 3]);
}

#[test]
fn an_older_interactive_codex_turn_is_a_prompt() {
    let dir = tempfile::tempdir().unwrap();
    let records = [
        meta(dir.path(), "cli", false),
        started("2026-10-20T09:00:00Z", None),
    ];
    assert_eq!(kinds(dir.path(), &records), [BeatKind::Prompt]);
}

#[test]
fn a_fork_does_not_count_the_prompts_it_replays() {
    let dir = tempfile::tempdir().unwrap();
    let d = dir.path();
    let records = [
        meta(d, "cli", true),
        started("2026-10-20T09:00:00.000Z", Some("user")),
        item(
            "2026-10-20T09:00:00.010Z",
            json!({ "type": "message", "role": "assistant" }),
        ),
        started("2026-10-20T09:00:30Z", Some("user")),
    ];
    assert_eq!(
        kinds(d, &records),
        [BeatKind::Opener, BeatKind::Answer, BeatKind::Prompt]
    );
}
