// The tunnels each remote project has open, kept in ~/.lpm/port-forwards.json
// so they come back with the app. A project's services outlive the app in the
// session daemon, but its tunnels are ssh children of the app and end with it:
// without this record a relaunch finds the dev server still running and the
// port the user forwarded to it gone.
use crate::portforward::PortForward;
use std::collections::BTreeMap;
use std::path::PathBuf;

pub type Saved = BTreeMap<String, Vec<PortForward>>;

fn path() -> PathBuf {
    crate::config::lpm_dir().join("port-forwards.json")
}

/// A missing or unreadable record reads as no tunnels: the app then starts the
/// way it did before there was one.
pub fn load() -> Saved {
    std::fs::read(path())
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

pub fn save(saved: &Saved) {
    let written = serde_json::to_vec_pretty(saved)
        .map_err(|e| e.to_string())
        .and_then(|data| {
            crate::fsatomic::write(&path(), &data, crate::fsatomic::Mode::Preserve(0o600))
                .map_err(|e| e.to_string())
        });
    if let Err(e) = written {
        eprintln!("warning: port forwards: save: {e}");
    }
}
