package cx.lpm.mobile.feature.widgets

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.updateAll
import cx.lpm.mobile.core.data.di.ApplicationScope
import cx.lpm.mobile.core.data.widget.AgentWidgetStore
import cx.lpm.mobile.core.data.widget.AgentWidgetSurface
import cx.lpm.mobile.core.model.agentWidgetTicks
import dagger.Binds
import dagger.Module
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Inject
import javax.inject.Provider
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** The time the Agents widget reads its rows at, moved on by each redraw. */
@Singleton
class AgentWidgetClock @Inject constructor() {
    private val mutableNow = MutableStateFlow(System.currentTimeMillis())
    val now: StateFlow<Long> = mutableNow.asStateFlow()

    fun tick() {
        mutableNow.value = System.currentTimeMillis()
    }
}

/**
 * Redraws the Agents widget and, while an agent's time is still counting, again a
 * minute later — the minute-by-minute readings iOS draws from its timeline.
 */
@Singleton
class GlanceAgentWidgetSurface @Inject constructor(
    @param:ApplicationContext private val context: Context,
    private val clock: AgentWidgetClock,
    private val store: Provider<AgentWidgetStore>,
    @param:ApplicationScope private val scope: CoroutineScope
) : AgentWidgetSurface {
    override fun refresh() {
        scope.launch {
            clock.tick()
            val placed = GlanceAppWidgetManager(context).getGlanceIds(AgentListWidget::class.java)
            if (placed.isEmpty()) {
                AgentWidgetTicker.set(context, counting = false)
                return@launch
            }
            AgentListWidget().updateAll(context)
            AgentWidgetTicker.set(context, agentWidgetTicks(store.get().macs.value))
        }
    }
}

/** A redraw a minute while a time is counting, only while the screen is on. */
internal object AgentWidgetTicker {
    const val ACTION_TICK = "cx.lpm.mobile.action.AGENT_WIDGET_TICK"
    private const val MINUTE_MS = 60_000L

    fun set(context: Context, counting: Boolean) {
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return
        val tick = PendingIntent.getBroadcast(
            context,
            0,
            Intent(context, AgentListReceiver::class.java).setAction(ACTION_TICK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        if (counting) {
            // Not a wakeup alarm: a widget nobody can see needn't be redrawn.
            alarms.setInexactRepeating(
                AlarmManager.ELAPSED_REALTIME,
                SystemClock.elapsedRealtime() + MINUTE_MS,
                MINUTE_MS,
                tick
            )
        } else {
            alarms.cancel(tick)
        }
    }
}

@EntryPoint
@InstallIn(SingletonComponent::class)
interface AgentWidgetEntryPoint {
    fun store(): AgentWidgetStore

    fun clock(): AgentWidgetClock

    fun surface(): AgentWidgetSurface
}

@Module
@InstallIn(SingletonComponent::class)
interface AgentWidgetModule {
    @Binds
    fun surface(impl: GlanceAgentWidgetSurface): AgentWidgetSurface
}
