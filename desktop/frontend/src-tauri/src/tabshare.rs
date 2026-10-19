// Tab sharing, host side: one terminal here opened to another person's lpm.
//
// A paired machine is trusted with everything this one can do; a guest is not.
// It holds a token for one share, and a share reaches one terminal: its output,
// its size and, while the host allows it, its input. peer/guest.rs runs a guest's
// connection against the rules here.
//
// Shares live in memory only, so quitting lpm ends them and nobody keeps a way
// into a terminal past the session it was shared for.
use crate::peer::{self, PeerHub};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::mpsc::{self, Receiver, SyncSender};
use std::sync::{Mutex, MutexGuard, OnceLock};
use tauri::{AppHandle, Emitter, Manager};

pub(crate) const CHANGED_EVENT: &str = "peer-share-changed";
const JOIN_REQUEST_EVENT: &str = "peer-share-join-request";
const JOIN_RESOLVED_EVENT: &str = "peer-share-join-resolved";
pub(crate) const INVITE_PREFIX: &str = "lpm-share:";
// Asking to join costs the host a dialog, so a leaked invite can't queue many.
const MAX_WAITING: usize = 3;

struct Guest {
    id: String,
    name: String,
    token_sha256: String,
    joined_at: i64,
}

struct Share {
    id: String,
    terminal: String,
    project: String,
    label: String,
    can_type: bool,
    secret: String,
    guests: Vec<Guest>,
}

struct Waiting {
    id: String,
    share: String,
    name: String,
    decision: SyncSender<bool>,
}

struct Viewer {
    guest: String,
    tx: SyncSender<String>,
}

#[derive(Default)]
struct Registry {
    shares: Vec<Share>,
    waiting: Vec<Waiting>,
    viewers: HashMap<u64, Viewer>,
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct GuestSession {
    pub guest: String,
    pub share: String,
}

pub(crate) struct JoinTicket {
    pub id: String,
    pub share: String,
    pub decision: Receiver<bool>,
}

pub(crate) enum JoinRefusal {
    UnknownInvite,
    Busy,
}

impl JoinRefusal {
    pub(crate) fn message(&self) -> &'static str {
        match self {
            JoinRefusal::UnknownInvite => "This invite has ended. Ask for a new one.",
            JoinRefusal::Busy => "Others are already waiting to join this tab. Try again shortly.",
        }
    }
}

fn ended_frame(reason: &str) -> String {
    json!({ "t": "shareEnded", "reason": reason }).to_string()
}

impl Registry {
    fn share(&self, id: &str) -> Option<&Share> {
        self.shares.iter().find(|s| s.id == id)
    }

    fn share_mut(&mut self, id: &str) -> Option<&mut Share> {
        self.shares.iter_mut().find(|s| s.id == id)
    }

    fn start(&mut self, terminal: &str, project: &str, label: &str) -> String {
        if let Some(s) = self.shares.iter_mut().find(|s| s.terminal == terminal) {
            s.project = project.to_string();
            s.label = label.to_string();
            return s.id.clone();
        }
        let id = uuid::Uuid::new_v4().to_string();
        self.shares.push(Share {
            id: id.clone(),
            terminal: terminal.to_string(),
            project: project.to_string(),
            label: label.to_string(),
            can_type: false,
            secret: random_token(24),
            guests: Vec::new(),
        });
        id
    }

    fn by_secret(&self, secret: &str) -> Option<&Share> {
        if secret.is_empty() {
            return None;
        }
        self.shares
            .iter()
            .find(|s| peer::ct_eq(s.secret.as_bytes(), secret.as_bytes()))
    }

    fn begin_join(&mut self, secret: &str, name: &str) -> Result<JoinTicket, JoinRefusal> {
        let share = self
            .by_secret(secret)
            .map(|s| s.id.clone())
            .ok_or(JoinRefusal::UnknownInvite)?;
        if self.waiting.iter().filter(|w| w.share == share).count() >= MAX_WAITING {
            return Err(JoinRefusal::Busy);
        }
        let (tx, rx) = mpsc::sync_channel(1);
        let id = uuid::Uuid::new_v4().to_string();
        self.waiting.push(Waiting {
            id: id.clone(),
            share: share.clone(),
            name: clean_name(name),
            decision: tx,
        });
        Ok(JoinTicket {
            id,
            share,
            decision: rx,
        })
    }

