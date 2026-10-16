//! Config problems in words: what a hand-edited file got wrong, named by its
//! path in the file and, when it can be found, its line. Used by the editors'
//! save check, the project page's error, and the actions a file had to drop.
use super::lenient::{key_text, split_keyed};
use super::{
    ActionDef, ActionFull, ActionInputDef, ActionInputOptionDef, ProjectYaml, ServiceDef,
    ServiceFull, SshSettings,
};
use serde::de::DeserializeOwned;
use serde_norway::{Mapping, Value};

const SERVICE_SHAPE: &str = "expected a command, or a map with cmd, cwd, port, env and dependsOn";
const ACTION_SHAPE: &str = "expected a command, or a map with cmd, label and the other action settings";
const INPUT_SHAPE: &str = "expected a map with label, type, default and the other input settings";

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct Problem {
    path: Vec<String>,
    message: String,
}

impl Problem {
    fn at(path: &[String], message: impl Into<String>) -> Self {
        Self {
            path: path.to_vec(),
            message: message.into(),
        }
    }

    pub(crate) fn text(&self, content: &str) -> String {
        if self.path.is_empty() {
            return self.message.clone();
        }
        let line = locate(content, &self.path)
            .map(|n| format!(" (line {n})"))
            .unwrap_or_default();
        format!("{}{line}: {}", self.path.join(" › "), self.message)
    }
}

fn child(path: &[String], seg: impl Into<String>) -> Vec<String> {
    let mut out = path.to_vec();
    out.push(seg.into());
    out
}

fn nth(i: usize) -> String {
    format!("#{}", i + 1)
}

fn accepts<T: DeserializeOwned>(v: &Value) -> bool {
    serde_norway::from_value::<T>(v.clone()).is_ok()
}

/// What `T` says about a map holding only this field: the field's own fault,
/// with every other field left at its default.
fn field_error<T: DeserializeOwned>(key: &Value, value: &Value) -> Option<String> {
    let mut one = Mapping::new();
    one.insert(key.clone(), value.clone());
    serde_norway::from_value::<T>(Value::Mapping(one))
        .err()
        .map(|e| e.to_string())
}

fn fields<T: DeserializeOwned>(path: &[String], map: &Mapping, out: &mut Vec<Problem>) {
    for (k, v) in map {
        let Some(name) = key_text(k) else { continue };
        if let Some(e) = field_error::<T>(k, v) {
            out.push(Problem::at(&child(path, name), humanize(&e)));
        }
    }
}

/// Problems that make the project itself unreadable.
fn schema_problems(root: &Mapping, out: &mut Vec<Problem>) {
    for (k, v) in root {
        let Some(name) = key_text(k) else { continue };
        let Some(err) = field_error::<ProjectYaml>(k, v) else { continue };
        let path = vec![name.clone()];
        match (name.as_str(), v) {
            ("services", Value::Mapping(map)) => services(&path, map, out),
            ("profiles", Value::Mapping(map)) => {
                for (pk, list) in map {
                    if let Some(p) = key_text(pk).filter(|_| !accepts::<Vec<String>>(list)) {
                        out.push(Problem::at(&child(&path, p), "expected a list of service names"));
                    }
                }
            }
            ("ssh", Value::Mapping(map)) => fields::<SshSettings>(&path, map, out),
            _ => out.push(Problem::at(&path, humanize(&err))),
        }
    }
}

fn services(path: &[String], map: &Mapping, out: &mut Vec<Problem>) {
    for (k, def) in map {
        let Some(name) = key_text(k) else { continue };
        if accepts::<ServiceDef>(def) {
            continue;
        }
        let path = child(path, name);
        let before = out.len();
        if let Value::Mapping(m) = def {
            for (fk, fv) in m {
                let Some(field) = key_text(fk) else { continue };
                let Some(err) = field_error::<ServiceFull>(fk, fv) else { continue };
                let message = if field == "port" { port_message(fv) } else { humanize(&err) };
                out.push(Problem::at(&child(&path, field), message));
            }
        }
        if out.len() == before {
            out.push(Problem::at(&path, SERVICE_SHAPE));
        }
    }
}

