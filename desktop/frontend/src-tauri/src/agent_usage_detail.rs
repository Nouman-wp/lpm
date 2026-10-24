//! What the Stats page needs to narrow itself to a day or a project, and to
//! compare with the period before, without scanning the history files again:
//! each day's usage per project and agent, and the previous period's totals.
use crate::agent_usage::{DailyModelUsage, TokenUsage, UsageBreakdown, UsageEvent};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, HashMap, HashSet};

/// One project's usage with one agent on one day.
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct DailyProjectUsage {
    pub(crate) project: String,
    pub(crate) provider: String,
    /// The sessions that ran that day, and how many of them began on it: a span
    /// of days has its first day's sessions plus those started after it.
    pub(crate) sessions: usize,
    pub(crate) started: usize,
    pub(crate) models: Vec<DailyModelUsage>,
}

/// The period of the same length just before the one shown (7 and 30 days only).
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct PreviousUsage {
    pub(crate) sessions: usize,
    pub(crate) totals: TokenUsage,
    pub(crate) projects: Vec<UsageBreakdown>,
}

#[derive(Default)]
struct Cell {
    sessions: HashSet<String>,
    started: usize,
    models: BTreeMap<(String, bool, bool), TokenUsage>,
}

/// Rows keyed by (date, project, provider) while the events are added up.
#[derive(Default)]
pub(crate) struct DailyProjects(BTreeMap<(String, String, String), Cell>);

impl DailyProjects {
    pub(crate) fn add(&mut self, date: &str, event: &UsageEvent, session_key: &str) {
        let cell = self
            .0
            .entry((
                date.to_string(),
                event.project.clone(),
                event.provider.to_string(),
            ))
            .or_default();
        cell.sessions.insert(session_key.to_string());
        cell.models
            .entry((event.model.clone(), event.fast, event.long_context))
            .or_default()
            .add(event.tokens);
    }

    pub(crate) fn mark_started(&mut self, date: &str, project: &str, provider: &str) {
        let key = (date.to_string(), project.to_string(), provider.to_string());
        if let Some(cell) = self.0.get_mut(&key) {
            cell.started += 1;
        }
    }

    pub(crate) fn into_days(self) -> HashMap<String, Vec<DailyProjectUsage>> {
        let mut days: HashMap<String, Vec<DailyProjectUsage>> = HashMap::new();
        for ((date, project, provider), cell) in self.0 {
            let models = cell
                .models
                .into_iter()
                .map(|((model, fast, long_context), tokens)| DailyModelUsage {
                    provider: provider.clone(),
                    model,
                    tokens,
                    fast,
                    long_context,
                })
                .collect();
            days.entry(date).or_default().push(DailyProjectUsage {
                project,
                provider,
                sessions: cell.sessions.len(),
                started: cell.started,
                models,
            });
        }
        days
    }
}

/// Folds another computer's rows for the same day into `into`.
pub(crate) fn merge_day_projects(into: &mut Vec<DailyProjectUsage>, rows: Vec<DailyProjectUsage>) {
    for row in rows {
        let Some(existing) = into
            .iter_mut()
            .find(|r| r.project == row.project && r.provider == row.provider)
        else {
            into.push(row);
            continue;
        };
        existing.sessions += row.sessions;
        existing.started += row.started;
        for model in row.models {
            match existing.models.iter_mut().find(|m| {
                m.model == model.model
                    && m.fast == model.fast
                    && m.long_context == model.long_context
            }) {
                Some(found) => found.tokens.add(model.tokens),
                None => existing.models.push(model),
            }
        }
    }
}

/// The phone's Stats screen reads neither, so its replies stay the size they were.
pub(crate) fn strip_for_phone(stats: &mut Value) {
    if let Some(fields) = stats.as_object_mut() {
        fields.remove("previous");
    }
    if let Some(days) = stats.get_mut("daily").and_then(Value::as_array_mut) {
        for day in days {
            if let Some(fields) = day.as_object_mut() {
                fields.remove("projects");
            }
        }
    }
}

#[cfg(test)]
#[path = "agent_usage_detail_tests.rs"]
mod tests;
