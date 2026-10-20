// Tabs other people shared with this machine (the guest side of tabshare.rs).
//
// A joined tab rides the same connection machinery as a paired machine, keyed
// by a slug of its own, so its terminal streams, resumes and reconnects exactly
// like a paired machine's. It is kept apart from `peers` so nothing that lists
// paired machines (the sidebar, sync, phones, updates) ever sees it.
use super::*;
use serde::{Deserialize, Serialize};

const JOIN_WINDOW: Duration = Duration::from_secs(150);
pub(crate) const JOINED_CHANGED_EVENT: &str = "peer-joined-changed";
const JOIN_PENDING_EVENT: &str = "peer-share-join-pending";
// Past any real screen: a 6K display at the smallest font is about 1250×340.
const MAX_COLS: u64 = 2000;
const MAX_ROWS: u64 = 1000;
const MAX_TEXT: usize = 120;
const MAX_TERMINAL_ID: usize = 256;

static JOIN_GEN: AtomicU64 = AtomicU64::new(0);

/// All a shared tab's host may send here.
pub(super) const GUEST_FRAMES: &[&str] = &[
    "pong",
    "result",
    "seed",
    "o",
    "exit",
    "size",
    "shareInfo",
    "shareEnded",
];

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(default, rename_all = "camelCase")]
pub(crate) struct JoinedShare {
    pub slug: String,
    pub host: String,
    pub port: u16,
    pub guest_id: String,
    pub token: String,
    pub tls_fp: String,
    pub host_name: String,
    pub terminal_id: String,
    pub label: String,
    pub project: String,
    pub can_type: bool,
    // Why the host ended it ("stopped", "removed", "closed", …); empty while live.
    pub ended: String,
    pub joined_at: i64,
}

impl JoinedShare {
    fn as_entry(&self) -> PeerEntry {
        PeerEntry {
            slug: self.slug.clone(),
            alias: self.host_name.clone(),
            host: self.host.clone(),
            port: self.port,
            device_id: self.guest_id.clone(),
            token: self.token.clone(),
            tls_fp: Some(self.tls_fp.clone()),
            enabled: true,
            ..Default::default()
        }
    }
}

/// The size a shared tab's host reports, kept within what a screen can show.
/// None for a size no host sends.
pub(super) fn reported_size(v: &Value) -> Option<(u16, u16)> {
    let dim = |k: &str, max: u64| {
        let n = v.get(k).and_then(Value::as_u64).filter(|n| *n > 0)?;
        Some(n.min(max) as u16)
    };
    Some((dim("cols", MAX_COLS)?, dim("rows", MAX_ROWS)?))
}

/// Text from a host this machine never paired with, as it is kept in peer.json.
fn host_text(s: &str) -> String {
    s.chars()
        .filter(|c| !c.is_control())
        .take(MAX_TEXT)
        .collect()
}

/// What the host's `ready` and `shareInfo` frames say about the tab, applied to
/// the stored entry so the sidebar keeps naming it while it's unreachable.
fn apply_info(j: &mut JoinedShare, info: &Value) -> bool {
    let before = (
        j.terminal_id.clone(),
        j.label.clone(),
        j.project.clone(),
        j.can_type,
    );
    let text = |k: &str| info.get(k).and_then(Value::as_str).map(host_text);
    if let Some(t) = info
        .get("terminalId")
        .and_then(Value::as_str)
        .filter(|t| t.len() <= MAX_TERMINAL_ID)
    {
        j.terminal_id = t.to_string();
    }
    if let Some(l) = text("label") {
        j.label = l;
    }
    if let Some(p) = text("project") {
        j.project = p;
    }
    if let Some(c) = info.get("canType").and_then(Value::as_bool) {
        j.can_type = c;
    }
    before
        != (
            j.terminal_id.clone(),
            j.label.clone(),
            j.project.clone(),
            j.can_type,
        )
}

impl PeerClientHub {
    /// A paired machine's entry, or a live joined tab's in the same shape.
    pub(super) fn session_entry(&self, slug: &str) -> Option<PeerEntry> {
        let cfg = self.inner.config.lock().unwrap();
        if let Some(p) = cfg.peers.iter().find(|p| p.slug == slug) {
            return Some(p.clone());
        }
        cfg.joined
            .iter()
            .find(|j| j.slug == slug && j.ended.is_empty())
            .map(JoinedShare::as_entry)
    }

