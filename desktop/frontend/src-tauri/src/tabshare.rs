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
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};

mod machines;
mod people;
pub(crate) use machines::{answer_machine, machine_left, KNOCK_EVENT, TAB_SHARE_FEATURE};
pub(crate) use people::{ask_type, typed, TYPED_EVENT};
pub(crate) use people::{
    peer_share_decline_ask, peer_share_qr, peer_share_set_guest_can_type, peer_share_take_keyboards,
};

pub(crate) const CHANGED_EVENT: &str = "peer-share-changed";
pub(crate) const INVITE_PREFIX: &str = "lpm-share:";
// Asking to join costs the host a dialog, so a leaked invite can't queue many.
const MAX_WAITING: usize = 3;
// What the invite shows before anyone is let in is kept short, so the link is.
const MAX_SHOWN: usize = 64;

/// Where a guest joined from.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum Via {
    Lpm,
    Browser,
}

impl Via {
    fn as_str(self) -> &'static str {
        match self {
            Via::Lpm => "lpm",
            Via::Browser => "browser",
        }
    }
}

/// What the host answered someone asking to join.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum Answer {
    Deny,
    LetIn { can_type: bool },
}

struct Guest {
    id: String,
    name: String,
    token_sha256: String,
    joined_at: i64,
    via: Via,
    can_type: bool,
    // Asked to type, and the host hasn't answered yet.
    asked: bool,
    // When the host last said not now, so a guest can't ask on every key.
    declined_at: Option<Instant>,
    // When the host's list last heard this guest type (people.rs).
    typed_at: i64,
}

struct Share {
    id: String,
    terminal: String,
    project: String,
    label: String,
    // What someone let in may do until the host changes it for them.
    can_type: bool,
    secret: String,
    guests: Vec<Guest>,
    // Where the terminal's output stood when sharing began: guests get nothing
    // from before it.
    floor: u64,
    // Shared from a paired machine, which answers for it here (machines.rs).
    by_machine: bool,
}

struct Waiting {
    id: String,
    share: String,
    name: String,
    // Four emoji the guest sees too.
    code: String,
    via: Via,
    decision: SyncSender<Answer>,
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
    pub label: String,
    pub decision: Receiver<Answer>,
}

pub(crate) enum JoinRefusal {
    UnknownInvite,
    Busy,
    NobodyToAnswer,
}

