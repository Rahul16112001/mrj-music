/**
 * Content Classifier for MRJ Music Catalog
 * Distinguishes official music tracks from compilations, playlists, live recordings, and random uploads.
 */

export const CONTENT_TYPES = {
  OFFICIAL_SONG: 'OFFICIAL_SONG',
  OFFICIAL_VIDEO: 'OFFICIAL_VIDEO',
  LYRIC_VIDEO: 'LYRIC_VIDEO',
  LIVE: 'LIVE',
  REMIX: 'REMIX',
  COVER: 'COVER',
  COMPILATION: 'COMPILATION',
  USER_UPLOAD: 'USER_UPLOAD',
  UNKNOWN: 'UNKNOWN',
};

// Patterns indicating generic compilations, playlists, or non-song uploads
const COMPILATION_PATTERNS = [
  /\btop\s*hits\s*(202\d)?\b/i,
  /\btop\s*songs\s*(202\d)?\b/i,
  /\bbest\s*songs\s*(202\d)?\b/i,
  /\bhits\s*(202\d)?\b/i,
  /\bjukebox\b/i,
  /\bnonstop\b/i,
  /\bnon-stop\b/i,
  /\bcompilation\b/i,
  /\bmashup\b/i,
  /\b1\s*hour\b/i,
  /\b2\s*hours\b/i,
  /\bplaylist\b/i,
  /\bfull\s*album\b/i,
  /\ball\s*songs\b/i,
  /\baudio\s*jukebox\b/i,
  /\bvideo\s*jukebox\b/i,
  /\bgreatest\s*hits\b/i,
  /\blofi\s*hip\s*hop\s*radio\b/i,
  /\bstudy\s*beats\s*24\/7\b/i,
];

const REMIX_PATTERNS = [/\bremix\b/i, /\bclub\s*mix\b/i, /\bedm\s*mix\b/i, /\bdj\s*mix\b/i, /\bslowed(\s*and\s*reverb)?\b/i];
const LIVE_PATTERNS = [/\blive\b/i, /\bconcert\b/i, /\btour\b/i, /\bacoustic\s*live\b/i, /\bunplugged\b/i];
const LYRIC_PATTERNS = [/\blyric\s*video\b/i, /\blyrics\b/i, /\bwith\s*lyrics\b/i];
const COVER_PATTERNS = [/\bcover\b/i, /\bacoustic\s*cover\b/i, /\btribute\b/i];
const OFFICIAL_PATTERNS = [/\bofficial\s*audio\b/i, /\bofficial\s*video\b/i, /\bofficial\s*music\s*video\b/i, /\bofficial\s*lyric\b/i, /\bvevo\b/i];

export const contentClassifier = {
  classify(title, artist = '', duration = 0) {
    const text = `${title} ${artist}`.toLowerCase();

    // Duration-based compilation detection (> 15 minutes is usually a compilation/full album)
    if (duration > 900) {
      return CONTENT_TYPES.COMPILATION;
    }

    // Pattern-based classification
    for (const pattern of COMPILATION_PATTERNS) {
      if (pattern.test(text)) {
        return CONTENT_TYPES.COMPILATION;
      }
    }

    for (const pattern of REMIX_PATTERNS) {
      if (pattern.test(text)) return CONTENT_TYPES.REMIX;
    }

    for (const pattern of LIVE_PATTERNS) {
      if (pattern.test(text)) return CONTENT_TYPES.LIVE;
    }

    for (const pattern of LYRIC_PATTERNS) {
      if (pattern.test(text)) return CONTENT_TYPES.LYRIC_VIDEO;
    }

    for (const pattern of COVER_PATTERNS) {
      if (pattern.test(text)) return CONTENT_TYPES.COVER;
    }

    for (const pattern of OFFICIAL_PATTERNS) {
      if (pattern.test(text)) return CONTENT_TYPES.OFFICIAL_SONG;
    }

    return CONTENT_TYPES.OFFICIAL_SONG;
  },

  isCompilation(title, artist = '', duration = 0) {
    return this.classify(title, artist, duration) === CONTENT_TYPES.COMPILATION;
  },

  cleanTitle(title) {
    if (!title) return '';
    return title
      .replace(/\s*\(Official\s*(Music\s*)?Video\)/gi, '')
      .replace(/\s*\[Official\s*(Music\s*)?Video\]/gi, '')
      .replace(/\s*\(Official\s*Audio\)/gi, '')
      .replace(/\s*\[Official\s*Audio\]/gi, '')
      .replace(/\s*\(Lyric\s*Video\)/gi, '')
      .replace(/\s*\[Lyric\s*Video\]/gi, '')
      .replace(/\s*\(Audio\)/gi, '')
      .replace(/\s*\[Audio\]/gi, '')
      .replace(/\s*\|.*$/g, '')
      .trim();
  },
};
