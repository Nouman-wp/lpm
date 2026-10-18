package cx.lpm.mobile.feature.widgets

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.glance.GlanceId
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Every agent tab on the phone's Macs — tab title, what its agent is doing and for
 * how long — in the colors the app gives them (iOS `AgentListWidget`).
 */
class AgentListWidget : GlanceAppWidget() {
    override val sizeMode: SizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val entry = EntryPointAccessors.fromApplication(context, AgentWidgetEntryPoint::class.java)
        val store = entry.store()
        // The first read of the saved rows touches the disk.
        withContext(Dispatchers.IO) { store.macs }
        provideContent {
            val macs by store.macs.collectAsState()
            val now by entry.clock().now.collectAsState()
            AgentListContent(macs, now)
        }
    }
}

class AgentListReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = AgentListWidget()

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == AgentWidgetTicker.ACTION_TICK) refresh(context)
    }

    // Placed, after a reboot, or after an app update: alarms don't outlive any of
    // these, so the minute-by-minute readings start again here.
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        refresh(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        AgentWidgetTicker.set(context, counting = false)
    }

    private fun refresh(context: Context) = EntryPointAccessors.fromApplication(
        context,
        AgentWidgetEntryPoint::class.java
    ).surface().refresh()
}
