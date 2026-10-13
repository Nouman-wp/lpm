use super::*;

fn fixed<'a>(values: &'a [(&'a str, &'a str)]) -> impl FnMut(&Part) -> String + 'a {
    move |part| {
        let name = match part {
            Part::Cmd(cmd) => cmd,
            Part::Var(Var::Project) => "project",
            Part::Var(Var::Branch) => "git.branch",
            Part::Var(Var::Tag(_)) => "git.tag",
            Part::Var(Var::TagAge(_)) => "git.tagAge",
            Part::Var(Var::Next(Bump::Patch, _)) => "git.nextPatch",
            Part::Var(Var::Next(Bump::Minor, _)) => "git.nextMinor",
            Part::Var(Var::Next(Bump::Major, _)) => "git.nextMajor",
        };
        values
            .iter()
            .find(|(k, _)| *k == name)
            .map(|(_, v)| v.to_string())
            .unwrap_or_default()
    }
}

#[test]
fn parse_var_knows_the_variables_and_their_patterns() {
    assert_eq!(parse_var("project"), Some(Var::Project));
    assert_eq!(parse_var(" git.branch "), Some(Var::Branch));
    assert_eq!(parse_var("git.tag"), Some(Var::Tag("")));
    assert_eq!(parse_var("git.tag:v*"), Some(Var::Tag("v*")));
    assert_eq!(parse_var("git.tagAge: v*"), Some(Var::TagAge("v*")));
    assert_eq!(parse_var("git.nextPatch"), Some(Var::Next(Bump::Patch, "")));
    assert_eq!(
        parse_var("git.nextMinor:v*"),
        Some(Var::Next(Bump::Minor, "v*"))
    );
    assert_eq!(parse_var("git.nextMajor"), Some(Var::Next(Bump::Major, "")));
    assert_eq!(parse_var("output"), None);
    assert_eq!(parse_var("bump"), None);
    assert_eq!(parse_var("project:x"), None);
}

#[test]
fn render_fills_variables_and_commands() {
    let out = render(
        "🚀 Release · {{git.tag:v*}} · {{git.tagAge:v*}}",
        fixed(&[("git.tag", "v0.7.13"), ("git.tagAge", "6h ago")]),
    );
    assert_eq!(out, "🚀 Release · v0.7.13 · 6h ago");
    let out = render(
        "Release · $(git describe --tags --abbrev=0) · {{git.tagAge}}",
        fixed(&[
            ("git describe --tags --abbrev=0", "v0.7.13"),
            ("git.tagAge", "6h ago"),
        ]),
    );
    assert_eq!(out, "Release · v0.7.13 · 6h ago");
}

#[test]
fn a_command_runs_as_written_with_its_quotes_and_nesting() {
    let pending = r#"[ -n "$(git log "$(git describe --tags --abbrev=0)"..HEAD --oneline)" ] && echo 🟡 || echo 🟢"#;
    let mut seen = Vec::new();
    let out = render(&format!("$({pending}) Release"), |part| {
        if let Part::Cmd(cmd) = part {
            seen.push(cmd.to_string());
        }
        "🟡".into()
    });
    assert_eq!(out, "🟡 Release");
    assert_eq!(seen, [pending]);

    let mut seen = Vec::new();
    render("A $( echo {{git.branch}} ) B", |part| {
        seen.push(format!("{part:?}"));
        "x".into()
    });
    assert_eq!(seen, [r#"Cmd("echo {{git.branch}}")"#]);
}

fn end(s: &str) -> Option<&str> {
    command_end(s).map(|i| &s[..i])
}

#[test]
fn command_end_follows_shell_quoting() {
    assert_eq!(end("git describe) tail"), Some("git describe"));
    assert_eq!(end("echo ')' ) tail"), Some("echo ')' "));
    assert_eq!(end(r#"echo ")" ) tail"#), Some(r#"echo ")" "#));
    assert_eq!(end(r"echo \) ) tail"), Some(r"echo \) "));
    assert_eq!(end("echo $((1 + 2)) ) tail"), Some("echo $((1 + 2)) "));
    assert_eq!(end("(cd app && ls) ) tail"), Some("(cd app && ls) "));
    assert_eq!(
        end(r#"echo "$(date "+%H)")" ) tail"#),
        Some(r#"echo "$(date "+%H)")" "#)
    );
    assert_eq!(end("echo 🟢) tail"), Some("echo 🟢"));
    assert_eq!(end("git describe"), None);
    assert_eq!(end("echo 'unclosed )"), None);
}

#[test]
fn render_keeps_unknown_tokens_and_unclosed_commands_as_written() {
    assert_eq!(render("Deploy {{bump}}", fixed(&[])), "Deploy {{bump}}");
    assert_eq!(render("Open {{ unclosed", fixed(&[])), "Open {{ unclosed");
    assert_eq!(render("Cost $(echo 1", fixed(&[])), "Cost $(echo 1");
    assert_eq!(render("Run $() now", fixed(&[])), "Run $() now");
    assert_eq!(
        render("$(echo 1 {{git.branch}}", fixed(&[("git.branch", "main")])),
        "$(echo 1 main"
    );
}

#[test]
fn render_drops_brackets_and_separators_an_empty_part_leaves() {
    let out = render("🚀 Release · {{git.tag}} · {{git.tagAge}}", fixed(&[]));
    assert_eq!(out, "🚀 Release");
    assert_eq!(render("{{git.branch}} | Deploy", fixed(&[])), "Deploy");
    assert_eq!(render("A · {{git.tag}} · B", fixed(&[])), "A · B");
    let out = render("Patch — bug fixes ($(./next.sh patch))", fixed(&[]));
    assert_eq!(out, "Patch — bug fixes");
}

#[test]
fn render_leaves_spacing_alone_when_every_part_has_a_value() {
    let out = render("Run  ·  {{git.branch}}", fixed(&[("git.branch", "main")]));
    assert_eq!(out, "Run  ·  main");
}

#[test]
fn is_dynamic_spots_variables_and_commands() {
    assert!(is_dynamic("Release {{git.tag}}"));
    assert!(is_dynamic("Release $(git describe)"));
    assert!(!is_dynamic("Release (beta) $5"));
}
