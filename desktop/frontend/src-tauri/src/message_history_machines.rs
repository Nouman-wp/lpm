//! Message history across computers. Each computer keeps what was typed on it
//! (message_history); a page here is this computer's rows merged with every
//! connected paired computer's, newest first, so a prompt typed on one can be
//! picked up on another.
//!
//! A paired computer's row is named as this computer sees it: its id marked
//! with that computer's slug (`peer-{slug}-{id}`), so a favorite or delete goes
//! back to the computer that holds it, and its project as this computer names
//! that project.
use std::cmp::Ordering;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::mpsc::{self, Sender};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

use crate::message_history::{self, HistoryRow, MessageHistoryState, QueryInput};
use crate::peerclient::PeerClientHub;

// How long a page waits on one computer. One that answers later is left out of
// that page rather than holding back the rest.
const PEER_WAIT: Duration = Duration::from_secs(3);
const LOCAL: &str = "";

/// `peer-{slug}-{raw}` split into its slug and raw part.
pub(crate) fn split_peer_name(value: &str) -> Option<(&str, &str)> {
    let rest = value.strip_prefix("peer-")?;
    let slug = rest.get(..8)?;
    let raw = rest.get(8..)?.strip_prefix('-')?;
    slug.bytes()
        .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        .then_some((slug, raw))
}

/// A project's name with any paired computer's marker taken off.
pub(crate) fn raw_name(name: &str) -> &str {
    split_peer_name(name).map_or(name, |(_, raw)| raw)
}

fn machine_key(row: &HistoryRow) -> &str {
    row.machine.as_deref().unwrap_or(LOCAL)
}

// Rows are ordered newest first, then by computer, then newest-inserted first:
// one order every computer's rows fit into, so a cursor names a single point.
fn page_order(a: &HistoryRow, b: &HistoryRow) -> Ordering {
    b.at.cmp(&a.at)
        .then_with(|| machine_key(a).cmp(machine_key(b)))
        .then_with(|| b.seq.cmp(&a.seq))
}

// Where one computer's next page starts. Its seq only orders its own rows, so
// at the cursor's exact moment a computer that sorts after the cursor's still
// has all of its rows to show, and one that sorts before has shown them all.
fn cursor_for(input: &QueryInput, key: &str) -> (Option<i64>, Option<i64>) {
    let (Some(at), Some(seq)) = (input.cursor_at, input.cursor_seq) else {
        return (None, None);
    };
    let seq = match key.cmp(input.cursor_machine.as_deref().unwrap_or(LOCAL)) {
        Ordering::Equal => seq,
        Ordering::Greater => i64::MAX,
        Ordering::Less => i64::MIN,
    };
    (Some(at), Some(seq))
}

fn input_for(input: &QueryInput, key: &str) -> QueryInput {
    let (cursor_at, cursor_seq) = cursor_for(input, key);
    QueryInput {
        project_name: raw_name(&input.project_name).to_string(),
        cursor_at,
        cursor_seq,
        machines: false,
        cursor_machine: None,
        ..input.clone()
    }
}

fn from_peer(slug: &str, name: &str, mut row: HistoryRow) -> HistoryRow {
    row.id = format!("peer-{slug}-{}", row.id);
    row.project_name = match split_peer_name(&row.project_name) {
        // Typed there into a project of a computer it is paired with, which may
        // be this one: named by the project alone.
        Some((_, raw)) => raw.to_string(),
        None => format!("peer-{slug}-{}", row.project_name),
    };
    // Folders are each computer's own.
    row.folder_id = None;
    row.machine = Some(slug.to_string());
    row.machine_name = Some(name.to_string());
    row
}

fn read_peer(hub: &PeerClientHub, slug: &str, name: &str, input: QueryInput) -> Vec<HistoryRow> {
    let rows = hub
        .invoke_within(
            slug,
            "message_history_query",
            json!({ "input": input }),
            PEER_WAIT,
        )
        .and_then(|value| {
            serde_json::from_value::<Vec<HistoryRow>>(value).map_err(|e| e.to_string())
        })
        .unwrap_or_default();
    rows.into_iter()
        .map(|row| from_peer(slug, name, row))
        .collect()
}

