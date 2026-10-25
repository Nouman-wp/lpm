use super::*;
use chrono::Duration;

#[test]
fn adds_up_each_commits_written_lines() {
    let out = "commit aaa\n\n3\t1\tsrc/a.rs\n-\t-\tlogo.png\n10\t0\tREADME.md\n900\t80\tweb/package-lock.json\ncommit bbb\n\n0\t4\tsrc/b.rs\n40\t2\tCargo.lock\n49749\t0\ttest/fixture.json\n";
    assert_eq!(
        parse_numstat(out),
        [
            RecapCommit {
                sha: "aaa".into(),
                added: 13,
                removed: 1
            },
            RecapCommit {
                sha: "bbb".into(),
                added: 0,
                removed: 4
            },
        ]
    );
}

#[test]
fn reads_github_remotes_in_every_form() {
    for url in [
        "git@github.com:Owner/Repo.git",
        "https://github.com/owner/repo",
        "https://github.com/owner/repo.git\n",
        "ssh://git@github.com/owner/repo.git",
        "https://token@github.com/owner/repo/",
    ] {
        assert_eq!(github_repo(url).as_deref(), Some("owner/repo"), "{url}");
    }
    assert_eq!(github_repo("git@gitlab.com:owner/repo.git"), None);
    assert_eq!(github_repo("https://github.com/owner"), None);
}

fn run(root: &Path, args: &[&str]) {
    let status = std::process::Command::new("git")
        .args(args)
        .current_dir(root)
        .env("GIT_CONFIG_GLOBAL", "/dev/null")
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .status()
        .unwrap();
    assert!(status.success(), "git {args:?}");
}

#[test]
fn counts_the_users_own_commits_once_across_copies() {
    let dir = tempfile::tempdir().unwrap();
    let repo = dir.path().join("app");
    std::fs::create_dir(&repo).unwrap();
    run(&repo, &["init", "-q"]);
    run(&repo, &["config", "user.email", "me@example.com"]);
    run(&repo, &["config", "user.name", "Me"]);
    run(
        &repo,
        &["remote", "add", "origin", "git@github.com:me/app.git"],
    );
    std::fs::write(repo.join("a.txt"), "one\ntwo\nthree\n").unwrap();
    run(&repo, &["add", "."]);
    run(&repo, &["commit", "-qm", "mine"]);
    std::fs::write(repo.join("a.txt"), "one\n").unwrap();
    run(
        &repo,
        &[
            "commit",
            "-qam",
            "someone else's",
            "--author",
            "Other <other@example.com>",
        ],
    );
    let copy = dir.path().join("copy");
    run(
        dir.path(),
        &[
            "clone",
            "-q",
            repo.to_str().unwrap(),
            copy.to_str().unwrap(),
        ],
    );
    run(&copy, &["config", "user.email", "me@example.com"]);

    let now = Local::now();
    let (commits, repos) = commits_and_repos(
        &[repo, copy],
        now - Duration::days(1),
        now + Duration::days(1),
    );
    assert_eq!(commits.len(), 1);
    assert_eq!((commits[0].added, commits[0].removed), (3, 0));
    assert_eq!(repos, ["me/app"]);
}
