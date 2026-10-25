package cx.lpm.mobile.feature.actions.button

import cx.lpm.mobile.core.model.Action

/** The label as the desktop writes it, emoji first. */
val Action.displayLabel: String get() = if (emoji.isEmpty()) label else "$emoji $label"
