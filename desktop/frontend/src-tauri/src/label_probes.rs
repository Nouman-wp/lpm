//! Background runs behind dynamic action labels. Each `$(…)` command in a label,
//! and each git query a label makes on an SSH project, is a probe: run on its own interval
//! with a timeout, its first output line kept for the next listing. One ticker
//! thread starts due probes, watches local git and rendered ages, and emits
//! `projects-changed` when any of them moves.

use crate::action_labels::{self, Ctx};
use crate::config::{self, SshSettings};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

const TICK: Duration = Duration::from_secs(1);
const WATCH_TICKS: u32 = 5;
const TIMEOUT: Duration = Duration::from_secs(15);
const STALE: Duration = Duration::from_secs(600);
const REMOTE_GIT_EVERY: Duration = Duration::from_secs(60);
const MAX_RUNNING: usize = 4;
const MAX_CHARS: usize = 60;
const HOVER_GAP: Duration = Duration::from_secs(5);

struct Probe {
    ssh: Option<SshSettings>,
    dir: String,
    script: String,
    every: Duration,
    output: Option<String>,
    ran_at: Option<Instant>,
    running: bool,
    due: bool,
    seen: Instant,
    /// (project, action id) pairs whose labels show this probe's output; a
    /// built-in git query has no action.
    owners: HashSet<(String, String)>,
}

fn probes() -> &'static Mutex<HashMap<String, Probe>> {
    static PROBES: OnceLock<Mutex<HashMap<String, Probe>>> = OnceLock::new();
    PROBES.get_or_init(|| Mutex::new(HashMap::new()))
}

static DIRTY: AtomicBool = AtomicBool::new(false);

/// A label's `$(…)` command's last output, run in the action's cwd with its env.
pub fn read_command(
    ctx: &Ctx,
    action: &str,
    cwd: &str,
    env: &BTreeMap<String, String>,
    cmd: &str,
    every: Duration,
) -> String {
    let mut env = env.clone();
    env.insert("LPM_PROJECT_NAME".into(), ctx.project.to_string());
    let dir = match ctx.ssh {
        Some(_) => config::join_remote_dir(ctx.root, cwd),
        None => config::resolve_cwd(ctx.root, cwd),
    };
    read(
        (ctx.project, action),
        ctx.ssh,
        dir,
        config::build_local_script(&env, cmd),
        every,
    )
}

/// A built-in query's last output on an SSH project's host.
pub fn read_remote(project: &str, ssh: &SshSettings, dir: &str, script: &str) -> String {
    read(
        (project, ""),
        Some(ssh),
        dir.to_string(),
        script.to_string(),
        REMOTE_GIT_EVERY,
    )
}

/// The cached output, registering the probe on first sight so the ticker runs
/// it straight away. Never blocks on the command itself.
fn read(
    owner: (&str, &str),
    ssh: Option<&SshSettings>,
    dir: String,
    script: String,
    every: Duration,
) -> String {
    let host = ssh
        .map(|s| format!("{}@{}:{}", s.user, s.host, s.port))
        .unwrap_or_default();
    let key = format!("{host}\n{dir}\n{script}");
    let mut probes = probes().lock().unwrap();
    let probe = probes.entry(key).or_insert_with(|| Probe {
        ssh: ssh.cloned(),
        dir,
        script,
        every,
        output: None,
        ran_at: None,
        running: false,
        due: true,
        seen: Instant::now(),
        owners: HashSet::new(),
    });
    probe.seen = Instant::now();
    probe.every = probe.every.min(every);
    probe
        .owners
        .insert((owner.0.to_string(), owner.1.to_string()));
    probe.output.clone().unwrap_or_default()
}

/// Run the project's label commands again now, after one of its actions ran.
pub fn refresh_project(project: &str) {
    for probe in probes().lock().unwrap().values_mut() {
        if probe.owners.iter().any(|(p, _)| p == project) {
            probe.due = true;
        }
    }
}

/// Run the label commands of `action` and the items in its menu again now,
/// unless they ran within `gap`.
fn refresh_action(project: &str, action: &str, gap: Duration) {
    let nested = format!("{action}:");
    for probe in probes().lock().unwrap().values_mut() {
        let owned = probe
            .owners
            .iter()
            .any(|(p, a)| p == project && (a == action || a.starts_with(&nested)));
        if owned && probe.ran_at.is_none_or(|t| t.elapsed() >= gap) {
            probe.due = true;
        }
    }
}

/// Hovering a `labelRefreshOnHover` button.
#[tauri::command]
pub fn refresh_action_label(project_name: String, action_name: String) {
    refresh_action(&project_name, &action_name, HOVER_GAP);
}

