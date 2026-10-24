package cx.lpm.mobile.core.push

import android.content.Context
import androidx.core.app.NotificationManagerCompat
import cx.lpm.mobile.core.data.mac.MacStore
import cx.lpm.mobile.core.data.prefs.AppPreferences
import cx.lpm.mobile.core.data.prefs.PreferenceKeys
import cx.lpm.mobile.core.data.prefs.notificationPrefs
import cx.lpm.mobile.core.data.push.LiveSnapshot
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.runBlocking

/**
 * Keeps one ongoing notification per Mac in step with its agents (the Android
 * counterpart of iOS's Live Activity), titled with the Mac's saved name and fed by
 * the live link and by the Mac's `liveactivity` pushes alike. When nothing is at work
 * it shows the final reading a while — only if one was showing, and not while the app
 * is on screen or when it has no agent left to list, where it just goes.
 * A card the user swiped away stays away until that Mac's agents are done; the
 * Macs it was swiped for are kept, since each push may start a new process.
 */
@Singleton
class LiveNotifier @Inject constructor(
    @param:ApplicationContext private val context: Context,
    private val prefs: AppPreferences,
    private val macs: MacStore
) {
    private val manager = NotificationManagerCompat.from(context)

    private data class Shown(val macId: String, val ended: Boolean)

    @Synchronized
    fun show(
        macId: String,
        snapshot: LiveSnapshot,
        onScreen: Boolean,
        now: Long = System.currentTimeMillis()
    ) {
        loadPrefs()
        if (!prefs.notificationPrefs.liveActivity || !context.mayPostNotifications()) return
        val card = LiveCard.of(macId, macName(macId), snapshot, now)
        if (macId in dismissed()) {
            if (card.ended) setDismissed(dismissed() - macId)
            return
        }
        if (card.ended) {
            val shown = shown().firstOrNull { it.macId == macId }
            if (shown == null || shown.ended) return
            if (onScreen || card.entries.isEmpty()) return cancel(macId)
        }
        context.notifyIfAllowed(macId, LiveNotification.ID) {
            LiveNotification.build(context, card)
        }
    }

    /** The app came on screen: the final cards it left up have been seen. */
    @Synchronized
    fun appOpened() = shown().filter { it.ended }.forEach { cancel(it.macId) }

    /** Live updates were switched off. */
    @Synchronized
    fun removeAll() = shown().forEach { cancel(it.macId) }

    /** The user swiped the card away. */
    @Synchronized
    fun dismissed(macId: String) {
        loadPrefs()
        setDismissed(dismissed() + macId)
    }

    // A push or a swipe can start the process before the app has loaded its settings.
    private fun loadPrefs() {
        if (!prefs.isLoaded) runBlocking { prefs.load() }
    }

    private fun macName(macId: String): String? =
        macs.loadRecords().firstOrNull { it.via == null && it.widgetId == macId }?.displayName

    private fun dismissed(): Set<String> =
        prefs.string(PreferenceKeys.LIVE_DISMISSED)?.split(',')?.filter { it.isNotEmpty() }?.toSet()
            .orEmpty()

    private fun setDismissed(macs: Set<String>) =
        prefs.setString(PreferenceKeys.LIVE_DISMISSED, macs.joinToString(",").ifEmpty { null })

    private fun shown(): List<Shown> = manager.activeNotifications
        .filter { it.id == LiveNotification.ID && it.tag != null }
        .map { Shown(it.tag, it.notification.extras.getBoolean(LiveNotification.ENDED)) }

    private fun cancel(macId: String) = manager.cancel(macId, LiveNotification.ID)
}
