import axios from 'axios';

/**
 * High-End Resilient YouTube Scraper
 * Uses YouTube Web Client direct RPC to avoid Cloud IP bans and HTML parsing brittleness.
 */
export async function searchYouTubeHighEnd(query, limit = 20) {
  if (!query || !query.trim()) return [];

  try {
    const res = await axios.post(
      'https://www.youtube.com/youtubei/v1/search',
      {
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240101.00.00',
            hl: 'en',
            gl: 'IN',
          },
        },
        query: query.trim(),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 4500,
      }
    );

    const candidates = [];
    const contents =
      res.data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        if (item.videoRenderer) {
          const v = item.videoRenderer;
          const videoId = v.videoId;
          if (!videoId) continue;

          const rawTitle =
            v.title?.runs?.[0]?.text || v.title?.accessibility?.accessibilityData?.label || 'Untitled';
          const artist = v.ownerText?.runs?.[0]?.text || 'Popular Artist';
          const lengthText =
            v.lengthText?.simpleText ||
            v.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText ||
            '3:30';

          const parts = lengthText.split(':').map(Number);
          const durationSec =
            parts.length === 2
              ? parts[0] * 60 + parts[1]
              : parts.length === 3
              ? parts[0] * 3600 + parts[1] * 60 + parts[2]
              : 210;

          candidates.push({
            id: videoId,
            videoId,
            providerTrackId: videoId,
            rawTitle,
            title: rawTitle,
            artist,
            duration: durationSec,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            views: v.viewCountText?.simpleText || null,
          });

          if (candidates.length >= limit) break;
        }
      }
      if (candidates.length >= limit) break;
    }

    return candidates;
  } catch (err) {
    console.warn('High-end scraper warning for "' + query + '":', err.message);
    return [];
  }
}

/**
 * YouTube Music Real-Time Autocomplete & Track Prediction
 * Directly queries YouTube Music RPC to get instant studio tracks and queries with play counts
 */
export async function getYoutubeMusicSuggestions(query) {
  if (!query || !query.trim()) return { suggestions: [], songs: [] };

  const cleanQuery = query.trim().replace(/[^a-zA-Z0-9\s]+$/g, '').trim() || query.trim();

  try {
    const payload = {
      context: {
        client: {
          clientName: 'WEB_REMIX',
          clientVersion: '1.20240318.01.00',
          hl: 'en',
          gl: 'IN',
        },
      },
      input: cleanQuery,
    };

    const res = await axios.post(
      'https://music.youtube.com/youtubei/v1/music/get_search_suggestions',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Referer: 'https://music.youtube.com/',
          Origin: 'https://music.youtube.com',
        },
        timeout: 3000,
      }
    );

    const suggestions = [];
    const songs = [];
    const contents = res.data?.contents || [];

    for (const group of contents) {
      const list = group.searchSuggestionsSectionRenderer?.contents || [];
      for (const item of list) {
        if (item.musicResponsiveListItemRenderer) {
          const r = item.musicResponsiveListItemRenderer;
          const title =
            r.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || 'Untitled';
          const subRuns = r.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
          const fullSubtitle = subRuns.map((x) => x.text).join('');

          let artist = 'Popular Artist';
          let plays = null;
          const parts = fullSubtitle.split('•').map((p) => p.trim());
          if (parts.length >= 2) {
            artist = parts[1];
            if (parts.length >= 3) plays = parts[2];
          }

          const videoId =
            r.navigationEndpoint?.watchEndpoint?.videoId || r.doubleTapCommand?.watchEndpoint?.videoId;
          const thumb = r.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url;

          if (videoId) {
            songs.push({
              id: videoId,
              title,
              artist,
              plays,
              subtitle: fullSubtitle,
              thumbnail: thumb || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              providerTrackId: videoId,
              audioSource: {
                sourceId: `src_${videoId}`,
                provider: 'youtube',
                providerTrackId: videoId,
                title,
                artist,
                format: 'audio',
                sourceType: 'audio',
                confidenceScore: 100,
              },
              duration: 210,
            });
          }
        } else if (item.searchSuggestionRenderer) {
          const q = item.searchSuggestionRenderer.suggestion?.runs?.map((x) => x.text).join('');
          if (q) suggestions.push(q);
        }
      }
    }

    return { suggestions, songs };
  } catch (err) {
    console.warn('YouTube Music autocomplete warning:', err.message);
    return { suggestions: [], songs: [] };
  }
}
