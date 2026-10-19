package cx.lpm.mobile.feature.usage.widget

import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import cx.lpm.mobile.core.data.claude.ClaudeAccountsState
import cx.lpm.mobile.core.data.claude.ClaudeAccountsStore
import cx.lpm.mobile.core.data.di.ApplicationScope
import cx.lpm.mobile.core.data.session.MacSession
import cx.lpm.mobile.core.data.session.SessionState
import cx.lpm.mobile.core.data.usage.UsageState
import cx.lpm.mobile.core.data.usage.UsageStore
import cx.lpm.mobile.core.model.inUse
import cx.lpm.mobile.feature.usage.rows.usageAccountMark
import cx.lpm.mobile.feature.usage.rows.usageRows
import java.time.Clock
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.roundToLong
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filterNot
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

/**
 * Keeps the Usage widget in step with the live Mac (iOS `UsageWidgetPublisher`):
 * writes its rows once they've settled for a second, and drops them once the phone no
 * longer has their Mac. Leaving the app stamps them as seen then, the last the phone
 * hears of the Mac until it's back.
 */
@Singleton
class UsageWidgetPublisher @Inject constructor(
    private val session: MacSession,
    private val repository: UsageWidgetRepository,
    private val clock: Clock,
    @param:ApplicationScope private val scope: CoroutineScope
) {
    private var live: UsageWidgetMac? = null

    fun start() {
        scope.launch {
            combine(
                session.state,
                session.store<UsageStore>().state,
                session.store<ClaudeAccountsStore>().state
            ) { state, usage, accounts -> liveUsageMac(state, usage, accounts, clock.millis()) }
                .distinctUntilChanged()
                .collectLatest { mac ->
                    live = mac
                    mac ?: return@collectLatest
                    delay(SETTLE_MS)
                    repository.publish(mac)
                }
        }
        ProcessLifecycleOwner.get().lifecycle.addObserver(
            object : DefaultLifecycleObserver {
                override fun onStop(owner: LifecycleOwner) {
                    val mac = live ?: return
                    scope.launch { repository.confirm(mac) }
                }
            }
        )
        scope.launch {
            session.state
                .filterNot { it.demoMode }
                .map { state -> state.macs.map { it.widgetId }.toSet() }
                .distinctUntilChanged()
                .collect { repository.keep(it) }
        }
    }

    private companion object {
        const val SETTLE_MS = 1_000L
    }
}

/**
 * The live Mac's usage rows as the widget draws them: the projects list's, tagged for
 * the main accounts. Null until the Mac has sent its meters, and for the demo, which
 * isn't the person's own.
 */
internal fun liveUsageMac(
    state: SessionState,
    usage: UsageState,
    accounts: ClaudeAccountsState,
    now: Long
): UsageWidgetMac? {
    if (!state.isReady || state.demoMode || usage.snapshot == null) return null
    val record = state.activeRecord ?: return null
    val rows = usageRows(
        usage.snapshot,
        usage.today,
        accounts.accounts?.accounts.orEmpty(),
        now.toDouble(),
        usage.macMillis(now)
    )
    val inUse = accounts.accounts?.inUse(null, null)
    // As on the projects list, a lone account needs no tag to tell it apart.
    val tagged = rows.count { it.account != null } >= 2
    return UsageWidgetMac(
        id = record.widgetId,
        rows = rows.map { row ->
            UsageWidgetRow(
                id = row.id,
                provider = row.provider,
                label = row.label,
                mark = if (tagged) usageAccountMark(row, inUse) else null,
                weekly = row.data?.weekly?.let(UsageWidgetWindow::of),
                fiveHour = row.data?.fiveHour?.let(UsageWidgetWindow::of),
                tokens = row.tokens,
                // The Mac stamped it; the widget only has the phone's clock.
                updatedAt = row.data?.let { (it.updatedAt - usage.clockOffsetMs).roundToLong() }
            )
        }
    )
}
