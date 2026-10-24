package cx.lpm.mobile.core.push

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import cx.lpm.mobile.core.data.di.ApplicationScope
import cx.lpm.mobile.core.data.push.AgentAnswers
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * Where a notification's Allow, Deny and Reply buttons land. The answer goes to the
 * Mac while the broadcast is held open (within the 25 seconds [AgentAnswers] allows),
 * and the notification then says how it went.
 */
@AndroidEntryPoint
class AnswerReceiver : BroadcastReceiver() {
    @Inject
    lateinit var handler: AnswerHandler

    override fun onReceive(context: Context, intent: Intent) {
        val request = AnswerRequest.from(intent) ?: return
        val pending = goAsync()
        handler.handle(request) { pending.finish() }
    }
}

@Singleton
class AnswerHandler @Inject constructor(
    private val answers: AgentAnswers,
    private val notices: AnswerNotices,
    @param:ApplicationScope private val scope: CoroutineScope
) {
    internal fun handle(request: AnswerRequest, finished: () -> Unit) {
        scope.launch {
            try {
                val answer = request.answer
                if (answer == null) {
                    notices.restore(request)
                } else {
                    notices.show(request, answers.send(answer))
                }
            } finally {
                finished()
            }
        }
    }
}