    pub(super) fn is_joined(&self, slug: &str) -> bool {
        self.inner
            .config
            .lock()
            .unwrap()
            .joined
            .iter()
            .any(|j| j.slug == slug)
    }

    fn edit_joined(&self, slug: &str, edit: impl FnOnce(&mut JoinedShare) -> bool) {
        let mut cfg = self.inner.config.lock().unwrap();
        let changed = cfg
            .joined
            .iter_mut()
            .find(|j| j.slug == slug)
            .is_some_and(edit);
        if !changed {
            return;
        }
        let snapshot = cfg.clone();
        drop(cfg);
        let _ = peer::save_config(&snapshot);
        self.emit_joined_changed();
    }

    pub(super) fn note_share_info(&self, slug: &str, info: &Value) {
        self.edit_joined(slug, |j| apply_info(j, info));
    }

    /// The host ended the share, or no longer knows this guest at all (it was
    /// restarted, or removed us while we were away): stop dialling it.
    pub(super) fn end_joined(&self, slug: &str, reason: &str) {
        if !self.is_joined(slug) {
            return;
        }
        self.edit_joined(slug, |j| {
            if !j.ended.is_empty() {
                return false;
            }
            j.ended = host_text(reason);
            true
        });
        if let Some(conn) = self.inner.conns.lock().unwrap().get(slug) {
            conn.enabled.store(false, Ordering::SeqCst);
        }
    }

    pub(super) fn emit_joined_changed(&self) {
        if let Some(app) = self.app() {
            let _ = app.emit(JOINED_CHANGED_EVENT, ());
        }
    }

    pub(super) fn start_joined(&self) {
        let live: Vec<String> = {
            let cfg = self.inner.config.lock().unwrap();
            cfg.joined
                .iter()
                .filter(|j| j.ended.is_empty())
                .map(|j| j.slug.clone())
                .collect()
        };
        for slug in live {
            self.start_conn(&slug);
        }
    }

    fn joined_rows(&self) -> Value {
        let joined = self.inner.config.lock().unwrap().joined.clone();
        let conns = self.inner.conns.lock().unwrap();
        let rows: Vec<Value> = joined
            .iter()
            .map(|j| {
                let conn = conns.get(&j.slug);
                let connected = conn.is_some_and(|c| c.connected.load(Ordering::Relaxed));
                let last_error = conn
                    .map(|c| c.last_error.lock().unwrap().clone())
                    .unwrap_or_default();
                let size = conn.and_then(|c| c.sizes.lock().unwrap().get(&j.terminal_id).copied());
                let terminal = if j.terminal_id.is_empty() {
                    String::new()
                } else {
                    format!("peer-{}-{}", j.slug, j.terminal_id)
                };
                json!({
                    "slug": j.slug,
                    "hostName": j.host_name,
                    "host": j.host,
                    "terminalId": terminal,
                    "label": j.label,
                    "project": j.project,
                    "canType": j.can_type,
                    "connected": connected,
                    "ended": j.ended,
                    "lastError": last_error,
                    "cols": size.map(|s| s.0),
                    "rows": size.map(|s| s.1),
                    "joinedAt": j.joined_at,
                })
            })
            .collect();
        Value::Array(rows)
    }

    fn fresh_slug(&self) -> String {
        let cfg = self.inner.config.lock().unwrap();
        loop {
            let mut b = [0u8; 4];
            let _ = getrandom::fill(&mut b);
            let slug = hex::encode(b);
            let taken = cfg.peers.iter().any(|p| p.slug == slug)
                || cfg.joined.iter().any(|j| j.slug == slug);
            if !taken {
                return slug;
            }
        }
    }