fn port_message(v: &Value) -> String {
    match v {
        Value::String(s) => format!("\"{s}\" isn't a port number. Use a number such as 3000."),
        _ => "expected a port number such as 3000".into(),
    }
}

/// Ports out of range or shared by two services: they parse, but the second
/// service to start fails on "address already in use".
fn port_problems(root: &Mapping, out: &mut Vec<Problem>) {
    let Some(Value::Mapping(services)) = root.get("services") else {
        return;
    };
    let mut taken: Vec<(i64, String)> = Vec::new();
    for (k, def) in services {
        let Some(name) = key_text(k) else { continue };
        let Ok(ServiceDef::Full(full)) = serde_norway::from_value::<ServiceDef>(def.clone()) else {
            continue;
        };
        let path = vec!["services".to_string(), name.clone(), "port".to_string()];
        if !(0..=65535).contains(&full.port) {
            out.push(Problem::at(&path, "a port is a number from 1 to 65535"));
        } else if full.port > 0 {
            match taken.iter().find(|(p, _)| *p == full.port) {
                Some((_, first)) => out.push(Problem::at(
                    &path,
                    format!("{} is also {first}'s port. Each service needs a port of its own.", full.port),
                )),
                None => taken.push((full.port, name)),
            }
        }
    }
}

pub(super) fn action_map(path: &[String], v: &Value, out: &mut Vec<Problem>) {
    match v {
        Value::Mapping(map) => {
            for (k, entry) in map {
                if let Some(name) = key_text(k) {
                    action(&child(path, name), entry, out);
                }
            }
        }
        Value::Null => {}
        _ => out.push(Problem::at(path, "expected a map of actions keyed by name")),
    }
}

fn action(path: &[String], v: &Value, out: &mut Vec<Problem>) {
    let ok = accepts::<ActionDef>(v);
    let Value::Mapping(m) = v else {
        if !ok {
            out.push(Problem::at(path, ACTION_SHAPE));
        }
        return;
    };
    if let Some(children) = m.get("actions") {
        action_map(&child(path, "actions"), children, out);
    }
    if ok {
        return;
    }
    let before = out.len();
    for (k, fv) in m {
        let Some(field) = key_text(k) else { continue };
        match field.as_str() {
            "actions" => {}
            "inputs" => inputs(&child(path, "inputs"), k, fv, out),
            _ => {
                if let Some(e) = field_error::<ActionFull>(k, fv) {
                    out.push(Problem::at(&child(path, field), humanize(&e)));
                }
            }
        }
    }
    if out.len() == before {
        out.push(Problem::at(path, ACTION_SHAPE));
    }
}

fn inputs(path: &[String], key: &Value, v: &Value, out: &mut Vec<Problem>) {
    if field_error::<ActionFull>(key, v).is_none() {
        return;
    }
    match v {
        Value::Mapping(map) => {
            for (k, input) in map {
                if let Some(name) = key_text(k) {
                    one_input(&child(path, name), input, out);
                }
            }
        }
        Value::Sequence(items) => {
            for (i, item) in items.iter().enumerate() {
                match split_keyed(item.clone()) {
                    Some((name, rest)) => one_input(&child(path, name), &rest, out),
                    None => out.push(Problem::at(&child(path, nth(i)), "each input in a list needs a `key`")),
                }
            }
        }
        _ => out.push(Problem::at(path, "expected a map of inputs keyed by name")),
    }
}

fn one_input(path: &[String], v: &Value, out: &mut Vec<Problem>) {
    if accepts::<ActionInputDef>(v) {
        return;
    }
    let before = out.len();
    if let Value::Mapping(m) = v {
        for (k, fv) in m {
            let Some(field) = key_text(k) else { continue };
            let Some(err) = field_error::<ActionInputDef>(k, fv) else { continue };
            match (field.as_str(), fv) {
                ("options", Value::Sequence(items)) => options(&child(path, "options"), items, out),
                _ => out.push(Problem::at(&child(path, field), humanize(&err))),
            }
        }
    }
    if out.len() == before {
        out.push(Problem::at(path, INPUT_SHAPE));
    }
}

