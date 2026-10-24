use super::*;
use std::process::Command;

fn files(names: &[&str]) -> Vec<String> {
    names.iter().map(|s| s.to_string()).collect()
}

#[test]
fn the_conflicts_section_is_read_commented_or_not() {
    let msg = "Merge branch 'feature'\n\n# Conflicts:\n#\td.txt\n#\tsrc/f.txt\n";
    assert_eq!(conflicts_in_msg(msg), files(&["d.txt", "src/f.txt"]));
    let old = "Merge branch 'feature'\n\nConflicts:\n\ta.txt\n\tb.txt\n";
    assert_eq!(conflicts_in_msg(old), files(&["a.txt", "b.txt"]));
    let other_char = "Merge branch 'x'\n\n; Conflicts:\n;\ta.txt\n";
    assert_eq!(conflicts_in_msg(other_char), files(&["a.txt"]));
    assert!(conflicts_in_msg("Merge branch 'feature'\n").is_empty());
    assert!(conflicts_in_msg("").is_empty());
}

#[test]
fn the_source_is_the_quoted_name_on_the_first_line() {
    assert_eq!(
        source_in_msg("Merge branch 'feature'\n\n# Conflicts:"),
        Some("feature".into())
    );
    assert_eq!(
        source_in_msg("Merge remote-tracking branch 'origin/fix/a' into main"),
        Some("origin/fix/a".into())
    );
    assert_eq!(
        source_in_msg("Merge branch 'main' of github.com:me/app"),
        Some("main".into())
    );
    assert_eq!(source_in_msg("Merge made by hand"), None);
    assert_eq!(source_in_msg(""), None);
}

#[test]
fn marker_lines_are_grouped_per_file_and_sorted() {
    let out = "a.txt:9:<<<<<<< HEAD\na.txt:2:<<<<<<< HEAD\nb:c.txt:4:<<<<<<< HEAD\nb:1:<<<<<<<\n";
    let found = parse_marker_lines(out, &files(&["a.txt", "b", "b:c.txt"]));
    assert_eq!(found.get("a.txt"), Some(&vec![2, 9]));
    assert_eq!(found.get("b:c.txt"), Some(&vec![4]));
    assert_eq!(found.get("b"), Some(&vec![1]));
    assert!(parse_marker_lines("other.txt:1:<<<<<<<\n", &files(&["a.txt"])).is_empty());
}

fn git(dir: &Path, args: &[&str]) {
    Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .unwrap();
}

fn write(dir: &Path, name: &str, text: &str) {
    std::fs::write(dir.join(name), text).unwrap();
}

/// `main` merging `feature`, stopped on three conflicts: two edits on both
/// sides (f.txt with two blocks) and d.txt, which feature deleted.
fn stopped_merge() -> (tempfile::TempDir, String) {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path();
    git(dir, &["init", "-q", "-b", "main"]);
    git(dir, &["config", "user.email", "t@t"]);
    git(dir, &["config", "user.name", "t"]);
    write(dir, "f.txt", "a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n");
    write(dir, "g.txt", "x\n");
    write(dir, "d.txt", "keep\n");
    git(dir, &["add", "."]);
    git(dir, &["commit", "-qm", "init"]);
    git(dir, &["checkout", "-qb", "feature"]);
    write(dir, "f.txt", "a\nB-feat\nc\nd\ne\nf\ng\nh\nI-feat\nj\n");
    write(dir, "g.txt", "x-feat\n");
    git(dir, &["rm", "-q", "d.txt"]);
    git(dir, &["commit", "-qam", "feat"]);
    git(dir, &["checkout", "-q", "main"]);
    write(dir, "f.txt", "a\nB-main\nc\nd\ne\nf\ng\nh\nI-main\nj\n");
    write(dir, "g.txt", "x-main\n");
    write(dir, "d.txt", "keep-main\n");
    git(dir, &["commit", "-qam", "main"]);
    git(dir, &["merge", "--no-edit", "feature"]);
    let cwd = dir.to_str().unwrap().to_string();
    (tmp, cwd)
}

fn file<'a>(state: &'a MergeState, path: &str) -> &'a ConflictFile {
    state.files.iter().find(|f| f.path == path).unwrap()
}

#[test]
fn a_stopped_merge_lists_each_file_with_its_conflict_count() {
    let (_tmp, cwd) = stopped_merge();
    let state = git_merge_state(cwd);
    assert!(state.merging);
    assert_eq!(state.source, "feature");
    assert_eq!(state.files.len(), 3);
    let f = file(&state, "f.txt");
    assert_eq!((f.conflicts, f.first_line, f.resolved), (2, 2, false));
    let g = file(&state, "g.txt");
    assert_eq!((g.conflicts, g.first_line, g.resolved), (1, 1, false));
    let d = file(&state, "d.txt");
    assert_eq!((d.conflicts, d.resolved), (0, false));
}

#[test]
fn taking_a_side_resolves_the_file_and_keeps_it_listed() {
    let (_tmp, cwd) = stopped_merge();
    git_take_conflict_side(cwd.clone(), "g.txt".into(), "theirs".into()).unwrap();
    assert_eq!(
        std::fs::read_to_string(Path::new(&cwd).join("g.txt")).unwrap(),
        "x-feat\n"
    );
    git_take_conflict_side(cwd.clone(), "f.txt".into(), "ours".into()).unwrap();
    assert!(std::fs::read_to_string(Path::new(&cwd).join("f.txt"))
        .unwrap()
        .contains("B-main"));
    git_take_conflict_side(cwd.clone(), "d.txt".into(), "theirs".into()).unwrap();
    assert!(!Path::new(&cwd).join("d.txt").exists());

    let state = git_merge_state(cwd.clone());
    assert_eq!(state.files.len(), 3);
    assert!(state.files.iter().all(|f| f.resolved), "{:?}", state.files);
    assert!(git_take_conflict_side(cwd, "g.txt".into(), "ours".into()).is_err());
}

#[test]
fn a_hand_edit_is_resolved_only_once_marked() {
    let (_tmp, cwd) = stopped_merge();
    let dir = Path::new(&cwd);
    assert!(git_mark_conflict_resolved(cwd.clone(), "f.txt".into()).is_err());
    write(dir, "f.txt", "a\nB\nc\nd\ne\nf\ng\nh\nI\nj\n");
    let f = file(&git_merge_state(cwd.clone()), "f.txt").clone();
    assert_eq!((f.conflicts, f.resolved), (0, false));
    git_mark_conflict_resolved(cwd.clone(), "f.txt".into()).unwrap();
    assert!(file(&git_merge_state(cwd.clone()), "f.txt").resolved);
    assert!(git_continue_merge(cwd)
        .unwrap_err()
        .contains("still have conflicts"));
}

#[test]
fn continuing_commits_the_merge_without_the_conflicts_comment() {
    let (_tmp, cwd) = stopped_merge();
    for path in ["f.txt", "g.txt", "d.txt"] {
        git_take_conflict_side(cwd.clone(), path.into(), "theirs".into()).unwrap();
    }
    git_continue_merge(cwd.clone()).unwrap();
    assert!(!merging(&cwd));
    let msg = git_out(&cwd, &["log", "-1", "--format=%B"]).unwrap();
    assert_eq!(msg, "Merge branch 'feature'");
    let parents = git_out(&cwd, &["log", "-1", "--format=%P"]).unwrap();
    assert_eq!(parents.split_whitespace().count(), 2);
    assert!(git_continue_merge(cwd).unwrap_err().contains("No merge"));
}
