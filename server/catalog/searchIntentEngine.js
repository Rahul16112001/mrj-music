/**
 * Search Intent Engine for MRJ Music
 * Parses user search queries to detect intent, desired content type, modifiers, language, and mood.
 */

export const INTENT_TYPES = {
  SONG: 'SONG',
  ARTIST: 'ARTIST',
  ALBUM: 'ALBUM',
  LYRICS: 'LYRICS',
  LIVE: 'LIVE',
  COVER: 'COVER',
  REMIX: 'REMIX',
  SLOWED: 'SLOWED',
  VIDEO: 'VIDEO',
  PODCAST: 'PODCAST',
  MOOD: 'MOOD',
  LANGUAGE: 'LANGUAGE',
};

const MOOD_KEYWORDS = {
  workout: ['workout', 'gym', 'fitness', 'exercise', 'training', 'pumping', 'energy'],
  romance: ['romantic', 'romance', 'love', 'ishq', 'pyaar', 'dil', 'crush', 'valentine'],
  chill: ['chill', 'relax', 'peaceful', 'calm', 'soothing', 'sleep', 'ambient', 'acoustic'],
  focus: ['focus', 'study', 'work', 'coding', 'deep focus', 'concentration', 'lofi'],
  party: ['party', 'dance', 'club', 'dj', 'celebration', 'bhangra', 'edm', 'festival'],
  sad: ['sad', 'heartbreak', 'dard', 'emotional', 'crying', 'broken', 'alone', 'lonely'],
  drive: ['drive', 'night drive', 'road trip', 'cruising', 'highway'],
  devotional: ['bhajan', 'aarti', 'kirtan', 'devotional', 'hanuman', 'krishna', 'shiva', 'gurbani'],
};

const LANGUAGE_KEYWORDS = {
  hindi: ['hindi', 'bollywood'],
  punjabi: ['punjabi', 'pollywood'],
  tamil: ['tamil', 'kollywood'],
  telugu: ['telugu', 'tollywood'],
  english: ['english', 'hollywood', 'pop', 'international'],
  korean: ['kpop', 'korean', 'bts', 'blackpink'],
  spanish: ['spanish', 'latin', 'reggaeton'],
  bhojpuri: ['bhojpuri'],
  marathi: ['marathi'],
  bengali: ['bengali', 'bangla'],
};

export const searchIntentEngine = {
  parse(rawQuery = '') {
    const query = (rawQuery || '').trim().toLowerCase();
    const result = {
      rawQuery,
      cleanQuery: query,
      primaryIntent: INTENT_TYPES.SONG,
      detectedIntents: new Set([INTENT_TYPES.SONG]),
      wantsLyrics: false,
      wantsLive: false,
      wantsCover: false,
      wantsRemix: false,
      wantsSlowed: false,
      wantsVideo: false,
      wantsPodcast: false,
      detectedMood: null,
      detectedLanguage: null,
      targetEntity: query,
    };

    if (!query) return result;

    // 1. Modifiers & Specific Format Intents
    if (/\b(lyrics?|lyric\s*video|with\s*lyrics)\b/i.test(query)) {
      result.wantsLyrics = true;
      result.detectedIntents.add(INTENT_TYPES.LYRICS);
      result.primaryIntent = INTENT_TYPES.LYRICS;
      result.cleanQuery = query.replace(/\b(lyrics?|lyric\s*video|with\s*lyrics)\b/gi, '').trim();
    }

    if (/\b(live|concert|tour|unplugged|in\s*concert)\b/i.test(query)) {
      result.wantsLive = true;
      result.detectedIntents.add(INTENT_TYPES.LIVE);
      result.primaryIntent = INTENT_TYPES.LIVE;
      result.cleanQuery = query.replace(/\b(live|concert|tour|unplugged)\b/gi, '').trim();
    }

    if (/\b(cover|acoustic\s*cover|tribute)\b/i.test(query)) {
      result.wantsCover = true;
      result.detectedIntents.add(INTENT_TYPES.COVER);
      result.primaryIntent = INTENT_TYPES.COVER;
      result.cleanQuery = query.replace(/\b(cover|acoustic\s*cover|tribute)\b/gi, '').trim();
    }

    if (/\b(slowed(\s*and\s*reverb)?|reverb)\b/i.test(query)) {
      result.wantsSlowed = true;
      result.detectedIntents.add(INTENT_TYPES.SLOWED);
      result.primaryIntent = INTENT_TYPES.SLOWED;
      result.cleanQuery = query.replace(/\b(slowed(\s*and\s*reverb)?|reverb)\b/gi, '').trim();
    }

    if (/\b(remix|club\s*mix|dj\s*mix|edm\s*mix)\b/i.test(query)) {
      result.wantsRemix = true;
      result.detectedIntents.add(INTENT_TYPES.REMIX);
      result.primaryIntent = INTENT_TYPES.REMIX;
      result.cleanQuery = query.replace(/\b(remix|club\s*mix|dj\s*mix|edm\s*mix)\b/gi, '').trim();
    }

    if (/\b(video|music\s*video|watch|official\s*video|mv)\b/i.test(query)) {
      result.wantsVideo = true;
      result.detectedIntents.add(INTENT_TYPES.VIDEO);
      result.primaryIntent = INTENT_TYPES.VIDEO;
      result.cleanQuery = query.replace(/\b(video|music\s*video|watch|official\s*video|mv)\b/gi, '').trim();
    }

    if (/\b(podcast|episode|interview|talk\s*show)\b/i.test(query)) {
      result.wantsPodcast = true;
      result.detectedIntents.add(INTENT_TYPES.PODCAST);
      result.primaryIntent = INTENT_TYPES.PODCAST;
      result.cleanQuery = query.replace(/\b(podcast|episode|interview)\b/gi, '').trim();
    }

    if (/\b(album|full\s*album|ost|soundtrack|ep)\b/i.test(query)) {
      result.detectedIntents.add(INTENT_TYPES.ALBUM);
      if (result.primaryIntent === INTENT_TYPES.SONG) result.primaryIntent = INTENT_TYPES.ALBUM;
      result.cleanQuery = query.replace(/\b(album|full\s*album|ost|soundtrack|ep)\b/gi, '').trim();
    }

    if (/\b(songs?|tracks?|music|discography|all\s*songs)\b/i.test(query)) {
      result.detectedIntents.add(INTENT_TYPES.ARTIST);
      result.cleanQuery = query.replace(/\b(songs?|tracks?|music|discography|all\s*songs)\b/gi, '').trim();
    }

    // 2. Language Detection
    for (const [lang, keywords] of Object.entries(LANGUAGE_KEYWORDS)) {
      if (keywords.some((kw) => query.includes(kw))) {
        result.detectedLanguage = lang;
        result.detectedIntents.add(INTENT_TYPES.LANGUAGE);
        break;
      }
    }

    // 3. Mood Detection
    for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
      if (keywords.some((kw) => query.includes(kw))) {
        result.detectedMood = mood;
        result.detectedIntents.add(INTENT_TYPES.MOOD);
        if (result.primaryIntent === INTENT_TYPES.SONG && !result.wantsLyrics && !result.wantsLive) {
          result.primaryIntent = INTENT_TYPES.MOOD;
        }
        break;
      }
    }

    result.targetEntity = result.cleanQuery || query;
    return result;
  },
};
