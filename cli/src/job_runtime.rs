use crate::config::Ctx;
use crate::control;
use crate::error::{resolve_or_infer, RunError};
use crate::job::{ensure_ok, render_history, request_value, value_array, value_text};
use crate::statussock::{hex_encode, quote_arg};
use crate::style::Style;
use crate::util::{now_millis, print_json};
use clap::Args;
use serde_json::{json, Value};
use std::io::IsTerminal;

// The verbs that act on an automation's runs (`run`, `stop`, `enable`,
// `disable`, `history`, `output`, `reply`): in one project, or with --global in
// every project a global.yml automation runs in. One with no project runs in
// the home folder, which the app keys as the empty project.

#[derive(Args)]
pub struct Target {
    pub(crate) job_id: String,
    #[arg(
        long,
        short = 'p',
        conflicts_with = "global",
        help = "Project to act in; defaults to the current one"
    )]
    pub(crate) project: Option<String>,
    #[arg(
        long,
        help = "The automation defined in global.yml, in every project it runs in; required for one with no project"
    )]
    pub(crate) global: bool,
}

/// The automation's row in `project`'s list, or an error naming the ones it has.
pub(crate) fn project_row(ctx: &Ctx, project: &str, job_id: &str) -> Result<Value, RunError> {
    let rows = value_array(request_value(
        ctx,
        &format!("list_jobs {}", quote_arg(project)),
    )?)?;
    let ids: Vec<String> = rows
        .iter()
        .map(|row| value_text(row, "id").to_string())
        .collect();
    if let Some(row) = rows.into_iter().find(|row| value_text(row, "id") == job_id) {
        return Ok(row);
    }
    let known = if ids.is_empty() {
        "it has none".to_string()
    } else {
        format!("it has: {}", ids.join(", "))
    };
    Err(RunError::NotFound(format!(
        "no automation {job_id} in {project}; {known}\nan automation with no project needs --global"
    )))
}

/// The projects the verb acts in: the one given or inferred, or with --global
/// every project the automation runs in — `""` for one with no project.
pub(crate) fn projects(ctx: &Ctx, target: &Target) -> Result<Vec<String>, RunError> {
    control::require_app(ctx)?;
    if !target.global {
        let project = target_project(ctx, target)?;
        project_row(ctx, &project, &target.job_id)?;
        return Ok(vec![project]);
    }
    let row = global_row(ctx, &target.job_id)?;
    if row.get("standalone").and_then(Value::as_bool) == Some(true) {
        return Ok(vec![String::new()]);
    }
    let projects: Vec<String> = row
        .get("targets")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();
    if projects.is_empty() {
        return Err(RunError::NotFound(match value_text(&row, "error") {
            "" => format!(
                "automation {} in global.yml runs in no project that exists",
                target.job_id
            ),
            error => format!(
                "automation {} in global.yml is invalid: {error}",
                target.job_id
            ),
        }));
    }
    Ok(projects)
}

/// The project a target without --global names, or the current one.
pub(crate) fn target_project(ctx: &Ctx, target: &Target) -> Result<String, RunError> {
    resolve_or_infer(ctx, target.project.as_deref()).map_err(|error| match error {
        RunError::NotFound(message) if target.project.is_none() => RunError::NotFound(format!(
            "{message}\nfor an automation in global.yml, pass --global"
        )),
        error => error,
    })
}

/// The global.yml automation's row in the app-wide list.
pub(crate) fn global_row(ctx: &Ctx, job_id: &str) -> Result<Value, RunError> {
    value_array(request_value(ctx, "list_all_jobs")?)?
        .into_iter()
        .find(|row| value_text(row, "source") == "global" && value_text(row, "id") == job_id)
        .ok_or_else(|| RunError::NotFound(format!("no automation {job_id} in global.yml")))
}

