package cx.lpm.mobile.core.data.push

import cx.lpm.mobile.core.data.client.LpmClient
import cx.lpm.mobile.core.data.session.MacSession
import cx.lpm.mobile.core.data.session.SessionStore

/**
 * The live session's push wiring: register when the link comes up, note the Mac's
 * ack, and hand back the replies to answers sent from notifications. A machine visit
 * leaves push alone — the Mac it goes through is the one that knows this phone.
 */
internal class PushStore(
    private val session: MacSession,
    private val registrar: PushRegistrar,
    private val answers: AgentAnswers
) : SessionStore {
    init {
        if (!session.isVisit) {
            registrar.attach(session)
            answers.attach(session)
        }
    }

    override fun wire(client: LpmClient) {
        if (session.isVisit) return
        client.onPushToken = registrar::liveAcknowledged
        client.onAnswerAgent = answers::delivered
    }

    override fun reset() = Unit

    override fun onReady(client: LpmClient) {
        if (!session.isVisit) registrar.sync()
    }
}
