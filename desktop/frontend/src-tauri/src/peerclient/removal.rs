// Removing a machine removes this Mac on it too. Over a live connection it hears
// at once (`forget`); otherwise the entry is kept in peer.json under `forgets`,
// out of every list, and told once the machine answers again. A machine that
// removed this Mac on its side says `revoked`, and its entry goes here as well.
use super::{
    dial_capture, dial_pinned, dial_plain, emit_state_changed, ClientWs, PeerClientHub,
    IDENTITY_CHANGED, TUNNEL_WAIT,
};
use crate::peer::{self, PeerConfig, PeerEntry};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::mpsc::{self, Receiver, SyncSender};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::Emitter;
use tungstenite::Message;

const DIAL_TIMEOUT: Duration = Duration::from_secs(5);
const CLOSE_WAIT: Duration = Duration::from_secs(5);
const RETRY_MIN_MS: i64 = 60_000;
const RETRY_MAX_MS: i64 = 30 * 60_000;
// Past this the machine is taken to be gone for good; it keeps a record nothing uses.
const GIVE_UP_MS: i64 = 30 * 24 * 60 * 60_000;
const VERIFY_AFTER_MS: i64 = 30_000;

static WAKE: Mutex<Option<SyncSender<()>>> = Mutex::new(None);

const REMOVED_EVENT: &str = "peer-removed-remotely";

/// A machine removed here that hasn't confirmed it heard.
#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(default, rename_all = "camelCase")]
pub(crate) struct PendingForget {
    pub peer: PeerEntry,
    pub since: i64,
    pub next_try: i64,
    pub attempts: u32,
}

/// What the machine still needs to hear when its entry is dropped.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub(crate) enum Tell {
    /// It couldn't be told live: try as soon as it can be reached.
    Now,
    /// A `forget` went out over the live connection: check later that it landed.
    Verify,
    /// Nothing: it removed this Mac itself, or lpm is gone from it.
    Nothing,
}

impl PeerClientHub {
    /// Stop connecting to `slug` and drop it from the list.
    pub(crate) fn drop_peer(&self, slug: &str, reason: &str, tell: Tell) -> Result<(), String> {
        self.stop_conn(slug, reason);
        {
            let mut cfg = self.inner.config.lock().unwrap();
            let gone = cfg.peers.iter().find(|p| p.slug == slug).cloned();
            cfg.peers.retain(|p| p.slug != slug);
            if let Some(gone) = gone {
                remember(&mut cfg, gone, tell, crate::status::now_millis());
            }
            let snapshot = cfg.clone();
            drop(cfg);
            peer::save_config(&snapshot)?;
        }
        if tell != Tell::Nothing {
            wake();
        }
        emit_state_changed(self);
        Ok(())
    }

    /// The machine `slug` removed this Mac: it goes from the list here too, and
    /// whoever is at this one hears why.
    pub(super) fn drop_revoked_peer(&self, slug: &str) {
        let name = self.peer_alias(slug);
        if self.drop_peer(slug, "removed on that machine", Tell::Nothing).is_err() {
            return;
        }
        if let Some(app) = self.app() {
            let _ = app.emit(REMOVED_EVENT, json!({ "name": name }));
        }
    }

    fn due_forgets(&self, now: i64) -> Vec<PendingForget> {
        let cfg = self.inner.config.lock().unwrap();
        cfg.forgets
            .iter()
            .filter(|f| f.next_try <= now)
            .cloned()
            .collect()
    }

    fn next_forget_at(&self) -> Option<i64> {
        let cfg = self.inner.config.lock().unwrap();
        cfg.forgets.iter().map(|f| f.next_try).min()
    }

    fn settle_forget(&self, device_id: &str, done: bool, now: i64) {
        let mut cfg = self.inner.config.lock().unwrap();
        settle(&mut cfg, device_id, done, now);
        let snapshot = cfg.clone();
        drop(cfg);
        let _ = peer::save_config(&snapshot);
    }
}

