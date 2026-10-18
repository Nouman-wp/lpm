package cx.lpm.mobile.feature.usage.widget

import android.content.Context
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.provideContent
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

/**
 * Tokens and estimated cost over the last 7, 14 or 30 days, Claude and Codex stacked
 * per day, with pills that switch the range in place (iOS `TokenActivityWidget`).
 */
class TokenActivityWidget : GlanceAppWidget() {
    override val sizeMode: SizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val repository = repository(context)
        val snapshots = repository.snapshots()
        val ranges = repository.ranges()
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        provideContent {
            val snapshot by snapshots.collectAsState()
            val range by ranges.collectAsState(repository.range())
            TokenActivityContent(range, snapshot?.window(range), launch)
        }
    }
}

class TokenActivityWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TokenActivityWidget()
}

/** A range pill: the widget shows that many days, without opening the app. */
class PickTokenRangeAction : ActionCallback {
    override suspend fun onAction(
        context: Context,
        glanceId: GlanceId,
        parameters: ActionParameters
    ) {
        val days = parameters[DaysKey] ?: return
        repository(context).pickRange(days)
    }

    companion object {
        val DaysKey = ActionParameters.Key<Int>("days")
    }
}

@EntryPoint
@InstallIn(SingletonComponent::class)
interface TokenActivityEntryPoint {
    fun tokenActivity(): TokenActivityRepository
}

private fun repository(context: Context): TokenActivityRepository =
    EntryPointAccessors.fromApplication<TokenActivityEntryPoint>(context).tokenActivity()
