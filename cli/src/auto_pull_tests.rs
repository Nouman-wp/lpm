use super::*;
use crate::statussock::net::UnixListener;
use std::io::{BufRead, BufReader, Write};

fn ctx_with(settings: Option<&str>, files: &[(&str, &str)]) -> (tempfile::TempDir, Ctx) {
    let dir = tempfile::tempdir().unwrap();
    let ctx = Ctx {
        lpm_dir: dir.path().to_path_buf(),
        socket_override: None,
    };
    std::fs::create_dir_all(ctx.projects_dir()).unwrap();
    if let Some(body) = settings {
        std::fs::write(ctx.settings_path(), body).unwrap();
    }
    for (name, body) in files {
        std::fs::write(ctx.project_path(name), body).unwrap();
    }
    (dir, ctx)
}

const FAMILY: &[(&str, &str)] = &[
    ("web", "root: /tmp/web\nautoPull: true\n"),
    ("web-2", "root: /tmp/web-2\nparent_name: web\n"),
    (
        "web-3",
        "root: /tmp/web-3\nparent_name: web\nautoPull: false\n",
    ),
    ("api", "root: /tmp/api\n"),
    ("docs", "root: /tmp/docs\nparent_name: api\n"),
];

fn summary(ctx: &Ctx, name: &str) -> (bool, Source, String) {
    let mode = read_mode(ctx);
    let state = state(ctx, mode, name);
    let line = render_line(&Style { on: false }, &state, mode);
    (state.effective, state.source, line)
}

#[test]
fn off_in_settings_wins_over_everything() {
    assert_eq!(
        effective(Mode::Off, Some(true), Some(true)),
        (false, Source::Settings)
    );
    assert_eq!(effective(Mode::Off, None, None), (false, Source::Settings));
}

#[test]
fn own_key_then_parent_key_then_the_mode_decide() {
    for mode in [Mode::Chosen, Mode::All] {
        assert_eq!(
            effective(mode, Some(false), Some(true)),
            (false, Source::Project)
        );
        assert_eq!(
            effective(mode, Some(true), Some(false)),
            (true, Source::Project)
        );
        assert_eq!(effective(mode, None, Some(false)), (false, Source::Parent));
        assert_eq!(effective(mode, None, Some(true)), (true, Source::Parent));
    }
    assert_eq!(
        effective(Mode::Chosen, None, None),
        (false, Source::Default)
    );
    assert_eq!(effective(Mode::All, None, None), (true, Source::Default));
}

#[test]
fn the_mode_is_read_from_settings_and_anything_else_is_off() {
    for (settings, mode) in [
        (None, Mode::Off),
        (Some("{}"), Mode::Off),
        (Some("not json"), Mode::Off),
        (Some(r#"{"autoPull":"bogus"}"#), Mode::Off),
        (Some(r#"{"autoPull":true}"#), Mode::Off),
        (Some(r#"{"autoPull":"off"}"#), Mode::Off),
        (Some(r#"{"autoPull":"chosen"}"#), Mode::Chosen),
        (Some(r#"{"autoPull":"all","theme":"dark"}"#), Mode::All),
    ] {
        let (_dir, ctx) = ctx_with(settings, &[]);
        assert_eq!(read_mode(&ctx), mode, "{settings:?}");
    }
}

#[test]
fn projects_resolve_through_their_parent_like_the_app() {
    let (_dir, ctx) = ctx_with(Some(r#"{"autoPull":"chosen"}"#), FAMILY);
    assert_eq!(
        summary(&ctx, "web"),
        (
            true,
            Source::Project,
            "web: on (set on this project)".into()
        )
    );
    assert_eq!(
        summary(&ctx, "web-2"),
        (true, Source::Parent, "web-2: on (same as web)".into())
    );
    assert_eq!(
        summary(&ctx, "web-3"),
        (
            false,
            Source::Project,
            "web-3: off (set on this project)".into()
        )
    );
    assert_eq!(
        summary(&ctx, "docs"),
        (
            false,
            Source::Default,
            "docs: off (default: Chosen projects)".into()
        )
    );
}

#[test]
fn lines_explain_the_default_and_settings_sources() {
    let (_dir, ctx) = ctx_with(Some(r#"{"autoPull":"all"}"#), FAMILY);
    assert_eq!(summary(&ctx, "api").2, "api: on (default: All projects)");

    let (_dir, ctx) = ctx_with(None, FAMILY);
    assert_eq!(
        summary(&ctx, "api").2,
        "api: off (Auto pull is Off in Settings)"
    );
    assert_eq!(
        summary(&ctx, "web").2,
        "web: off (Auto pull is Off in Settings; this project is set to on)"
    );
}

#[test]
fn json_carries_the_own_value_source_and_parent() {
    let (_dir, ctx) = ctx_with(Some(r#"{"autoPull":"all"}"#), FAMILY);
    assert_eq!(
        state_json(&state(&ctx, Mode::All, "web-2")),
        json!({
            "name": "web-2",
            "autoPull": null,
            "effective": true,
            "source": "parent",
            "parent": "web",
        })
    );
    assert_eq!(
        state_json(&state(&ctx, Mode::All, "web-3")),
        json!({
            "name": "web-3",
            "autoPull": false,
            "effective": false,
            "source": "project",
            "parent": "web",
        })
    );
}

/// Serves one connection per reply, as the app would, and returns the lines
/// it was sent.
fn serve(ctx: &Ctx, replies: &'static [&'static str]) -> std::thread::JoinHandle<Vec<String>> {
    let listener = UnixListener::bind(ctx.socket_path()).unwrap();
    std::thread::spawn(move || {
        replies
            .iter()
            .map(|reply| {
                let (mut stream, _) = listener.accept().unwrap();
                let mut line = String::new();
                BufReader::new(stream.try_clone().unwrap())
                    .read_line(&mut line)
                    .unwrap();
                writeln!(stream, "{reply}").unwrap();
                line.trim_end().to_string()
            })
            .collect()
    })
}

#[test]
fn set_asks_the_app_to_change_the_project_by_its_file_name() {
    let (_dir, ctx) = ctx_with(Some(r#"{"autoPull":"all"}"#), FAMILY);
    let server = serve(&ctx, &["PONG", "OK", "PONG", "OK"]);
    run(&ctx, Some("web-2"), Some(Setting::Off), false, true).unwrap();
    run(&ctx, Some("ap"), Some(Setting::Default), false, true).unwrap();
    assert_eq!(
        server.join().unwrap(),
        [
            "ping",
            "set_auto_pull 'web-2' off",
            "ping",
            "set_auto_pull 'api' default"
        ]
    );
}

#[test]
fn set_surfaces_the_app_error() {
    let (_dir, ctx) = ctx_with(None, FAMILY);
    let server = serve(&ctx, &["PONG", "ERROR: project \"web\" has no config"]);
    let err = run(&ctx, Some("web"), Some(Setting::On), false, true).unwrap_err();
    server.join().unwrap();
    assert_eq!(err.code(), 1);
    assert_eq!(err.message(), "project \"web\" has no config");
}

#[test]
fn set_needs_the_app_but_showing_does_not() {
    let (_dir, ctx) = ctx_with(None, FAMILY);
    let err = run(&ctx, Some("web"), Some(Setting::On), false, true).unwrap_err();
    assert_eq!(err.code(), 2);
    assert!(err.message().contains("not running"));
    run(&ctx, Some("web"), None, false, true).unwrap();
}
