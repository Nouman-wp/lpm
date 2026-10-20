use super::*;
use crate::statussock::net::UnixListener;
use std::io::{BufRead, BufReader, Write};
use std::sync::{Arc, Mutex};

const ROWS: &str = r#"[
    {"id":"shared","source":"global","targets":["alpha","beta"],"standalone":false},
    {"id":"home","source":"global","targets":[],"standalone":true},
    {"id":"tests","source":"project","project":"alpha","targets":["alpha"],"standalone":false}
]"#;

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
        let line = line.trim().to_string();
        let reply = match line.split(' ').next().unwrap_or_default() {
            "ping" => "PONG".to_string(),
            "list_all_jobs" => ROWS.replace('\n', ""),
            "list_jobs" => r#"[{"id":"shared","source":"global"}]"#.into(),
            "job_history" if line.contains("'beta'") => r#"[{"at":30},{"at":40}]"#.into(),
            "job_history" => r#"[{"at":10},{"at":50}]"#.into(),
            _ => r#"{"ok":true}"#.into(),
        };
        log.lock().unwrap().push(line);
        writeln!(stream, "{reply}").unwrap();
    });
    seen
}

fn harness() -> (tempfile::TempDir, Ctx, Arc<Mutex<Vec<String>>>) {
    let dir = tempfile::tempdir().unwrap();
    let ctx = Ctx {
        lpm_dir: dir.path().join(".lpm"),
        socket_override: None,
    };
    std::fs::create_dir_all(ctx.projects_dir()).unwrap();
    for project in ["alpha", "beta"] {
        std::fs::write(ctx.project_path(project), "root: /tmp\n").unwrap();
    }
    let seen = fake_app(&ctx);
    (dir, ctx, seen)
}

fn target(job_id: &str, project: Option<&str>, global: bool) -> Target {
    Target {
        job_id: job_id.into(),
        project: project.map(String::from),
        global,
    }
}

fn sent(seen: &Arc<Mutex<Vec<String>>>, verb: &str) -> Vec<String> {
    let mut seen = seen.lock().unwrap();
    let lines = seen
        .iter()
        .filter(|l| l.starts_with(verb))
        .cloned()
        .collect();
    seen.clear();
    lines
}

#[test]
fn global_reaches_every_project_and_the_home_folder() {
    let (_dir, ctx, seen) = harness();

    mutate(
        &ctx,
        "set_job_enabled",
        "disabled",
        &target("shared", None, true),
        "false",
        true,
    )
    .unwrap();
    assert_eq!(
        sent(&seen, "set_job_enabled"),
        [
            "set_job_enabled 'alpha' 'shared' false",
            "set_job_enabled 'beta' 'shared' false"
        ]
    );

    mutate(
        &ctx,
        "run_job",
        "running",
        &target("home", None, true),
        "",
        true,
    )
    .unwrap();
    assert_eq!(sent(&seen, "run_job"), ["run_job 'home' --no-project"]);

    mutate(
        &ctx,
        "run_job",
        "running",
        &target("shared", Some("beta"), false),
        "",
        true,
    )
    .unwrap();
    assert_eq!(sent(&seen, "run_job"), ["run_job 'beta' 'shared'"]);
}

#[test]
fn global_needs_an_automation_in_global_yml() {
    let (_dir, ctx, _seen) = harness();
    let err = mutate(
        &ctx,
        "run_job",
        "running",
        &target("tests", None, true),
        "",
        true,
    )
    .unwrap_err();
    assert!(
        err.message().contains("no automation tests in global.yml"),
        "{}",
        err.message()
    );

    let err = mutate(
        &ctx,
        "run_job",
        "running",
        &target("home", Some("alpha"), false),
        "",
        true,
    )
    .unwrap_err();
    assert!(
        err.message().contains("needs --global"),
        "{}",
        err.message()
    );
}

#[test]
fn reply_continues_the_newest_conversation_across_projects() {
    let (_dir, ctx, seen) = harness();

    reply(
        &ctx,
        &target("shared", None, true),
        "hi",
        None,
        None,
        None,
        None,
        true,
    )
    .unwrap();
    assert_eq!(
        sent(&seen, "send_job_followup"),
        ["send_job_followup 'alpha' 'shared' 50 --message-hex=6869"]
    );

    reply(
        &ctx,
        &target("shared", None, true),
        "hi",
        Some(30),
        None,
        None,
        None,
        true,
    )
    .unwrap();
    assert_eq!(
        sent(&seen, "send_job_followup"),
        ["send_job_followup 'beta' 'shared' 30 --message-hex=6869"]
    );

    let err = reply(
        &ctx,
        &target("shared", None, true),
        "hi",
        Some(99),
        None,
        None,
        None,
        true,
    )
    .unwrap_err();
    assert!(err.message().contains("no run at 99"), "{}", err.message());
}

#[test]
fn the_home_folder_rides_as_no_project_last() {
    assert_eq!(
        verb_line("set_job_enabled", "", "home", "true"),
        "set_job_enabled 'home' true --no-project"
    );
    assert_eq!(
        verb_line("set_job_enabled", "web", "home", "true"),
        "set_job_enabled 'web' 'home' true"
    );
    assert_eq!(place(&[String::new()]), "with no project");
    assert_eq!(place(&["a".into(), "b".into()]), "in a, b");
}

#[test]
fn newest_history_timestamp() {
    let entries = vec![
        json!({ "at": 10 }),
        json!({ "at": 30 }),
        json!({ "at": 20 }),
    ];
    assert_eq!(newest_history_at(&entries), Some(30));
}
