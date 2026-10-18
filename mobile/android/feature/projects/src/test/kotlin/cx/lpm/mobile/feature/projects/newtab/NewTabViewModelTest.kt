package cx.lpm.mobile.feature.projects.newtab

import cx.lpm.mobile.core.data.agents.AgentLaunchStore
import cx.lpm.mobile.core.data.client.LpmClient
import cx.lpm.mobile.core.data.prefs.PreferenceKeys
import cx.lpm.mobile.core.data.session.SessionStore
import cx.lpm.mobile.core.model.NewTabPick
import cx.lpm.mobile.core.model.SessionKey
import cx.lpm.mobile.core.model.TerminalInfo
import cx.lpm.mobile.core.testing.FakeSocket
import cx.lpm.mobile.core.testing.MainDispatcherRule
import cx.lpm.mobile.core.testing.TestSession
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class NewTabViewModelTest {
    @get:Rule
    val main = MainDispatcherRule()

    private val options =
        """{"t":"agentOptions","agents":[""" +
            """{"id":"claude","label":"Claude Code","models":[""" +
            """{"value":"","label":"Default","efforts":[{"value":"","label":"Default"},""" +
            """{"value":"high","label":"High"}]},""" +
            """{"value":"opus","label":"Opus","efforts":[{"value":"","label":"Default"},""" +
            """{"value":"high","label":"High"}]}]},""" +
            """{"id":"gemini","label":"Gemini","models":[]}]}"""

    private fun TestScope.connected(
        features: List<String> = listOf(
            LpmClient.AGENT_LAUNCH_FEATURE,
            LpmClient.AGENT_SESSIONS_FEATURE
        )
    ): Pair<TestSession, FakeSocket> {
        val t = TestSession(this, setOf(SessionStore.Factory(::AgentLaunchStore)))
        val socket = t.connectReady(features = features)
        socket.receive("""{"t":"projects","projects":[{"name":"storefront","running":true}]}""")
        testScheduler.runCurrent()
        return t to socket
    }

    private fun TestScope.subscribed(t: TestSession): NewTabViewModel {
        val vm =
            NewTabViewModel("storefront", SessionKey.Live, t.sessions, NewTabPickMemory(t.prefs))
        backgroundScope.launch { vm.uiState.collect() }
        vm.onAppear()
        testScheduler.runCurrent()
        return vm
    }

    @Test
    fun `the first time it's a shell, and the agents come from the Mac`() = runTest {
        val (t, socket) = connected()
        val vm = subscribed(t)
        assertEquals(1, socket.sentOf("agentOptions").size)
        assertNull(vm.uiState.value.options)
        assertEquals(NewTabPick(), vm.uiState.value.pick)
        assertFalse(vm.uiState.value.awaitingOptions)
        assertTrue(vm.uiState.value.canResume)

        socket.receive(options)
        testScheduler.runCurrent()
        assertEquals(listOf("claude", "gemini"), vm.uiState.value.options?.map { it.id })
    }

    @Test
    fun `picking an agent and its model opens a tab with them, remembered without the prompt`() =
        runTest {
            val (t, socket) = connected()
            val vm = subscribed(t)
            socket.receive(options)
            testScheduler.runCurrent()
            val claude = vm.uiState.value.options!!.first()

            vm.pickAgent(claude)
            vm.chooseModel("opus")
            vm.chooseEffort("high")
            vm.setPrompt("  Fix the failing test \n")
            val spawned = mutableListOf<TerminalInfo>()
            vm.open { spawned += it }
            testScheduler.runCurrent()

            val sent = socket.sentOf("newTerminal").single()
            assertEquals(JsonPrimitive("claude"), sent["agent"])
            assertEquals(JsonPrimitive("opus"), sent["model"])
            assertEquals(JsonPrimitive("high"), sent["effort"])
            assertEquals(JsonPrimitive("Fix the failing test"), sent["prompt"])
            assertEquals(
                """{"agent":"claude","model":"opus","effort":"high"}""",
                t.prefs.string(PreferenceKeys.NEW_TAB_LAST_PICK)
            )
            socket.receive(
                """{"t":"terminals","project":"storefront","terminals":[{"id":"t9",""" +
                    """"project":"storefront"}]}"""
            )
            testScheduler.runCurrent()
            assertEquals(listOf("t9"), spawned.map { it.id })
        }

    @Test
    fun `a remembered pick waits for the Mac, then falls back to what it still offers`() = runTest {
        val (t, socket) = connected()
        NewTabPickMemory(t.prefs).save(NewTabPick("claude", "sonnet", "max"))
        val vm = subscribed(t)
        assertTrue(vm.uiState.value.awaitingOptions)

        socket.receive(options)
        testScheduler.runCurrent()
        assertEquals(NewTabPick("claude", "", ""), vm.uiState.value.pick)
        assertFalse(vm.uiState.value.awaitingOptions)
    }

    @Test
    fun `changing the model keeps the effort only when it's offered`() = runTest {
        val (t, socket) = connected()
        val vm = subscribed(t)
        socket.receive(options)
        testScheduler.runCurrent()
        vm.pickAgent(vm.uiState.value.options!!.first())
        vm.chooseEffort("high")
        vm.chooseModel("opus")
        testScheduler.runCurrent()
        assertEquals(NewTabPick("claude", "opus", "high"), vm.uiState.value.pick)

        vm.pickShell()
        vm.setPrompt("ignored")
        vm.open {}
        testScheduler.runCurrent()
        val sent = socket.sentOf("newTerminal").single()
        assertNull(sent["agent"])
        assertNull(sent["prompt"])
    }

    @Test
    fun `an SSH project or an older Mac offers no past sessions`() = runTest {
        val (t, _) = connected(features = listOf(LpmClient.AGENT_LAUNCH_FEATURE))
        assertFalse(subscribed(t).uiState.value.canResume)
    }
}
