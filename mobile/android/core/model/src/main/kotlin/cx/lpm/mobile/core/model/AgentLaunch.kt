package cx.lpm.mobile.core.model

import kotlinx.serialization.json.JsonObject

/**
 * An agent the Mac can start in a new tab (one row of the `agentOptions` reply). An
 * agent without models has no model or effort control.
 */
data class AgentOption(val id: String, val label: String, val models: List<AgentModelOption>) {
    companion object {
        fun parse(o: JsonObject): AgentOption {
            val id = o.string("id").orEmpty()
            return AgentOption(
                id = id,
                label = o.string("label") ?: id,
                models = o.list("models", AgentModelOption::parse)
            )
        }
    }
}

/**
 * A model an agent offers, with the effort levels that model takes. `value` is empty
 * for the agent's own default.
 */
data class AgentModelOption(
    val value: String,
    val label: String,
    val efforts: List<AgentEffortOption>
) {
    companion object {
        fun parse(o: JsonObject): AgentModelOption {
            val value = o.string("value").orEmpty()
            return AgentModelOption(
                value = value,
                label = o.string("label") ?: value,
                efforts = o.list("efforts", AgentEffortOption::parse)
            )
        }
    }
}

data class AgentEffortOption(val value: String, val label: String) {
    companion object {
        fun parse(o: JsonObject): AgentEffortOption {
            val value = o.string("value").orEmpty()
            return AgentEffortOption(value = value, label = o.string("label") ?: value)
        }
    }
}

/** What a new tab starts with. An empty `agent` is a plain shell. */
data class AgentLaunch(
    val agent: String = "",
    val model: String = "",
    val effort: String = "",
    val prompt: String = ""
)

/** The New Tab sheet's last pick, remembered app-wide. The prompt isn't kept. */
data class NewTabPick(val agent: String = "", val model: String = "", val effort: String = "") {
    /**
     * This pick as the Mac offers things now: an agent it no longer offers is a shell,
     * and a model or effort it no longer offers is that agent's default.
     */
    fun resolved(agents: List<AgentOption>): NewTabPick {
        val agent = agents.firstOrNull { it.id == this.agent } ?: return NewTabPick()
        return NewTabPick(agent.id).choosing(model, effort, agent)
    }

    /** The pick with `model` chosen, keeping `effort` when that model offers it. */
    fun choosing(model: String, effort: String, agent: AgentOption): NewTabPick {
        val chosen = agent.models.firstOrNull { it.value == model }
            ?: agent.models.firstOrNull()
            ?: return NewTabPick(agent.id)
        val kept = chosen.efforts.firstOrNull { it.value == effort } ?: chosen.efforts.firstOrNull()
        return NewTabPick(agent.id, chosen.value, kept?.value.orEmpty())
    }
}

/**
 * A past Claude Code or Codex conversation this project can be resumed into (one row
 * of the `agentSessions` reply). `openIn` is the live tab already holding it.
 */
data class AgentSession(
    val key: String,
    val provider: String,
    val sessionId: String,
    val title: String,
    val preview: String,
    /** Epoch ms; 0 when unknown. */
    val updatedAt: Long,
    val gitBranch: String?,
    val account: String?,
    val openIn: String?
) {
    val id: String get() = key

    companion object {
        fun parse(o: JsonObject): AgentSession {
            val provider = o.string("provider").orEmpty()
            val sessionId = o.string("sessionId").orEmpty()
            return AgentSession(
                key = o.string("key") ?: "$provider:$sessionId",
                provider = provider,
                sessionId = sessionId,
                title = o.string("title").orEmpty(),
                preview = o.string("preview").orEmpty(),
                updatedAt = o.numberLong("updatedAt") ?: 0,
                gitBranch = o.string("gitBranch")?.ifEmpty { null },
                account = o.string("account")?.ifEmpty { null },
                openIn = o.string("openIn")?.ifEmpty { null }
            )
        }
    }
}

/**
 * One `agentSessions` reply. `sessions` is null on a failure. `search` is the query
 * the Mac answered, when it says.
 */
data class AgentSessionsPage(
    val project: String,
    val sessions: List<AgentSession>?,
    val hasMore: Boolean,
    val error: String?,
    val search: String?
) {
    companion object {
        fun parse(o: JsonObject): AgentSessionsPage {
            val ok = o.bool("ok") ?: false
            return AgentSessionsPage(
                project = o.string("project").orEmpty(),
                sessions = if (ok) o.list("sessions", AgentSession::parse) else null,
                hasMore = o.bool("hasMore") ?: false,
                error = if (ok) null else o.string("error") ?: "Couldn't load past sessions.",
                search = o.string("search")
            )
        }
    }
}
