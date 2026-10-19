package cx.lpm.mobile.feature.usage.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import android.util.AtomicFile
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.updateAll
import cx.lpm.mobile.core.data.di.ApplicationScope
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.io.IOException
import java.time.Clock
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json

/**
 * The Usage widget's data (iOS `UsageWidgetStore`): a file the app writes while a Mac
 * is live, and the time the widget reads it at, moved on by each redraw. Each write
 * redraws the widget.
 */
@Singleton
class UsageWidgetRepository @Inject constructor(
    @param:ApplicationContext private val context: Context,
    private val clock: Clock,
    @param:ApplicationScope private val scope: CoroutineScope
) {
    private val file = AtomicFile(File(context.filesDir, FILE))
    private val mac = MutableStateFlow<UsageWidgetMac?>(null)
    private val mutableNow = MutableStateFlow(clock.millis())
    private val loading = Mutex()
    private var loaded = false

    val now: StateFlow<Long> = mutableNow.asStateFlow()

    /** The saved rows, from disk the first time. */
    suspend fun mac(): StateFlow<UsageWidgetMac?> {
        loading.withLock {
            if (!loaded) {
                mac.value = withContext(Dispatchers.IO) {
                    runCatching {
                        json.decodeFromString<UsageWidgetMac>(file.readFully().decodeToString())
                    }.getOrNull()
                }
                loaded = true
            }
        }
        return mac.asStateFlow()
    }

    /** Replace the rows with what the live Mac shows. */
    suspend fun publish(live: UsageWidgetMac) = save(live, confirming = false)

    /**
     * Publish, stamped as seen now even when nothing changed: the app is leaving a live
     * Mac, so the rows it last showed still read as current.
     */
    suspend fun confirm(live: UsageWidgetMac) = save(live, confirming = true)

    /** Forget the rows unless they're from one of these Macs. */
    suspend fun keep(macIds: Set<String>) {
        val saved = mac().value ?: return
        if (saved.id in macIds) return
        loading.withLock { mac.value = null }
        withContext(Dispatchers.IO) { file.delete() }
        redraw()
    }

    private suspend fun save(live: UsageWidgetMac, confirming: Boolean) {
        val saved = mac().value
        if (!confirming && saved?.id == live.id && saved.rows == live.rows) return
        val seen = live.copy(seenAt = clock.millis())
        loading.withLock { mac.value = seen }
        withContext(Dispatchers.IO) {
            val out = file.startWrite()
            try {
                out.write(json.encodeToString(seen).toByteArray())
                file.finishWrite(out)
            } catch (_: IOException) {
                file.failWrite(out)
            }
        }
        redraw()
    }

    /**
     * Redraws the widget and, while it has rows, again a minute later, so the
     * countdowns, the pace ticks and a reading going stale keep moving — the
     * minute-by-minute readings iOS draws from its timeline.
     */
    fun redraw() {
        scope.launch {
            mutableNow.value = clock.millis()
            val placed = GlanceAppWidgetManager(context).getGlanceIds(UsageWidget::class.java)
            if (placed.isEmpty()) {
                UsageWidgetTicker.set(context, ticking = false)
                return@launch
            }
            UsageWidget().updateAll(context)
            UsageWidgetTicker.set(context, ticking = mac().value?.rows?.isNotEmpty() == true)
        }
    }

    private companion object {
        const val FILE = "usage-widget.json"
        val json = Json { ignoreUnknownKeys = true }
    }
}

/** A redraw a minute, only while the screen is on. */
internal object UsageWidgetTicker {
    const val ACTION_TICK = "cx.lpm.mobile.action.USAGE_WIDGET_TICK"
    private const val MINUTE_MS = 60_000L

    fun set(context: Context, ticking: Boolean) {
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return
        val tick = PendingIntent.getBroadcast(
            context,
            0,
            Intent(context, UsageWidgetReceiver::class.java).setAction(ACTION_TICK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        if (ticking) {
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
