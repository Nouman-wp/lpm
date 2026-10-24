//! Agents shown live on a phone's Lock Screen: an iPhone's Live Activity, an
//! Android phone's ongoing notification. The phone starts it while it watches
//! this machine and registers it with `liveActivity`; from then on, whenever the
//! app is off screen, each burst of status changes seals a snapshot of the agents
//! at work here under the phone's push key and sends it through the push relay.
//! The snapshot that finds nothing left at work ends it.
use super::{
    clear_push_token, load_config, make_push_device, on_screen_devices, post_relay, relay_client,
    relay_envelope, scoped_devices, seal_push, Delivery, PushDevice, RemoteHub, PUSH_PLATFORM_FCM,
};
use crate::remotestore::Device;
use crate::status::{
    now_millis, StatusEntry, StatusStore, STATUS_DONE, STATUS_ERROR, STATUS_RUNNING, STATUS_WAITING,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Manager};

/// The phone may send `liveActivity`.
pub(super) const FEATURE: &str = "liveActivity";

/// A tool call is a Running and a Running again: one snapshot per burst.
const COALESCE: Duration = Duration::from_millis(800);
/// What the Lock Screen has room for.
const MAX_AGENTS: usize = 4;
/// A finished agent stays in the snapshot this long, so the last one done reads
/// as done rather than vanishing.
const RECENT_MS: i64 = 30 * 60 * 1000;
/// How long the final snapshot stays up once nothing is at work.
const LINGER_SECS: i64 = 15 * 60;

static PENDING: AtomicBool = AtomicBool::new(false);

/// What a device was last sent, so an unchanged snapshot isn't resent.
struct Sent {
    digest: String,
    waiting: u64,
}

fn sent() -> &'static Mutex<HashMap<String, Sent>> {
    static SENT: OnceLock<Mutex<HashMap<String, Sent>>> = OnceLock::new();
    SENT.get_or_init(Default::default)
}

/// Turn live updates on or off for this device. An iPhone names the Live
/// Activity's own push token; an Android phone is reached on its push token.
pub(super) fn register(hub: &RemoteHub, app: &AppHandle, device_id: &str, v: &Value) -> bool {
    let on = v.get("on").and_then(Value::as_bool).unwrap_or(false);
    let token = v.get("token").and_then(Value::as_str).unwrap_or_default();
    let env = v.get("env").and_then(Value::as_str).unwrap_or_default();
    let stored = hub
        .update_config(|cfg| {
            cfg.devices
                .iter_mut()
                .find(|d| d.id == device_id)
                .is_some_and(|d| apply(d, on, token, env))
        })
        .unwrap_or(false);
    if stored {
        sent().lock().unwrap().remove(device_id);
        schedule(hub, app);
    }
    stored
}

fn apply(d: &mut Device, on: bool, token: &str, env: &str) -> bool {
    d.live_token.clear();
    d.live_env.clear();
    d.live_updates = false;
    if !on {
        return true;
    }
    if d.push_platform != PUSH_PLATFORM_FCM {
        let hex =
            !token.is_empty() && token.len() <= 200 && token.bytes().all(|b| b.is_ascii_hexdigit());
        if !hex || !matches!(env, "production" | "sandbox") {
            return false;
        }
        d.live_token = token.to_string();
        d.live_env = env.to_string();
    }
    d.live_updates = true;
    true
}

/// Send fresh snapshots soon. Called on every status change and when a phone
/// leaves the screen, since from then on only these keep it current.
pub(super) fn schedule(hub: &RemoteHub, app: &AppHandle) {
    if !hub.inner.enabled.load(Ordering::Relaxed) || !hub.inner.running.load(Ordering::Relaxed) {
        return;
    }
    if PENDING.swap(true, Ordering::AcqRel) {
        return;
    }
    let (hub, app) = (hub.clone(), app.clone());
    std::thread::spawn(move || {
        std::thread::sleep(COALESCE);
        PENDING.store(false, Ordering::Release);
        send_all(&hub, &app);
    });
}

/// The devices to keep current, each addressed by the token its updates go to:
/// an iPhone's Live Activity token, an Android phone's own push token.
fn targets(devices: &[Device], on_screen: &std::collections::HashSet<String>) -> Vec<PushDevice> {
    devices
        .iter()
        .filter(|d| d.live_updates && !on_screen.contains(&d.id))
        .filter_map(|d| {
            let mut device = make_push_device(d)?;
            if d.push_platform != PUSH_PLATFORM_FCM {
                device.token = d.live_token.clone();
                device.env = d.live_env.clone();
            }
            (!device.token.is_empty()).then_some(device)
        })
        .collect()
}

