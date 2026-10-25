use super::*;
use crate::agent_usage::test_matcher;
use serde_json::{json, Value};
use std::io::Write;
use std::path::PathBuf;

fn write(dir: &Path, name: &str, records: &[Value]) -> PathBuf {
    let path = dir.join(name);
    let mut file = File::create(&path).unwrap();
    for record in records {
        writeln!(file, "{record}").unwrap();
    }
    path
}

fn line(dir: &Path, uuid: &str, kind: &str, content: Value) -> Value {
    json!({
        "type": kind,
        "uuid": uuid,
        "timestamp": "2026-10-20T09:00:00Z",
        "sessionId": "session",
        "cwd": dir,
        "entrypoint": "cli",
        "message": { "role": kind, "content": content }
    })
}

fn kinds(dir: &Path, records: &[Value]) -> Vec<BeatKind> {
    let path = write(dir, "session.jsonl", records);
    parse_claude_beats(&path, &test_matcher(dir))
        .into_iter()
        .map(|line| line.beat.kind)
        .collect()
}

#[test]
fn tells_typed_prompts_from_the_rest_of_a_turn() {
    let dir = tempfile::tempdir().unwrap();
    let d = dir.path();
    let mut meta = line(d, "4", "user", json!("[Image: source: /tmp/a.png]"));
    meta["isMeta"] = true.into();
    let records = [
        line(d, "1", "user", json!("fix the login bug")),
        line(
            d,
            "2",
            "assistant",
            json!([{ "type": "tool_use", "name": "Bash", "input": { "command": "ls" } }]),
        ),
        line(
            d,
            "3",
            "user",
            json!([{ "type": "tool_result", "tool_use_id": "t", "content": "ok" }]),
        ),
        meta,
        line(
            d,
            "5",
            "user",
            json!([{ "type": "text", "text": "[Request interrupted by user]" }]),
        ),
        line(
            d,
            "6",
            "user",
            json!([{ "type": "text", "text": "and the signup one" }]),
        ),
    ];
    assert_eq!(
        kinds(d, &records),
        [
            BeatKind::Prompt,
            BeatKind::Answer,
            BeatKind::Step,
            BeatKind::Step,
            BeatKind::Step,
            BeatKind::Prompt
        ]
    );
}

#[test]
fn turns_nobody_typed_open_without_a_prompt() {
    let dir = tempfile::tempdir().unwrap();
    let d = dir.path();
    let mut headless = line(d, "2", "user", json!("Write a commit message"));
    headless["entrypoint"] = "sdk-cli".into();
    let mut subagent = line(d, "3", "user", json!("Search the repo"));
    subagent["isSidechain"] = true.into();
    let records = [
        line(
            d,
            "1",
            "user",
            json!("<task-notification>\n<task-id>a</task-id>"),
        ),
        headless,
        subagent,
    ];
    assert_eq!(
        kinds(d, &records),
        [BeatKind::Opener, BeatKind::Opener, BeatKind::Step]
    );
}

#[test]
fn skips_lines_outside_every_project() {
    let dir = tempfile::tempdir().unwrap();
    let elsewhere = tempfile::tempdir().unwrap();
    let records = [line(elsewhere.path(), "1", "user", json!("hello"))];
    assert!(kinds(dir.path(), &records).is_empty());
}

#[test]
fn a_copied_line_counts_once_in_the_transcript_written_first() {
    let first = |thread: &str, written: i64| Written {
        id: "same".into(),
        written,
        beat: Beat {
            agent: "claude",
            thread: thread.into(),
            project: "app".into(),
            at: 1,
            kind: BeatKind::Prompt,
        },
    };
    let kept = first_written(vec![first("fork", 20), first("original", 10)]);
    assert_eq!(kept.len(), 1);
    assert_eq!(kept[0].thread, "original");
}