    fn resolve(&mut self, id: &str, allow: bool) -> bool {
        let Some(pos) = self.waiting.iter().position(|w| w.id == id) else {
            return false;
        };
        let w = self.waiting.remove(pos);
        let _ = w.decision.try_send(allow);
        true
    }

    fn drop_waiting(&mut self, id: &str) -> bool {
        let before = self.waiting.len();
        self.waiting.retain(|w| w.id != id);
        self.waiting.len() != before
    }

    fn admit(&mut self, share: &str, name: &str) -> Option<(String, String)> {
        let s = self.share_mut(share)?;
        let token = random_token(32);
        let id = uuid::Uuid::new_v4().to_string();
        s.guests.push(Guest {
            id: id.clone(),
            name: clean_name(name),
            token_sha256: peer::sha256_hex(token.as_bytes()),
            joined_at: crate::status::now_millis(),
        });
        Some((id, token))
    }

    fn check(&self, guest: &str, token: &str) -> Option<GuestSession> {
        if guest.is_empty() || token.is_empty() {
            return None;
        }
        let want = peer::sha256_hex(token.as_bytes());
        self.shares.iter().find_map(|s| {
            s.guests
                .iter()
                .any(|g| g.id == guest && peer::ct_eq(g.token_sha256.as_bytes(), want.as_bytes()))
                .then(|| GuestSession {
                    guest: guest.to_string(),
                    share: s.id.clone(),
                })
        })
    }

    fn live(&self, session: &GuestSession) -> Option<&Share> {
        self.share(&session.share)
            .filter(|s| s.guests.iter().any(|g| g.id == session.guest))
    }

    fn may_watch(&self, session: &GuestSession, terminal: &str) -> bool {
        self.live(session).is_some_and(|s| s.terminal == terminal)
    }

    fn may_type(&self, session: &GuestSession, terminal: &str) -> bool {
        self.live(session)
            .is_some_and(|s| s.terminal == terminal && s.can_type)
    }

    fn tell_guests(&self, share: &str, frame: &str, only: Option<&str>) {
        let Some(s) = self.share(share) else { return };
        for v in self.viewers.values() {
            let theirs = s.guests.iter().any(|g| g.id == v.guest);
            if theirs && only.is_none_or(|g| g == v.guest) {
                let _ = v.tx.try_send(frame.to_string());
            }
        }
    }

    fn stop(&mut self, share: &str, reason: &str) -> bool {
        if self.share(share).is_none() {
            return false;
        }
        self.tell_guests(share, &ended_frame(reason), None);
        self.shares.retain(|s| s.id != share);
        for w in self.waiting.iter().filter(|w| w.share == share) {
            let _ = w.decision.try_send(false);
        }
        self.waiting.retain(|w| w.share != share);
        true
    }

    fn remove_guest(&mut self, share: &str, guest: &str, reason: &str) -> bool {
        self.tell_guests(share, &ended_frame(reason), Some(guest));
        let Some(s) = self.share_mut(share) else {
            return false;
        };
        let before = s.guests.len();
        s.guests.retain(|g| g.id != guest);
        s.guests.len() != before
    }

    fn set_can_type(&mut self, share: &str, can_type: bool) -> bool {
        let Some(s) = self.share_mut(share) else {
            return false;
        };
        s.can_type = can_type;
        let frame = info_frame(s);
        self.tell_guests(share, &frame, None);
        true
    }

    fn terminal_ended(&mut self, terminal: &str) -> bool {
        let ended: Vec<String> = self
            .shares
            .iter()
            .filter(|s| s.terminal == terminal)
            .map(|s| s.id.clone())
            .collect();
        for id in &ended {
            self.stop(id, "closed");
        }
        !ended.is_empty()
    }