fn send_all(hub: &RemoteHub, app: &AppHandle) {
    // A pass still on the network when the next burst comes in finishes first,
    // so a device can't be sent the same update twice.
    static SENDING: Mutex<()> = Mutex::new(());
    let _one_at_a_time = SENDING.lock().unwrap_or_else(|e| e.into_inner());
    let cfg = load_config();
    let targets = targets(&scoped_devices(&cfg), &on_screen_devices(hub));
    if targets.is_empty() {
        return;
    }
    let server_id = cfg.flavor_server_id();
    let entries = app.state::<Arc<StatusStore>>().agent_entries();
    let labels = hub.inner.labels.lock().unwrap().clone();
    let snap = snapshot(&entries, &labels, now_millis());
    let digest = snap.to_string();
    let waiting = snap["waiting"].as_u64().unwrap_or(0);
    let ended = snap["live"] == json!(false);
    let Some(client) = relay_client() else {
        return;
    };
    let relay = cfg.effective_relay();
    for dev in targets {
        let previous_waiting = match sent().lock().unwrap().get(&dev.id) {
            Some(last) if last.digest == digest => continue,
            last => last.map(|l| l.waiting),
        };
        // Nothing was at work when it was last told, and still nothing is.
        if ended && previous_waiting.is_none() {
            continue;
        }
        let urgent = ended || waiting > previous_waiting.unwrap_or(0);
        let mut plaintext = snap.clone();
        plaintext["serverId"] = json!(server_id);
        plaintext["ts"] = json!(now_millis());
        let Some(blob) = seal_push(&dev.key, plaintext.to_string().as_bytes()) else {
            continue;
        };
        let body = relay_body(&dev, blob, ended, urgent);
        match post_relay(client, &relay, body) {
            Delivery::Sent if ended => {
                sent().lock().unwrap().remove(&dev.id);
                // An ended Live Activity's token is spent; the phone registers
                // the next one it starts.
                if dev.platform != PUSH_PLATFORM_FCM {
                    retire(hub, &dev);
                }
            }
            Delivery::Sent => {
                let last = Sent {
                    digest: digest.clone(),
                    waiting,
                };
                sent().lock().unwrap().insert(dev.id.clone(), last);
            }
            Delivery::Dead => {
                sent().lock().unwrap().remove(&dev.id);
                retire(hub, &dev);
            }
            Delivery::Failed => {}
        }
    }
}

/// The agents at work here, most urgent first: who waits on the user, who is
/// working, who finished lately. `live` is false once nobody is at work.
fn snapshot(
    entries: &[(String, StatusEntry)],
    labels: &HashMap<String, String>,
    now: i64,
) -> Value {
    let rank = |value: &str| match value {
        STATUS_WAITING => 0,
        STATUS_RUNNING => 1,
        _ => 2,
    };
    let mut shown: Vec<&(String, StatusEntry)> = entries
        .iter()
        .filter(|(_, e)| match e.value.as_str() {
            STATUS_WAITING | STATUS_RUNNING => true,
            STATUS_DONE | STATUS_ERROR => now - finished_at(e) <= RECENT_MS,
            _ => false,
        })
        .collect();
    shown.sort_by(|(_, a), (_, b)| {
        rank(&a.value)
            .cmp(&rank(&b.value))
            .then(b.timestamp.cmp(&a.timestamp))
            .then(a.key.cmp(&b.key))
    });
    let count = |value: &str| shown.iter().filter(|(_, e)| e.value == value).count();
    let (waiting, working) = (count(STATUS_WAITING), count(STATUS_RUNNING));
    let agents: Vec<Value> = shown
        .iter()
        .take(MAX_AGENTS)
        .map(|(project, e)| {
            json!({
                "project": project,
                "projectLabel": crate::config::project_display_name(project),
                "terminal": labels.get(&e.pane_id).cloned().unwrap_or_default(),
                "terminalId": e.pane_id,
                "key": e.key,
                "agent": crate::agentkind::AgentKind::of_key(&e.key).map(|k| k.id()).unwrap_or_default(),
                "state": e.value,
                "since": e.timestamp,
                "turnStart": e.turn_start,
                "endedAt": e.ended_at,
            })
        })
        .collect();
    json!({
        "live": waiting + working > 0,
        "waiting": waiting,
        "working": working,
        "agents": agents,
    })
}

