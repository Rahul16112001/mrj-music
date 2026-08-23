import { contentClassifier } from '../catalog/contentClassifier.js';

export const chartNormalizer = {
  normalizeTrack(rawTrack, rank, chartType = 'trending', region = 'GLOBAL', source = 'official_charts') {
    const rawTitle = rawTrack.title || 'Untitled Track';
    const cleanTitle = contentClassifier.cleanTitle(rawTitle);
    const artist = (rawTrack.artist || rawTrack.uploaderName || 'Popular Artist').trim();

    return {
      rank,
      id: rawTrack.id || rawTrack.videoId || `chart_${region}_${rank}`,
      title: cleanTitle,
      artist,
      thumbnail: rawTrack.thumbnail || (rawTrack.id ? `https://i.ytimg.com/vi/${rawTrack.id}/mqdefault.jpg` : ''),
      duration: rawTrack.duration || 210,
      chartType,
      region: region.toUpperCase(),
      source,
      updatedAt: Date.now(),
      contentType: contentClassifier.classify(rawTitle, artist, rawTrack.duration),
    };
  },

  normalizeChartList(tracks, chartType = 'trending', region = 'GLOBAL', source = 'official_charts') {
    if (!Array.isArray(tracks)) return [];

    return tracks
      .filter(t => !contentClassifier.isCompilation(t.title, t.artist, t.duration))
      .map((t, idx) => this.normalizeTrack(t, idx + 1, chartType, region, source));
  },
};
