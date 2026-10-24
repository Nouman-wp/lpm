package cx.lpm.mobile.core.data.push

import cx.lpm.mobile.core.model.AgentState
import cx.lpm.mobile.core.model.AgentWidgetRow
import cx.lpm.mobile.core.model.Project
import cx.lpm.mobile.core.model.agentWidgetRows
import cx.lpm.mobile.core.model.bool
import cx.lpm.mobile.core.model.int
import cx.lpm.mobile.core.model.list
import cx.lpm.mobile.core.model.long
import cx.lpm.mobile.core.model.string
import kotlinx.serialization.json.JsonObject

/**
 * The agents at work on one Mac, most urgent first (iOS `LiveSnapshot`): the
 * plaintext the Mac seals into each live update (PROTOCOL.md "Live Activity"), or
 * the phone's own reading of the live Mac, built the way the Mac builds it, so both
 * draw the same notification. `waiting` and `working` count every agent, `agents`
 * holds at most four; `live` false is the final update.
 */
data class LiveSnapshot(
    val serverId: String?,
    val live: Boolean,
    val waiting: Int,
    val working: Int,
    val agents: List<Agent>
) {
    data class Agent(
        val project: String,
        val projectLabel: String,
        val terminal: String,
        val terminalId: String,
        val key: String,
        val state: AgentState,
        /** Millis the state began. */
        val since: Long,
        /** Millis the turn began; 0 when unseen. */
        val turnStart: Long,
        /** Millis the turn ended; 0 while it runs. */
        val endedAt: Long
    )

    fun ended(): LiveSnapshot = copy(live = false)

    companion object {
        const val MAX_AGENTS = 4

        /** A finished agent stays this long, so the last one done reads as done. */
        const val RECENT_MS = 30 * 60 * 1000L

        fun parse(o: JsonObject): LiveSnapshot = LiveSnapshot(
            serverId = o.string("serverId")?.takeIf { it.isNotEmpty() },
            live = o.bool("live") ?: false,
            waiting = o.int("waiting") ?: 0,
            working = o.int("working") ?: 0,
            agents = o.list("agents") { a ->
                Agent(
                    project = a.string("project").orEmpty(),
                    projectLabel = a.string("projectLabel").orEmpty(),
                    terminal = a.string("terminal").orEmpty(),
                    terminalId = a.string("terminalId").orEmpty(),
                    key = a.string("key").orEmpty(),
                    state = AgentState.of(a.string("state").orEmpty()),
                    since = a.long("since") ?: 0,
                    turnStart = a.long("turnStart") ?: 0,
                    endedAt = a.long("endedAt") ?: 0
                )
            }
        )

        /**
         * The live Mac's agents as its own update would list them (iOS
         * `liveActivityReading`): one per tab, as the Agents widget reads them — who
         * waits on the user, who works, who finished in the last half hour; newest
         * first within each. `tabTitles` is project → terminal id → the tab's name.
         */
        fun of(
            serverId: String?,
            projects: List<Project>,
            tabTitles: Map<String, Map<String, String>>,
            now: Long
        ): LiveSnapshot {
            val labels = projects.associate { it.name to it.label }
            val shown = agentWidgetRows(projects, tabTitles, now)
                .filter { row ->
                    when (row.state) {
                        AgentState.NeedsYou, AgentState.Working -> true

                        AgentState.Done, AgentState.Error ->
                            now - (row.until ?: row.since ?: now) <= RECENT_MS

                        AgentState.Idle -> false
                    }
                }
                .sortedWith(
                    compareBy<AgentWidgetRow> { liveRank(it.state) }
                        .thenByDescending { it.since ?: 0 }
                )
            val waiting = shown.count { it.state == AgentState.NeedsYou }
            val working = shown.count { it.state == AgentState.Working }
            return LiveSnapshot(
                serverId = serverId,
                live = waiting + working > 0,
                waiting = waiting,
                working = working,
                agents = shown.take(MAX_AGENTS).map { row ->
                    Agent(
                        project = row.project,
                        projectLabel = labels[row.project].orEmpty(),
                        terminal = row.title,
                        terminalId = row.terminalId.orEmpty(),
                        key = row.key,
                        state = row.state,
                        since = row.since ?: 0,
                        turnStart = row.since ?: 0,
                        endedAt = row.until ?: 0
                    )
                }
            )
        }

        /** The Mac's order: waiting, then working, then the rest. */
        fun liveRank(state: AgentState): Int = when (state) {
            AgentState.NeedsYou -> 0
            AgentState.Working -> 1
            else -> 2
        }
    }
}
