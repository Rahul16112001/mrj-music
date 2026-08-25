package com.mrj.music.ui.theme

import android.content.Context
import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import androidx.compose.ui.graphics.Color
import androidx.palette.graphics.Palette
import coil.ImageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object PaletteExtractor {

    private val colorCache = mutableMapOf<String, Color>()

    suspend fun extractThemeColor(context: Context, imageUrl: String?): Color {
        if (imageUrl.isNullOrBlank()) return CrimsonRed
        
        colorCache[imageUrl]?.let { return it }

        return withContext(Dispatchers.IO) {
            try {
                val loader = ImageLoader(context)
                val request = ImageRequest.Builder(context)
                    .data(imageUrl)
                    .allowHardware(false)
                    .build()

                val result = loader.execute(request)
                if (result is SuccessResult) {
                    val bitmap = (result.drawable as? BitmapDrawable)?.bitmap
                    if (bitmap != null) {
                        val palette = Palette.from(bitmap).generate()
                        val dominantRgb = palette.getVibrantColor(
                            palette.getDominantColor(
                                palette.getDarkVibrantColor(0xFFE50914.toInt())
                            )
                        )
                        val extractedColor = Color(dominantRgb)
                        colorCache[imageUrl] = extractedColor
                        return@withContext extractedColor
                    }
                }
            } catch (_: Exception) {}
            CrimsonRed
        }
    }
}
