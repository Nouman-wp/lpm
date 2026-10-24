package cx.lpm.mobile.core.push

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/** The user swiped an agents-at-work card away: it isn't posted again until its agents are done. */
@AndroidEntryPoint
class LiveDismissedReceiver : BroadcastReceiver() {
    @Inject
    lateinit var live: LiveNotifier

    override fun onReceive(context: Context, intent: Intent) {
        live.dismissed(intent.getStringExtra(LiveNotification.MAC_ID) ?: return)
    }
}
