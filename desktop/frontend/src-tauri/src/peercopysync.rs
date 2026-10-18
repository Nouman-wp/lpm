//! Saves to a paired machine's file that an editor here opened as a copy
//! (peeropen.rs). Each save goes back to the host, written only while the
//! host's file still holds what the copy started from, so an edit made there in
//! between is never overwritten: the copy then stops sending and says why.
//! Only text a single write can carry is kept in step; anything else stays a
//! read-only copy.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use notify::{RecursiveMode, Watcher};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use crate::peerclient::PeerClientHub;

/// An editor's save can be several writes, or a write then a rename; one quiet
/// spell after them is one save.
const SETTLE: Duration = Duration::from_millis(400);
/// Emitted with `{ name, host, error, conflict }` when a save didn't reach the host.
const NOT_SAVED_EVENT: &str = "peer-file-not-saved";

struct Sync {
    /// Dropping it stops the watch, which ends the worker with it.
    _watcher: notify::RecommendedWatcher,
    /// What the host's file holds as far as this Mac knows: the copy's start,
    /// then each save that reached it.
    baseline: Arc<Mutex<String>>,
}

fn syncs() -> &'static Mutex<HashMap<PathBuf, Sync>> {
    static SYNCS: OnceLock<Mutex<HashMap<PathBuf, Sync>>> = OnceLock::new();
    SYNCS.get_or_init(Default::default)
}

/// Sends a save: `(expected, content)` → whether the host wrote it, which it
/// doesn't when its file no longer holds `expected`.
type Send = Box<dyn Fn(&str, &str) -> Result<bool, String> + std::marker::Send>;
/// Says a save didn't reach the host: `(error, conflict)`.
type Report = Box<dyn Fn(&str, bool) + std::marker::Send>;

fn read_text(copy: &Path) -> Result<String, String> {
    let bytes = std::fs::read(copy).map_err(|e| e.to_string())?;
    if bytes.len() > crate::files::READ_FILE_MAX_BYTES {
        return Err("too large to send back as one write".into());
    }
    String::from_utf8(bytes).map_err(|_| "not text".to_string())
}

/// Carry saves to `copy` back to `host_path` on the machine `slug`, and make the
/// copy writable. Fails for a copy that isn't text a single write can carry,
/// which stays read-only. Opening the same file again starts from its new copy.
pub(crate) fn watch(
    app: &AppHandle,
    hub: &PeerClientHub,
    slug: &str,
    host_path: &str,
    host_name: &str,
    copy: &Path,
) -> Result<(), String> {
    let (hub, slug, host_path) = (hub.clone(), slug.to_string(), host_path.to_string());
    let send: Send = Box::new(move |expected, content| {
        let args = json!({ "absPath": host_path, "expectedContent": expected, "content": content });
        let result = hub.invoke_blocking(&slug, "write_file_if_unchanged", args)?;
        Ok(result.get("written").and_then(Value::as_bool) == Some(true))
    });
    let (app, host_name) = (app.clone(), host_name.to_string());
    let name = copy
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    let report: Report = Box::new(move |error, conflict| {
        let _ = app.emit(
            NOT_SAVED_EVENT,
            json!({ "name": name, "host": host_name, "error": error, "conflict": conflict }),
        );
    });
    start(copy, send, report)
}

fn start(copy: &Path, send: Send, report: Report) -> Result<(), String> {
    let text = read_text(copy)?;
    let mut syncs = syncs().lock().unwrap();
    if let Some(sync) = syncs.get(copy) {
        *sync.baseline.lock().unwrap() = text;
        return crate::peercopy::set_writable(copy, true);
    }
    let name = copy.file_name().ok_or("bad copy path")?.to_owned();
    let dir = copy.parent().ok_or("bad copy path")?;
    let (saved, saves) = mpsc::channel::<()>();
    // The folder, not the file: an editor that saves by renaming a new file into
    // place leaves a watch on the old one looking at nothing.
    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        if event.is_ok_and(|e| {
            e.paths
                .iter()
                .any(|p| p.file_name() == Some(name.as_os_str()))
        }) {
            let _ = saved.send(());
        }
    })
    .map_err(|e| e.to_string())?;
    watcher
        .watch(dir, RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;
    crate::peercopy::set_writable(copy, true)?;
    let baseline = Arc::new(Mutex::new(text));
    let (copy_path, worker_baseline) = (copy.to_path_buf(), baseline.clone());
    std::thread::spawn(move || send_saves(saves, &copy_path, &worker_baseline, &send, &report));
    syncs.insert(
        copy.to_path_buf(),
        Sync {
            _watcher: watcher,
            baseline,
        },
    );
    Ok(())
}

