package cx.lpm.mobile.core.data.mac

import cx.lpm.mobile.core.data.client.LpmClient
import cx.lpm.mobile.core.data.client.PinningTrustManager
import cx.lpm.mobile.core.data.client.Socket
import cx.lpm.mobile.core.data.client.SocketListener
import cx.lpm.mobile.core.data.client.SocketTransport
import cx.lpm.mobile.core.data.client.TailnetRouter
import cx.lpm.mobile.core.data.client.WssUrl
import cx.lpm.mobile.core.model.int
import cx.lpm.mobile.core.model.long
import cx.lpm.mobile.core.model.string
import cx.lpm.mobile.core.model.strings
import cx.lpm.mobile.core.protocol.Wire
import java.time.Clock
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.resume
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray

/**
 * Tells a Mac the user removed it from this phone, so it drops this phone's device
 * record instead of trusting — and pushing to — a credential the phone no longer
 * has. One short-lived connection per address, on the pinned certificate only.
 * Removal never waits for it: a Mac that can't be reached now stays pending and is
 * told the next time the app comes forward, for a month.
 */
class MacUnpair(
    private val scope: CoroutineScope,
    private val transport: SocketTransport,
    private val tailnet: TailnetRouter,
    private val credentials: CredentialStore,
    private val clock: Clock
) {
    private val inFlight = ConcurrentHashMap.newKeySet<String>()

    /** A Mac removed from this phone that hasn't heard yet. */
    data class Pending(
        val deviceId: String,
        val token: String,
        val pin: String,
        val hosts: List<String>,
        val port: Int,
        val since: Long
    )

    fun send(hosts: List<String>, port: Int, credential: LpmClient.Credential, pin: String?) {
        // Without a pin, whoever answers at the address could be anyone; the token
        // isn't handed to them.
        if (pin == null) return
        val item = Pending(credential.deviceId, credential.token, pin, hosts, port, clock.millis())
        edit { list -> list.filterNot { it.deviceId == item.deviceId } + item }
        attempt(item)
    }

    /** Try again every Mac that hasn't heard yet. */
    fun retryPending() {
        val now = clock.millis()
        for (item in pending()) {
            if (now - item.since > GIVE_UP_MS) forget(item.deviceId) else attempt(item)
        }
    }

    fun pending(): List<Pending> = decode(credentials.loadPendingUnpairs())

    private fun attempt(item: Pending) {
        if (!inFlight.add(item.deviceId)) return
        val frame = Wire.unpair(item.deviceId, item.token, credentials.phoneId)
        scope.launch {
            try {
                for (host in item.hosts) {
                    if (host.isNotEmpty() && deliver(frame, host, item.port, item.pin)) {
                        forget(item.deviceId)
                        return@launch
                    }
                }
            } finally {
                inFlight.remove(item.deviceId)
            }
        }
    }

    private fun forget(deviceId: String) = edit { list ->
        list.filterNot { it.deviceId == deviceId }
    }

    @Synchronized
    private fun edit(change: (List<Pending>) -> List<Pending>) {
        val next = change(pending())
        credentials.savePendingUnpairs(if (next.isEmpty()) null else encode(next))
    }

    /** Whether the Mac at `host` no longer holds the record: it just dropped it, or had already. */
    private suspend fun deliver(frame: String, host: String, port: Int, pin: String): Boolean {
        val (dialHost, dialPort) = tailnet.route(host, port)
        val url = WssUrl.make(dialHost, dialPort) ?: return false
        var socket: Socket? = null
        val answered = withTimeoutOrNull(TIMEOUT_MS) {
            suspendCancellableCoroutine { cont ->
                val listener = object : SocketListener {
                    override fun onOpen(socket: Socket) {
                        if (!socket.send(frame) && cont.isActive) cont.resume(false)
                    }

                    override fun onMessage(socket: Socket, text: String) {
                        if (cont.isActive) cont.resume(settled(text))
                    }

                    override fun onFailure(socket: Socket, error: Throwable?) {
                        if (cont.isActive) cont.resume(false)
                    }
                }
                socket = transport.open(url, PinningTrustManager({ pin }, null), listener)
            }
        } ?: false
        socket?.close()
        return answered
    }

    companion object {
        private const val TIMEOUT_MS = 8_000L
        private const val GIVE_UP_MS = 30L * 24 * 60 * 60 * 1000

        fun settled(reply: String): Boolean {
            val o = parse(reply) as? JsonObject ?: return false
            if (o.string("t") == "unpaired") return true
            val error = o.string("error")
            return o.string("t") == "error" && (error == "unauthorized" || error == "revoked")
        }

        private fun encode(items: List<Pending>): String = buildJsonArray {
            for (item in items) {
                add(
                    buildJsonObject {
                        put("deviceId", item.deviceId)
                        put("token", item.token)
                        put("pin", item.pin)
                        putJsonArray("hosts") { item.hosts.forEach { add(it) } }
                        put("port", item.port)
                        put("since", item.since)
                    }
                )
            }
        }.toString()

        private fun decode(text: String?): List<Pending> {
            val items = text?.let(::parse) as? JsonArray ?: return emptyList()
            return items.mapNotNull { element ->
                val o = element as? JsonObject ?: return@mapNotNull null
                Pending(
                    deviceId = o.string("deviceId") ?: return@mapNotNull null,
                    token = o.string("token") ?: return@mapNotNull null,
                    pin = o.string("pin") ?: return@mapNotNull null,
                    hosts = o.strings("hosts").orEmpty(),
                    port = o.int("port") ?: return@mapNotNull null,
                    since = o.long("since") ?: 0L
                )
            }
        }

        private fun parse(text: String) = try {
            Json.parseToJsonElement(text)
        } catch (e: SerializationException) {
            null
        }
    }
}
