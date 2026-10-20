// A paired machine sharing this machine's tabs. It is trusted with everything
// this one can do, so it shares a tab here, lets the guests in and ends it, all
// from its own screen. On a headless host it is the only one who can.
//
// What it shares lasts while one of them is there to answer for it, as what is
// shared from this machine's own window lasts while lpm runs here.
use super::*;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

/// Advertised in `ready`: a paired machine may share this one's tabs.
pub(crate) const TAB_SHARE_FEATURE: &str = "tabShare";
/// Someone asks to join a tab a paired machine shared. It brings that
/// machine's window up, as asking brings up this one's (peer/guest.rs).
pub(crate) const KNOCK_EVENT: &str = "peer-share-knock";
// Rides out a dropped network or a reconnect, not a machine that went away.
const AWAY_ENDS_AFTER: Duration = Duration::from_secs(60);

static LEFT: AtomicU64 = AtomicU64::new(0);

impl Registry {
    /// End every share a paired machine made; true when there was one.
    fn end_machine_shares(&mut self) -> bool {
        self.stop_where(|s| s.by_machine, "stopped")
    }
}

/// Whether anyone can let in someone asking to join: this machine's window, or
/// a paired machine's.
pub(super) fn someone_answers(app: &AppHandle) -> bool {
    crate::remote::pair_requests_supported() || crate::peer::paired_connected(app)
}

/// A paired machine's connection closed. Once none has come back for a while,
/// what they shared here ends.
pub(crate) fn machine_left(app: &AppHandle) {
    if !registry().shares.iter().any(|s| s.by_machine) {
        return;
    }
    let left = LEFT.fetch_add(1, Ordering::SeqCst) + 1;
    let app = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(AWAY_ENDS_AFTER);
        if LEFT.load(Ordering::SeqCst) != left || crate::peer::paired_connected(&app) {
            return;
        }
        if registry().end_machine_shares() {
            sync_listener(&app);
            changed(&app);
        }
    });
}

/// A share command from a paired machine, answered here rather than by this
/// machine's page, which a headless host doesn't have. Its arguments keep the
/// frontend's camelCase names.
pub(crate) fn answer_machine(
    app: &AppHandle,
    cmd: &str,
    args: &Value,
) -> Option<Result<Value, String>> {
    let s = |k: &str| {
        args.get(k)
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string()
    };
    let flag = |k: &str| args.get(k).and_then(Value::as_bool);
    let answer = match cmd {
        "peer_shares" => listing(app),
        "peer_share_start" => {
            return Some(start(
                app,
                &s("terminalId"),
                &s("project"),
                &s("label"),
                true,
            ))
        }
        "peer_share_stop" => stop(app, &s("id")),
        "peer_share_set_can_type" => {
            let can_type = flag("canType").unwrap_or(false);
            edit(app, |reg| reg.set_can_type(&s("id"), can_type))
        }
        "peer_share_remove_guest" => edit(app, |reg| {
            reg.remove_guest(&s("id"), &s("guest"), "removed")
        }),
        "peer_share_respond" => {
            let allow = flag("allow").unwrap_or(false);
            edit(app, |reg| {
                reg.respond(&s("request"), allow, flag("canType"))
            })
        }
        "peer_share_set_guest_can_type" => {
            let can_type = flag("canType").unwrap_or(false);
            edit(app, |reg| {
                reg.set_guest_can_type(&s("id"), &s("guest"), can_type)
            })
        }
        "peer_share_decline_ask" => edit(app, |reg| reg.decline_ask(&s("id"), &s("guest"))),
        "peer_share_take_keyboards" => edit(app, |reg| reg.take_keyboards(&s("id"))),
        _ => return None,
    };
    Some(Ok(answer))
}

#[cfg(test)]
mod tests {
    use super::*;

    const CODE: &str = "🐶 🐱 🦁 🐎";

    #[test]
    fn only_what_a_paired_machine_shared_ends_with_it() {
        let mut reg = Registry::default();
        let theirs = reg.start("web-1", "web", "claude", 0, true);
        let ours = reg.start("web-2", "web", "codex", 0, false);
        let (guest, _) = reg.admit(&theirs, "Sam", Via::Browser, false).unwrap();
        let (tx, rx) = mpsc::sync_channel(4);
        reg.viewers.insert(1, Viewer { guest, tx });
        let secret = reg.share(&theirs).unwrap().secret.clone();
        let ticket = reg.begin_join(&secret, "Ana", CODE, Via::Lpm).ok().unwrap();

        assert!(reg.end_machine_shares());

        assert!(reg.share(&theirs).is_none());
        assert!(reg.share(&ours).is_some());
        let ended: Value = serde_json::from_str(&rx.try_recv().unwrap()).unwrap();
        assert_eq!(ended["t"], "shareEnded");
        assert_eq!(ended["reason"], "stopped");
        assert_eq!(ticket.decision.try_recv().ok(), Some(Answer::Deny));
        assert!(!reg.end_machine_shares());
    }

    #[test]
    fn sharing_it_here_too_keeps_it_past_the_machine() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude", 0, true);
        assert_eq!(reg.start("web-1", "web", "claude", 0, false), share);
        assert!(!reg.end_machine_shares());
        assert!(reg.share(&share).is_some());
    }

    #[test]
    fn a_machine_sharing_it_again_leaves_it_this_machines() {
        let mut reg = Registry::default();
        let share = reg.start("web-1", "web", "claude", 0, false);
        reg.start("web-1", "web", "claude", 0, true);
        assert!(!reg.share(&share).unwrap().by_machine);
    }
}