fn remember(cfg: &mut PeerConfig, peer: PeerEntry, tell: Tell, now: i64) {
    let next_try = match tell {
        Tell::Nothing => return,
        Tell::Now => now,
        Tell::Verify => now + VERIFY_AFTER_MS,
    };
    if peer.device_id.is_empty() || peer.token.is_empty() {
        return;
    }
    cfg.forgets.retain(|f| f.peer.device_id != peer.device_id);
    cfg.forgets.push(PendingForget {
        peer,
        since: now,
        next_try,
        attempts: 0,
    });
}

fn settle(cfg: &mut PeerConfig, device_id: &str, done: bool, now: i64) {
    let Some(i) = cfg
        .forgets
        .iter()
        .position(|f| f.peer.device_id == device_id)
    else {
        return;
    };
    if done || now - cfg.forgets[i].since > GIVE_UP_MS {
        cfg.forgets.remove(i);
        return;
    }
    let f = &mut cfg.forgets[i];
    f.attempts = f.attempts.saturating_add(1);
    f.next_try = now + retry_after(f.attempts);
}

/// 1 minute after the first miss, doubling up to `RETRY_MAX_MS`.
fn retry_after(attempts: u32) -> i64 {
    RETRY_MIN_MS
        .saturating_mul(1 << attempts.saturating_sub(1).min(10))
        .min(RETRY_MAX_MS)
}

fn wake() {
    if let Some(tx) = WAKE.lock().unwrap().as_ref() {
        let _ = tx.try_send(());
    }
}

/// Deliver what is pending now and whatever is removed later, for as long as the
/// app runs.
pub(super) fn start(hub: PeerClientHub) {
    let (tx, rx) = mpsc::sync_channel::<()>(1);
    *WAKE.lock().unwrap() = Some(tx);
    std::thread::spawn(move || run(hub, rx));
}

fn run(hub: PeerClientHub, wake: Receiver<()>) {
    loop {
        let now = crate::status::now_millis();
        for f in hub.due_forgets(now) {
            let done = tell(&f.peer).is_ok();
            hub.settle_forget(&f.peer.device_id, done, crate::status::now_millis());
        }
        let woke = match hub.next_forget_at() {
            Some(at) => {
                let ms = (at - crate::status::now_millis()).max(1_000) as u64;
                wake.recv_timeout(Duration::from_millis(ms))
                    .map_err(|e| e == mpsc::RecvTimeoutError::Disconnected)
            }
            None => wake.recv().map_err(|_| true),
        };
        if woke == Err(true) {
            return;
        }
    }
}

/// Sign in as this Mac once more and say `forget`. Ok once the machine heard it,
/// or turns this Mac away because it no longer has it.
fn tell(peer: &PeerEntry) -> Result<(), String> {
    let tunnel = peer
        .ssh
        .is_set()
        .then(|| crate::peertunnel::Tunnel::new(peer.ssh.clone(), peer.port));
    let told = (|| {
        let mut ws = match &tunnel {
            Some(tunnel) => {
                tunnel.start();
                let port =
                    tunnel.wait_until_up(TUNNEL_WAIT, "could not open the SSH connection")?;
                dial(peer, "127.0.0.1", port)?
            }
            None => dial(peer, &peer.host, peer.port)?,
        };
        ws.send(Message::text(
            json!({ "t": "auth", "deviceId": peer.device_id, "token": peer.token }).to_string(),
        ))
        .map_err(|e| e.to_string())?;
        let first = first_text(&mut ws)?;
        let v: Value = serde_json::from_str(&first).unwrap_or(Value::Null);
        match v.get("t").and_then(Value::as_str) {
            Some("ready") => {
                ws.send(Message::text(json!({ "t": "forget" }).to_string()))
                    .map_err(|e| e.to_string())?;
                wait_for_close(&mut ws);
                Ok(())
            }
            _ => match v.get("error").and_then(Value::as_str) {
                Some("unauthorized") | Some(peer::REVOKED) => Ok(()),
                other => Err(other.unwrap_or("no answer").to_string()),
            },
        }
    })();
    if let Some(tunnel) = tunnel {
        tunnel.stop();
    }
    told
}