fn options(path: &[String], items: &[Value], out: &mut Vec<Problem>) {
    for (i, item) in items.iter().enumerate() {
        if accepts::<ActionInputOptionDef>(item) {
            continue;
        }
        let missing = |f: &str| matches!(item, Value::Mapping(m) if !m.contains_key(f));
        let message = if missing("value") {
            "has no `value`. An option needs both a label and a value, or can be plain text."
        } else if missing("label") {
            "has no `label`. An option needs both a label and a value, or can be plain text."
        } else {
            "an option is plain text, or a map with both a label and a value"
        };
        out.push(Problem::at(&child(path, nth(i)), message));
    }
}

/// serde's wording, in the user's.
fn humanize(err: &str) -> String {
    let err = strip_location(err);
    if let Some(field) = err
        .split_once("missing field `")
        .and_then(|(_, rest)| rest.split_once('`'))
        .map(|(f, _)| f)
    {
        return format!("needs a `{field}`");
    }
    if let Some((found, expected)) = err
        .split_once("invalid type: ")
        .and_then(|(_, rest)| rest.split_once(", expected "))
    {
        return format!("expected {}, found {}", expected_words(expected), found_words(found));
    }
    for (name, words) in [
        ("ServiceDef", SERVICE_SHAPE),
        ("ActionDef", ACTION_SHAPE),
        ("PortSpec", "expected a port number, a range such as \"3000-3010\", or a list of them"),
        ("ActionInputOptionDef", "an option is plain text, or a map with both a label and a value"),
    ] {
        if err.contains(&format!("untagged enum {name}")) {
            return words.into();
        }
    }
    err.to_string()
}

fn strip_location(err: &str) -> &str {
    match err.rfind(" at line ") {
        Some(i) if err[i..].contains(" column ") => &err[..i],
        _ => err,
    }
}

fn expected_words(expected: &str) -> String {
    match expected {
        "i8" | "i16" | "i32" | "i64" | "u8" | "u16" | "u32" | "u64" | "usize" | "isize" => {
            "a whole number".into()
        }
        "f32" | "f64" => "a number".into(),
        "a boolean" => "true or false".into(),
        "a string" => "text".into(),
        "a sequence" => "a list".into(),
        e if e.starts_with("struct ") => "a map".into(),
        e => e.into(),
    }
}

fn found_words(found: &str) -> String {
    if let Some(s) = found.strip_prefix("string ") {
        return s.into();
    }
    for (prefix, words) in [
        ("sequence", "a list"),
        ("map", "a map"),
        ("unit value", "nothing"),
    ] {
        if found == prefix {
            return words.into();
        }
    }
    for prefix in ["integer ", "floating point ", "boolean "] {
        if let Some(v) = found.strip_prefix(prefix) {
            return v.trim_matches('`').into();
        }
    }
    found.into()
}

/// The 1-based line of the deepest key of `path` found in block-style YAML.
fn locate(content: &str, path: &[String]) -> Option<usize> {
    let lines: Vec<&str> = content.lines().collect();
    let (mut from, mut parent_indent, mut found) = (0usize, -1i64, None);
    for seg in path {
        let mut hit = None;
        for (i, line) in lines.iter().enumerate().skip(from) {
            let text = line.trim_start();
            if text.is_empty() || text.starts_with('#') {
                continue;
            }
            let indent = (line.len() - text.len()) as i64;
            if indent <= parent_indent {
                break;
            }
            let key = text.trim_start_matches("- ");
            let quoted = [format!("{seg}:"), format!("\"{seg}\":"), format!("'{seg}':")];
            if quoted.iter().any(|q| key.starts_with(q.as_str())) {
                hit = Some((i, indent));
                break;
            }
        }
        let Some((i, indent)) = hit else { break };
        found = Some(i + 1);
        from = i + 1;
        parent_indent = indent;
    }
    found
}