fn finished_at(e: &StatusEntry) -> i64 {
    if e.ended_at > 0 {
        e.ended_at
    } else {
        e.timestamp
    }
}

/// The relay body for one update: the Live Activity's own token on APNs, the
/// phone's push token on FCM. `urgent` asks for immediate delivery — something
/// newly waits on the user, or it ended — and the rest go at a lower priority,
/// which APNs budgets less tightly.
fn relay_body(dev: &PushDevice, blob: String, ended: bool, urgent: bool) -> String {
    let mut body = relay_envelope(dev, blob);
    body["type"] = json!("liveactivity");
    body["event"] = json!(if ended { "end" } else { "update" });
    body["urgent"] = json!(urgent);
    if ended {
        body["dismissAt"] = json!(now_millis() / 1000 + LINGER_SECS);
    }
    body.to_string()
}

/// Forget a token the relay or the end of the activity retired. On FCM that is
/// the phone's own push token, which the next registration replaces.
fn retire(hub: &RemoteHub, dev: &PushDevice) {
    if dev.platform == PUSH_PLATFORM_FCM {
        return clear_push_token(hub, &dev.id);
    }
    hub.update_config(|cfg| {
        if let Some(d) = cfg.devices.iter_mut().find(|d| d.id == dev.id) {
            if d.live_token == dev.token {
                d.live_token.clear();
                d.live_env.clear();
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(key: &str, value: &str, pane: &str, ts: i64) -> (String, StatusEntry) {
        (
            "web".to_string(),
            StatusEntry {
                key: key.into(),
                value: value.into(),
                pane_id: pane.into(),
                timestamp: ts,
                ..Default::default()
            },
        )
    }

    #[test]
    fn the_agent_waiting_on_you_comes_first() {
        let entries = [
            entry("claude_code_a", STATUS_RUNNING, "t1", 300),
            entry("codex_b", STATUS_WAITING, "t2", 100),
            entry("claude_code_c", STATUS_DONE, "t3", 400),
        ];
        let labels = HashMap::from([("t2".to_string(), "Codex".to_string())]);
        let snap = snapshot(&entries, &labels, 1_000);
        assert_eq!(snap["live"], true);
        assert_eq!(snap["waiting"], 1);
        assert_eq!(snap["working"], 1);
        let agents = snap["agents"].as_array().unwrap();
        assert_eq!(agents[0]["key"], "codex_b");
        assert_eq!(agents[0]["terminal"], "Codex");
        assert_eq!(agents[0]["agent"], "codex");
        assert_eq!(agents[1]["state"], STATUS_RUNNING);
        assert_eq!(agents[2]["state"], STATUS_DONE);
    }

    #[test]
    fn nothing_at_work_ends_it_and_old_finishes_drop_out() {
        let now = 10 * RECENT_MS;
        let entries = [
            entry("claude_code_a", STATUS_DONE, "t1", now - 1_000),
            entry("claude_code_b", STATUS_DONE, "t2", now - RECENT_MS - 1),
        ];
        let snap = snapshot(&entries, &HashMap::new(), now);
        assert_eq!(snap["live"], false);
        assert_eq!(snap["agents"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn at_most_four_agents_are_listed() {
        let entries: Vec<_> = (0..6)
            .map(|i| {
                entry(
                    &format!("claude_code_{i}"),
                    STATUS_RUNNING,
                    &format!("t{i}"),
                    i,
                )
            })
            .collect();
        let snap = snapshot(&entries, &HashMap::new(), 100);
        assert_eq!(snap["working"], 6);
        assert_eq!(snap["agents"].as_array().unwrap().len(), MAX_AGENTS);
    }

    #[test]
    fn an_iphone_needs_an_activity_token_and_an_android_phone_does_not() {
        let mut iphone = Device::default();
        assert!(!apply(&mut iphone, true, "", "production"));
        assert!(!iphone.live_updates);
        assert!(apply(&mut iphone, true, "abcd12", "sandbox"));
        assert_eq!(iphone.live_token, "abcd12");
        assert!(iphone.live_updates);
        assert!(apply(&mut iphone, false, "", ""));
        assert!(!iphone.live_updates && iphone.live_token.is_empty());

        let mut android = Device {
            push_platform: PUSH_PLATFORM_FCM.to_string(),
            ..Default::default()
        };
        assert!(apply(&mut android, true, "", ""));
        assert!(android.live_updates && android.live_token.is_empty());
    }
}
