//! Monday's "Your week in lpm is ready", sent on to the phones that asked for
//! it when the desktop shows its own toast. Tapping it opens the phone's
//! weekly recap.
use super::{
    alert_recipients, on_screen_devices, push_collapse_id, scoped_devices, send_alerts, PushDevice,
    RemoteHub,
};
use crate::remotestore::load_config;
use serde_json::json;
use std::sync::atomic::Ordering;

fn recap_alert_payload(server_id: &str, week: &str, title: &str, body: &str, ts: i64) -> String {
    json!({
        "serverId": server_id,
        "target": "recap",
        "week": week,
        "title": title,
        "body": body,
        "ts": ts,
        "key": format!("recap:{week}"),
    })
    .to_string()
}

/// One notification per week (`week` is its Monday): sending it again replaces it.
pub(crate) fn send_weekly_recap(hub: &RemoteHub, week: &str, title: &str, body: &str) {
    if !hub.inner.enabled.load(Ordering::Relaxed) || !hub.inner.running.load(Ordering::Relaxed) {
        return;
    }
    if week.is_empty() {
        return;
    }
    let connected = on_screen_devices(hub);
    let cfg = load_config();
    let server_id = cfg.flavor_server_id();
    let recipients: Vec<PushDevice> = alert_recipients(&scoped_devices(&cfg), &connected)
        .into_iter()
        .filter(|device| device.push_weekly_recap)
        .collect();
    if recipients.is_empty() {
        return;
    }
    let plaintext = recap_alert_payload(
        &server_id,
        week,
        title,
        body,
        crate::status::now_millis(),
    );
    let collapse_id = push_collapse_id(&server_id, "", &format!("recap:{week}"));
    send_alerts(hub, cfg.effective_relay(), recipients, plaintext, collapse_id);
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[test]
    fn names_the_week_it_opens() {
        let payload: Value = serde_json::from_str(&recap_alert_payload(
            "srv",
            "2026-10-12",
            "Your week in lpm is ready",
            "31h 20m of agents working for you · Oct 12 – 18",
            7,
        ))
        .unwrap();
        assert_eq!(payload["target"], "recap");
        assert_eq!(payload["week"], "2026-10-12");
        assert_eq!(payload["key"], "recap:2026-10-12");
        assert_eq!(payload["serverId"], "srv");
        assert_eq!(payload["title"], "Your week in lpm is ready");
    }
}
