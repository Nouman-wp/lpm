// The phone's end of a relay. A phone paired with this Mac opens one of the
// machines this Mac connects to — a Linux host or another Mac — without pairing
// with it: it signs in here as usual, naming the machine (`relay`), and this Mac
// carries its frames to that machine over the peer link and the answers back
// (remote/relayed.rs is the far end). Frames pass through unchanged, so past
// the first one the phone holds an ordinary session with that machine.
use super::{ClientWs, POLL, READ_SILENCE_DEAD, READ_SILENCE_PING, WRITE_TIMEOUT};
use crate::peer::{QUICK_FOR, QUICK_POLL};
use crate::peerclient::{PeerClientHub, PhoneChannelError};
use serde_json::json;
use std::sync::mpsc::TryRecvError;
use std::time::Instant;
use tauri::{AppHandle, Manager};
use tungstenite::{Error as WsError, Message};

/// The machine isn't connected to this Mac right now. The phone keeps trying.
const OFFLINE: &str = "relay-offline";
/// The machine's lpm predates relayed phones.
const UNSUPPORTED: &str = "relay-unsupported";

/// Carry one phone to the machine `slug` until either side goes away or `alive`
/// says the phone may no longer be here.
pub(super) fn run(
    ws: &mut ClientWs,
    app: &AppHandle,
    device_id: &str,
    phone_id: &str,
    name: &str,
    slug: &str,
    alive: impl Fn() -> bool,
) {
    let opened = match app.try_state::<PeerClientHub>() {
        Some(hub) => hub.open_phone_channel(slug, device_id, phone_id, name),
        None => Err(PhoneChannelError::Offline),
    };
    let channel = match opened {
        Ok(channel) => channel,
        Err(e) => {
            let error = match e {
                PhoneChannelError::Offline => OFFLINE,
                PhoneChannelError::Unsupported => UNSUPPORTED,
            };
            let _ = ws.send(Message::text(
                json!({ "t": "error", "error": error }).to_string(),
            ));
            return;
        }
    };
    let _ = ws.get_ref().tcp().set_read_timeout(Some(POLL));
    let _ = ws.get_ref().tcp().set_write_timeout(Some(WRITE_TIMEOUT));
    let mut last_read = Instant::now();
    let mut last_ping: Option<Instant> = None;
    // Polled quickly for a moment after the phone sends something, so the echo
    // of a keystroke goes back without waiting out a whole POLL.
    let mut quick_until: Option<Instant> = None;
    let mut quick = false;

    'main: loop {
        if !alive() {
            break;
        }
        loop {
            match channel.inbox.try_recv() {
                Ok(frame) => {
                    if ws.write(Message::text(frame)).is_err() {
                        break 'main;
                    }
                }
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => break 'main,
            }
        }
        let _ = ws.flush();
        let want_quick = quick_until.is_some_and(|t| Instant::now() < t);
        if want_quick != quick {
            quick = want_quick;
            let poll = if quick { QUICK_POLL } else { POLL };
            let _ = ws.get_ref().tcp().set_read_timeout(Some(poll));
        }
        match ws.read() {
            Ok(msg) => {
                last_read = Instant::now();
                last_ping = None;
                if msg.is_close() {
                    break;
                }
                if msg.is_text() {
                    let Ok(text) = msg.to_text() else { continue };
                    if channel.send(text).is_err() {
                        break;
                    }
                    quick_until = Some(Instant::now() + QUICK_FOR);
                }
            }
            Err(WsError::Io(ref e))
                if e.kind() == std::io::ErrorKind::WouldBlock
                    || e.kind() == std::io::ErrorKind::TimedOut =>
            {
                let silent = last_read.elapsed();
                if silent >= READ_SILENCE_DEAD {
                    break;
                }
                if silent >= READ_SILENCE_PING
                    && last_ping.is_none_or(|t| t.elapsed() >= READ_SILENCE_PING)
                {
                    if ws.send(Message::Ping(tungstenite::Bytes::new())).is_err() {
                        break;
                    }
                    last_ping = Some(Instant::now());
                }
            }
            Err(_) => break,
        }
    }
}
