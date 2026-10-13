//! `labelRefreshOnChange`: a file watcher on each local project whose labels
//! ask for it, so an edit, a commit or a checkout runs the action's `$(…)`
//! commands again. Events only mark the folder changed; the label ticker
//! (label_probes.rs) flushes a folder once it has been quiet for a moment, so a
//! save that touches many files reruns each command once.

use crate::label_probes;
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

const QUIET: Duration = Duration::from_millis(500);
const STALE: Duration = Duration::from_secs(600);

struct Folder {
    _watcher: RecommendedWatcher,
    owners: HashSet<(String, String)>,
    seen: Instant,
}

fn folders() -> &'static Mutex<HashMap<String, Folder>> {
    static FOLDERS: OnceLock<Mutex<HashMap<String, Folder>>> = OnceLock::new();
    FOLDERS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Folders with a change not acted on yet, and when the latest event came.
fn changed() -> &'static Mutex<HashMap<String, Instant>> {
    static CHANGED: OnceLock<Mutex<HashMap<String, Instant>>> = OnceLock::new();
    CHANGED.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Keeps `root` watched for `action`'s labels. A folder that can't be watched
/// is left to the action's `labelRefresh` interval.
pub fn watch(project: &str, action: &str, root: &str) {
    if root.is_empty() {
        return;
    }
    let root = crate::git::watch_root(root.to_string());
    let owner = (project.to_string(), action.to_string());
    let mut folders = folders().lock().unwrap();
    if let Some(folder) = folders.get_mut(&root) {
        folder.owners.insert(owner);
        folder.seen = Instant::now();
        return;
    }
    let Some(watcher) = start(&root) else {
        return;
    };
    folders.insert(
        root,
        Folder {
            _watcher: watcher,
            owners: HashSet::from([owner]),
            seen: Instant::now(),
        },
    );
}

fn start(root: &str) -> Option<RecommendedWatcher> {
    let key = root.to_string();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        let Ok(ev) = res else {
            return;
        };
        if crate::watchfilter::is_read_only(&ev) {
            return;
        }
        let relevant = ev
            .paths
            .iter()
            .any(|p| !crate::git::should_ignore(&key, &p.to_string_lossy()));
        if relevant {
            changed()
                .lock()
                .unwrap()
                .insert(key.clone(), Instant::now());
        }
    })
    .ok()?;
    watcher
        .watch(std::path::Path::new(root), RecursiveMode::Recursive)
        .ok()?;
    Some(watcher)
}

/// Runs the commands of every action watching a folder that changed and has
/// since been quiet. A command that ran a moment ago keeps its folder marked,
/// so the change is picked up on a later tick rather than lost.
pub(crate) fn flush() {
    let quiet: Vec<String> = changed()
        .lock()
        .unwrap()
        .iter()
        .filter(|(_, at)| at.elapsed() >= QUIET)
        .map(|(root, _)| root.clone())
        .collect();
    let mut folders = folders().lock().unwrap();
    folders.retain(|_, f| f.seen.elapsed() < STALE);
    for root in quiet {
        let settled = match folders.get(&root) {
            Some(folder) => folder.owners.iter().fold(true, |all, (project, action)| {
                label_probes::refresh_for_change(project, action) && all
            }),
            None => true,
        };
        if settled {
            changed().lock().unwrap().remove(&root);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_edit_marks_the_folder_and_a_build_folder_does_not() {
        let dir = tempfile::tempdir().unwrap();
        let root = crate::git::watch_root(dir.path().to_string_lossy().into_owned());
        std::fs::create_dir_all(dir.path().join("node_modules")).unwrap();
        watch("watch-test", "todos", &root);
        assert!(folders().lock().unwrap().contains_key(&root));
        std::thread::sleep(Duration::from_millis(300));

        std::fs::write(dir.path().join("node_modules").join("dep.js"), "x").unwrap();
        std::thread::sleep(Duration::from_millis(1500));
        assert!(!changed().lock().unwrap().contains_key(&root));

        std::fs::write(dir.path().join("cart.js"), "// TODO").unwrap();
        let end = Instant::now() + Duration::from_secs(5);
        while !changed().lock().unwrap().contains_key(&root) && Instant::now() < end {
            std::thread::sleep(Duration::from_millis(50));
        }
        assert!(changed().lock().unwrap().contains_key(&root));
    }
}