fn problems(doc: &Value) -> Vec<Problem> {
    let mut out = Vec::new();
    let Value::Mapping(root) = doc else {
        if !doc.is_null() {
            out.push(Problem::at(&[], "The config must be a map of settings (root, services, actions…)."));
        }
        return out;
    };
    schema_problems(root, &mut out);
    port_problems(root, &mut out);
    for section in ["actions", "terminals"] {
        if let Some(v) = root.get(section) {
            action_map(&[section.to_string()], v, &mut out);
        }
    }
    out
}

fn parse(content: &str) -> Result<Value, String> {
    serde_norway::from_str(content).map_err(|e| format!("invalid YAML: {e}"))
}

/// Refuses `next` when it brings a problem `current` doesn't already have, so a
/// file that was already off can still take an unrelated edit.
pub(crate) fn refuse_new_problems(current: &str, next: &str) -> Result<(), String> {
    let found = problems(&parse(next)?);
    if found.is_empty() {
        return Ok(());
    }
    let mut known = parse(current).map(|d| problems(&d)).unwrap_or_default();
    let fresh: Vec<&Problem> = found
        .iter()
        .filter(|p| match known.iter().position(|k| k == *p) {
            Some(i) => {
                known.remove(i);
                false
            }
            None => true,
        })
        .collect();
    if fresh.is_empty() {
        return Ok(());
    }
    const SHOWN: usize = 3;
    let mut lines: Vec<String> = fresh.iter().take(SHOWN).map(|p| p.text(next)).collect();
    if fresh.len() > SHOWN {
        lines.push(format!("…and {} more", fresh.len() - SHOWN));
    }
    Err(lines.join("\n"))
}

/// The project file failed to load: say where, in words, instead of serde's
/// "data did not match any variant of untagged enum".
pub(crate) fn explain_load_error(content: &[u8], err: &serde_norway::Error) -> String {
    let text = String::from_utf8_lossy(content);
    let Ok(Value::Mapping(root)) = serde_norway::from_str::<Value>(&text) else {
        return err.to_string();
    };
    let mut out = Vec::new();
    schema_problems(&root, &mut out);
    match out.first() {
        Some(p) => p.text(&text),
        None => humanize(&err.to_string()),
    }
}

/// The actions this file's text leaves out, each in words.
pub(crate) fn dropped_actions(content: &str) -> Vec<String> {
    let Ok(Value::Mapping(root)) = serde_norway::from_str::<Value>(content) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for section in ["actions", "terminals"] {
        if let Some(v) = root.get(section) {
            action_map(&[section.to_string()], v, &mut out);
        }
    }
    out.iter().map(|p| p.text(content)).collect()
}

fn extends_of(content: &str) -> Vec<String> {
    #[derive(serde::Deserialize, Default)]
    struct Extends {
        #[serde(default, deserialize_with = "super::lenient::strings")]
        extends: Vec<String>,
    }
    serde_norway::from_str::<Extends>(content)
        .map(|e| e.extends)
        .unwrap_or_default()
}

