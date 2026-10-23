// What lpm adds to its own terminals' shells: a `codex` that runs without Codex's
// shared background server, and a `tmux` that keeps track of which tab it runs in.
//
// Codex 0.160 hosts every session in one background server and runs the hooks
// from there, with the server's environment, not the terminal's. A hook then
// cannot say which tab it speaks for: no status at all when the server was
// started outside lpm, and every Codex tab's status on whichever tab started it
// otherwise. `--no-daemon` runs the session inside the terminal's own `codex`
// process, so its hooks carry that tab's identity. lpm types its own launches
// (`codex`, `codex resume <id>`, `codex fork <id>`) into the shell too, so one
// shell function covers those and anything the user types.
//
// tmux panes inherit the environment of the tab that started the tmux server,
// so an agent in a session made or attached from another tab reported under the
// first tab's identity. tmux copies the variables `update-environment` lists from
// each attaching client into its session, so `tmux` makes sure the running server
// lists lpm's — the same setup SSH tabs get (statusfwd.rs) — before it runs.
//
// The shell also says when it starts running a line and how the last one ended
// (cmdmarks.rs), so the tab can show what runs in it. zsh leaves a line typed
// with a leading space unnamed. bash only has the line through its history,
// where a repeat and such a line are both left out, so it names either one
// after the entry before it: right for the repeat, the previous line for the other.
//
// zsh gets them through ZDOTDIR: each of lpm's startup files hands over to the
// user's own, the way terminal emulators wire up shell integration. bash imports
// exported functions from the environment. Other shells keep the plain commands.
use portable_pty::CommandBuilder;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

/// Adds `--no-daemon` where Codex accepts it: an interactive launch (no
/// arguments, options, or a prompt with spaces) and `resume`/`fork`, after the
/// subcommand. Anything else passes through untouched — before a subcommand the
/// flag would turn it into a prompt, and a lone word may be a subcommand this
/// list doesn't know.
const CODEX_FN: &str = r#"codex() {
  case "$1" in
    resume|fork) local sub=$1; shift; command codex "$sub" --no-daemon "$@" ;;
    ""|-*|*" "*) command codex --no-daemon "$@" ;;
    *) command codex "$@" ;;
  esac
}"#;

/// `update-environment` only became a list in tmux 3.0; appending to it on an
/// older server would corrupt it. Without a running server there is nothing to
/// set, and the server the command starts takes this tab's environment anyway.
/// A server picked with `-L`/`-S` is the one set up.
const TMUX_FN: &str = r#"tmux() {
  local -a srv=()
  case "$1" in -L|-S) srv=("$1" "$2") ;; -L?*|-S?*) srv=("$1") ;; esac
  local ue
  ue=$(command tmux "${srv[@]}" show-options -gv update-environment 2>/dev/null)
  if [ -n "$ue" ] && [ "${ue#*LPM_PANE_ID}" = "$ue" ] &&
     command tmux -V 2>/dev/null | grep -qE 'tmux ([3-9]|[1-9][0-9])'; then
    command tmux "${srv[@]}" set-option -ga update-environment LPM_SOCKET_PATH \; \
      set-option -ga update-environment LPM_PROJECT_NAME \; \
      set-option -ga update-environment LPM_PANE_ID >/dev/null 2>&1
  fi
  command tmux "$@"
}"#;

/// zsh hands preexec the line as typed. The hooks go first, so the status is
/// the command's own and not that of a hook the user's .zshrc added.
const ZSH_COMMAND_HOOKS: &str = r#"_lpm_tab_exec() { local c=${1//[[:cntrl:]]/ }; [[ $c == ' '* ]] && c=; builtin printf '\033]7703;%s\007' "${c[1,200]}" }
_lpm_tab_done() { builtin printf '\033]7704;%d\007' $? }
preexec_functions=(_lpm_tab_exec $preexec_functions)
precmd_functions=(_lpm_tab_done $precmd_functions)"#;

/// bash 4.4+ expands PS0 after reading a line and before running it; the line
/// is the newest history entry by then. Older bash has no PS0 and reports only
/// how commands end, which on its own names nothing. The prompt hook installs
/// PS0 at the first prompt and stops the shell's children inheriting the hooks.
const BASH_EXEC_FN: &str = r#"() { local n c; read -r n c <<< "$(HISTTIMEFORMAT= builtin history 1)"; c=${c//[[:cntrl:]]/ }; builtin printf '\033]7703;%s\007' "${c:0:200}"; }"#;

