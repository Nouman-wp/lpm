package cx.lpm.mobile.core.push

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.RemoteInput
import cx.lpm.mobile.core.data.push.AgentAnswer
import cx.lpm.mobile.core.data.push.AgentAnswerAction
import cx.lpm.mobile.core.data.push.PushAlert

/**
 * The buttons an alert offers (PROTOCOL.md "Answering from a notification"): Allow
 * and Deny, or Reply with a text field. Each one asks for the phone to be unlocked
 * and sends the alert itself along to [AnswerReceiver].
 */
internal fun Context.answerActions(alert: PushAlert, tag: String): List<NotificationCompat.Action> =
    alert.actions.map { action ->
        val intent = Intent(this, AnswerReceiver::class.java)
            .setAction(AnswerRequest.ACTION)
            .putExtras(alert.extras())
            .putExtra(AnswerRequest.TAG, tag)
            .putExtra(AnswerRequest.ANSWER, action.wire)
        // A reply's text is filled in by the system, so only its intent is mutable.
        val mutability = if (action == AgentAnswerAction.Reply) {
            PendingIntent.FLAG_MUTABLE
        } else {
            PendingIntent.FLAG_IMMUTABLE
        }
        val pending = PendingIntent.getBroadcast(
            this,
            "$tag|${action.wire}".hashCode(),
            intent,
            mutability or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val builder = NotificationCompat.Action.Builder(null, getString(action.title), pending)
            .setAuthenticationRequired(true)
        if (action == AgentAnswerAction.Reply) {
            builder
                .addRemoteInput(
                    RemoteInput.Builder(AnswerRequest.REPLY_TEXT)
                        .setLabel(getString(R.string.answer_reply_hint))
                        .build()
                )
                .setAllowGeneratedReplies(false)
                .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
        }
        builder.build()
    }

private val AgentAnswerAction.title: Int
    get() = when (this) {
        AgentAnswerAction.Allow -> R.string.answer_allow
        AgentAnswerAction.Deny -> R.string.answer_deny
        AgentAnswerAction.Reply -> R.string.answer_reply
    }

/** A tapped answer button: the alert it belongs to, its notification and what was chosen. */
internal data class AnswerRequest(
    val alert: PushAlert,
    val tag: String,
    val action: AgentAnswerAction,
    val text: String?
) {
    /** Null for a reply with nothing in it, or a button the alert doesn't offer. */
    val answer: AgentAnswer?
        get() {
            if (action == AgentAnswerAction.Reply && text.isNullOrEmpty()) return null
            return alert.answer(action, text)
        }

    companion object {
        const val ACTION = "cx.lpm.mobile.action.ANSWER_AGENT"
        const val TAG = "answerTag"
        const val ANSWER = "answer"
        const val REPLY_TEXT = "replyText"

        fun from(intent: Intent): AnswerRequest? {
            if (intent.action != ACTION) return null
            val extras = intent.extras ?: return null
            val alert = extras.toAlert() ?: return null
            return AnswerRequest(
                alert = alert,
                tag = extras.getString(TAG) ?: return null,
                action = AgentAnswerAction.of(extras.getString(ANSWER)) ?: return null,
                text = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(REPLY_TEXT)
                    ?.toString()?.trim()
            )
        }
    }
}
