package com.mrj.music.model

data class NativePlaylist(
    val id: String,
    val title: String,
    val description: String = "",
    val thumbnail: String? = null,
    val trackCount: Int = 0,
    val tracks: List<NativeTrack> = emptyList(),
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val isCustom: Boolean = true
)
