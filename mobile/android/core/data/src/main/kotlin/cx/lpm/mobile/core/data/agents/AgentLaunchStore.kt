package cx.lpm.mobile.core.data.agents

import cx.lpm.mobile.core.data.client.LpmClient
import cx.lpm.mobile.core.data.client.newTerminal
import cx.lpm.mobile.core.data.client.requestAgentOptions
import cx.lpm.mobile.core.data.client.requestAgentSessions
import cx.lpm.mobile.core.data.client.resumeSession
import cx.lpm.mobile.core.data.session.GenerationTimeout
import cx.lpm.mobile.core.data.session.MacSession
import cx.lpm.mobile.core.data.session.SessionStore
import cx.lpm.mobile.core.data.terminals.TerminalsStore
import cx.lpm.mobile.core.model.AgentLaunch
import cx.lpm.mobile.core.model.AgentOption
import cx.lpm.mobile.core.model.AgentSession
import cx.lpm.mobile.core.model.AgentSessionsPage
import cx.lpm.mobile.core.model.Project
import cx.lpm.mobile.core.model.TerminalInfo
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/**
 * One project's Resume Session list: the rows the Mac last sent for `search`, and how
 * many were asked for.
 */
data class AgentSessionList(
    val search: String = "",
    val limit: Int = AgentLaunchStore.PAGE_SIZE,
    val rows: List<AgentSession> = emptyList(),
    val hasMore: Boolean = false,
    /** An answer has arrived, so an empty `rows` means none. */
    val loaded: Boolean = false,
    val loading: Boolean = false,
    val error: String? = null
)

data class AgentLaunchState(
    /** What the Mac can start, in its order; null until it first answers. */
    val options: List<AgentOption>? = null,
    /** project → its Resume Session list. */
    val sessions: Map<String, AgentSessionList> = emptyMap()
)

/**
 * The agents a new tab can start and the past conversations a project can be resumed
 * into (iOS `AgentLaunchStore` + `AppModel+AgentLaunch`). Either opens through the
 * same placeholder row and spawn callback a terminal action uses.
 */
class AgentLaunchStore(private val session: MacSession) : SessionStore {
    private val mutable = MutableStateFlow(AgentLaunchState())
    val state: StateFlow<AgentLaunchState> = mutable.asStateFlow()

    private val timeout = GenerationTimeout<String>(session.scope)
    private val client: LpmClient? get() = session.client

    override fun wire(client: LpmClient) {
        client.onAgentOptions = { agents -> mutable.update { it.copy(options = agents) } }
        client.onAgentSessions = ::applySessions
    }

    override fun reset() {
        mutable.value = AgentLaunchState()
        timeout.cancelAll()
    }

    /** A list waiting on a reply the dropped link took with it asks again. */
    override fun onConnectionReset() {
        state.value.sessions.forEach { (project, list) -> if (list.loading) request(project, list) }
    }

    /** The Mac starts agents in new tabs (`agentOptions`, `newTerminal` with an agent). */
    val canLaunchAgents: Boolean
        get() = client?.hostFeatures?.contains(LpmClient.AGENT_LAUNCH_FEATURE) == true

    /**
     * The Mac lists past conversations to resume. An SSH project's agents ran on the
     * other host, so it has none here.
     */
    fun canResumeSessions(project: Project): Boolean =
        client?.hostFeatures?.contains(LpmClient.AGENT_SESSIONS_FEATURE) == true &&
            !project.isRemote

    /**
     * The Mac takes a first prompt for the agent an action opens, so a new tab can start
     * the project's own agent actions.
     */
    val canPromptActions: Boolean
        get() = client?.hostFeatures?.contains(LpmClient.ACTION_PROMPT_FEATURE) == true

    fun loadOptions() {
        client?.requestAgentOptions()
    }

    /**
     * Ask for the newest sessions matching `search`, keeping the rows on screen until
     * the answer replaces them.
     */
    fun loadSessions(project: String, search: String) {
        var list = state.value.sessions[project] ?: AgentSessionList()
        if (list.search != search) list = list.copy(limit = PAGE_SIZE)
        request(project, list.copy(search = search))
    }

    fun loadOlderSessions(project: String) {
        val list = state.value.sessions[project] ?: return
        if (!list.hasMore || list.loading) return
        request(project, list.copy(limit = list.limit + PAGE_SIZE))
    }

    fun newTerminal(project: String, launch: AgentLaunch, onSpawn: (TerminalInfo) -> Unit) {
        session.store<TerminalsStore>().spawnTerminal(project, "New tab", onSpawn) {
            it.newTerminal(project, launch)
        }
    }

    /** The live tab already holding [agentSession], which opens instead of a second copy. */
    fun openTab(agentSession: AgentSession, project: String): TerminalInfo? {
        val id = agentSession.openIn ?: return null
        val terminals = session.store<TerminalsStore>().state.value.terminals[project]
        return terminals?.firstOrNull { it.id == id }
    }

    /** Continue [agentSession] in a new tab. */
    fun resumeSession(
        agentSession: AgentSession,
        project: String,
        onSpawn: (TerminalInfo) -> Unit
    ) {
        val verb = "Resume “${agentSession.title}”"
        session.store<TerminalsStore>().spawnTerminal(project, verb, onSpawn) {
            it.resumeSession(project, agentSession)
        }
    }

    private fun applySessions(page: AgentSessionsPage) {
        val list = state.value.sessions[page.project] ?: return
        if (!list.loading) return
        if (page.search != null && page.search != list.search) return
        timeout.cancel(page.project)
        val rows = page.sessions
        val settled = if (rows != null) {
            list.copy(rows = rows, hasMore = page.hasMore, error = null)
        } else {
            list.copy(error = page.error)
        }
        put(page.project, settled.copy(loading = false, loaded = true))
    }

    private fun request(project: String, list: AgentSessionList) {
        put(project, list.copy(loading = true, error = null))
        client?.requestAgentSessions(project, list.search, list.limit)
        timeout.arm(project, TIMEOUT_MS) {
            val current = state.value.sessions[project] ?: return@arm
            if (!current.loading) return@arm
            put(project, current.copy(loading = false, error = TIMED_OUT))
        }
    }

    private fun put(project: String, list: AgentSessionList) {
        mutable.update { it.copy(sessions = it.sessions + (project to list)) }
    }

    companion object {
        const val PAGE_SIZE = 40
        private const val TIMEOUT_MS = 20_000L
        private const val TIMED_OUT = "The Mac didn't answer in time."
    }
}
