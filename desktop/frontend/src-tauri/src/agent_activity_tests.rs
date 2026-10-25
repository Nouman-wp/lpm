use super::*;
use chrono::TimeZone;

const MIN: i64 = 60 * 1000;

fn at(hour: u32, minute: u32) -> i64 {
    Local
        .with_ymd_and_hms(2026, 10, 20, hour, minute, 0)
        .unwrap()
        .timestamp_millis()
}

fn beat(thread: &str, at: i64, kind: BeatKind) -> Beat {
    Beat {
        agent: "claude",
        thread: thread.into(),
        project: "app".into(),
        at,
        kind,
    }
}

fn day(beats: Vec<Beat>) -> DayActivity {
    activity(beats, 0).remove("2026-10-20").unwrap_or_default()
}

#[test]
fn a_turn_counts_from_its_prompt_to_its_last_line() {
    let day = day(vec![
        beat("a", at(9, 0), BeatKind::Prompt),
        beat("a", at(9, 1), BeatKind::Answer),
        beat("a", at(9, 3), BeatKind::Step),
        beat("a", at(9, 4), BeatKind::Answer),
    ]);
    assert_eq!(day.agent_ms, 4 * MIN);
    assert_eq!(day.prompts, 1);
    assert_eq!(day.projects["app"], 4 * MIN);
    assert_eq!(day.agents["claude"], 4 * MIN);
}

#[test]
fn waiting_on_the_user_between_turns_never_counts() {
    let day = day(vec![
        beat("a", at(9, 0), BeatKind::Prompt),
        beat("a", at(9, 2), BeatKind::Answer),
        beat("a", at(11, 0), BeatKind::Prompt),
        beat("a", at(11, 1), BeatKind::Answer),
    ]);
    assert_eq!(day.agent_ms, 3 * MIN);
    assert_eq!(day.prompts, 2);
}

#[test]
fn a_stalled_turn_counts_only_up_to_the_cap() {
    let day = day(vec![
        beat("a", at(9, 0), BeatKind::Prompt),
        beat("a", at(9, 1), BeatKind::Answer),
        beat("a", at(13, 0), BeatKind::Step),
    ]);
    assert_eq!(day.agent_ms, MIN + IDLE_CAP_MS);
}

#[test]
fn a_prompt_the_agent_never_answered_is_not_counted() {
    let day = day(vec![
        beat("a", at(9, 0), BeatKind::Prompt),
        beat("a", at(9, 0), BeatKind::Step),
        beat("a", at(9, 5), BeatKind::Prompt),
        beat("a", at(9, 6), BeatKind::Answer),
    ]);
    assert_eq!(day.prompts, 1);
}

#[test]
fn a_turn_nobody_typed_counts_as_work_but_not_as_a_prompt() {
    let day = day(vec![
        beat("a", at(9, 0), BeatKind::Opener),
        beat("a", at(9, 2), BeatKind::Answer),
    ]);
    assert_eq!(day.agent_ms, 2 * MIN);
    assert_eq!(day.prompts, 0);
}

#[test]
fn lines_after_a_turn_ends_are_idle_until_the_next_one() {
    let day = day(vec![
        beat("a", at(9, 0), BeatKind::Prompt),
        beat("a", at(9, 2), BeatKind::Answer),
        beat("a", at(9, 3), BeatKind::End),
        beat("a", at(9, 9), BeatKind::Step),
        beat("a", at(10, 0), BeatKind::Opener),
        beat("a", at(10, 1), BeatKind::Answer),
    ]);
    assert_eq!(day.agent_ms, 4 * MIN);
}

#[test]
fn agents_working_at_once_each_count() {
    let day = day(vec![
        beat("a", at(9, 0), BeatKind::Prompt),
        beat("a", at(9, 10), BeatKind::Answer),
        beat("b", at(9, 0), BeatKind::Prompt),
        beat("b", at(9, 10), BeatKind::Answer),
    ]);
    assert_eq!(day.agent_ms, 20 * MIN);
    assert_eq!(day.threads.len(), 2);
}

#[test]
fn work_before_the_window_is_left_out() {
    let days = activity(
        vec![
            beat("a", at(9, 0), BeatKind::Prompt),
            beat("a", at(9, 5), BeatKind::Answer),
            beat("a", at(9, 8), BeatKind::Answer),
        ],
        at(9, 6),
    );
    let day = &days["2026-10-20"];
    assert_eq!(day.agent_ms, 3 * MIN);
    assert_eq!(day.prompts, 0);
}
