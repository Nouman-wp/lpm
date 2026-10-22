// Which update lpm just came back from. The version that last ran is kept, and
// a different one at launch is an update — whoever started it: this window,
// `lpm update`, the idle setting, a phone or a paired Mac, or a downloaded
// installer.
use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct UpdateNote {
    pub from: String,
    pub to: String,
}

fn path() -> PathBuf {
    crate::config::lpm_dir().join("last-version")
}

#[tauri::command(async)]
pub fn take_update_note() -> Option<UpdateNote> {
    let to = crate::updates::current_version();
    if to == "dev" {
        return None;
    }
    let from = std::fs::read_to_string(path()).unwrap_or_default();
    let from = from.trim();
    if from == to {
        return None;
    }
    let _ = std::fs::write(path(), &to);
    (!from.is_empty()).then(|| UpdateNote {
        from: from.to_string(),
        to,
    })
}
