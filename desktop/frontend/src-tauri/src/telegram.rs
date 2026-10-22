// Telegram as a place automations send their results: a bot the user made with
// @BotFather writing to the chats it's been given — found by the user messaging
// the bot or adding it to a group or channel, so a chat id is never typed.

use crate::secrets;
use crate::sendto::{Destination, Report};
use crate::telegramfmt;
use crate::telegramlink::{Chat, Link};
use serde_json::{json, Value};
use std::time::Duration;

const API: &str = "https://api.telegram.org";
/// Telegram refuses a message over 4096 characters; a longer report goes out
/// in several.
const MAX_MESSAGE_CHARS: usize = 4000;

/// Where Bot API calls go. A debug build takes `LPM_TELEGRAM_API`, so a stand-in
/// server can play Telegram in a test.
fn api_base() -> String {
    #[cfg(debug_assertions)]
    if let Ok(base) = std::env::var("LPM_TELEGRAM_API") {
        return base;
    }
    API.to_string()
}

pub(crate) fn token() -> Result<String, String> {
    secrets::get(secrets::TELEGRAM_BOT_TOKEN)?
        .ok_or_else(|| "Telegram isn't connected. Set it up in Settings → Notifications.".into())
}

/// A Bot API refusal as Telegram gave it: its error code and how long it asked
/// for a pause, where it said.
#[derive(Debug)]
pub(crate) struct ApiError {
    pub code: Option<i64>,
    pub retry_after: Option<u64>,
    pub text: String,
}

pub(crate) fn client(timeout: Duration) -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .timeout(timeout)
        .user_agent("lpm")
        .build()
        .map_err(|e| e.to_string())
}

/// One Bot API call. The token is part of the URL, so a transport error is
/// reported without it.
pub(crate) fn api(
    client: &reqwest::blocking::Client,
    token: &str,
    method: &str,
    body: &Value,
) -> Result<Value, ApiError> {
    let failed = |text: String| ApiError {
        code: None,
        retry_after: None,
        text,
    };
    let resp = client
        .post(format!("{}/bot{token}/{method}", api_base()))
        .header("content-type", "application/json")
        .body(body.to_string())
        .send()
        .map_err(|e| failed(format!("Couldn't reach Telegram: {}", e.without_url())))?;
    let reply: Value = serde_json::from_str(&resp.text().unwrap_or_default())
        .map_err(|_| failed("Telegram sent back something unreadable.".into()))?;
    if reply["ok"].as_bool() == Some(true) {
        return Ok(reply["result"].clone());
    }
    Err(ApiError {
        code: reply["error_code"].as_i64(),
        retry_after: reply["parameters"]["retry_after"].as_u64(),
        text: match reply["description"].as_str() {
            Some(d) => format!("Telegram said: {d}"),
            None => "Telegram turned the request down.".into(),
        },
    })
}

pub(crate) fn call(token: &str, method: &str, body: Value) -> Result<Value, String> {
    api(&client(Duration::from_secs(20))?, token, method, &body).map_err(|e| e.text)
}

/// A blocking request dropped on an async command worker panics, so the
/// commands make theirs on a thread of their own.
fn off_worker<T: Send + 'static>(f: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    std::thread::spawn(f)
        .join()
        .map_err(|_| "background thread panicked".to_string())?
}

fn head(report: &Report) -> String {
    if report.mark.is_empty() {
        report.title.clone()
    } else {
        format!("{} {}", report.mark, report.title)
    }
}

/// Sends one message formatted, or as plain text when Telegram can't read the
/// markup — an odd report is still worth delivering unformatted. Returns the
/// message's id and its text as Telegram stored it; `buttons` go under it
/// either way.
fn send_message(
    token: &str,
    chat_id: i64,
    message: &telegramfmt::Message,
    buttons: Option<&Value>,
) -> Result<(i64, String), String> {
    let body = |text: &str, html: bool| {
        let mut body = json!({ "chat_id": chat_id, "text": text, "link_preview_options": { "is_disabled": true } });
        if html {
            body["parse_mode"] = json!("HTML");
        }
        if let Some(buttons) = buttons {
            body["reply_markup"] = buttons.clone();
        }
        body
    };
    let sent = match call(token, "sendMessage", body(&message.html, true)) {
        Err(e) if e.contains("can't parse entities") => {
            call(token, "sendMessage", body(&message.plain, false))
        }
        sent => sent,
    }?;
    Ok((
        sent["message_id"].as_i64().unwrap_or_default(),
        sent["text"].as_str().unwrap_or_default().to_string(),
    ))
}

pub struct Telegram;

impl Destination for Telegram {
    fn id(&self) -> &'static str {
        "telegram"
    }

    fn label(&self) -> &'static str {
        "Telegram"
    }

    fn send(&self, target: Option<&str>, report: &Report) -> Result<(), String> {
        let token = token()?;
        let link = Link::load();
        let chat_id = match (link.chat(target), target) {
            (Some(chat), _) => chat.chat_id,
            (None, Some(key)) => {
                return Err(format!(
                    "\"{key}\" isn't one of lpm's Telegram chats any more. Pick another in the job's Send to."
                ))
            }
            (None, None) => {
                return Err(
                    "Telegram has no chat to send to yet. Finish setting it up in Settings → Notifications."
                        .into(),
                )
            }
        };
        let kind = link.chat(target).map_or("", |c| c.kind.as_str());
        let replies = kind != "channel";
        let asking = report
            .asking
            .as_ref()
            .filter(|a| crate::telegramask::supported(&a.ask));
        let buttons = asking.map(|a| crate::telegramask::keyboard(&a.ask, &[], replies));
        let messages =
            telegramfmt::messages(&head(report), report.body.as_deref(), MAX_MESSAGE_CHARS);
        let last = messages.len().saturating_sub(1);
        for (i, message) in messages.iter().enumerate() {
            let (id, text) = send_message(
                &token,
                chat_id,
                message,
                buttons.as_ref().filter(|_| i == last),
            )?;
            if let (true, Some(asking), Some(buttons)) = (i == last, asking, &buttons) {
                let post = crate::telegramasks::Post {
                    message: id,
                    keyboard: buttons.clone(),
                    text,
                };
                crate::telegramanswer::posted(asking, chat_id, kind, post);
            }
        }
        Ok(())
    }
}

