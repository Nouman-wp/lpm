package cx.lpm.mobile.core.push

import android.Manifest
import android.app.Application
import android.app.Notification
import android.app.NotificationManager
import android.content.Context
import androidx.test.core.app.ApplicationProvider
import cx.lpm.mobile.core.data.push.AgentAnswerAction
import cx.lpm.mobile.core.data.push.AgentAnswers
import cx.lpm.mobile.core.data.push.PushAlert
import cx.lpm.mobile.core.data.push.PushKind
import cx.lpm.mobile.core.model.string
import cx.lpm.mobile.core.testing.TestSession
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf

/** A tapped Allow, Deny or Reply, from the button to the notification saying how it went. */
@OptIn(ExperimentalCoroutinesApi::class)
@RunWith(RobolectricTestRunner::class)
class AnswerHandlerTest {
    private val app: Application = ApplicationProvider.getApplicationContext()
    private val manager = app.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    private val alert = PushAlert(
        serverId = "srv-1",
        project = "api",
        title = "API",
        body = "Claude — Agent is waiting for you",
        kind = PushKind.Waiting,
        target = "terminal",
        terminalId = "t-1",
        automationId = null,
        statusKey = "claude_code_t-1",
        status = "Waiting",
        ts = 42,
        actions = listOf(AgentAnswerAction.Allow, AgentAnswerAction.Deny)
    )

    @Before
    fun showTheAlert() {
        shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
        manager.notify(
            "c1",
            AlertExtras.NOTIFICATION_ID,
            app.alertNotification(alert, "c1").build()
        )
    }

    private class Run(val t: TestSession, val handler: AnswerHandler) {
        var finished = false
    }

    private suspend fun TestScope.handler(): Run {
        val t = TestSession(this)
        t.credentials.load()
        t.prefs.load()
        t.savedMac(name = "MacBook Pro")
        t.prober.reachable += "192.168.1.20"
        val answers =
            AgentAnswers(t.prefs, t.credentials, t.macStore, t.clients, t.prober, t.device)
        return Run(t, AnswerHandler(answers, AnswerNotices(app), backgroundScope))
    }

    private fun Run.tap(action: AgentAnswerAction) =
        handler.handle(AnswerRequest(alert, "c1", action, null)) { finished = true }

    /** The Mac's side of the short-lived connection, answering with `reply`. */
    private fun TestScope.macAnswers(run: Run, reply: (reqId: String) -> String) {
        testScheduler.runCurrent()
        val socket = run.t.transport.last
        socket.open()
        testScheduler.runCurrent()
        socket.receive("""{"t":"ready","serverId":"srv-1","features":["answerAgent"]}""")
        testScheduler.runCurrent()
        val frame = socket.sentOf("answerAgent").single()
        assertEquals("deny", frame.string("action"))
        socket.receive(reply(frame.string("reqId")!!))
        testScheduler.runCurrent()
    }

    @Test
    fun anAnswerThatWentThroughTakesTheAlertAway() = runTest {
        val run = handler()
        run.tap(AgentAnswerAction.Deny)
        assertFalse(run.finished)
        macAnswers(run) { """{"t":"answerAgent","ok":true,"reqId":"$it"}""" }

        assertTrue(manager.activeNotifications.isEmpty())
        assertTrue(run.finished)
    }

    @Test
    fun aRefusedAnswerSaysWhyInItsPlace() = runTest {
        val run = handler()
        run.tap(AgentAnswerAction.Deny)
        macAnswers(run) {
            """{"t":"answerAgent","ok":false,"error":"This prompt was already answered.",""" +
                """"reqId":"$it"}"""
        }

        val n = manager.activeNotifications.single()
        assertEquals("c1", n.tag)
        assertEquals("API", n.notification.extras.getString(Notification.EXTRA_TITLE))
        assertEquals(
            "Not sent: This prompt was already answered.",
            n.notification.extras.getCharSequence(Notification.EXTRA_TEXT).toString()
        )
        assertTrue(run.finished)
    }

    @Test
    fun aMacThatNeverAnswersIsNamedOnceTheBudgetRunsOut() = runTest {
        val run = handler()
        run.tap(AgentAnswerAction.Allow)
        testScheduler.runCurrent()
        val socket = run.t.transport.last
        socket.open()
        testScheduler.runCurrent()
        socket.receive("""{"t":"ready","serverId":"srv-1","features":["answerAgent"]}""")
        testScheduler.advanceTimeBy(24_000)
        testScheduler.runCurrent()
        assertFalse(run.finished)
        testScheduler.advanceTimeBy(1_001)
        testScheduler.runCurrent()

        assertEquals(
            "Not sent: couldn't reach MacBook Pro.",
            manager.activeNotifications.single().notification.extras
                .getCharSequence(Notification.EXTRA_TEXT).toString()
        )
        assertTrue(run.finished)
    }
}