fn send_saves(
    saves: Receiver<()>,
    copy: &Path,
    baseline: &Mutex<String>,
    send: &Send,
    report: &Report,
) {
    while saves.recv().is_ok() {
        while saves.recv_timeout(SETTLE).is_ok() {}
        let Ok(content) = read_text(copy) else {
            continue;
        };
        let expected = baseline.lock().unwrap().clone();
        if content == expected {
            continue;
        }
        match send(&expected, &content) {
            Ok(true) => *baseline.lock().unwrap() = content,
            Ok(false) => {
                report("it changed there since it was opened", true);
                stop(copy);
                return;
            }
            Err(e) => report(&e, false),
        }
    }
}

/// Stop sending a copy's saves and make it read-only again, so the editor says
/// so on the next save rather than dropping it.
fn stop(copy: &Path) {
    syncs().lock().unwrap().remove(copy);
    let _ = crate::peercopy::set_writable(copy, false);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_text_one_write_can_carry_is_kept_in_step() {
        let dir = tempfile::tempdir().unwrap();
        let text = dir.path().join("a.ts");
        std::fs::write(&text, "export const a = 1;\n").unwrap();
        assert_eq!(read_text(&text).unwrap(), "export const a = 1;\n");

        let binary = dir.path().join("logo.bin");
        std::fs::write(&binary, [0xff, 0xfe, 0x00, 0x9f]).unwrap();
        assert_eq!(read_text(&binary), Err("not text".into()));

        let big = dir.path().join("big.txt");
        std::fs::write(&big, "x".repeat(crate::files::READ_FILE_MAX_BYTES + 1)).unwrap();
        assert!(read_text(&big).is_err());
    }

    /// The host's file, as a fake host holds it.
    fn host(initial: &str) -> Arc<Mutex<String>> {
        Arc::new(Mutex::new(initial.to_string()))
    }

    fn sender(file: &Arc<Mutex<String>>) -> Send {
        let file = file.clone();
        Box::new(move |expected, content| {
            let mut held = file.lock().unwrap();
            if *held != expected {
                return Ok(false);
            }
            *held = content.to_string();
            Ok(true)
        })
    }

    fn wait_for(what: &str, done: impl Fn() -> bool) {
        for _ in 0..50 {
            if done() {
                return;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        panic!("timed out waiting for {what}");
    }

    #[test]
    fn each_save_reaches_the_host_and_a_change_there_stops_it() {
        let dir = tempfile::tempdir().unwrap();
        let copy = dir.path().join("notes.md");
        std::fs::write(&copy, "one\n").unwrap();
        let file = host("one\n");
        let conflicts = Arc::new(Mutex::new(Vec::<String>::new()));
        let seen = conflicts.clone();
        let report: Report = Box::new(move |error, conflict| {
            if conflict {
                seen.lock().unwrap().push(error.to_string());
            }
        });
        start(&copy, sender(&file), report).unwrap();

        std::fs::write(&copy, "one\ntwo\n").unwrap();
        wait_for("the first save", || *file.lock().unwrap() == "one\ntwo\n");

        // An editor that saves by renaming a fresh file into place.
        let fresh = dir.path().join("notes.md.tmp");
        std::fs::write(&fresh, "one\ntwo\nthree\n").unwrap();
        std::fs::rename(&fresh, &copy).unwrap();
        wait_for("the renamed save", || {
            *file.lock().unwrap() == "one\ntwo\nthree\n"
        });

        *file.lock().unwrap() = "edited on the host\n".to_string();
        std::fs::write(&copy, "edited here\n").unwrap();
        wait_for("the conflict", || !conflicts.lock().unwrap().is_empty());
        assert_eq!(*file.lock().unwrap(), "edited on the host\n");
        assert!(!syncs().lock().unwrap().contains_key(&copy));
    }
}