    fn resized(&self, terminal: &str, cols: u16, rows: u16) {
        let frame = json!({ "t": "size", "id": terminal, "cols": cols, "rows": rows }).to_string();
        for s in self.shares.iter().filter(|s| s.terminal == terminal) {
            self.tell_guests(&s.id, &frame, None);
        }
    }

    fn listing(&self, invite: impl Fn(&str) -> String) -> Value {
        let rows: Vec<Value> = self
            .shares
            .iter()
            .map(|s| {
                let guests: Vec<Value> = s
                    .guests
                    .iter()
                    .map(|g| {
                        let connected = self.viewers.values().any(|v| v.guest == g.id);
                        json!({ "id": g.id, "name": g.name, "joinedAt": g.joined_at,
                            "connected": connected })
                    })
                    .collect();
                let waiting: Vec<Value> = self
                    .waiting
                    .iter()
                    .filter(|w| w.share == s.id)
                    .map(|w| json!({ "id": w.id, "name": w.name }))
                    .collect();
                json!({
                    "id": s.id,
                    "terminalId": s.terminal,
                    "project": s.project,
                    "label": s.label,
                    "canType": s.can_type,
                    "invite": invite(&s.secret),
                    "guests": guests,
                    "waiting": waiting,
                })
            })
            .collect();
        Value::Array(rows)
    }
}

fn info_frame(s: &Share) -> String {
    json!({ "t": "shareInfo", "canType": s.can_type, "label": s.label, "project": s.project })
        .to_string()
}

fn clean_name(name: &str) -> String {
    let name: String = name
        .trim()
        .chars()
        .filter(|c| !c.is_control())
        .take(64)
        .collect();
    if name.is_empty() {
        "Someone".to_string()
    } else {
        name
    }
}

fn random_token(bytes: usize) -> String {
    use base64::Engine as _;
    let mut b = vec![0u8; bytes];
    getrandom::fill(&mut b).expect("csprng");
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(b)
}

fn registry() -> MutexGuard<'static, Registry> {
    static REGISTRY: OnceLock<Mutex<Registry>> = OnceLock::new();
    REGISTRY
        .get_or_init(Mutex::default)
        .lock()
        .unwrap_or_else(|e| e.into_inner())
}

fn changed(app: &AppHandle) {
    let _ = app.emit(CHANGED_EVENT, ());
}

// --- the guest connection's view (peer/guest.rs) ------------------------------

pub(crate) fn check_guest(guest: &str, token: &str) -> Option<GuestSession> {
    registry().check(guest, token)
}

pub(crate) fn may_watch(session: &GuestSession, terminal: &str) -> bool {
    registry().may_watch(session, terminal)
}

pub(crate) fn may_type(session: &GuestSession, terminal: &str) -> bool {
    registry().may_type(session, terminal)
}

pub(crate) fn is_live(session: &GuestSession) -> bool {
    registry().live(session).is_some()
}

/// What the guest's `ready` says about the tab it was let into.
pub(crate) fn describe(session: &GuestSession) -> Option<Value> {
    let reg = registry();
    let s = reg.live(session)?;
    Some(
        json!({ "id": s.id, "terminalId": s.terminal, "project": s.project,
        "label": s.label, "canType": s.can_type }),
    )
}

pub(crate) fn begin_join(
    app: &AppHandle,
    secret: &str,
    name: &str,
) -> Result<JoinTicket, JoinRefusal> {
    let (ticket, label) = {
        let mut reg = registry();
        let ticket = reg.begin_join(secret, name)?;
        let label = reg
            .share(&ticket.share)
            .map(|s| s.label.clone())
            .unwrap_or_default();
        (ticket, label)
    };
    let name = clean_name(name);
    let _ = app.emit(
        JOIN_REQUEST_EVENT,
        json!({ "id": ticket.id, "shareId": ticket.share, "name": name, "label": label }),
    );
    changed(app);
    Ok(ticket)
}

/// The asker hung up or ran out of time before anyone answered.
pub(crate) fn abandon_join(app: &AppHandle, id: &str) {
    if registry().drop_waiting(id) {
        let _ = app.emit(JOIN_RESOLVED_EVENT, json!({ "id": id }));
        changed(app);
    }
}

