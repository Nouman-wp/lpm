// Phones this Mac carries to a peer (remote/relay.rs): each is a channel on the
// peer link. Frames from the phone go out as `phoneIn`, the host's answers come
// back as `phoneOut`, and either side ends the channel with `phoneClose`.
use super::{PeerClientHub, PeerConn};
use serde_json::{json, Value};
use std::sync::atomic::Ordering;
use std::sync::mpsc::{self, Receiver};
use std::sync::Arc;

/// How many of the host's frames wait for the phone before the channel is
/// given up — the phone reconnects to a fresh one instead of missing them.
const INBOX: usize = 1024;

pub(crate) enum PhoneChannelError {
    /// The machine isn't connected to this Mac right now.
    Offline,
    /// Its lpm predates relayed phones.
    Unsupported,
}

/// One phone relayed to a host. Dropping it tells the host the phone has gone.
pub(crate) struct PhoneChannel {
    conn: Arc<PeerConn>,
    ch: u64,
    /// What the host sends the phone. Disconnects once the host ends the
    /// channel or the link drops.
    pub inbox: Receiver<String>,
}

impl PhoneChannel {
    pub(crate) fn send(&self, frame: &str) -> Result<(), String> {
        self.conn.in_run.store(true, Ordering::Relaxed);
        self.conn
            .send(json!({ "t": "phoneIn", "ch": self.ch, "d": frame }).to_string())
    }
}

impl Drop for PhoneChannel {
    fn drop(&mut self) {
        if self.conn.phones.lock().unwrap().remove(&self.ch).is_some() {
            let _ = self
                .conn
                .send(json!({ "t": "phoneClose", "ch": self.ch }).to_string());
        }
    }
}

impl PeerClientHub {
    /// Start relaying a phone to the peer `slug`. `device_id` is the id this Mac
    /// knows the phone by, which the phone compares a terminal's owner against;
    /// `phone_id` the phone's own install id, which the host checks against the
    /// phones removed there; `name` is what the host shows for it.
    pub(crate) fn open_phone_channel(
        &self,
        slug: &str,
        device_id: &str,
        phone_id: &str,
        name: &str,
    ) -> Result<PhoneChannel, PhoneChannelError> {
        let conn = self
            .inner
            .conns
            .lock()
            .unwrap()
            .get(slug)
            .cloned()
            .ok_or(PhoneChannelError::Offline)?;
        if !conn.connected.load(Ordering::Relaxed) {
            return Err(PhoneChannelError::Offline);
        }
        if !conn.supports_phone_relay.load(Ordering::Relaxed) {
            return Err(PhoneChannelError::Unsupported);
        }
        let ch = self.inner.next_req.fetch_add(1, Ordering::SeqCst) + 1;
        let (tx, inbox) = mpsc::sync_channel::<String>(INBOX);
        conn.phones.lock().unwrap().insert(ch, tx);
        let channel = PhoneChannel { conn, ch, inbox };
        channel
            .conn
            .send(
                json!({ "t": "phoneOpen", "ch": ch, "device": device_id, "phone": phone_id, "name": name })
                    .to_string(),
            )
            .map_err(|_| PhoneChannelError::Offline)?;
        Ok(channel)
    }
}

/// A `phoneOut` or `phoneClose` from the host.
pub(super) fn route(conn: &PeerConn, v: &Value) {
    let Some(ch) = v.get("ch").and_then(Value::as_u64) else {
        return;
    };
    let mut phones = conn.phones.lock().unwrap();
    if v.get("t").and_then(Value::as_str) == Some("phoneClose") {
        phones.remove(&ch);
        return;
    }
    let Some(frame) = v.get("d").and_then(Value::as_str) else {
        return;
    };
    let delivered = phones
        .get(&ch)
        .is_some_and(|tx| tx.try_send(frame.to_string()).is_ok());
    if !delivered && phones.remove(&ch).is_some() {
        drop(phones);
        let _ = conn.send(json!({ "t": "phoneClose", "ch": ch }).to_string());
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc::TryRecvError;

    #[test]
    fn host_frames_reach_their_phone_until_the_host_ends_the_channel() {
        let conn = PeerConn::new("box");
        let (tx, inbox) = mpsc::sync_channel(4);
        conn.phones.lock().unwrap().insert(7, tx);
        route(
            &conn,
            &json!({ "t": "phoneOut", "ch": 7, "d": "{\"t\":\"pong\"}" }),
        );
        route(
            &conn,
            &json!({ "t": "phoneOut", "ch": 8, "d": "another phone's" }),
        );
        assert_eq!(inbox.try_recv().unwrap(), "{\"t\":\"pong\"}");
        assert!(matches!(inbox.try_recv(), Err(TryRecvError::Empty)));
        route(&conn, &json!({ "t": "phoneClose", "ch": 7 }));
        assert!(matches!(inbox.try_recv(), Err(TryRecvError::Disconnected)));
    }

    // A phone that stopped reading would otherwise back up the whole link.
    #[test]
    fn a_phone_that_falls_behind_loses_its_channel() {
        let conn = PeerConn::new("box");
        let (tx, inbox) = mpsc::sync_channel(1);
        conn.phones.lock().unwrap().insert(3, tx);
        route(&conn, &json!({ "t": "phoneOut", "ch": 3, "d": "one" }));
        route(&conn, &json!({ "t": "phoneOut", "ch": 3, "d": "two" }));
        assert!(conn.phones.lock().unwrap().is_empty());
        assert_eq!(inbox.try_recv().unwrap(), "one");
        assert!(matches!(inbox.try_recv(), Err(TryRecvError::Disconnected)));
    }
}
