// `lpm automations open` brings the app forward on one automation's page:
//
//   open_job <id> [project]  → {ok}
//
// With a project it opens in that project's Automations tab, on that project's
// runs; without one it is the global.yml automation, on the app-wide page.

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};

fn failure(error: impl Into<String>) -> String {
    json!({ "ok": false, "error": error.into() }).to_string()
}

pub fn cmd_open_job(args: &[String], app: &AppHandle) -> String {
    let (positional, _) = crate::socketsrv::parse_options(args);
    let [id, rest @ ..] = positional.as_slice() else {
        return failure("usage: open_job <id> [project]");
    };
    let project = rest.first();
    if crate::sys::headless() {
        return failure("There's no app window on this machine to open it in.");
    }
    let found = match project {
        Some(project) => crate::socketsrv::ensure_job_exists(project, id),
        None => crate::jobs::read_job_yaml(String::new(), "global".into(), id.clone()).map(|_| ()),
    };
    if let Err(error) = found {
        return failure(error);
    }
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
    let _ = app.emit("open-automation", json!({ "id": id, "project": project }));
    json!({ "ok": true }).to_string()
}
