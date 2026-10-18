//! The Stats page across computers: this one's agent usage, a paired
//! computer's read over the peer link, or all of them added together. Each
//! computer scans its own history files, so only usage numbers travel.
//!
//! A read is kept for a minute per computer and period, so picking one computer
//! after "All computers" answers at once instead of scanning again.
use crate::agent_usage::{agent_usage_stats, AgentUsageStats};
use crate::agent_usage_merge::merge;
use crate::peerclient::{PeerClientHub, PhoneMachine};
use serde::Serialize;
use serde_json::json;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

pub(crate) const ALL: &str = "all";
pub(crate) const LOCAL: &str = "local";
const KEEP_FOR: Duration = Duration::from_secs(60);

/// A computer the Stats page can show, with its total for the period when one
/// has been read.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageMachine {
    id: String,
    name: String,
    platform: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    headless: Option<bool>,
    local: bool,
    connected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    total_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MachinesUsage {
    machine: String,
    stats: AgentUsageStats,
    machines: Vec<UsageMachine>,
}

type Reads = Mutex<HashMap<(String, i64), (Instant, AgentUsageStats)>>;

fn reads() -> &'static Reads {
    static READS: OnceLock<Reads> = OnceLock::new();
    READS.get_or_init(Default::default)
}

fn kept(id: &str, days: i64) -> Option<AgentUsageStats> {
    let mut reads = reads().lock().unwrap();
    reads.retain(|_, (at, _)| at.elapsed() < KEEP_FOR);
    reads
        .get(&(id.to_string(), days))
        .map(|(_, stats)| stats.clone())
}

fn read(
    id: &str,
    days: i64,
    fresh: bool,
    load: impl FnOnce() -> Result<AgentUsageStats, String>,
) -> Result<AgentUsageStats, String> {
    if !fresh {
        if let Some(stats) = kept(id, days) {
            return Ok(stats);
        }
    }
    let stats = load()?;
    reads()
        .lock()
        .unwrap()
        .insert((id.to_string(), days), (Instant::now(), stats.clone()));
    Ok(stats)
}

fn read_peer(hub: &PeerClientHub, slug: &str, days: i64) -> Result<AgentUsageStats, String> {
    let value = hub.invoke_blocking(slug, "agent_usage_stats", json!({ "days": days }))?;
    serde_json::from_value(value).map_err(|e| format!("unreadable stats: {e}"))
}

fn peer_name(peer: &PhoneMachine) -> String {
    if peer.entry.alias.is_empty() {
        peer.entry.host.clone()
    } else {
        peer.entry.alias.clone()
    }
}

/// `machine` is ALL, LOCAL or a paired computer's slug. `fresh` scans again
/// rather than reusing a read from the last minute.
pub(crate) fn machines_usage(
    hub: Option<&PeerClientHub>,
    days: i64,
    machine: &str,
    fresh: bool,
) -> Result<MachinesUsage, String> {
    let peers = hub.map(PeerClientHub::phone_machines).unwrap_or_default();
    let wanted = |id: &str| machine == ALL || machine == id;
    if machine != ALL && machine != LOCAL {
        let peer = peers
            .iter()
            .find(|p| p.entry.slug == machine)
            .ok_or("That computer is no longer paired")?;
        if !peer.connected {
            return Err(format!("{} isn't connected", peer_name(peer)));
        }
    }

    let results: Vec<(String, Result<AgentUsageStats, String>)> = std::thread::scope(|scope| {
        let mut reading = Vec::new();
        if wanted(LOCAL) {
            reading.push(scope.spawn(|| {
                let local = read(LOCAL, days, fresh, || agent_usage_stats(days));
                (LOCAL.to_string(), local)
            }));
        }
        for peer in peers
            .iter()
            .filter(|p| p.connected && wanted(&p.entry.slug))
        {
            let slug = peer.entry.slug.clone();
            reading.push(scope.spawn(move || {
                let stats = match hub {
                    Some(hub) => read(&slug, days, fresh, || read_peer(hub, &slug, days)),
                    None => Err("not connected".to_string()),
                };
                (slug, stats)
            }));
        }
        reading
            .into_iter()
            .map(|handle| {
                handle
                    .join()
                    .unwrap_or_else(|_| (String::new(), Err("stats read failed".into())))
            })
            .collect()
    });

    let mut parts = Vec::new();
    let mut errors = HashMap::new();
    for (id, result) in results {
        match result {
            Ok(stats) => parts.push((id, stats)),
            Err(e) if machine != ALL || id == LOCAL => return Err(e),
            Err(e) => {
                errors.insert(id, e);
            }
        }
    }

    let total = |id: &str| kept(id, days).map(|stats| stats.totals.total_tokens);
    let mut machines = vec![UsageMachine {
        id: LOCAL.into(),
        name: crate::sys::machine_name(),
        platform: std::env::consts::OS.into(),
        headless: Some(crate::sys::headless()),
        local: true,
        connected: true,
        total_tokens: total(LOCAL),
        error: None,
    }];
    machines.extend(peers.iter().map(|peer| UsageMachine {
        id: peer.entry.slug.clone(),
        name: peer_name(peer),
        platform: peer.entry.platform.clone(),
        headless: peer.entry.headless,
        local: false,
        connected: peer.connected,
        total_tokens: total(&peer.entry.slug),
        error: errors.remove(&peer.entry.slug),
    }));

    let stats = if parts.len() == 1 {
        parts.remove(0).1
    } else {
        merge(parts, days)
    };
    Ok(MachinesUsage {
        machine: machine.to_string(),
        stats,
        machines,
    })
}

/// The Stats page's read: one computer's usage for the period, or every
/// connected computer's added together, plus the computers it can pick from.
#[tauri::command(async)]
pub fn agent_usage_machines(
    app: AppHandle,
    days: i64,
    machine: String,
    fresh: bool,
) -> Result<MachinesUsage, String> {
    let hub = app.try_state::<PeerClientHub>().map(|s| s.inner().clone());
    machines_usage(hub.as_ref(), days, &machine, fresh)
}
