// Housekeeping for an automation's runs: removing a run (and the copy it
// worked in), marking runs read, and trying the check command before the
// schedule does.
use crate::config::Ctx;
use crate::control;
use crate::error::RunError;
use crate::job::{ensure_ok, request_value, value_text};
use crate::job_edit::{locate, read_body, Locate};
use crate::job_runtime::{load_history, projects, target_project, verb_line, Target};
use crate::statussock::{hex_encode, quote_arg, request_lines};
use crate::util::print_json;
use clap::Args;
use serde_json::{json, Value};

#[derive(Args)]
pub struct RemoveRunArgs {
    #[command(flatten)]
    target: Target,
    #[arg(long, help = "The run's timestamp, as `history` prints it")]
    at: u64,
    #[arg(
        long,
        help = "Remove only this message, not the whole conversation it belongs to"
    )]
    message: bool,
    #[arg(long, help = "Also remove the copy the run worked in")]
    delete_copies: bool,
    #[arg(long)]
    json: bool,
}

#[derive(Args)]
pub struct MarkReadArgs {
    #[arg(required_unless_present = "all")]
    job_id: Option<String>,
    #[arg(long, short = 'p', conflicts_with_all = ["global", "all"], help = "Project the automation runs in; defaults to the current one")]
    project: Option<String>,
    #[arg(
        long,
        conflicts_with = "all",
        help = "The automation defined in global.yml, in every project it runs in"
    )]
    global: bool,
    #[arg(
        long,
        conflicts_with = "all",
        help = "Read runs up to this timestamp only; newer ones stay new"
    )]
    at: Option<u64>,
    #[arg(long, conflicts_with = "job_id", help = "Mark every automation read")]
    all: bool,
    #[arg(long)]
    json: bool,
}

#[derive(Args)]
pub struct TestCheckArgs {
    #[command(flatten)]
    target: Target,
    #[arg(
        long,
        value_name = "COMMAND",
        help = "Try this command instead of the automation's own check"
    )]
    check: Option<String>,
    #[arg(long)]
    json: bool,
}

pub fn remove_run(ctx: &Ctx, args: RemoveRunArgs) -> Result<(), RunError> {
    let id = &args.target.job_id;
    let mut holder = None;
    for project in projects(ctx, &args.target)? {
        let entries = load_history(ctx, &project, id)?;
        if entries
            .iter()
            .any(|e| e.get("at").and_then(Value::as_u64) == Some(args.at))
        {
            holder = Some(project);
            break;
        }
    }
    let project = holder.ok_or_else(|| {
        RunError::NotFound(format!(
            "automation {id} has no run at {}; see `lpm automations history {id}`",
            args.at
        ))
    })?;
    let mut rest = args.at.to_string();
    if !args.message {
        rest.push_str(" --thread");
    }
    if args.delete_copies {
        rest.push_str(" --delete-copies");
    }
    ensure_ok(request_value(
        ctx,
        &verb_line("delete_job_history", &project, id, &rest),
    )?)?;
    let what = if args.message { "message" } else { "run" };
    if args.json {
        print_json(
            &json!({ "ok": true, "automation": id, "at": args.at, "removed": what, "deletedCopies": args.delete_copies }),
        );
    } else {
        println!("removed the {what} at {} from automation {id}", args.at);
    }
    Ok(())
}

pub fn mark_read(ctx: &Ctx, args: MarkReadArgs) -> Result<(), RunError> {
    control::require_app(ctx)?;
    let Some(id) = args.job_id.filter(|_| !args.all) else {
        ensure_ok(request_value(ctx, "mark_all_jobs_seen")?)?;
        return done(
            args.json,
            json!({ "ok": true, "all": true }),
            "marked every automation read",
        );
    };
    let target = Target {
        job_id: id.clone(),
        project: args.project,
        global: args.global,
    };
    let at = args.at.map(|at| at.to_string()).unwrap_or_default();
    for project in projects(ctx, &target)? {
        ensure_ok(request_value(
            ctx,
            &verb_line("mark_job_seen", &project, &id, &at),
        )?)?;
    }
    let upto = args.at.map(|at| format!(" up to {at}")).unwrap_or_default();
    done(
        args.json,
        json!({ "ok": true, "automation": id, "at": args.at }),
        &format!("marked automation {id} read{upto}"),
    )
}

