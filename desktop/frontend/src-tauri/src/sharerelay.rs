// Browser guests of a shared tab, host side. A browser can't reach this machine
// the way lpm does, so while a tab is shared this keeps one outbound connection to
// the relay (relay/ in this repo), in a room only the share's invite names. The
// relay announces each browser that connects there and forwards Noise messages it
// can't read (sharenoise.rs); each guest then runs under exactly the rules a guest
// on the network gets (peer/guest.rs).
use crate::peer::{drain, GuestLink, Incoming};
use crate::sharenoise;
use crate::sharerelaydial::{dial, RelayWs};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, SyncSender};
use std::sync::{Mutex, MutexGuard, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Url};
use tungstenite::{Error as WsError, Message};
use zeroize::Zeroizing;

const DEFAULT_RELAY: &str = "https://lpm-share-relay.lpm-share-relay.workers.dev";
// "off" keeps shares to the network; a URL points at another relay, such as the
// one `npm run dev` in relay/ serves at http://localhost:8787.
const RELAY_ENV: &str = "LPM_SHARE_RELAY";
const POLL: Duration = Duration::from_millis(20);
const CHECK_EVERY: Duration = Duration::from_secs(1);
const KEEPALIVE: Duration = Duration::from_secs(30);
const HANDSHAKE_WAIT: Duration = Duration::from_secs(20);
const FIRST_BACKOFF: Duration = Duration::from_secs(1);
const MAX_BACKOFF: Duration = Duration::from_secs(30);
const GUEST_QUEUE: usize = 256;
// Every guest's frames wait behind this many on the one link.
const OUT_QUEUE: usize = 64;
// As many as relay/src/room.ts lets into a room.
const MAX_GUESTS: usize = 16;
const CONN_LEN: usize = 8;

type ConnId = [u8; CONN_LEN];

/// What a share's invite names so a browser can reach it.
#[derive(Clone)]
pub(crate) struct Room {
    pub relay: String,
    pub room: String,
    pub key: String,
}

fn rooms() -> MutexGuard<'static, HashMap<String, Room>> {
    static ROOMS: OnceLock<Mutex<HashMap<String, Room>>> = OnceLock::new();
    ROOMS
        .get_or_init(Mutex::default)
        .lock()
        .unwrap_or_else(|e| e.into_inner())
}

pub(crate) fn room(share: &str) -> Option<Room> {
    rooms().get(share).cloned()
}

fn relay_base() -> Option<Url> {
    let configured = std::env::var(RELAY_ENV).unwrap_or_default();
    let raw = match configured.trim() {
        "" => DEFAULT_RELAY,
        "off" => return None,
        other => other,
    };
    let url = Url::parse(raw).ok()?;
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    match url.scheme() {
        "https" => Some(url),
        "http" if local => Some(url),
        _ => None,
    }
}

fn random_token(bytes: usize) -> String {
    use base64::Engine as _;
    let mut b = vec![0u8; bytes];
    getrandom::fill(&mut b).expect("csprng");
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(b)
}

/// The room `token` claims. The relay checks one against the other, so nobody
/// else holding the invite can take the room, even once the relay forgot it.
/// Must match roomOf in relay/src/claim.ts.
fn room_of(token: &str) -> String {
    use base64::Engine as _;
    use sha2::{Digest, Sha256};
    let digest = Sha256::digest(token.as_bytes());
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&digest[..16])
}

/// Start taking browser guests for `share`, until it ends.
pub(crate) fn open(app: &AppHandle, share: &str) {
    use base64::Engine as _;
    let Some(relay) = relay_base() else {
        return;
    };
    let keypair = sharenoise::keypair();
    let private = Zeroizing::new(keypair.private);
    let token = random_token(32);
    let room_id = room_of(&token);
    {
        let mut rooms = rooms();
        if rooms.contains_key(share) {
            return;
        }
        rooms.insert(
            share.to_string(),
            Room {
                relay: relay.origin().ascii_serialization(),
                room: room_id.clone(),
                key: base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&keypair.public),
            },
        );
    }
    let app = app.clone();
    let share = share.to_string();
    std::thread::spawn(move || {
        run(&app, &share, &relay, &room_id, &token, &private);
        rooms().remove(&share);
    });
}

fn run(app: &AppHandle, share: &str, relay: &Url, room: &str, token: &str, private: &[u8]) {
    let mut backoff = FIRST_BACKOFF;
    while crate::tabshare::is_shared(share) {
        match dial(relay, room, token) {
            Ok(ws) => {
                backoff = FIRST_BACKOFF;
                if !serve_room(app, share, room, private, ws) {
                    return;
                }
            }
            Err(e) if backoff == FIRST_BACKOFF => {
                eprintln!("warning: couldn't reach the share relay: {e}");
            }
            Err(_) => {}
        }
        let until = Instant::now() + backoff;
        while Instant::now() < until {
            if !crate::tabshare::is_shared(share) {
                return;
            }
            std::thread::sleep(Duration::from_millis(250));
        }
        backoff = (backoff * 2).min(MAX_BACKOFF);
    }
}

