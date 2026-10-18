package cx.lpm.mobile.core.data.widget

import android.content.Context
import cx.lpm.mobile.core.data.push.PushClear
import cx.lpm.mobile.core.data.push.StatusIdentity
import cx.lpm.mobile.core.data.push.serverIdsMatch
import cx.lpm.mobile.core.model.AgentState
import cx.lpm.mobile.core.model.AgentWidgetMac
import cx.lpm.mobile.core.model.AgentWidgetRow
import cx.lpm.mobile.core.model.agentProviderLabel
import cx.lpm.mobile.core.model.numberLong
import cx.lpm.mobile.core.model.string
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.serialization.SerializationException
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

/** Redraws the Agents widget; the widget module provides it. */
fun interface AgentWidgetSurface {
    fun refresh()
}

/**
 * The Agents widget's data (iOS `AgentWidgetStore`): a file in the app's storage,
 * written while a Mac is live and when a push says an agent moved on, read by the
 * widget. Each change asks the widget to redraw.
 */
@Singleton
class AgentWidgetStore internal constructor(
    private val dir: File,
    private val surface: AgentWidgetSurface
) {
    @Inject
    constructor(
        @ApplicationContext context: Context,
        surface: AgentWidgetSurface
    ) : this(context.filesDir, surface)

    private val json = Json { ignoreUnknownKeys = true }
    private val serializer = ListSerializer(AgentWidgetMac.serializer())
    private val file get() = File(dir, FILE)
    private val mutableMacs by lazy { MutableStateFlow(read()) }

    /** Every Mac's agents as last written. */
    val macs: StateFlow<List<AgentWidgetMac>> get() = mutableMacs

    /** Replace one Mac's agents with what the live link shows. */
    fun publish(mac: AgentWidgetMac) = update { macs ->
        val index = macs.indexOfFirst { it.id == mac.id }
        when {
            index < 0 -> macs + mac
            macs[index] == mac -> null
            else -> macs.toMutableList().also { it[index] = mac }
        }
    }

    /** Forget Macs the phone no longer has. */
    fun remove(ids: Set<String>) = update { macs ->
        macs.filterNot { it.id in ids }.takeIf { it.size != macs.size }
    }

    /** An agent status push: its tab now waits on you, hit a problem, or finished. */
    fun apply(push: JsonObject) {
        val news = AgentPush.parse(push) ?: return
        update { macs -> macs.with(news) }
    }

    /** A withdrawal of statuses the Mac cleared: their rows go too. */
    fun apply(clear: PushClear) = update { macs ->
        val next = macs.map { mac ->
            if (!serverIdsMatch(mac.id, clear.serverId)) {
                mac
            } else {
                mac.copy(
                    rows = mac.rows.filterNot {
                        StatusIdentity(it.project, it.key) in clear.entries
                    }
                )
            }
        }
        next.takeIf { it != macs }
    }

    @Synchronized
    private fun update(change: (List<AgentWidgetMac>) -> List<AgentWidgetMac>?) {
        val next = change(mutableMacs.value) ?: return
        mutableMacs.value = next
        write(next)
        surface.refresh()
    }

    private fun read(): List<AgentWidgetMac> = try {
        json.decodeFromString(serializer, file.readText())
    } catch (e: IOException) {
        emptyList()
    } catch (e: SerializationException) {
        emptyList()
    }

    private fun write(macs: List<AgentWidgetMac>) {
        val temp = File(dir, "$FILE.tmp")
        try {
            temp.writeText(json.encodeToString(serializer, macs))
            if (!temp.renameTo(file)) temp.delete()
        } catch (e: IOException) {
            temp.delete()
        }
    }

    private companion object {
        const val FILE = "agent-widget.json"
    }
}

/** What an agent status push tells the widget. */
private data class AgentPush(
    val macId: String,
    val project: String,
    val key: String,
    val terminalId: String?,
    val tab: String,
    val state: AgentState,
    val stamp: Long?
) {
    companion object {
        fun parse(o: JsonObject): AgentPush? {
            if ((o.string("target") ?: "terminal") != "terminal") return null
            val state = AgentState.of(o.string("status") ?: return null)
            if (state == AgentState.Idle || state == AgentState.Working) return null
            return AgentPush(
                macId = o.string("serverId")?.takeIf { it.isNotEmpty() } ?: return null,
                project = o.string("project")?.takeIf { it.isNotEmpty() } ?: return null,
                key = o.string("key")?.takeIf { it.isNotEmpty() } ?: return null,
                terminalId = o.string("terminalId")?.takeIf { it.isNotEmpty() },
                tab = o.string("terminal").orEmpty(),
                state = state,
                stamp = o.numberLong("ts")
            )
        }
    }
}

private fun List<AgentWidgetMac>.with(news: AgentPush): List<AgentWidgetMac> {
    val mac = firstOrNull { it.id == news.macId } ?: AgentWidgetMac(news.macId, emptyList())
    val previous = mac.rows.firstOrNull { it.project == news.project && it.key == news.key }
    val base = previous ?: AgentWidgetRow(
        project = news.project,
        key = news.key,
        terminalId = news.terminalId,
        title = agentProviderLabel(news.key),
        state = news.state
    )
    // A finished turn reads as how long the work took, from when the agent picked
    // it up; a wait or a problem as how long it has been true.
    val done = news.state == AgentState.Done
    val row = base.copy(
        title = news.tab.ifEmpty { base.title },
        terminalId = news.terminalId ?: base.terminalId,
        state = news.state,
        since = if (done) {
            previous?.takeIf {
                it.state == AgentState.Working
            }?.since
        } else {
            news.stamp
        },
        until = if (done) news.stamp else null
    )
    val rows = if (previous ==
        null
    ) {
        mac.rows + row
    } else {
        mac.rows.map { if (it === previous) row else it }
    }
    return filterNot { it.id == news.macId } + mac.copy(rows = rows)
}
