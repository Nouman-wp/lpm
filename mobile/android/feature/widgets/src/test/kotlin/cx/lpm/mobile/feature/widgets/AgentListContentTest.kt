package cx.lpm.mobile.feature.widgets

import android.content.Context
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.testing.unit.runGlanceAppWidgetUnitTest
import androidx.glance.testing.unit.hasContentDescription
import androidx.glance.testing.unit.hasText
import androidx.glance.testing.unit.hasTextEqualTo
import androidx.test.core.app.ApplicationProvider
import cx.lpm.mobile.core.model.AgentState
import cx.lpm.mobile.core.model.AgentWidgetMac
import cx.lpm.mobile.core.model.AgentWidgetRow
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class AgentListContentTest {
    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val minute = 60_000L
    private val now = 10 * minute

    private fun row(title: String, state: AgentState, since: Long, until: Long? = null) =
        AgentWidgetRow(
            project = "storefront",
            key = title,
            terminalId = "t",
            title = title,
            state = state,
            since = since,
            until = until
        )

    private val agents = listOf(
        AgentWidgetMac(
            "mac",
            listOf(
                row("Migrate cart store", AgentState.NeedsYou, since = 0),
                row("Write e2e tests", AgentState.Working, since = 7 * minute),
                row("Cart badge", AgentState.Done, since = 0, until = 4 * minute)
            )
        )
    )

    private val quiet = listOf(
        AgentWidgetMac("mac", emptyList(), name = "MacBook Pro", seenAt = now - 2 * minute)
    )

    @Test
    fun `medium lists each tab with its state's mark and how long it has been at it`() =
        runGlanceAppWidgetUnitTest {
            setAppWidgetSize(DpSize(340.dp, 160.dp))
            setContext(context)
            provideComposable { AgentListContent(agents, now) }

            onNode(hasText("Agents")).assertExists()
            onNode(hasText("1 need you")).assertExists()
            onNode(hasContentDescription("1 working")).assertExists()
            onNode(hasText("1 done")).assertExists()
            onNode(hasText("Migrate cart store")).assertExists()
            onNode(hasText("10m")).assertExists()
            onNode(hasContentDescription("Write e2e tests")).assertExists()
            onNode(hasText("3m")).assertExists()
            onNode(hasText("Cart badge")).assertExists()
            onNode(hasText("4m")).assertExists()
        }

    @Test
    fun `small shows the count instead of the summary`() = runGlanceAppWidgetUnitTest {
        setAppWidgetSize(DpSize(160.dp, 160.dp))
        setContext(context)
        provideComposable { AgentListContent(agents, now) }

        onNode(hasTextEqualTo("3")).assertExists()
        onAllNodes(hasText("1 need you")).assertCountEquals(0)
    }

    @Test
    fun `with no Mac it asks to pair one`() = runGlanceAppWidgetUnitTest {
        setAppWidgetSize(DpSize(340.dp, 160.dp))
        setContext(context)
        provideComposable { AgentListContent(emptyList(), now) }

        onNode(hasText("Pair your Mac")).assertExists()
        onNode(hasText("Scan the code in lpm on your Mac to follow your agents from here."))
            .assertExists()
        onNode(hasText("Pair Mac")).assertExists()
    }

    @Test
    fun `medium with nothing running names the Mac and when it last heard from it`() =
        runGlanceAppWidgetUnitTest {
            setAppWidgetSize(DpSize(340.dp, 160.dp))
            setContext(context)
            provideComposable { AgentListContent(quiet, now) }

            onNode(hasText("All quiet")).assertExists()
            onNode(hasText("MacBook Pro")).assertExists()
            onNode(hasText("Updated 2m ago")).assertExists()
        }

    @Test
    fun `small with nothing running says where`() = runGlanceAppWidgetUnitTest {
        setAppWidgetSize(DpSize(160.dp, 160.dp))
        setContext(context)
        provideComposable {
            AgentListContent(quiet + AgentWidgetMac("studio", emptyList()), now)
        }

        onNode(hasText("Nothing running on your Macs")).assertExists()
        onAllNodes(hasText("Updated 2m ago")).assertCountEquals(0)
    }
}
