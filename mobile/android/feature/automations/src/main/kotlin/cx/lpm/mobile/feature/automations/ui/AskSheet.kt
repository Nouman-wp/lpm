package cx.lpm.mobile.feature.automations.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import cx.lpm.mobile.core.designsystem.R
import cx.lpm.mobile.core.designsystem.component.PlainTextField
import cx.lpm.mobile.core.designsystem.component.clickableNoIndication
import cx.lpm.mobile.core.designsystem.theme.LpmTheme

// The answer card's action sheet (iOS `AutomationAskCard`'s sheet and row).

private val SheetShape = RoundedCornerShape(14.dp)

@Composable
internal fun AnswerBox(
    value: String,
    placeholder: String,
    onValueChange: (String) -> Unit,
    fill: Color,
    modifier: Modifier = Modifier,
    minLines: Int = 1,
    maxLines: Int = 4
) {
    PlainTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = placeholder,
        minLines = minLines,
        maxLines = maxLines,
        modifier = modifier
            .fillMaxWidth()
            .background(fill, SheetShape)
            .padding(horizontal = 14.dp, vertical = 13.dp)
    )
}

/** Rows on one rounded fill, split by hairlines — the action sheet's look. */
@Composable
internal fun Sheet(
    fill: Color,
    modifier: Modifier = Modifier,
    rows: @Composable ColumnScope.() -> Unit
) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(SheetShape)
            .background(fill),
        content = rows
    )
}

@Composable
internal fun SheetDivider() {
    HorizontalDivider(thickness = 0.5.dp, color = LpmTheme.colors.separator)
}

@Composable
internal fun SheetRow(
    text: String,
    detail: String = "",
    bold: Boolean = false,
    picked: Boolean = false,
    enabled: Boolean = true,
    busy: Boolean = false,
    role: Role = Role.Button,
    onClick: () -> Unit
) {
    val colors = LpmTheme.colors
    val haptics = LocalHapticFeedback.current
    Box(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 50.dp)
            .background(if (picked) colors.tint.copy(alpha = 0.14f) else Color.Transparent)
            .semantics(mergeDescendants = true) { selected = picked }
            .clickableNoIndication(
                onClick = {
                    haptics.performHapticFeedback(HapticFeedbackType.ContextClick)
                    onClick()
                },
                enabled = enabled && !busy,
                role = role
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            Modifier.padding(horizontal = 36.dp, vertical = if (detail.isEmpty()) 0.dp else 6.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(
                text = text,
                style = LpmTheme.typography.body.copy(
                    fontWeight = if (bold) FontWeight.SemiBold else FontWeight.Normal
                ),
                color = if (enabled) colors.tint else colors.secondaryLabel,
                textAlign = TextAlign.Center
            )
            if (detail.isNotEmpty()) {
                Text(
                    text = detail,
                    style = LpmTheme.typography.caption1,
                    color = colors.secondaryLabel,
                    textAlign = TextAlign.Center
                )
            }
        }
        if (picked) {
            Icon(
                painter = painterResource(R.drawable.ic_check),
                contentDescription = null,
                tint = colors.tint,
                modifier = Modifier
                    .align(Alignment.CenterEnd)
                    .padding(end = 14.dp)
                    .size(18.dp)
            )
        }
    }
}
