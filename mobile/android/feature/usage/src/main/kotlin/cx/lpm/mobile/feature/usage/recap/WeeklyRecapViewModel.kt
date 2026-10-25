package cx.lpm.mobile.feature.usage.recap

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cx.lpm.mobile.core.data.session.MacSessions
import cx.lpm.mobile.core.data.usage.WeeklyRecapState
import cx.lpm.mobile.core.data.usage.WeeklyRecapStore
import cx.lpm.mobile.core.model.RecapWeek
import cx.lpm.mobile.core.navigation.WeeklyRecapKey
import dagger.assisted.Assisted
import dagger.assisted.AssistedFactory
import dagger.assisted.AssistedInject
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Clock
import java.time.LocalDate
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

/** What the Weekly recap screen shows under its week picker. */
sealed interface RecapBody {
    data object Loading : RecapBody

    data class Failed(val message: String) : RecapBody

    /** No agent time in the week: no card, and from last week a way to this one. */
    data class Empty(val week: RecapWeek) : RecapBody

    /** A reload in flight dims the card already on screen. */
    data class Card(val view: RecapView, val caption: String, val dimmed: Boolean) : RecapBody
}

data class WeeklyRecapUiState(
    val week: RecapWeek = RecapWeek.Last,
    val body: RecapBody = RecapBody.Loading,
    /** The paired computers the week on screen leaves out. */
    val missing: List<String> = emptyList()
)

/** The Weekly recap screen: the desktop's "My week in lpm" card, last week or this one. */
@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel(assistedFactory = WeeklyRecapViewModel.Factory::class)
class WeeklyRecapViewModel @AssistedInject constructor(
    @Assisted val key: WeeklyRecapKey,
    private val sessions: MacSessions,
    private val clock: Clock
) : ViewModel() {
    private val store: WeeklyRecapStore? get() = sessions[key.session]?.store()

    val uiState: StateFlow<WeeklyRecapUiState> = sessions.session(key.session)
        .flatMapLatest { s ->
            s?.store<WeeklyRecapStore>()?.state?.map(::uiState) ?: flowOf(WeeklyRecapUiState())
        }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), WeeklyRecapUiState())

    private fun uiState(s: WeeklyRecapState): WeeklyRecapUiState {
        val recap = s.recaps[s.week]
        val error = s.errors[s.week]
        val body = when {
            error != null -> RecapBody.Failed(error)

            recap != null -> {
                val view = recapView(recap, LocalDate.now(clock))
                if (view.empty) {
                    RecapBody.Empty(s.week)
                } else {
                    RecapBody.Card(view, recapCaption(view), dimmed = s.week in s.loading)
                }
            }

            else -> RecapBody.Loading
        }
        return WeeklyRecapUiState(week = s.week, body = body, missing = recap?.missing.orEmpty())
    }

    /** The screen came up on last week. */
    fun open() {
        store?.screenDidOpen()
    }

    fun select(week: RecapWeek) {
        store?.select(week)
    }

    fun retry() {
        store?.load()
    }

    suspend fun refresh() {
        store?.refresh()
    }

    fun close() {
        store?.screenDidClose()
    }

    @AssistedFactory
    interface Factory {
        fun create(key: WeeklyRecapKey): WeeklyRecapViewModel
    }
}
