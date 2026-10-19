// A guest's connection: someone a tab was shared with (tabshare.rs).
//
// It shares the listener, the TLS identity and the terminal rings with paired
// machines, and nothing else. Its loop answers four frames, each checked against
// the share on every use, so stopping a share or removing a guest takes effect
// on the next frame rather than the next connection. It is never handed an
// event, and never reaches the generic command proxy.
use super::*;
use crate::tabshare::{self, GuestSession};

const REFUSED: &str = "Only the shared tab is open to you.";
const VIEW_ONLY: &str = "The host hasn't let you type in this tab.";

fn over_tls(ws: &ConnWs) -> bool {
    matches!(ws.get_ref(), PeerStream::Tls(_))
}

fn error_frame(error: &str) -> Message {
    Message::text(json!({ "t": "error", "error": error }).to_string())
}

/// The `auth` of a guest let in earlier, answered with its `ready`.
pub(super) fn authenticate(ws: &mut ConnWs, id: &str, token: &str) -> Option<GuestSession> {
    if !over_tls(ws) {
        return None;
    }
    let session = tabshare::check_guest(id, token)?;
    let share = tabshare::describe(&session)?;
    let _ = ws.send(Message::text(
        json!({ "t": "ready", "guest": true, "share": share, "hostName": machine_name(),
            "hostPlatform": platform_id(), "hostVersion": crate::commands_real::get_version(),
            "features": [] })
        .to_string(),
    ));
    Some(session)
}

/// Someone holding an invite asks to join. Only the host lets them in, so this
/// waits for an answer on this machine's screen, watching for the asker hanging
/// up meanwhile, and closes after answering: an admitted guest connects again
/// with the token it was handed.
pub(super) fn join(ws: &mut ConnWs, app: &AppHandle, v: &Value) {
    if !over_tls(ws) {
        let _ = ws.send(error_frame("Update lpm to join shared tabs."));
        return;
    }
    let secret = v.get("secret").and_then(Value::as_str).unwrap_or_default();
    let name = v.get("name").and_then(Value::as_str).unwrap_or_default();
    let ticket = match tabshare::begin_join(app, secret, name) {
        Ok(ticket) => ticket,
        Err(refusal) => {
            let _ = ws.send(error_frame(refusal.message()));
            return;
        }
    };
    let _ = ws.send(Message::text(
        json!({ "t": "shareJoinPending", "hostName": machine_name() }).to_string(),
    ));
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
    let _ = ws
        .get_ref()
        .tcp()
        .set_read_timeout(Some(Duration::from_millis(250)));
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
        match ws.read() {
            Ok(m) if m.is_close() => break None,
            Ok(_) => {}
            Err(WsError::Io(ref e))
                if e.kind() == io::ErrorKind::WouldBlock || e.kind() == io::ErrorKind::TimedOut => {
            }
            Err(_) => break None,
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
    let _ = ws.send(Message::text(reply.to_string()));
}

pub(super) fn serve(
    mut ws: ConnWs,
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
    let _ = ws.get_ref().tcp().set_read_timeout(Some(POLL));
    let mut quick_until: Option<Instant> = None;
    let mut quick = false;

    'main: loop {
        if hub.inner.generation.load(Ordering::SeqCst) != generation {
            break;
        }
        loop {
            match rx.try_recv() {
                Ok(s) => {
                    if ws.write(Message::text(s)).is_err() {
                        break 'main;
                    }
                }
                Err(_) => break,
            }
        }
        let _ = ws.flush();
        // After the drain, so the frame that says why it ended goes out first.
        if !tabshare::is_live(&session) {
            break;
        }
        let want_quick = quick_until.is_some_and(|t| Instant::now() < t);
        if want_quick != quick {
            quick = want_quick;
            let poll = if quick { QUICK_POLL } else { POLL };
            let _ = ws.get_ref().tcp().set_read_timeout(Some(poll));
        }
        match ws.read() {
            Ok(msg) if msg.is_close() => break,
            Ok(msg) => {
                let Ok(txt) = msg.to_text() else { continue };
                let txt = txt.to_string();
                if handle(&mut ws, &txt, &hub, &app, &subs, &session).is_err() {
                    break;
                }
                if let Some(within) = ANSWER_SOON.with(|c| c.take()) {
                    let until = Instant::now() + within;
                    quick_until = Some(quick_until.map_or(until, |t| t.max(until)));
                }
            }
            Err(WsError::Io(ref e))
                if e.kind() == io::ErrorKind::WouldBlock || e.kind() == io::ErrorKind::TimedOut => {
            }
            Err(_) => break,
        }
    }

    hub.inner.clients.lock().unwrap().remove(&conn_id);
    tabshare::disconnect_viewer(&app, conn_id);
    let _ = ws.close(None);
    let _ = ws.flush();
}

fn handle(
    ws: &mut ConnWs,
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
        "ping" => send(ws, json!({ "t": "pong" }))?,
        "sub" => {
            let id = str_field("id");
            if !tabshare::may_watch(session, &id) || !terminal_alive(app, &id) {
                return send(ws, gone_frame(&id));
            }
            let from = v.get("from").and_then(Value::as_u64);
            let Some((data, off, reset)) =
                hub.ring_attach(subs, &id, from, || terminal_alive(app, &id))
            else {
                return send(ws, gone_frame(&id));
            };
            let (cols, rows) =
                pty::remote_dims(&app.state::<pty::PtyState>(), &id).unwrap_or((0, 0));
            send(
                ws,
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
            ws.send(Message::text(frame)).map_err(|_| ())?;
        }
        "forget" => {
            tabshare::leave(app, session);
            return Err(());
        }
        _ => {}
    }
    Ok(())
}
