// A job's memory: one lpm-memory session that every run of an AI prompt job
// reads before it starts and saves to when it finishes, so a run builds on what
// the earlier ones did and found instead of starting cold each time.
use std::path::{Path, PathBuf};

/// Session names follow the memory folder's slug rule (session_memory_files.rs).
const MAX_SESSION_LEN: usize = 64;

/// The session every run of `job_id` shares.
pub fn session(job_id: &str) -> String {
    let mut slug = String::new();
    for c in job_id.chars().flat_map(char::to_lowercase) {
        if c.is_ascii_alphanumeric() {
            slug.push(c);
        } else if !slug.ends_with('-') {
            slug.push('-');
        }
    }
    let mut name = format!("job-{}", slug.trim_matches('-'));
    name.truncate(MAX_SESSION_LEN);
    name.trim_end_matches('-').to_string()
}

/// The folder the session lives in: the project's memory, or for a standalone
/// run — which happens in the home folder, like a global terminal — the one the
/// global terminals share.
pub fn dir(project: &str) -> Option<PathBuf> {
    let owner = if project.is_empty() {
        crate::config::RESERVED_PROJECT_NAME
    } else {
        project
    };
    crate::session_memory_scope::memory_dir(owner).ok()
}

/// What a run is told on top of its prompt. The file's path rides along so the
/// agent finds the session even where the skill isn't installed.
pub fn instruction(dir: &Path, job_id: &str) -> String {
    let session = session(job_id);
    let file = dir.join(format!("{session}.md"));
    format!(
        "This job keeps a memory of its runs in the lpm-memory session `{session}` ({}). \
         Use the lpm-memory skill: before you start, read that session to see what earlier runs did and found, \
         and build on it rather than repeating it. When you finish, save this run to it. \
         Don't mention the memory in your reply.",
        file.display()
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_names_are_valid_memory_slugs() {
        assert_eq!(session("nightly-deps"), "job-nightly-deps");
        assert_eq!(session("Nightly_Deps v2"), "job-nightly-deps-v2");
        assert_eq!(session("--weird--"), "job-weird");
        assert_eq!(session(""), "job");
        let long = session(&"a-".repeat(80));
        assert!(long.len() <= MAX_SESSION_LEN);
        assert!(!long.ends_with('-'));
    }

    #[test]
    fn a_standalone_job_remembers_alongside_the_global_terminals() {
        let standalone = dir("").unwrap();
        assert!(standalone.ends_with(Path::new("memory").join(crate::config::RESERVED_PROJECT_NAME)));
        assert!(dir("blog").unwrap().ends_with(Path::new("memory").join("blog")));
    }

    #[test]
    fn the_instruction_names_the_session_and_its_file() {
        let text = instruction(Path::new("/m/blog"), "deps");
        assert!(text.contains("`job-deps`"));
        assert!(text.contains(&Path::new("/m/blog").join("job-deps.md").display().to_string()));
        assert!(text.contains("lpm-memory skill"));
    }
}