fn dial(peer: &PeerEntry, host: &str, port: u16) -> Result<ClientWs, String> {
    match peer.tls_fp.as_deref() {
        Some(fp) => dial_pinned(host, port, fp, Some(DIAL_TIMEOUT), IDENTITY_CHANGED),
        None => dial_capture(host, port, Some(DIAL_TIMEOUT))
            .map(|(ws, _)| ws)
            .or_else(|_| dial_plain(host, port, Some(DIAL_TIMEOUT))),
    }
}

fn first_text(ws: &mut ClientWs) -> Result<String, String> {
    loop {
        match ws.read() {
            Ok(m) if m.is_text() => return Ok(m.to_text().unwrap_or_default().to_string()),
            Ok(m) if m.is_close() => return Err("closed during auth".into()),
            Ok(_) => continue,
            Err(e) => return Err(e.to_string()),
        }
    }
}

/// The machine closes once it has dropped this Mac's record.
fn wait_for_close(ws: &mut ClientWs) {
    let until = Instant::now() + CLOSE_WAIT;
    while Instant::now() < until {
        match ws.read() {
            Ok(m) if m.is_close() => break,
            Ok(_) => continue,
            Err(_) => break,
        }
    }
    let _ = ws.close(None);
    let _ = ws.flush();
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;
    use std::sync::Arc;

    /// A host on loopback that answers each sign-in with `reply`, reporting every
    /// frame that follows it. Plaintext, so a client's TLS attempt fails and it
    /// falls back, as against a host that predates the encrypted channel.
    fn fake_host(reply: Value) -> (u16, Receiver<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let (tx, rx) = mpsc::sync_channel(16);
        std::thread::spawn(move || {
            for stream in listener.incoming().flatten() {
                let Ok(mut ws) = tungstenite::accept(stream) else {
                    continue;
                };
                let _ = ws.read();
                let _ = ws.send(Message::text(reply.to_string()));
                while let Ok(m) = ws.read() {
                    if m.is_text() {
                        let _ = tx.send(m.to_text().unwrap_or_default().to_string());
                        let _ = ws.close(None);
                    }
                }
            }
        });
        (port, rx)
    }

    fn with_test_config(name: &str, test: impl FnOnce()) {
        let _guard = peer::TEST_CFG_GUARD
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let tmp = std::env::temp_dir().join(format!("lpm-removal-{name}-{}.json", std::process::id()));
        *peer::TEST_CONFIG_PATH.lock().unwrap() = Some(tmp.clone());
        test();
        *peer::TEST_CONFIG_PATH.lock().unwrap() = None;
        let _ = std::fs::remove_file(&tmp);
    }

    fn reachable(port: u16) -> PeerEntry {
        PeerEntry {
            host: "127.0.0.1".into(),
            port,
            enabled: true,
            ..entry("d")
        }
    }

    #[test]
    fn a_removed_machine_is_told_once_it_answers() {
        let (port, frames) = fake_host(json!({ "t": "ready" }));
        assert!(tell(&reachable(port)).is_ok());
        let said: Value = serde_json::from_str(&frames.recv().unwrap()).unwrap();
        assert_eq!(said["t"], "forget");
    }

    #[test]
    fn a_machine_that_no_longer_knows_this_one_needs_no_telling() {
        for error in ["unauthorized", peer::REVOKED] {
            let (port, _) = fake_host(json!({ "t": "error", "error": error }));
            assert!(tell(&reachable(port)).is_ok(), "{error}");
        }
        let (port, _) = fake_host(json!({ "t": "error", "error": "Allow control is turned off there." }));
        assert!(tell(&reachable(port)).is_err());
    }

    #[test]
    fn an_unreachable_machine_is_tried_again_later() {
        let port = TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port();
        assert!(tell(&reachable(port)).is_err());
    }

    // The other machine removed this one: its entry goes here too, and nothing
    // is owed back.
    #[test]
    fn a_machine_that_answers_revoked_is_dropped_from_the_list() {
        with_test_config("revoked", || {
            let (port, _) = fake_host(json!({ "t": "error", "error": peer::REVOKED }));
            let config = Arc::new(Mutex::new(PeerConfig {
                peers: vec![reachable(port)],
                ..Default::default()
            }));
            let hub = PeerClientHub::new(config.clone());
            hub.start_conn("abcd1234");
            let until = Instant::now() + Duration::from_secs(10);
            while !config.lock().unwrap().peers.is_empty() && Instant::now() < until {
                std::thread::sleep(Duration::from_millis(20));
            }
            assert!(config.lock().unwrap().peers.is_empty());
            assert!(config.lock().unwrap().forgets.is_empty());
            assert!(peer::load_config().peers.is_empty());
        });
    }

    #[test]
    fn only_the_revoked_error_ends_a_live_session() {
        assert!(super::super::is_revoked(r#"{"error":"revoked","t":"error"}"#));
        assert!(!super::super::is_revoked(r#"{"t":"error","error":"unauthorized"}"#));
        assert!(!super::super::is_revoked(r#"{"t":"o","id":"x","d":"revoked"}"#));
    }

    fn entry(device_id: &str) -> PeerEntry {
        PeerEntry {
            slug: "abcd1234".into(),
            device_id: device_id.into(),
            token: "t".into(),
            ..Default::default()
        }
    }

    #[test]
    fn a_machine_that_removed_this_one_is_not_told_back() {
        let mut cfg = PeerConfig::default();
        remember(&mut cfg, entry("d"), Tell::Nothing, 1_000);
        assert!(cfg.forgets.is_empty());
    }

    #[test]
    fn one_told_live_is_checked_later_and_one_offline_at_once() {
        let mut cfg = PeerConfig::default();
        remember(&mut cfg, entry("live"), Tell::Verify, 1_000);
        remember(&mut cfg, entry("off"), Tell::Now, 1_000);
        assert_eq!(cfg.forgets[0].next_try, 1_000 + VERIFY_AFTER_MS);
        assert_eq!(cfg.forgets[1].next_try, 1_000);
    }

    #[test]
    fn removing_the_same_machine_again_keeps_one_record() {
        let mut cfg = PeerConfig::default();
        remember(&mut cfg, entry("d"), Tell::Now, 1_000);
        remember(&mut cfg, entry("d"), Tell::Now, 2_000);
        assert_eq!(cfg.forgets.len(), 1);
        assert_eq!(cfg.forgets[0].since, 2_000);
    }

    #[test]
    fn a_failed_try_backs_off_and_a_heard_one_is_dropped() {
        let mut cfg = PeerConfig::default();
        remember(&mut cfg, entry("d"), Tell::Now, 0);
        settle(&mut cfg, "d", false, 10);
        assert_eq!(cfg.forgets[0].attempts, 1);
        assert_eq!(cfg.forgets[0].next_try, 10 + RETRY_MIN_MS);
        settle(&mut cfg, "d", false, 10);
        assert_eq!(cfg.forgets[0].next_try, 10 + 2 * RETRY_MIN_MS);
        for _ in 0..20 {
            settle(&mut cfg, "d", false, 10);
        }
        assert_eq!(cfg.forgets[0].next_try, 10 + RETRY_MAX_MS);
        settle(&mut cfg, "d", true, 20);
        assert!(cfg.forgets.is_empty());
    }

    #[test]
    fn a_machine_unreachable_for_a_month_is_given_up_on() {
        let mut cfg = PeerConfig::default();
        remember(&mut cfg, entry("d"), Tell::Now, 0);
        settle(&mut cfg, "d", false, GIVE_UP_MS + 1);
        assert!(cfg.forgets.is_empty());
    }
}
