// What a guest's connection travels over: a socket to this machine's listener, or
// the relay a browser reaches it through (sharerelay.rs). guest.rs runs the same
// rules over either.
use super::*;

pub(crate) enum Incoming {
    Text(String),
    Idle,
    Closed,
}

pub(crate) trait GuestLink {
    /// Whether nobody between the guest and this machine can read the connection.
    fn private(&self) -> bool;
    /// The code both ends derived from the handshake, when there is one.
    fn match_code(&self) -> Option<&str> {
        None
    }
    /// How long `recv` waits for a frame.
    fn set_wait(&mut self, wait: Duration);
    fn recv(&mut self) -> Incoming;
    fn queue_text(&mut self, text: String) -> Result<(), ()>;
    fn flush_out(&mut self) -> Result<(), ()>;
    fn close_link(&mut self);

    fn send_text(&mut self, text: String) -> Result<(), ()> {
        self.queue_text(text)?;
        self.flush_out()
    }
}

impl GuestLink for ConnWs {
    fn private(&self) -> bool {
        matches!(self.get_ref(), PeerStream::Tls(_))
    }

    fn set_wait(&mut self, wait: Duration) {
        let _ = self.get_ref().tcp().set_read_timeout(Some(wait));
    }

    fn recv(&mut self) -> Incoming {
        match self.read() {
            Ok(m) if m.is_close() => Incoming::Closed,
            Ok(m) => match m.to_text() {
                Ok(t) => Incoming::Text(t.to_string()),
                Err(_) => Incoming::Idle,
            },
            Err(WsError::Io(ref e))
                if e.kind() == io::ErrorKind::WouldBlock || e.kind() == io::ErrorKind::TimedOut =>
            {
                Incoming::Idle
            }
            Err(_) => Incoming::Closed,
        }
    }

    fn queue_text(&mut self, text: String) -> Result<(), ()> {
        self.write(Message::text(text)).map_err(|_| ())
    }

    fn flush_out(&mut self) -> Result<(), ()> {
        self.flush().map_err(|_| ())
    }

    fn close_link(&mut self) {
        let _ = self.close(None);
        let _ = self.flush();
    }
}
