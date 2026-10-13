//! `lpm refresh-label [action] [-p project]` — run the `$(…)` commands in an
//! action's labels and emoji (and its menu items' and options') again now, or
//! every one in the project, and redraw labels built from git. For a script
//! that just changed what a label shows, such as a release tagging a version.

use crate::config::{self, Ctx};
use crate::control;
use crate::error::{resolve_or_infer, RunError};
use crate::run::{collect_run_targets, resolve_run_target};
use crate::statussock::checked_arg;

pub fn run(ctx: &Ctx, action: Option<&str>, project: Option<&str>) -> Result<(), RunError> {
    control::require_app(ctx)?;
    let file_name = resolve_or_infer(ctx, project)?;
    let mut line = format!(
        "refresh_label {}",
        checked_arg("project name", &file_name).map_err(RunError::NotFound)?
    );
    let target = match action {
        Some(query) => {
            let p = config::resolve_project(ctx, &file_name).map_err(RunError::Internal)?;
            let id =
                resolve_run_target(&collect_run_targets(&p), query).map_err(RunError::NotFound)?;
            line.push(' ');
            line.push_str(&checked_arg("action name", &id).map_err(RunError::NotFound)?);
            Some(id)
        }
        None => None,
    };
    control::send_command(ctx, &line)?;
    let project_label = config::status_group_label(&file_name);
    match target {
        Some(id) => println!("refreshing the labels of {id} on {project_label}"),
        None => println!("refreshing labels on {project_label}"),
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::statussock::net::UnixListener;
    use std::io::{BufRead, BufReader, Write};
    use std::sync::{Arc, Mutex};

    fn fake_app(ctx: &Ctx) -> Arc<Mutex<Vec<String>>> {
        let seen = Arc::new(Mutex::new(Vec::new()));
        let listener = UnixListener::bind(ctx.socket_path()).unwrap();
        let log = seen.clone();
        std::thread::spawn(move || loop {
            let Ok((mut stream, _)) = listener.accept() else {
                return;
            };
            let mut line = String::new();
            BufReader::new(stream.try_clone().unwrap())
                .read_line(&mut line)
                .unwrap();
            let reply = if line.starts_with("ping") {
                "PONG"
            } else {
                "OK"
            };
            log.lock().unwrap().push(line.trim().to_string());
            writeln!(stream, "{reply}").unwrap();
        });
        seen
    }

    #[test]
    fn sends_the_resolved_action_or_the_whole_project() {
        let dir = tempfile::tempdir().unwrap();
        let ctx = Ctx {
            lpm_dir: dir.path().join(".lpm"),
            socket_override: None,
        };
        std::fs::create_dir_all(ctx.projects_dir()).unwrap();
        std::fs::write(
            ctx.project_path("web"),
            "root: /tmp\nactions:\n  release:\n    cmd: ./release.sh\n    label: \"Release {{git.tag}}\"\n    actions:\n      patch: ./release.sh patch\n",
        )
        .unwrap();
        let seen = fake_app(&ctx);

        run(&ctx, Some("release"), Some("web")).unwrap();
        run(&ctx, None, Some("web")).unwrap();
        let err = run(&ctx, Some("deploy"), Some("web")).unwrap_err();
        assert!(err.message().contains("release"), "{}", err.message());

        let sent: Vec<String> = seen
            .lock()
            .unwrap()
            .iter()
            .filter(|l| l.starts_with("refresh_label"))
            .cloned()
            .collect();
        assert_eq!(
            sent,
            ["refresh_label 'web' 'release'", "refresh_label 'web'"]
        );
    }
}
