// The one reader of the bot's updates in this app. While a question lpm posted
// to Telegram is open it long-polls getUpdates, and each batch goes both to
// linking (telegram::take_new_chats) and to answers (telegramanswer), so
// neither swallows the other's updates. Settings' chat finder reads the same
// stream. One process reads at a time (a lock file under ~/.lpm). The user
// answering on lpm's message for a question this machine never posted is
// answering another Mac with the same bot: that update isn't confirmed for
// two minutes, so that Mac can still read it.

use crate::telegram::{api, client, ApiError};
use crate::telegramanswer::{self, Seen};
use crate::telegramasks;
use crate::telegramlink::Chat;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Listener};

const LONG_POLL_SECS: u64 = 25;
const FOREIGN_GRACE: Duration = Duration::from_secs(120);
const MAX_HELD: usize = 10;
const LOCK_FILE: &str = "telegram-poll.lock";

static APP: OnceLock<AppHandle> = OnceLock::new();
static RUNNING: AtomicBool = AtomicBool::new(false);
static STOP: AtomicBool = AtomicBool::new(false);
/// Reading stopped for good (no token, a revoked one, a webhook on the bot)
/// until a question is posted again, which proves the token works.
static FATAL: AtomicBool = AtomicBool::new(false);
/// This process posted a question; a debug build reads the bot only then.
static POSTED_HERE: AtomicBool = AtomicBool::new(false);
static PUMP: Mutex<()> = Mutex::new(());
static ADDED: Mutex<Vec<Chat>> = Mutex::new(Vec::new());
/// Foreign updates held back, by when each was first seen.
static HELD: Mutex<Option<HashMap<i64, Instant>>> = Mutex::new(None);

enum End {
    /// Nothing left to wait for, or the token changed: a new question starts
    /// it again.
    Idle,
    Fatal(String),
}

pub fn init(app: &AppHandle) {
    let _ = APP.set(app.clone());
    app.listen("job-status", |event| {
        // A debug build sharing ~/.lpm reads the token only for questions it
        // posted itself, so it never brings up a Keychain prompt at launch.
        if cfg!(debug_assertions) && !POSTED_HERE.load(Ordering::SeqCst) {
            return;
        }
        let Ok(v) = serde_json::from_str::<Value>(event.payload()) else {
            return;
        };
        let (Some(project), Some(job)) = (v["project"].as_str(), v["jobId"].as_str()) else {
            return;
        };
        let (project, job) = (project.to_string(), job.to_string());
        std::thread::spawn(move || {
            let posted = telegramasks::with(|r| {
                r.entries
                    .iter()
                    .any(|e| e.project == project && e.job == job)
            });
            if let (true, Ok(token)) = (posted, crate::telegram::token()) {
                telegramanswer::reconcile(&token, Some((&project, &job)));
            }
        });
    });
    if !cfg!(debug_assertions) && telegramasks::with(|r| r.has_open()) {
        ensure_running();
    }
}

/// A question went out to Telegram: start reading, even after a fatal stop.
pub fn posted() {
    POSTED_HERE.store(true, Ordering::SeqCst);
    FATAL.store(false, Ordering::SeqCst);
    ensure_running();
}

fn ensure_running() {
    if APP.get().is_none()
        || FATAL.load(Ordering::SeqCst)
        || RUNNING.swap(true, Ordering::SeqCst)
    {
        return;
    }
    STOP.store(false, Ordering::SeqCst);
    std::thread::spawn(|| {
        let end = run();
        RUNNING.store(false, Ordering::SeqCst);
        match end {
            End::Fatal(error) => {
                FATAL.store(true, Ordering::SeqCst);
                if let Some(app) = APP.get() {
                    let _ = app.emit(
                        "send-to-failed",
                        json!({ "destination": "Telegram", "title": "Answering questions in Telegram stopped.", "error": error }),
                    );
                }
            }
            End::Idle if wanted() => ensure_running(),
            End::Idle => {}
        }
    });
}

pub fn stop() {
    STOP.store(true, Ordering::SeqCst);
}