/// `verb 'project' 'id' rest`. The empty project rides as --no-project, last,
/// so it can't take the next argument as its value.
pub(crate) fn verb_line(verb: &str, project: &str, job_id: &str, rest: &str) -> String {
    let mut line = if project.is_empty() {
        format!("{verb} {}", quote_arg(job_id))
    } else {
        format!("{verb} {} {}", quote_arg(project), quote_arg(job_id))
    };
    if !rest.is_empty() {
        line.push(' ');
        line.push_str(rest);
    }
    if project.is_empty() {
        line.push_str(" --no-project");
    }
    line
}

fn place(projects: &[String]) -> String {
    match projects {
        [only] if only.is_empty() => "with no project".into(),
        _ => format!("in {}", projects.join(", ")),
    }
}

fn project_value(project: &str) -> Value {
    if project.is_empty() {
        Value::Null
    } else {
        json!(project)
    }
}

/// The JSON keys naming where a verb acted: `project`, or with --global
/// `global` and `projects` (empty for an automation with no project).
fn scope(target: &Target, projects: &[String]) -> Value {
    if target.global {
        let named: Vec<&String> = projects.iter().filter(|p| !p.is_empty()).collect();
        json!({ "global": true, "projects": named, "automation": target.job_id })
    } else {
        json!({ "project": projects[0], "automation": target.job_id })
    }
}

/// Sends `verb` for each project, reporting the ones it reached before failing
/// on the ones it didn't.
pub(crate) fn mutate(
    ctx: &Ctx,
    verb: &str,
    action: &str,
    target: &Target,
    rest: &str,
    as_json: bool,
) -> Result<(), RunError> {
    let projects = projects(ctx, target)?;
    let mut done = Vec::new();
    let mut failed = Vec::new();
    for project in &projects {
        match request_value(ctx, &verb_line(verb, project, &target.job_id, rest))
            .and_then(ensure_ok)
        {
            Ok(()) => done.push(project.clone()),
            Err(error) if projects.len() == 1 => return Err(error),
            Err(error) => failed.push(format!("{project}: {}", error.message())),
        }
    }
    if !done.is_empty() {
        if as_json {
            let mut out = scope(target, &done);
            out["ok"] = json!(true);
            out["action"] = json!(action);
            print_json(&out);
        } else {
            println!("{action} automation {} {}", target.job_id, place(&done));
            if verb == "run_job" {
                let list = if target.global {
                    "--all".to_string()
                } else {
                    format!("-p {}", done[0])
                };
                eprintln!("note: fire-and-forget — watch it with `lpm automations list {list}`");
            }
        }
    }
    if failed.is_empty() {
        Ok(())
    } else {
        Err(RunError::Internal(failed.join("\n")))
    }
}

pub(crate) fn history(
    ctx: &Ctx,
    target: &Target,
    limit: Option<usize>,
    as_json: bool,
) -> Result<(), RunError> {
    let projects = projects(ctx, target)?;
    let mut entries = Vec::new();
    for project in &projects {
        for mut entry in load_history(ctx, project, &target.job_id)? {
            if target.global {
                entry["project"] = project_value(project);
            }
            entries.push(entry);
        }
    }
    if projects.len() > 1 {
        entries.sort_by_key(|entry| entry.get("at").and_then(Value::as_u64).unwrap_or_default());
    }
    if let Some(limit) = limit {
        entries.drain(..entries.len().saturating_sub(limit));
    }
    if as_json {
        let mut out = scope(target, &projects);
        out["history"] = json!(entries);
        print_json(&out);
    } else if entries.is_empty() {
        println!(
            "no runs for automation {} {}",
            target.job_id,
            place(&projects)
        );
    } else {
        let style = Style {
            on: std::io::stdout().is_terminal(),
        };
        print!("{}", render_history(&style, &entries, now_millis()));
    }
    Ok(())
}