const BASH_DONE_FN: &str = r#"() { local s=$?; builtin printf '\033]7704;%d\007' "$s"; [[ $PS0 == *_lpm_tab_exec* ]] || PS0='$(_lpm_tab_exec)'$PS0; export -n PROMPT_COMMAND; export -nf _lpm_tab_done _lpm_tab_exec; return $s; }"#;

const BASH_DONE_FN_NAME: &str = "_lpm_tab_done";

const BASH_COMMAND_HOOKS: [(&str, &str); 2] = [
    ("_lpm_tab_exec", BASH_EXEC_FN),
    (BASH_DONE_FN_NAME, BASH_DONE_FN),
];

pub(crate) const ZSHENV: &str = r#"# lpm terminal: zsh reads its startup files from here and each hands over to
# the user's own (desktop shellwrap.rs).
_lpm_zdotdir=$ZDOTDIR
ZDOTDIR=${LPM_USER_ZDOTDIR:-$HOME}
[[ -f $ZDOTDIR/.zshenv ]] && builtin source $ZDOTDIR/.zshenv
LPM_USER_ZDOTDIR=$ZDOTDIR
ZDOTDIR=$_lpm_zdotdir
unset _lpm_zdotdir
"#;

pub(crate) const ZPROFILE: &str = r#"_lpm_zdotdir=$ZDOTDIR
ZDOTDIR=$LPM_USER_ZDOTDIR
[[ -f $ZDOTDIR/.zprofile ]] && builtin source $ZDOTDIR/.zprofile
ZDOTDIR=$_lpm_zdotdir
unset _lpm_zdotdir
"#;

/// The last of lpm's files: from here on the user's ZDOTDIR is the shell's own,
/// so `.zlogin` and any zsh started inside read the user's files directly.
fn zshrc() -> String {
    format!(
        "ZDOTDIR=$LPM_USER_ZDOTDIR\nunset LPM_USER_ZDOTDIR\n[[ -f $ZDOTDIR/.zshrc ]] && builtin source $ZDOTDIR/.zshrc\n{CODEX_FN}\n{TMUX_FN}\n{ZSH_COMMAND_HOOKS}\n"
    )
}

/// Wire the wrapper into a local terminal's shell.
pub fn apply(builder: &mut CommandBuilder, shell: &str) {
    match shell_name(shell) {
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
            for (name, def) in [("codex", CODEX_FN), ("tmux", TMUX_FN)] {
                let body = def.strip_prefix(&format!("{name}() ")).unwrap_or(def);
                builder.env(format!("BASH_FUNC_{name}%%"), format!("() {body}"));
            }
            for (name, def) in BASH_COMMAND_HOOKS {
                builder.env(format!("BASH_FUNC_{name}%%"), def);
            }
            builder.env(
                "PROMPT_COMMAND",
                bash_prompt_command(BASH_DONE_FN_NAME, std::env::var("PROMPT_COMMAND").ok()),
            );
        }
        _ => {}
    }
}

/// `hook` first, then whatever PROMPT_COMMAND the shell would have inherited.
pub(crate) fn bash_prompt_command(hook: &str, inherited: Option<String>) -> String {
    match inherited {
        Some(own) if !own.trim().is_empty() => format!("{hook};{own}"),
        _ => hook.to_string(),
    }
}

pub(crate) fn shell_name(shell: &str) -> &str {
    let name = Path::new(shell)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(shell);
    name.strip_suffix(".exe").unwrap_or(name)
}

/// lpm's zsh startup files, written once per run. None if they can't be
/// written, in which case the shell starts exactly as it would without lpm.
fn zsh_dir() -> Option<&'static Path> {
    static DIR: OnceLock<Option<PathBuf>> = OnceLock::new();
    DIR.get_or_init(|| {
        let dir = crate::config::lpm_dir().join("shell").join("zsh");
        write_zsh_files(&dir).ok().map(|()| dir)
    })
    .as_deref()
}

