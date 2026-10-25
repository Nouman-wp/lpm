package cx.lpm.mobile.core.demo

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters

// The desktop demo's sample week (desktop/frontend/src/demo/seed/sample/recap.ts):
// agent minutes and prompts per day, Monday first, Sunday off.
private val RecapMinutes = listOf(352L, 418L, 296L, 389L, 241L, 184L, 0L)
private val RecapPrompts = listOf(38L, 41L, 33L, 36L, 29L, 37L, 0L)
private val RecapProjects = listOf(
    "saas-app" to 0.41,
    "auth-service" to 0.24,
    "docs-site" to 0.16,
    "ml-pipeline" to 0.12,
    "mobile-app" to 0.07
)
private const val MINUTE_MS = 60_000L
private const val HOUR_MS = 60 * MINUTE_MS

/** Demo handler for the Weekly recap screen: the same sample week, last week or this one. */
internal fun DemoServer.registerRecapHandlers() {
    register("weeklyRecap") { o ->
        val week = if (o.string("week") == "this") "this" else "last"
        pushAfter(0.6) {
            mapOf("t" to "weeklyRecap", "ok" to true, "week" to week, "recap" to recapPayload(week))
        }
    }
}

/** The week starts on the Monday of last week, or of this one with the days to come empty. */
private fun DemoServer.recapPayload(week: String): Dict {
    val today = LocalDate.now(clock)
    val monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        .let { if (week == "this") it else it.minusWeeks(1) }
    val days = RecapMinutes.indices.map { i ->
        val date = monday.plusDays(i.toLong())
        val counts = week == "last" || !date.isAfter(today)
        mapOf(
            "date" to date.toString(),
            "agentMs" to if (counts) RecapMinutes[i] * MINUTE_MS else 0L,
            "prompts" to if (counts) RecapPrompts[i] else 0L
        )
    }
    val total = RecapMinutes.sum() * MINUTE_MS
    return mapOf(
        "week" to monday.toString(),
        "days" to days,
        "previousAgentMs" to total - 7 * HOUR_MS,
        "sessions" to 58,
        "projects" to RecapProjects.map { (name, share) ->
            mapOf("name" to name, "agentMs" to Math.round(total * share))
        },
        "agents" to listOf(
            mapOf("name" to "claude", "agentMs" to Math.round(total * 0.64)),
            mapOf("name" to "codex", "agentMs" to Math.round(total * 0.36))
        ),
        "workedRepos" to listOf("auth-service", "ml-pipeline", "mobile-app", "saas-app")
            .map { "github.com/acme/$it" },
        "linesAdded" to 6_120,
        "linesRemoved" to 2_407
    )
}
