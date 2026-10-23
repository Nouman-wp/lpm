//! How a service pane's shell says that the line lpm typed has finished, and
//! with what status, and when it starts running it. A service runs as a line typed into a shell
//! (sessionpane.rs), so it is the shell's child and only the shell can wait on
//! it. zsh and bash print `$?` before each prompt as a private OSC, which the
//! pane's parser takes and never draws (termvt.rs). Other shells say nothing,
//! and a service there reads as running for as long as its shell lives.
//!
//! Just before running a line, zsh (preexec) and bash 4.4+ (PS0) print a second
//! OSC. The parser drops the rows from where the line was typed to there, so a
//! service's log starts at its own output rather than at the line echoed back
//! twice, by the terminal and again by the prompt. It ends in an empty `;`
//! payload because ConPTY drops an OSC that has none.
//!
//! zsh gets the hook through ZDOTDIR, the way lpm's terminals get theirs
//! (shellwrap.rs), added after the user's .zshrc so nothing in it can drop the
//! hook. bash gets PROMPT_COMMAND and an exported function, which un-exports
//! both at the first prompt so nothing the service starts inherits them.
use portable_pty::CommandBuilder;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

pub const PROMPT_OSC: &str = "7701";
pub const EXEC_OSC: &str = "7702";

const ZSH_HOOK: &str = r#"_lpm_pane_prompt() { builtin printf '\033]7701;%d\007' $? }
_lpm_pane_exec() { builtin printf '\033]7702;\007' }
precmd_functions=(_lpm_pane_prompt $precmd_functions)
preexec_functions=(_lpm_pane_exec $preexec_functions)"#;

const BASH_FN: &str = r#"() { local s=$?; builtin printf '\033]7701;%d\007' "$s"; [[ $PS0 == *7702* ]] || PS0=$'\e]7702;\a'$PS0; export -n PROMPT_COMMAND; export -nf _lpm_pane_prompt; return $s; }"#;

const BASH_FN_NAME: &str = "_lpm_pane_prompt";

fn zshrc() -> String {
    format!(
        "ZDOTDIR=$LPM_USER_ZDOTDIR\nunset LPM_USER_ZDOTDIR\n[[ -f $ZDOTDIR/.zshrc ]] && builtin source $ZDOTDIR/.zshrc\n{ZSH_HOOK}\n"
    )
}

/// Wire the hook into a service pane's shell. Called after the pane's
/// environment is filled in, since it extends what the shell would inherit.
pub fn apply(builder: &mut CommandBuilder, shell: &str) {
    match crate::shellwrap::shell_name(shell) {
        "zsh" => {
            let Some(dir) = zsh_dir() else {
                return;
            };
            if let Ok(user) = std::env::var("ZDOTDIR") {
                builder.env("LPM_USER_ZDOTDIR", user);
            }
            builder.env("ZDOTDIR", dir);
        }
        "bash" => {
            builder.env(
                "PROMPT_COMMAND",
                crate::shellwrap::bash_prompt_command(
                    BASH_FN_NAME,
                    std::env::var("PROMPT_COMMAND").ok(),
                ),
            );
            builder.env(format!("BASH_FUNC_{BASH_FN_NAME}%%"), BASH_FN);
        }
        _ => {}
    }
}

fn zsh_dir() -> Option<&'static Path> {
    static DIR: OnceLock<Option<PathBuf>> = OnceLock::new();
    DIR.get_or_init(|| {
        // Tests open real panes; their files stay out of the developer's ~/.lpm.
        #[cfg(test)]
        let dir = std::env::temp_dir().join(format!("lpm-test-pane-zsh-{}", std::process::id()));
        #[cfg(not(test))]
        let dir = crate::config::lpm_dir().join("shell").join("pane-zsh");
        write_zsh_files(&dir).ok().map(|()| dir)
    })
    .as_deref()
}

fn write_zsh_files(dir: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dir)?;
    for (name, body) in [
        (".zshenv", crate::shellwrap::ZSHENV.to_string()),
        (".zprofile", crate::shellwrap::ZPROFILE.to_string()),
        (".zshrc", zshrc()),
    ] {
        let path = dir.join(name);
        if std::fs::read_to_string(&path).ok().as_deref() != Some(body.as_str()) {
            std::fs::write(&path, body)?;
        }
    }
    Ok(())
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::process::Command;

    fn reported(out: &[u8]) -> Vec<i32> {
        let mut grid = crate::termgrid::Grid::new(80, 5);
        let mut parser = crate::termvt::Parser::default();
        parser.feed(out, &mut grid);
        parser.take_prompts()
    }

    fn has(shell: &str) -> bool {
        Command::new(shell).arg("-c").arg("true").status().is_ok()
    }

    /// The hook runs first at every prompt, ahead of the precmd hooks the
    /// user's own .zshrc added, and reports the status it was handed.
    #[test]
    fn zsh_reports_the_status_ahead_of_the_users_hooks() {
        if !has("zsh") {
            return;
        }
        let shim = tempfile::tempdir().unwrap();
        write_zsh_files(shim.path()).unwrap();
        let home = tempfile::tempdir().unwrap();
        std::fs::write(
            home.path().join(".zshrc"),
            "mine() { false }\nprecmd_functions+=(mine)\n",
        )
        .unwrap();
        let out = Command::new("zsh")
            .args([
                "-l",
                "-i",
                "-c",
                "print -r -- $precmd_functions; (exit 3); _lpm_pane_prompt",
            ])
            .env("HOME", home.path())
            .env("ZDOTDIR", shim.path())
            .env_remove("LPM_USER_ZDOTDIR")
            .output()
            .unwrap();
        assert!(
            String::from_utf8_lossy(&out.stdout).starts_with("_lpm_pane_prompt mine"),
            "{out:?}"
        );
        assert_eq!(reported(&out.stdout), vec![3], "{out:?}");
    }

    /// bash runs the hook from PROMPT_COMMAND with the command's status, and
    /// the first call stops the service's own children inheriting it.
    #[test]
    fn bash_reports_the_status_and_stops_exporting_the_hook() {
        if !has("bash") {
            return;
        }
        let out = Command::new("bash")
            .args([
                "--noprofile",
                "--norc",
                "-c",
                "(exit 4); _lpm_pane_prompt; env | grep -c -e _lpm_pane_prompt -e PROMPT_COMMAND",
            ])
            .env("PROMPT_COMMAND", BASH_FN_NAME)
            .env(format!("BASH_FUNC_{BASH_FN_NAME}%%"), BASH_FN)
            .output()
            .unwrap();
        assert_eq!(reported(&out.stdout), vec![4], "{out:?}");
        assert!(String::from_utf8_lossy(&out.stdout).trim_end().ends_with('0'), "{out:?}");
    }
}
