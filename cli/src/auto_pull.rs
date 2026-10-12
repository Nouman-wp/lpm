//! `lpm auto-pull [project] [--set on|off|default] [--all]` — show or set whether
//! the app fast-forwards a project by itself. Resolved as the app resolves it:
//! the mode in `settings.json` gates everything, then the project's own
//! `autoPull` key, then (for a duplicate or worktree) its parent's, then the
//! mode's default. `--set` asks the running app to change the project's own key.

use crate::config::{self, Ctx};
use crate::control;
use crate::error::{resolve_or_infer, RunError};
use crate::statussock::quote_arg;
use crate::style::Style;
use crate::util::print_json;
use serde_json::{json, Value as JsonValue};
use serde_norway::{Mapping, Value};
use std::io::IsTerminal;

const KEY: &str = "autoPull";

#[derive(clap::ValueEnum, Clone, Copy)]
pub enum Setting {
    /// Pull this project by itself.
    On,
    /// Never pull this project by itself.
    Off,
    /// Drop the project's own setting: follow its parent, else the default.
    Default,
}

impl Setting {
    fn word(self) -> &'static str {
        match self {
            Setting::On => "on",
            Setting::Off => "off",
            Setting::Default => "default",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Mode {
    Off,
    Chosen,
    All,
}

impl Mode {
    fn parse(value: Option<&str>) -> Self {
        match value {
            Some("chosen") => Mode::Chosen,
            Some("all") => Mode::All,
            _ => Mode::Off,
        }
    }
    fn as_str(self) -> &'static str {
        match self {
            Mode::Off => "off",
            Mode::Chosen => "chosen",
            Mode::All => "all",
        }
    }
    fn label(self) -> &'static str {
        match self {
            Mode::Off => "Off",
            Mode::Chosen => "Chosen projects",
            Mode::All => "All projects",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Source {
    Settings,
    Project,
    Parent,
    Default,
}

impl Source {
    fn as_str(self) -> &'static str {
        match self {
            Source::Settings => "settings",
            Source::Project => "project",
            Source::Parent => "parent",
            Source::Default => "default",
        }
    }
}

struct State {
    name: String,
    own: Option<bool>,
    parent: Option<String>,
    effective: bool,
    source: Source,
}

fn effective(mode: Mode, own: Option<bool>, parent: Option<bool>) -> (bool, Source) {
    if mode == Mode::Off {
        return (false, Source::Settings);
    }
    if let Some(on) = own {
        return (on, Source::Project);
    }
    if let Some(on) = parent {
        return (on, Source::Parent);
    }
    (mode == Mode::All, Source::Default)
}

fn read_mode(ctx: &Ctx) -> Mode {
    let settings = std::fs::read(ctx.settings_path())
        .ok()
        .and_then(|bytes| serde_json::from_slice::<JsonValue>(&bytes).ok());
    Mode::parse(
        settings
            .as_ref()
            .and_then(|s| s.get(KEY))
            .and_then(JsonValue::as_str),
    )
}

fn read_project(ctx: &Ctx, name: &str) -> Mapping {
    std::fs::read(ctx.project_path(name))
        .ok()
        .and_then(|bytes| serde_norway::from_slice(&bytes).ok())
        .unwrap_or_default()
}

fn own_value(doc: &Mapping) -> Option<bool> {
    doc.get(KEY).and_then(Value::as_bool)
}

fn state(ctx: &Ctx, mode: Mode, name: &str) -> State {
    let doc = read_project(ctx, name);
    let own = own_value(&doc);
    let parent = doc
        .get("parent_name")
        .and_then(Value::as_str)
        .filter(|p| !p.is_empty())
        .map(String::from);
    let inherited = parent
        .as_deref()
        .and_then(|p| own_value(&read_project(ctx, p)));
    let (effective, source) = effective(mode, own, inherited);
    State {
        name: name.to_string(),
        own,
        parent,
        effective,
        source,
    }
}

fn on_off(on: bool) -> &'static str {
    if on {
        "on"
    } else {
        "off"
    }
}

fn reason(state: &State, mode: Mode) -> String {
    match state.source {
        Source::Settings => match state.own {
            Some(own) => format!(
                "Auto pull is Off in Settings; this project is set to {}",
                on_off(own)
            ),
            None => "Auto pull is Off in Settings".into(),
        },
        Source::Project => "set on this project".into(),
        Source::Parent => format!("same as {}", state.parent.as_deref().unwrap_or_default()),
        Source::Default => format!("default: {}", mode.label()),
    }
}

fn render_line(style: &Style, state: &State, mode: Mode) -> String {
    let word = if state.effective {
        style.green("on")
    } else {
        style.dim("off")
    };
    format!(
        "{}: {word} {}",
        style.bold(&state.name),
        style.dim(&format!("({})", reason(state, mode)))
    )
}

fn state_json(state: &State) -> JsonValue {
    json!({
        "name": state.name,
        "autoPull": state.own,
        "effective": state.effective,
        "source": state.source.as_str(),
        "parent": state.parent,
    })
}

pub fn run(
    ctx: &Ctx,
    name: Option<&str>,
    set: Option<Setting>,
    all: bool,
    as_json: bool,
) -> Result<(), RunError> {
    let mode = read_mode(ctx);
    let style = Style {
        on: std::io::stdout().is_terminal(),
    };
    if all {
        let states: Vec<State> = config::project_names(ctx)
            .iter()
            .map(|name| state(ctx, mode, name))
            .collect();
        if as_json {
            let projects: Vec<JsonValue> = states.iter().map(state_json).collect();
            print_json(&json!({ "mode": mode.as_str(), "projects": projects }));
        } else if states.is_empty() {
            println!("{}", style.dim("no projects found in ~/.lpm/projects"));
        } else {
            for state in &states {
                println!("{}", render_line(&style, state, mode));
            }
        }
        return Ok(());
    }

    if set.is_some() {
        control::require_app(ctx)?;
    }
    let name = resolve_or_infer(ctx, name)?;
    if let Some(setting) = set {
        control::send_command(
            ctx,
            &format!("set_auto_pull {} {}", quote_arg(&name), setting.word()),
        )?;
    }
    let state = state(ctx, mode, &name);
    if as_json {
        let mut value = state_json(&state);
        value["mode"] = json!(mode.as_str());
        print_json(&value);
    } else {
        println!("{}", render_line(&style, &state, mode));
    }
    Ok(())
}

#[cfg(test)]
#[path = "auto_pull_tests.rs"]
mod tests;