pub fn test_check(ctx: &Ctx, args: TestCheckArgs) -> Result<(), RunError> {
    let target = &args.target;
    let check = match &args.check {
        Some(check) => check.trim().to_string(),
        None => own_check(ctx, target)?,
    };
    if check.is_empty() {
        return Err(RunError::NotFound(format!(
            "automation {} has no check; pass one with --check",
            target.job_id
        )));
    }
    let project = if target.global {
        projects(ctx, target)?
            .into_iter()
            .find(|p| !p.is_empty())
            .ok_or_else(|| {
                RunError::NotFound(format!(
                    "automation {} runs in no project to try the check in",
                    target.job_id
                ))
            })?
    } else {
        target_project(ctx, target)?
    };
    let line = format!(
        "test_job_check {} --check-hex={}",
        quote_arg(&project),
        hex_encode(&check)
    );
    // The check may run for up to a minute, past the plain request's timeout.
    let reply = request_lines(&ctx.socket_path(), &line, |_| {}).map_err(RunError::Internal)?;
    let reply: Value = serde_json::from_str(&reply)
        .map_err(|e| RunError::Internal(format!("unexpected reply from app: {e}: {reply}")))?;
    let work = reply.get("work").and_then(Value::as_bool);
    let output = value_text(&reply, "output").to_string();
    ensure_ok(reply)?;
    if args.json {
        print_json(
            &json!({ "ok": true, "project": project, "check": check, "work": work, "output": output }),
        );
        return Ok(());
    }
    if work == Some(true) {
        println!("work to do in {project}: the check exited 0, so the automation would run");
    } else {
        println!(
            "nothing to do in {project}: the check exited non-zero, so the run would stop there"
        );
    }
    for line in output.lines() {
        println!("  {line}");
    }
    Ok(())
}

/// The automation's own `check`, from its definition.
fn own_check(ctx: &Ctx, target: &Target) -> Result<String, RunError> {
    let def = locate(
        ctx,
        &Locate {
            job_id: target.job_id.clone(),
            project: target.project.clone(),
            global: target.global,
        },
    )?;
    let body = read_body(ctx, &def)?;
    Ok(body
        .get("check")
        .and_then(serde_norway::Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string())
}

fn done(as_json: bool, out: Value, text: &str) -> Result<(), RunError> {
    if as_json {
        print_json(&out);
    } else {
        println!("{text}");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::Parser;

    #[derive(Parser)]
    struct MarkRead {
        #[command(flatten)]
        args: MarkReadArgs,
    }

    #[test]
    fn mark_read_names_an_automation_or_all_of_them() {
        assert!(MarkRead::try_parse_from(["read"]).is_err());
        assert!(MarkRead::try_parse_from(["read", "--all"]).is_ok());
        assert!(MarkRead::try_parse_from(["read", "nightly", "--all"]).is_err());
        let parsed = MarkRead::try_parse_from(["read", "nightly", "--at", "100"]).unwrap();
        assert_eq!(
            (parsed.args.job_id.as_deref(), parsed.args.at),
            (Some("nightly"), Some(100))
        );
    }

    #[derive(Parser)]
    struct RemoveRun {
        #[command(flatten)]
        args: RemoveRunArgs,
    }

    #[test]
    fn removing_a_run_needs_its_timestamp() {
        assert!(RemoveRun::try_parse_from(["remove-run", "nightly"]).is_err());
        let parsed =
            RemoveRun::try_parse_from(["remove-run", "nightly", "--at", "5", "--message"]).unwrap();
        assert!(parsed.args.message && !parsed.args.delete_copies);
    }
}
