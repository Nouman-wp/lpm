package cx.lpm.mobile.core.push

import android.Manifest
import android.app.Application
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import android.graphics.Typeface
import android.service.notification.StatusBarNotification
import android.text.Spanned
import android.text.style.StyleSpan
import androidx.test.core.app.ApplicationProvider
import cx.lpm.mobile.core.data.mac.MacRecord
import cx.lpm.mobile.core.data.mac.MacStore
import cx.lpm.mobile.core.data.prefs.AppPreferences
import cx.lpm.mobile.core.data.prefs.NotificationPrefs
import cx.lpm.mobile.core.data.prefs.setNotificationPrefs
import cx.lpm.mobile.core.data.push.LiveSnapshot
import cx.lpm.mobile.core.model.AgentState
import cx.lpm.mobile.core.testing.InMemoryDataStore
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf

@RunWith(RobolectricTestRunner::class)
class LiveNotifierTest {
    private val app: Application = ApplicationProvider.getApplicationContext()
    private val manager = app.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    @Before
    fun allowNotifications() {
        shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
    }

    private suspend fun TestScope.notifier(): Pair<LiveNotifier, AppPreferences> {
        val prefs = AppPreferences(InMemoryDataStore(), backgroundScope).also { it.load() }
        val macs = MacStore(prefs)
        macs.saveRecords(
            listOf(
                MacRecord(
                    localId = "local-1",
                    serverId = "srv-1",
                    name = "studio.local",
                    customName = "MacBook Pro",
                    hosts = listOf("10.0.0.2"),
                    port = 8765
                )
            )
        )
        return LiveNotifier(app, prefs, macs) to prefs
    }

    private val now = 1_792_089_000_000L

    private fun agent(
        state: AgentState,
        tab: String = "Claude",
        project: String = "api",
        since: Long = now - 40_000,
        turnStart: Long = now - 45 * 60_000,
        endedAt: Long = 0
    ) = LiveSnapshot.Agent(
        project,
        "",
        tab,
        "t-$tab",
        "claude_code_$tab",
        state,
        since,
        turnStart,
        endedAt
    )

    private val working = LiveSnapshot("srv-1", true, 0, 1, listOf(agent(AgentState.Working)))
    private val waiting = LiveSnapshot(
        "srv-1",
        true,
        1,
        2,
        listOf(
            agent(AgentState.NeedsYou, "Rate limiting", "api-gateway", turnStart = 0),
            agent(AgentState.Working, "Checkout flow", "storefront"),
            agent(AgentState.Working, "Claude 2", "storefront", turnStart = now - 120_000)
        )
    )
    private val finished = LiveSnapshot(
        "srv-1",
        false,
        0,
        0,
        listOf(agent(AgentState.Done, endedAt = now - 60_000))
    )

    /** Shown at the test's own `now`. */
    private fun LiveNotifier.post(macId: String, snapshot: LiveSnapshot, onScreen: Boolean) =
        show(macId, snapshot, onScreen, now)

    private fun card(): StatusBarNotification = manager.activeNotifications.single()

    private fun title() = card().notification.extras.getString(Notification.EXTRA_TITLE)

    private fun text(n: Notification) = n.extras.getCharSequence(Notification.EXTRA_TEXT).toString()

    private fun bigText(n: Notification) = n.extras.getCharSequence(Notification.EXTRA_BIG_TEXT)!!

    private fun bold(text: CharSequence): List<String> = (text as Spanned)
        .getSpans(0, text.length, StyleSpan::class.java)
        .filter { it.style == Typeface.BOLD }
        .map { text.subSequence(text.getSpanStart(it), text.getSpanEnd(it)).toString() }

