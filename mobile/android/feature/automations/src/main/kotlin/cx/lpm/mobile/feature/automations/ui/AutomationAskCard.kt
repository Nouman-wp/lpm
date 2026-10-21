package cx.lpm.mobile.feature.automations.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import cx.lpm.mobile.core.designsystem.component.CapsuleButton
import cx.lpm.mobile.core.designsystem.component.LinkButton
import cx.lpm.mobile.core.designsystem.component.PlainTextField
import cx.lpm.mobile.core.designsystem.component.StatusDot
import cx.lpm.mobile.core.designsystem.component.clickableNoIndication
import cx.lpm.mobile.core.designsystem.theme.LpmTheme
import cx.lpm.mobile.core.model.AutomationAsk
import cx.lpm.mobile.core.model.AutomationAskDraft
import cx.lpm.mobile.core.model.AutomationAskOption
import cx.lpm.mobile.core.model.AutomationAskQuestion
import cx.lpm.mobile.core.model.automationAskAnswers
import cx.lpm.mobile.core.model.automationAskDeadline
import cx.lpm.mobile.core.model.automationAskDisplay
import cx.lpm.mobile.core.model.automationAskToggle
import cx.lpm.mobile.feature.automations.R
import cx.lpm.mobile.feature.automations.format.AutomationTone
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * A question an automation put to the user (iOS `AutomationAskCard`): the form to
 * answer it while it is open, then what became of it. [framed] draws its own card,
 * for the conversation; in a list the row is the frame.
 */
@Composable
fun AutomationAskCard(
    ask: AutomationAsk,
    /** "Expires in 3h", or the time it was asked or settled. */
    whenText: String,
    busy: Boolean,
    error: String?,
    onAnswer: (JsonObject) -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier,
    framed: Boolean = true
) {
    val tint = if (ask.isOpen) AutomationTone.Orange.color() else LpmTheme.colors.secondaryLabel
    val shape = RoundedCornerShape(16.dp)
    val frame = if (framed) {
        Modifier
            .background(tint.copy(alpha = if (ask.isOpen) 0.08f else 0f), shape)
            .border(1.dp, tint.copy(alpha = if (ask.isOpen) 0.5f else 0.25f), shape)
            .padding(14.dp)
    } else {
        Modifier.padding(vertical = 4.dp)
    }
    Column(modifier.fillMaxWidth().then(frame), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(7.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            StatusDot(color = tint, size = 7.dp)
            Text(
                text = ask.statusLabel,
                style = LpmTheme.typography.caption1.copy(fontWeight = FontWeight.SemiBold),
                color = if (ask.isOpen) tint else LpmTheme.colors.secondaryLabel,
                modifier = Modifier.weight(1f)
            )
            Text(
                whenText,
                style = LpmTheme.typography.caption1,
                color = LpmTheme.colors.secondaryLabel
            )
        }
        if (ask.isOpen) {
            AskForm(ask, busy, error, onAnswer, onDismiss)
        } else {
            AskSummary(ask)
        }
    }
}

/** What the card's corner says: the deadline while open, else when it was asked or settled. */
fun automationAskWhen(ask: AutomationAsk, nowSecs: Long, clock: (Long) -> String): String =
    if (ask.isOpen) {
        automationAskDeadline(ask, nowSecs).ifEmpty { clock(ask.askedAt) }
    } else {
        clock(ask.answeredAt ?: ask.askedAt)
    }

@Composable
private fun AskForm(
    ask: AutomationAsk,
    busy: Boolean,
    error: String?,
    onAnswer: (JsonObject) -> Unit,
    onDismiss: () -> Unit
) {
    var drafts by remember(ask.id) { mutableStateOf(mapOf<String, AutomationAskDraft>()) }
    val (answers, missing) = automationAskAnswers(ask.questions, drafts)
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        ask.questions.forEach { q ->
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    text = q.text,
                    style = LpmTheme.typography.subheadline.copy(fontWeight = FontWeight.SemiBold)
                )
                q.defaultAnswer?.let {
                    Text(
                        text = stringResource(R.string.ask_default, automationAskDisplay(q, it)),
                        style = LpmTheme.typography.caption1,
                        color = LpmTheme.colors.secondaryLabel
                    )
                }
                AskField(
                    q,
                    draft = drafts[q.id] ?: AutomationAskDraft(),
                    onChange = { drafts = drafts + (q.id to it) },
                    onTapAnswer = if (ask.answersOnTap) {
                        { yes -> onAnswer(JsonObject(mapOf(q.id to JsonPrimitive(yes)))) }
                    } else {
                        null
                    },
                    busy = busy
                )
            }
        }
        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = error.orEmpty(),
                style = LpmTheme.typography.caption1,
                color = LpmTheme.colors.red,
                modifier = Modifier.weight(1f)
            )
            LinkButton(
                text = stringResource(R.string.ask_dismiss),
                onClick = onDismiss,
                enabled = !busy,
                color = LpmTheme.colors.secondaryLabel
            )
            if (!ask.answersOnTap) {
                CapsuleButton(
                    text = stringResource(R.string.ask_send),
                    onClick = { onAnswer(answers) },
                    prominent = true,
                    enabled = !busy && missing == null
                )
            }
        }
    }
}

