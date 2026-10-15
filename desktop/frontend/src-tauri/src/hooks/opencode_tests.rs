use super::*;
#[cfg(unix)]
use crate::hooks::plugin::tests::{frames_by_state, reported};
use crate::hooks::plugin::tests::assert_hooks_for_every_state;
#[cfg(unix)]
use serde_json::{json, Value};

#[test]
fn the_plugins_run_a_hook_for_every_state() {
    for plugin in &PLUGINS {
        assert_hooks_for_every_state(plugin);
    }
}

#[test]
fn the_terminal_plugin_sits_in_a_folder_beside_the_server_plugin() {
    let dir = std::path::Path::new("oc");
    assert_eq!(SERVER.path_in(dir), dir.join("plugins").join("lpm-status.js"));
    assert_eq!(TUI.path_in(dir), dir.join("plugins").join("lpm-status").join("tui.js"));
}

#[cfg(unix)]
#[test]
fn states_report_under_the_session_like_the_cli_does() {
    for plugin in &PLUGINS {
        assert_eq!(
            frames_by_state(plugin),
            [
                "set_status 'proj' opencode_ses_1 Running --icon=bolt --color=#FAB283 --pane=pane-1",
                "set_status 'proj' opencode_ses_1 Waiting --icon=bell --color=#f59e0b --pane=pane-1 --hold",
                "set_status 'proj' opencode_ses_1 Done --icon=checkmark --color=#4ade80 --pane=pane-1",
                "set_status 'proj' opencode_ses_1 Error --icon=warning --color=#ef4444 --pane=pane-1",
                "clear_status 'proj' opencode_ses_1 --live",
            ]
        );
    }
}

#[cfg(unix)]
fn status(sid: &str, kind: &str) -> Value {
    json!({ "type": "session.status", "properties": { "sessionID": sid, "status": { "type": kind } } })
}

#[cfg(unix)]
fn idle(sid: &str) -> [Value; 2] {
    [status(sid, "idle"), json!({ "type": "session.idle", "properties": { "sessionID": sid } })]
}

#[cfg(unix)]
fn created(sid: &str, parent: &str) -> Value {
    json!({ "type": "session.created", "properties": { "info": { "id": sid, "parentID": parent } } })
}

#[cfg(unix)]
fn asked(kind: &str, sid: &str, id: &str) -> Value {
    json!({ "type": format!("{kind}.asked"), "properties": { "id": id, "sessionID": sid } })
}

#[cfg(unix)]
fn replied(sid: &str, id: &str, reply: &str) -> Value {
    json!({ "type": "permission.replied", "properties": { "sessionID": sid, "requestID": id, "reply": reply } })
}

#[cfg(unix)]
fn error(sid: &str, name: &str) -> Value {
    json!({ "type": "session.error", "properties": { "sessionID": sid, "error": { "name": name, "data": {} } } })
}

/// Feeds the plugin's event hook as OpenCode 1 does.
#[cfg(unix)]
const HARNESS: &str = "const { default: plugin } = await import(process.argv[2])\n\
    const hooks = await plugin.server({})\n\
    for (const event of JSON.parse(process.argv[3])) await hooks.event({ event })\n\
    await hooks.dispose()\n";

