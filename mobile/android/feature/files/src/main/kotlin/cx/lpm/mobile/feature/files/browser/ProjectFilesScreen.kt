package cx.lpm.mobile.feature.files.browser

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.key
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import cx.lpm.mobile.core.designsystem.R as DesignR
import cx.lpm.mobile.core.designsystem.component.GlassIconButton
import cx.lpm.mobile.core.designsystem.component.ListDefaults
import cx.lpm.mobile.core.designsystem.component.ListSection
import cx.lpm.mobile.core.designsystem.component.ListSectionSpacing
import cx.lpm.mobile.core.designsystem.component.LpmTopBar
import cx.lpm.mobile.core.designsystem.component.SearchField
import cx.lpm.mobile.core.designsystem.theme.LpmTheme
import cx.lpm.mobile.core.model.projectPath
import cx.lpm.mobile.feature.files.R

/** What the Files screen's rows and bar do; paths are project-relative. */
@Immutable
class ProjectFilesActions(
    val back: () -> Unit = {},
    val search: (String) -> Unit = {},
    val openFolder: (String) -> Unit = {},
    val openFile: (String) -> Unit = {},
    val copy: (String) -> Unit = {},
    val retry: () -> Unit = {}
)

/**
 * One folder of the project (iOS `ProjectFilesScreen`): folders push another of these,
 * files open in the preview. Go to File searches the whole project from any folder.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProjectFilesScreen(
    state: ProjectFilesUiState,
    dir: String,
    refreshing: Boolean,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
    actions: ProjectFilesActions = ProjectFilesActions()
) {
    Column(
        modifier
            .fillMaxSize()
            .background(LpmTheme.colors.systemGroupedBackground)
    ) {
        LpmTopBar(
            title = state.folderName.ifEmpty { stringResource(R.string.files_title) },
            leading = {
                GlassIconButton(
                    icon = painterResource(DesignR.drawable.ic_arrow_back_ios_new),
                    contentDescription = stringResource(R.string.files_back),
                    onClick = actions.back
                )
            }
        )
        SearchField(
            query = state.query,
            onQueryChange = actions.search,
            placeholder = stringResource(R.string.files_go_to_file),
            modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 8.dp)
        )
        Box(
            Modifier
                .weight(1f)
                .fillMaxWidth()
        ) {
            if (state.search.isEmpty()) {
                PullToRefreshBox(
                    isRefreshing = refreshing,
                    onRefresh = onRefresh,
                    modifier = Modifier.fillMaxSize()
                ) {
                    FolderList(state, dir, actions)
                    FolderOverlay(state, actions.retry)
                }
            } else {
                GoToFileList(state, actions.openFile)
            }
        }
    }
}

@Composable
private fun FolderList(state: ProjectFilesUiState, dir: String, actions: ProjectFilesActions) {
    val entries = state.entries
    if (entries?.isEmpty() == true || (entries == null && state.error != null)) {
        // The pull to refresh still needs something to pull.
        LazyColumn(Modifier.fillMaxSize()) {}
        return
    }
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(top = ListDefaults.ContentTopPadding, bottom = 24.dp),
        userScrollEnabled = entries != null
    ) {
        item(key = "folder") {
            ListSection(spacing = ListSectionSpacing.Compact) {
                if (entries == null) {
                    FolderSkeletonWidths.forEach { FileRowSkeleton(it) }
                    return@ListSection
                }
                entries.forEach { entry ->
                    key(entry.name) {
                        val path = projectPath(dir, entry.name)
                        val root = state.root
                        ProjectFileRow(
                            entry = entry,
                            actions = FileRowActions(
                                open = {
                                    if (entry.dir) {
                                        actions.openFolder(
                                            path
                                        )
                                    } else {
                                        actions.openFile(path)
                                    }
                                },
                                copyPath = root?.let { { actions.copy(projectPath(it, path)) } },
                                copyRelativePath = { actions.copy(path) }
                            )
                        )
                    }
                }
            }
        }
    }
}

/** A failed folder with "Try Again", or an empty one. */
@Composable
private fun FolderOverlay(state: ProjectFilesUiState, onRetry: () -> Unit) {
    val error = state.error
    when {
        error != null -> FilesUnavailable(
            title = stringResource(R.string.files_folder_failed),
            icon = painterResource(DesignR.drawable.ic_warning),
            description = error,
            action = stringResource(R.string.files_try_again),
            onAction = onRetry
        )

        state.entries?.isEmpty() == true -> FilesUnavailable(
            title = stringResource(R.string.files_folder_empty),
            icon = painterResource(DesignR.drawable.ic_folder)
        )
    }
}

/** Go to File: the project's files whose path holds the query, or none. */
@Composable
private fun GoToFileList(state: ProjectFilesUiState, onOpen: (String) -> Unit) {
    val hits = state.hits
    if (hits?.isEmpty() == true) {
        FilesUnavailable(
            title = stringResource(R.string.files_no_results, state.search),
            icon = painterResource(DesignR.drawable.ic_search),
            description = stringResource(R.string.files_no_results_message)
        )
        return
    }
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(top = ListDefaults.ContentTopPadding, bottom = 24.dp),
        userScrollEnabled = hits != null
    ) {
        item(key = "hits") {
            ListSection(spacing = ListSectionSpacing.Compact) {
                if (hits == null) {
                    SearchSkeletonWidths.forEach { FileRowSkeleton(it) }
                    return@ListSection
                }
                hits.forEach { hit ->
                    key(hit.path) { GoToFileRow(hit.path, onOpen = { onOpen(hit.path) }) }
                }
            }
        }
    }
}