fn connected_peers(hub: &PeerClientHub) -> Vec<(String, String)> {
    hub.phone_machines()
        .into_iter()
        .filter(|p| p.connected)
        .map(|p| {
            let name = if p.entry.alias.is_empty() {
                p.entry.host
            } else {
                p.entry.alias
            };
            (p.entry.slug, name)
        })
        .collect()
}

fn is_folder(collection: &str) -> bool {
    !matches!(collection, "" | "all" | "favorites" | "drafts")
}

/// One page of this computer's history and every connected paired computer's,
/// merged. A folder is this computer's alone, so a folder's page is too.
pub(crate) fn query(app: &AppHandle, input: &QueryInput) -> Result<Vec<HistoryRow>, String> {
    let hub = app.try_state::<PeerClientHub>();
    let peers = match &hub {
        Some(hub) if !is_folder(&input.collection) => connected_peers(hub),
        _ => Vec::new(),
    };
    let local = input_for(input, LOCAL);
    let state = app.state::<MessageHistoryState>();
    let mut rows = std::thread::scope(|scope| {
        let reading: Vec<_> = peers
            .iter()
            .filter_map(|(slug, name)| {
                let hub = hub.as_ref()?.inner();
                let peer_input = input_for(input, slug);
                Some(scope.spawn(move || read_peer(hub, slug, name, peer_input)))
            })
            .collect();
        let mut rows = message_history::query_local(&state, &local)?;
        for handle in reading {
            rows.extend(handle.join().unwrap_or_default());
        }
        Ok::<_, String>(rows)
    })?;
    rows.sort_by(page_order);
    rows.truncate(input.limit.max(1) as usize);
    Ok(rows)
}

/// Sends a command about one of a paired computer's rows to that computer.
/// None for this computer's own rows.
pub(crate) fn forward(app: &AppHandle, cmd: &str, id: &str) -> Option<Result<Value, String>> {
    let (slug, raw) = split_peer_name(id)?;
    Some(match app.try_state::<PeerClientHub>() {
        Some(hub) => hub.invoke_within(slug, cmd, json!({ "id": raw }), PEER_WAIT),
        None => Err("That computer isn't connected".to_string()),
    })
}

/// The history commands a paired computer asks of this one, answered here so a
/// headless host answers them too. Always this computer's own rows: a computer
/// asking never fans out further.
pub(crate) fn serve_peer(
    app: &AppHandle,
    cmd: &str,
    args: &Value,
) -> Option<Result<Value, String>> {
    let state = app.state::<MessageHistoryState>();
    let id = || {
        args.get("id")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string()
    };
    Some(match cmd {
        "message_history_query" => serde_json::from_value::<QueryInput>(args.get("input")?.clone())
            .map_err(|e| e.to_string())
            .and_then(|input| {
                let input = QueryInput {
                    machines: false,
                    ..input
                };
                message_history::query_local(&state, &input)
            })
            .and_then(|rows| serde_json::to_value(rows).map_err(|e| e.to_string())),
        "message_history_toggle_favorite" => {
            message_history::toggle_favorite_state(&state, &id()).map(Value::Bool)
        }
        "message_history_delete" => {
            message_history::delete_local(&state, &id()).map(|_| Value::Null)
        }
        _ => return None,
    })
}

type Job = Box<dyn FnOnce() + Send>;

/// Runs a phone's history request off its read loop, after every one asked
/// before it: a phone pairs history replies with its requests by their order.
pub(crate) fn in_order(job: impl FnOnce() + Send + 'static) {
    static LANE: OnceLock<Mutex<Sender<Job>>> = OnceLock::new();
    let lane = LANE.get_or_init(|| {
        let (tx, rx) = mpsc::channel::<Job>();
        std::thread::spawn(move || {
            for job in rx {
                let _ = catch_unwind(AssertUnwindSafe(job));
            }
        });
        Mutex::new(tx)
    });
    let _ = lane.lock().unwrap().send(Box::new(job));
}

#[cfg(test)]
#[path = "message_history_machines_tests.rs"]
mod tests;