pub(crate) fn admit(app: &AppHandle, share: &str, name: &str) -> Option<(String, String)> {
    let admitted = registry().admit(share, name);
    changed(app);
    admitted
}

pub(crate) fn connect_viewer(
    app: &AppHandle,
    conn: u64,
    session: &GuestSession,
    tx: SyncSender<String>,
) {
    registry().viewers.insert(
        conn,
        Viewer {
            guest: session.guest.clone(),
            tx,
        },
    );
    changed(app);
}

pub(crate) fn disconnect_viewer(app: &AppHandle, conn: u64) {
    if registry().viewers.remove(&conn).is_some() {
        changed(app);
    }
}

pub(crate) fn leave(app: &AppHandle, session: &GuestSession) {
    if registry().remove_guest(&session.share, &session.guest, "left") {
        changed(app);
    }
}

/// Called for every terminal that ends here, shared or not.
pub(crate) fn terminal_ended(app: &AppHandle, terminal: &str) {
    if registry().terminal_ended(terminal) {
        changed(app);
    }
}

/// Called for every resize here: a guest renders at this terminal's size.
pub(crate) fn resized(terminal: &str, cols: u16, rows: u16) {
    registry().resized(terminal, cols, rows);
}

// --- host commands ------------------------------------------------------------

/// Guests reach this machine through the Connections listener, so sharing turns
/// it on the way pairing does.
fn ensure_listening(app: &AppHandle) -> Result<(), String> {
    let hub = app.state::<PeerHub>();
    let cfg = hub.config_arc();
    let snapshot = {
        let mut cfg = cfg.lock().unwrap();
        let reachable = cfg.host.enabled && peer::bind_address(&cfg.host) != peer::LOOPBACK;
        if reachable {
            return Ok(());
        }
        cfg.host.enabled = true;
        cfg.host.bind_address = peer::ALL_INTERFACES.to_string();
        cfg.host.lan = true;
        cfg.clone()
    };
    peer::save_config(&snapshot)?;
    peer::apply(&hub, app);
    let _ = app.emit("peer-state-changed", ());
    Ok(())
}

/// `lpm-share:` + unpadded base64url of `{v:1, h:hosts, p:port, s:secret, f:fp}`.
/// Must stay byte-identical to `decodeShareInvite` in src/share/invite.ts.
fn encode_invite(hosts: &[String], port: u16, secret: &str, fp: &str) -> String {
    use base64::Engine as _;
    let payload = json!({ "v": 1, "h": hosts, "p": port, "s": secret, "f": fp });
    let encoded = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(payload.to_string());
    format!("{INVITE_PREFIX}{encoded}")
}

fn listing(app: &AppHandle) -> Value {
    let (hosts, port) = {
        let hub = app.state::<PeerHub>();
        let cfg = hub.config_arc();
        let cfg = cfg.lock().unwrap();
        (
            peer::invite_hosts(&cfg.host),
            peer::effective_port(cfg.host.port),
        )
    };
    let fp = crate::remotetls::fingerprint();
    registry().listing(|secret| encode_invite(&hosts, port, secret, &fp))
}

#[tauri::command]
pub async fn peer_shares(app: AppHandle) -> Value {
    listing(&app)
}

#[tauri::command]
pub async fn peer_share_start(
    app: AppHandle,
    terminal_id: String,
    project: String,
    label: String,
) -> Result<Value, String> {
    if crate::peerclient::parse_prefixed(&terminal_id).is_some() {
        return Err("Share this tab from the machine it runs on.".into());
    }
    if !crate::pty::session_exists(&app.state::<crate::pty::PtyState>(), &terminal_id) {
        return Err("This tab isn't running.".into());
    }
    if !crate::remote::pair_requests_supported() {
        return Err("Sharing needs someone at this machine to let guests in.".into());
    }
    ensure_listening(&app)?;
    registry().start(&terminal_id, &project, &label);
    changed(&app);
    Ok(listing(&app))
}

