package cx.lpm.mobile.feature.projects.newtab

import cx.lpm.mobile.core.data.prefs.AppPreferences
import cx.lpm.mobile.core.data.prefs.PreferenceKeys
import cx.lpm.mobile.core.model.NewTabPick
import cx.lpm.mobile.core.model.asObject
import cx.lpm.mobile.core.model.string
import javax.inject.Inject
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * The New Tab sheet's memory, app-wide, as iOS keeps it: what it last started (iOS
 * `NewTabLastOption`, under `newTab.lastOption`) and a bare agent's model and effort
 * (JSON under `newTab.lastPick`).
 */
class NewTabPickMemory @Inject constructor(private val prefs: AppPreferences) {
    fun load(): NewTabPick {
        val raw = prefs.string(PreferenceKeys.NEW_TAB_LAST_PICK) ?: return NewTabPick()
        val o = runCatching { Json.parseToJsonElement(raw) }.getOrNull().asObject()
            ?: return NewTabPick()
        val agent = o.string("agent") ?: return NewTabPick()
        val model = o.string("model") ?: return NewTabPick()
        val effort = o.string("effort") ?: return NewTabPick()
        return NewTabPick(agent, model, effort)
    }

    fun save(pick: NewTabPick) {
        val json = buildJsonObject {
            put("agent", pick.agent)
            put("model", pick.model)
            put("effort", pick.effort)
        }
        prefs.setString(PreferenceKeys.NEW_TAB_LAST_PICK, json.toString())
    }

    /** An option's id, or [TERMINAL]. Before this was kept, the last agent picked stood for it. */
    fun loadOption(): String = prefs.string(PreferenceKeys.NEW_TAB_LAST_OPTION)
        ?: load().agent.ifEmpty { TERMINAL }

    fun saveOption(id: String) = prefs.setString(PreferenceKeys.NEW_TAB_LAST_OPTION, id)

    companion object {
        const val TERMINAL = "terminal"
    }
}
