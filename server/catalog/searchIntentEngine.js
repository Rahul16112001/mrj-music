/**
 * Search Intent Engine for MRJ Music
 * Distinguishes explicit format desires (original music, lyrics, live, slowed, remix, video, cover, podcast).
 */

export const INTENT_TYPES = {
  ORIGINAL_MUSIC: 'ORIGINAL_MUSIC',
  SONG: 'ORIGINAL_MUSIC', // Alias for compatibility
  LYRICS: 'LYRICS',
  LIVE: 'LIVE',
  COVER: 'COVER',
  REMIX: 'REMIX',
  SLOWED_REVERB: 'SLOWED_REVERB',
  SLOWED: 'SLOWED_REVERB', // Alias
  VIDEO: 'VIDEO',
  PODCAST: 'PODCAST',
  ARTIST: 'ARTIST',
  ALBUM: 'ALBUM',
};

export const searchIntentEngine = {
  parse(rawQuery = '') {
    const query = (rawQuery || '').trim().toLowerCase();
    const result = {
      rawQuery,
      cleanQuery: query,
      primaryIntent: INTENT_TYPES.ORIGINAL_MUSIC,
      wantsLyrics: false,
      wantsLive: false,
      wantsCover: false,
      wantsRemix: false,
      wantsSlowed: false,
      wantsVideo: false,
      wantsPodcast: false,
      targetEntity: query,
    };

    if (!query) return result;

    // 1. Specific Intent Detection
    if (/\b(lyrics?|lyric\s*video|with\s*lyrics|lyrical)\b/i.test(query)) {
      result.wantsLyrics = true;
      result.primaryIntent = INTENT_TYPES.LYRICS;
      result.cleanQuery = query.replace(/\b(lyrics?|lyric\s*video|with\s*lyrics|lyrical)\b/gi, '').trim();
    } else if (/\b(live|concert|tour|unplugged|in\s*concert)\b/i.test(query)) {
      result.wantsLive = true;
      result.primaryIntent = INTENT_TYPES.LIVE;
      result.cleanQuery = query.replace(/\b(live|concert|tour|unplugged)\b/gi, '').trim();
    } else if (/\b(cover|acoustic\s*cover|tribute|karaoke|instrumental)\b/i.test(query)) {
      result.wantsCover = true;
      result.primaryIntent = INTENT_TYPES.COVER;
      result.cleanQuery = query.replace(/\b(cover|acoustic\s*cover|tribute)\b/gi, '').trim();
    } else if (/\b(slowed(\s*[\+&]?\s*reverb)?|reverb|8d(\s*audio)?|lofi(\s*flip|\s*song)?|lo-fi|nightcore)\b/i.test(query)) {
      result.wantsSlowed = true;
      result.primaryIntent = INTENT_TYPES.SLOWED_REVERB;
      result.cleanQuery = query.replace(/\b(slowed(\s*[\+&]?\s*reverb)?|reverb|8d(\s*audio)?|lofi(\s*flip|\s*song)?|lo-fi|nightcore)\b/gi, '').trim();
    } else if (/\b(remix|club\s*mix|dj\s*mix|edm\s*mix|mashup)\b/i.test(query)) {
      result.wantsRemix = true;
      result.primaryIntent = INTENT_TYPES.REMIX;
      result.cleanQuery = query.replace(/\b(remix|club\s*mix|dj\s*mix|edm\s*mix|mashup)\b/gi, '').trim();
    } else if (/\b(video|music\s*video|watch|official\s*video|mv)\b/i.test(query)) {
      result.wantsVideo = true;
      result.primaryIntent = INTENT_TYPES.VIDEO;
      result.cleanQuery = query.replace(/\b(video|music\s*video|watch|official\s*video|mv)\b/gi, '').trim();
    } else if (/\b(podcast|episode|interview|talk\s*show)\b/i.test(query)) {
      result.wantsPodcast = true;
      result.primaryIntent = INTENT_TYPES.PODCAST;
      result.cleanQuery = query.replace(/\b(podcast|episode|interview)\b/gi, '').trim();
    }

    result.targetEntity = result.cleanQuery || query;
    return result;
  },
};