    @Test
    fun workingIsAQuietOngoingCardCountingUp() = runTest {
        val (live, _) = notifier()
        live.post("srv-1", working, onScreen = false)

        val n = card().notification
        assertEquals("srv-1", card().tag)
        assertTrue(card().isOngoing)
        assertEquals("MacBook Pro", title())
        assertEquals("Claude · 45m", text(n))
        assertEquals("api\nClaude · 45m", bigText(n).toString())
        assertEquals(listOf("Claude"), bold(bigText(n)))
        assertEquals("Claude 45m", n.shortCriticalText)
        assertTrue(n.extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER))
        assertEquals(now - 45 * 60_000, n.`when`)
        assertTrue(n.extras.getBoolean(Notification.EXTRA_REQUEST_PROMOTED_ONGOING))
        assertEquals(0xFF3B82F6.toInt(), n.color)
        assertTrue(n.flags and Notification.FLAG_ONLY_ALERT_ONCE != 0)
        assertNull(n.actions)
        val open = shadowOf(n.contentIntent).savedIntent
        assertEquals("t-Claude", open.getStringExtra("terminalId"))
        assertEquals("terminal", open.getStringExtra("target"))
        assertEquals("srv-1", open.getStringExtra("serverId"))
    }

    @Test
    fun aWaitLeadsInOrangeOffersOpenAndCountsNothing() = runTest {
        val (live, _) = notifier()
        live.post("srv-1", waiting, onScreen = false)

        val n = card().notification
        assertEquals("MacBook Pro", title())
        assertEquals("Rate limiting · 40s", text(n))
        assertEquals(
            "api-gateway\nRate limiting · 40s\nstorefront\nCheckout flow · 45m\nClaude 2 · 2m",
            bigText(n).toString()
        )
        assertEquals(listOf("Rate limiting", "Checkout flow", "Claude 2"), bold(bigText(n)))
        assertEquals("Rate limiting 40s", n.shortCriticalText)
        assertEquals(0xFFFF8D28.toInt(), n.color)
        assertTrue(n.extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER))
        assertEquals(now - 40_000, n.`when`)
        assertNull(n.extras.getCharSequence(Notification.EXTRA_SUB_TEXT))
        assertEquals(listOf("Open"), n.actions.map { it.title.toString() })
        assertEquals(
            "t-Rate limiting",
            shadowOf(n.contentIntent).savedIntent.getStringExtra("terminalId")
        )
        assertEquals(1, manager.activeNotifications.size)
    }

    @Test
    fun aProblemSaysSo() = runTest {
        val (live, _) = notifier()
        val problem =
            agent(AgentState.Error, "Claude 2", "storefront", since = now - 120_000, turnStart = 0)
        live.post("srv-1", working.copy(agents = working.agents + problem), onScreen = false)
        assertEquals(
            "api\nClaude · 45m\nstorefront\nClaude 2 · problem · 2m",
            bigText(card().notification).toString()
        )
    }

    @Test
    fun theEndLeavesTheFinalReadingUpAWhileUnlessTheAppIsOpen() = runTest {
        val (live, _) = notifier()
        // Nothing was showing: the end shows nothing either.
        live.post("srv-1", finished, onScreen = false)
        assertTrue(manager.activeNotifications.isEmpty())

        live.post("srv-1", working, onScreen = false)
        live.post("srv-1", finished, onScreen = false)
        val n = card().notification
        assertEquals("MacBook Pro", title())
        assertEquals("Claude · 44m", text(n))
        assertFalse(card().isOngoing)
        assertFalse(n.extras.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER))
        assertFalse(n.extras.getBoolean(Notification.EXTRA_REQUEST_PROMOTED_ONGOING))
        assertEquals(now - 60_000, n.`when`)
        assertEquals(0xFF0088FF.toInt(), n.color)
        assertEquals(15 * 60 * 1000L, n.timeoutAfter)

        live.appOpened()
        assertTrue(manager.activeNotifications.isEmpty())

        live.post("srv-1", working, onScreen = true)
        live.post("srv-1", finished, onScreen = true)
        assertTrue(manager.activeNotifications.isEmpty())
    }

    @Test
    fun anEndWithNoAgentLeftTakesTheCardDown() = runTest {
        val (live, _) = notifier()
        live.post("srv-1", working, onScreen = false)
        live.post("srv-1", finished.copy(agents = emptyList()), onScreen = false)
        assertTrue(manager.activeNotifications.isEmpty())
    }

    @Test
    fun eachMacHasItsOwnCardAndOpeningKeepsTheLiveOnes() = runTest {
        val (live, _) = notifier()
        live.post("srv-1", working, onScreen = false)
        live.post("srv-2", working.copy(serverId = "srv-2"), onScreen = false)
        // A Mac this phone no longer has keeps its card, under a plain name.
        assertEquals(
            "Agents at work",
            manager.activeNotifications.single { it.tag == "srv-2" }.notification.extras
                .getString(Notification.EXTRA_TITLE)
        )
        live.post("srv-2", finished, onScreen = false)
        live.appOpened()
        assertEquals("srv-1", card().tag)
    }

    @Test
    fun aSwipedAwayCardStaysAwayUntilItsAgentsAreDone() = runTest {
        val (live, prefs) = notifier()
        live.post("srv-1", working, onScreen = false)
        val delete = shadowOf(card().notification.deleteIntent).savedIntent
        assertEquals(LiveDismissedReceiver::class.java.name, delete.component?.className)
        assertEquals("srv-1", delete.getStringExtra(LiveNotification.MAC_ID))
        manager.cancelAll()
        live.dismissed("srv-1")

        live.post("srv-1", waiting, onScreen = false)
        live.post("srv-2", working.copy(serverId = "srv-2"), onScreen = false)
        assertEquals("srv-2", card().tag)
        // The swipe outlives the process: each push may start a new one.
        assertEquals("srv-1", prefs.string("liveActivity.dismissed"))

        live.post("srv-1", finished, onScreen = false)
        live.post("srv-1", working, onScreen = false)
        assertEquals(setOf("srv-1", "srv-2"), manager.activeNotifications.map { it.tag }.toSet())
        assertNull(prefs.string("liveActivity.dismissed"))
    }

    @Test
    fun switchedOffShowsNothingAndRemovesWhatWasUp() = runTest {
        val (live, prefs) = notifier()
        live.post("srv-1", working, onScreen = false)
        live.removeAll()
        assertTrue(manager.activeNotifications.isEmpty())

        prefs.setNotificationPrefs(NotificationPrefs(liveActivity = false))
        live.post("srv-1", working, onScreen = false)
        assertTrue(manager.activeNotifications.isEmpty())
    }
}
