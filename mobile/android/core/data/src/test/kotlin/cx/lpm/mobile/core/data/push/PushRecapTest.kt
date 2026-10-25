package cx.lpm.mobile.core.data.push

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class PushRecapTest {
    private fun obj(json: String) = Json.parseToJsonElement(json) as JsonObject

    private val recap =
        """{"serverId":"srv-1","target":"recap","week":"2026-10-12",""" +
            """"title":"Your week in lpm is ready","body":"31h 20m of agents working for you",""" +
            """"ts":1792540800000,"key":"recap:2026-10-12"}"""

    @Test
    fun `the Mac's words are shown as given`() {
        assertEquals(
            PushRecap(
                serverId = "srv-1",
                week = "2026-10-12",
                title = "Your week in lpm is ready",
                body = "31h 20m of agents working for you",
                key = "recap:2026-10-12"
            ),
            PushRecap.parse(obj(recap))
        )
    }

    @Test
    fun `it is no agent alert, and other alerts are no recap`() {
        assertNull(PushAlert.parse(obj(recap)))
        assertNull(
            PushRecap.parse(
                obj("""{"serverId":"srv-1","project":"api","target":"terminal","status":"Done"}""")
            )
        )
        assertNull(PushRecap.parse(obj("""{"target":"recap","week":"2026-10-12"}""")))
        assertEquals(
            "recap:2026-10-12",
            PushRecap.parse(obj("""{"target":"recap","week":"2026-10-12","title":"Ready"}"""))?.key
        )
    }

    @Test
    fun `a tap opens the recap of the Mac it came from, with no project`() {
        val extras = mapOf("serverId" to "srv-1", "target" to "recap")
        assertEquals(
            NotificationOpenTarget(
                serverId = "srv-1",
                project = "",
                kind = NotificationOpenTarget.Kind.Recap,
                itemId = null
            ),
            NotificationOpenTarget.from(extras::get)
        )
    }
}
