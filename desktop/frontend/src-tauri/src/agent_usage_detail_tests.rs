use super::*;
use crate::agent_usage::aggregate_for_test;
use serde_json::json;

fn event(project: &str, session: &str, timestamp: i64, total: u64) -> UsageEvent {
    UsageEvent {
        provider: "claude",
        project: project.into(),
        session_id: session.into(),
        model: "claude-opus".into(),
        timestamp,
        tokens: TokenUsage {
            input_tokens: total,
            total_tokens: total,
            ..Default::default()
        },
        fast: false,
        long_context: false,
    }
}

// Noon, local time, `days` after a fixed date, so the events fall on known days.
fn noon(days: i64) -> i64 {
    use chrono::{Duration, Local, NaiveDate, TimeZone};
    let date = NaiveDate::from_ymd_opt(2026, 10, 1).unwrap() + Duration::days(days);
    Local
        .from_local_datetime(&date.and_hms_opt(12, 0, 0).unwrap())
        .earliest()
        .unwrap()
        .timestamp_millis()
}

#[test]
fn each_day_splits_by_project_and_counts_sessions_once() {
    let stats = aggregate_for_test(vec![
        event("lpm", "a", noon(0), 10),
        event("lpm", "a", noon(0) + 1_000, 5),
        event("web", "b", noon(0), 7),
        event("lpm", "a", noon(1), 3),
        event("lpm", "c", noon(1), 4),
    ]);
    let first = &stats.daily[0];
    assert_eq!(first.date, "2026-10-01");
    let lpm = first.projects.iter().find(|p| p.project == "lpm").unwrap();
    assert_eq!((lpm.sessions, lpm.started), (1, 1));
    assert_eq!(lpm.provider, "claude");
    assert_eq!(lpm.models[0].tokens.total_tokens, 15);
    let web = first.projects.iter().find(|p| p.project == "web").unwrap();
    assert_eq!(web.models[0].tokens.total_tokens, 7);

    let second = stats.daily[1]
        .projects
        .iter()
        .find(|p| p.project == "lpm")
        .unwrap();
    // Session "a" carried on from the day before; only "c" began here.
    assert_eq!((second.sessions, second.started), (2, 1));
    assert_eq!(second.models[0].tokens.total_tokens, 7);
}

#[test]
fn the_phone_gets_neither_project_days_nor_the_period_before() {
    let mut stats = json!({
        "totals": {},
        "previous": { "sessions": 1 },
        "daily": [{ "date": "2026-10-01", "models": [], "projects": [{ "project": "lpm" }] }],
    });
    strip_for_phone(&mut stats);
    assert!(stats.get("previous").is_none());
    assert!(stats["daily"][0].get("projects").is_none());
    assert!(stats["daily"][0].get("models").is_some());
}
