package cx.lpm.mobile.feature.terminal

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import cx.lpm.mobile.core.designsystem.R as DesignR
import cx.lpm.mobile.core.designsystem.theme.LpmTheme
import cx.lpm.mobile.core.web.FindStep
import cx.lpm.mobile.core.web.TerminalWebController

/**
 * The bar across the top of a terminal while Find is open: the query, which match
 * is current out of how many, the previous and next match, and Done.
 */
@Composable
internal fun TerminalFindBar(
    query: String,
    onQueryChange: (String) -> Unit,
    controller: TerminalWebController,
    onDone: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = LpmTheme.colors
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    val summary = when {
        query.isEmpty() -> null

        controller.findCount > 0 ->
            stringResource(
                R.string.find_count,
                controller.findIndex.coerceAtLeast(0) + 1,
                controller.findCount
            )

        else -> stringResource(R.string.find_no_matches)
    }
    Row(
        modifier = modifier
            .padding(horizontal = 10.dp)
            .padding(top = 6.dp)
            .fillMaxWidth()
            .background(Color(0xF0303033), RoundedCornerShape(16.dp))
            .padding(start = 12.dp, end = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            painterResource(DesignR.drawable.ic_search),
            contentDescription = null,
            tint = colors.secondaryLabel,
            modifier = Modifier.size(18.dp)
        )
        Box(Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
            if (query.isEmpty()) {
                Text(
                    stringResource(R.string.find_placeholder),
                    style = LpmTheme.typography.body,
                    color = colors.tertiaryLabel
                )
            }
            BasicTextField(
                value = query,
                onValueChange = {
                    onQueryChange(it)
                    controller.find(it, FindStep.Type)
                },
                singleLine = true,
                textStyle = LpmTheme.typography.body.copy(color = colors.label),
                cursorBrush = SolidColor(colors.label),
                keyboardOptions = KeyboardOptions(
                    capitalization = KeyboardCapitalization.None,
                    autoCorrectEnabled = false,
                    imeAction = ImeAction.Search
                ),
                keyboardActions = KeyboardActions(onSearch = {
                    controller.find(query, FindStep.Next)
                }),
                modifier = Modifier.fillMaxWidth().focusRequester(focus)
            )
        }
        summary?.let {
            Text(
                it,
                style = LpmTheme.typography.footnote.copy(fontFeatureSettings = "tnum"),
                color = colors.secondaryLabel,
                maxLines = 1
            )
        }
        FindStepButton(DesignR.drawable.ic_keyboard_arrow_up, R.string.find_previous, controller) {
            controller.find(query, FindStep.Prev)
        }
        FindStepButton(DesignR.drawable.ic_keyboard_arrow_down, R.string.find_next, controller) {
            controller.find(query, FindStep.Next)
        }
        TextButton(onClick = onDone) {
            Text(
                stringResource(R.string.find_done),
                style = LpmTheme.typography.subheadline.copy(fontWeight = FontWeight.SemiBold),
                color = colors.blue
            )
        }
    }
}

@Composable
private fun FindStepButton(
    icon: Int,
    label: Int,
    controller: TerminalWebController,
    onClick: () -> Unit
) {
    IconButton(
        onClick = onClick,
        enabled = controller.findCount > 0,
        modifier = Modifier.size(36.dp)
    ) {
        Icon(
            painterResource(icon),
            contentDescription = stringResource(label),
            tint = LpmTheme.colors.label,
            modifier = Modifier
                .size(30.dp)
                .background(Color.White.copy(alpha = 0.1f), CircleShape)
                .padding(6.dp)
        )
    }
}
