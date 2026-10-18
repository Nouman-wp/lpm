use super::*;
use crate::agent_usage::{AgentSessionUsage, DailyModelUsage, TokenUsage};

fn tokens(total: u64) -> TokenUsage {
    TokenUsage {
        input_tokens: total,
        total_tokens: total,
        ..Default::default()
    }
}

fn row(key: &str, sessions: usize, total: u64, fast: bool) -> UsageBreakdown {
    UsageBreakdown {
        key: key.into(),
        label: key.into(),
        sessions,
        tokens: tokens(total),
        provider: Some("claude".into()),
        fast,
    }
}

fn day(date: &str, model: &str, total: u64) -> DailyUsage {
    DailyUsage {
        date: date.into(),
        claude_tokens: total,
        codex_tokens: 0,
        total_tokens: total,
        models: vec![DailyModelUsage {
            provider: "claude".into(),
            model: model.into(),
            tokens: tokens(total),
            fast: false,
        }],
    }
}

fn session(project: &str, last_at: i64) -> AgentSessionUsage {
    AgentSessionUsage {
        provider: "claude".into(),
        project: project.into(),
        model: "claude-opus".into(),
        started_at: last_at - 10,
        last_at,
        tokens: tokens(1),
        machine: None,
    }
}

fn stats(
    projects: Vec<UsageBreakdown>,
    daily: Vec<DailyUsage>,
    sessions: Vec<AgentSessionUsage>,
) -> AgentUsageStats {
    let total: u64 = projects.iter().map(|p| p.tokens.total_tokens).sum();
    AgentUsageStats {
        sessions: projects.iter().map(|p| p.sessions).sum(),
        totals: tokens(total),
        projects,
        daily,
        recent_sessions: sessions,
        sources: vec![UsageSource {
            provider: "claude".into(),
            files: 2,
        }],
        ..Default::default()
    }
}

#[test]
fn a_project_on_two_computers_is_one_row() {
    let merged = merge(
        vec![
            (
                "local".into(),
                stats(
                    vec![row("lpm", 3, 100, false), row("web", 1, 10, false)],
                    vec![],
                    vec![],
                ),
            ),
            (
                "mbp".into(),
                stats(
                    vec![row("lpm", 2, 50, false), row("api", 1, 200, false)],
                    vec![],
                    vec![],
                ),
            ),
        ],
        30,
    );
    let rows: Vec<(&str, usize, u64)> = merged
        .projects
        .iter()
        .map(|p| (p.key.as_str(), p.sessions, p.tokens.total_tokens))
        .collect();
    assert_eq!(rows, vec![("api", 1, 200), ("lpm", 5, 150), ("web", 1, 10)]);
    assert_eq!(merged.sessions, 7);
    assert_eq!(merged.totals.total_tokens, 360);
    assert_eq!(merged.days, 30);
    assert_eq!(merged.sources[0].files, 4);
}

#[test]
fn fast_mode_stays_its_own_model_row() {
    let mut local = stats(vec![], vec![], vec![]);
    local.models = vec![row("claude-opus", 1, 10, false)];
    let mut mbp = stats(vec![], vec![], vec![]);
    mbp.models = vec![
        row("claude-opus", 1, 20, true),
        row("claude-opus", 1, 5, false),
    ];
    let merged = merge(vec![("local".into(), local), ("mbp".into(), mbp)], 7);
    let rows: Vec<(bool, u64)> = merged
        .models
        .iter()
        .map(|m| (m.fast, m.tokens.total_tokens))
        .collect();
    assert_eq!(rows, vec![(true, 20), (false, 15)]);
}

#[test]
fn days_add_up_by_date_and_model() {
    let merged = merge(
        vec![
            (
                "local".into(),
                stats(
                    vec![],
                    vec![day("2026-10-17", "opus", 5), day("2026-10-18", "opus", 7)],
                    vec![],
                ),
            ),
            (
                "mbp".into(),
                stats(
                    vec![],
                    vec![day("2026-10-16", "opus", 1), day("2026-10-18", "sonnet", 3)],
                    vec![],
                ),
            ),
        ],
        7,
    );
    let dates: Vec<(&str, u64, usize)> = merged
        .daily
        .iter()
        .map(|d| (d.date.as_str(), d.total_tokens, d.models.len()))
        .collect();
    assert_eq!(
        dates,
        vec![
            ("2026-10-16", 1, 1),
            ("2026-10-17", 5, 1),
            ("2026-10-18", 10, 2)
        ]
    );
}

#[test]
fn recent_sessions_name_their_computer_newest_first() {
    let merged = merge(
        vec![
            (
                "local".into(),
                stats(vec![], vec![], vec![session("lpm", 30), session("web", 10)]),
            ),
            (
                "mbp".into(),
                stats(vec![], vec![], vec![session("lpm", 20)]),
            ),
        ],
        30,
    );
    let rows: Vec<(i64, Option<&str>)> = merged
        .recent_sessions
        .iter()
        .map(|s| (s.last_at, s.machine.as_deref()))
        .collect();
    assert_eq!(
        rows,
        vec![(30, Some("local")), (20, Some("mbp")), (10, Some("local"))]
    );
}

#[test]
fn one_computer_alone_leaves_its_sessions_unlabelled() {
    let merged = merge(
        vec![(
            "local".into(),
            stats(vec![], vec![], vec![session("lpm", 30)]),
        )],
        30,
    );
    assert_eq!(merged.recent_sessions[0].machine, None);
}

#[test]
fn recent_sessions_stay_capped() {
    let many = |offset: i64| {
        (0..RECENT_SESSIONS as i64)
            .map(|i| session("lpm", offset + i))
            .collect()
    };
    let merged = merge(
        vec![
            ("local".into(), stats(vec![], vec![], many(0))),
            ("mbp".into(), stats(vec![], vec![], many(1000))),
        ],
        0,
    );
    assert_eq!(merged.recent_sessions.len(), RECENT_SESSIONS);
    assert!(merged
        .recent_sessions
        .iter()
        .all(|s| s.machine.as_deref() == Some("mbp")));
}