fn pause(d: Duration) {
    let end = Instant::now() + d;
    while !STOP.load(Ordering::SeqCst) && Instant::now() < end {
        std::thread::sleep(
            Duration::from_secs(1).min(end.saturating_duration_since(Instant::now())),
        );
    }
}

fn wanted() -> bool {
    !STOP.load(Ordering::SeqCst) && telegramasks::with(|r| r.has_open())
}

fn lock_file() -> Option<std::fs::File> {
    std::fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .write(true)
        .open(crate::config::lpm_dir().join(LOCK_FILE))
        .ok()
}

/// False only when another process holds the lock; a lock the system can't
/// take (an NFS home without lockd) doesn't stop reading.
fn try_lock(file: &Option<std::fs::File>) -> bool {
    file.as_ref()
        .is_none_or(|f| crate::fsperm::try_lock_exclusive(f).unwrap_or(true))
}

fn run() -> End {
    let lock = lock_file();
    while !try_lock(&lock) {
        if !wanted() {
            return End::Idle;
        }
        pause(Duration::from_secs(30));
    }
    let Ok(token) = crate::telegram::token() else {
        return End::Fatal("Telegram isn't connected.".into());
    };
    let Ok(client) = client(Duration::from_secs(LONG_POLL_SECS + 10)) else {
        return End::Idle;
    };
    let mut failures = 0u32;
    while wanted() {
        if crate::telegram::token().ok().as_deref() != Some(token.as_str()) {
            return End::Idle;
        }
        telegramanswer::reconcile(&token, None);
        match pump(&client, &token, LONG_POLL_SECS) {
            Ok(idle) => {
                failures = 0;
                if idle {
                    pause(Duration::from_secs(3));
                }
            }
            Err(e) => match wait_after(&e, failures) {
                Some(d) => {
                    failures += 1;
                    pause(d);
                }
                None => return End::Fatal(e.text),
            },
        }
    }
    End::Idle
}

/// How long to wait after a failed read, or None when reading can't work: the
/// token was revoked or is malformed, or the bot has a webhook.
fn wait_after(e: &ApiError, failures: u32) -> Option<Duration> {
    match e.code {
        Some(401) | Some(404) => None,
        Some(409) if e.text.contains("webhook") => None,
        Some(429) => Some(Duration::from_secs(e.retry_after.unwrap_or(5).max(1))),
        // Another process is reading this bot's updates.
        Some(409) => Some(Duration::from_secs(5)),
        _ => Some(Duration::from_secs((2u64 << failures.min(5)).min(60))),
    }
}

/// The next update to read: past everything, except a foreign update still in
/// its grace, which waits to be confirmed with everything after it.
fn next_offset(ids: &[i64], held: &HashMap<i64, Instant>, now: Instant) -> Option<i64> {
    let waiting = ids
        .iter()
        .copied()
        .filter(|id| {
            held.get(id)
                .is_some_and(|t| now.duration_since(*t) < FOREIGN_GRACE)
        })
        .min();
    waiting.or_else(|| ids.iter().max().map(|m| m + 1))
}

