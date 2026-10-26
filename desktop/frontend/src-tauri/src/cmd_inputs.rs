//! `{{key}}` input substitution into an action's shell command. Each answer is
//! quoted for the spot its token sits in — bare, inside "…", or inside '…' — so
//! it always stays one piece of data: `echo "hi {{name}}"` with `Ana Smith`
//! runs `echo "hi "'Ana Smith'""`, never `echo "hi 'Ana Smith'"`, and a `$(…)`
//! answer is never expanded. `{{key|raw}}` splices the answer verbatim.
//! Mirrors substituteCommand in commandInputs.ts.

use std::collections::HashMap;

#[derive(Clone, Copy)]
enum Context {
    Bare,
    Double,
    Single,
    Group,
}

/// Characters that pass through a POSIX shell unquoted. Matches shellSafeValue
/// in commandInputs.ts.
fn shell_safe(v: &str) -> bool {
    !v.is_empty()
        && v.bytes().all(|b| {
            b.is_ascii_alphanumeric()
                | matches!(
                    b,
                    b'_' | b'@' | b'%' | b'+' | b'=' | b':' | b',' | b'.' | b'/' | b'-'
                )
        })
}

fn quoted(v: &str, ctx: Context) -> String {
    if shell_safe(v) {
        return v.to_string();
    }
    let single = crate::config::shell_quote(v);
    match ctx {
        Context::Bare | Context::Group => single,
        Context::Double if v.is_empty() => String::new(),
        Context::Double => format!("\"{single}\""),
        Context::Single => v.replace('\'', "'\\''"),
    }
}

pub(crate) fn substitute_cmd(cmd: &str, values: &HashMap<String, String>) -> String {
    let mut out = String::with_capacity(cmd.len());
    let mut stack: Vec<Context> = Vec::new();
    let mut rest = cmd;
    while let Some(c) = rest.chars().next() {
        let ctx = stack.last().copied().unwrap_or(Context::Bare);
        if let Some((token, len)) = token_at(rest, values) {
            out.push_str(&match token {
                Token::Raw(v) => v.to_string(),
                Token::Quoted(v) => quoted(v, ctx),
            });
            rest = &rest[len..];
            continue;
        }
        let mut len = c.len_utf8();
        match (ctx, c) {
            (Context::Single, '\'') | (Context::Double, '"') | (Context::Group, ')') => {
                stack.pop();
            }
            (Context::Single, _) => {}
            (_, '\\') => len += rest[len..].chars().next().map_or(0, char::len_utf8),
            (_, '$') if rest[1..].starts_with('(') => {
                stack.push(Context::Group);
                len += 1;
            }
            (Context::Double, _) => {}
            (_, '\'') => stack.push(Context::Single),
            (_, '"') => stack.push(Context::Double),
            (_, '(') => stack.push(Context::Group),
            _ => {}
        }
        out.push_str(&rest[..len]);
        rest = &rest[len..];
    }
    out
}

enum Token<'a> {
    Raw(&'a str),
    Quoted(&'a str),
}

fn token_at<'a>(s: &str, values: &'a HashMap<String, String>) -> Option<(Token<'a>, usize)> {
    let inner = s.strip_prefix("{{")?;
    let end = inner.find("}}")?;
    let name = &inner[..end];
    let token = match name.strip_suffix("|raw") {
        Some(key) => Token::Raw(values.get(key)?),
        None => Token::Quoted(values.get(name)?),
    };
    Some((token, end + 4))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sub(cmd: &str, pairs: &[(&str, &str)]) -> String {
        let values = pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect();
        substitute_cmd(cmd, &values)
    }

    #[test]
    fn bare_values_are_single_quoted_unless_safe() {
        assert_eq!(sub("deploy --env {{env}}", &[("env", "staging")]), "deploy --env staging");
        assert_eq!(sub("git tag {{tag}}", &[("tag", "v1 final")]), "git tag 'v1 final'");
        assert_eq!(sub("echo {{msg}}", &[("msg", "it's")]), "echo 'it'\\''s'");
        assert_eq!(sub("run {{flag}}", &[("flag", "")]), "run ''");
    }

    #[test]
    fn inside_double_quotes_the_string_is_closed_around_the_answer() {
        assert_eq!(
            sub("echo \"hello {{who}} from {{place}}\"", &[("who", "Ana Smith"), ("place", "office")]),
            "echo \"hello \"'Ana Smith'\" from office\""
        );
        assert_eq!(sub("echo \"{{x}}\"", &[("x", "$(whoami)")]), "echo \"\"'$(whoami)'\"\"");
        assert_eq!(sub("echo \"[{{x}}]\"", &[("x", "")]), "echo \"[]\"");
    }

    #[test]
    fn inside_single_quotes_only_the_quote_is_escaped() {
        assert_eq!(sub("echo 'hi {{x}}!'", &[("x", "it's me")]), "echo 'hi it'\\''s me!'");
    }

    #[test]
    fn command_substitution_resets_the_quoting() {
        assert_eq!(
            sub("echo \"$(printf %s {{x}})\" {{y}}", &[("x", "a b"), ("y", "c d")]),
            "echo \"$(printf %s 'a b')\" 'c d'"
        );
    }

    #[test]
    fn escaped_quotes_do_not_open_a_string() {
        assert_eq!(sub("echo \\\"{{x}}", &[("x", "a b")]), "echo \\\"'a b'");
        assert_eq!(sub("echo \"a\\\"{{x}}\"", &[("x", "a b")]), "echo \"a\\\"\"'a b'\"\"");
    }

    #[test]
    fn raw_tokens_and_unknown_keys() {
        assert_eq!(sub("sh -c {{frag|raw}}", &[("frag", "a | b")]), "sh -c a | b");
        assert_eq!(sub("echo {{other}} {{x}}", &[("x", "y")]), "echo {{other}} y");
    }
}
