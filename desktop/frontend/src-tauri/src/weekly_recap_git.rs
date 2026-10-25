//! The weekly recap's Git numbers: lines the user committed across the
//! projects' repositories, and pull requests they opened on GitHub. A commit
//! reached from several copies or computers counts once, by its hash.
use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashSet};
use std::path::{Path, PathBuf};
use std::time::Duration;

const GH_TIMEOUT: Duration = Duration::from_secs(20);
const GH_LIMIT: &str = "1000";

/// One file changing by more lines than this in a commit was generated, vendored
/// or moved rather than written, like a test fixture or a build bundle.
const WRITTEN_MAX: u64 = 5_000;

/// Dependency lockfiles, rewritten by package managers rather than written.
const LOCKFILES: &[&str] = &[
    "package-lock.json",
    "npm-shrinkwrap.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lock",
    "Cargo.lock",
    "Gemfile.lock",
    "poetry.lock",
    "uv.lock",
    "Pipfile.lock",
    "composer.lock",
    "go.sum",
    "Podfile.lock",
    "Package.resolved",
    "gradle.lockfile",
    "flake.lock",
];

#[derive(Clone, Default, Debug, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct RecapCommit {
    pub(crate) sha: String,
    pub(crate) added: u64,
    pub(crate) removed: u64,
}

fn rfc3339(at: DateTime<Local>) -> String {
    at.format("%Y-%m-%dT%H:%M:%S%:z").to_string()
}

fn git(root: &Path, args: &[&str]) -> Option<String> {
    let out = crate::osproc::command("git")
        .args(args)
        .current_dir(root)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .output()
        .ok()?;
    out.status
        .success()
        .then(|| String::from_utf8_lossy(&out.stdout).into_owned())
}

/// `git log --numstat` output, one `commit <sha>` header per commit.
pub(crate) fn parse_numstat(out: &str) -> Vec<RecapCommit> {
    let mut commits: Vec<RecapCommit> = Vec::new();
    for line in out.lines() {
        if let Some(sha) = line.strip_prefix("commit ") {
            commits.push(RecapCommit {
                sha: sha.trim().to_string(),
                ..Default::default()
            });
            continue;
        }
        let Some(commit) = commits.last_mut() else {
            continue;
        };
        let mut fields = line.split('\t');
        let (Some(added), Some(removed), Some(path)) =
            (fields.next(), fields.next(), fields.next())
        else {
            continue;
        };
        let name = path.rsplit('/').next().unwrap_or(path);
        if LOCKFILES.contains(&name) {
            continue;
        }
        // A binary file shows `-` for both.
        let (added, removed) = (
            added.parse::<u64>().unwrap_or(0),
            removed.parse::<u64>().unwrap_or(0),
        );
        if added + removed > WRITTEN_MAX {
            continue;
        }
        commit.added += added;
        commit.removed += removed;
    }
    commits
}

fn repo_commits(root: &Path, from: DateTime<Local>, to: DateTime<Local>) -> Vec<RecapCommit> {
    let Some(email) = git(root, &["config", "user.email"]).map(|e| e.trim().to_string()) else {
        return Vec::new();
    };
    if email.is_empty() {
        return Vec::new();
    }
    let since = format!("--since={}", rfc3339(from));
    let until = format!("--until={}", rfc3339(to));
    let author = format!("--author={email}");
    git(
        root,
        &[
            "log",
            "--all",
            "--no-merges",
            "--fixed-strings",
            &author,
            &since,
            &until,
            "--numstat",
            "--format=commit %H",
        ],
    )
    .map(|out| parse_numstat(&out))
    .unwrap_or_default()
}

/// `owner/name` of a GitHub remote, lowercased; None for any other host.
pub(crate) fn github_repo(url: &str) -> Option<String> {
    let url = url.trim();
    let path = url
        .strip_prefix("git@github.com:")
        .or_else(|| url.split_once("github.com/").map(|(_, path)| path))?;
    let path = path.trim_end_matches('/').trim_end_matches(".git");
    let mut parts = path.split('/');
    let (Some(owner), Some(name), None) = (parts.next(), parts.next(), parts.next()) else {
        return None;
    };
    (!owner.is_empty() && !name.is_empty()).then(|| format!("{owner}/{name}").to_lowercase())
}

/// Every commit the user made in [from, to) across `roots`, and the GitHub
/// repositories they belong to.
pub(crate) fn commits_and_repos(
    roots: &[PathBuf],
    from: DateTime<Local>,
    to: DateTime<Local>,
) -> (Vec<RecapCommit>, Vec<String>) {
    let found: Vec<(Vec<RecapCommit>, Option<String>)> = std::thread::scope(|scope| {
        let handles: Vec<_> = roots
            .iter()
            .map(|root| {
                scope.spawn(move || {
                    let repo = git(root, &["remote", "get-url", "origin"])
                        .and_then(|url| github_repo(&url));
                    (repo_commits(root, from, to), repo)
                })
            })
            .collect();
        handles
            .into_iter()
            .filter_map(|handle| handle.join().ok())
            .collect()
    });
    let mut seen = HashSet::new();
    let mut commits = Vec::new();
    let mut repos = BTreeSet::new();
    for (found, repo) in found {
        commits.extend(found.into_iter().filter(|c| seen.insert(c.sha.clone())));
        repos.extend(repo);
    }
    (commits, repos.into_iter().collect())
}

#[derive(Deserialize)]
struct Found {
    repository: FoundRepo,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FoundRepo {
    name_with_owner: String,
}

/// The repository of each pull request the signed-in GitHub user opened in
/// [from, to); None when `gh` is missing, signed out or offline.
pub(crate) fn pull_request_repos(
    from: DateTime<Local>,
    to: DateTime<Local>,
) -> Option<Vec<String>> {
    if !crate::git::check_ghcli() {
        return None;
    }
    let last = to - chrono::Duration::seconds(1);
    let created = format!("--created={}..{}", rfc3339(from), rfc3339(last));
    let mut cmd = crate::osproc::command("gh");
    cmd.args([
        "search",
        "prs",
        "--author=@me",
        &created,
        "--json",
        "repository",
        "--limit",
        GH_LIMIT,
    ])
    .env("GH_PROMPT_DISABLED", "1")
    .env("GH_NO_UPDATE_NOTIFIER", "1");
    let out = crate::statusfwd::run_with_timeout(cmd, GH_TIMEOUT)?;
    let found: Vec<Found> = serde_json::from_slice(&out).ok()?;
    Some(
        found
            .into_iter()
            .map(|pr| pr.repository.name_with_owner.to_lowercase())
            .collect(),
    )
}

#[cfg(test)]
#[path = "weekly_recap_git_tests.rs"]
mod tests;
