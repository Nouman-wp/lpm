//! "Your week in lpm": one week of agent work, sized to share. Agent hours,
//! prompts, the agent mix and the day streak come from the agents' history
//! files, lines from the user's commits and pull requests from GitHub. Every
//! connected computer adds its own week, so only these numbers travel.
use crate::agent_activity::{collect_activity, Activity};
use crate::agent_usage::ProjectMatcher;
use crate::peerclient::PeerClientHub;
use crate::weekly_recap_git::{commits_and_repos, pull_request_repos, RecapCommit};
use chrono::{DateTime, Duration, Local, NaiveDate, TimeZone};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, OnceLock};
use std::time::Instant;
use tauri::{AppHandle, Manager};

/// What a computer answers when another one asks for its week.
pub(crate) const RECAP_CMD: &str = "weekly_recap_local";
const KEEP_FOR: std::time::Duration = std::time::Duration::from_secs(10 * 60);
const DAYS: i64 = 7;

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct RecapDay {
    pub(crate) date: String,
    pub(crate) agent_ms: i64,
    pub(crate) prompts: u64,
}

/// Agent time spent on one project, or by one agent.
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct RecapTime {
    pub(crate) name: String,
    pub(crate) agent_ms: i64,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct WeeklyRecap {
    /// The week's first day, YYYY-MM-DD.
    pub(crate) week: String,
    pub(crate) days: Vec<RecapDay>,
    pub(crate) previous_agent_ms: i64,
    pub(crate) sessions: usize,
    pub(crate) projects: Vec<RecapTime>,
    pub(crate) agents: Vec<RecapTime>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) commits: Vec<RecapCommit>,
    pub(crate) repos: Vec<String>,
    pub(crate) lines_added: u64,
    pub(crate) lines_removed: u64,
    /// None when GitHub couldn't be asked.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) pull_requests: Option<usize>,
    /// Paired computers that couldn't add their week.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) missing: Vec<String>,
}

fn midnight(date: NaiveDate) -> Result<DateTime<Local>, String> {
    date.and_hms_opt(0, 0, 0)
        .and_then(|value| Local.from_local_datetime(&value).earliest())
        .ok_or_else(|| "could not resolve local date".to_string())
}

struct Bounds {
    first: NaiveDate,
    from: DateTime<Local>,
    to: DateTime<Local>,
    previous: DateTime<Local>,
}

fn bounds(week: &str) -> Result<Bounds, String> {
    let first = NaiveDate::parse_from_str(week, "%Y-%m-%d").map_err(|e| format!("week: {e}"))?;
    Ok(Bounds {
        first,
        from: midnight(first)?,
        to: midnight(first + Duration::days(DAYS))?,
        previous: midnight(first - Duration::days(DAYS))?,
    })
}

fn by_time(rows: HashMap<String, i64>) -> Vec<RecapTime> {
    let mut rows: Vec<RecapTime> = rows
        .into_iter()
        .filter(|(_, ms)| *ms > 0)
        .map(|(name, agent_ms)| RecapTime { name, agent_ms })
        .collect();
    rows.sort_by(|a, b| {
        b.agent_ms
            .cmp(&a.agent_ms)
            .then_with(|| a.name.cmp(&b.name))
    });
    rows
}

pub(crate) fn summarize(
    first: NaiveDate,
    activity: &Activity,
    commits: Vec<RecapCommit>,
    repos: Vec<String>,
) -> WeeklyRecap {
    let dates: Vec<String> = (0..DAYS)
        .map(|offset| {
            (first + Duration::days(offset))
                .format("%Y-%m-%d")
                .to_string()
        })
        .collect();
    let earlier: Vec<String> = (1..=DAYS)
        .map(|offset| {
            (first - Duration::days(offset))
                .format("%Y-%m-%d")
                .to_string()
        })
        .collect();
    let mut projects: HashMap<String, i64> = HashMap::new();
    let mut agents: HashMap<String, i64> = HashMap::new();
    let mut threads = HashSet::new();
    let days = dates
        .iter()
        .map(|date| {
            let day = activity.get(date).cloned().unwrap_or_default();
            for (project, ms) in day.projects {
                *projects.entry(project).or_default() += ms;
            }
            for (agent, ms) in day.agents {
                *agents.entry(agent.to_string()).or_default() += ms;
            }
            threads.extend(day.threads);
            RecapDay {
                date: date.clone(),
                agent_ms: day.agent_ms,
                prompts: day.prompts,
            }
        })
        .collect();
    let mut recap = WeeklyRecap {
        week: dates[0].clone(),
        days,
        previous_agent_ms: earlier
            .iter()
            .filter_map(|date| activity.get(date))
            .map(|day| day.agent_ms)
            .sum(),
        sessions: threads.len(),
        projects: by_time(projects),
        agents: by_time(agents),
        commits,
        repos,
        ..Default::default()
    };
    count_lines(&mut recap);
    recap
}

fn count_lines(recap: &mut WeeklyRecap) {
    recap.lines_added = recap.commits.iter().map(|c| c.added).sum();
    recap.lines_removed = recap.commits.iter().map(|c| c.removed).sum();
}