impl JoinRefusal {
    pub(crate) fn message(&self) -> &'static str {
        match self {
            JoinRefusal::UnknownInvite => "This invite has ended. Ask for a new one.",
            JoinRefusal::Busy => "Others are already waiting to join this tab. Try again shortly.",
            JoinRefusal::NobodyToAnswer => {
                "No one is there to let you in right now. Try again later."
            }
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

    /// Share `terminal`, or update the share it already has. Shared here too, it
    /// is answered for here from then on.
    fn start(
        &mut self,
        terminal: &str,
        project: &str,
        label: &str,
        floor: u64,
        by_machine: bool,
    ) -> String {
        if let Some(s) = self.shares.iter_mut().find(|s| s.terminal == terminal) {
            s.project = project.to_string();
            s.label = label.to_string();
            s.by_machine &= by_machine;
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
            floor,
            by_machine,
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

    fn begin_join(
        &mut self,
        secret: &str,
        name: &str,
        code: &str,
        via: Via,
    ) -> Result<JoinTicket, JoinRefusal> {
        let (share, label) = self
            .by_secret(secret)
            .map(|s| (s.id.clone(), s.label.clone()))
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
            code: code.to_string(),
            via,
            decision: tx,
        });
        Ok(JoinTicket {
            id,
            share,
            label,
            decision: rx,
        })
    }

    /// Let in or turn away someone asking to join. Let in, they may type as
    /// `can_type` says, or else as the share lets new people.
    fn respond(&mut self, id: &str, allow: bool, can_type: Option<bool>) -> bool {
        let Some(pos) = self.waiting.iter().position(|w| w.id == id) else {
            return false;
        };
        let w = self.waiting.remove(pos);
        let answer = if allow {
            let default = self.share(&w.share).is_some_and(|s| s.can_type);
            Answer::LetIn {
                can_type: can_type.unwrap_or(default),
            }
        } else {
            Answer::Deny
        };
        let _ = w.decision.try_send(answer);
        true
    }

    fn drop_waiting(&mut self, id: &str) -> bool {
        let before = self.waiting.len();
        self.waiting.retain(|w| w.id != id);
        self.waiting.len() != before
    }

    fn admit(
        &mut self,
        share: &str,
        name: &str,
        via: Via,
        can_type: bool,
    ) -> Option<(String, String)> {
        let s = self.share_mut(share)?;
        let token = random_token(32);
        let id = uuid::Uuid::new_v4().to_string();
        s.guests.push(Guest {
            id: id.clone(),
            name: clean_name(name),
            token_sha256: peer::sha256_hex(token.as_bytes()),
            joined_at: crate::status::now_millis(),
            via,
            can_type,
            asked: false,
            declined_at: None,
            typed_at: 0,
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

    fn live_guest(&self, session: &GuestSession) -> Option<(&Share, &Guest)> {
        let s = self.share(&session.share)?;
        Some((s, s.guests.iter().find(|g| g.id == session.guest)?))
    }

    fn live(&self, session: &GuestSession) -> Option<&Share> {
        self.live_guest(session).map(|(s, _)| s)
    }

    fn may_watch(&self, session: &GuestSession, terminal: &str) -> bool {
        self.live(session).is_some_and(|s| s.terminal == terminal)
    }

    fn may_type(&self, session: &GuestSession, terminal: &str) -> bool {
        self.live_guest(session)
            .is_some_and(|(s, g)| s.terminal == terminal && g.can_type)
    }

    /// Send each connected guest of `share` (or only `only`) its `frame`.
    fn tell_guests(
        &self,
        share: &str,
        only: Option<&str>,
        frame: impl Fn(&Share, &Guest) -> String,
    ) {
        let Some(s) = self.share(share) else { return };
        for v in self.viewers.values() {
            if only.is_some_and(|g| g != v.guest) {
                continue;
            }
            if let Some(g) = s.guests.iter().find(|g| g.id == v.guest) {
                let _ = v.tx.try_send(frame(s, g));
            }
        }
    }

    fn stop(&mut self, share: &str, reason: &str) -> bool {
        if self.share(share).is_none() {
            return false;
        }
        self.tell_guests(share, None, |_, _| ended_frame(reason));
        self.shares.retain(|s| s.id != share);
        for w in self.waiting.iter().filter(|w| w.share == share) {
            let _ = w.decision.try_send(Answer::Deny);
        }
        self.waiting.retain(|w| w.share != share);
        true
    }

    fn remove_guest(&mut self, share: &str, guest: &str, reason: &str) -> bool {
        self.tell_guests(share, Some(guest), |_, _| ended_frame(reason));
        let Some(s) = self.share_mut(share) else {
            return false;
        };
        let before = s.guests.len();
        s.guests.retain(|g| g.id != guest);
        let removed = s.guests.len() != before;
        if removed {
            self.tell_info(share, None);
        }
        removed
    }

    /// What people let in from now on may do; those already in keep theirs.
    fn set_can_type(&mut self, share: &str, can_type: bool) -> bool {
        let Some(s) = self.share_mut(share) else {
            return false;
        };
        s.can_type = can_type;
        true
    }

    /// Stop every share `ends` picks, telling its guests `reason`; true when
    /// there was one.
    fn stop_where(&mut self, ends: impl Fn(&Share) -> bool, reason: &str) -> bool {
        let ended: Vec<String> = self
            .shares
            .iter()
            .filter(|s| ends(s))
            .map(|s| s.id.clone())
            .collect();
        for id in &ended {
            self.stop(id, reason);
        }
        !ended.is_empty()
    }

    fn terminal_ended(&mut self, terminal: &str) -> bool {
        self.stop_where(|s| s.terminal == terminal, "closed")
    }

    fn resized(&self, terminal: &str, cols: u16, rows: u16) {
        let frame = json!({ "t": "size", "id": terminal, "cols": cols, "rows": rows }).to_string();
        for s in self.shares.iter().filter(|s| s.terminal == terminal) {
            self.tell_guests(&s.id, None, |_, _| frame.clone());
        }
    }

    fn listing(&self, invite: impl Fn(&Share) -> String) -> Value {
        let rows: Vec<Value> = self
            .shares
            .iter()
            .map(|s| {
                let guests: Vec<Value> = s
                    .guests
                    .iter()
                    .map(|g| {
                        json!({ "id": g.id, "name": g.name, "joinedAt": g.joined_at,
                            "connected": self.connected(&g.id), "canType": g.can_type,
                            "via": g.via.as_str(), "asked": g.asked, "typedAt": g.typed_at })
                    })
                    .collect();
                let waiting: Vec<Value> = self
                    .waiting
                    .iter()
                    .filter(|w| w.share == s.id)
                    .map(|w| {
                        json!({ "id": w.id, "name": w.name, "code": w.code,
                            "via": w.via.as_str() })
                    })
                    .collect();
                json!({
                    "id": s.id,
                    "terminalId": s.terminal,
                    "project": s.project,
                    "label": s.label,
                    "canType": s.can_type,
                    "invite": invite(s),
                    "browser": crate::sharerelay::room(&s.id).is_some(),
                    "guests": guests,
                    "waiting": waiting,
                })
            })
            .collect();
        Value::Array(rows)
    }
}

/// `s` without control characters, cut to `max` characters: text that came from
/// someone else, made safe to show and to keep.
pub(crate) fn printable(s: &str, max: usize) -> String {
    s.chars().filter(|c| !c.is_control()).take(max).collect()
}

fn clean_name(name: &str) -> String {
    let name = printable(name.trim(), 64);
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

/// The first output offset the guest may be handed.
pub(crate) fn floor(session: &GuestSession) -> u64 {
    registry().live(session).map_or(u64::MAX, |s| s.floor)
}

pub(crate) fn is_shared(share: &str) -> bool {
    registry().share(share).is_some()
}

/// What the guest's `ready` says about the tab it was let into.
pub(crate) fn describe(session: &GuestSession) -> Option<Value> {
    let reg = registry();
    let (s, g) = reg.live_guest(session)?;
    let mut share = reg.info(s, g);
    share["id"] = json!(s.id);
    share["terminalId"] = json!(s.terminal);
    Some(share)
}

pub(crate) fn begin_join(
    app: &AppHandle,
    secret: &str,
    name: &str,
    code: &str,
    via: Via,
) -> Result<JoinTicket, JoinRefusal> {
    let answerable = machines::someone_answers(app);
    let (ticket, by_machine) = {
        let mut reg = registry();
        if !answerable && reg.by_secret(secret).is_some() {
            return Err(JoinRefusal::NobodyToAnswer);
        }
        let ticket = reg.begin_join(secret, name, code, via)?;
        let by_machine = reg.share(&ticket.share).is_some_and(|s| s.by_machine);
        (ticket, by_machine)
    };
    changed(app);
    if by_machine {
        let _ = app.emit(KNOCK_EVENT, ());
    }
    Ok(ticket)
}

/// The asker hung up or ran out of time before anyone answered.
pub(crate) fn abandon_join(app: &AppHandle, id: &str) {
    if registry().drop_waiting(id) {
        changed(app);
    }
}

pub(crate) fn admit(
    app: &AppHandle,
    share: &str,
    name: &str,
    via: Via,
    can_type: bool,
) -> Option<(String, String)> {
    let admitted = registry().admit(share, name, via, can_type);
    changed(app);
    admitted
}

pub(crate) fn connect_viewer(
    app: &AppHandle,
    conn: u64,
    session: &GuestSession,
    tx: SyncSender<String>,
) {
    {
        let mut reg = registry();
        reg.viewers.insert(
            conn,
            Viewer {
                guest: session.guest.clone(),
                tx,
            },
        );
        reg.tell_info(&session.share, None);
    }
    changed(app);
}

pub(crate) fn disconnect_viewer(app: &AppHandle, conn: u64) {
    let mut reg = registry();
    let Some(viewer) = reg.viewers.remove(&conn) else {
        return;
    };
    let share = reg
        .shares
        .iter()
        .find(|s| s.guests.iter().any(|g| g.id == viewer.guest))
        .map(|s| s.id.clone());
    if let Some(share) = share {
        reg.tell_info(&share, None);
    }
    drop(reg);
    changed(app);
}

pub(crate) fn leave(app: &AppHandle, session: &GuestSession) {
    if registry().remove_guest(&session.share, &session.guest, "left") {
        changed(app);
    }
}

/// Called for every terminal that ends here, shared or not.
pub(crate) fn terminal_ended(app: &AppHandle, terminal: &str) {
    if registry().terminal_ended(terminal) {
        sync_listener(app);
        changed(app);
    }
}

/// Called for every resize here: a guest renders at this terminal's size.
pub(crate) fn resized(terminal: &str, cols: u16, rows: u16) {
    registry().resized(terminal, cols, rows);
}

// --- host commands ------------------------------------------------------------

/// Guests reach this machine through the Connections listener, which stays up
/// for them while any tab is shared, whatever Allow control says.
fn sync_listener(app: &AppHandle) {
    static SYNC: Mutex<()> = Mutex::new(());
    let _held = SYNC.lock().unwrap_or_else(|e| e.into_inner());
    let sharing = !registry().shares.is_empty();
    peer::set_sharing(app, sharing);
}

/// What an invite shows before anyone is let in: whose machine, which tab.
struct Shown<'a> {
    host: &'a str,
    label: &'a str,
    project: &'a str,
}

/// `lpm-share:` + unpadded base64url of `{v:1, h:hosts, p:port, s:secret, f:fp}`,
/// plus `n:host name, l:label, j:project` for the page to greet with, and
/// `u:relay, r:room, k:key` while browsers can join through the relay.
/// Must stay byte-identical to `decodeShareInvite` in src/share/invite.ts and the
/// browser page in relay/public/invite.js.
fn encode_invite(
    hosts: &[String],
    port: u16,
    secret: &str,
    fp: &str,
    shown: &Shown,
    relay: Option<&crate::sharerelay::Room>,
) -> String {
    use base64::Engine as _;
    let mut payload = json!({ "v": 1, "h": hosts, "p": port, "s": secret, "f": fp });
    for (key, text) in [("n", shown.host), ("l", shown.label), ("j", shown.project)] {
        let text = printable(text, MAX_SHOWN);
        if !text.is_empty() {
            payload[key] = json!(text);
        }
    }
    if let Some(room) = relay {
        payload["u"] = json!(room.relay);
        payload["r"] = json!(room.room);
        payload["k"] = json!(room.key);
    }
    let encoded = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(payload.to_string());
    format!("{INVITE_PREFIX}{encoded}")
}

fn listing(app: &AppHandle) -> Value {
    if registry().shares.is_empty() {
        return Value::Array(Vec::new());
    }
    let (hosts, port) = {
        let hub = app.state::<PeerHub>();
        let cfg = hub.config_arc();
        let cfg = cfg.lock().unwrap();
        (
            peer::share_hosts(&cfg.host),
            peer::effective_port(cfg.host.port),
        )
    };
    let fp = crate::remotetls::fingerprint();
    let host = peer::machine_name();
    registry().listing(|s| {
        let relay = crate::sharerelay::room(&s.id);
        let shown = Shown {
            host: &host,
            label: &s.label,
            project: &s.project,
        };
        encode_invite(&hosts, port, &s.secret, &fp, &shown, relay.as_ref())
    })
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
    start(&app, &terminal_id, &project, &label, false)
}

/// Share a terminal here. A paired machine may share one with nobody at this
/// one, since it lets the guests in itself.
fn start(
    app: &AppHandle,
    terminal_id: &str,
    project: &str,
    label: &str,
    by_machine: bool,
) -> Result<Value, String> {
    if crate::peerclient::parse_prefixed(terminal_id).is_some() {
        return Err("Share this tab from the machine it runs on.".into());
    }
    if !crate::pty::session_exists(&app.state::<crate::pty::PtyState>(), terminal_id) {
        return Err("This tab isn't running.".into());
    }
    if !machines::someone_answers(app) {
        return Err("Sharing needs someone at this machine to let guests in.".into());
    }
    let floor = app.state::<PeerHub>().ring_offset(terminal_id);
    let id = registry().start(terminal_id, project, label, floor, by_machine);
    sync_listener(app);
    crate::sharerelay::open(app, &id);
    changed(app);
    Ok(listing(app))
}

#[tauri::command]
pub async fn peer_share_stop(app: AppHandle, id: String) -> Value {
    stop(&app, &id)
}

fn stop(app: &AppHandle, id: &str) -> Value {
    if registry().stop(id, "stopped") {
        sync_listener(app);
        changed(app);
    }
    listing(app)
}

/// Change the shares here with `change`, and answer with how they stand.
fn edit(app: &AppHandle, change: impl FnOnce(&mut Registry) -> bool) -> Value {
    if change(&mut registry()) {
        changed(app);
    }
    listing(app)
}

#[tauri::command]
pub async fn peer_share_set_can_type(app: AppHandle, id: String, can_type: bool) -> Value {
    edit(&app, |reg| reg.set_can_type(&id, can_type))
}

#[tauri::command]
pub async fn peer_share_remove_guest(app: AppHandle, id: String, guest: String) -> Value {
    edit(&app, |reg| reg.remove_guest(&id, &guest, "removed"))
}

/// Answer someone asking to join. `can_type` lets them in able to type, or not,
/// whatever new people may do; without it they get that.
#[tauri::command]
pub async fn peer_share_respond(
    app: AppHandle,
    request: String,
    allow: bool,
    can_type: Option<bool>,
) -> Value {
    edit(&app, |reg| reg.respond(&request, allow, can_type))
}

#[cfg(test)]
mod tests {
    use super::*;

    const CODE: &str = "🐶 🐱 🦁 🐎";

    fn joined(reg: &mut Registry, share: &str) -> (GuestSession, String) {
        let (guest, token) = reg.admit(share, "Alex's Mac", Via::Lpm, false).unwrap();
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
        let share = reg.start("web-1", "web", "claude", 0, false);
        let (session, _) = joined(&mut reg, &share);
        assert!(reg.may_watch(&session, "web-1"));
        assert!(!reg.may_watch(&session, "web-2"));
    }

    #[test]
    fn typing_waits_for_the_host_to_allow_it() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude", 0, false);
        let (session, _) = joined(&mut reg, &share);
        assert!(!reg.may_type(&session, "web-1"));
        reg.set_guest_can_type(&share, &session.guest, true);
        assert!(reg.may_type(&session, "web-1"));
        assert!(!reg.may_type(&session, "web-2"));
        reg.set_guest_can_type(&share, &session.guest, false);
        assert!(!reg.may_type(&session, "web-1"));
    }

    #[test]
    fn the_share_setting_is_only_for_people_let_in_later() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude", 0, false);
        let (before, _) = joined(&mut reg, &share);
        reg.set_can_type(&share, true);
        assert!(!reg.may_type(&before, "web-1"));
        let (guest, _) = reg.admit(&share, "Ana", Via::Browser, true).unwrap();
        let after = GuestSession {
            guest,
            share: share.clone(),
        };
        assert!(reg.may_type(&after, "web-1"));
    }

    #[test]
    fn a_token_opens_only_its_own_guest() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude", 0, false);
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
        let share = reg.start("web-1", "web", "claude", 0, false);
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
            reg.begin_join(&secret, "Sam", CODE, Via::Lpm),
            Err(JoinRefusal::UnknownInvite)
        ));
    }

    #[test]
    fn a_removed_guest_is_told_and_others_stay() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude", 0, false);
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
        let seen_by_b: Value = serde_json::from_str(&rx_b.try_recv().unwrap()).unwrap();
        assert_eq!(seen_by_b["t"], "shareInfo");
        assert_eq!(seen_by_b["others"], json!([]));
        assert!(!reg.may_watch(&a, "web-1"));
        assert!(reg.may_watch(&b, "web-1"));
    }

    #[test]
    fn a_closed_terminal_ends_its_share() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude", 0, false);
        let (session, _) = joined(&mut reg, &share);
        assert!(!reg.terminal_ended("web-2"));
        assert!(reg.terminal_ended("web-1"));
        assert!(!reg.may_watch(&session, "web-1"));
    }

    #[test]
    fn an_unknown_invite_is_refused() {
        let mut reg = Registry::default();
        reg.start("web-1", "web", "claude", 0, false);
        assert!(matches!(
            reg.begin_join("nope", "Sam", CODE, Via::Lpm),
            Err(JoinRefusal::UnknownInvite)
        ));
        assert!(matches!(
            reg.begin_join("", "Sam", CODE, Via::Lpm),
            Err(JoinRefusal::UnknownInvite)
        ));
    }

    #[test]
    fn only_a_few_can_wait_at_once() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude", 0, false);
        let secret = secret_of(&reg, &share);
        let tickets: Vec<JoinTicket> = (0..MAX_WAITING)
            .map(|_| reg.begin_join(&secret, "Sam", CODE, Via::Lpm).ok().unwrap())
            .collect();
        assert!(matches!(
            reg.begin_join(&secret, "Sam", CODE, Via::Lpm),
            Err(JoinRefusal::Busy)
        ));
        assert!(reg.respond(&tickets[0].id, true, Some(true)));
        assert_eq!(
            tickets[0].decision.try_recv(),
            Ok(Answer::LetIn { can_type: true })
        );
        assert!(reg.begin_join(&secret, "Sam", CODE, Via::Lpm).is_ok());
    }

    #[test]
    fn stopping_turns_away_those_still_waiting() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude", 0, false);
        let secret = secret_of(&reg, &share);
        let ticket = reg.begin_join(&secret, "Sam", CODE, Via::Lpm).ok().unwrap();
        reg.stop(&share, "stopped");
        assert_eq!(ticket.decision.try_recv(), Ok(Answer::Deny));
        assert!(reg.waiting.is_empty());
    }

    #[test]
    fn sharing_a_shared_tab_again_keeps_its_invite() {
        let mut reg = Registry::default();
        let first = reg.start("web-1", "web", "claude", 0, false);
        let secret = secret_of(&reg, &first);
        let again = reg.start("web-1", "web", "renamed", 0, false);
        assert_eq!(first, again);
        assert_eq!(secret_of(&reg, &again), secret);
        assert_eq!(reg.share(&again).unwrap().label, "renamed");
    }

    #[test]
    fn a_resize_reaches_only_that_terminals_guests() {
        let mut reg = Registry::default();
        let one = reg.start("web-1", "web", "a", 0, false);
        let two = reg.start("web-2", "web", "b", 0, false);
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
        let decode = |invite: String| -> Value {
            let body = invite.strip_prefix(INVITE_PREFIX).unwrap().to_string();
            let json = base64::engine::general_purpose::URL_SAFE_NO_PAD
                .decode(body)
                .unwrap();
            serde_json::from_slice(&json).unwrap()
        };
        let hosts = ["10.0.0.2".to_string()];
        let unnamed = Shown {
            host: "",
            label: "",
            project: "",
        };
        assert_eq!(
            decode(encode_invite(
                &hosts, 8766, "sekret", "ab12", &unnamed, None
            )),
            json!({ "v": 1, "h": ["10.0.0.2"], "p": 8766, "s": "sekret", "f": "ab12" })
        );
        let named = Shown {
            host: "Maya's MacBook Pro",
            label: "claude\u{1b}[2J",
            project: "web",
        };
        assert_eq!(
            decode(encode_invite(&hosts, 8766, "sekret", "ab12", &named, None)),
            json!({ "v": 1, "h": ["10.0.0.2"], "p": 8766, "s": "sekret", "f": "ab12",
                "n": "Maya's MacBook Pro", "l": "claude[2J", "j": "web" })
        );
        let room = crate::sharerelay::Room {
            relay: "https://lpm-share-relay.lpm-share-relay.workers.dev".into(),
            room: "room1".into(),
            key: "key1".into(),
        };
        assert_eq!(
            decode(encode_invite(
                &hosts,
                8766,
                "sekret",
                "ab12",
                &unnamed,
                Some(&room)
            )),
            json!({ "v": 1, "h": ["10.0.0.2"], "p": 8766, "s": "sekret", "f": "ab12",
                "u": "https://lpm-share-relay.lpm-share-relay.workers.dev", "r": "room1", "k": "key1" })
        );
    }
}