/// `refresh_label <project> [action]` from `lpm refresh-label`: run the label
/// commands of one action and its menu, or of the whole project, now, and
/// redraw so labels built from git read it again too.
pub(crate) fn cmd_refresh_label(args: &[String]) -> String {
    let Some(project) = args.first() else {
        return "ERROR: usage: refresh_label <project> [action]".into();
    };
    if project != config::RESERVED_PROJECT_NAME && !config::project_exists(project) {
        return format!("ERROR: project {project:?} not found");
    }
    match args.get(1).filter(|a| !a.is_empty()) {
        Some(action) => refresh_action(project, action, Duration::ZERO),
        None => refresh_project(project),
    }
    DIRTY.store(true, Ordering::SeqCst);
    "OK".into()
}

pub fn start(app: AppHandle) {
    std::thread::spawn(move || {
        let mut tick: u32 = 0;
        loop {
            std::thread::sleep(TICK);
            run_due();
            tick = tick.wrapping_add(1);
            if tick.is_multiple_of(WATCH_TICKS)
                && (crate::label_git::poll() | action_labels::ages_moved())
            {
                DIRTY.store(true, Ordering::SeqCst);
            }
            if DIRTY.swap(false, Ordering::SeqCst) {
                let _ = app.emit("projects-changed", ());
            }
        }
    });
}

fn run_due() {
    let mut probes = probes().lock().unwrap();
    probes.retain(|_, p| p.running || p.seen.elapsed() < STALE);
    let free = MAX_RUNNING.saturating_sub(probes.values().filter(|p| p.running).count());
    let due: Vec<String> = probes
        .iter()
        .filter(|(_, p)| !p.running && (p.due || p.ran_at.is_none_or(|t| t.elapsed() >= p.every)))
        .map(|(key, _)| key.clone())
        .take(free)
        .collect();
    for key in due {
        let Some(probe) = probes.get_mut(&key) else {
            continue;
        };
        probe.running = true;
        probe.due = false;
        let (ssh, dir, script) = (probe.ssh.clone(), probe.dir.clone(), probe.script.clone());
        std::thread::spawn(move || {
            let output = run(ssh.as_ref(), &dir, &script);
            finish(&key, output);
        });
    }
}

/// A run that timed out or couldn't start keeps the last output, so a slow
/// network doesn't blank a label that read fine a minute ago.
pub(crate) fn finish(key: &str, output: Option<String>) {
    let mut probes = probes().lock().unwrap();
    let Some(probe) = probes.get_mut(key) else {
        return;
    };
    probe.running = false;
    probe.ran_at = Some(Instant::now());
    let Some(output) = output else {
        return;
    };
    if probe.output.as_deref().unwrap_or_default() != output {
        DIRTY.store(true, Ordering::SeqCst);
    }
    probe.output = Some(output);
}

fn run(ssh: Option<&SshSettings>, dir: &str, script: &str) -> Option<String> {
    let cmd = match ssh {
        Some(ssh) => {
            let line = if dir.trim().is_empty() {
                script.to_string()
            } else {
                format!("cd {} && {script}", config::quote_remote_path(dir.trim()))
            };
            crate::sshexec::remote_login_script(ssh, &line)
        }
        None => local_command(dir, script),
    };
    run_with_timeout(cmd).map(|out| first_line(&String::from_utf8_lossy(&out)))
}

/// The user's interactive login shell, as background actions use, so a label
/// command finds the same PATH and version managers the action itself does.
fn local_command(dir: &str, script: &str) -> Command {
    let cwd = crate::shellpath::shell_path(Path::new(dir));
    let line = format!("cd {} && {script}", config::shell_quote(&cwd));
    let mut cmd = crate::shellpath::shell_script("-ilc", &line);
    cmd.current_dir(dir);
    #[cfg(unix)]
    crate::osproc::detach(&mut cmd);
    cmd
}

fn run_with_timeout(mut cmd: Command) -> Option<Vec<u8>> {
    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    let mut child = cmd.spawn().ok()?;
    let mut stdout = child.stdout.take()?;
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let mut buf = Vec::new();
        let _ = stdout.read_to_end(&mut buf);
        let _ = tx.send(buf);
    });
    match rx.recv_timeout(TIMEOUT) {
        Ok(buf) => {
            let _ = child.wait();
            Some(buf)
        }
        Err(_) => {
            crate::proctree::kill_tree_async(child.id() as i32);
            let _ = child.wait();
            None
        }
    }
}

/// The first line with text, without terminal colors or control characters,
/// cut to fit a button.
pub(crate) fn first_line(out: &str) -> String {
    let line = out
        .lines()
        .map(|l| strip_ansi(l).trim().to_string())
        .find(|l| !l.is_empty())
        .unwrap_or_default();
    if line.chars().count() <= MAX_CHARS {
        return line;
    }
    let cut: String = line.chars().take(MAX_CHARS - 1).collect();
    format!("{}…", cut.trim_end())
}

fn strip_ansi(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\u{1b}' {
            if chars.peek() == Some(&'[') {
                chars.next();
                for c in chars.by_ref() {
                    if ('@'..='~').contains(&c) {
                        break;
                    }
                }
            } else {
                chars.next();
            }
            continue;
        }
        if !c.is_control() {
            out.push(c);
        }
    }
    out
}

#[cfg(test)]
#[path = "label_probes_tests.rs"]
mod tests;
