package cx.lpm.mobile.core.data.mac

import cx.lpm.mobile.core.data.client.LpmClient
import cx.lpm.mobile.core.data.client.NoTailnet
import cx.lpm.mobile.core.data.testing.FakeCipher
import cx.lpm.mobile.core.data.testing.FakeTransport
import cx.lpm.mobile.core.data.testing.InMemoryDataStore
import cx.lpm.mobile.core.data.testing.SchedulerClock
import cx.lpm.mobile.core.model.string
import java.time.Instant
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MacUnpairTest {
    private val credential = LpmClient.Credential("dev-1", "tok-1")

    private fun TestScope.unpair(
        transport: FakeTransport,
        credentials: CredentialStore,
        start: Instant = Instant.parse("2026-10-15T12:00:00Z")
    ) = MacUnpair(
        backgroundScope,
        transport,
        NoTailnet,
        credentials,
        SchedulerClock(testScheduler, start)
    )

    private fun TestScope.store() =
        CredentialStore(InMemoryDataStore(), FakeCipher(), backgroundScope)

    @Test
    fun `a Mac that couldn't be reached is told the next time`() = runTest {
        val transport = FakeTransport()
        val unpair = unpair(transport, store())
        unpair.send(listOf("192.168.1.20"), 8765, credential, pin = "ab")
        testScheduler.runCurrent()
        transport.last.fail()
        testScheduler.runCurrent()
        assertEquals(listOf("dev-1"), unpair.pending().map { it.deviceId })

        unpair.retryPending()
        testScheduler.runCurrent()
        assertEquals(2, transport.sockets.size)
        val socket = transport.last
        socket.open()
        val sent = Json.parseToJsonElement(socket.sent.single()) as JsonObject
        assertEquals("unpair", sent.string("t"))
        assertEquals("tok-1", sent.string("token"))
        socket.receive("""{"t":"unpaired"}""")
        testScheduler.runCurrent()
        assertTrue(unpair.pending().isEmpty())
    }

    @Test
    fun `a Mac that can't save the removal is asked again`() = runTest {
        val transport = FakeTransport()
        val unpair = unpair(transport, store())
        unpair.send(listOf("192.168.1.20"), 8765, credential, pin = "ab")
        testScheduler.runCurrent()
        transport.last.open()
        transport.last.receive("""{"t":"error","error":"unpair unavailable"}""")
        testScheduler.runCurrent()
        assertEquals(1, unpair.pending().size)
    }

    @Test
    fun `a Mac without a pin is never handed the token`() = runTest {
        val transport = FakeTransport()
        val unpair = unpair(transport, store())
        unpair.send(listOf("192.168.1.20"), 8765, credential, pin = null)
        testScheduler.runCurrent()
        assertTrue(transport.sockets.isEmpty())
        assertTrue(unpair.pending().isEmpty())
    }

    @Test
    fun `a Mac unreachable for a month is given up on`() = runTest {
        val transport = FakeTransport()
        val credentials = store()
        unpair(transport, credentials).send(listOf("192.168.1.20"), 8765, credential, pin = "ab")
        testScheduler.runCurrent()
        transport.last.fail()
        testScheduler.runCurrent()

        val later = unpair(transport, credentials, Instant.parse("2026-11-20T12:00:00Z"))
        later.retryPending()
        testScheduler.runCurrent()
        assertEquals(1, transport.sockets.size)
        assertTrue(later.pending().isEmpty())
    }

    @Test
    fun `only an answer that the record is gone settles it`() {
        assertTrue(MacUnpair.settled("""{"t":"unpaired"}"""))
        assertTrue(MacUnpair.settled("""{"t":"error","error":"unauthorized"}"""))
        assertFalse(MacUnpair.settled("""{"t":"error","error":"unpair unavailable"}"""))
        assertFalse(MacUnpair.settled("not json"))
    }
}
