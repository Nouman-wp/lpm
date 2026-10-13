// The phone's chunked file attach: a video or file picked on the phone reaches
// this Mac in pieces through the same host state machine another Mac uses
// (peeruploadhost.rs), so its size is bounded by disk rather than by one
// WebSocket frame. Replies are phone-shaped — `{t: <verb>, id, ok, …}` with the
// `reqId` echoed — and `uploadDone` hands back the path quoted for pasting, as
// the one-frame `upload` does.
use serde_json::{json, Value};
use std::sync::mpsc::SyncSender;
use tauri::AppHandle;

/// Answer one of `uploadBegin`, `uploadChunk`, `uploadDone`, `uploadAbort`.
pub fn handle(app: &AppHandle, out: &SyncSender<String>, t: &str, v: &Value) {
    let req_id = v.get("reqId").cloned().unwrap_or(Value::Null);
    let id = v
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let (app, out, verb, v) = (app.clone(), out.clone(), t.to_string(), v.clone());
    std::thread::spawn(move || {
        let res = crate::peeruploadhost::run(&app, &verb, &v, &id);
        // An abort is fire-and-forget: the phone sends it for an upload it has
        // already given up on.
        if req_id.is_null() {
            return;
        }
        let _ = out.try_send(reply(&verb, &id, req_id, res).to_string());
    });
}

fn reply(verb: &str, id: &str, req_id: Value, res: Result<Value, String>) -> Value {
    let mut frame = json!({ "t": verb, "id": id, "reqId": req_id });
    match res {
        Ok(value) => {
            frame["ok"] = json!(true);
            if let Value::Object(fields) = value {
                for (k, v) in fields {
                    frame[k] = v;
                }
            }
            if let Some(path) = frame
                .get("path")
                .and_then(Value::as_str)
                .map(str::to_string)
            {
                frame["path"] = json!(crate::upload::format_paste_paths(&[path]));
            }
        }
        Err(e) => {
            frame["ok"] = json!(false);
            frame["error"] = json!(e);
        }
    }
    frame
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_step_reply_carries_the_verb_terminal_and_request() {
        let frame = reply(
            "uploadChunk",
            "t1",
            json!("r1"),
            Ok(json!({ "received": 1024 })),
        );
        assert_eq!(
            frame,
            json!({ "t": "uploadChunk", "id": "t1", "reqId": "r1", "ok": true, "received": 1024 })
        );
    }

    #[test]
    fn the_finished_path_is_quoted_for_pasting() {
        let frame = reply(
            "uploadDone",
            "t1",
            json!("r1"),
            Ok(json!({ "path": "/tmp/lpm-upload-ab/My Movie.mov" })),
        );
        assert_eq!(frame["path"], json!("'/tmp/lpm-upload-ab/My Movie.mov'"));
    }

    #[test]
    fn a_refusal_carries_its_reason() {
        let frame = reply(
            "uploadBegin",
            "t1",
            json!(7),
            Err("that file is too large to send (2048 MB)".into()),
        );
        assert_eq!(frame["ok"], json!(false));
        assert_eq!(frame["reqId"], json!(7));
        assert_eq!(
            frame["error"],
            json!("that file is too large to send (2048 MB)")
        );
    }
}
