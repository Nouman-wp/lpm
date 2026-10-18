package cx.lpm.mobile.feature.projects.newtab

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import cx.lpm.mobile.core.designsystem.R as DesignR
import cx.lpm.mobile.core.designsystem.component.GlassIconButton
import cx.lpm.mobile.core.designsystem.component.ModalSheet
import cx.lpm.mobile.core.designsystem.component.rememberModalSheetState
import cx.lpm.mobile.core.model.SessionKey
import cx.lpm.mobile.core.model.TerminalInfo
import cx.lpm.mobile.core.navigation.PresentationScope
import cx.lpm.mobile.core.navigation.SheetStack
import cx.lpm.mobile.core.navigation.rememberSheetNavigator
import cx.lpm.mobile.feature.projects.R
import cx.lpm.mobile.feature.projects.resume.ResumeSessionPage

/** A page of the New Tab sheet: the form, or Resume Session pushed from it. */
private enum class NewTabPage { Form, Resume }

/**
 * What a new tab starts with (iOS `NewTabSheet`), at the medium detent until an agent
 * brings its model and prompt rows. [onOpen] opens the tab once the Mac has it.
 */
@Composable
fun NewTabSheet(
    project: String,
    session: SessionKey,
    onOpen: (TerminalInfo) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    PresentationScope { NewTabContent(project, session, onOpen, onDismiss, modifier) }
}

@Composable
private fun NewTabContent(
    project: String,
    session: SessionKey,
    onOpen: (TerminalInfo) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: NewTabViewModel = hiltViewModel<NewTabViewModel, NewTabViewModel.Factory>(
        creationCallback = { it.create(project, session) }
    )
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    // A remembered agent opens the sheet at the large detent, as its rows need the room.
    val sheet = rememberModalSheetState(medium = remember { state.pick.agent.isEmpty() })
    val pages = rememberSheetNavigator(NewTabPage.Form)
    val haptics = LocalHapticFeedback.current
    LaunchedEffect(viewModel) { viewModel.onAppear() }
    // An agent brings its model and prompt rows, and the list its sessions, so the
    // sheet makes room for them.
    val tall = state.pick.agent.isNotEmpty() || pages.current == NewTabPage.Resume
    LaunchedEffect(tall) { if (tall) sheet.expand() }
    ModalSheet(onDismissRequest = onDismiss, modifier = modifier, state = sheet) {
        SheetStack(pages) { page ->
            when (page) {
                NewTabPage.Form -> NewTabForm(
                    state = state,
                    actions = NewTabActions(
                        cancel = { sheet.dismiss(onDismiss) },
                        open = {
                            haptics.performHapticFeedback(HapticFeedbackType.ContextClick)
                            viewModel.open(onOpen)
                            sheet.dismiss(onDismiss)
                        },
                        pickShell = viewModel::pickShell,
                        pickAgent = viewModel::pickAgent,
                        chooseModel = viewModel::chooseModel,
                        chooseEffort = viewModel::chooseEffort,
                        setPrompt = viewModel::setPrompt,
                        resume = { pages.push(NewTabPage.Resume) }
                    )
                )

                NewTabPage.Resume -> ResumeSessionPage(
                    project = project,
                    session = session,
                    dismiss = { then ->
                        sheet.dismiss {
                            onDismiss()
                            then()
                        }
                    },
                    onOpen = onOpen,
                    leading = {
                        GlassIconButton(
                            icon = painterResource(DesignR.drawable.ic_arrow_back_ios_new),
                            contentDescription = stringResource(R.string.back),
                            onClick = pages::back
                        )
                    }
                )
            }
        }
    }
}