fn chat_json(chat: &Chat) -> Value {
    json!({ "key": chat.key, "name": chat.name, "kind": chat.kind })
}

/// The token inside whatever was pasted — BotFather's whole reply will do.
fn extract_token(text: &str) -> Option<&str> {
    text.split(|c: char| c.is_whitespace() || matches!(c, '`' | '"' | '\'' | ','))
        .find(|word| {
            let Some((id, secret)) = word.split_once(':') else {
                return false;
            };
            id.len() >= 5
                && id.bytes().all(|b| b.is_ascii_digit())
                && secret.len() >= 30
                && secret.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
        })
}

#[tauri::command(async)]
pub fn telegram_status() -> Value {
    let mut link = Link::load();
    let has_token = secrets::has(secrets::TELEGRAM_BOT_TOKEN);
    if has_token && link.ensure_code() {
        let _ = link.save();
    }
    json!({
        "connected": has_token && !link.chats.is_empty(),
        "hasToken": has_token,
        "bot": link.bot,
        "code": link.code,
        "chats": link.chats.iter().map(chat_json).collect::<Vec<_>>(),
    })
}

/// Checks the token with Telegram before keeping it, and starts the chats over:
/// a new bot can't write to the old one's chats.
#[tauri::command(async)]
pub fn telegram_connect(token: String) -> Result<Value, String> {
    let Some(token) = extract_token(&token).map(str::to_string) else {
        return Err("That doesn't hold a bot token. Paste the reply @BotFather sent.".into());
    };
    off_worker(move || {
        let me = call(&token, "getMe", json!({}))?;
        let bot = me["username"].as_str().unwrap_or_default().to_string();
        secrets::set(secrets::TELEGRAM_BOT_TOKEN, &token)?;
        let link = Link::for_bot(bot.clone());
        link.save()?;
        Ok(json!({ "bot": bot, "code": link.code }))
    })
}

/// What a chat sees the moment it's linked, so the user knows it worked
/// without a separate test.
fn welcome(chat: &Chat) -> &'static str {
    if chat.kind == "private" {
        "lpm is connected. Automations that send to Telegram will post their results in this chat, and you can answer their questions here."
    } else {
        "lpm will post automation results here."
    }
}

/// Looks at what the bot has heard since the last look and keeps every new
/// chat — someone messaging it, or it being added to a group or channel.
/// Returns the chats that are new, often none.
#[tauri::command(async)]
pub fn telegram_find_chats() -> Result<Vec<Value>, String> {
    off_worker(|| Ok(crate::telegrampoll::look()?.iter().map(chat_json).collect()))
}

/// The bot's updates, read once by whoever is reading them (telegrampoll), go
/// to linking here: a chat that tapped Start or got the bot added becomes one
/// lpm sends to, and is greeted. telegram.json is only written when a chat
/// joined, since every write of it is synced.
pub(crate) fn take_new_chats(token: &str, updates: &Value) -> Vec<Chat> {
    let mut link = Link::load();
    let added = link.take_updates(updates);
    if !added.is_empty() && link.save().is_ok() {
        for chat in &added {
            let _ = call(
                token,
                "sendMessage",
                json!({ "chat_id": chat.chat_id, "text": welcome(chat) }),
            );
        }
    }
    added
}

#[tauri::command(async)]
pub fn telegram_test(key: Option<String>) -> Result<(), String> {
    off_worker(move || {
        Telegram.send(
            key.as_deref(),
            &Report {
                mark: "",
                title: "lpm is connected.".into(),
                body: Some(
                    "Automations that send to this chat will post their results here, and you can answer their questions here.".into(),
                ),
                asking: None,
            },
        )
    })
}

#[tauri::command(async)]
pub fn telegram_remove_chat(key: String) -> Result<(), String> {
    let mut link = Link::load();
    if link.remove(&key) {
        link.save()?;
    }
    Ok(())
}

/// Leaves an empty link rather than no file: config sync treats a missing file as
/// this Mac's own business and would bring the other Mac's back, while an empty
/// one crosses and disconnects that Mac too.
#[tauri::command(async)]
pub fn telegram_disconnect() -> Result<(), String> {
    secrets::delete(secrets::TELEGRAM_BOT_TOKEN)?;
    Link::default().save()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_the_token_in_whatever_was_pasted() {
        let token = "123456789:AAFakeTokenForTestsOnly_abc-DEF123456";
        assert_eq!(extract_token(token), Some(token));
        let reply = format!("Done! Congratulations on your new bot.\nUse this token to access the HTTP API:\n{token}\nKeep your token secure");
        assert_eq!(extract_token(&reply), Some(token));
        assert_eq!(extract_token(&format!("`{token}`")), Some(token));
        assert_eq!(extract_token("t.me/lpm_bot"), None);
        assert_eq!(extract_token("12:short"), None);
    }

    #[test]
    fn leads_with_the_mark() {
        let report = |mark| Report {
            mark,
            title: "\"Watch\" is done.".into(),
            body: None,
            asking: None,
        };
        assert_eq!(head(&report("✅")), "✅ \"Watch\" is done.");
        assert_eq!(head(&report("")), "\"Watch\" is done.");
    }
}
