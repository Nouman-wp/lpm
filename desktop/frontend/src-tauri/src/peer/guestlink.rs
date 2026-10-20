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
    /// The guest proved the host let it in.
    fn admitted(&mut self) {}
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

/// Hand `send` what `rx` holds, for at most `budget`. A queue refilled as fast
/// as it drains would otherwise hold the loop for good, and nothing after the
/// drain would run: a share ending, a guest's keys, a keepalive.
pub(crate) fn drain<T>(
    rx: &mpsc::Receiver<T>,
    budget: Duration,
    mut send: impl FnMut(T) -> Result<(), ()>,
) -> Result<(), ()> {
    let until = Instant::now() + budget;
    while let Ok(item) = rx.try_recv() {
        send(item)?;
        if Instant::now() >= until {
            break;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_queue_refilled_as_fast_as_it_drains_still_ends_a_pass() {
        let (tx, rx) = mpsc::sync_channel(4);
        std::thread::spawn(move || while tx.send(0u8).is_ok() {});
        let (done, finished) = mpsc::channel();
        std::thread::spawn(move || {
            let _ = drain(&rx, Duration::from_millis(25), |_| Ok(()));
            let _ = done.send(());
        });
        assert!(finished.recv_timeout(Duration::from_secs(2)).is_ok());
    }

    #[test]
    fn what_is_left_waits_for_the_next_pass() {
        let (tx, rx) = mpsc::sync_channel(16);
        for i in 0..10 {
            tx.send(i).unwrap();
        }
        let mut sent = 0;
        let pass = drain(&rx, Duration::from_millis(25), |_| {
            sent += 1;
            std::thread::sleep(Duration::from_millis(10));
            Ok(())
        });
        assert_eq!(pass, Ok(()));
        assert!((1..=4).contains(&sent), "{sent}");
        assert_eq!(rx.try_iter().count(), 10 - sent);
    }

    #[test]
    fn a_failed_send_ends_the_pass() {
        let (tx, rx) = mpsc::sync_channel(4);
        tx.send(1).unwrap();
        tx.send(2).unwrap();
        assert_eq!(drain(&rx, Duration::from_secs(1), |_| Err(())), Err(()));
        assert_eq!(rx.try_recv(), Ok(2));
    }
}