/// Event sequences as OpenCode 1.19 sends them, captured from its TUI.
#[cfg(unix)]
#[test]
fn the_plugin_follows_opencode_turns() {
    let turn = |middle: Vec<Value>| -> Vec<Value> {
        let mut events = vec![status("r", "busy"), status("r", "busy")];
        events.extend(middle);
        events.extend(idle("r"));
        events
    };
    let cases: Vec<(&str, Vec<Value>, &[&str])> = vec![
        ("finished", turn(vec![status("r", "busy")]), &["running r", "done r"]),
        (
            "approved",
            turn(vec![asked("permission", "r", "p1"), replied("r", "p1", "once"), status("r", "busy")]),
            &["running r", "waiting r", "running r", "done r"],
        ),
        (
            "rejected",
            turn(vec![asked("permission", "r", "p1"), replied("r", "p1", "reject")]),
            &["running r", "waiting r", "clear r"],
        ),
        (
            "interrupted",
            [turn(vec![error("r", "MessageAbortedError")]), idle("r").to_vec()].concat(),
            &["running r", "clear r"],
        ),
        ("failed", turn(vec![error("r", "APIError")]), &["running r", "error r"]),
        (
            "compacted after overflowing",
            turn(vec![error("r", "ContextOverflowError"), status("r", "busy")]),
            &["running r", "done r"],
        ),
        (
            "question dismissed",
            turn(vec![
                asked("question", "r", "q1"),
                json!({ "type": "question.rejected", "properties": { "sessionID": "r", "requestID": "q1" } }),
            ]),
            &["running r", "waiting r", "clear r"],
        ),
        (
            "two approvals open",
            turn(vec![
                asked("permission", "r", "p1"),
                asked("permission", "r", "p2"),
                replied("r", "p1", "once"),
                replied("r", "p2", "always"),
            ]),
            &["running r", "waiting r", "running r", "done r"],
        ),
        (
            "sub-agent asks and is turned down",
            turn(vec![
                created("c", "r"),
                status("c", "busy"),
                asked("permission", "c", "p1"),
                replied("c", "p1", "reject"),
                error("c", "APIError"),
                idle("c")[0].clone(),
                status("r", "busy"),
            ]),
            &["running r", "waiting r", "running r", "done r"],
        ),
    ];
    for (case, events, expected) in cases {
        let Some(states) = reported(&SERVER, HARNESS, events) else { return };
        assert_eq!(states, expected, "{case}");
    }
}

/// OpenCode 2 runs the same file in its background service, where it reports
/// nothing: the terminal plugin does.
#[cfg(unix)]
#[test]
fn opencode_2_loads_the_server_plugin_without_it_reporting() {
    let harness = "const { default: plugin } = await import(process.argv[2])\n\
        if (typeof plugin.id !== 'string' || (await plugin.setup({})) !== undefined) process.exit(1)\n";
    if let Some(states) = reported(&SERVER, harness, vec![]) {
        assert!(states.is_empty(), "{states:?}");
    }
}

/// Runs the terminal plugin as OpenCode 2's TUI does: every event of every
/// session the service runs, `{ "route": … }` steps moving the terminal to
/// another screen, and the plugin unloaded once the events run out. The
/// terminal's own store holds no sessions here, as when it has let one go.
#[cfg(unix)]
const TUI_HARNESS: &str = "const { default: plugin } = await import(process.argv[2])\n\
    let route = { type: 'home' }, listener\n\
    const cleanup = plugin.setup({\n\
      data: { listen: (fn) => ((listener = fn), () => (listener = undefined)), session: { root: (id) => id } },\n\
      ui: { router: { current: () => route } },\n\
    })\n\
    for (const step of JSON.parse(process.argv[3])) {\n\
      if (step.route) route = step.route\n\
      else listener?.({ name: step.type, details: step })\n\
    }\n\
    await cleanup()\n";

#[cfg(unix)]
fn event(kind: &str, data: Value) -> Value {
    json!({ "type": kind, "data": data })
}

#[cfg(unix)]
fn shows(sid: &str) -> Value {
    json!({ "route": { "type": "session", "sessionID": sid } })
}

#[cfg(unix)]
fn execution(sid: &str, how: &str) -> Value {
    event(&format!("session.execution.{how}"), json!({ "sessionID": sid }))
}

#[cfg(unix)]
fn permission(sid: &str, id: &str, reply: &str) -> [Value; 2] {
    [
        event("permission.asked", json!({ "id": id, "sessionID": sid, "action": "shell" })),
        event("permission.replied", json!({ "sessionID": sid, "requestID": id, "reply": reply })),
    ]
}

#[cfg(unix)]
fn question(sid: &str, id: &str, outcome: &str) -> [Value; 2] {
    [
        event("form.created", json!({ "form": { "id": id, "sessionID": sid, "title": "Questions" } })),
        event(&format!("form.{outcome}"), json!({ "id": id, "sessionID": sid })),
    ]
}