/// The actions left out of a project because they don't parse, from the files
/// its actions come from: its own (a copy's parent's too), the repo's
/// `.lpm.yml`, and the templates those extend. Global actions are left to the
/// global editor.
pub(crate) fn project_dropped_actions(file_name: &str, root: &str, is_remote: bool) -> Vec<String> {
    let mut files = vec![(String::new(), super::project_path(file_name))];
    if let Some(parent) = super::peek_parent(file_name) {
        files.push((String::new(), super::project_path(&parent)));
    }
    if !is_remote && !root.is_empty() {
        files.push((".lpm.yml: ".into(), std::path::Path::new(root).join(".lpm.yml")));
    }
    let mut templates: Vec<String> = Vec::new();
    let mut out = Vec::new();
    for (prefix, path) in files {
        let Ok(content) = std::fs::read_to_string(&path) else { continue };
        out.extend(dropped_actions(&content).into_iter().map(|t| format!("{prefix}{t}")));
        for name in extends_of(&content) {
            if templates.contains(&name) {
                continue;
            }
            let found = super::template_actions_path(&name).and_then(|p| std::fs::read_to_string(p).ok());
            if let Some(text) = found {
                out.extend(dropped_actions(&text).into_iter().map(|t| format!("template {name}: {t}")));
            }
            templates.push(name);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn texts(content: &str) -> Vec<String> {
        problems(&parse(content).unwrap())
            .iter()
            .map(|p| p.text(content))
            .collect()
    }

    #[test]
    fn a_port_that_is_not_a_number_is_named_with_its_line() {
        let yml = "root: /tmp/x\nservices:\n  web:\n    cmd: npm start\n    port: abc\n";
        assert_eq!(
            texts(yml),
            vec!["services › web › port (line 5): \"abc\" isn't a port number. Use a number such as 3000."]
        );
        let err = serde_norway::from_str::<ProjectYaml>(yml).err().unwrap();
        assert_eq!(explain_load_error(yml.as_bytes(), &err), texts(yml)[0]);
    }

    #[test]
    fn two_services_on_one_port_are_a_problem() {
        let yml = "services:\n  web:\n    cmd: a\n    port: 4402\n  api2:\n    cmd: b\n    port: 4402\n  other:\n    cmd: c\n";
        assert_eq!(
            texts(yml),
            vec!["services › api2 › port (line 7): 4402 is also web's port. Each service needs a port of its own."]
        );
    }

    #[test]
    fn a_radio_option_without_a_value_names_the_action() {
        let yml = "actions:\n  ok: echo ok\n  pick:\n    cmd: echo {{choice}}\n    inputs:\n      choice:\n        type: radio\n        options:\n          - label: Only label\n";
        assert_eq!(
            texts(yml),
            vec!["actions › pick › inputs › choice › options › #1 (line 8): has no `value`. An option needs both a label and a value, or can be plain text."]
        );
        assert_eq!(dropped_actions(yml).len(), 1);
    }

    #[test]
    fn list_inputs_are_fine_unless_an_entry_has_no_key() {
        let fine = "actions:\n  greet:\n    cmd: echo {{who}}\n    inputs:\n      - key: who\n        default: World\n";
        assert!(texts(fine).is_empty());
        let keyless = "actions:\n  greet:\n    cmd: echo {{who}}\n    inputs:\n      - label: Who\n";
        assert_eq!(
            texts(keyless),
            vec!["actions › greet › inputs › #1 (line 4): each input in a list needs a `key`"]
        );
    }

    #[test]
    fn a_bad_child_is_named_under_its_parent() {
        let yml = "actions:\n  deploy:\n    actions:\n      prod:\n        cmd: [1]\n";
        assert_eq!(
            texts(yml),
            vec!["actions › deploy › actions › prod › cmd (line 5): expected text, found a list"]
        );
    }

    #[test]
    fn an_existing_problem_does_not_block_an_unrelated_edit() {
        let before = "services:\n  web:\n    cmd: a\n    port: 3000\n  api:\n    cmd: b\n    port: 3000\n";
        let after = format!("{before}label: Renamed\n");
        assert!(refuse_new_problems(before, &after).is_ok());
        let worse = "services:\n  web:\n    cmd: a\n    port: abc\n";
        let err = refuse_new_problems(before, worse).unwrap_err();
        assert!(err.starts_with("services › web › port (line 4)"), "{err}");
        assert!(refuse_new_problems("", "services: {}\n").is_ok());
        assert!(refuse_new_problems("", "bad: [unclosed\n").unwrap_err().starts_with("invalid YAML"));
    }

    #[test]
    fn wrong_types_read_as_words() {
        assert_eq!(
            humanize("invalid type: string \"x\", expected a boolean at line 3 column 9"),
            "expected true or false, found \"x\""
        );
        assert_eq!(humanize("services: data did not match any variant of untagged enum ServiceDef at line 5 column 3"), SERVICE_SHAPE);
        assert_eq!(humanize("missing field `value`"), "needs a `value`");
    }

    #[test]
    fn a_service_given_a_list_is_explained() {
        let yml = "services:\n  web: true\n  fine: x\nssh: 5\n";
        let found = texts(yml);
        assert_eq!(found[0], format!("services › web (line 2): {SERVICE_SHAPE}"));
        assert_eq!(found[1], "ssh (line 4): expected a map, found 5");
        assert_eq!(found.len(), 2);
    }
}
