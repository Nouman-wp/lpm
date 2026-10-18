package cx.lpm.mobile.feature.usage.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.util.AtomicFile
import androidx.glance.appwidget.updateAll
import cx.lpm.mobile.core.data.prefs.AppPreferences
import cx.lpm.mobile.core.data.prefs.PreferenceKeys
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json

/**
 * The Token activity widget's data (iOS `TokenActivityStore`): a file the app writes
 * after reading the Mac, and the range the widget's pills last picked.
 */
@Singleton
class TokenActivityRepository @Inject constructor(
    @param:ApplicationContext private val context: Context,
    private val preferences: AppPreferences
) {
    private val file = AtomicFile(File(context.filesDir, FILE))
    private val snapshot = MutableStateFlow<TokenActivitySnapshot?>(null)
    private val loading = Mutex()
    private var loaded = false

    /** The saved read, from disk the first time. */
    suspend fun snapshots(): StateFlow<TokenActivitySnapshot?> {
        loading.withLock {
            if (!loaded) {
                snapshot.value = withContext(Dispatchers.IO) {
                    runCatching {
                        json.decodeFromString<TokenActivitySnapshot>(
                            file.readFully().decodeToString()
                        )
                    }
                        .getOrNull()
                }
                loaded = true
            }
        }
        return snapshot.asStateFlow()
    }

    suspend fun save(read: TokenActivitySnapshot) {
        loading.withLock {
            snapshot.value = read
            loaded = true
        }
        withContext(Dispatchers.IO) {
            val out = file.startWrite()
            try {
                out.write(json.encodeToString(read).toByteArray())
                file.finishWrite(out)
            } catch (_: IOException) {
                file.failWrite(out)
            }
        }
        TokenActivityWidget().updateAll(context)
    }

    /** Days the widget shows: 7 until a pill picks another. */
    suspend fun ranges(): Flow<Int> {
        preferences.load()
        return preferences.data.map { range() }.distinctUntilChanged()
    }

    fun range(): Int = preferences.int(PreferenceKeys.TOKEN_ACTIVITY_RANGE)?.takeIf { it in RANGES }
        ?: RANGES.first()

    suspend fun pickRange(days: Int) {
        preferences.load()
        preferences.setInt(PreferenceKeys.TOKEN_ACTIVITY_RANGE, days)
        TokenActivityWidget().updateAll(context)
    }

    /** Whether the widget is on a home screen: the app reads the Mac for it only then. */
    fun isPlaced(): Boolean = AppWidgetManager.getInstance(context)
        .getAppWidgetIds(ComponentName(context, TokenActivityWidgetReceiver::class.java))
        .isNotEmpty()

    companion object {
        val RANGES = listOf(7, 14, 30)
        private const val FILE = "token-activity.json"
        private val json = Json { ignoreUnknownKeys = true }
    }
}
