use crate::config::{self, Ctx};
use crate::config_cmd::validate_job_entry;
use crate::control;
use crate::error::{resolve_or_infer, RunError};
use crate::job::{ensure_ok, humanize_until, request_value, value_array, value_text};
use crate::job_fields::JobFields;
use crate::statussock::{hex_encode, quote_arg};
use crate::util::{now_millis, print_json};
use clap::Args;
use serde_json::{json, Value as JsonValue};
use serde_norway::{Mapping, Value};

// Authoring automations: `show`, `add`, `edit` and `remove` read and write a
// job's entry in the config layer that defines it, through the app.

const PROJECT: &str = "project";
const GLOBAL: &str = "global";

#[derive(Args)]
pub struct Locate {
    job_id: String,
    #[arg(
        long,
        short = 'p',
        conflicts_with = "global",
        help = "Project the automation runs in"
    )]
    project: Option<String>,
    #[arg(
        long,
        help = "The automation defined in global.yml; required for one with no project"
    )]
    global: bool,
}

#[derive(Args)]
pub struct Scope {
    #[arg(
        long,
        value_name = "NAMES",
        value_delimiter = ',',
        conflicts_with_all = ["every_project", "no_project"],
        help = "Run in these projects (kept in global.yml)"
    )]
    projects: Option<Vec<String>>,
    #[arg(
        long,
        conflicts_with = "no_project",
        help = "Run in every project (kept in global.yml)"
    )]
    every_project: bool,
    #[arg(
        long,
        help = "Run once with no project, in the home directory (kept in global.yml)"
    )]
    no_project: bool,
}

#[derive(Args)]
pub struct ShowArgs {
    #[command(flatten)]
    at: Locate,
    #[arg(long)]
    json: bool,
}

#[derive(Args)]
pub struct AddArgs {
    #[arg(help = "Id for the new automation: letters, digits, '-' and '_'")]
    job_id: String,
    #[arg(
        long,
        short = 'p',
        conflicts_with_all = ["projects", "every_project", "no_project"],
        help = "Project to add it to; defaults to the current one"
    )]
    project: Option<String>,
    #[command(flatten)]
    scope: Scope,
    #[command(flatten)]
    fields: JobFields,
    #[arg(long)]
    json: bool,
}

#[derive(Args)]
pub struct EditArgs {
    #[command(flatten)]
    at: Locate,
    #[command(flatten)]
    scope: Scope,
    #[command(flatten)]
    fields: JobFields,
    #[arg(long)]
    json: bool,
}

#[derive(Args)]
pub struct RemoveArgs {
    #[command(flatten)]
    at: Locate,
    #[arg(long)]
    json: bool,
}

/// Where an automation's entry lives: its layer, the project whose file holds
/// it (empty for global.yml), and its id.
struct Definition {
    source: String,
    project: String,
    id: String,
}

impl Definition {
    fn verb_args(&self) -> String {
        let mut args = format!("{} {}", self.source, quote_arg(&self.id));
        if !self.project.is_empty() {
            args.push(' ');
            args.push_str(&quote_arg(&self.project));
        }
        args
    }

    fn place(&self) -> String {
        match self.source.as_str() {
            GLOBAL => "global.yml".into(),
            "repo" => format!("{}'s .lpm.yml", self.project),
            _ => format!("{}'s config", self.project),
        }
    }

    fn is_remote(&self, ctx: &Ctx) -> bool {
        self.source == PROJECT
            && config::resolve_project(ctx, &self.project).is_ok_and(|p| p.is_remote)
    }
}

impl Scope {
    fn given(&self) -> bool {
        self.projects.is_some() || self.every_project || self.no_project
    }

    fn apply(&self, ctx: &Ctx, job: &mut Mapping) -> Result<(), RunError> {
        if self.every_project {
            job.shift_remove("projects");
        } else if self.no_project {
            job.insert("projects".into(), Value::Sequence(Vec::new()));
        } else if let Some(names) = &self.projects {
            let mut projects = Vec::new();
            for name in names.iter().map(|n| n.trim()).filter(|n| !n.is_empty()) {
                let name = resolve_or_infer(ctx, Some(name))?;
                if !projects.contains(&name) {
                    projects.push(name);
                }
            }
            if projects.is_empty() {
                return Err(RunError::NotFound(
                    "--projects needs at least one project; use --no-project for none".into(),
                ));
            }
            job.insert(
                "projects".into(),
                Value::Sequence(projects.into_iter().map(Value::String).collect()),
            );
        }
        Ok(())
    }
}

