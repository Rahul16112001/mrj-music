package com.mrj.music.data.home

import androidx.room.Entity
import com.mrj.music.model.NativeTrack

@Entity(tableName = "queue_persistence", primaryKeys = ["position"])
data class QueuePersistenceEntity(
    val position: Int,
    val currentIndex: Int,
    val canonicalTrackId: String,
    val provider: String?,
    val providerTrackId: String?,
    val title: String,
    val artist: String,
    val album: String?,
    val duration: Double,
    val artworkUrl: String?,
    val sourceAvailable: Boolean,
    val positionMs: Long,
    val savedAt: Long
) {
    fun toTrack() = NativeTrack(
        id = canonicalTrackId,
        canonicalTrackId = canonicalTrackId,
        title = title,
        artist = artist,
        album = album,
        thumbnail = artworkUrl,
        duration = duration,
        providerTrackId = providerTrackId,
        provider = provider,
    )

    companion object {
        fun fromTrack(position: Int, currentIndex: Int, track: NativeTrack, positionMs: Long, savedAt: Long) = QueuePersistenceEntity(
            position, currentIndex, track.canonicalTrackId ?: track.id, track.provider, track.providerTrackId,
            track.title, track.artist, track.album, track.duration, track.thumbnail, true, positionMs, savedAt
        )
    }
}