/// Event sequences as OpenCode 2.0 sends them, captured from its TUI: a turn
/// begins in the session the terminal shows, as one sent from it does.
#[cfg(unix)]
#[test]
fn the_terminal_plugin_follows_opencode_2_turns_started_in_it() {
    let turn = |rest: Vec<Value>| -> Vec<Value> {
        let start = [
            event("session.created", json!({ "sessionID": "r" })),
            shows("r"),
            execution("r", "started"),
        ];
        [start.to_vec(), rest].concat()
    };
    let interrupted = |reason| event("session.execution.interrupted", json!({ "sessionID": "r", "reason": reason }));
    let succeeded = || execution("r", "succeeded");
    let [ask1, reply1] = permission("r", "p1", "once");
    let [ask2, reply2] = permission("r", "p2", "always");
    let [approve, approved] = permission("r", "p1", "once");
    let [reject, rejected] = permission("r", "p1", "reject");
    let [form, answered] = question("r", "f1", "replied");
    let [dismissed_form, dismissed] = question("r", "f1", "cancelled");
    let [child_asks, child_approved] = permission("c", "p1", "once");
    let cases: Vec<(&str, Vec<Value>, &[&str])> = vec![
        ("finished", turn(vec![succeeded()]), &["running r", "done r"]),
        (
            "approved",
            turn(vec![approve, approved, succeeded()]),
            &["running r", "waiting r", "running r", "done r"],
        ),
        (
            "rejected",
            turn(vec![reject, rejected, interrupted("shutdown")]),
            &["running r", "waiting r", "running r", "clear r"],
        ),
        ("interrupted", turn(vec![interrupted("user")]), &["running r", "clear r"]),
        (
            "failed",
            turn(vec![event("session.execution.failed", json!({ "sessionID": "r", "error": {} }))]),
            &["running r", "error r"],
        ),
        (
            "question answered",
            turn(vec![form, answered, succeeded()]),
            &["running r", "waiting r", "running r", "done r"],
        ),
        (
            "question dismissed",
            turn(vec![dismissed_form, dismissed, interrupted("shutdown")]),
            &["running r", "waiting r", "running r", "clear r"],
        ),
        (
            "two approvals open",
            turn(vec![ask1, ask2, reply1, reply2, succeeded()]),
            &["running r", "waiting r", "running r", "done r"],
        ),
        (
            "sub-agent asks",
            turn(vec![
                event("session.created", json!({ "sessionID": "c", "parentID": "r" })),
                execution("c", "started"),
                child_asks,
                child_approved,
                execution("c", "succeeded"),
                succeeded(),
            ]),
            &["running r", "waiting r", "running r", "done r"],
        ),
        (
            "user moves on mid-turn",
            turn(vec![json!({ "route": { "type": "home" } }), succeeded()]),
            &["running r", "done r"],
        ),
        (
            "session deleted mid-turn",
            turn(vec![event("session.deleted", json!({ "sessionID": "r" }))]),
            &["running r", "clear r"],
        ),
        ("terminal closed mid-turn", turn(vec![]), &["running r", "clear r"]),
    ];
    for (case, events, expected) in cases {
        let Some(states) = reported(&TUI, TUI_HARNESS, events) else { return };
        assert_eq!(states, expected, "{case}");
    }
}

/// Every terminal hears every session the shared service runs; one the
/// terminal isn't showing is another terminal's to report.
#[cfg(unix)]
#[test]
fn the_terminal_plugin_leaves_other_terminals_turns_alone() {
    let events = [
        vec![
            event("session.created", json!({ "sessionID": "s" })),
            execution("s", "started"),
        ],
        permission("s", "p1", "once").to_vec(),
        question("s", "f1", "replied").to_vec(),
        vec![execution("s", "succeeded")],
    ]
    .concat();
    if let Some(states) = reported(&TUI, TUI_HARNESS, events) {
        assert!(states.is_empty(), "{states:?}");
    }
}
