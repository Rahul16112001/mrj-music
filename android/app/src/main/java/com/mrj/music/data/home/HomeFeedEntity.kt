package com.mrj.music.data.home

import androidx.room.Entity
import com.mrj.music.data.remote.HomeFeedTrackDto

@Entity(tableName = "home_feed_tracks", primaryKeys = ["sectionId", "canonicalTrackId"])
data class HomeFeedEntity(
    val sectionId: String,
    val sectionTitle: String,
    val canonicalTrackId: String,
    val provider: String,
    val providerTrackId: String,
    val title: String,
    val artist: String,
    val album: String?,
    val duration: Double,
    val artworkUrl: String,
    val sourceAvailable: Boolean,
    val fetchedAt: Long
) {
    fun toDto() = HomeFeedTrackDto(
        canonicalTrackId = canonicalTrackId,
        provider = provider,
        providerTrackId = providerTrackId,
        title = title,
        artist = artist,
        album = album,
        duration = duration.toInt(),
        artworkUrl = artworkUrl,
        sourceAvailable = sourceAvailable
    )

    companion object {
        fun fromDto(section: String, sectionTitle: String, track: HomeFeedTrackDto, fetchedAt: Long) = HomeFeedEntity(
            sectionId = section,
            sectionTitle = sectionTitle,
            canonicalTrackId = track.canonicalTrackId,
            provider = track.provider,
            providerTrackId = track.providerTrackId,
            title = track.title,
            artist = track.artist,
            album = track.album,
            duration = track.duration?.toDouble() ?: 0.0,
            artworkUrl = track.artworkUrl,
            sourceAvailable = track.sourceAvailable,
            fetchedAt = fetchedAt
        )
    }
}
