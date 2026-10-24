use super::*;
use crate::agent_usage::{AgentSessionUsage, DailyModelUsage, TokenUsage};
use crate::agent_usage_detail::DailyProjectUsage;

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
        long_context: false,
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
            long_context: false,
        }],
        ..Default::default()
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

#[test]
fn a_project_day_on_two_computers_is_one_row() {
    let project_day = |sessions, started, total| DailyProjectUsage {
        project: "lpm".into(),
        provider: "claude".into(),
        sessions,
        started,
        models: day("2026-10-01", "claude-opus", total).models,
    };
    let with_projects = |rows| DailyUsage {
        projects: rows,
        ..day("2026-10-01", "claude-opus", 100)
    };
    let merged = merge(
        vec![
            (
                "local".into(),
                stats(
                    vec![],
                    vec![with_projects(vec![project_day(2, 1, 60)])],
                    vec![],
                ),
            ),
            (
                "mini".into(),
                stats(
                    vec![],
                    vec![with_projects(vec![project_day(1, 1, 40)])],
                    vec![],
                ),
            ),
        ],
        30,
    );
    let rows = &merged.daily[0].projects;
    assert_eq!(rows.len(), 1);
    assert_eq!((rows[0].sessions, rows[0].started), (3, 2));
    assert_eq!(rows[0].models.len(), 1);
    assert_eq!(rows[0].models[0].tokens.total_tokens, 100);
}

#[test]
fn the_period_before_adds_up_only_when_every_computer_has_it() {
    let with_previous = |total| AgentUsageStats {
        previous: Some(PreviousUsage {
            sessions: 1,
            totals: tokens(total),
            projects: vec![row("lpm", 1, total, false)],
        }),
        ..stats(vec![], vec![], vec![])
    };
    let merged = merge(
        vec![
            ("local".into(), with_previous(30)),
            ("mini".into(), with_previous(12)),
        ],
        30,
    );
    let previous = merged.previous.expect("both computers have it");
    assert_eq!(previous.sessions, 2);
    assert_eq!(previous.totals.total_tokens, 42);
    assert_eq!(previous.projects.len(), 1);
    assert_eq!(previous.projects[0].tokens.total_tokens, 42);

    let older = merge(
        vec![
            ("local".into(), with_previous(30)),
            ("old".into(), stats(vec![], vec![], vec![])),
        ],
        30,
    );
    assert!(older.previous.is_none());
}
