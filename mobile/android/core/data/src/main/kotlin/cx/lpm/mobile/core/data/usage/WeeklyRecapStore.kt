package cx.lpm.mobile.core.data.usage

import cx.lpm.mobile.core.data.client.LpmClient
import cx.lpm.mobile.core.data.client.requestWeeklyRecap
import cx.lpm.mobile.core.data.session.GenerationTimeout
import cx.lpm.mobile.core.data.session.MacSession
import cx.lpm.mobile.core.data.session.SessionStore
import cx.lpm.mobile.core.model.RecapWeek
import cx.lpm.mobile.core.model.WeeklyRecap
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class WeeklyRecapState(
    /** The week on screen. */
    val week: RecapWeek = RecapWeek.Last,
    /** Each week's last answer, kept while the other one shows. */
    val recaps: Map<RecapWeek, WeeklyRecap> = emptyMap(),
    val loading: Set<RecapWeek> = emptySet(),
    /** Why a week without an answer couldn't be read. */
    val errors: Map<RecapWeek, String> = emptyMap()
)

/**
 * The desktop's weekly recap ("My week in lpm"), last week or this week so far. The
 * Mac reads it off its socket, so replies arrive seconds later and name their week.
 */
class WeeklyRecapStore(private val session: MacSession) : SessionStore {
    private val mutable = MutableStateFlow(WeeklyRecapState())
    val state: StateFlow<WeeklyRecapState> = mutable.asStateFlow()

    // Asks again after a reconnect while the screen is open.
    private var active = false

    private val timeout = GenerationTimeout<RecapWeek>(session.scope)

    /** The Mac answers `weeklyRecap`. */
    val available: Boolean
        get() = session.client?.hostFeatures?.contains(LpmClient.WEEKLY_RECAP_FEATURE) == true

    override fun wire(client: LpmClient) {
        client.onWeeklyRecap = ::receive
    }

    override fun reset() {
        timeout.cancelAll()
        active = false
        mutable.value = WeeklyRecapState()
    }

    /** The socket was replaced: nothing in flight can answer, so an open screen asks again. */
    override fun onConnectionReset() {
        timeout.cancelAll()
        val waiting = state.value.loading
        mutable.update { it.copy(loading = emptySet()) }
        if (active) waiting.forEach { load(it) }
    }

    /** The screen opens on last week, the one that's over. */
    fun screenDidOpen() {
        active = true
        select(RecapWeek.Last)
    }

    fun select(week: RecapWeek) {
        mutable.update { it.copy(week = week) }
        load(week)
    }

    /**
     * Ask for [week]; [fresh] reads it again instead of the Mac's read from the last ten
     * minutes. A week already on screen stays there while it reloads.
     */
    fun load(week: RecapWeek = state.value.week, fresh: Boolean = false) {
        mutable.update { it.copy(loading = it.loading + week, errors = it.errors - week) }
        session.client?.requestWeeklyRecap(week.wire, fresh)
        timeout.arm(week, TIMEOUT_MS) {
            if (week !in state.value.loading) return@arm
            mutable.update {
                it.copy(
                    loading = it.loading - week,
                    errors = if (week in
                        it.recaps
                    ) {
                        it.errors
                    } else {
                        it.errors + (week to TIMEOUT_ERROR)
                    }
                )
            }
        }
    }

    /** Pull to refresh: read the week again when live, else reconnect. */
    suspend fun refresh() {
        if (session.state.value.isReady) {
            load(state.value.week, fresh = true)
        } else {
            session.reconnectIfNeeded()
        }
        delay(REFRESH_SETTLE_MS)
    }

    fun screenDidClose() {
        active = false
    }

    private fun receive(week: String, recap: WeeklyRecap?, error: String?) {
        val which = RecapWeek.of(week) ?: RecapWeek.Last
        timeout.cancel(which)
        mutable.update {
            if (recap != null) {
                it.copy(
                    recaps = it.recaps + (which to recap),
                    loading = it.loading - which,
                    errors = it.errors - which
                )
            } else {
                it.copy(
                    loading = it.loading - which,
                    errors = it.errors + (which to (error ?: "Couldn't read the week."))
                )
            }
        }
    }

    private companion object {
        const val TIMEOUT_MS = 30_000L
        const val REFRESH_SETTLE_MS = 500L
        const val TIMEOUT_ERROR = "The Mac didn't answer."
    }
}
