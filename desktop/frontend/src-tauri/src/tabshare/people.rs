// The people in a share: who may type, who asked to, who is typing now, and
// what each guest is told about their own place in the tab and who else is
// there.
use super::*;
use std::time::Duration;

// After a "not now", a guest waits this long before asking again.
const ASK_AGAIN_AFTER: Duration = Duration::from_secs(20);
// The host's list hears about a guest's keys at most this often.
const TYPING_NOTE_EVERY_MS: i64 = 2_000;
pub(crate) const TYPED_EVENT: &str = "peer-share-typed";
// More would only crowd a guest's header.
const MAX_OTHERS: usize = 16;

impl Registry {
    pub(super) fn connected(&self, guest: &str) -> bool {
        self.viewers.values().any(|v| v.guest == guest)
    }

    /// What guest `g` is told about the share: their own access, and the other
    /// people watching right now.
    pub(super) fn info(&self, s: &Share, g: &Guest) -> Value {
        let others: Vec<&str> = s
            .guests
            .iter()
            .filter(|o| o.id != g.id && self.connected(&o.id))
            .take(MAX_OTHERS)
            .map(|o| o.name.as_str())
            .collect();
        json!({ "canType": g.can_type, "asked": g.asked, "askType": true,
            "label": s.label, "project": s.project, "others": others })
    }

    /// Send each connected guest of `share` (or only `only`) its `shareInfo`.
    pub(super) fn tell_info(&self, share: &str, only: Option<&str>) {
        self.tell_guests(share, only, |s, g| {
            let mut frame = self.info(s, g);
            frame["t"] = json!("shareInfo");
            frame.to_string()
        });
    }

    fn guest_mut(&mut self, share: &str, guest: &str) -> Option<&mut Guest> {
        self.share_mut(share)?
            .guests
            .iter_mut()
            .find(|g| g.id == guest)
    }

    pub(super) fn set_guest_can_type(&mut self, share: &str, guest: &str, can_type: bool) -> bool {
        let Some(g) = self.guest_mut(share, guest) else {
            return false;
        };
        g.can_type = can_type;
        g.asked = false;
        self.tell_info(share, Some(guest));
        true
    }

    pub(super) fn take_keyboards(&mut self, share: &str) -> bool {
        let Some(s) = self.share_mut(share) else {
            return false;
        };
        for g in &mut s.guests {
            g.can_type = false;
            g.asked = false;
        }
        self.tell_info(share, None);
        true
    }

    /// A guest asks to type. False when it already may, is waiting for an
    /// answer, or was told not now a moment ago.
    fn ask_type(&mut self, session: &GuestSession) -> bool {
        let Some(g) = self.guest_mut(&session.share, &session.guest) else {
            return false;
        };
        let too_soon = g.declined_at.is_some_and(|t| t.elapsed() < ASK_AGAIN_AFTER);
        if g.can_type || g.asked || too_soon {
            return false;
        }
        g.asked = true;
        self.tell_info(&session.share, Some(&session.guest));
        true
    }

    pub(super) fn decline_ask(&mut self, share: &str, guest: &str) -> bool {
        let Some(g) = self.guest_mut(share, guest) else {
            return false;
        };
        if !g.asked {
            return false;
        }
        g.asked = false;
        g.declined_at = Some(Instant::now());
        self.tell_info(share, Some(guest));
        true
    }

    /// Note a guest's keys at `now`; true when the host's list should catch up.
    fn typed(&mut self, session: &GuestSession, now: i64) -> bool {
        let Some(g) = self.guest_mut(&session.share, &session.guest) else {
            return false;
        };
        if now - g.typed_at < TYPING_NOTE_EVERY_MS {
            return false;
        }
        g.typed_at = now;
        true
    }
}

// --- the guest connection's view (peer/guest.rs) ------------------------------

pub(crate) fn ask_type(app: &AppHandle, session: &GuestSession) {
    if registry().ask_type(session) {
        changed(app);
    }
}

/// Tells the host's list only who typed when, not the whole listing again.
pub(crate) fn typed(app: &AppHandle, session: &GuestSession) {
    let now = crate::status::now_millis();
    if registry().typed(session, now) {
        let _ = app.emit(
            TYPED_EVENT,
            json!({ "share": session.share, "guest": session.guest, "at": now }),
        );
    }
}

// --- host commands ------------------------------------------------------------

/// Let one guest type, or take it back. Answers their asking, if they asked.
#[tauri::command]
pub async fn peer_share_set_guest_can_type(
    app: AppHandle,
    id: String,
    guest: String,
    can_type: bool,
) -> Value {
    edit(&app, |reg| reg.set_guest_can_type(&id, &guest, can_type))
}