#[tauri::command]
pub async fn peer_share_stop(app: AppHandle, id: String) -> Value {
    if registry().stop(&id, "stopped") {
        changed(&app);
    }
    listing(&app)
}

#[tauri::command]
pub async fn peer_share_set_can_type(app: AppHandle, id: String, can_type: bool) -> Value {
    if registry().set_can_type(&id, can_type) {
        changed(&app);
    }
    listing(&app)
}

#[tauri::command]
pub async fn peer_share_remove_guest(app: AppHandle, id: String, guest: String) -> Value {
    if registry().remove_guest(&id, &guest, "removed") {
        changed(&app);
    }
    listing(&app)
}

#[tauri::command]
pub async fn peer_share_respond(app: AppHandle, request: String, allow: bool) -> Value {
    if registry().resolve(&request, allow) {
        let _ = app.emit(JOIN_RESOLVED_EVENT, json!({ "id": request }));
        changed(&app);
    }
    listing(&app)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn joined(reg: &mut Registry, share: &str) -> (GuestSession, String) {
        let (guest, token) = reg.admit(share, "Alex's Mac").unwrap();
        (
            GuestSession {
                guest,
                share: share.to_string(),
            },
            token,
        )
    }

    fn secret_of(reg: &Registry, share: &str) -> String {
        reg.share(share).unwrap().secret.clone()
    }

    #[test]
    fn a_guest_reaches_only_the_shared_terminal() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude");
        let (session, _) = joined(&mut reg, &share);
        assert!(reg.may_watch(&session, "web-1"));
        assert!(!reg.may_watch(&session, "web-2"));
    }

    #[test]
    fn typing_waits_for_the_host_to_allow_it() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude");
        let (session, _) = joined(&mut reg, &share);
        assert!(!reg.may_type(&session, "web-1"));
        reg.set_can_type(&share, true);
        assert!(reg.may_type(&session, "web-1"));
        assert!(!reg.may_type(&session, "web-2"));
        reg.set_can_type(&share, false);
        assert!(!reg.may_type(&session, "web-1"));
    }

    #[test]
    fn a_token_opens_only_its_own_guest() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude");
        let (a, token_a) = joined(&mut reg, &share);
        let (b, _) = joined(&mut reg, &share);
        assert_eq!(reg.check(&a.guest, &token_a), Some(a.clone()));
        assert_eq!(reg.check(&b.guest, &token_a), None);
        assert_eq!(reg.check(&a.guest, ""), None);
        assert_eq!(reg.check("", &token_a), None);
    }

    #[test]
    fn stopping_ends_every_guest_and_the_invite() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude");
        let secret = secret_of(&reg, &share);
        let (session, token) = joined(&mut reg, &share);
        let (tx, rx) = mpsc::sync_channel(4);
        reg.viewers.insert(
            1,
            Viewer {
                guest: session.guest.clone(),
                tx,
            },
        );
        assert!(reg.stop(&share, "stopped"));
        assert!(rx.try_recv().unwrap().contains("shareEnded"));
        assert!(!reg.may_watch(&session, "web-1"));
        assert_eq!(reg.check(&session.guest, &token), None);
        assert!(matches!(
            reg.begin_join(&secret, "Sam"),
            Err(JoinRefusal::UnknownInvite)
        ));
    }

    #[test]
    fn a_removed_guest_is_told_and_others_stay() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude");
        let (a, _) = joined(&mut reg, &share);
        let (b, _) = joined(&mut reg, &share);
        let (tx_a, rx_a) = mpsc::sync_channel(4);
        let (tx_b, rx_b) = mpsc::sync_channel(4);
        reg.viewers.insert(
            1,
            Viewer {
                guest: a.guest.clone(),
                tx: tx_a,
            },
        );
        reg.viewers.insert(
            2,
            Viewer {
                guest: b.guest.clone(),
                tx: tx_b,
            },
        );
        assert!(reg.remove_guest(&share, &a.guest, "removed"));
        assert!(rx_a.try_recv().unwrap().contains("removed"));
        assert!(rx_b.try_recv().is_err());
        assert!(!reg.may_watch(&a, "web-1"));
        assert!(reg.may_watch(&b, "web-1"));
    }

    #[test]
    fn a_closed_terminal_ends_its_share() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude");
        let (session, _) = joined(&mut reg, &share);
        assert!(!reg.terminal_ended("web-2"));
        assert!(reg.terminal_ended("web-1"));
        assert!(!reg.may_watch(&session, "web-1"));
    }

    #[test]
    fn an_unknown_invite_is_refused() {
        let mut reg = Registry::default();
        reg.start("web-1", "web", "claude");
        assert!(matches!(
            reg.begin_join("nope", "Sam"),
            Err(JoinRefusal::UnknownInvite)
        ));
        assert!(matches!(
            reg.begin_join("", "Sam"),
            Err(JoinRefusal::UnknownInvite)
        ));
    }

    #[test]
    fn only_a_few_can_wait_at_once() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude");
        let secret = secret_of(&reg, &share);
        let tickets: Vec<JoinTicket> = (0..MAX_WAITING)
            .map(|_| reg.begin_join(&secret, "Sam").ok().unwrap())
            .collect();
        assert!(matches!(
            reg.begin_join(&secret, "Sam"),
            Err(JoinRefusal::Busy)
        ));
        assert!(reg.resolve(&tickets[0].id, true));
        assert_eq!(tickets[0].decision.try_recv(), Ok(true));
        assert!(reg.begin_join(&secret, "Sam").is_ok());
    }

    #[test]
    fn stopping_turns_away_those_still_waiting() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude");
        let secret = secret_of(&reg, &share);
        let ticket = reg.begin_join(&secret, "Sam").ok().unwrap();
        reg.stop(&share, "stopped");
        assert_eq!(ticket.decision.try_recv(), Ok(false));
        assert!(reg.waiting.is_empty());
    }

    #[test]
    fn sharing_a_shared_tab_again_keeps_its_invite() {
        let mut reg = Registry::default();
        let first = reg.start("web-1", "web", "claude");
        let secret = secret_of(&reg, &first);
        let again = reg.start("web-1", "web", "renamed");
        assert_eq!(first, again);
        assert_eq!(secret_of(&reg, &again), secret);
        assert_eq!(reg.share(&again).unwrap().label, "renamed");
    }

    #[test]
    fn a_resize_reaches_only_that_terminals_guests() {
        let mut reg = Registry::default();
        let one = reg.start("web-1", "web", "a");
        let two = reg.start("web-2", "web", "b");
        let (a, _) = joined(&mut reg, &one);
        let (b, _) = joined(&mut reg, &two);
        let (tx_a, rx_a) = mpsc::sync_channel(4);
        let (tx_b, rx_b) = mpsc::sync_channel(4);
        reg.viewers.insert(
            1,
            Viewer {
                guest: a.guest,
                tx: tx_a,
            },
        );
        reg.viewers.insert(
            2,
            Viewer {
                guest: b.guest,
                tx: tx_b,
            },
        );
        reg.resized("web-1", 120, 40);
        let frame: Value = serde_json::from_str(&rx_a.try_recv().unwrap()).unwrap();
        assert_eq!(frame["cols"], 120);
        assert_eq!(frame["rows"], 40);
        assert!(rx_b.try_recv().is_err());
    }

    #[test]
    fn names_are_kept_short_and_printable() {
        assert_eq!(clean_name("  "), "Someone");
        assert_eq!(clean_name("Sam\u{1b}[2J"), "Sam[2J");
        assert_eq!(clean_name(&"x".repeat(100)).len(), 64);
    }

    #[test]
    fn the_invite_carries_what_a_guest_dials() {
        use base64::Engine as _;
        let invite = encode_invite(&["10.0.0.2".into()], 8766, "sekret", "ab12");
        let body = invite.strip_prefix(INVITE_PREFIX).unwrap();
        let json = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .decode(body)
            .unwrap();
        let v: Value = serde_json::from_slice(&json).unwrap();
        assert_eq!(
            v,
            json!({ "v": 1, "h": ["10.0.0.2"], "p": 8766, "s": "sekret", "f": "ab12" })
        );
    }
}
