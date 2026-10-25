package cx.lpm.mobile.feature.usage.recap

import cx.lpm.mobile.core.model.RecapWeek
import cx.lpm.mobile.core.navigation.StatsKey
import cx.lpm.mobile.core.navigation.WeeklyRecapKey
import cx.lpm.mobile.core.testing.MainDispatcherRule
import cx.lpm.mobile.core.testing.TestSession
import cx.lpm.mobile.feature.usage.UsageStores
import cx.lpm.mobile.feature.usage.connectLive
import cx.lpm.mobile.feature.usage.demoSession
import cx.lpm.mobile.feature.usage.settle
import cx.lpm.mobile.feature.usage.stats.StatsViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class WeeklyRecapViewModelTest {
    @get:Rule
    val main = MainDispatcherRule(StandardTestDispatcher())

    private fun TestScope.opened(t: TestSession): WeeklyRecapViewModel {
        val vm = WeeklyRecapViewModel(WeeklyRecapKey(), t.sessions, t.clock)
        backgroundScope.launch { vm.uiState.collect() }
        vm.open()
        return vm
    }

    private val WeeklyRecapUiState.card get() = body as RecapBody.Card

    @Test
    fun `the screen opens on the demo's last week`() = runTest(main.dispatcher) {
        val t = demoSession()
        val vm = opened(t)
        t.settle(0)
        assertEquals(RecapWeek.Last, vm.uiState.value.week)
        assertEquals(RecapBody.Loading, vm.uiState.value.body)

        t.settle()
        val card = vm.uiState.value.card
        assertEquals("31h 20m", card.view.hours)
        assertEquals("↑ 7h on last week", card.view.gain)
        assertEquals("Claude 64%, Codex 36%", mixText(card.view.mix))
        assertEquals(
            "My week in lpm: 31h 20m of agents working for me, 214 prompts.",
            card.caption
        )
        assertFalse(card.dimmed)
    }

    @Test
    fun `this week counts the days so far and has no gain yet`() = runTest(main.dispatcher) {
        val t = demoSession()
        val vm = opened(t)
        t.settle()

        vm.select(RecapWeek.This)
        t.settle(0)
        assertEquals(RecapBody.Loading, vm.uiState.value.body)
        t.settle()
        val view = vm.uiState.value.card.view
        assertEquals("24h 15m", view.hours)
        assertEquals(null, view.gain)
        assertEquals("Oct 12\u2009–\u200918", view.range)
    }

    @Test
    fun `a week without agent time is empty, a failure says why`() = runTest(main.dispatcher) {
        val t = TestSession(this, UsageStores)
        val mac = t.connectLive()
        val vm = opened(t)
        mac.socket.receive(
            """{"t":"weeklyRecap","ok":true,"week":"last","recap":{"week":"2026-10-05",""" +
                """"days":[{"date":"2026-10-05","agentMs":0,"prompts":0}]}}"""
        )
        mac.settle()
        assertEquals(RecapBody.Empty(RecapWeek.Last), vm.uiState.value.body)

        vm.select(RecapWeek.This)
        mac.socket.receive("""{"t":"weeklyRecap","ok":false,"week":"this","error":"No history"}""")
        mac.settle()
        assertEquals(RecapBody.Failed("No history"), vm.uiState.value.body)

        vm.retry()
        assertEquals("this", mac.socket.sentOf("weeklyRecap").last()["week"].toString().trim('"'))
        mac.settle()
        assertEquals(RecapBody.Loading, vm.uiState.value.body)
    }

    @Test
    fun `stats offers the recap only where the Mac draws it`() = runTest(main.dispatcher) {
        val demo = StatsViewModel(StatsKey(), demoSession().sessions, demoSession().clock)
        backgroundScope.launch { demo.uiState.collect() }
        val t = TestSession(this, UsageStores)
        t.connectLive()
        val live = StatsViewModel(StatsKey(), t.sessions, t.clock)
        backgroundScope.launch { live.uiState.collect() }
        t.settle(0)
        assertFalse(live.uiState.value.recapAvailable)
        assertTrue(demo.uiState.value.recapAvailable)
    }
}