@Composable
private fun AskField(
    q: AutomationAskQuestion,
    draft: AutomationAskDraft,
    onChange: (AutomationAskDraft) -> Unit,
    onTapAnswer: ((Boolean) -> Unit)?,
    busy: Boolean
) {
    when (q.type) {
        "confirm" -> FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            for ((value, label) in listOf("yes" to q.yesLabel, "no" to q.noLabel)) {
                val picked = draft.picks.firstOrNull() == value
                CapsuleButton(
                    text = label,
                    onClick = {
                        if (onTapAnswer != null) {
                            onTapAnswer(value == "yes")
                        } else {
                            onChange(draft.copy(picks = if (picked) emptyList() else listOf(value)))
                        }
                    },
                    prominent = picked,
                    enabled = !busy,
                    modifier = Modifier.widthIn(min = 72.dp)
                )
            }
        }

        "choice" -> Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            q.options.forEach { option ->
                ChoiceRow(q, option, picked = option.label in draft.picks, busy = busy) {
                    onChange(automationAskToggle(q, draft, option.label))
                }
            }
            if (q.other) {
                AnswerBox(
                    value = draft.other,
                    placeholder = stringResource(R.string.ask_other),
                    onValueChange = { value ->
                        val picks = if (!q.multiple &&
                            value.isNotEmpty()
                        ) {
                            emptyList()
                        } else {
                            draft.picks
                        }
                        onChange(draft.copy(other = value, picks = picks))
                    }
                )
            }
        }

        else -> AnswerBox(
            value = draft.text,
            placeholder = q.placeholder.ifEmpty { stringResource(R.string.ask_your_answer) },
            onValueChange = { onChange(draft.copy(text = it)) },
            minLines = if (q.multiline) 3 else 1,
            maxLines = if (q.multiline) 8 else 4
        )
    }
}

@Composable
private fun ChoiceRow(
    q: AutomationAskQuestion,
    option: AutomationAskOption,
    picked: Boolean,
    busy: Boolean,
    onToggle: () -> Unit
) {
    val tint = LpmTheme.colors.tint
    val markShape = if (q.multiple) RoundedCornerShape(4.dp) else CircleShape
    Row(
        Modifier
            .fillMaxWidth()
            .border(
                1.dp,
                if (picked) tint else LpmTheme.colors.secondaryLabel.copy(alpha = 0.3f),
                RoundedCornerShape(10.dp)
            )
            .semantics(mergeDescendants = true) { selected = picked }
            .clickableNoIndication(
                onClick = onToggle,
                enabled = !busy,
                role = if (q.multiple) Role.Checkbox else Role.RadioButton
            )
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Spacer(
            Modifier
                .padding(top = 2.dp)
                .size(16.dp)
                .then(
                    if (picked) {
                        Modifier.background(tint, markShape)
                    } else {
                        Modifier.border(1.5.dp, LpmTheme.colors.secondaryLabel, markShape)
                    }
                )
        )
        Column(Modifier.weight(1f)) {
            Text(option.label, style = LpmTheme.typography.body)
            if (option.description.isNotEmpty()) {
                Text(
                    option.description,
                    style = LpmTheme.typography.caption1,
                    color = LpmTheme.colors.secondaryLabel
                )
            }
        }
    }
}

@Composable
private fun AnswerBox(
    value: String,
    placeholder: String,
    onValueChange: (String) -> Unit,
    minLines: Int = 1,
    maxLines: Int = 4
) {
    PlainTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = placeholder,
        minLines = minLines,
        maxLines = maxLines,
        modifier = Modifier
            .fillMaxWidth()
            .background(LpmTheme.colors.secondarySystemGroupedBackground, RoundedCornerShape(8.dp))
            .border(1.dp, LpmTheme.colors.separator, RoundedCornerShape(8.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp)
    )
}

@Composable
private fun AskSummary(ask: AutomationAsk) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        ask.questions.forEach { q ->
            val answer = automationAskDisplay(q, ask.answers[q.id])
            Text(
                text = buildAnnotatedString {
                    withStyle(SpanStyle(color = LpmTheme.colors.secondaryLabel)) { append(q.text) }
                    if (answer.isNotEmpty()) {
                        append(" → ")
                        withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(answer) }
                    }
                },
                style = LpmTheme.typography.subheadline
            )
        }
    }
}