/// Reads one batch of updates and deals with each one not dealt with before.
/// Ok(true) when nothing new came in, only updates held back.
fn pump(client: &reqwest::blocking::Client, token: &str, timeout: u64) -> Result<bool, ApiError> {
    let _one = PUMP.lock().unwrap_or_else(|e| e.into_inner());
    let mut body = json!({
        "timeout": timeout,
        "allowed_updates": ["message", "channel_post", "my_chat_member", "callback_query"],
    });
    let (offset, handled) = telegramasks::with(|r| (r.offset, r.handled.clone()));
    if let Some(offset) = offset {
        body["offset"] = json!(offset);
    }
    let updates = api(client, token, "getUpdates", &body)?;
    let list = updates.as_array().cloned().unwrap_or_default();
    if list.is_empty() {
        return Ok(false);
    }
    let unseen: Vec<Value> = list
        .iter()
        .filter(|u| {
            u["update_id"]
                .as_i64()
                .is_some_and(|id| !handled.contains(&id))
        })
        .cloned()
        .collect();
    let joined = crate::telegram::take_new_chats(token, &Value::Array(unseen.clone()));
    ADDED
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .extend(joined);
    let mut fresh = false;
    let mut done = Vec::new();
    for update in &unseen {
        let Some(id) = update["update_id"].as_i64() else {
            continue;
        };
        let seen = APP
            .get()
            .map_or(Seen::Other, |app| telegramanswer::handle(app, token, update));
        let mut guard = HELD.lock().unwrap_or_else(|e| e.into_inner());
        let held = guard.get_or_insert_with(HashMap::new);
        if seen == Seen::Foreign && (held.contains_key(&id) || held.len() < MAX_HELD) {
            fresh |= !held.contains_key(&id);
            held.entry(id).or_insert_with(Instant::now);
        } else {
            fresh = true;
            done.push(id);
        }
    }
    let ids: Vec<i64> = list.iter().filter_map(|u| u["update_id"].as_i64()).collect();
    let next = {
        let mut guard = HELD.lock().unwrap_or_else(|e| e.into_inner());
        let held = guard.get_or_insert_with(HashMap::new);
        let next = next_offset(&ids, held, Instant::now());
        if let Some(next) = next {
            held.retain(|id, _| *id >= next);
        }
        next
    };
    telegramasks::with(|r| {
        r.handled.extend(done);
        if let Some(next) = next {
            r.offset = Some(next);
            r.handled.retain(|id| *id >= next);
        }
        r.handled.sort_unstable();
        r.handled.dedup();
    });
    Ok(!fresh)
}

/// For Settings' chat finder: the chats that joined since the last look. When
/// nothing in this app is reading the bot, one short read happens here,
/// unless another process holds the reading lock.
pub fn look() -> Result<Vec<Chat>, String> {
    if !RUNNING.load(Ordering::SeqCst) {
        let lock = lock_file();
        if try_lock(&lock) {
            let token = crate::telegram::token()?;
            pump(&client(Duration::from_secs(20))?, &token, 0).map_err(|e| e.text)?;
        }
    }
    Ok(std::mem::take(
        &mut *ADDED.lock().unwrap_or_else(|e| e.into_inner()),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn err(code: Option<i64>, retry_after: Option<u64>, text: &str) -> ApiError {
        ApiError {
            code,
            retry_after,
            text: text.into(),
        }
    }

    #[test]
    fn waits_as_telegram_asks_and_gives_up_when_reading_cant_work() {
        let webhook = "Conflict: can't use getUpdates method while webhook is active";
        let other = "Conflict: terminated by other getUpdates request";
        assert_eq!(wait_after(&err(Some(401), None, ""), 0), None);
        assert_eq!(wait_after(&err(Some(404), None, ""), 0), None);
        assert_eq!(wait_after(&err(Some(409), None, webhook), 0), None);
        assert_eq!(
            wait_after(&err(Some(429), Some(17), ""), 0),
            Some(Duration::from_secs(17))
        );
        assert_eq!(
            wait_after(&err(Some(409), None, other), 3),
            Some(Duration::from_secs(5))
        );
        assert_eq!(wait_after(&err(None, None, ""), 0), Some(Duration::from_secs(2)));
        assert_eq!(wait_after(&err(None, None, ""), 2), Some(Duration::from_secs(8)));
        assert_eq!(wait_after(&err(None, None, ""), 9), Some(Duration::from_secs(60)));
    }

    #[test]
    fn confirms_past_everything_but_a_foreign_update_in_its_grace() {
        let now = Instant::now();
        let none = HashMap::new();
        assert_eq!(next_offset(&[5, 6, 7], &none, now), Some(8));
        assert_eq!(next_offset(&[], &none, now), None);
        let fresh = HashMap::from([(6, now)]);
        assert_eq!(next_offset(&[5, 6, 7], &fresh, now), Some(6));
        let old = HashMap::from([(6, now - FOREIGN_GRACE - Duration::from_secs(1))]);
        assert_eq!(next_offset(&[5, 6, 7], &old, now), Some(8));
    }

    #[test]
    fn a_lock_the_system_cant_take_doesnt_stop_reading() {
        assert!(try_lock(&None));
    }
}
