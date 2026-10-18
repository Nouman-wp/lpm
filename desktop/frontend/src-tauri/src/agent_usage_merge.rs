//! Several computers' agent usage added together, as if one computer had run
//! every session: the Stats page's "All computers". A project, model or day the
//! computers share becomes one row; recent sessions keep which computer ran them.
use crate::agent_usage::{
    sort_breakdowns, AgentUsageStats, DailyUsage, UsageBreakdown, UsageSource, RECENT_SESSIONS,
};
use std::collections::btree_map::Entry;
use std::collections::{BTreeMap, HashMap};

/// Each computer's stats under its id ("local" or a paired one's slug).
pub(crate) fn merge(parts: Vec<(String, AgentUsageStats)>, days: i64) -> AgentUsageStats {
    let label_sessions = parts.len() > 1;
    let mut merged = AgentUsageStats {
        generated_at: chrono::Utc::now().timestamp_millis(),
        days,
        ..Default::default()
    };
    let mut daily: BTreeMap<String, DailyUsage> = BTreeMap::new();
    for (machine, stats) in parts {
        merged.sessions += stats.sessions;
        merged.totals.add(stats.totals);
        merged.providers.extend(stats.providers);
        merged.projects.extend(stats.projects);
        merged.models.extend(stats.models);
        for day in stats.daily {
            add_day(&mut daily, day);
        }
        merged
            .recent_sessions
            .extend(stats.recent_sessions.into_iter().map(|mut session| {
                if label_sessions {
                    session.machine = Some(machine.clone());
                }
                session
            }));
        add_sources(&mut merged.sources, stats.sources);
    }
    merged.providers = fold_rows(std::mem::take(&mut merged.providers));
    merged.projects = fold_rows(std::mem::take(&mut merged.projects));
    merged.models = fold_rows(std::mem::take(&mut merged.models));
    merged.daily = daily.into_values().collect();
    merged
        .recent_sessions
        .sort_by(|a, b| b.last_at.cmp(&a.last_at));
    merged.recent_sessions.truncate(RECENT_SESSIONS);
    merged
}

fn fold_rows(rows: Vec<UsageBreakdown>) -> Vec<UsageBreakdown> {
    let mut folded: Vec<UsageBreakdown> = Vec::new();
    let mut at: HashMap<(String, bool), usize> = HashMap::new();
    for row in rows {
        match at.get(&(row.key.clone(), row.fast)) {
            Some(&i) => {
                folded[i].sessions += row.sessions;
                folded[i].tokens.add(row.tokens);
            }
            None => {
                at.insert((row.key.clone(), row.fast), folded.len());
                folded.push(row);
            }
        }
    }
    sort_breakdowns(&mut folded);
    folded
}

fn add_day(daily: &mut BTreeMap<String, DailyUsage>, day: DailyUsage) {
    let into = match daily.entry(day.date.clone()) {
        Entry::Vacant(slot) => {
            slot.insert(day);
            return;
        }
        Entry::Occupied(slot) => slot.into_mut(),
    };
    into.claude_tokens = into.claude_tokens.saturating_add(day.claude_tokens);
    into.codex_tokens = into.codex_tokens.saturating_add(day.codex_tokens);
    into.total_tokens = into.total_tokens.saturating_add(day.total_tokens);
    for model in day.models {
        match into.models.iter_mut().find(|m| {
            m.provider == model.provider && m.model == model.model && m.fast == model.fast
        }) {
            Some(existing) => existing.tokens.add(model.tokens),
            None => into.models.push(model),
        }
    }
}

fn add_sources(into: &mut Vec<UsageSource>, sources: Vec<UsageSource>) {
    for source in sources {
        match into.iter_mut().find(|s| s.provider == source.provider) {
            Some(existing) => existing.files += source.files,
            None => into.push(source),
        }
    }
}

#[cfg(test)]
#[path = "agent_usage_merge_tests.rs"]
mod tests;