enum Out {
    Data(ConnId, Vec<u8>),
    Close(ConnId),
}

fn waiting(e: &WsError) -> bool {
    matches!(e, WsError::Io(e) if e.kind() == io::ErrorKind::WouldBlock || e.kind() == io::ErrorKind::TimedOut)
}

fn parse_conn(hex_id: &str) -> Option<ConnId> {
    hex::decode(hex_id).ok()?.try_into().ok()
}

fn close_frame(conn: ConnId) -> Message {
    Message::text(json!({ "t": "close", "c": hex::encode(conn) }).to_string())
}

/// One connection to the relay: true when it dropped, false once the share ended.
fn serve_room(app: &AppHandle, share: &str, room: &str, private: &[u8], mut ws: RelayWs) -> bool {
    let (out_tx, out_rx) = mpsc::sync_channel::<Out>(OUT_QUEUE);
    let mut guests: HashMap<ConnId, SyncSender<Vec<u8>>> = HashMap::new();
    // Guests this thread let go of, told to the relay ahead of everything queued:
    // it can't wait on its own full queue.
    let mut closing: Vec<ConnId> = Vec::new();
    let _ = ws.get_ref().tcp().set_read_timeout(Some(POLL));
    let mut checked = Instant::now();
    let mut pinged = Instant::now();
    loop {
        if checked.elapsed() >= CHECK_EVERY {
            checked = Instant::now();
            if !crate::tabshare::is_shared(share) {
                let _ = ws.send(Message::text(json!({ "t": "end" }).to_string()));
                let _ = ws.close(None);
                let _ = ws.flush();
                return false;
            }
        }
        for conn in closing.drain(..) {
            if ws.write(close_frame(conn)).is_err() {
                return true;
            }
        }
        let sent = drain(&out_rx, POLL, |out| {
            let msg = match out {
                Out::Data(conn, bytes) => Message::binary([&conn[..], &bytes].concat()),
                Out::Close(conn) => {
                    guests.remove(&conn);
                    close_frame(conn)
                }
            };
            ws.write(msg).map_err(|_| ())
        });
        if sent.is_err() {
            return true;
        }
        if pinged.elapsed() >= KEEPALIVE {
            pinged = Instant::now();
            if ws.write(Message::Ping(Default::default())).is_err() {
                return true;
            }
        }
        match ws.flush() {
            Err(e) if !waiting(&e) => return true,
            _ => {}
        }
        match ws.read() {
            Ok(Message::Binary(frame)) => forward(&mut guests, &frame, &mut closing),
            Ok(Message::Text(text)) => announce(
                app,
                room,
                private,
                text.as_str(),
                &mut guests,
                &out_tx,
                &mut closing,
            ),
            Ok(Message::Close(_)) => return true,
            Ok(_) => {}
            Err(e) if waiting(&e) => {}
            Err(_) => return true,
        }
    }
}

/// A browser's Noise message, handed to the session it belongs to.
fn forward(
    guests: &mut HashMap<ConnId, SyncSender<Vec<u8>>>,
    frame: &[u8],
    closing: &mut Vec<ConnId>,
) {
    let Some(conn) = frame.get(..CONN_LEN).and_then(|c| ConnId::try_from(c).ok()) else {
        return;
    };
    let Some(tx) = guests.get(&conn) else {
        return;
    };
    let fits = frame.len() <= CONN_LEN + sharenoise::MAX_MESSAGE;
    if !fits || tx.try_send(frame[CONN_LEN..].to_vec()).is_err() {
        guests.remove(&conn);
        closing.push(conn);
    }
}

/// The relay's word that a browser arrived in the room or left it.
fn announce(
    app: &AppHandle,
    room: &str,
    private: &[u8],
    text: &str,
    guests: &mut HashMap<ConnId, SyncSender<Vec<u8>>>,
    out: &SyncSender<Out>,
    closing: &mut Vec<ConnId>,
) {
    let Ok(v) = serde_json::from_str::<Value>(text) else {
        return;
    };
    let Some(conn) = v.get("c").and_then(Value::as_str).and_then(parse_conn) else {
        return;
    };
    match v.get("t").and_then(Value::as_str) {
        Some("open") if guests.len() >= MAX_GUESTS => closing.push(conn),
        Some("open") => {
            let (tx, rx) = mpsc::sync_channel(GUEST_QUEUE);
            guests.insert(conn, tx);
            let app = app.clone();
            let room = room.to_string();
            let private = Zeroizing::new(private.to_vec());
            let out = out.clone();
            std::thread::spawn(move || welcome(app, &room, &private, conn, rx, out));
        }
        Some("close") => {
            guests.remove(&conn);
        }
        _ => {}
    }
}

