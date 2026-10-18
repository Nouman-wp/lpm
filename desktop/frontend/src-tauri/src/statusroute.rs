// Where an agent's status transition is announced: on the machine the person is
// using. A machine hosting projects for a paired Mac chimes and shows its banner
// itself while someone uses it. When the person last used lpm from a paired Mac
// instead — focused one of this machine's terminals there after this machine's
// own windows were last in front — the chime and banner go to that Mac, which
// plays them under its own settings. A headless host has nobody at it and hands
// every transition to all of its Macs (sound.rs).
use crate::sound::{StatusSound, STATUS_SOUND_EVENT};
use serde_json::json;
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::Instant;
use tauri::AppHandle;

#[derive(Default)]
struct Activity {
    // When one of this machine's windows last gained or lost focus.
    here: Option<Instant>,
    // When each paired Mac last took control of a terminal here, by device.
    peers: HashMap<String, Instant>,
}

fn with<T>(f: impl FnOnce(&mut Activity) -> T) -> T {
    static ACTIVITY: OnceLock<Mutex<Activity>> = OnceLock::new();
    f(&mut ACTIVITY.get_or_init(Mutex::default).lock().unwrap())
}

/// One of this machine's windows gained or lost focus.
pub fn used_here() {
    with(|a| a.here = Some(Instant::now()));
}

/// A paired Mac focused one of this machine's terminals, or took control of it.
pub fn used_from(device_id: &str) {
    with(|a| a.peers.insert(device_id.to_string(), Instant::now()));
}

/// The paired Mac the person used last, when that was after they last used
/// this machine.
fn used_last(a: &Activity) -> Option<&str> {
    let (device, at) = a.peers.iter().max_by_key(|(_, at)| **at)?;
    a.here.is_none_or(|here| *at > here).then_some(device.as_str())
}

/// Chime and post a banner for a status transition, wherever the person is.
pub fn announce(app: &AppHandle, project: &str, value: &str, pane_id: &str) {
    if !crate::sys::headless() && !crate::statusnotify::window_attended(app) {
        let elsewhere = with(|a| used_last(a).map(str::to_string));
        if let (Some(device), Some(sound)) = (elsewhere, StatusSound::of(app, project, value, pane_id)) {
            let frame = json!({ "t": "evt", "name": STATUS_SOUND_EVENT, "payload": sound });
            if crate::peer::send_to_device(app, &device, &frame.to_string()) {
                return;
            }
        }
    }
    crate::sound::announce_status(app, project, value, pane_id);
    crate::statusnotify::notify_status(app, project, value, pane_id);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn a_paired_mac_used_after_this_one_hears_the_news() {
        let t = Instant::now();
        let mut a = Activity {
            here: Some(t),
            peers: HashMap::from([("laptop".to_string(), t + Duration::from_secs(5))]),
        };
        assert_eq!(used_last(&a), Some("laptop"));
        a.here = Some(t + Duration::from_secs(9));
        assert_eq!(used_last(&a), None);
    }

    #[test]
    fn the_most_recent_of_several_macs_is_the_one() {
        let t = Instant::now();
        let a = Activity {
            here: None,
            peers: HashMap::from([
                ("laptop".to_string(), t),
                ("studio".to_string(), t + Duration::from_secs(1)),
            ]),
        };
        assert_eq!(used_last(&a), Some("studio"));
    }

    #[test]
    fn with_no_paired_mac_used_it_stays_here() {
        assert_eq!(used_last(&Activity::default()), None);
    }
}
