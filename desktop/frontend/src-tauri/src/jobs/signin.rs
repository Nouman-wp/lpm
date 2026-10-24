// A Claude run that failed for want of a login says which account it ran as
// and how to sign that one back in. lpm reads an account as signed in from its
// `.claude.json`, which outlives the token itself, so nothing else shows it.
use super::*;
use crate::claude_dirs::MAIN_LOGIN;

/// Claude Code's reply when the run's login has expired, was revoked, or is
/// missing. Its wording changes between versions; the stream tags it the same.
fn signed_out(raw: &str) -> bool {
    raw.lines()
        .filter(|l| l.contains("\"authentication_failed\""))
        .filter_map(|l| serde_json::from_str::<Value>(l.trim()).ok())
        .any(|v| {
            v.get("type").and_then(Value::as_str) == Some("assistant")
                && v.get("error").and_then(Value::as_str) == Some("authentication_failed")
        })
}

/// A failed Claude run's output, led by what to do when its login is gone.
pub(super) fn explain(
    output: Option<String>,
    log: &Path,
    account: Option<&str>,
    claude: &config::ClaudeEnv,
) -> Option<String> {
    let raw = std::fs::read_to_string(log).unwrap_or_default();
    if !signed_out(&raw) {
        return output;
    }
    Some(advice(
        &account_name(account.unwrap_or(MAIN_LOGIN)),
        &login_command(claude),
        output.as_deref().unwrap_or_default(),
    ))
}

fn advice(name: &str, command: &str, said: &str) -> String {
    format!(
        "Claude couldn't run as {name}: its sign-in has expired. Sign in again by running this in a terminal, then try again:\n{command}\n\n{said}"
    )
}

fn account_name(id: &str) -> String {
    let name = if id == MAIN_LOGIN {
        "the main login".to_string()
    } else {
        let labels = crate::remote_claude::labels();
        format!("the account \"{}\"", labels.get(id).map_or(id, String::as_str))
    };
    match crate::claude_pool_members::ident_of(id).email {
        email if email.is_empty() => name,
        email => format!("{name} ({email})"),
    }
}

/// `claude /login` against the config dir the run used.
fn login_command(claude: &config::ClaudeEnv) -> String {
    let dir = match claude {
        config::ClaudeEnv::Dir(dir) => Some(dir.clone()),
        config::ClaudeEnv::Scrub => None,
        config::ClaudeEnv::Inherit => std::env::var(config::CLAUDE_CONFIG_DIR_ENV)
            .ok()
            .filter(|d| !d.is_empty()),
    };
    match dir {
        Some(dir) => format!(
            "{}={} claude /login",
            config::CLAUDE_CONFIG_DIR_ENV,
            config::shell_quote(&dir)
        ),
        None => "claude /login".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const EXPIRED: &str = r#"{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Failed to authenticate: OAuth session expired and could not be refreshed"}]},"error":"authentication_failed","is_api_error_message":true}"#;

    #[test]
    fn recognises_claudes_sign_in_failures_only() {
        assert!(signed_out(&format!("{{\"type\":\"system\"}}\n{EXPIRED}\n")));
        assert!(!signed_out("Not logged in · Please run /login"));
        assert!(!signed_out(
            r#"{"type":"user","message":{"content":"grep for \"authentication_failed\""}}"#
        ));
        assert!(!signed_out("Error: ENOENT: no such file or directory"));
    }

    #[test]
    fn leads_with_the_login_for_the_runs_own_account() {
        let dir = config::ClaudeEnv::Dir("/u/.lpm/claude-accounts/work".into());
        assert_eq!(
            login_command(&dir),
            "CLAUDE_CONFIG_DIR='/u/.lpm/claude-accounts/work' claude /login"
        );
        assert_eq!(login_command(&config::ClaudeEnv::Scrub), "claude /login");

        let said = advice("the main login (a@b.c)", "claude /login", "Failed to authenticate");
        assert!(said.starts_with("Claude couldn't run as the main login (a@b.c)"));
        assert!(said.contains("\nclaude /login\n"));
        assert!(said.ends_with("Failed to authenticate"));
    }

    #[test]
    fn leaves_other_failures_as_they_were() {
        let other = Some("Error: ENOENT".to_string());
        let log = Path::new("/nonexistent/lpm-signin-test.log");
        assert_eq!(
            explain(other.clone(), log, None, &config::ClaudeEnv::Scrub),
            other
        );
        assert_eq!(explain(None, log, None, &config::ClaudeEnv::Scrub), None);
    }
}