/// A browser that just reached the room: the handshake, then its guest session.
fn welcome(
    app: AppHandle,
    room: &str,
    private: &[u8],
    conn: ConnId,
    incoming: Receiver<Vec<u8>>,
    out: SyncSender<Out>,
) {
    let accepted = incoming
        .recv_timeout(HANDSHAKE_WAIT)
        .ok()
        .and_then(|first| sharenoise::accept(private, room, &first));
    let Some(accepted) = accepted else {
        let _ = out.send(Out::Close(conn));
        return;
    };
    if out.send(Out::Data(conn, accepted.reply)).is_err() {
        return;
    }
    let link = RelayLink {
        conn,
        session: accepted.session,
        code: accepted.code,
        incoming,
        out,
        wait: POLL,
        closed: false,
    };
    crate::peer::serve_relayed(link, app);
}

// --- one browser guest's session ------------------------------------------------

struct RelayLink {
    conn: ConnId,
    session: sharenoise::Session,
    code: String,
    incoming: Receiver<Vec<u8>>,
    out: SyncSender<Out>,
    wait: Duration,
    closed: bool,
}

impl GuestLink for RelayLink {
    fn private(&self) -> bool {
        true
    }

    fn match_code(&self) -> Option<&str> {
        Some(&self.code)
    }

    fn admitted(&mut self) {
        self.session.admit();
    }

    fn set_wait(&mut self, wait: Duration) {
        self.wait = wait;
    }

    fn recv(&mut self) -> Incoming {
        let deadline = Instant::now() + self.wait;
        loop {
            let left = deadline.saturating_duration_since(Instant::now());
            match self.incoming.recv_timeout(left) {
                Ok(message) => match self.session.open(&message) {
                    Ok(Some(frame)) => {
                        return String::from_utf8(frame).map_or(Incoming::Closed, Incoming::Text)
                    }
                    Ok(None) => {}
                    Err(()) => return Incoming::Closed,
                },
                Err(RecvTimeoutError::Timeout) => return Incoming::Idle,
                Err(RecvTimeoutError::Disconnected) => return Incoming::Closed,
            }
        }
    }

    fn queue_text(&mut self, text: String) -> Result<(), ()> {
        for message in self.session.seal(text.as_bytes())? {
            self.out
                .send(Out::Data(self.conn, message))
                .map_err(|_| ())?;
        }
        Ok(())
    }

    fn flush_out(&mut self) -> Result<(), ()> {
        Ok(())
    }

    fn close_link(&mut self) {
        if !std::mem::replace(&mut self.closed, true) {
            let _ = self.out.send(Out::Close(self.conn));
        }
    }
}

impl Drop for RelayLink {
    fn drop(&mut self) {
        self.close_link();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // The same vector as relay/test/claim.test.mjs.
    #[test]
    fn a_token_names_its_room_the_way_the_relay_checks_it() {
        assert_eq!(room_of("abc"), "ungWv48Bz-pBQUDeXa4iIw");
        assert_eq!(room_of(&random_token(32)).len(), 22);
    }

    #[test]
    fn a_connection_id_is_eight_bytes_of_hex() {
        assert_eq!(
            parse_conn("0001020304050607"),
            Some([0, 1, 2, 3, 4, 5, 6, 7])
        );
        assert_eq!(parse_conn("00010203"), None);
        assert_eq!(parse_conn("zz01020304050607"), None);
    }

    #[test]
    fn a_full_or_gone_session_is_closed_at_the_relay() {
        let mut closing = Vec::new();
        let (tx, rx) = mpsc::sync_channel(1);
        let conn = [7u8; CONN_LEN];
        let mut guests = HashMap::from([(conn, tx)]);
        let frame = [&conn[..], b"abc"].concat();
        forward(&mut guests, &frame, &mut closing);
        assert_eq!(rx.try_recv().unwrap(), b"abc");
        forward(&mut guests, &frame, &mut closing);
        forward(&mut guests, &frame, &mut closing);
        assert!(guests.is_empty());
        assert_eq!(closing, [conn]);
    }

    // Past the largest Noise message the frame can only be junk, and only the
    // guest it names is closed: the relay link carries every other guest too.
    #[test]
    fn an_oversized_message_closes_only_its_guest() {
        let mut closing = Vec::new();
        let (big, big_rx) = mpsc::sync_channel(4);
        let (small, small_rx) = mpsc::sync_channel(4);
        let mut guests = HashMap::from([([1u8; CONN_LEN], big), ([2u8; CONN_LEN], small)]);
        let largest = [&[1u8; CONN_LEN][..], &vec![0; sharenoise::MAX_MESSAGE]].concat();
        forward(&mut guests, &largest, &mut closing);
        assert_eq!(big_rx.try_recv().unwrap().len(), sharenoise::MAX_MESSAGE);

        forward(&mut guests, &[&largest[..], b"!"].concat(), &mut closing);
        assert!(big_rx.try_recv().is_err());
        assert_eq!(closing, [[1u8; CONN_LEN]]);
        assert!(guests.contains_key(&[2u8; CONN_LEN]));
        forward(
            &mut guests,
            &[&[2u8; CONN_LEN][..], b"ok"].concat(),
            &mut closing,
        );
        assert_eq!(small_rx.try_recv().unwrap(), b"ok");
    }
}
