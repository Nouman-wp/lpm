package cx.lpm.mobile.feature.projects.newtab

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cx.lpm.mobile.core.data.agents.AgentLaunchStore
import cx.lpm.mobile.core.data.projects.ProjectsStore
import cx.lpm.mobile.core.data.session.MacSession
import cx.lpm.mobile.core.data.session.MacSessions
import cx.lpm.mobile.core.model.AgentLaunch
import cx.lpm.mobile.core.model.AgentModelOption
import cx.lpm.mobile.core.model.AgentOption
import cx.lpm.mobile.core.model.NewTabPick
import cx.lpm.mobile.core.model.SessionKey
import cx.lpm.mobile.core.model.TerminalInfo
import cx.lpm.mobile.core.model.trimmingWhitespace
import dagger.assisted.Assisted
import dagger.assisted.AssistedFactory
import dagger.assisted.AssistedInject
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class NewTabUiState(
    /** What the Mac can start; null until it answers. */
    val options: List<AgentOption>? = null,
    val pick: NewTabPick = NewTabPick(),
    val prompt: String = "",
    /** "Resume a Past Session…" shows: the Mac lists them and the project isn't on SSH. */
    val canResume: Boolean = false
) {
    val agent: AgentOption? get() = options?.firstOrNull { it.id == pick.agent }
    val model: AgentModelOption? get() = agent?.models?.firstOrNull { it.value == pick.model }

    /** A remembered agent can't show as picked until the Mac says it still offers it. */
    val awaitingOptions: Boolean get() = options == null && pick.agent.isNotEmpty()
}

/**
 * The New Tab sheet (iOS `NewTabSheet`): a plain shell or one of the agents the Mac can
 * start, with its model, effort and a first prompt. The pick (not the prompt) is
 * remembered for next time.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel(assistedFactory = NewTabViewModel.Factory::class)
class NewTabViewModel @AssistedInject constructor(
    @Assisted private val project: String,
    @Assisted private val sessionKey: SessionKey,
    private val sessions: MacSessions,
    private val memory: NewTabPickMemory
) : ViewModel() {
    private val pick = MutableStateFlow(memory.load())
    private val prompt = MutableStateFlow("")
    private val store: AgentLaunchStore? get() = sessions[sessionKey]?.store()

    val uiState: StateFlow<NewTabUiState> = sessions.session(sessionKey)
        .flatMapLatest { s -> s?.let(::newTabState) ?: flowOf(NewTabUiState(pick = pick.value)) }
        .stateIn(
            viewModelScope,
            SharingStarted.WhileSubscribed(5_000),
            NewTabUiState(pick = pick.value)
        )

    init {
        // A pick the Mac no longer offers falls back as soon as it says what it offers.
        viewModelScope.launch {
            sessions.session(sessionKey)
                .flatMapLatest { s -> s?.store<AgentLaunchStore>()?.state ?: flowOf(null) }
                .map { it?.options }
                .filterNotNull()
                .distinctUntilChanged()
                .collect { options -> pick.update { it.resolved(options) } }
        }
    }

    private fun newTabState(s: MacSession) = combine(
        s.store<AgentLaunchStore>().state,
        s.store<ProjectsStore>().state,
        pick,
        prompt
    ) { launch, projects, pick, prompt ->
        val live = projects.project(project)
        NewTabUiState(
            options = launch.options,
            pick = pick,
            prompt = prompt,
            canResume = live != null && s.store<AgentLaunchStore>().canResumeSessions(live)
        )
    }

    /** The sheet came up: ask what the Mac can start now. */
    fun onAppear() {
        store?.loadOptions()
    }

    fun pickShell() {
        pick.value = NewTabPick()
    }

    fun pickAgent(option: AgentOption) {
        if (pick.value.agent == option.id) return
        pick.value = NewTabPick(option.id).choosing("", "", option)
    }

    fun chooseModel(value: String) {
        val agent = uiState.value.agent ?: return
        pick.update { it.choosing(value, it.effort, agent) }
    }

    fun chooseEffort(value: String) {
        pick.update { it.copy(effort = value) }
    }

    fun setPrompt(text: String) {
        prompt.value = text
    }

    /** Open the tab: the pick is remembered, and [onSpawn] opens the tab once it's there. */
    fun open(onSpawn: (TerminalInfo) -> Unit) {
        val picked = pick.value.resolved(uiState.value.options.orEmpty())
        memory.save(picked)
        val launch = AgentLaunch(
            agent = picked.agent,
            model = picked.model,
            effort = picked.effort,
            prompt = if (picked.agent.isEmpty()) "" else prompt.value.trimmingWhitespace()
        )
        store?.newTerminal(project, launch, onSpawn)
    }

    @AssistedFactory
    interface Factory {
        fun create(project: String, sessionKey: SessionKey): NewTabViewModel
    }
}
