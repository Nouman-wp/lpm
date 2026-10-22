package cx.lpm.mobile.feature.automations.format

import cx.lpm.mobile.core.model.AutomationMachine
import cx.lpm.mobile.feature.automations.editor.JobEditorDraft
import cx.lpm.mobile.feature.automations.editor.buildJob
import cx.lpm.mobile.feature.automations.editor.from
import cx.lpm.mobile.feature.automations.job
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AutomationMachinesTest {
    private val names = mapOf("a" to "Studio", "b" to "MacBook Pro")
    private val name = { id: String -> names[id] ?: id }

    @Test
    fun readsAListOrAWordEachOnceWithAnyLast() {
        val json = Json.parseToJsonElement("""["any","a"," b ","a","ANY"]""")
        assertEquals(listOf("a", "b", "any"), AutomationMachines.read(json))
        assertEquals(emptyList<String>(), AutomationMachines.read(null))
    }

    @Test
    fun togglingKeepsTheOrderAndTheLastComputer() {
        assertEquals(listOf("a", "b"), AutomationMachines.toggle(listOf("a"), "b"))
        assertEquals(listOf("a"), AutomationMachines.toggle(listOf("a"), "a"))
        assertEquals(listOf("any"), AutomationMachines.toggle(listOf("a", "any"), "a"))
        assertEquals(listOf("a", "any"), AutomationMachines.toggleAny(emptyList(), "a"))
        assertEquals(listOf("b"), AutomationMachines.toggleAny(listOf("b", "any"), "a"))
    }

    @Test
    fun saysWhoTakesItInOrder() {
        assertEquals("Only Studio runs it.", AutomationMachines.note(listOf("a"), name))
        assertEquals(
            "Studio runs it when it's on, otherwise MacBook Pro.",
            AutomationMachines.note(listOf("a", "b"), name)
        )
        assertEquals("Studio or MacBook Pro", AutomationMachines.summary(listOf("a", "b"), name))
        assertEquals("Any Mac", AutomationMachines.summary(listOf("a", "any"), name))
    }

    @Test
    fun aListedJobNamesThisMacOnlyWhenThereIsAnotherToName() {
        val here = AutomationMachine("a", "Studio", here = true)
        val other = AutomationMachine("b", "MacBook Pro", here = false)
        val job = job().copy(machines = listOf(here, other))
        assertEquals("This Mac or MacBook Pro", AutomationMachines.label(job, listOf(here, other)))
        assertNull(AutomationMachines.label(job().copy(machines = listOf(here)), listOf(here)))
        assertNull(AutomationMachines.label(job(), listOf(here, other)))
    }

    @Test
    fun theEditorWritesBackTheMachinesItRead() {
        val body = Json.parseToJsonElement(
            """{"label":"Daily","schedule":{"manual":true},"run":{"prompt":"hi"},"machines":["a","any"]}"""
        ) as JsonObject
        assertEquals(body["machines"], JobEditorDraft.from(body).buildJob(false)["machines"])
    }
}
