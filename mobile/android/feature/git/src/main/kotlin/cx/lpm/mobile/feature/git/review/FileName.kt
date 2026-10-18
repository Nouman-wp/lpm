package cx.lpm.mobile.feature.git.review

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import cx.lpm.mobile.core.designsystem.theme.LpmTheme
import cx.lpm.mobile.core.model.GitFile

/** The file's name: what follows the last slash. */
internal val GitFile.name: String get() = lastPathComponent(path)

/** The folder the file is in, empty at the repository's root. */
internal val GitFile.directory: String
    get() = path.trimEnd('/').substringBeforeLast('/', missingDelimiterValue = "")

/** A file's name over its folder, the name carrying the weight. */
@Composable
internal fun FileName(file: GitFile, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(1.dp)) {
        Text(
            text = file.name,
            style = LpmTheme.typography.subheadline.copy(fontWeight = FontWeight.SemiBold),
            color = LpmTheme.colors.label,
            maxLines = 1,
            overflow = TextOverflow.MiddleEllipsis
        )
        if (file.directory.isNotEmpty()) {
            Text(
                text = file.directory,
                style = LpmTheme.typography.caption1,
                color = LpmTheme.colors.secondaryLabel,
                maxLines = 1,
                overflow = TextOverflow.StartEllipsis
            )
        }
    }
}
