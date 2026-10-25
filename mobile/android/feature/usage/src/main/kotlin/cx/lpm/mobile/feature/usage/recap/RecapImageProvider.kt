package cx.lpm.mobile.feature.usage.recap

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.core.content.FileProvider
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Lends the weekly recap image to the app it's shared with. Its paths are the manifest's
 * meta-data: [getUriForFile] reads them before the provider itself has.
 */
class RecapImageProvider : FileProvider() {
    companion object {
        /** The scratch folder under the cache directory, as `recap_image_paths` names it. */
        private const val FOLDER = "WeeklyRecap"

        /** Writes [image] as the PNG [name] the share sheet hands on, in place of the last one. */
        suspend fun save(context: Context, image: ImageBitmap, name: String): File =
            withContext(Dispatchers.IO) {
                val bitmap = image.asAndroidBitmap().let {
                    if (it.config == Bitmap.Config.HARDWARE) {
                        it.copy(Bitmap.Config.ARGB_8888, false)
                    } else {
                        it
                    }
                }
                val folder = File(context.cacheDir, FOLDER)
                folder.deleteRecursively()
                val file = File(folder.apply { mkdirs() }, name)
                file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
                file
            }

        /** The system share sheet for the card [file] with its [caption]. */
        fun share(context: Context, file: File, caption: String) {
            val uri = getUriForFile(context, "${context.packageName}.recap", file)
            val send = Intent(Intent.ACTION_SEND)
                .setType("image/png")
                .putExtra(Intent.EXTRA_STREAM, uri)
                .putExtra(Intent.EXTRA_TEXT, caption)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            send.clipData = ClipData.newRawUri(file.name, uri)
            try {
                context.startActivity(Intent.createChooser(send, null))
            } catch (_: ActivityNotFoundException) {
            }
        }
    }
}
