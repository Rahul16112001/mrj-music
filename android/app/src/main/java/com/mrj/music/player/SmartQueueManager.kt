package com.mrj.music.player

import com.mrj.music.model.NativeTrack
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Owns the logical playback queue. It never controls ExoPlayer directly. */
class SmartQueueManager {
    private val _queue = MutableStateFlow<List<NativeTrack>>(emptyList())
    val queue: StateFlow<List<NativeTrack>> = _queue.asStateFlow()

    private val _currentIndex = MutableStateFlow(0)
    val currentIndex: StateFlow<Int> = _currentIndex.asStateFlow()

    private val _history = MutableStateFlow<List<NativeTrack>>(emptyList())
    val history: StateFlow<List<NativeTrack>> = _history.asStateFlow()

    private var shuffleEnabled = false
    private var repeatMode = RepeatMode.OFF

    fun replace(items: List<NativeTrack>, selectedId: String? = null) {
        val normalized = deduplicate(items)
        _queue.value = normalized
        _currentIndex.value = selectedId?.let { id ->
            normalized.indexOfFirst { identity(it) == id }.takeIf { it >= 0 }
        } ?: 0
    }

    fun setCurrent(track: NativeTrack): Int {
        val index = _queue.value.indexOfFirst { identity(it) == identity(track) }
        if (index >= 0) {
            _currentIndex.value = index
        } else {
            _queue.value = deduplicate(_queue.value + track)
            _currentIndex.value = _queue.value.lastIndex
        }
        recordHistory(track)
        return _currentIndex.value
    }

    /** Returns the next candidate without committing the queue index. */
    fun nextCandidate(): NativeTrack? {
        val items = _queue.value
        if (items.isEmpty()) return null
        val nextIndex = when {
            repeatMode == RepeatMode.ONE -> _currentIndex.value
            _currentIndex.value < items.lastIndex -> _currentIndex.value + 1
            repeatMode == RepeatMode.ALL -> 0
            else -> return null
        }
        return items[nextIndex]
    }

    /** Returns the previous candidate without committing the queue index. */
    fun previousCandidate(): NativeTrack? {
        val items = _queue.value
        if (items.isEmpty()) return null
        val previousIndex = when {
            _currentIndex.value > 0 -> _currentIndex.value - 1
            repeatMode == RepeatMode.ALL -> items.lastIndex
            else -> return null
        }
        return items[previousIndex]
    }

    fun add(track: NativeTrack, playNext: Boolean = false) {
        if (_queue.value.any { identity(it) == identity(track) }) return
        val mutable = _queue.value.toMutableList()
        val insertionIndex = if (playNext) (_currentIndex.value + 1).coerceAtMost(mutable.size) else mutable.size
        mutable.add(insertionIndex, track)
        _queue.value = mutable
    }

    fun remove(index: Int): NativeTrack? {
        val mutable = _queue.value.toMutableList()
        if (index !in mutable.indices) return null
        val removed = mutable.removeAt(index)
        _queue.value = mutable
        _currentIndex.value = when {
            mutable.isEmpty() -> 0
            index < _currentIndex.value -> _currentIndex.value - 1
            else -> _currentIndex.value.coerceAtMost(mutable.lastIndex)
        }
        return removed
    }

    fun reorder(fromIndex: Int, toIndex: Int) {
        val mutable = _queue.value.toMutableList()
        if (fromIndex !in mutable.indices || toIndex !in mutable.indices) return
        val currentIdentity = current()?.let(::identity)
        val item = mutable.removeAt(fromIndex)
        mutable.add(toIndex, item)
        _queue.value = mutable
        val reorderedCurrentIndex = currentIdentity?.let { id ->
            _queue.value.indexOfFirst { identity(it) == id }
        } ?: -1
        _currentIndex.value = if (reorderedCurrentIndex >= 0) {
            reorderedCurrentIndex
        } else {
            _currentIndex.value.coerceIn(0, _queue.value.lastIndex.coerceAtLeast(0))
        }
    }

    fun clearExceptCurrent() {
        current()?.let {
            _queue.value = listOf(it)
            _currentIndex.value = 0
        } ?: run {
            _queue.value = emptyList()
            _currentIndex.value = 0
        }
    }

    fun current(): NativeTrack? = _queue.value.getOrNull(_currentIndex.value)

    fun setShuffle(enabled: Boolean) {
        shuffleEnabled = enabled
        if (enabled && _queue.value.size > 1) {
            val current = current()
            val rest = _queue.value.filter { identity(it) != current?.let(::identity) }.shuffled()
            _queue.value = listOfNotNull(current) + rest
            _currentIndex.value = 0
        }
    }

    fun isShuffleEnabled(): Boolean = shuffleEnabled

    fun setRepeat(mode: RepeatMode) {
        repeatMode = mode
    }

    fun repeatMode(): RepeatMode = repeatMode

    private fun recordHistory(track: NativeTrack) {
        _history.value = listOf(track) + _history.value.filter { identity(it) != identity(track) }.take(49)
    }

    private fun deduplicate(items: List<NativeTrack>): List<NativeTrack> {
        val seen = HashSet<String>()
        return items.filter { seen.add(identity(it)) }
    }

    private fun identity(track: NativeTrack): String =
        track.canonicalTrackId?.takeIf { it.isNotBlank() }
            ?: track.id
}
