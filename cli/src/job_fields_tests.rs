use super::*;
use clap::Parser;

#[derive(Parser)]
struct Cli {
    #[command(flatten)]
    fields: JobFields,
}

fn fields(args: &[&str]) -> JobFields {
    Cli::try_parse_from(std::iter::once("t").chain(args.iter().copied()))
        .unwrap()
        .fields
}

fn yaml(map: &Mapping) -> String {
    serde_norway::to_string(map).unwrap()
}

fn applied(start: &str, args: &[&str]) -> Result<String, String> {
    let mut job: Mapping = serde_norway::from_str(start).unwrap();
    fields(args).apply(&mut job)?;
    Ok(yaml(&job))
}

#[test]
fn a_new_entry_reads_like_one_the_app_wrote() {
    let out = applied(
        "{}",
        &[
            "--prompt",
            "Find outdated deps",
            "--agent",
            "claude",
            "--at",
            "09:00",
            "--days",
            "mon,thu",
            "--label",
            "Deps",
            "--check",
            "npm outdated",
            "--duplicate",
            "worktree",
            "--send-to",
            "lpm,telegram",
            "--quiet",
        ],
    )
    .unwrap();
    assert_eq!(
        out,
        "label: Deps\nschedule:\n  at: 09:00\n  days:\n  - mon\n  - thu\ncheck: npm outdated\nduplicate:\n  mode: worktree\nrun:\n  prompt: Find outdated deps\n  agent: claude\n  quiet: true\nsendTo:\n- lpm\n- telegram\n"
    );
}

#[test]
fn schedule_flags_replace_the_whole_schedule() {
    let start = "schedule: { at: '09:00', days: [mon] }\nrun: { cmd: x }\n";
    assert_eq!(
        applied(start, &["--every", "6h"]).unwrap(),
        "schedule:\n  every: 6h\nrun:\n  cmd: x\n"
    );
    assert_eq!(
        applied(start, &["--at", "09:00,17:30", "--days", "1,15,last"]).unwrap(),
        "schedule:\n  at:\n  - 09:00\n  - 17:30\n  days:\n  - 1\n  - 15\n  - last\nrun:\n  cmd: x\n"
    );
    assert_eq!(
        applied(start, &["--days", "First Mon", "--at", "10:00"]).unwrap(),
        "schedule:\n  at: 10:00\n  days: first mon\nrun:\n  cmd: x\n"
    );
    assert_eq!(
        applied(start, &["--manual"]).unwrap(),
        "schedule:\n  manual: true\nrun:\n  cmd: x\n"
    );
}

#[test]
fn edits_keep_other_fields_and_their_order() {
    let start = "label: Old\nschedule: { manual: true }\nrun: { prompt: task, agent: codex, model: m }\nsendTo: telegram\n";
    assert_eq!(
        applied(start, &["--model", "", "--effort", "high", "--label", "New", "--send-to", ""]).unwrap(),
        "label: New\nschedule:\n  manual: true\nrun:\n  prompt: task\n  agent: codex\n  effort: high\n"
    );
}

#[test]
fn run_targets_switch_cleanly() {
    let ai = "run: { prompt: task, agent: codex, quiet: true }\n";
    assert_eq!(
        applied(ai, &["--cmd", "make"]).unwrap(),
        "run:\n  cmd: make\n"
    );
    assert_eq!(
        applied(ai, &["--action", "deploy"]).unwrap(),
        "run:\n  action: deploy\n"
    );
    let action = "run: { action: agent }\n";
    assert_eq!(
        applied(action, &["--prompt", "go"]).unwrap(),
        "run:\n  action: agent\n  prompt: go\n"
    );
    assert_eq!(
        applied(
            action,
            &["--action", "", "--prompt", "go", "--agent", "claude"]
        )
        .unwrap(),
        "run:\n  prompt: go\n  agent: claude\n"
    );
    assert_eq!(
        applied("run: { cmd: make }\n", &["--prompt", "go"]).unwrap(),
        "run:\n  prompt: go\n"
    );
}

#[test]
fn copy_settings_follow_the_app_shapes() {
    assert_eq!(
        applied("{}", &["--duplicate", "copy"]).unwrap(),
        "duplicate: true\n"
    );
    assert_eq!(
        applied("duplicate: true\n", &["--reinstall-deps"]).unwrap(),
        "duplicate:\n  reinstallDeps: true\n"
    );
    assert_eq!(
        applied(
            "duplicate: { mode: worktree, reinstallDeps: true }\n",
            &["--duplicate", "copy"]
        )
        .unwrap(),
        "duplicate:\n  reinstallDeps: true\n"
    );
    assert_eq!(
        applied("duplicate: true\n", &["--duplicate", "off"]).unwrap(),
        "{}\n"
    );
    assert!(applied("{}", &["--pull-latest", "false"]).is_err());
    assert_eq!(
        applied(
            "duplicate: { pullLatest: false, reinstallDeps: true }\n",
            &["--duplicate", "worktree"]
        )
        .unwrap(),
        "duplicate:\n  reinstallDeps: true\n  mode: worktree\n"
    );
    assert!(applied("{}", &["--duplicate", "worktree", "--pull-latest"]).is_err());
}

#[test]
fn conflicting_flags_are_refused() {
    for args in [
        &["--manual", "--every", "6h"][..],
        &["--cron", "@daily", "--at", "09:00"],
        &["--cmd", "x", "--prompt", "y"],
        &["--cmd", "x", "--agent", "claude"],
    ] {
        assert!(
            Cli::try_parse_from(std::iter::once("t").chain(args.iter().copied())).is_err(),
            "{args:?}"
        );
    }
}

#[test]
fn emptiness_and_targets() {
    assert!(fields(&[]).is_empty());
    assert!(!fields(&["--label", ""]).is_empty());
    assert!(!fields(&["--prompt", " "]).run_target_given());
    assert!(fields(&["--action", "deploy"]).run_target_given());
    assert!(fields(&["--days", "mon"]).schedule_given());
}