/// This computer's own week, without pull requests: those are asked of GitHub
/// once, by the computer showing the recap.
pub(crate) fn local_recap(week: &str) -> Result<WeeklyRecap, String> {
    let bounds = bounds(week)?;
    let roots: Vec<_> = ProjectMatcher::load()
        .roots
        .into_iter()
        .map(|project| project.root)
        .collect();
    let (activity, (commits, repos)) = std::thread::scope(|scope| {
        let git = scope.spawn(|| commits_and_repos(&roots, bounds.from, bounds.to));
        let activity = collect_activity(bounds.previous.timestamp_millis());
        (activity, git.join().unwrap_or_default())
    });
    Ok(summarize(bounds.first, &activity, commits, repos))
}

/// Several computers' weeks as one: a project or agent they share becomes one
/// row, a commit both reached counts once.
pub(crate) fn merge(parts: Vec<WeeklyRecap>) -> WeeklyRecap {
    let mut parts = parts.into_iter();
    let Some(mut merged) = parts.next() else {
        return WeeklyRecap::default();
    };
    let times = |rows: &mut Vec<RecapTime>| -> HashMap<String, i64> {
        rows.drain(..).map(|row| (row.name, row.agent_ms)).collect()
    };
    let mut projects = times(&mut merged.projects);
    let mut agents = times(&mut merged.agents);
    let mut shas: HashSet<String> = merged.commits.iter().map(|c| c.sha.clone()).collect();
    let mut repos: HashSet<String> = merged.repos.drain(..).collect();
    for part in parts {
        for (into, day) in merged.days.iter_mut().zip(part.days) {
            into.agent_ms += day.agent_ms;
            into.prompts += day.prompts;
        }
        merged.previous_agent_ms += part.previous_agent_ms;
        merged.sessions += part.sessions;
        for row in part.projects {
            *projects.entry(row.name).or_default() += row.agent_ms;
        }
        for row in part.agents {
            *agents.entry(row.name).or_default() += row.agent_ms;
        }
        merged.commits.extend(
            part.commits
                .into_iter()
                .filter(|c| shas.insert(c.sha.clone())),
        );
        repos.extend(part.repos);
    }
    merged.projects = by_time(projects);
    merged.agents = by_time(agents);
    let mut repos: Vec<String> = repos.into_iter().collect();
    repos.sort();
    merged.repos = repos;
    count_lines(&mut merged);
    merged
}

type Kept = Mutex<HashMap<String, (Instant, WeeklyRecap)>>;

fn kept() -> &'static Kept {
    static KEPT: OnceLock<Kept> = OnceLock::new();
    KEPT.get_or_init(Default::default)
}

fn peer_name(peer: &crate::peerclient::PhoneMachine) -> String {
    if peer.entry.alias.is_empty() {
        peer.entry.host.clone()
    } else {
        peer.entry.alias.clone()
    }
}

fn read_week(hub: Option<&PeerClientHub>, week: &str) -> Result<WeeklyRecap, String> {
    let bounds = bounds(week)?;
    let peers = hub.map(PeerClientHub::phone_machines).unwrap_or_default();
    let connected: Vec<_> = peers.iter().filter(|peer| peer.connected).collect();
    let (local, remote, pulls) = std::thread::scope(|scope| {
        let pulls = scope.spawn(|| pull_request_repos(bounds.from, bounds.to));
        let remote: Vec<_> = connected
            .iter()
            .map(|peer| {
                let slug = peer.entry.slug.clone();
                scope.spawn(move || {
                    let read = hub
                        .ok_or_else(|| "not connected".to_string())
                        .and_then(|hub| {
                            hub.invoke_blocking(&slug, RECAP_CMD, json!({ "week": week }))
                        })
                        .and_then(|value| {
                            serde_json::from_value::<WeeklyRecap>(value).map_err(|e| e.to_string())
                        });
                    (peer_name(peer), read)
                })
            })
            .collect();
        let local = local_recap(week);
        let remote: Vec<_> = remote.into_iter().filter_map(|h| h.join().ok()).collect();
        (local, remote, pulls.join().ok().flatten())
    });
    let mut parts = vec![local?];
    let mut missing = Vec::new();
    for (name, read) in remote {
        match read {
            Ok(part) if part.days.len() == DAYS as usize => parts.push(part),
            _ => missing.push(name),
        }
    }
    let mut recap = merge(parts);
    recap.missing = missing;
    recap.pull_requests = pulls.map(|found| {
        let repos: HashSet<&str> = recap.repos.iter().map(String::as_str).collect();
        found
            .iter()
            .filter(|repo| repos.contains(repo.as_str()))
            .count()
    });
    recap.commits.clear();
    Ok(recap)
}

/// The week starting `week` (YYYY-MM-DD) on this computer and every connected
/// one. A read is kept for ten minutes unless `fresh`.
#[tauri::command(async)]
pub fn weekly_recap(app: AppHandle, week: String, fresh: bool) -> Result<WeeklyRecap, String> {
    if !fresh {
        let mut kept = kept().lock().unwrap();
        kept.retain(|_, (at, _)| at.elapsed() < KEEP_FOR);
        if let Some((_, recap)) = kept.get(&week) {
            return Ok(recap.clone());
        }
    }
    let hub = app.try_state::<PeerClientHub>().map(|s| s.inner().clone());
    let recap = read_week(hub.as_ref(), &week)?;
    kept()
        .lock()
        .unwrap()
        .insert(week, (Instant::now(), recap.clone()));
    Ok(recap)
}

#[cfg(test)]
#[path = "weekly_recap_tests.rs"]
mod tests;
