// What lpm has posted to Telegram for automation questions: which messages
// carry which question's buttons, and their text, so a tap or a reply can be
// matched to the question and to the exact message lpm posted. Plus where
// reading the bot's updates got to. Kept in ~/.lpm/telegram-asks.json, which
// config sync never carries: another Mac's taps aren't this one's, and polling
// must not set off a sync.

use crate::config;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::Mutex;

const FILE: &str = "telegram-asks.json";
const KEEP_CLOSED_SECS: u64 = 24 * 60 * 60;

#[derive(Serialize, Deserialize, Default, Clone, Debug, PartialEq)]
pub struct Record {
    /// The bot the entries were posted through; another bot clears them.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bot: Option<String>,
    /// The next update to read: everything before it was handled.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offset: Option<i64>,
    /// Updates from the offset on that were already dealt with, while one
    /// before them is held back for another Mac.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub handled: Vec<i64>,
    #[serde(default)]
    pub entries: Vec<Entry>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Entry {
    pub ask: String,
    pub project: String,
    pub job: String,
    pub chat: i64,
    /// Whether people can write in the chat (not a channel).
    pub replies: bool,
    /// Only the user reads a private chat, so its closed button may say what
    /// was answered.
    #[serde(default)]
    pub private: bool,
    #[serde(rename = "postedAt")]
    pub posted_at: u64,
    #[serde(rename = "closedAt", default, skip_serializing_if = "Option::is_none")]
    pub closed_at: Option<u64>,
    pub posts: Vec<Post>,
    /// Messages lpm sent asking for an answer in the user's own words.
    #[serde(default)]
    pub prompts: Vec<Post>,
    /// Options ticked so far on a question that takes several.
    #[serde(default)]
    pub picked: Vec<usize>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Post {
    pub message: i64,
    /// The buttons as lpm last set them; a tap on any others is refused.
    #[serde(default)]
    pub keyboard: Value,
    /// The text as Telegram stored it when lpm sent it; anyone holding the
    /// bot's token could edit it under unchanged buttons.
    #[serde(default)]
    pub text: String,
}

impl Entry {
    pub fn is_open(&self) -> bool {
        self.closed_at.is_none()
    }

    /// The question's own message, or one of its prompts, with id `message`.
    pub fn message(&self, message: i64) -> Option<&Post> {
        self.posts
            .iter()
            .chain(&self.prompts)
            .find(|p| p.message == message)
    }

    pub fn holds(&self, chat: i64, message: i64) -> bool {
        self.chat == chat && self.message(message).is_some()
    }
}

impl Record {
    pub fn has_open(&self) -> bool {
        self.entries.iter().any(Entry::is_open)
    }

    pub fn find(&self, ask: &str, chat: i64, message: i64) -> Option<&Entry> {
        self.entries
            .iter()
            .find(|e| e.ask == ask && e.holds(chat, message))
    }

    pub fn find_mut(&mut self, ask: &str, chat: i64) -> Option<&mut Entry> {
        self.entries
            .iter_mut()
            .find(|e| e.ask == ask && e.chat == chat)
    }

    pub fn knows_ask(&self, ask: &str) -> bool {
        self.entries.iter().any(|e| e.ask == ask)
    }

    /// Drops what another bot posted and what has long been settled. An open
    /// question stays until lpm says it closed. `bot` is None when the link
    /// couldn't be read, which proves nothing about the bot.
    pub fn prune(&mut self, bot: Option<Option<&str>>, now: u64) {
        if let Some(bot) = bot {
            if self.bot.as_deref() != bot {
                *self = Record {
                    bot: bot.map(str::to_string),
                    ..Record::default()
                };
                return;
            }
        }
        self.entries
            .retain(|e| e.closed_at.is_none_or(|closed| now.saturating_sub(closed) < KEEP_CLOSED_SECS));
    }
}

fn path() -> PathBuf {
    config::lpm_dir().join(FILE)
}

fn load() -> Record {
    std::fs::read(path())
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

fn save(record: &Record) -> Result<(), String> {
    let path = path();
    let tmp = path.with_extension("json.tmp");
    let text = serde_json::to_string_pretty(record).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, text).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |d| d.as_secs())
}

static LOCK: Mutex<()> = Mutex::new(());

/// Read, change and write the record as one step for this process. Never
/// called around anything that answers a question: answering emits the event
/// whose listener comes back here.
pub fn with<T>(f: impl FnOnce(&mut Record) -> T) -> T {
    let _guard = LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let mut record = load();
    let bot = crate::telegramlink::Link::try_load().map(|l| l.bot);
    record.prune(bot.as_ref().map(|b| b.as_deref()), now_secs());
    let before = record.clone();
    let out = f(&mut record);
    if record != before {
        let _ = save(&record);
    }
    out
}

pub fn now() -> u64 {
    now_secs()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn post(message: i64) -> Post {
        Post {
            message,
            keyboard: json!({}),
            text: "Ship it?".into(),
        }
    }

    fn entry(ask: &str, closed_at: Option<u64>) -> Entry {
        Entry {
            ask: ask.into(),
            project: "lpm".into(),
            job: "daily-short".into(),
            chat: 42,
            replies: true,
            private: true,
            posted_at: 0,
            closed_at,
            posts: vec![post(7)],
            prompts: vec![post(9)],
            picked: Vec::new(),
        }
    }

    fn record(entries: Vec<Entry>) -> Record {
        Record {
            bot: Some("lpm_bot".into()),
            offset: Some(5),
            handled: vec![6],
            entries,
        }
    }

    #[test]
    fn finds_a_question_by_the_chat_and_a_message_it_owns() {
        let r = record(vec![entry("a1", None)]);
        assert!(r.find("a1", 42, 7).is_some());
        assert!(r.find("a1", 42, 9).is_some());
        assert!(r.find("a1", 43, 7).is_none());
        assert!(r.find("a1", 42, 8).is_none());
        assert!(r.find("b2", 42, 7).is_none());
    }

    #[test]
    fn keeps_an_open_question_and_a_closed_one_for_a_day() {
        let day = KEEP_CLOSED_SECS;
        let mut r = record(vec![entry("open", None), entry("recent", Some(10 * day)), entry("old", Some(day))]);
        r.prune(Some(Some("lpm_bot")), 10 * day + 60);
        let left: Vec<&str> = r.entries.iter().map(|e| e.ask.as_str()).collect();
        assert_eq!(left, ["open", "recent"]);
    }

    #[test]
    fn a_new_bot_clears_everything_but_an_unreadable_link_clears_nothing() {
        let mut r = record(vec![entry("a1", None)]);
        r.prune(None, 0);
        assert_eq!(r.entries.len(), 1);
        r.prune(Some(Some("other_bot")), 0);
        assert_eq!(r, Record { bot: Some("other_bot".into()), ..Record::default() });
        let mut r = record(vec![entry("a1", None)]);
        r.prune(Some(None), 0);
        assert!(r.entries.is_empty());
    }

    #[test]
    fn round_trips_through_json_and_reads_an_older_file() {
        let r = record(vec![entry("a1", None)]);
        let text = serde_json::to_string(&r).unwrap();
        assert_eq!(serde_json::from_str::<Record>(&text).unwrap(), r);
        let old = json!({ "entries": [{ "ask": "a1", "project": "", "job": "j", "chat": 1, "replies": true,
            "postedAt": 0, "posts": [{ "message": 3, "keyboard": {} }] }] });
        let r: Record = serde_json::from_value(old).unwrap();
        assert!(!r.entries[0].private);
        assert_eq!(r.entries[0].posts[0].text, "");
    }
}
