package cx.lpm.mobile.core.data.push

import cx.lpm.mobile.core.data.mac.MacRecord
import cx.lpm.mobile.core.data.testing.SessionHarness
import cx.lpm.mobile.core.model.long
import cx.lpm.mobile.core.model.string
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AgentAnswersTest {
    private fun TestScope.settle(millis: Long = 0) {
        testScheduler.advanceTimeBy(millis)
        testScheduler.runCurrent()
    }

    private fun answer(serverId: String = "srv-1", text: String? = null) = AgentAnswer(
        serverId = serverId,
        project = "api",
        terminalId = "t-1",
        key = "claude_code_t-1",
        ts = 1_792_089_000_123,
        action = if (text == null) AgentAnswerAction.Allow else AgentAnswerAction.Reply,
        text = text
    )

    private fun SessionHarness.officeMac(reachable: Boolean = true): MacRecord {
        val other = MacRecord(
            localId = MacRecord.newLocalId(),
            serverId = "srv-2",
            name = "Office Mac",
            hosts = listOf("10.0.0.5"),
            port = 8765
        )
        macStore.saveRecords(macStore.loadRecords() + other)
        credentials.save("dev-2", "tok-2", other.localId)
        if (reachable) prober.reachable += "10.0.0.5"
        return other
    }

    @Test
    fun theLiveMacIsAnsweredOnItsLinkAndItsReplyMatched() = runTest {
        val h = SessionHarness(this)
        val live = h.connectReady(features = listOf("answerAgent"))
        val outcome = async { h.answers.send(answer()) }
        settle()

        val frame = live.sentOf("answerAgent").single()
        assertEquals("api", frame.string("project"))
        assertEquals("t-1", frame.string("terminalId"))
        assertEquals("claude_code_t-1", frame.string("key"))
        assertEquals(1_792_089_000_123, frame.long("ts"))
        assertEquals("allow", frame.string("action"))
        assertNull(frame["text"])
        val reqId = frame.string("reqId")!!
        live.receive("""{"t":"answerAgent","ok":true,"reqId":"someone-else"}""")
        settle()
        assertFalse(outcome.isCompleted)
        live.receive("""{"t":"answerAgent","ok":true,"reqId":"$reqId"}""")
        settle()
        assertEquals(AnswerOutcome.Sent, outcome.await())
        assertEquals(1, h.transport.sockets.size)
    }

    @Test
    fun theMacsRefusalIsItsOwnSentence() = runTest {
        val h = SessionHarness(this)
        val live = h.connectReady(features = listOf("answerAgent"))
        val outcome = async { h.answers.send(answer(text = "Ship it")) }
        settle()

        val frame = live.sentOf("answerAgent").single()
        assertEquals("reply", frame.string("action"))
        assertEquals("Ship it", frame.string("text"))
        live.receive(
            """{"t":"answerAgent","ok":false,"error":"This prompt was already answered.",""" +
                """"reqId":"${frame.string("reqId")}"}"""
        )
        settle()
        assertEquals(AnswerOutcome.Refused("This prompt was already answered."), outcome.await())
    }

    @Test
    fun anotherMacIsAnsweredOverAConnectionOfItsOwn() = runTest {
        val h = SessionHarness(this)
        val live = h.connectReady(features = listOf("answerAgent"))
        h.officeMac()
        val outcome = async { h.answers.send(answer(serverId = "srv-2")) }
        settle()

        val errand = h.transport.last
        assertTrue(errand !== live)
        errand.open()
        settle()
        assertEquals("tok-2", errand.sentOf("auth").single().string("token"))
        errand.receive("""{"t":"ready","serverId":"srv-2","features":["answerAgent"]}""")
        settle()
        val reqId = errand.sentOf("answerAgent").single().string("reqId")
        errand.receive("""{"t":"answerAgent","ok":true,"reqId":"$reqId"}""")
        settle()

        assertEquals(AnswerOutcome.Sent, outcome.await())
        assertTrue(errand.closed)
        assertTrue(live.sentOf("answerAgent").isEmpty())
    }

    @Test
    fun aColdStartDialsTheMacTheAlertCameFrom() = runTest {
        val h = SessionHarness(this)
        // No live session at all: the tap started the process.
        h.savedMac()
        val outcome = async { h.answers.send(answer()) }
        settle()
        assertTrue(h.transport.sockets.isEmpty())
        assertEquals(AnswerOutcome.Unreachable("Studio Mac"), outcome.await())

        h.prober.reachable += "192.168.1.20"
        val second = async { h.answers.send(answer()) }
        settle()
        val errand = h.transport.last
        errand.open()
        settle()
        errand.receive("""{"t":"ready","serverId":"srv-1"}""")
        settle()
        val reqId = errand.sentOf("answerAgent").single().string("reqId")
        errand.receive("""{"t":"answerAgent","ok":true,"reqId":"$reqId"}""")
        settle()
        assertEquals(AnswerOutcome.Sent, second.await())
    }

    @Test
    fun aQuietLinkHandsAnAllowToAConnectionOfItsOwn() = runTest {
        val h = SessionHarness(this)
        val live = h.connectReady(features = listOf("answerAgent"))
        h.prober.reachable += "192.168.1.20"
        val outcome = async { h.answers.send(answer()) }
        settle()
        assertEquals(1, live.sentOf("answerAgent").size)
        settle(9_999)
        assertEquals(1, h.transport.sockets.size)
        settle(2)

        // The Mac takes only the first answer to a prompt, so trying again is safe.
        val errand = h.transport.last
        assertTrue(errand !== live)
        errand.open()
        settle()
        errand.receive("""{"t":"ready","serverId":"srv-1","features":["answerAgent"]}""")
        settle()
        val reqId = errand.sentOf("answerAgent").single().string("reqId")
        errand.receive("""{"t":"answerAgent","ok":true,"reqId":"$reqId"}""")
        settle()
        assertEquals(AnswerOutcome.Sent, outcome.await())
    }

    @Test
    fun aQuietLinkNeverSendsAReplyTwice() = runTest {
        val h = SessionHarness(this)
        val live = h.connectReady(features = listOf("answerAgent"))
        h.prober.reachable += "192.168.1.20"
        val outcome = async { h.answers.send(answer(text = "Ship it")) }
        settle(10_001)
        assertEquals(AnswerOutcome.Unreachable("Studio Mac"), outcome.await())
        assertEquals(1, h.transport.sockets.size)
        assertEquals(1, live.sentOf("answerAgent").size)
    }

    @Test
    fun silenceRunsOutTheBudget() = runTest {
        val h = SessionHarness(this)
        h.connectReady(features = listOf("answerAgent"))
        h.prober.reachable += "192.168.1.20"
        val outcome = async { h.answers.send(answer()) }
        settle(10_001)
        val errand = h.transport.last
        errand.open()
        settle()
        errand.receive("""{"t":"ready","serverId":"srv-1","features":["answerAgent"]}""")
        settle(14_000)
        assertFalse(outcome.isCompleted)
        settle(1_000)
        assertEquals(AnswerOutcome.Unreachable("Studio Mac"), outcome.await())
        assertTrue(errand.closed)
    }

    @Test
    fun aLiveMacThatCantTakeAnswersIsDialedAfresh() = runTest {
        val h = SessionHarness(this)
        val live = h.connectReady()
        val outcome = async { h.answers.send(answer()) }
        settle()
        assertTrue(live.sentOf("answerAgent").isEmpty())
        assertEquals(AnswerOutcome.Unreachable("Studio Mac"), outcome.await())
    }

    @Test
    fun aMacThePhoneNoLongerHasIsSaidSo() = runTest {
        val h = SessionHarness(this)
        h.connectReady(features = listOf("answerAgent"))
        val outcome = async { h.answers.send(answer(serverId = "srv-9")) }
        settle()
        assertEquals(AnswerOutcome.UnknownMac, outcome.await())
    }
}
