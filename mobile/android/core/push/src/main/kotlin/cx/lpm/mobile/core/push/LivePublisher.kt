package cx.lpm.mobile.core.push

import cx.lpm.mobile.core.data.client.LpmClient
import cx.lpm.mobile.core.data.di.ApplicationScope
import cx.lpm.mobile.core.data.link.LinkState
import cx.lpm.mobile.core.data.prefs.AppPreferences
import cx.lpm.mobile.core.data.prefs.NotificationPrefs
import cx.lpm.mobile.core.data.prefs.notificationPrefsFlow
import cx.lpm.mobile.core.data.projects.ProjectsState
import cx.lpm.mobile.core.data.projects.ProjectsStore
import cx.lpm.mobile.core.data.push.LiveSnapshot
import cx.lpm.mobile.core.data.session.MacSession
import cx.lpm.mobile.core.data.session.SessionState
import cx.lpm.mobile.core.data.terminals.TerminalsState
import cx.lpm.mobile.core.data.terminals.TerminalsStore
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

/**
 * The live link's half of the agents-at-work notification (iOS
 * `LiveActivityPublisher`): while the app talks to a Mac that offers live updates,
 * its agents as they change. Once the app is away the Mac pushes the same snapshots
 * itself, so a link that drops leaves the card alone.
 */
@Singleton
class LivePublisher @Inject constructor(
    private val session: MacSession,
    private val prefs: AppPreferences,
    private val live: LiveNotifier,
    @param:ApplicationScope private val scope: CoroutineScope
) {
    fun start() {
        scope.launch {
            combine(
                session.state,
                session.link.state,
                session.store<ProjectsStore>().state,
                session.store<TerminalsStore>().state,
                prefs.notificationPrefsFlow()
            ) { state, link, projects, terminals, notify ->
                reading(state, link, projects, terminals, notify, session.client)
            }
                // A gap (switched off, a link that came back) shows the same card again.
                .distinctUntilChanged()
                .collectLatest { reading ->
                    val (macId, snapshot) = reading ?: return@collectLatest
                    // Settled for a second first, so a burst of status changes is one update.
                    delay(SETTLE_MS)
                    live.show(macId, snapshot, appOnScreen())
                }
        }
        scope.launch {
            prefs.notificationPrefsFlow()
                .map { it.liveActivity }
                .distinctUntilChanged()
                .drop(1)
                .collect { on -> if (!on) live.removeAll() }
        }
    }

    private companion object {
        const val SETTLE_MS = 1_000L
    }
}

/**
 * The live Mac's agents keyed by its id; null while what the app holds isn't the
 * Mac's live list (a saved copy, a pairing, a link that's down), in Demo Mode, or
 * when the Mac can't take over once the app is away.
 */
internal fun reading(
    state: SessionState,
    link: LinkState,
    projects: ProjectsState,
    terminals: TerminalsState,
    notify: NotificationPrefs,
    client: LpmClient?
): Pair<String, LiveSnapshot>? {
    if (!notify.liveActivity || !state.isReady || state.demoMode || !projects.projectsLoaded ||
        link.listAsOf != null || link.pairing
    ) {
        return null
    }
    val record = state.activeRecord?.takeIf { it.via == null } ?: return null
    if (client?.hostFeatures?.contains(LpmClient.LIVE_ACTIVITY_FEATURE) != true) return null
    val snapshot = LiveSnapshot.of(
        record.serverId,
        projects.projects,
        terminals.terminalTitles,
        System.currentTimeMillis()
    )
    return record.widgetId to snapshot
}