pub fn show(ctx: &Ctx, args: ShowArgs) -> Result<(), RunError> {
    let def = locate(ctx, &args.at)?;
    let body = read_body(ctx, &def)?;
    if args.json {
        print_json(&json!({
            "automation": def.id,
            "source": def.source,
            "project": (!def.project.is_empty()).then_some(&def.project),
            "definition": serde_json::to_value(&body).unwrap_or(JsonValue::Null),
        }));
    } else {
        let mut entry = Mapping::new();
        entry.insert(Value::String(def.id.clone()), Value::Mapping(body));
        let yaml = serde_norway::to_string(&entry)
            .map_err(|e| RunError::Internal(format!("could not print the automation: {e}")))?;
        println!("# {}", def.place());
        print!("{yaml}");
    }
    Ok(())
}

pub fn add(ctx: &Ctx, args: AddArgs) -> Result<(), RunError> {
    control::require_app(ctx)?;
    let id = args.job_id.trim().to_string();
    if id.is_empty()
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(RunError::NotFound(format!(
            "{id:?} can't be an automation id: use letters, digits, '-' and '_'"
        )));
    }
    if !args.fields.schedule_given() {
        return Err(RunError::NotFound(
            "give it a schedule: --at, --every, --cron or --manual".into(),
        ));
    }
    if !args.fields.run_target_given() {
        return Err(RunError::NotFound(
            "give it something to run: --cmd, --action or --prompt".into(),
        ));
    }
    let def = if args.scope.given() {
        Definition {
            source: GLOBAL.into(),
            project: String::new(),
            id,
        }
    } else {
        Definition {
            source: PROJECT.into(),
            project: resolve_or_infer(ctx, args.project.as_deref())?,
            id,
        }
    };
    ensure_new(ctx, &def)?;
    let mut body = Mapping::new();
    args.fields.apply(&mut body).map_err(RunError::NotFound)?;
    args.scope.apply(ctx, &mut body)?;
    save(ctx, &def, body, "added", args.json)
}

pub fn edit(ctx: &Ctx, args: EditArgs) -> Result<(), RunError> {
    if args.fields.is_empty() && !args.scope.given() {
        return Err(RunError::NotFound(
            "nothing to change: pass the fields to set (see `lpm automations edit --help`)".into(),
        ));
    }
    let def = locate(ctx, &args.at)?;
    if args.scope.given() && def.source != GLOBAL {
        return Err(RunError::NotFound(format!(
            "automation {} lives in {}; only one in global.yml takes --projects, --every-project or --no-project",
            def.id,
            def.place()
        )));
    }
    let mut body = read_body(ctx, &def)?;
    args.fields.apply(&mut body).map_err(RunError::NotFound)?;
    args.scope.apply(ctx, &mut body)?;
    save(ctx, &def, body, "updated", args.json)
}

pub fn remove(ctx: &Ctx, args: RemoveArgs) -> Result<(), RunError> {
    let def = locate(ctx, &args.at)?;
    if def.source == GLOBAL && !args.at.global {
        return Err(RunError::NotFound(format!(
            "automation {} is defined in global.yml and may run in other projects too; pass --global to remove it everywhere",
            def.id
        )));
    }
    ensure_ok(request_value(
        ctx,
        &format!("delete_job {}", def.verb_args()),
    )?)?;
    if args.json {
        print_json(&json!({
            "ok": true,
            "automation": def.id,
            "source": def.source,
            "action": "removed",
        }));
    } else {
        println!("removed automation {} from {}", def.id, def.place());
    }
    Ok(())
}

fn locate(ctx: &Ctx, at: &Locate) -> Result<Definition, RunError> {
    control::require_app(ctx)?;
    if at.global {
        let def = Definition {
            source: GLOBAL.into(),
            project: String::new(),
            id: at.job_id.clone(),
        };
        read_body(ctx, &def)?;
        return Ok(def);
    }
    let project = resolve_or_infer(ctx, at.project.as_deref())?;
    let rows = value_array(request_value(
        ctx,
        &format!("list_jobs {}", quote_arg(&project)),
    )?)?;
    let Some(row) = rows.iter().find(|row| value_text(row, "id") == at.job_id) else {
        let ids: Vec<&str> = rows.iter().map(|row| value_text(row, "id")).collect();
        let known = if ids.is_empty() {
            "it has none".to_string()
        } else {
            format!("it has: {}", ids.join(", "))
        };
        return Err(RunError::NotFound(format!(
            "no automation {} in {project}; {known}\nan automation with no project needs --global",
            at.job_id
        )));
    };
    let source = value_text(row, "source").to_string();
    Ok(Definition {
        project: if source == GLOBAL {
            String::new()
        } else {
            project
        },
        source,
        id: at.job_id.clone(),
    })
}

