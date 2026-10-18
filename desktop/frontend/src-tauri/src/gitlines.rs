//! How many lines a project's uncommitted changes add and remove, for the phone's
//! terminal header. Counted the way the phone's review screen diffs each file:
//! a tracked file against HEAD, an untracked file as wholly added, a binary file
//! as nothing.
use crate::git::ChangedFile;
use std::collections::HashSet;
use std::io::Read;
use std::path::Path;

/// How much of an untracked file is read to count its lines, so a huge log left
/// in the tree can't stall the snapshot.
const UNTRACKED_READ_CAP: u64 = 4 * 1024 * 1024;

/// Git's own test for binary content: a NUL byte near the start.
const BINARY_SNIFF: usize = 8000;

pub fn line_totals(cwd: &str, files: &[ChangedFile]) -> (u64, u64) {
    let tracked: HashSet<&str> = files
        .iter()
        .filter(|f| f.status != "untracked")
        .map(|f| f.path.as_str())
        .collect();
    let (mut added, removed) = tracked_totals(cwd, &tracked);
    for f in files.iter().filter(|f| f.status == "untracked") {
        added += untracked_lines(&Path::new(cwd).join(&f.path));
    }
    (added, removed)
}

fn tracked_totals(cwd: &str, tracked: &HashSet<&str>) -> (u64, u64) {
    if tracked.is_empty() {
        return (0, 0);
    }
    // Renames split into a delete and an add, as the review screen diffs only
    // the new path.
    let out = crate::git::git_command(
        cwd,
        &["--no-optional-locks", "diff", "HEAD", "--numstat", "--no-renames", "-z"],
        &[],
    )
    .output();
    match out {
        Ok(o) if o.status.success() => parse_numstat(&String::from_utf8_lossy(&o.stdout), tracked),
        _ => (0, 0),
    }
}

/// Sums `git diff --numstat -z` rows for the listed paths. A binary file's row
/// reads `-` for both counts and adds nothing.
fn parse_numstat(raw: &str, tracked: &HashSet<&str>) -> (u64, u64) {
    raw.split('\0')
        .filter_map(|row| {
            let mut cols = row.splitn(3, '\t');
            let (added, removed, path) = (cols.next()?, cols.next()?, cols.next()?);
            tracked
                .contains(path)
                .then(|| (added.parse().unwrap_or(0), removed.parse().unwrap_or(0)))
        })
        .fold((0, 0), |(a, r), (da, dr): (u64, u64)| (a + da, r + dr))
}

fn untracked_lines(path: &Path) -> u64 {
    let Ok(file) = std::fs::File::open(path) else {
        return 0;
    };
    let mut bytes = Vec::new();
    if file.take(UNTRACKED_READ_CAP).read_to_end(&mut bytes).is_err() {
        return 0;
    }
    count_lines(&bytes)
}

fn count_lines(bytes: &[u8]) -> u64 {
    if bytes.iter().take(BINARY_SNIFF).any(|&b| b == 0) {
        return 0;
    }
    let newlines = bytes.iter().filter(|&&b| b == b'\n').count() as u64;
    newlines + u64::from(bytes.last().is_some_and(|&b| b != b'\n'))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numstat_sums_listed_paths_only() {
        let raw = "3\t1\tsrc/a.rs\0-\t-\tlogo.png\010\t0\tnew name.txt\00\t7\told.txt\0";
        let tracked: HashSet<&str> = ["src/a.rs", "logo.png", "new name.txt"].into();
        assert_eq!(parse_numstat(raw, &tracked), (13, 1));
    }

    #[test]
    fn numstat_of_nothing_is_zero() {
        assert_eq!(parse_numstat("", &["a"].into()), (0, 0));
    }

    #[test]
    fn counts_lines_with_or_without_a_final_newline() {
        assert_eq!(count_lines(b""), 0);
        assert_eq!(count_lines(b"one\ntwo\n"), 2);
        assert_eq!(count_lines(b"one\ntwo"), 2);
    }

    #[test]
    fn binary_files_count_nothing() {
        assert_eq!(count_lines(b"PNG\0\x01\x02\n\n"), 0);
    }
}
