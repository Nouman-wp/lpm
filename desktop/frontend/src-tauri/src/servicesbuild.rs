// Which lpm build the services run on. The session daemon outlives an app
// update on purpose — that is what keeps services up through one — so after an
// update it is still the build from before, until its last service stops (it
// retires then) or the services are restarted onto this one.
use crate::services::ServiceState;
use crate::sessionclient as client;
use crate::sessionproto::Request;
use serde::Serialize;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize, Clone, Debug, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ServicesBuild {
    /// Some project has services in the daemon.
    pub running: bool,
    /// The build the daemon runs; empty for one from before daemons said.
    pub version: String,
    /// The daemon runs this app's build, or there is none to be behind.
    pub current: bool,
}

#[tauri::command(async)]
pub fn services_build() -> ServicesBuild {
    build_of(
        client::query(&Request::Version),
        &crate::updates::current_version(),
        || !crate::sessions::running_sessions().is_empty(),
    )
}

/// `old_running` asks a daemon from before `Version` whether it holds anything.
fn build_of(
    reply: Result<crate::sessionproto::Response, String>,
    app: &str,
    old_running: impl FnOnce() -> bool,
) -> ServicesBuild {
    match reply {
        Ok(reply) => {
            let version = reply.version.unwrap_or_default();
            let running = reply.sessions.is_some_and(|s| !s.is_empty());
            ServicesBuild {
                running,
                current: !running || version == app,
                version,
            }
        }
        Err(error) if error == client::NO_REPLY => {
            let running = old_running();
            ServicesBuild {
                running,
                current: !running,
                ..Default::default()
            }
        }
        Err(_) => ServicesBuild {
            current: true,
            ..Default::default()
        },
    }
}

#[tauri::command(async)]
pub fn restart_services(app: AppHandle, state: State<'_, ServiceState>) -> Result<(), String> {
    restart(&app, &state)
}

/// Stop every service, retire the daemon, and start the same services again
/// under a daemon of this build. A session no project claims can't be started
/// again and stays stopped.
pub fn restart(app: &AppHandle, state: &State<'_, ServiceState>) -> Result<(), String> {
    let running = running_services();
    crate::sessions::shutdown_daemon()?;
    crate::sessiond::wait_retired(Duration::from_secs(10));
    let failures: Vec<String> = running
        .into_iter()
        .filter_map(|(name, services)| {
            crate::services::start_project_with_services(
                app.clone(),
                state.clone(),
                name.clone(),
                services,
            )
            .err()
            .map(|e| format!("{name}: {e}"))
        })
        .collect();
    let _ = app.emit("projects-changed", ());
    if failures.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "Some services didn't start again — {}",
            failures.join("; ")
        ))
    }
}

/// Each project with a live session, and its services still running there.
fn running_services() -> Vec<(String, Vec<String>)> {
    let live = crate::sessions::running_sessions();
    crate::config::project_names()
        .into_iter()
        .filter_map(|name| {
            let info = crate::config::spawn_info(&name).ok()?;
            if !live.contains(&info.session) {
                return None;
            }
            let services: Vec<String> = crate::sessions::panes_of(&info.session)
                .into_iter()
                .filter(|pane| !pane.ended && info.services.contains_key(&pane.service))
                .map(|pane| pane.service)
                .collect();
            (!services.is_empty()).then_some((name, services))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sessionproto::Response;

    fn reply(version: &str, sessions: &[&str]) -> Result<Response, String> {
        Ok(Response {
            version: Some(version.into()),
            sessions: Some(sessions.iter().map(|s| s.to_string()).collect()),
            ..Response::ok()
        })
    }

    #[test]
    fn a_daemon_on_this_build_is_current() {
        let build = build_of(reply("0.7.32", &["web"]), "0.7.32", || unreachable!());
        assert!(build.running && build.current);
    }

    #[test]
    fn a_daemon_on_another_build_is_behind() {
        let build = build_of(reply("0.7.31", &["web"]), "0.7.32", || unreachable!());
        assert!(build.running && !build.current);
        assert_eq!(build.version, "0.7.31");
    }

    #[test]
    fn an_older_daemon_with_nothing_running_is_nothing_to_restart() {
        let build = build_of(reply("0.7.31", &[]), "0.7.32", || unreachable!());
        assert!(!build.running && build.current);
    }

    #[test]
    fn a_daemon_from_before_versions_is_behind() {
        let build = build_of(Err(client::NO_REPLY.into()), "0.7.32", || true);
        assert!(build.running && !build.current);
        assert_eq!(build.version, "");
    }

    #[test]
    fn the_daemon_reports_the_build_it_runs() {
        let reply = client::command(&Request::Version).unwrap();
        assert_eq!(reply.version, Some(crate::updates::current_version()));
        assert!(reply.sessions.is_some());
    }

    #[test]
    fn the_daemon_answers_an_op_it_does_not_know() {
        client::command(&Request::Sessions).unwrap();
        let stream = crate::ipc::UnixStream::connect(crate::sessiond::socket_path()).unwrap();
        let mut writer = stream.try_clone().unwrap();
        std::io::Write::write_all(&mut writer, b"{\"op\":\"from_the_future\"}\n").unwrap();
        let mut reader = std::io::BufReader::new(stream);
        let reply: Response = crate::sessionproto::read_line(&mut reader).unwrap();
        assert!(!reply.ok);
    }

    #[test]
    fn no_daemon_has_nothing_to_restart() {
        let build = build_of(Err(client::NO_DAEMON.into()), "0.7.32", || unreachable!());
        assert!(!build.running && build.current);
    }
}