fn write_zsh_files(dir: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dir)?;
    for (name, body) in [
        (".zshenv", ZSHENV.to_string()),
        (".zprofile", ZPROFILE.to_string()),
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

    /// What the wrapper turns `codex <args>` into, run by a real shell against a
    /// stub `codex` that prints its arguments.
    fn wrapped(shell: &str, args: &str) -> String {
        let td = tempfile::tempdir().unwrap();
        let bin = td.path().join("codex");
        std::fs::write(&bin, "#!/bin/sh\necho \"$*\"\n").unwrap();
        std::fs::set_permissions(&bin, std::os::unix::fs::PermissionsExt::from_mode(0o755))
            .unwrap();
        let script = format!("{CODEX_FN}\ncodex {args}");
        let out = Command::new(shell)
            .args(["-c", &script])
            .env("PATH", format!("{}:/usr/bin:/bin", td.path().display()))
            .output()
            .unwrap();
        String::from_utf8_lossy(&out.stdout).trim().to_string()
    }

    #[test]
    fn interactive_launches_run_without_the_server() {
        for shell in ["sh", "bash", "zsh"] {
            if Command::new(shell).arg("-c").arg("true").status().is_err() {
                continue;
            }
            assert_eq!(wrapped(shell, ""), "--no-daemon", "{shell}");
            assert_eq!(
                wrapped(shell, "-m gpt-5"),
                "--no-daemon -m gpt-5",
                "{shell}"
            );
            assert_eq!(
                wrapped(shell, "'fix the bug'"),
                "--no-daemon fix the bug",
                "{shell}"
            );
            assert_eq!(
                wrapped(shell, "resume abc"),
                "resume --no-daemon abc",
                "{shell}"
            );
            assert_eq!(
                wrapped(shell, "fork --last"),
                "fork --no-daemon --last",
                "{shell}"
            );
        }
    }

    // Before a subcommand the flag turns it into a prompt, so those pass untouched.
    #[test]
    fn subcommands_pass_through() {
        assert_eq!(wrapped("sh", "exec 'do it'"), "exec do it");
        assert_eq!(wrapped("sh", "login status"), "login status");
    }

    /// A tmux session made from another tab gets that tab's identity: the
    /// running server is told to copy lpm's variables from each attaching client.
    #[test]
    fn tmux_sessions_take_the_identity_of_the_tab_they_are_made_in() {
        if Command::new("tmux").arg("-V").output().is_err() {
            return;
        }
        let dir = tempfile::tempdir().unwrap();
        let sock = dir.path().join("t.sock");
        let sock = sock.to_string_lossy();
        let run = |shell: &str, pane: &str, cmd: &str| {
            Command::new(shell)
                .args(["-c", &format!("{TMUX_FN}\n{cmd}")])
                .env("LPM_PANE_ID", pane)
                .env_remove("TMUX")
                .output()
                .unwrap()
        };
        for shell in ["bash", "zsh"] {
            if Command::new(shell).arg("-c").arg("true").status().is_err() {
                continue;
            }
            run(shell, "tab-a", &format!("tmux -S {sock} new -d -s a"));
            run(shell, "tab-b", &format!("tmux -S {sock} new -d -s b"));
            let out = run(
                shell,
                "tab-b",
                &format!("tmux -S {sock} showenv -t b LPM_PANE_ID"),
            );
            assert_eq!(
                String::from_utf8_lossy(&out.stdout).trim(),
                "LPM_PANE_ID=tab-b",
                "{shell}"
            );
            let _ = Command::new("tmux")
                .args(["-S", &sock, "kill-server"])
                .output();
        }
    }

    /// A login zsh started the way lpm starts it reads the user's files, ends
    /// with the user's ZDOTDIR, and has the wrapper.
    #[test]
    fn zsh_hands_over_to_the_users_startup_files() {
        if Command::new("zsh").arg("-c").arg("true").status().is_err() {
            return;
        }
        let shim = tempfile::tempdir().unwrap();
        write_zsh_files(shim.path()).unwrap();
        let home = tempfile::tempdir().unwrap();
        for (name, line) in [
            (".zshenv", "export SEEN_ENV=1"),
            (".zprofile", "export SEEN_PROFILE=1"),
            (".zshrc", "export SEEN_RC=1"),
        ] {
            std::fs::write(home.path().join(name), format!("{line}\n")).unwrap();
        }
        let out = Command::new("zsh")
            .args([
                "-l",
                "-i",
                "-c",
                "echo $SEEN_ENV$SEEN_PROFILE$SEEN_RC $ZDOTDIR; whence -w codex",
            ])
            .env("HOME", home.path())
            .env("ZDOTDIR", shim.path())
            .env_remove("LPM_USER_ZDOTDIR")
            .output()
            .unwrap();
        let out = String::from_utf8_lossy(&out.stdout);
        assert!(
            out.contains(&format!("111 {}", home.path().display())),
            "{out}"
        );
        assert!(out.contains("codex: function"), "{out}");
    }

    fn marks(out: &[u8]) -> Vec<crate::cmdmarks::Mark> {
        crate::cmdmarks::Scanner::default().feed(&String::from_utf8_lossy(out))
    }

    /// An interactive zsh names each line before running it and reports its
    /// status ahead of the user's own prompt hooks; a line typed with a leading
    /// space goes unnamed.
    #[test]
    fn zsh_names_each_command_and_reports_how_it_ended() {
        use crate::cmdmarks::Mark::{End, Start};
        use std::io::Write;
        if Command::new("zsh").arg("-c").arg("true").status().is_err() {
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
        let mut child = Command::new("zsh")
            .arg("-i")
            .env("HOME", home.path())
            .env("ZDOTDIR", shim.path())
            .env_remove("LPM_USER_ZDOTDIR")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .spawn()
            .unwrap();
        child
            .stdin
            .take()
            .unwrap()
            .write_all(b"echo hi\n(exit 3)\n  hidden --token x\nprint -r -- \"a\tb\"\nexit\n")
            .unwrap();
        let out = child.wait_with_output().unwrap();
        assert_eq!(
            marks(&out.stdout),
            vec![
                End(0),
                Start("echo hi".into()),
                End(0),
                Start("(exit 3)".into()),
                End(3),
                Start(String::new()),
                End(127),
                Start("print -r -- \"a b\"".into()),
                End(0),
                Start("exit".into()),
            ],
            "{}",
            String::from_utf8_lossy(&out.stdout)
        );
    }

    /// bash reports how each command ended from PROMPT_COMMAND and, where it
    /// has PS0 (4.4+), names the line from history before running it. The
    /// first prompt stops the hooks reaching the shell's children.
    #[test]
    fn bash_names_each_command_and_stops_exporting_the_hooks() {
        use crate::cmdmarks::Mark::{End, Start};
        use std::io::Write;
        if Command::new("bash").arg("-c").arg("true").status().is_err() {
            return;
        }
        let has_ps0 = Command::new("bash")
            .args([
                "-c",
                "(( BASH_VERSINFO[0] > 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 4) ))",
            ])
            .status()
            .unwrap()
            .success();
        let mut child = Command::new("bash")
            .args(["--noprofile", "--norc", "-i"])
            .env(
                "PROMPT_COMMAND",
                bash_prompt_command(BASH_DONE_FN_NAME, None),
            )
            .envs(BASH_COMMAND_HOOKS.map(|(name, def)| (format!("BASH_FUNC_{name}%%"), def)))
            .env("HISTFILE", "/dev/null")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .spawn()
            .unwrap();
        child
            .stdin
            .take()
            .unwrap()
            .write_all(b"echo hi\n(exit 4)\nenv | grep -c -e _lpm_tab -e PROMPT_COMMAND\nexit\n")
            .unwrap();
        let out = child.wait_with_output().unwrap();
        let text = String::from_utf8_lossy(&out.stdout).to_string();
        let found = marks(&out.stdout);
        let expected = if has_ps0 {
            vec![
                End(0),
                Start("echo hi".into()),
                End(0),
                Start("(exit 4)".into()),
                End(4),
                Start("env | grep -c -e _lpm_tab -e PROMPT_COMMAND".into()),
                End(1),
                Start("exit".into()),
            ]
        } else {
            vec![End(0), End(0), End(4), End(1)]
        };
        assert_eq!(found, expected, "{text}");
        // grep counted no hook left in the environment after the first prompt.
        assert!(text.contains("\u{7}0\n"), "{text}");
    }

    #[test]
    fn an_inherited_prompt_command_still_runs_after_the_hook() {
        assert_eq!(bash_prompt_command("hook", None), "hook");
        assert_eq!(bash_prompt_command("hook", Some(" ".into())), "hook");
        assert_eq!(
            bash_prompt_command("hook", Some("history -a".into())),
            "hook;history -a"
        );
    }
}
