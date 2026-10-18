package cx.lpm.mobile.feature.projects.resume

import androidx.compose.foundation.layout.RowScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import cx.lpm.mobile.core.model.SessionKey
import cx.lpm.mobile.core.model.TerminalInfo

/**
 * The Resume Session list wired to its ViewModel. A pick takes the sheet holding it
 * away ([dismiss]), then opens the tab already holding the conversation, or the new
 * one it continues in once it's there ([onOpen]).
 */
@Composable
internal fun ResumeSessionPage(
    project: String,
    session: SessionKey,
    dismiss: (then: () -> Unit) -> Unit,
    onOpen: (TerminalInfo) -> Unit,
    modifier: Modifier = Modifier,
    leading: @Composable RowScope.() -> Unit = {},
    viewModel: ResumeSessionViewModel =
        hiltViewModel<ResumeSessionViewModel, ResumeSessionViewModel.Factory>(
            creationCallback = { it.create(project, session) }
        )
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val haptics = LocalHapticFeedback.current
    LaunchedEffect(viewModel) { viewModel.onAppear() }
    ResumeSessionList(
        state = state,
        modifier = modifier,
        leading = leading,
        actions = ResumeSessionActions(
            search = viewModel::setQuery,
            filter = viewModel::setFilter,
            open = { picked ->
                haptics.performHapticFeedback(HapticFeedbackType.ContextClick)
                val tab = viewModel.open(picked, onOpen)
                dismiss { tab?.let(onOpen) }
            },
            older = viewModel::loadOlder,
            retry = viewModel::retry
        )
    )
}
