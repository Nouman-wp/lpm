//! What a terminal's shell says about the commands typed into it: the line it
//! is about to run (zsh preexec, bash PS0) and how the last one ended (before
//! each prompt), as private OSCs that shellwrap.rs installs and xterm never
//! draws. The scanner picks them out of the pane's output where the pane runs,
//! so a tab can name what runs in it even while nothing is drawing it; a paired
//! Mac hears the same event forwarded (peer.rs).
use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub const EVENT: &str = "terminal-command";

const PREFIX: &str = "\x1b]770";
// The hooks cut the line at 200 characters; anything much longer isn't ours.
const MAX_BODY: usize = 1024;

#[derive(Debug, PartialEq)]
pub enum Mark {
    Start(String),
    End(i32),
}

/// Carries a mark split across output chunks over to the next one.
#[derive(Default)]
pub struct Scanner {
    partial: String,
}

enum Found {
    At(usize, usize),
    Broken,
    Incomplete,
}

impl Scanner {
    /// Feed one chunk of a terminal's output, telling the window about each mark.
    pub fn scan(&mut self, app: &AppHandle, id: &str, text: &str) {
        if self.partial.is_empty() && !text.contains('\x1b') {
            return;
        }
        for mark in self.feed(text) {
            let (command, code) = match mark {
                Mark::Start(line) => (Some(line), None),
                Mark::End(status) => (None, Some(status)),
            };
            let at = crate::status::now_millis();
            let _ = app.emit(
                EVENT,
                CommandEvent {
                    id,
                    command,
                    code,
                    at,
                },
            );
        }
    }

    pub fn feed(&mut self, text: &str) -> Vec<Mark> {
        let owned;
        let mut s = if self.partial.is_empty() {
            text
        } else {
            self.partial.push_str(text);
            owned = std::mem::take(&mut self.partial);
            owned.as_str()
        };
        let mut marks = Vec::new();
        while let Some(at) = s.find(PREFIX) {
            let rest = &s[at + PREFIX.len()..];
            match terminator(rest) {
                Found::At(end, len) => {
                    marks.extend(parse(&rest[..end]));
                    s = &rest[end + len..];
                }
                Found::Broken => s = rest,
                Found::Incomplete => {
                    self.partial = s[at..].to_string();
                    return marks;
                }
            }
        }
        self.partial = trailing_prefix(s).to_string();
        marks
    }
}

fn terminator(rest: &str) -> Found {
    let bytes = rest.as_bytes();
    for (i, &b) in bytes.iter().enumerate() {
        if i > MAX_BODY {
            return Found::Broken;
        }
        match b {
            0x07 => return Found::At(i, 1),
            0x1b => {
                return match bytes.get(i + 1) {
                    Some(b'\\') => Found::At(i, 2),
                    Some(_) => Found::Broken,
                    None => Found::Incomplete,
                }
            }
            _ => {}
        }
    }
    Found::Incomplete
}

/// `3;<line>` or `4;<status>`: what follows the shared `ESC ] 770`.
fn parse(body: &str) -> Option<Mark> {
    match body.split_once(';')? {
        ("3", line) => Some(Mark::Start(line.to_string())),
        ("4", status) => status.trim().parse().ok().map(Mark::End),
        _ => None,
    }
}

/// The end of a chunk that could be the start of the next mark.
fn trailing_prefix(s: &str) -> &str {
    (1..PREFIX.len())
        .rev()
        .find(|&n| s.ends_with(&PREFIX[..n]))
        .map_or("", |n| &s[s.len() - n..])
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CommandEvent<'a> {
    id: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<i32>,
    at: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn feed_all(chunks: &[&str]) -> Vec<Mark> {
        let mut scanner = Scanner::default();
        chunks.iter().flat_map(|c| scanner.feed(c)).collect()
    }

    #[test]
    fn reads_a_command_and_how_it_ended() {
        assert_eq!(
            feed_all(&["$ pnpm test\r\n\x1b]7703;pnpm test\x07 ✓ 9 passed\r\n\x1b]7704;0\x07$ "]),
            vec![Mark::Start("pnpm test".into()), Mark::End(0)],
        );
    }

    #[test]
    fn takes_the_string_terminator_too() {
        assert_eq!(feed_all(&["\x1b]7704;130\x1b\\"]), vec![Mark::End(130)]);
    }

    #[test]
    fn joins_a_mark_split_across_chunks() {
        assert_eq!(
            feed_all(&["out\x1b", "]77", "03;cargo bu", "ild --rel", "ease\x07more"]),
            vec![Mark::Start("cargo build --release".into())],
        );
        assert_eq!(feed_all(&["\x1b]7704;1", "\x1b", "\\"]), vec![Mark::End(1)]);
    }

    #[test]
    fn leaves_other_sequences_alone() {
        assert_eq!(
            feed_all(&["\x1b]0;title\x07\x1b]7701;0\x07\x1b]7702;\x07\x1b[31mred\x1b[0m"]),
            vec![],
        );
    }

    #[test]
    fn drops_a_mark_cut_off_by_another_sequence() {
        assert_eq!(
            feed_all(&["\x1b]7703;half\x1b[0m\x1b]7704;2\x07"]),
            vec![Mark::End(2)],
        );
    }

    #[test]
    fn keeps_unicode_whole() {
        assert_eq!(
            feed_all(&["é\x1b]7703;echo «héllo» 🚀\x07é"]),
            vec![Mark::Start("echo «héllo» 🚀".into())],
        );
    }

    #[test]
    fn carries_nothing_after_plain_output() {
        let mut scanner = Scanner::default();
        scanner.feed("plain text\x1b[0m");
        assert!(scanner.partial.is_empty());
        scanner.feed("ends with \x1b]7");
        assert_eq!(scanner.partial, "\x1b]7");
    }
}
