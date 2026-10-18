package cx.lpm.mobile.core.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.graphics.Color
import cx.lpm.mobile.core.designsystem.theme.LpmTheme

/** How a provider is named and colored (the desktop's `providerMeta` in statsDerive.ts). */
@Immutable
data class ProviderMeta(val label: String, val short: String, val color: Color?)

private val ClaudeColor = Color(0xFFD97757)
private val CodexColor = Color(0xFF10A37F)

/** Display metadata for a provider key; unknown keys fall back to the raw key, muted. */
fun providerMeta(key: String): ProviderMeta = when (key) {
    "claude" -> ProviderMeta("Claude Code", "Claude", ClaudeColor)
    "codex" -> ProviderMeta("Codex", "Codex", CodexColor)
    else -> ProviderMeta(key, key, null)
}

/** A provider's dot and bar color; an unknown one is drawn in the secondary label color. */
val ProviderMeta.tint: Color
    @Composable @ReadOnlyComposable
    get() = color ?: LpmTheme.colors.secondaryLabel
