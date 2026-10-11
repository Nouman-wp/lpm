// Where an automation's results are sent. "lpm" is the app itself — its toast,
// system notification and phone push; every other destination is an outside
// service that gets the run's report as a message. Adding one is a module that
// implements `Destination` plus an entry in `EXTERNAL`.
//
// A destination id is a service ("telegram") or one of its targets
// ("telegram:releases"); the bare service means its default target.

use serde_json::json;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

pub const LPM: &str = "lpm";

/// What a destination is handed for one run.
pub struct Report {
    /// A glyph for how the run ended, for destinations that lead with one.
    pub mark: &'static str,
    /// One line naming the job and how the run ended.
    pub title: String,
    /// What the run reported, when it said anything.
    pub body: Option<String>,
}

pub trait Destination: Sync {
    fn id(&self) -> &'static str;
    fn label(&self) -> &'static str;
    /// `target` names one of the service's targets; None is its default.
    fn send(&self, target: Option<&str>, report: &Report) -> Result<(), String>;
}

static EXTERNAL: &[&dyn Destination] = &[&crate::telegram::Telegram];

/// "telegram:releases" → ("telegram", Some("releases")).
fn split(id: &str) -> (&str, Option<&str>) {
    match id.split_once(':') {
        Some((service, target)) => (service, Some(target)),
        None => (id, None),
    }
}

fn external(service: &str) -> Option<&'static dyn Destination> {
    EXTERNAL.iter().copied().find(|d| d.id() == service)
}

/// Whether lpm can send to `id` at all. A target is only checked for shape
/// here: whether it's still connected is for the send to find out.
pub fn is_known(id: &str) -> bool {
    match split(id) {
        (LPM, None) => true,
        (service, target) => {
            external(service).is_some() && target.map_or(true, |t| !t.is_empty())
        }
    }
}

/// Hands the report to each outside destination in `ids`, each on its own
/// thread: a slow or unreachable service never holds up the scheduler or the
/// other destinations. A failed send is said in lpm, since the message it
/// carried would otherwise vanish without a word.
pub fn deliver(app: &AppHandle, ids: &[String], report: Report) {
    let report = Arc::new(report);
    for id in ids {
        let (service, target) = split(id);
        let Some(dest) = external(service) else {
            continue;
        };
        let target = target.map(str::to_string);
        let report = Arc::clone(&report);
        let app = app.clone();
        std::thread::spawn(move || {
            if let Err(error) = dest.send(target.as_deref(), &report) {
                let _ = app.emit(
                    "send-to-failed",
                    json!({ "destination": dest.label(), "title": report.title, "error": error }),
                );
                if crate::statusnotify::should_notify(&app) {
                    crate::statusnotify::notify(
                        &app,
                        &format!("Couldn't send to {}", dest.label()),
                        &format!("{} {error}", report.title),
                    );
                }
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn knows_services_and_their_targets() {
        assert!(is_known("lpm"));
        assert!(is_known("telegram"));
        assert!(is_known("telegram:releases"));
        assert!(!is_known("telegram:"));
        assert!(!is_known("lpm:phone"));
        assert!(!is_known("fax"));
        assert!(!is_known("fax:office"));
    }
}
