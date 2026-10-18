//! Saves to a paired machine's file that an editor here opened as a copy
//! (peeropen.rs). Each save goes back to the host, written only while the
//! host's file still holds what the copy started from, so an edit made there in
//! between is never overwritten: the copy then stops sending and says why.
//! A host that takes whole files gets any file, in pieces (hostfilesave.rs); an
//! older one only text a single write can carry, and any other copy stays
//! read-only.

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
/// The host checks and swaps in a file of up to an upload's size.
const SAVE_TIMEOUT: Duration = Duration::from_secs(120);

/// What the host's file holds as far as this Mac knows, in the terms its
/// channel compares: the text itself, or the SHA-256 of a file sent whole.
type Held = String;

/// How saves reach the host.
struct Channel {
    /// What the copy holds now. Fails for a copy this channel can't carry.
    read: Box<dyn Fn(&Path) -> Result<Held, String> + Send>,
    /// Sends the copy, which holds `now`; the host writes it only while its file
    /// still holds `expected`. Answers with what the host's file holds after, or
    /// None when it no longer held `expected`.
    send: Box<dyn Fn(&Held, &Path, &Held) -> Result<Option<Held>, String> + Send>,
}

/// Says a save didn't reach the host: `(error, conflict)`.
type Report = Box<dyn Fn(&str, bool) + Send>;

struct Sync {
    /// Dropping it stops the watch, which ends the worker with it.
    _watcher: notify::RecommendedWatcher,
    /// The copy's start, then each save that reached the host.
    baseline: Arc<Mutex<Held>>,
}

fn syncs() -> &'static Mutex<HashMap<PathBuf, Sync>> {
    static SYNCS: OnceLock<Mutex<HashMap<PathBuf, Sync>>> = OnceLock::new();
    SYNCS.get_or_init(Default::default)
}

fn read_text(copy: &Path) -> Result<String, String> {
    let bytes = std::fs::read(copy).map_err(|e| e.to_string())?;
    if bytes.len() > crate::files::READ_FILE_MAX_BYTES {
        return Err("too large to send back as one write".into());
    }
    String::from_utf8(bytes).map_err(|_| "not text".to_string())
}

/// Any file, sent whole in pieces and swapped in on the host.
fn whole_file(hub: PeerClientHub, slug: String, host_path: String) -> Channel {
    Channel {
        read: Box::new(|copy| crate::hostfilesave::sha256_file(copy).map_err(|e| e.to_string())),
        send: Box::new(move |expected, copy, _now| {
            let name = copy
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default();
            let finish =
                json!({ "t": "uploadSave", "path": host_path, "expectedSha256": expected });
            let saved = crate::peeruploadrun::send_in_pieces(
                &hub,
                &slug,
                copy,
                &name,
                finish,
                SAVE_TIMEOUT,
                |_, _| {},
            )?;
            let written = saved.get("written").and_then(Value::as_bool) == Some(true);
            let held = saved
                .get("sha256")
                .and_then(Value::as_str)
                .unwrap_or_default();
            Ok(written.then(|| held.to_string()))
        }),
    }
}

/// Text, in one write, for a host too old to take a file whole.
fn one_write(hub: PeerClientHub, slug: String, host_path: String) -> Channel {
    Channel {
        read: Box::new(read_text),
        send: Box::new(move |expected, _copy, now| {
            let args = json!({ "absPath": host_path, "expectedContent": expected, "content": now });
            let result = hub.invoke_blocking(&slug, "write_file_if_unchanged", args)?;
            let written = result.get("written").and_then(Value::as_bool) == Some(true);
            Ok(written.then(|| now.clone()))
        }),
    }
}

/// Carry saves to `copy` back to `host_path` on the machine `slug`, and make the
/// copy writable. Fails for a copy the host can't take back, which stays
/// read-only. Opening the same file again starts from its new copy.
pub(crate) fn watch(
    app: &AppHandle,
    hub: &PeerClientHub,
    slug: &str,
    host_path: &str,
    host_name: &str,
    copy: &Path,
) -> Result<(), String> {
    let (to, at) = (slug.to_string(), host_path.to_string());
    let channel = if hub.supports_file_save(slug) {
        whole_file(hub.clone(), to, at)
    } else {
        one_write(hub.clone(), to, at)
    };
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
    start(copy, channel, report)
}

