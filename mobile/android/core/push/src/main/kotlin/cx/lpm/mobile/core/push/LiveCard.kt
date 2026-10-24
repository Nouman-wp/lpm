package cx.lpm.mobile.core.push

import cx.lpm.mobile.core.data.push.LiveSnapshot
import cx.lpm.mobile.core.model.AgentState
import cx.lpm.mobile.core.model.agentProviderLabel
import cx.lpm.mobile.core.model.shortDuration

/**
 * What the ongoing "agents at work" notification says for one Mac, read off a
 * [LiveSnapshot] whichever way it came — the live link or the Mac's push. It lists
 * the agents as the Agents widget does (iOS `AgentLiveLockScreen`): the Mac's name,
 * then the most urgent tabs with their times — no counts, the entries say it. How it
 * looks is [LiveNotification]'s.
 */
data class LiveCard(
    /** The Mac's server id (its local id for a Mac too old to send one). */
    val macId: String,
    /** The Mac's name as the phone shows it; null for a Mac it no longer has. */
    val macName: String?,
    /** Nothing is at work any more: the final card, left up a while. */
    val ended: Boolean,
    val tone: Tone,
    /** Most urgent first, at most [SHOWN]. */
    val entries: List<Entry>,
    /** Millis the header's chronometer counts from: the lead's start while it works or waits. */
    val countingFrom: Long?,
    /** Millis the final card is stamped with: when the lead stopped. */
    val at: Long?,
    /** The tab a tap opens: the lead's. */
    val open: Open?
) {
    /** What the accent color says: someone needs you, work goes on, or it's over. */
    enum class Tone { NeedsYou, Working, Done }

    data class Entry(
        /** The project, only where it differs from the entry above. */
        val project: String?,
        val tab: String,
        val problem: Boolean,
        /** "40s", "45m", "1h 14m"; null when its start was never seen. */
        val time: String?
    )

    data class Open(val project: String, val terminalId: String?)

    val lead: Entry? get() = entries.firstOrNull()

    companion object {
        /** As many as fit, as on the Lock Screen. */
        const val SHOWN = 3

        fun of(macId: String, macName: String?, snapshot: LiveSnapshot, now: Long): LiveCard {
            val agents = snapshot.agents.sortedBy { LiveSnapshot.liveRank(it.state) }.take(SHOWN)
            val lead = agents.firstOrNull()
            val ended = !snapshot.live
            val entries = agents.mapIndexed { index, agent ->
                val project = agent.projectLabel.ifEmpty { agent.project }
                val above = agents.getOrNull(index - 1)
                Entry(
                    project = project.takeUnless { above?.project == agent.project },
                    tab = agent.terminal.ifEmpty { agentProviderLabel(agent.key) },
                    problem = agent.state == AgentState.Error,
                    time = elapsed(agent, now)
                )
            }
            val counting = lead?.state == AgentState.NeedsYou || lead?.state == AgentState.Working
            return LiveCard(
                macId = macId,
                macName = macName,
                ended = ended,
                tone = when {
                    ended -> Tone.Done
                    lead?.state == AgentState.NeedsYou -> Tone.NeedsYou
                    else -> Tone.Working
                },
                entries = entries,
                countingFrom = lead?.takeIf { !ended && counting }?.let(::startedAt),
                at = lead?.takeIf { ended }?.let { it.endedAt.positive() ?: startedAt(it) },
                open = lead?.let { Open(it.project, it.terminalId.ifEmpty { null }) }
            )
        }

        /** When the work it shows began: the turn, else the state. */
        private fun startedAt(agent: LiveSnapshot.Agent): Long? =
            agent.turnStart.positive() ?: agent.since.positive()

        /**
         * How long it has been at it while it works or waits, and how long it took
         * once it stopped (iOS `AgentLiveElapsed`), in the widget's short form.
         */
        private fun elapsed(agent: LiveSnapshot.Agent, now: Long): String? {
            val start = startedAt(agent) ?: return null
            val end = when (agent.state) {
                AgentState.NeedsYou, AgentState.Working -> now
                else -> agent.endedAt.positive() ?: now
            }
            return shortDuration(end - start)
        }

        private fun Long.positive(): Long? = takeIf { it > 0 }
    }
}
