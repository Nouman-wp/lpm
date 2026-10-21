package cx.lpm.mobile.core.model

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AutomationAskTest {
    private val ask = AutomationAsk.parse(
        Json.parseToJsonElement(
            """
            {"id": "a1", "askedAt": 100, "status": "open", "project": "blog",
             "questions": [
               {"id": "q1", "type": "confirm", "text": "Deploy?", "yes": "Ship"},
               {"id": "q2", "type": "choice", "text": "Region?", "other": true,
                "options": [{"label": "us"}, {"label": "eu", "description": "Frankfurt"}]},
               {"id": "q3", "type": "rating", "text": "How was it?", "optional": true}
             ]}
            """
        )
    )!!

    @Test
    fun readsTheQuestionsAnUnknownTypeIncluded() {
        assertTrue(ask.isOpen)
        assertEquals("blog", ask.project)
        assertEquals(listOf("confirm", "choice", "rating"), ask.questions.map { it.type })
        assertEquals("Frankfurt", ask.questions[1].options[1].description)
        assertEquals("Deploy? (+2 more)", ask.summary)
        assertFalse(ask.answersOnTap)
        assertNull(AutomationAsk.parse(JsonPrimitive("x")))
    }

    @Test
    fun collectsTheAnswersAndNamesTheFirstMissing() {
        val (answers, missing) = automationAskAnswers(
            ask.questions,
            mapOf(
                "q1" to AutomationAskDraft(picks = listOf("no")),
                "q2" to AutomationAskDraft(other = " ap-south ")
            )
        )
        assertEquals(
            Json.parseToJsonElement("""{"q1": false, "q2": ["ap-south"]}""").jsonObject,
            answers
        )
        assertNull(missing)
        assertEquals("q1", automationAskAnswers(ask.questions, emptyMap()).second?.id)
    }

    @Test
    fun picksOneAtATimeUnlessSeveralAreAllowed() {
        val q = ask.questions[1]
        val one = automationAskToggle(q, AutomationAskDraft(other = "x"), "us")
        assertEquals(AutomationAskDraft(picks = listOf("eu")), automationAskToggle(q, one, "eu"))
        val many = q.copy(multiple = true)
        assertEquals(
            listOf("us", "eu"),
            automationAskToggle(
                many,
                automationAskToggle(many, AutomationAskDraft(), "us"),
                "eu"
            ).picks
        )
    }

    @Test
    fun readsAnswersByTheirLabels() {
        assertEquals("Ship", automationAskDisplay(ask.questions[0], JsonPrimitive(true)))
        assertEquals("No", automationAskDisplay(ask.questions[0], JsonPrimitive(false)))
        assertEquals("4", automationAskDisplay(ask.questions[2], JsonPrimitive(4)))
    }

    @Test
    fun tellsADeadlineThatFallsBackToDefaults() {
        val open = ask.copy(questions = listOf(ask.questions[0]), expiresAt = 1000 + 3 * 3600)
        assertEquals("Expires in 3h", automationAskDeadline(open, 1000))
        val covered = open.copy(
            questions = listOf(ask.questions[0].copy(defaultAnswer = JsonPrimitive(false))),
            expiresAt = 1000 + 20 * 60
        )
        assertEquals("Uses the default in 20m", automationAskDeadline(covered, 1000))
    }
}
