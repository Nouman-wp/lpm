// A command printed in a terminal — an agent's "run `npm install`" — run in its
// project's folder from the terminal's Run button. It streams like a quick
// action ("action-output", then "action-done") so the same result card shows
// it. Each run keeps its pid under its run id so the card can stop it: a dev
// server started this way would otherwise run on with nothing showing it.
use crate::actions::{self, ActionDone, ActionOutput, ActionPlan};
use crate::{config, proctree};
use std::collections::{BTreeMap, HashMap};
use std::process::Stdio;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

pub const STOPPED_ERR: &str = "stopped";

fn running() -> &'static Mutex<HashMap<String, i32>> {
    static RUNS: OnceLock<Mutex<HashMap<String, i32>>> = OnceLock::new();
    RUNS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn command_plan(project_name: &str, cmd: &str) -> Result<ActionPlan, String> {
    let info = config::spawn_info(project_name)?;
    if info.is_remote {
        return Ok(ActionPlan {
            cmd_str: config::ssh_command_line(&info.ssh, "", &BTreeMap::new(), cmd),
            cwd: info.root,
            ports: Vec::new(),
            login_shell: false,
            claude_env: config::ClaudeEnv::Inherit,
            on_exit: None,
        });
    }
    Ok(ActionPlan {
        cmd_str: cmd.to_string(),
        cwd: info.root,
        ports: Vec::new(),
        login_shell: true,
        claude_env: crate::claude_pool::spawn_env(project_name, None, true).env,
        on_exit: None,
    })
}

#[tauri::command(async)]
pub fn run_command(
    app: AppHandle,
    project_name: String,
    cmd: String,
    run_id: String,
) -> Result<(), String> {
    let cmd = cmd.trim();
    if cmd.is_empty() {
        return Err("nothing to run".into());
    }
    if run_id.is_empty() {
        return Err("a run needs an id".into());
    }
    let plan = command_plan(&project_name, cmd)?;
    let mut command = actions::action_command(&plan);
    command.stdin(Stdio::null());
    // Its own session, as a background action's: stop signals the whole tree,
    // and a login shell launched from a terminal can't stop itself on SIGTTIN.
    #[cfg(unix)]
    crate::osproc::detach(&mut command);
    let (mut child, stdout) = actions::spawn_merged(command)?;
    running()
        .lock()
        .unwrap()
        .insert(run_id.clone(), child.id() as i32);

    let login_shell = plan.login_shell;
    std::thread::spawn(move || {
        for line in actions::output_lines(stdout, login_shell) {
            let Ok(line) = line else { break };
            let _ = app.emit(
                "action-output",
                ActionOutput {
                    run_id: run_id.clone(),
                    line,
                },
            );
        }
        let status = child.wait().ok();
        let stopped = running().lock().unwrap().remove(&run_id).is_none();
        let success = !stopped && status.map(|s| s.success()).unwrap_or(false);
        let error = if stopped {
            STOPPED_ERR.to_string()
        } else if success {
            String::new()
        } else {
            actions::exit_status_string(status)
        };
        let _ = app.emit(
            "action-done",
            ActionDone {
                run_id,
                success,
                error,
            },
        );
    });
    Ok(())
}

/// `project_name` routes the call to the computer the run is on.
#[tauri::command]
pub fn stop_command(project_name: String, run_id: String) -> Result<(), String> {
    let _ = project_name;
    match running().lock().unwrap().remove(&run_id) {
        Some(pid) if pid > 0 => proctree::kill_tree_async(pid),
        _ => {}
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stopping_an_unknown_run_is_a_no_op() {
        assert!(stop_command(String::new(), "missing".into()).is_ok());
    }

    #[test]
    fn a_stopped_run_leaves_the_registry() {
        running().lock().unwrap().insert("r1".into(), 0);
        stop_command(String::new(), "r1".into()).unwrap();
        assert!(!running().lock().unwrap().contains_key("r1"));
    }
}
