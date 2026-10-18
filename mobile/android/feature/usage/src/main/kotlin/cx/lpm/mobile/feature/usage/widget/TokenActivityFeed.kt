package cx.lpm.mobile.feature.usage.widget

import cx.lpm.mobile.core.data.client.LpmClient
import cx.lpm.mobile.core.data.client.requestStats
import cx.lpm.mobile.core.data.session.MacSession
import cx.lpm.mobile.core.data.session.SessionStore
import cx.lpm.mobile.core.data.usage.ALL_MACHINES
import cx.lpm.mobile.core.data.usage.LOCAL_MACHINE
import cx.lpm.mobile.core.data.usage.StatsStore
import cx.lpm.mobile.core.model.AgentStats
import cx.lpm.mobile.feature.usage.stats.estimateDailyCost
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet
import java.time.Clock
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/**
 * Keeps the Token activity widget's numbers fresh (iOS `TokenActivityFeed`). The
 * widget can't reach the Mac, so while a list with usage rows is on screen the app
 * asks for every computer's last 30 days — only with the widget on a home screen, and
 * at most every 15 minutes per Mac — and writes any such answer, the Stats screen's
 * included.
 */
class TokenActivityFeed(
    private val session: MacSession,
    private val repository: TokenActivityRepository,
    private val clock: Clock
) : SessionStore {
    private var listening: Job? = null
    private var askedAt: Long? = null
    private var askedMac: String? = null

    private val liveMac: String?
        get() {
            val state = session.state.value
            return state.activeMacId.takeIf { !session.isVisit && !state.demoMode && state.isReady }
        }

    override fun wire(client: LpmClient) {
        if (session.isVisit || listening != null) return
        listening = session.scope.launch { session.store<StatsStore>().received.collect(::receive) }
    }

    override fun reset() = Unit

    private fun receive(stats: AgentStats) {
        // The usage rows read this Mac's today every 30 seconds at most while they show.
        if (stats.days == 1 && (stats.machine ?: LOCAL_MACHINE) == LOCAL_MACHINE) refreshIfDue()
        // A Mac that predates picking a computer answers for itself alone.
        if (stats.days == 30 && (stats.machine ?: ALL_MACHINES) == ALL_MACHINES) save(stats)
    }

    private fun refreshIfDue() {
        val mac = liveMac ?: return
        val now = clock.millis()
        if (mac == askedMac && askedAt?.let { now - it < INTERVAL_MS } == true) return
        if (!repository.isPlaced()) return
        askedAt = now
        askedMac = mac
        session.client?.requestStats(days = 30, machine = ALL_MACHINES)
    }

    private fun save(stats: AgentStats) {
        if (liveMac == null) return
        val days = stats.daily.map {
            TokenActivityDay(it.date, it.claudeTokens, it.codexTokens, estimateDailyCost(it.models))
        }
        val read =
            TokenActivitySnapshot(stats.generatedAt.takeIf { it > 0 } ?: clock.millis(), days)
        session.scope.launch { repository.save(read) }
    }

    private companion object {
        const val INTERVAL_MS = 15 * 60 * 1000L
    }
}

@Module
@InstallIn(SingletonComponent::class)
object TokenActivityModule {
    @Provides
    @IntoSet
    fun tokenActivityFeedFactory(
        repository: TokenActivityRepository,
        clock: Clock
    ): SessionStore.Factory = SessionStore.Factory { TokenActivityFeed(it, repository, clock) }
}
