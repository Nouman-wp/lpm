package cx.lpm.mobile.feature.usage.widget

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
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

/**
 * How much of each agent's plan window is gone and when it comes back, as the projects
 * list's usage rows show it (iOS `UsageWidget`).
 */
class UsageWidget : GlanceAppWidget() {
    override val sizeMode: SizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val repository = repository(context)
        val saved = repository.mac()
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        provideContent {
            val mac by saved.collectAsState()
            val now by repository.now.collectAsState()
            UsageWidgetContent(mac, now, launch)
        }
    }
}

class UsageWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = UsageWidget()

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == UsageWidgetTicker.ACTION_TICK) repository(context).redraw()
    }

    // Placed, after a reboot, or after an app update: alarms don't outlive any of
    // these, so the minute-by-minute readings start again here.
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        repository(context).redraw()
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        UsageWidgetTicker.set(context, ticking = false)
    }
}

@EntryPoint
@InstallIn(SingletonComponent::class)
interface UsageWidgetEntryPoint {
    fun usageWidget(): UsageWidgetRepository
}

private fun repository(context: Context): UsageWidgetRepository =
    EntryPointAccessors.fromApplication<UsageWidgetEntryPoint>(context).usageWidget()
