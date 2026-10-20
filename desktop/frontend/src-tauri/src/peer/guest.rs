// A guest's connection: someone a tab was shared with (tabshare.rs).
//
// It shares the listener, the TLS identity and the terminal rings with paired
// machines, and nothing else. Its loop answers four frames, each checked against
// the share on every use, so stopping a share or removing a guest takes effect
// on the next frame rather than the next connection. It is never handed an
// event, and never reaches the generic command proxy.
use super::guestlink::{drain, GuestLink, Incoming};
use super::*;
use crate::tabshare::{self, GuestSession};

const REFUSED: &str = "Only the shared tab is open to you.";
const VIEW_ONLY: &str = "The host hasn't let you type in this tab.";
const JOIN_POLL: Duration = Duration::from_millis(250);

fn error_frame(error: &str) -> String {
    json!({ "t": "error", "error": error }).to_string()
}

fn send<L: GuestLink>(link: &mut L, val: Value) -> Result<(), ()> {
    link.send_text(val.to_string())
}

/// The `auth` of a guest let in earlier, answered with its `ready`.
pub(super) fn authenticate<L: GuestLink>(
    link: &mut L,
    id: &str,
    token: &str,
) -> Option<GuestSession> {
    if !link.private() {
        return None;
    }
    let session = tabshare::check_guest(id, token)?;
    let share = tabshare::describe(&session)?;
    let _ = send(
        link,
        json!({ "t": "ready", "guest": true, "share": share, "hostName": machine_name(),
            "hostPlatform": platform_id(), "hostVersion": crate::commands_real::get_version(),
            "features": [] }),
    );
    Some(session)
}

/// A browser guest the relay carries here (sharerelay.rs). It may only ask to
/// join or come back with the token it was given: never pair, and never reach
/// anything a paired machine can.
pub(crate) fn serve_relayed<L: GuestLink>(mut link: L, app: AppHandle) {
    let Some(hub) = app.try_state::<PeerHub>().map(|h| h.inner().clone()) else {
        return;
    };
    let generation = hub.inner.generation.load(Ordering::SeqCst);
    link.set_wait(AUTH_TIMEOUT);
    let Incoming::Text(txt) = link.recv() else {
        return link.close_link();
    };
    let v: Value = serde_json::from_str(&txt).unwrap_or_default();
    match v.get("t").and_then(Value::as_str) {
        Some("shareJoin") => join(&mut link, &app, &v),
        Some("auth") => {
            let id = v
                .get("deviceId")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let token = v.get("token").and_then(Value::as_str).unwrap_or_default();
            match authenticate(&mut link, id, token) {
                Some(session) => return serve(link, hub, app, session, generation),
                None => {
                    let _ = link.send_text(error_frame("unauthorized"));
                }
            }
        }
        _ => {}
    }
    link.close_link();
}

/// Someone holding an invite asks to join. Only the host lets them in, so this
/// waits for an answer on this machine's screen, watching for the asker hanging
/// up meanwhile, and closes after answering: an admitted guest connects again
/// with the token it was handed.
pub(super) fn join<L: GuestLink>(link: &mut L, app: &AppHandle, v: &Value) {
    if !link.private() {
        let _ = link.send_text(error_frame("Update lpm to join shared tabs."));
        return;
    }
    let secret = v.get("secret").and_then(Value::as_str).unwrap_or_default();
    let name = v.get("name").and_then(Value::as_str).unwrap_or_default();
    let ticket = match tabshare::begin_join(app, secret, name, link.match_code()) {
        Ok(ticket) => ticket,
        Err(refusal) => {
            let _ = link.send_text(error_frame(refusal.message()));
            return;
        }
    };
    let mut pending = json!({ "t": "shareJoinPending", "hostName": machine_name() });
    // Unless told this machine shows emoji, a browser shows the four digits lpm
    // 0.7.26 did.
    if link.match_code().is_some() {
        pending["match"] = json!("emoji");
    }
    let _ = send(link, pending);
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
    link.set_wait(JOIN_POLL);
    let deadline = Instant::now() + PAIR_APPROVE_WINDOW;
    let decision = loop {
        match ticket.decision.try_recv() {
            Ok(allow) => break Some(allow),
            Err(TryRecvError::Disconnected) => break Some(false),
            Err(TryRecvError::Empty) => {}
        }
        if Instant::now() >= deadline {
            break None;
        }
        if let Incoming::Closed = link.recv() {
            break None;
        }
    };
    tabshare::abandon_join(app, &ticket.id);
    let reply = match decision {
        Some(true) => match tabshare::admit(app, &ticket.share, name) {
            Some((guest, token)) => json!({ "t": "shareJoined", "guestId": guest, "token": token,
                "hostName": machine_name() }),
            None => {
                json!({ "t": "error", "error": tabshare::JoinRefusal::UnknownInvite.message() })
            }
        },
        Some(false) => json!({ "t": "error", "error": "The host didn't let you in." }),
        None => json!({ "t": "error", "error": "The host didn't answer in time." }),
    };
    let _ = send(link, reply);
}