pub(crate) fn output(ctx: &Ctx, target: &Target, as_json: bool) -> Result<(), RunError> {
    let projects = projects(ctx, target)?;
    let mut lives = Vec::new();
    for project in &projects {
        let live = request_value(
            ctx,
            &verb_line("job_live_output", project, &target.job_id, ""),
        )?;
        lives.push((project, live));
    }
    if as_json {
        let mut out = scope(target, &projects);
        out["live"] = if target.global {
            lives
                .iter()
                .filter(|(_, live)| !live.is_null())
                .map(|(project, live)| {
                    let mut live = live.clone();
                    live["project"] = project_value(project);
                    live
                })
                .collect()
        } else {
            lives[0].1.clone()
        };
        print_json(&out);
        return Ok(());
    }
    let running: Vec<(&String, &str)> = lives
        .iter()
        .filter_map(|(project, live)| Some((*project, live.get("text")?.as_str()?)))
        .collect();
    if running.is_empty() {
        println!(
            "automation {} is not currently producing live output",
            target.job_id
        );
    }
    for (project, text) in running {
        if projects.len() > 1 {
            println!("==> {project} <==");
        }
        if text.is_empty() {
            println!("automation {} has not produced output yet", target.job_id);
        } else {
            println!("{text}");
        }
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn reply(
    ctx: &Ctx,
    target: &Target,
    message: &str,
    at: Option<u64>,
    agent: Option<&str>,
    model: Option<&str>,
    effort: Option<&str>,
    as_json: bool,
) -> Result<(), RunError> {
    let projects = projects(ctx, target)?;
    let (project, at) = conversation(ctx, &target.job_id, &projects, at)?;
    let mut rest = format!("{at} --message-hex={}", hex_encode(message));
    for (key, value) in [("agent", agent), ("model", model), ("effort", effort)] {
        if let Some(value) = value.filter(|value| !value.is_empty()) {
            rest.push_str(&format!(" --{key}={}", quote_arg(value)));
        }
    }
    ensure_ok(request_value(
        ctx,
        &verb_line("send_job_followup", &project, &target.job_id, &rest),
    )?)?;
    let reached = [project];
    if as_json {
        let mut out = scope(target, &reached);
        out["ok"] = json!(true);
        out["at"] = json!(at);
        print_json(&out);
    } else {
        println!(
            "sent reply to automation {} {}",
            target.job_id,
            place(&reached)
        );
        let watch = if target.global {
            "--global".to_string()
        } else {
            format!("-p {}", reached[0])
        };
        eprintln!(
            "note: fire-and-forget — watch it with `lpm automations output {} {watch}`",
            target.job_id
        );
    }
    Ok(())
}

/// The project holding the conversation at `at`, or the newest conversation
/// across `projects` when no `at` is given.
fn conversation(
    ctx: &Ctx,
    job_id: &str,
    projects: &[String],
    at: Option<u64>,
) -> Result<(String, u64), RunError> {
    if let (Some(at), [project]) = (at, projects) {
        return Ok((project.clone(), at));
    }
    let mut found: Option<(String, u64)> = None;
    for project in projects {
        let entries = load_history(ctx, project, job_id)?;
        let candidate = match at {
            Some(at) => entries
                .iter()
                .any(|entry| entry.get("at").and_then(Value::as_u64) == Some(at))
                .then_some(at),
            None => newest_history_at(&entries),
        };
        if let Some(candidate) = candidate {
            if found.as_ref().is_none_or(|(_, best)| candidate > *best) {
                found = Some((project.clone(), candidate));
            }
        }
    }
    found.ok_or_else(|| {
        RunError::NotFound(match at {
            Some(at) => format!("automation {job_id} has no run at {at}"),
            None => format!("automation {job_id} has no conversation to continue — run it first"),
        })
    })
}

pub(crate) fn load_history(ctx: &Ctx, project: &str, job_id: &str) -> Result<Vec<Value>, RunError> {
    value_array(request_value(
        ctx,
        &verb_line("job_history", project, job_id, ""),
    )?)
}

fn newest_history_at(entries: &[Value]) -> Option<u64> {
    entries
        .iter()
        .filter_map(|entry| entry.get("at")?.as_u64())
        .max()
}

#[cfg(test)]
#[path = "job_runtime_tests.rs"]
mod tests;