fn read_body(ctx: &Ctx, def: &Definition) -> Result<Mapping, RunError> {
    let reply = request_value(ctx, &format!("job_body {}", def.verb_args()))?;
    let Some(yaml) = reply.get("yaml").and_then(JsonValue::as_str) else {
        let error = value_text(&reply, "error");
        return Err(RunError::NotFound(format!(
            "no automation {} in {}{}",
            def.id,
            def.place(),
            if error.is_empty() {
                String::new()
            } else {
                format!(": {error}")
            }
        )));
    };
    match serde_norway::from_str::<Value>(yaml) {
        Ok(Value::Mapping(body)) => Ok(body),
        _ => Err(RunError::Internal(format!(
            "automation {} in {} isn't a mapping; fix it in the app",
            def.id,
            def.place()
        ))),
    }
}

/// A new id must not be visible already: in the project for a project entry,
/// anywhere for a global one. It would shadow or be shadowed by the other entry
/// and inherit its run history.
fn ensure_new(ctx: &Ctx, def: &Definition) -> Result<(), RunError> {
    let rows = if def.source == GLOBAL {
        value_array(request_value(ctx, "list_all_jobs")?)?
    } else {
        value_array(request_value(
            ctx,
            &format!("list_jobs {}", quote_arg(&def.project)),
        )?)?
    };
    let taken = rows.iter().any(|row| value_text(row, "id") == def.id)
        || (def.source == GLOBAL && read_body(ctx, def).is_ok());
    if taken {
        return Err(RunError::NotFound(format!(
            "automation {} already exists; change it with `lpm automations edit {}` or pick another id",
            def.id, def.id
        )));
    }
    Ok(())
}

fn save(
    ctx: &Ctx,
    def: &Definition,
    body: Mapping,
    action: &str,
    as_json: bool,
) -> Result<(), RunError> {
    let body = Value::Mapping(body);
    let (errors, warnings) = validate_job_entry(&def.id, &body, &def.source, def.is_remote(ctx));
    if !errors.is_empty() {
        if as_json {
            print_json(&json!({ "ok": false, "errors": errors, "warnings": warnings }));
        }
        return Err(RunError::NotFound(format!(
            "automation {} wasn't saved:\n  {}",
            def.id,
            errors.join("\n  ")
        )));
    }
    let yaml = serde_norway::to_string(&body)
        .map_err(|e| RunError::Internal(format!("could not write the automation: {e}")))?;
    ensure_ok(request_value(
        ctx,
        &format!(
            "save_job {} --yaml-hex={}",
            def.verb_args(),
            hex_encode(&yaml)
        ),
    )?)?;

    let rows = app_rows(ctx, def)?;
    let app_errors: Vec<String> = rows
        .iter()
        .filter(|row| row.get("valid").and_then(JsonValue::as_bool) == Some(false))
        .map(|row| value_text(row, "error").to_string())
        .collect();
    let next = rows
        .iter()
        .filter_map(|row| row.get("nextFireAt").and_then(JsonValue::as_i64))
        .min();
    if as_json {
        print_json(&json!({
            "ok": app_errors.is_empty(),
            "automation": def.id,
            "source": def.source,
            "action": action,
            "nextFireAt": next,
            "warnings": warnings,
            "errors": app_errors,
        }));
    } else {
        let when = next
            .map(|at| format!(", next run {}", humanize_until(at - now_millis() / 1000)))
            .unwrap_or_default();
        println!("{action} automation {} in {}{when}", def.id, def.place());
        for warning in &warnings {
            println!("warning: {warning}");
        }
    }
    match app_errors.first() {
        None => Ok(()),
        Some(error) => Err(RunError::Internal(format!(
            "automation {} is saved, but the app can't run it: {error}\nfix it with `lpm automations edit {}`",
            def.id, def.id
        ))),
    }
}

/// The app's own view of the saved entry: its rows say whether it can run and
/// when it runs next.
fn app_rows(ctx: &Ctx, def: &Definition) -> Result<Vec<JsonValue>, RunError> {
    let rows = if def.source == GLOBAL {
        value_array(request_value(ctx, "list_all_jobs")?)?
    } else {
        value_array(request_value(
            ctx,
            &format!("list_jobs {}", quote_arg(&def.project)),
        )?)?
    };
    Ok(rows
        .into_iter()
        .filter(|row| value_text(row, "id") == def.id && value_text(row, "source") == def.source)
        .collect())
}