fn start(copy: &Path, channel: Channel, report: Report) -> Result<(), String> {
    let held = (channel.read)(copy)?;
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
    let baseline = Arc::new(Mutex::new(held));
    let (copy_path, worker_baseline) = (copy.to_path_buf(), baseline.clone());
    std::thread::spawn(move || send_saves(saves, &copy_path, &worker_baseline, &channel, &report));
    // A sync left from an earlier opening goes, and its worker with it.
    syncs().lock().unwrap().insert(
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
    baseline: &Arc<Mutex<Held>>,
    channel: &Channel,
    report: &Report,
) {
    while saves.recv().is_ok() {
        while saves.recv_timeout(SETTLE).is_ok() {}
        if !is_current(copy, baseline) {
            return;
        }
        let Ok(now) = (channel.read)(copy) else {
            continue;
        };
        let expected = baseline.lock().unwrap().clone();
        if now == expected {
            continue;
        }
        match (channel.send)(&expected, copy, &now) {
            Ok(Some(held)) => *baseline.lock().unwrap() = held,
            Ok(None) => {
                report("it changed there since it was opened", true);
                stop(copy, baseline);
                return;
            }
            Err(e) => report(&e, false),
        }
    }
}

/// Whether `baseline` is still the copy's: opening the file again replaces it.
fn is_current(copy: &Path, baseline: &Arc<Mutex<Held>>) -> bool {
    owns(&syncs().lock().unwrap(), copy, baseline)
}

fn owns(syncs: &HashMap<PathBuf, Sync>, copy: &Path, baseline: &Arc<Mutex<Held>>) -> bool {
    syncs
        .get(copy)
        .is_some_and(|s| Arc::ptr_eq(&s.baseline, baseline))
}

/// Stop sending a copy's saves and make it read-only again, so the editor says
/// so on the next save rather than dropping it. Only while `baseline` is still
/// the copy's.
fn stop(copy: &Path, baseline: &Arc<Mutex<Held>>) {
    let mut syncs = syncs().lock().unwrap();
    if owns(&syncs, copy, baseline) {
        syncs.remove(copy);
        let _ = crate::peercopy::set_writable(copy, false);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_older_host_only_takes_text_one_write_can_carry() {
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

    /// A host that takes files whole, holding its file's bytes.
    fn whole_file_host(initial: &[u8]) -> (Arc<Mutex<Vec<u8>>>, Channel) {
        let file = Arc::new(Mutex::new(initial.to_vec()));
        let held = file.clone();
        let hash = |bytes: &[u8]| {
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join("f");
            std::fs::write(&path, bytes).unwrap();
            crate::hostfilesave::sha256_file(&path).unwrap()
        };
        let channel = Channel {
            read: Box::new(|copy| {
                crate::hostfilesave::sha256_file(copy).map_err(|e| e.to_string())
            }),
            send: Box::new(move |expected, copy, _now| {
                let mut on_host = held.lock().unwrap();
                if hash(&on_host) != *expected {
                    return Ok(None);
                }
                *on_host = std::fs::read(copy).map_err(|e| e.to_string())?;
                Ok(Some(hash(&on_host)))
            }),
        };
        (file, channel)
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

    fn conflicts() -> (Arc<Mutex<Vec<String>>>, Report) {
        let seen = Arc::new(Mutex::new(Vec::<String>::new()));
        let log = seen.clone();
        let report: Report = Box::new(move |error, conflict| {
            if conflict {
                log.lock().unwrap().push(error.to_string());
            }
        });
        (seen, report)
    }

    #[test]
    fn each_save_reaches_the_host_and_a_change_there_stops_it() {
        let dir = tempfile::tempdir().unwrap();
        let copy = dir.path().join("logo.png");
        std::fs::write(&copy, [0x89, 0x50, 0x00]).unwrap();
        let (file, channel) = whole_file_host(&[0x89, 0x50, 0x00]);
        let (conflicts, report) = conflicts();
        start(&copy, channel, report).unwrap();

        std::fs::write(&copy, [0x89, 0x50, 0x00, 0xff]).unwrap();
        wait_for("the first save", || {
            *file.lock().unwrap() == [0x89, 0x50, 0x00, 0xff]
        });

        // An editor that saves by renaming a fresh file into place.
        let fresh = dir.path().join("logo.png.tmp");
        std::fs::write(&fresh, [0x01, 0x02]).unwrap();
        std::fs::rename(&fresh, &copy).unwrap();
        wait_for("the renamed save", || *file.lock().unwrap() == [0x01, 0x02]);

        *file.lock().unwrap() = b"edited on the host".to_vec();
        std::fs::write(&copy, b"edited here").unwrap();
        wait_for("the conflict", || !conflicts.lock().unwrap().is_empty());
        assert_eq!(*file.lock().unwrap(), b"edited on the host");
        assert!(!syncs().lock().unwrap().contains_key(&copy));
    }

    #[test]
    fn opening_the_file_again_starts_from_the_new_copy() {
        let dir = tempfile::tempdir().unwrap();
        let copy = dir.path().join("notes.md");
        std::fs::write(&copy, "one\n").unwrap();
        let (first, channel) = whole_file_host(b"one\n");
        start(&copy, channel, conflicts().1).unwrap();
        let earlier = syncs().lock().unwrap()[&copy].baseline.clone();

        std::fs::write(&copy, "two\n").unwrap();
        let (second, channel) = whole_file_host(b"two\n");
        start(&copy, channel, conflicts().1).unwrap();
        // The earlier opening's worker, ending in a conflict, leaves this one be.
        stop(&copy, &earlier);
        assert!(syncs().lock().unwrap().contains_key(&copy));

        std::fs::write(&copy, "three\n").unwrap();
        wait_for("the save", || *second.lock().unwrap() == b"three\n");
        assert_ne!(*first.lock().unwrap(), b"three\n");
    }
}
