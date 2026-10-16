//! Telling everyone that lpm itself just moved a branch. The git watcher covers
//! only the project open on this machine, so a pull, merge or push run on any
//! other project — an auto pull, a tap on a phone, a click on a connected Mac —
//! went unseen here, on connected Macs and on phones until their next origin
//! check, and their ↓/↑ marks kept offering what was already done.
use serde_json::json;
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};

static APP: OnceLock<AppHandle> = OnceLock::new();

pub fn init(app: &AppHandle) {
    let _ = APP.set(app.clone());
}

/// The watcher's own `git-changed` for the project at `cwd`, as an unknown
/// change. It reaches connected Macs and phones the way the watcher's does.
pub fn announce(cwd: &str) {
    if let Some(app) = APP.get() {
        let _ = app.emit("git-changed", json!({ "path": cwd, "files": null }));
    }
}