    /// Ask the host to let this machine into a shared tab and wait for its
    /// answer. The invite's fingerprint pins the host before the secret is sent.
    fn join_blocking(
        &self,
        hosts: Vec<String>,
        port: u16,
        secret: String,
        fp: String,
    ) -> Result<Value, String> {
        if fp.is_empty() || secret.is_empty() {
            return Err("That invite is incomplete. Ask for a new one.".into());
        }
        let generation = JOIN_GEN.fetch_add(1, Ordering::SeqCst) + 1;
        let mut last_err = "no addresses in the invite".to_string();
        let mut dialled = None;
        for h in &hosts {
            match dial_pinned(h, port, &fp, Some(CONNECT_TIMEOUT), IDENTITY_UNVERIFIED) {
                Ok(ws) => {
                    dialled = Some((ws, h.clone()));
                    break;
                }
                Err(e) => last_err = e,
            }
        }
        let (mut ws, host) = dialled.ok_or_else(|| {
            format!("Couldn't reach the machine that shared this tab: {last_err}")
        })?;
        ws.send(Message::text(
            json!({ "t": "shareJoin", "secret": secret, "name": local_name(),
                "platform": peer::platform_id() })
            .to_string(),
        ))
        .map_err(|e| e.to_string())?;
        let _ = ws.get_ref().tcp().set_read_timeout(Some(POLL));
        let deadline = Instant::now() + JOIN_WINDOW;
        loop {
            if JOIN_GEN.load(Ordering::SeqCst) != generation {
                let _ = ws.close(None);
                let _ = ws.flush();
                return Err("cancelled".into());
            }
            if Instant::now() >= deadline {
                return Err("The host didn't answer in time.".into());
            }
            let txt = match ws.read() {
                Ok(m) if m.is_close() => return Err("The host closed the connection.".into()),
                Ok(m) if m.is_text() => m.to_text().unwrap_or_default().to_string(),
                Ok(_) => continue,
                Err(WsError::Io(ref e))
                    if e.kind() == io::ErrorKind::WouldBlock
                        || e.kind() == io::ErrorKind::TimedOut =>
                {
                    continue
                }
                Err(_) => return Err("The host closed the connection.".into()),
            };
            let v: Value = serde_json::from_str(&txt).unwrap_or(Value::Null);
            let s = |k: &str| {
                v.get(k)
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string()
            };
            match s("t").as_str() {
                "shareJoinPending" => {
                    if let Some(app) = self.app() {
                        let _ = app.emit(JOIN_PENDING_EVENT, json!({ "hostName": s("hostName") }));
                    }
                }
                "shareJoined" => {
                    let _ = ws.close(None);
                    let _ = ws.flush();
                    if s("guestId").is_empty() || s("token").is_empty() {
                        return Err("The host sent an incomplete answer.".into());
                    }
                    let slug = self.fresh_slug();
                    let entry = JoinedShare {
                        slug: slug.clone(),
                        host,
                        port,
                        guest_id: s("guestId"),
                        token: s("token"),
                        tls_fp: fp,
                        host_name: Some(host_text(&s("hostName")))
                            .filter(|n| !n.is_empty())
                            .unwrap_or_else(|| "Another machine".into()),
                        joined_at: crate::status::now_millis(),
                        ..Default::default()
                    };
                    {
                        let mut cfg = self.inner.config.lock().unwrap();
                        cfg.joined.push(entry);
                        let snapshot = cfg.clone();
                        drop(cfg);
                        peer::save_config(&snapshot)?;
                    }
                    self.start_conn(&slug);
                    self.emit_joined_changed();
                    return Ok(json!({ "slug": slug }));
                }
                "error" => {
                    let e = s("error");
                    return Err(if e.is_empty() {
                        "The host didn't let you in.".into()
                    } else {
                        e
                    });
                }
                _ => {}
            }
        }
    }
}

