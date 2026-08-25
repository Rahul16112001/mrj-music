package com.mrj.music.ui.components

import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.mrj.music.model.NativeTrack
import com.mrj.music.ui.theme.*
import com.mrj.music.ui.viewmodel.PlayerViewModel
import com.mrj.music.ui.viewmodel.PlaylistViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TrackActionSheet(
    track: NativeTrack,
    playerViewModel: PlayerViewModel,
    playlistViewModel: PlaylistViewModel = androidx.lifecycle.viewmodel.compose.viewModel(),
    onDismiss: () -> Unit,
    onArtistClick: (String) -> Unit = {},
    onStationClick: (String, String, String) -> Unit = { _, _, _ -> }
) {
    val context = LocalContext.current
    val likedTrackIds by playerViewModel.likedTrackIds.collectAsState()
    val isLiked = likedTrackIds.contains(track.id)

    var showAddToPlaylist by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF14141A),
        tonalElevation = 10.dp,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
        dragHandle = {
            Box(
                modifier = Modifier
                    .padding(vertical = 12.dp)
                    .width(40.dp)
                    .height(4.dp)
                    .clip(CircleShape)
                    .background(TextMuted.copy(alpha = 0.4f))
            )
        }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = 20.dp, vertical = 6.dp)
        ) {
            // Track Header Preview Card
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                AsyncImage(
                    model = track.thumbnail,
                    contentDescription = track.title,
                    modifier = Modifier
                        .size(54.dp)
                        .clip(RoundedCornerShape(12.dp)),
                    contentScale = ContentScale.Crop
                )

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = track.title,
                        style = MaterialTheme.typography.titleMedium.copy(
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp
                        ),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = TextPrimary
                    )
                    Spacer(Modifier.height(3.dp))
                    Text(
                        text = track.artist,
                        style = MaterialTheme.typography.bodyMedium.copy(fontSize = 13.sp),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = TextSecondary
                    )
                }

                IconButton(onClick = onDismiss) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Close",
                        tint = TextMuted,
                        modifier = Modifier.size(22.dp)
                    )
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(SurfaceBorder.copy(alpha = 0.5f))
            )

            Spacer(Modifier.height(10.dp))

            // Action Items
            LazyColumn(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(4.dp),
                contentPadding = PaddingValues(bottom = 20.dp)
            ) {
                // 1. Play Next
                item {
                    ActionSheetRow(
                        icon = Icons.Default.PlaylistPlay,
                        title = "Play Next",
                        subtitle = "Queue track to play immediately after this song",
                        onClick = {
                            playerViewModel.insertNextInQueue(track)
                            Toast.makeText(context, "Added '${track.title}' to play next", Toast.LENGTH_SHORT).show()
                            onDismiss()
                        }
                    )
                }

                // 2. Add to Queue
                item {
                    ActionSheetRow(
                        icon = Icons.Default.QueueMusic,
                        title = "Add to Queue",
                        subtitle = "Append track to the end of the queue",
                        onClick = {
                            playerViewModel.addToQueue(track)
                            Toast.makeText(context, "Added '${track.title}' to queue", Toast.LENGTH_SHORT).show()
                            onDismiss()
                        }
                    )
                }

                // 3. Add to Playlist
                item {
                    ActionSheetRow(
                        icon = Icons.Default.PlaylistAdd,
                        title = "Add to Playlist",
                        subtitle = "Save to your custom cloud playlists",
                        onClick = {
                            showAddToPlaylist = true
                        }
                    )
                }

                // 4. Favorite / Like
                item {
                    ActionSheetRow(
                        icon = if (isLiked) Icons.Default.Favorite else Icons.Default.FavoriteBorder,
                        iconTint = if (isLiked) CrimsonRed else TextPrimary,
                        title = if (isLiked) "Remove from Liked Songs" else "Save to Liked Songs",
                        subtitle = if (isLiked) "Remove from your cloud favorites" else "Add to your cloud favorites",
                        onClick = {
                            playerViewModel.toggleLike(track)
                            val msg = if (isLiked) "Removed from Liked Songs" else "Added to Liked Songs"
                            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                        }
                    )
                }

                // 5. Go to Artist Profile
                item {
                    ActionSheetRow(
                        icon = Icons.Default.Person,
                        title = "Go to Artist",
                        subtitle = "Explore ${track.artist}'s top tracks and albums",
                        onClick = {
                            onDismiss()
                            onArtistClick(track.artist)
                        }
                    )
                }

                // 6. Start Song Radio
                item {
                    ActionSheetRow(
                        icon = Icons.Default.Radio,
                        title = "Start Song Radio",
                        subtitle = "Stream endless music inspired by this track",
                        onClick = {
                            onDismiss()
                            onStationClick("artist", track.artist, "${track.artist} Radio")
                        }
                    )
                }

                // 7. Native Android Share
                item {
                    ActionSheetRow(
                        icon = Icons.Default.Share,
                        title = "Share Song",
                        subtitle = "Share song with friends on WhatsApp, Instagram, etc.",
                        onClick = {
                            val sendIntent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_SUBJECT, "${track.title} - ${track.artist}")
                                putExtra(
                                    Intent.EXTRA_TEXT,
                                    "Listen to \"${track.title}\" by ${track.artist} on MRJ Music 🎵\nhttps://mrj-music.vercel.app"
                                )
                            }
                            val shareIntent = Intent.createChooser(sendIntent, "Share Track via").apply {
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            try {
                                context.startActivity(shareIntent)
                            } catch (e: Exception) {
                                Toast.makeText(context, "Unable to open share menu", Toast.LENGTH_SHORT).show()
                            }
                            onDismiss()
                        }
                    )
                }
            }
        }
    }

    if (showAddToPlaylist) {
        AddToPlaylistSheet(
            track = track,
            playlistViewModel = playlistViewModel,
            onDismiss = {
                showAddToPlaylist = false
                onDismiss()
            }
        )
    }
}

@Composable
private fun ActionSheetRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    iconTint: Color = TextPrimary,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp)),
        color = Color.Transparent
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Surface(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape),
                color = SurfaceDark.copy(alpha = 0.8f),
                shape = CircleShape
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = icon,
                        contentDescription = title,
                        tint = iconTint,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    ),
                    color = TextPrimary
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall.copy(fontSize = 11.sp),
                    color = TextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}
