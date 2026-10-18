// This machine's Claude accounts in one answer, for a paired Mac's project menu
// and Settings: the accounts, their sign-in, which projects use each, and where
// switching between them stands. Changing them goes through the account
// commands themselves, as this machine's own Settings does.
use crate::claude_pool::claude_pool_state;
use crate::config;
use serde_json::{json, Value};

/// Advertised in `ready`: this host answers READ_CMD.
pub(crate) const HOST_CLAUDE_FEATURE: &str = "hostClaudeAccounts";
pub(crate) const READ_CMD: &str = "host_claude_accounts";

/// `{ accounts: [{ id, label }], statuses: [{ id, signedIn, email }], usage, pool }`,
/// in the shapes this machine's own Settings reads them.
pub(crate) fn read() -> Value {
    let accounts: Vec<Value> = config::load_claude_accounts()
        .get("accounts")
        .and_then(Value::as_array)
        .map(|list| {
            list.iter()
                .filter_map(|a| {
                    Some(
                        json!({ "id": a.get("id")?.as_str()?, "label": a.get("label")?.as_str()? }),
                    )
                })
                .collect()
        })
        .unwrap_or_default();
    json!({
        "accounts": accounts,
        "statuses": config::claude_accounts_status()["statuses"],
        "usage": config::claude_account_usage()["usage"],
        "pool": claude_pool_state(),
    })
}
