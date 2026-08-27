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
