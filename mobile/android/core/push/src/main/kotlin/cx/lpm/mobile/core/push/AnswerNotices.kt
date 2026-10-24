package cx.lpm.mobile.core.push

import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import cx.lpm.mobile.core.data.push.AnswerOutcome
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * How an answer from a notification went, told in that same notification (iOS
 * `AgentAnswerSender`): one that went through takes the notification away, and a
 * failure says why ("Not sent: …") and still opens the tab when tapped.
 */
@Singleton
class AnswerNotices @Inject constructor(@param:ApplicationContext private val context: Context) {
    private val manager = NotificationManagerCompat.from(context)

    internal fun show(request: AnswerRequest, outcome: AnswerOutcome) {
        when (outcome) {
            AnswerOutcome.Sent -> manager.cancel(request.tag, AlertExtras.NOTIFICATION_ID)

            is AnswerOutcome.Refused -> notSent(request, outcome.error)

            AnswerOutcome.UnknownMac ->
                notSent(request, context.getString(R.string.answer_unknown_mac))

            is AnswerOutcome.Unreachable -> notSent(
                request,
                context.getString(
                    R.string.answer_unreachable,
                    outcome.macName ?: context.getString(R.string.answer_your_mac)
                )
            )
        }
    }

    /** Puts the alert back as it was: a reply with nothing in it sends nothing. */
    internal fun restore(request: AnswerRequest) =
        post(request, context.alertNotification(request.alert, request.tag).setOnlyAlertOnce(true))

    private fun notSent(request: AnswerRequest, reason: String) {
        val body = context.getString(R.string.answer_not_sent, reason)
        post(request, context.alertNotification(request.alert, request.tag, body, answers = false))
    }

    private fun post(request: AnswerRequest, builder: NotificationCompat.Builder) =
        context.notifyIfAllowed(request.tag, AlertExtras.NOTIFICATION_ID, builder::build)
}
