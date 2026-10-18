package cx.lpm.mobile.feature.projects.resume

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import cx.lpm.mobile.core.designsystem.component.GlassCapsuleButton
import cx.lpm.mobile.core.designsystem.component.ModalSheet
import cx.lpm.mobile.core.designsystem.component.rememberModalSheetState
import cx.lpm.mobile.core.designsystem.theme.AppAppearance
import cx.lpm.mobile.core.model.SessionKey
import cx.lpm.mobile.core.model.TerminalInfo
import cx.lpm.mobile.core.navigation.PresentationScope
import cx.lpm.mobile.feature.projects.R

/**
 * Resume Session on its own, from the project's "…" menu (iOS `ResumeSessionSheet`).
 * [onOpen] opens the tab a pick lands in.
 */
@Composable
fun ResumeSessionSheet(
    project: String,
    session: SessionKey,
    onOpen: (TerminalInfo) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    // A sheet that sets no color scheme of its own takes the app's, not the terminal's.
    PresentationScope {
        AppAppearance {
            val sheet = rememberModalSheetState()
            ModalSheet(onDismissRequest = onDismiss, modifier = modifier, state = sheet) {
                ResumeSessionPage(
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
                        GlassCapsuleButton(
                            text = stringResource(R.string.cancel),
                            onClick = { sheet.dismiss(onDismiss) }
                        )
                    }
                )
            }
        }
    }
}
