package cx.lpm.mobile.core.push

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.StyleSpan
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import cx.lpm.mobile.core.data.push.NotificationOpenTarget

/**
 * The look of a [LiveCard], the Agents widget as a notification: one ongoing
 * notification per Mac, quiet, asking Android 16 to promote it to a Live Update. The
 * title is the Mac; expanded, each agent is its project on a line of its own (once
 * for consecutive tabs of one project), then the tab in bold and its time. Collapsed
 * and in the status bar chip it is the most urgent tab and its time, while the header
 * counts up from that agent's start. The accent carries the state — orange when one
 * needs you, the working blue, the done blue at the end — since a Live Update can't
 * color its text. A wait offers Open. The final card can be swiped away and goes by
 * itself after 15 minutes.
 */
internal object LiveNotification {
    const val CHANNEL = "agents-live"

    /** Live cards share one id; the Mac's id is the tag. */
    const val ID = 2

    const val ENDED = "liveEnded"
    const val MAC_ID = "liveMacId"

    private const val LINGER_MS = 15 * 60 * 1000L
    private const val SEPARATOR = " · "

    fun build(context: Context, card: LiveCard): Notification {
        val open = context.openIntent("live|${card.macId}".hashCode(), card.openExtras())
        val atWork = context.getString(R.string.live_at_work)
        val lead = card.lead
        val builder = NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_lpm)
            .setColor(ContextCompat.getColor(context, card.tone.color))
            .setContentTitle(card.macName ?: atWork)
            .setContentText(lead?.let { context.line(it) } ?: atWork)
            .setContentIntent(open)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOnlyAlertOnce(true)
            .setLocalOnly(true)
            .addExtras(Bundle().apply { putBoolean(ENDED, card.ended) })
        if (card.entries.isNotEmpty()) {
            builder.setStyle(NotificationCompat.BigTextStyle().bigText(context.list(card.entries)))
        }
        val counting = card.countingFrom
        val at = counting ?: card.at
        if (at != null) builder.setWhen(at).setShowWhen(true) else builder.setShowWhen(false)
        if (counting != null) builder.setUsesChronometer(true)
        if (card.ended) {
            return builder.setAutoCancel(true).setTimeoutAfter(LINGER_MS).build()
        }
        builder
            .setOngoing(true)
            .setRequestPromotedOngoing(true)
            .setDeleteIntent(dismissIntent(context, card.macId))
        lead?.let { builder.setShortCriticalText(listOfNotNull(it.tab, it.time).joinToString(" ")) }
        if (card.tone == LiveCard.Tone.NeedsYou) {
            builder.addAction(0, context.getString(R.string.live_open), open)
        }
        return builder.build()
    }

    /** "Rate limiting · 40s", "Claude 2 · problem · 2m". */
    private fun Context.line(entry: LiveCard.Entry): String =
        listOfNotNull(entry.tab, detail(entry)).joinToString(SEPARATOR)

    private fun Context.detail(entry: LiveCard.Entry): String? {
        val problem = if (entry.problem) getString(R.string.live_problem) else null
        return listOfNotNull(problem, entry.time).joinToString(SEPARATOR).ifEmpty { null }
    }

    private fun Context.list(entries: List<LiveCard.Entry>): CharSequence =
        SpannableStringBuilder().apply {
            for (entry in entries) {
                if (isNotEmpty()) append('\n')
                entry.project?.let { append(it).append('\n') }
                append(entry.tab, StyleSpan(Typeface.BOLD), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                detail(entry)?.let { append(SEPARATOR).append(it) }
            }
        }

    private val LiveCard.Tone.color: Int
        get() = when (this) {
            LiveCard.Tone.NeedsYou -> R.color.push_needs_you
            LiveCard.Tone.Working -> R.color.push_working
            LiveCard.Tone.Done -> R.color.push_done
        }

    /** Android asks that a swiped-away Live Update isn't posted again. */
    private fun dismissIntent(context: Context, macId: String): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            "dismiss|$macId".hashCode(),
            Intent(context, LiveDismissedReceiver::class.java).putExtra(MAC_ID, macId),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

    private fun LiveCard.openExtras(): Bundle = Bundle().apply {
        val target = open ?: return@apply
        putString(NotificationOpenTarget.PROJECT, target.project)
        putString(NotificationOpenTarget.SERVER_ID, macId)
        if (target.terminalId != null) {
            putString(NotificationOpenTarget.TARGET, "terminal")
            putString(NotificationOpenTarget.TERMINAL_ID, target.terminalId)
        }
    }
}
