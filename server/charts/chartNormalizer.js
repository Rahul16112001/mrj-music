import { contentClassifier } from '../catalog/contentClassifier.js';

export const chartNormalizer = {
  normalizeTrack(rawTrack, rank, chartType = 'trending', region = 'GLOBAL', source = 'official_charts') {
    const rawTitle = rawTrack.title || 'Untitled Track';
    const cleanTitle = contentClassifier.cleanTitle(rawTitle);
    const artist = (rawTrack.artist || rawTrack.uploaderName || 'Popular Artist').trim();
    const trackId = rawTrack.id || rawTrack.videoId || `chart_${region}_${rank}`;

    return {
      rank,
      id: trackId,
      providerTrackId: trackId,
      canonicalMusicEntityId: `${cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}|${artist.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: cleanTitle,
      artist,
      thumbnail: rawTrack.thumbnail || (rawTrack.id ? `https://i.ytimg.com/vi/${rawTrack.id}/hqdefault.jpg` : ''),
      duration: rawTrack.duration || 210,
      chartType,
      region: region.toUpperCase(),
      source,
      updatedAt: Date.now(),
      contentType: 'music',
      isOfficialMusic: true,
      isAudioOnly: true,
      isMusicVideo: false,
      playbackFormat: 'audio',
      provider: 'youtube',
      audioSource: {
        sourceId: `src_aud_${trackId}`,
        type: 'audio',
        provider: 'youtube',
        providerTrackId: trackId,
        duration: rawTrack.duration || 210,
      },
    };
  },

  normalizeChartList(tracks, chartType = 'trending', region = 'GLOBAL', source = 'official_charts') {
    if (!Array.isArray(tracks)) return [];

    return tracks
      .filter(t => !contentClassifier.isCompilation(t.title, t.artist, t.duration))
      .map((t, idx) => this.normalizeTrack(t, idx + 1, chartType, region, source));
  },
};