/// "Not now" to a guest who asked to type.
#[tauri::command]
pub async fn peer_share_decline_ask(app: AppHandle, id: String, guest: String) -> Value {
    edit(&app, |reg| reg.decline_ask(&id, &guest))
}

/// Nobody in the share may type any more.
#[tauri::command]
pub async fn peer_share_take_keyboards(app: AppHandle, id: String) -> Value {
    edit(&app, |reg| reg.take_keyboards(&id))
}

/// A share's link as a QR code, for a phone's camera. It's only ever read off a
/// screen, so it needs the least error correction and stays the least dense.
#[tauri::command]
pub fn peer_share_qr(link: String) -> Option<String> {
    crate::remote::qr_svg(&link, 180, qrcode::EcLevel::L)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn guest(reg: &mut Registry, share: &str, name: &str) -> GuestSession {
        let (guest, _) = reg.admit(share, name, Via::Browser, false).unwrap();
        GuestSession {
            guest,
            share: share.to_string(),
        }
    }

    fn watch(reg: &mut Registry, conn: u64, session: &GuestSession) -> Receiver<String> {
        let (tx, rx) = mpsc::sync_channel(8);
        reg.viewers.insert(
            conn,
            Viewer {
                guest: session.guest.clone(),
                tx,
            },
        );
        rx
    }

    fn last_info(rx: &Receiver<String>) -> Value {
        let frame = rx.try_iter().last().expect("a shareInfo frame");
        serde_json::from_str(&frame).unwrap()
    }

    #[test]
    fn one_guest_can_type_while_the_rest_watch() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude", 0, false);
        let ana = guest(&mut reg, &share, "Ana");
        let ben = guest(&mut reg, &share, "Ben");
        let rx_ana = watch(&mut reg, 1, &ana);
        let rx_ben = watch(&mut reg, 2, &ben);
        assert!(reg.set_guest_can_type(&share, &ben.guest, true));
        assert!(reg.may_type(&ben, "web-1"));
        assert!(!reg.may_type(&ana, "web-1"));
        assert_eq!(last_info(&rx_ben)["canType"], true);
        assert!(rx_ana.try_recv().is_err(), "only Ben's access changed");
    }

    #[test]
    fn taking_the_keyboards_back_reaches_everyone() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude", 0, false);
        let ana = guest(&mut reg, &share, "Ana");
        let ben = guest(&mut reg, &share, "Ben");
        reg.set_guest_can_type(&share, &ana.guest, true);
        reg.set_guest_can_type(&share, &ben.guest, true);
        assert!(reg.take_keyboards(&share));
        assert!(!reg.may_type(&ana, "web-1"));
        assert!(!reg.may_type(&ben, "web-1"));
    }

    #[test]
    fn asking_to_type_waits_for_an_answer() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude", 0, false);
        let ana = guest(&mut reg, &share, "Ana");
        let rx = watch(&mut reg, 1, &ana);
        assert!(reg.ask_type(&ana));
        assert_eq!(last_info(&rx)["asked"], true);
        assert!(!reg.ask_type(&ana), "one question at a time");
        assert!(reg.set_guest_can_type(&share, &ana.guest, true));
        let info = last_info(&rx);
        assert_eq!(
            (info["canType"].clone(), info["asked"].clone()),
            (json!(true), json!(false))
        );
        assert!(!reg.ask_type(&ana), "nothing to ask for");
    }

    #[test]
    fn not_now_holds_off_the_next_ask() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude", 0, false);
        let ana = guest(&mut reg, &share, "Ana");
        assert!(!reg.decline_ask(&share, &ana.guest), "she hasn't asked");
        assert!(reg.ask_type(&ana));
        assert!(reg.decline_ask(&share, &ana.guest));
        assert!(!reg.may_type(&ana, "web-1"));
        assert!(!reg.ask_type(&ana));
    }

    #[test]
    fn a_guest_hears_who_else_is_watching() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude", 0, false);
        let ana = guest(&mut reg, &share, "Ana");
        let ben = guest(&mut reg, &share, "Ben");
        guest(&mut reg, &share, "Leo");
        let rx_ana = watch(&mut reg, 1, &ana);
        watch(&mut reg, 2, &ben);
        reg.tell_info(&share, None);
        assert_eq!(last_info(&rx_ana)["others"], json!(["Ben"]));
        reg.remove_guest(&share, &ben.guest, "removed");
        assert_eq!(last_info(&rx_ana)["others"], json!([]));
    }

    #[test]
    fn typing_reaches_the_host_list_at_most_every_two_seconds() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude", 0, false);
        let ana = guest(&mut reg, &share, "Ana");
        assert!(reg.typed(&ana, 10_000));
        assert!(!reg.typed(&ana, 11_000));
        assert!(reg.typed(&ana, 12_000));
    }
}
