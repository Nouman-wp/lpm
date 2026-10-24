// Text search across a project's files, for the Files pane when no file name
// matches what was typed: the files that mention it, each with its first
// matching line. Same walk as the mention picker (skip dirs, entry cap), so it
// reaches what the tree lists and nothing it leaves out.
use crate::config::{expand_home, SshSettings};
use crate::files::{list_dir_files, MENTION_SKIP_DIRS};
use serde::Serialize;
use std::path::Path;
use std::time::{Duration, Instant};

const MATCH_CAP: usize = 50;
// Larger files are logs, bundles and data dumps: slow to scan, rarely the hit.
const FILE_BYTES_CAP: u64 = 1024 * 1024;
const TIME_BUDGET: Duration = Duration::from_secs(4);
const SNIPPET_CHARS: usize = 200;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentMatch {
    pub path: String,
    pub line: usize,
    pub text: String,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ContentSearch {
    pub matches: Vec<ContentMatch>,
    // Stopped at the match cap or the time budget; more files may mention it.
    pub truncated: bool,
}

/// Files under `root` whose text contains `query`, ignoring case, as paths
/// relative to `root` with the first matching line. Runs off the UI thread.
#[tauri::command(async)]
pub fn search_file_contents(root: String, query: String) -> Result<ContentSearch, String> {
    let query = query.trim().to_string();
    if root.is_empty() || query.is_empty() {
        return Ok(ContentSearch::default());
    }
    if let Some(ssh) = crate::sshexec::remote_project_for_path(&root) {
        return remote_search(&ssh, &root, &query);
    }
    let base = expand_home(&root);
    let needle = query.to_lowercase();
    let started = Instant::now();
    let mut found = ContentSearch::default();
    for entry in list_dir_files(root)?.into_iter().filter(|e| !e.is_dir) {
        if found.matches.len() >= MATCH_CAP || started.elapsed() > TIME_BUDGET {
            found.truncated = true;
            break;
        }
        if let Some((line, text)) = first_match(&Path::new(&base).join(&entry.path), &needle) {
            found.matches.push(ContentMatch {
                path: entry.path,
                line,
                text,
            });
        }
    }
    Ok(found)
}

fn first_match(path: &Path, needle: &str) -> Option<(usize, String)> {
    let meta = std::fs::metadata(path).ok()?;
    if !meta.is_file() || meta.len() > FILE_BYTES_CAP {
        return None;
    }
    let bytes = std::fs::read(path).ok()?;
    if is_binary(&bytes) {
        return None;
    }
    String::from_utf8_lossy(&bytes)
        .lines()
        .enumerate()
        .find(|(_, line)| line.to_lowercase().contains(needle))
        .map(|(i, line)| (i + 1, snippet(line)))
}

// Git's rule: a NUL in the first 8000 bytes.
fn is_binary(bytes: &[u8]) -> bool {
    bytes[..bytes.len().min(8000)].contains(&0)
}

fn snippet(line: &str) -> String {
    line.trim().chars().take(SNIPPET_CHARS).collect()
}

/// The same search on an SSH project's host, with its `grep`: one line per
/// file (`-m 1`), the name ended by a NUL so any character can be in it.
fn remote_search(ssh: &SshSettings, root: &str, query: &str) -> Result<ContentSearch, String> {
    let mut args: Vec<String> = ["-rIinF", "-m", "1", "--null"].map(String::from).to_vec();
    args.extend(
        MENTION_SKIP_DIRS
            .iter()
            .map(|dir| format!("--exclude-dir={dir}")),
    );
    args.extend(["-e".to_string(), query.to_string(), ".".to_string()]);
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = crate::sshexec::remote_command(ssh, root, "grep", &refs, &[])
        .output()
        .map_err(|e| e.to_string())?;
    // grep exits 1 when nothing matched and 2 when some file couldn't be read;
    // either way, whatever it printed is the answer.
    if out.stdout.is_empty() && !out.status.success() && out.status.code() != Some(1) {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        return Err(if err.is_empty() {
            "grep failed on the host".into()
        } else {
            err
        });
    }
    Ok(parse_grep(&String::from_utf8_lossy(&out.stdout)))
}

fn parse_grep(stdout: &str) -> ContentSearch {
    let mut found = ContentSearch::default();
    for record in stdout.lines() {
        if found.matches.len() >= MATCH_CAP {
            found.truncated = true;
            break;
        }
        let Some((path, rest)) = record.split_once('\0') else {
            continue;
        };
        let Some((line, text)) = rest.split_once(':') else {
            continue;
        };
        let Ok(line) = line.parse() else {
            continue;
        };
        found.matches.push(ContentMatch {
            path: path.strip_prefix("./").unwrap_or(path).to_string(),
            line,
            text: snippet(text),
        });
    }
    found
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_the_first_matching_line_ignoring_case() {
        let dir = std::env::temp_dir().join(format!("lpm-file-search-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("src")).unwrap();
        std::fs::write(
            dir.join("src/cart.ts"),
            "const a = 1;\nexport function useCartTotal() {}\n",
        )
        .unwrap();
        std::fs::write(dir.join("README.md"), "nothing here\n").unwrap();
        std::fs::write(dir.join("logo.bin"), b"useCartTotal\0\x01").unwrap();
        let found = search_file_contents(dir.to_string_lossy().into_owned(), "usecarttotal".into())
            .unwrap();
        std::fs::remove_dir_all(&dir).unwrap();
        assert_eq!(found.matches.len(), 1);
        let hit = &found.matches[0];
        assert_eq!(Path::new(&hit.path), Path::new("src").join("cart.ts"));
        assert_eq!(hit.line, 2);
        assert_eq!(hit.text, "export function useCartTotal() {}");
        assert!(!found.truncated);
    }

    #[test]
    fn reads_grep_output_with_any_file_name() {
        let found = parse_grep(
            "./src/a: b.ts\u{0}12:  let x = useCartTotal();\n./README.md\u{0}3:see useCartTotal\n",
        );
        let got: Vec<(&str, usize, &str)> = found
            .matches
            .iter()
            .map(|m| (m.path.as_str(), m.line, m.text.as_str()))
            .collect();
        assert_eq!(
            got,
            vec![
                ("src/a: b.ts", 12, "let x = useCartTotal();"),
                ("README.md", 3, "see useCartTotal"),
            ]
        );
    }
}
