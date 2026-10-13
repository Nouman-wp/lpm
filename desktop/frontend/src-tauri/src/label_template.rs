//! The text of a dynamic label: `{{…}}` variables lpm fills in itself, and
//! `$(…)` commands whose first line of output goes in their place.

use crate::label_git::Bump;

#[derive(Debug, PartialEq)]
pub(crate) enum Var<'a> {
    Project,
    Branch,
    Tag(&'a str),
    TagAge(&'a str),
    Next(Bump, &'a str),
}

#[derive(Debug, PartialEq)]
pub(crate) enum Part<'a> {
    Var(Var<'a>),
    Cmd(&'a str),
}

pub(crate) fn is_dynamic(text: &str) -> bool {
    text.contains("{{") || text.contains("$(")
}

pub(crate) fn parse_var(inner: &str) -> Option<Var<'_>> {
    let inner = inner.trim();
    let (name, arg) = match inner.split_once(':') {
        Some((name, arg)) => (name.trim(), arg.trim()),
        None => (inner, ""),
    };
    match (name, arg.is_empty()) {
        ("project", true) => Some(Var::Project),
        ("git.branch", true) => Some(Var::Branch),
        ("git.tag", _) => Some(Var::Tag(arg)),
        ("git.tagAge", _) => Some(Var::TagAge(arg)),
        ("git.nextPatch", _) => Some(Var::Next(Bump::Patch, arg)),
        ("git.nextMinor", _) => Some(Var::Next(Bump::Minor, arg)),
        ("git.nextMajor", _) => Some(Var::Next(Bump::Major, arg)),
        _ => None,
    }
}

/// Fills every known variable and runs every command. An unknown `{{…}}`, or a
/// `$(` that never closes, stays as written so the mistake shows on the button.
/// A command runs as written: variables inside it are not filled, so a branch
/// name can never turn into shell code. When a part comes back empty, the
/// brackets and separators it leaves dangling go too: "Release · {{git.tag}}"
/// reads "Release", "Patch ($(./next.sh))" reads "Patch".
pub(crate) fn render(template: &str, mut value: impl FnMut(&Part) -> String) -> String {
    let mut out = String::with_capacity(template.len());
    let mut rest = template;
    let mut emptied = false;
    loop {
        let (at, is_cmd) = match (rest.find("{{"), rest.find("$(")) {
            (None, None) => break,
            (Some(var), Some(cmd)) => (var.min(cmd), cmd < var),
            (Some(var), None) => (var, false),
            (None, Some(cmd)) => (cmd, true),
        };
        out.push_str(&rest[..at]);
        let after = &rest[at + 2..];
        let found = if is_cmd {
            command_end(after).map(|close| {
                let cmd = after[..close].trim();
                ((!cmd.is_empty()).then_some(Part::Cmd(cmd)), close + 1)
            })
        } else {
            after
                .find("}}")
                .map(|close| (parse_var(&after[..close]).map(Part::Var), close + 2))
        };
        match found {
            Some((Some(part), len)) => {
                let v = value(&part);
                emptied |= v.is_empty();
                out.push_str(&v);
                rest = &after[len..];
            }
            Some((None, len)) => {
                out.push_str(&rest[at..at + 2 + len]);
                rest = &after[len..];
            }
            None => {
                out.push_str(&rest[at..at + 2]);
                rest = after;
            }
        }
    }
    out.push_str(rest);
    if emptied {
        tidy(&out)
    } else {
        out
    }
}

#[derive(PartialEq)]
enum Scope {
    Command,
    Quoted,
}

/// Where the command a `$(` opens ends: the index in `s`, the text after the
/// `$(`, of its closing `)`. Follows the shell: quotes, escapes, nested
/// `$(…)` and parentheses inside the command don't end it. None when it never
/// closes.
pub(crate) fn command_end(s: &str) -> Option<usize> {
    let bytes = s.as_bytes();
    let mut scopes = vec![Scope::Command];
    let mut i = 0;
    while i < bytes.len() {
        let in_quotes = scopes.last() == Some(&Scope::Quoted);
        match bytes[i] {
            b'\\' => i += 1,
            b'"' if in_quotes => {
                scopes.pop();
            }
            b'"' => scopes.push(Scope::Quoted),
            b'$' if in_quotes && bytes.get(i + 1) == Some(&b'(') => {
                scopes.push(Scope::Command);
                i += 1;
            }
            b'\'' if !in_quotes => i += s[i + 1..].find('\'')? + 1,
            b'(' if !in_quotes => scopes.push(Scope::Command),
            b')' if !in_quotes => {
                scopes.pop();
                if scopes.is_empty() {
                    return Some(i);
                }
            }
            _ => {}
        }
        i += 1;
    }
    None
}

const SEPARATORS: &[&str] = &["·", "•", "|", "-", "–", "—", "/", ":"];

fn tidy(s: &str) -> String {
    let s = s.replace("()", "").replace("[]", "");
    let mut words: Vec<&str> = Vec::new();
    for w in s.split_whitespace() {
        if SEPARATORS.contains(&w) && words.last().is_none_or(|l| SEPARATORS.contains(l)) {
            continue;
        }
        words.push(w);
    }
    while words.last().is_some_and(|w| SEPARATORS.contains(w)) {
        words.pop();
    }
    words.join(" ")
}

#[cfg(test)]
#[path = "label_template_tests.rs"]
mod tests;
