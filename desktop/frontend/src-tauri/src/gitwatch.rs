// Who watches which project for git changes. Each window, and each window of a
// paired Mac, keeps its own watch, so one viewer's review pane never takes the
// live refresh away from another's. Viewers of the same project share one
// watcher, and a paired Mac's watches end with its connection.
use crate::git::{spawn_watch, watch_path, ActiveWatch};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

/// The viewer a call that names none stands for: an lpm that predates owners.
const MAIN: &str = "main";

pub const START_CMD: &str = "start_watching_project";
pub const STOP_CMD: &str = "stop_watching_project";

#[derive(Default)]
pub struct WatchState {
    inner: Mutex<Watches>,
}

#[derive(Default)]
struct Watches {
    /// The project each viewer watches.
    owners: HashMap<String, String>,
    /// One watcher per project, however many viewers it has.
    active: HashMap<String, ActiveWatch>,
}

impl Watches {
    fn set(
        &mut self,
        owner: &str,
        path: String,
        spawn: impl FnOnce(&str) -> Result<ActiveWatch, String>,
    ) -> Result<(), String> {
        if self.owners.get(owner) == Some(&path) {
            return Ok(());
        }
        self.release(owner);
        if path.is_empty() {
            return Ok(());
        }
        if !self.active.contains_key(&path) {
            let watch = spawn(&path)?;
            self.active.insert(path.clone(), watch);
        }
        self.owners.insert(owner.to_string(), path);
        Ok(())
    }

    /// Stop `owner` watching `path`, or whatever it watches when no path is
    /// named. A stop for a project the owner has since left is ignored, so a
    /// stop that lands after the next start can't end it.
    fn unset(&mut self, owner: &str, path: Option<&str>) {
        if path.is_none_or(|p| self.owners.get(owner).map(String::as_str) == Some(p)) {
            self.release(owner);
        }
    }

    fn release(&mut self, owner: &str) {
        let Some(path) = self.owners.remove(owner) else {
            return;
        };
        if !self.owners.values().any(|p| *p == path) {
            self.active.remove(&path);
        }
    }

    fn release_all(&mut self, prefix: &str) {
        let gone: Vec<String> = self
            .owners
            .keys()
            .filter(|o| o.starts_with(prefix))
            .cloned()
            .collect();
        for owner in gone {
            self.release(&owner);
        }
    }
}

impl WatchState {
    fn watch(&self, app: &AppHandle, owner: &str, path: String) -> Result<(), String> {
        let path = watch_path(path);
        self.inner
            .lock()
            .unwrap()
            .set(owner, path, |p| spawn_watch(app.clone(), p))
    }

    fn unwatch(&self, owner: &str, path: Option<String>) {
        let path = path.map(watch_path);
        self.inner.lock().unwrap().unset(owner, path.as_deref());
    }

    pub fn release(&self, owner: &str) {
        self.inner.lock().unwrap().release(owner);
    }
}

#[tauri::command(async)]
pub fn start_watching_project(
    app: AppHandle,
    state: State<'_, WatchState>,
    path: String,
    owner: Option<String>,
) -> Result<(), String> {
    state.watch(&app, owner.as_deref().unwrap_or(MAIN), path)
}

#[tauri::command(async)]
pub fn stop_watching_project(
    state: State<'_, WatchState>,
    path: Option<String>,
    owner: Option<String>,
) -> Result<(), String> {
    state.unwatch(owner.as_deref().unwrap_or(MAIN), path);
    Ok(())
}

/// A paired Mac's watch calls, answered here rather than by the page so each of
/// its windows is a viewer of its own, kept apart from this Mac's windows.
pub fn serve_peer(app: &AppHandle, conn_id: u64, cmd: &str, args: &Value) -> Result<Value, String> {
    let field = |k: &str| args.get(k).and_then(Value::as_str).map(str::to_string);
    let owner = format!(
        "{}{}",
        peer_prefix(conn_id),
        field("owner").unwrap_or_else(|| MAIN.to_string())
    );
    let state = app.state::<WatchState>();
    if cmd == START_CMD {
        state.watch(app, &owner, field("path").unwrap_or_default())?;
    } else {
        state.unwatch(&owner, field("path"));
    }
    Ok(Value::Null)
}

/// End the watches of a paired Mac that disconnected.
pub fn drop_conn(app: &AppHandle, conn_id: u64) {
    let state = app.state::<WatchState>();
    state.inner.lock().unwrap().release_all(&peer_prefix(conn_id));
}

fn peer_prefix(conn_id: u64) -> String {
    format!("peer:{conn_id}:")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn idle(_: &str) -> Result<ActiveWatch, String> {
        Ok(ActiveWatch::idle())
    }

    #[test]
    fn viewers_of_one_project_share_its_watch_until_the_last_leaves() {
        let mut w = Watches::default();
        w.set("main", "/repo".into(), idle).unwrap();
        w.set("peer:1:main", "/repo".into(), |_| panic!("spawned twice")).unwrap();
        w.release("main");
        assert!(w.active.contains_key("/repo"));
        w.release("peer:1:main");
        assert!(w.active.is_empty());
    }

    #[test]
    fn a_viewer_moving_on_leaves_the_other_viewers_watch_alone() {
        let mut w = Watches::default();
        w.set("main", "/a".into(), idle).unwrap();
        w.set("peer:1:main", "/b".into(), idle).unwrap();
        w.set("peer:1:main", "/c".into(), idle).unwrap();
        assert_eq!(w.owners.get("main").map(String::as_str), Some("/a"));
        assert!(w.active.contains_key("/a") && w.active.contains_key("/c"));
        assert!(!w.active.contains_key("/b"));
    }

    #[test]
    fn a_late_stop_for_the_last_project_keeps_the_next_one() {
        let mut w = Watches::default();
        w.set("main", "/b".into(), idle).unwrap();
        w.unset("main", Some("/a"));
        assert!(w.active.contains_key("/b"));
        w.unset("main", Some("/b"));
        assert!(w.active.is_empty());
    }

    #[test]
    fn a_gone_connection_ends_only_its_own_watches() {
        let mut w = Watches::default();
        w.set("peer:1:main", "/a".into(), idle).unwrap();
        w.set("peer:1:detached:web", "/b".into(), idle).unwrap();
        w.set("peer:10:main", "/c".into(), idle).unwrap();
        w.release_all(&peer_prefix(1));
        assert_eq!(w.owners.keys().collect::<Vec<_>>(), vec!["peer:10:main"]);
        assert_eq!(w.active.len(), 1);
    }
}
