package cx.lpm.mobile.feature.automations.format

import cx.lpm.mobile.core.model.AutomationJob
import cx.lpm.mobile.core.model.AutomationMachine
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/**
 * An automation's `machines:` list — hostIds, best first, with "any" last for any
 * other computer that's on — and the words for it (iOS `AutomationMachines`).
 */
object AutomationMachines {
    const val ANY = "any"

    fun read(value: JsonElement?): List<String> {
        val raw = when (value) {
            is JsonArray -> value.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }
            is JsonPrimitive -> listOfNotNull(value.contentOrNull)
            else -> emptyList()
        }
        val ids = mutableListOf<String>()
        for (item in raw) {
            val text = item.trim()
            val id = if (text.equals(ANY, ignoreCase = true)) ANY else text
            if (id.isNotEmpty() && id !in ids) ids += id
        }
        return if (ANY in ids) listed(ids) + ANY else ids
    }

    fun listed(ids: List<String>): List<String> = ids.filter { it != ANY }

    fun runsOnAny(ids: List<String>): Boolean = ANY in ids

    /** A computer joins after the ones listed; the last can go only while any other may run it. */
    fun toggle(ids: List<String>, id: String): List<String> {
        val listed = listed(ids)
        val next = if (id in listed) listed - id else listed + id
        if (next.isEmpty() && !runsOnAny(ids)) return ids
        return if (runsOnAny(ids)) next + ANY else next
    }

    fun toggleAny(ids: List<String>, fallback: String): List<String> {
        val kept = listed(ids).ifEmpty { listOf(fallback) }
        return if (runsOnAny(ids)) kept else kept + ANY
    }

    fun note(ids: List<String>, name: (String) -> String): String {
        val names = listed(ids).map(name)
        val inOrder = names.joinToString(", then ")
        val after = names.drop(1).joinToString(", then ")
        return when {
            ids.isEmpty() -> "Every Mac that has it runs it, each on its own."
            runsOnAny(ids) && names.isEmpty() -> "One Mac that has it and is on runs it."
            runsOnAny(ids) -> "$inOrder runs it when it's on, otherwise another Mac that has it."
            names.size == 1 -> "Only ${names[0]} runs it."
            else -> "${names[0]} runs it when it's on, otherwise $after."
        }
    }

    fun summary(ids: List<String>, name: (String) -> String): String {
        if (ids.isEmpty()) return "Every Mac"
        if (runsOnAny(ids)) return "Any Mac"
        val names = listed(ids).map(name)
        return when (names.size) {
            1 -> names[0]
            2 -> "${names[0]} or ${names[1]}"
            else -> "${names.size} Macs"
        }
    }

    /**
     * Where a listed automation runs, as the desktop's list says it: null for one every
     * computer runs, or while this Mac has no other computer to name.
     */
    fun label(job: AutomationJob, choices: List<AutomationMachine>): String? {
        if (job.machines.isEmpty() && !job.anyMachine) return null
        if (choices.size <= 1 && job.machines.all { it.here }) return null
        val ids = job.machines.map { it.id } + if (job.anyMachine) listOf(ANY) else emptyList()
        return summary(ids) { id ->
            val m = job.machines.firstOrNull { it.id == id }
            when {
                m == null -> "Another Mac"
                m.here -> "This Mac"
                else -> m.name.ifEmpty { "Another Mac" }
            }
        }
    }
}