#[tauri::command]
pub async fn peer_share_join(
    hub: State<'_, PeerClientHub>,
    hosts: Vec<String>,
    port: u16,
    secret: String,
    fp: String,
) -> Result<Value, String> {
    let hub = hub.inner().clone();
    tauri::async_runtime::spawn_blocking(move || hub.join_blocking(hosts, port, secret, fp))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn peer_share_join_cancel() {
    JOIN_GEN.fetch_add(1, Ordering::SeqCst);
}

#[tauri::command]
pub fn peer_joined_shares(hub: State<'_, PeerClientHub>) -> Value {
    hub.joined_rows()
}

/// Leave a shared tab, or put away one the host ended. The host is told first,
/// so it stops listing this machine among the tab's guests.
#[tauri::command]
pub async fn peer_share_leave(
    hub: State<'_, PeerClientHub>,
    slug: String,
) -> Result<Value, String> {
    if !hub.is_joined(&slug) {
        return Ok(hub.joined_rows());
    }
    if hub.send_to(&slug, json!({ "t": "forget" }).to_string()) {
        let _ = tauri::async_runtime::spawn_blocking(|| std::thread::sleep(FORGET_GRACE)).await;
    }
    hub.stop_conn(&slug, "left the shared tab");
    {
        let mut cfg = hub.inner.config.lock().unwrap();
        cfg.joined.retain(|j| j.slug != slug);
        let snapshot = cfg.clone();
        drop(cfg);
        peer::save_config(&snapshot)?;
    }
    hub.emit_joined_changed();
    Ok(hub.joined_rows())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_info_fills_in_the_stored_tab() {
        let mut j = JoinedShare::default();
        let changed = apply_info(
            &mut j,
            &json!({ "terminalId": "web-1", "label": "claude", "project": "web", "canType": true }),
        );
        assert!(changed);
        assert_eq!(
            (j.terminal_id.as_str(), j.label.as_str(), j.can_type),
            ("web-1", "claude", true)
        );
        assert!(!apply_info(&mut j, &json!({ "canType": true })));
        assert!(apply_info(&mut j, &json!({ "canType": false })));
        assert!(!j.can_type);
    }

    // A hostile sharer can claim any size; xterm.js allocates every cell of it.
    #[test]
    fn a_host_size_is_kept_within_a_real_screen() {
        let size = |v: Value| reported_size(&v);
        assert_eq!(
            size(json!({ "cols": 65535, "rows": 65535 })),
            Some((2000, 1000))
        );
        assert_eq!(size(json!({ "cols": 70000, "rows": 40 })), Some((2000, 40)));
        assert_eq!(
            size(json!({ "cols": 1250, "rows": 340 })),
            Some((1250, 340))
        );
        for bad in [
            json!({ "cols": 0, "rows": 24 }),
            json!({ "rows": 24 }),
            json!({ "cols": -80, "rows": 24 }),
            json!({ "cols": 80.5, "rows": 24 }),
            json!({ "cols": "80", "rows": 24 }),
        ] {
            assert_eq!(size(bad), None);
        }
    }

    // What the host sends is saved in peer.json, beside paired machines' tokens.
    #[test]
    fn host_text_is_kept_short_and_printable() {
        let mut j = JoinedShare::default();
        apply_info(
            &mut j,
            &json!({ "label": "L".repeat(100_000), "terminalId": "t".repeat(300) }),
        );
        assert_eq!(j.label.len(), MAX_TEXT);
        assert!(
            j.terminal_id.is_empty(),
            "an id can't be cut short and still work"
        );
        assert_eq!(host_text("claude\u{1b}[2J\n"), "claude[2J");
    }

    #[test]
    fn a_joined_tab_dials_pinned_with_its_guest_token() {
        let j = JoinedShare {
            slug: "0a1b2c3d".into(),
            host: "10.0.0.2".into(),
            port: 8766,
            guest_id: "g".into(),
            token: "t".into(),
            tls_fp: "ab".into(),
            ..Default::default()
        };
        let e = j.as_entry();
        assert_eq!(e.tls_fp.as_deref(), Some("ab"));
        assert_eq!((e.device_id.as_str(), e.token.as_str()), ("g", "t"));
        assert!(!e.ssh.is_set());
    }

    #[test]
    fn an_ended_tab_is_never_dialled_again() {
        let hub = PeerClientHub::default();
        {
            let mut cfg = hub.inner.config.lock().unwrap();
            cfg.joined.push(JoinedShare {
                slug: "0a1b2c3d".into(),
                tls_fp: "ab".into(),
                ..Default::default()
            });
            cfg.joined.push(JoinedShare {
                slug: "0a1b2c3e".into(),
                tls_fp: "ab".into(),
                ended: "stopped".into(),
                ..Default::default()
            });
        }
        assert!(hub.session_entry("0a1b2c3d").is_some());
        assert!(hub.session_entry("0a1b2c3e").is_none());
        assert!(hub.peer_entry("0a1b2c3d").is_none());
    }
}