pub(super) fn serve<L: GuestLink>(
    mut link: L,
    hub: PeerHub,
    app: AppHandle,
    session: GuestSession,
    generation: u64,
) {
    let (tx, rx) = mpsc::sync_channel::<String>(OUT_QUEUE);
    let subs = Arc::new(Mutex::new(HashSet::new()));
    let conn_id = hub.inner.next_id.fetch_add(1, Ordering::SeqCst) + 1;
    hub.inner.clients.lock().unwrap().insert(
        conn_id,
        Conn {
            tx: tx.clone(),
            subs: subs.clone(),
            device_id: session.guest.clone(),
            missed_event: Arc::new(AtomicBool::new(false)),
            guest: true,
        },
    );
    tabshare::connect_viewer(&app, conn_id, &session, tx);
    link.admitted();
    link.set_wait(POLL);
    let mut quick_until: Option<Instant> = None;
    let mut quick = false;

    loop {
        if drain(&rx, POLL, |s| link.queue_text(s)).is_err() {
            break;
        }
        let _ = link.flush_out();
        // After the drain, so the frame that says why it ended goes out first:
        // the last share ending can close the listener right behind it.
        if hub.inner.generation.load(Ordering::SeqCst) != generation || !tabshare::is_live(&session)
        {
            break;
        }
        let want_quick = quick_until.is_some_and(|t| Instant::now() < t);
        if want_quick != quick {
            quick = want_quick;
            link.set_wait(if quick { QUICK_POLL } else { POLL });
        }
        match link.recv() {
            Incoming::Closed => break,
            Incoming::Idle => {}
            Incoming::Text(txt) => {
                if handle(&mut link, &txt, &hub, &app, &subs, &session).is_err() {
                    break;
                }
                if let Some(within) = ANSWER_SOON.with(|c| c.take()) {
                    let until = Instant::now() + within;
                    quick_until = Some(quick_until.map_or(until, |t| t.max(until)));
                }
            }
        }
    }

    hub.inner.clients.lock().unwrap().remove(&conn_id);
    tabshare::disconnect_viewer(&app, conn_id);
    link.close_link();
}

fn handle<L: GuestLink>(
    link: &mut L,
    txt: &str,
    hub: &PeerHub,
    app: &AppHandle,
    subs: &Arc<Mutex<HashSet<String>>>,
    session: &GuestSession,
) -> Result<(), ()> {
    let Ok(v) = serde_json::from_str::<Value>(txt) else {
        return Ok(());
    };
    let str_field = |k: &str| {
        v.get(k)
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string()
    };
    match v.get("t").and_then(Value::as_str).unwrap_or_default() {
        "ping" => send(link, json!({ "t": "pong" }))?,
        "sub" => {
            let id = str_field("id");
            if !tabshare::may_watch(session, &id) || !terminal_alive(app, &id) {
                return send(link, gone_frame(&id));
            }
            let from = v.get("from").and_then(Value::as_u64);
            let floor = tabshare::floor(session);
            let Some((data, off, reset)) =
                hub.ring_attach(subs, &id, from, floor, || terminal_alive(app, &id))
            else {
                return send(link, gone_frame(&id));
            };
            let (cols, rows) =
                pty::remote_dims(&app.state::<pty::PtyState>(), &id).unwrap_or((0, 0));
            send(
                link,
                json!({ "t": "seed", "id": id, "d": data, "off": off, "reset": reset,
                    "cols": cols, "rows": rows }),
            )?;
            if reset {
                nudge_repaint(hub, app, &id);
            }
        }
        "unsub" => {
            subs.lock().unwrap().remove(&str_field("id"));
        }
        "invoke" => {
            let req_id = v.get("reqId").cloned().unwrap_or(Value::Null);
            let args = v.get("args").cloned().unwrap_or(Value::Null);
            let id = args.get("id").and_then(Value::as_str).unwrap_or_default();
            let answer = match str_field("cmd").as_str() {
                "write_terminal" if tabshare::may_type(session, id) => {
                    answer_soon(ECHO_WITHIN);
                    let data = args.get("data").and_then(Value::as_str).unwrap_or_default();
                    pty::remote_write(app, id, data).map(|_| Value::Null)
                }
                "write_terminal" if tabshare::may_watch(session, id) => Err(VIEW_ONLY.to_string()),
                "terminal_exists" if tabshare::may_watch(session, id) => Ok(Value::Bool(
                    pty::session_exists(&app.state::<pty::PtyState>(), id),
                )),
                _ => Err(REFUSED.to_string()),
            };
            let frame = match answer {
                Ok(value) => result_frame(&req_id, true, value),
                Err(e) => result_frame(&req_id, false, Value::String(e)),
            };
            link.send_text(frame)?;
        }
        "forget" => {
            tabshare::leave(app, session);
            return Err(());
        }
        _ => {}
    }
    Ok(())
}
