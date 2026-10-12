use crate::config::Ctx;
use crate::error::{resolve_or_infer, RunError};
use crate::job::{ensure_ok, request_value};
use crate::job_edit::{locate, Locate};
use crate::statussock::quote_arg;
use crate::util::print_json;
use clap::Args;
use serde_json::json;

#[derive(Args)]
pub struct OpenArgs {
    #[command(flatten)]
    at: Locate,
    #[arg(long)]
    json: bool,
}

pub fn open(ctx: &Ctx, args: OpenArgs) -> Result<(), RunError> {
    locate(ctx, &args.at)?;
    let id = &args.at.job_id;
    let project = if args.at.global {
        None
    } else {
        Some(resolve_or_infer(ctx, args.at.project.as_deref())?)
    };
    let mut line = format!("open_job {}", quote_arg(id));
    if let Some(project) = &project {
        line.push(' ');
        line.push_str(&quote_arg(project));
    }
    ensure_ok(request_value(ctx, &line)?)?;
    if args.json {
        print_json(&json!({
            "ok": true,
            "project": project,
            "automation": id,
            "action": "opened",
        }));
    } else {
        match &project {
            Some(project) => println!("opened automation {id} in {project}"),
            None => println!("opened automation {id}"),
        }
    }
    Ok(())
}
