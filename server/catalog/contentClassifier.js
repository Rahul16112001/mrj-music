/**
 * Advanced Content Classifier & Normalizer for MRJ Music
 * Distinguishes canonical music tracks, music videos, lyrics videos, slowed/reverb, remixes, covers, live performances, and fan edits.
 */

export const CONTENT_TYPES = {
  MUSIC: 'music',
  VIDEO: 'video',
  LYRICS: 'lyrics',
  REMIX: 'remix',
  SLOWED: 'slowed',
  COVER: 'cover',
  LIVE: 'live',
  REACTION: 'reaction',
  SHORT: 'short',
  PODCAST: 'podcast',
  UNKNOWN: 'unknown',
};

// Generic & Major Music Publisher / Record Label Channels
const RECOGNIZED_MUSIC_PUBLISHERS = [
  't-series',
  'sony music',
  'zee music',
  'yrf',
  'speed records',
  'tips official',
  'aditya music',
  'saregama',
  'universal music',
  'warner music',
  'vevo',
  'tseries',
  'white hill music',
  'geet mp3',
  'times music',
  'desi music factory',
  'bighit music',
  'hybe labels',
  'atlantic records',
  'columbia records',
  'interscope records',
  'republic records',
  'def jam',
  'rca records',
  'epic records',
  'virgin music',
  'sm entertainment',
  'jyp entertainment',
  'yg entertainment',
  'mass appeal india',
  'spinnin records',
  'ultra music',
];

// Patterns indicating Generic Compilations
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

// Negative Signals for Normal Music (Fan edits, Slowed, Lofi, AMV, Reactions)
const SLOWED_LOFI_PATTERNS = [
  /\b(slowed(\s*[\+&]\s*reverb)?|reverb|8d(\s*audio)?|lofi(\s*flip|\s*song|\s*remix|\s*beats)?|lo-fi|nightcore|sped\s*up|speed\s*up|bass\s*boost(ed)?|dolby(\s*surround(ed)?)?)\b/i,
  /\[\s*slowed\s*[\+&]?\s*reverb\s*\]/i,
  /\(\s*slowed\s*[\+&]?\s*reverb\s*\)/i,
];

const FAN_EDIT_PATTERNS = [
  /\b(amv|amw|anime\s*mix|anime\s*music\s*video|fanmade|fan\s*made|status\s*video|whatsapp\s*status|shorts?|reels?|tiktok)\b/i,
  /\[\s*(amv|amw|edit|fanmade)\s*\]/i,
  /\(\s*(amv|amw|edit|fanmade)\s*\)/i,
];

const REMIX_PATTERNS = [
  /\b(remix|club\s*mix|dj\s*mix|edm\s*mix|mashup|dj\s+[a-z0-9]+)\b/i,
  /\[\s*remix\s*\]/i,
  /\(\s*remix\s*\)/i,
];

const COVER_PATTERNS = [
  /\b(cover|acoustic\s*cover|tribute|karaoke|instrumental|female\s*version|male\s*version|unplugged\s*cover)\b/i,
  /\bfemale\s*cover\b/i,
  /\bmale\s*cover\b/i,
];

const LYRICS_PATTERNS = [
  /\b(lyrics?|lyric\s*video|with\s*lyrics|lyrical(\s*video)?|full\s*lyrics|lyrics\s*song)\b/i,
  /\[\s*lyrics?\s*\]/i,
  /\(\s*lyrics?\s*\)/i,
  /^lyrical\s*:\s*/i,
];

const MUSIC_VIDEO_PATTERNS = [
  /\b(official\s*(music\s*)?video|music\s*video|full\s*video(\s*song)?|video\s*song|full\s*video|hd\s*video|4k\s*video|\bmv\b)\b/i,
  /\[\s*official\s*(music\s*)?video\s*\]/i,
  /\(\s*official\s*(music\s*)?video\s*\)/i,
  /^official\s*:\s*/i,
];

const LIVE_PATTERNS = [
  /\b(live(\s*in|\s*at|\s*concert|\s*performance)?|concert|tour|unplugged|live\s*recording)\b/i,
  /\[\s*live\s*\]/i,
  /\(\s*live\s*\)/i,
];

const REACTION_PATTERNS = [
  /\b(reaction|reacts|reacting|first\s*time\s*hearing|review|vlog|kitchen|recipe|cooking|roast|unboxing)\b/i,
];

const SHORT_PATTERNS = [
  /\b#?shorts?\b/i,
  /\btiktok\b/i,
  /\breels?\b/i,
];

const PODCAST_PATTERNS = [
  /\bpodcast\b/i,
  /\bepisode\s*\d+\b/i,
  /\btalk\s*show\b/i,
  /\binterview\b/i,
];

const OFFICIAL_AUDIO_PATTERNS = [
  /\b(official\s*audio|audio\s*track|full\s*audio(\s*song)?|audio\s*song|provided\s*to\s*youtube|original\s*soundtrack|auto-generated)\b/i,
  /\[\s*official\s*audio\s*\]/i,
  /\(\s*official\s*audio\s*\)/i,
  /^audio\s*:\s*/i,
];

const MUSIC_CONTENT_SIGNALS = [
  /\b(song|music|audio|records|soundtrack|soundtracks|ost|album|single|track|tune|singer|band|prod\.|feat\.|ft\.)\b/i,
];

function normalizeFuzzy(str = '') {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/aa+/g, 'a')
    .replace(/ee+/g, 'i')
    .replace(/oo+/g, 'u')
    .replace(/ii+/g, 'i')
    .replace(/uu+/g, 'u');
}

export const contentClassifier = {
  normalizeFuzzy,

  /**
   * Deeply classifies a search candidate into its true content type and metadata flags
   */
  classifySearchResult(rawTrack = {}) {
    const rawTitle = rawTrack.title || rawTrack.rawTitle || '';
    const artist = (rawTrack.artist || rawTrack.uploaderName || '').trim();
    const duration = Number(rawTrack.duration) || 210;
    const text = `${rawTitle} ${artist}`.toLowerCase();

    const reasons = [];

    // 1. Structural Checks
    const isTopicChannel = artist.toLowerCase().endsWith('- topic') || text.includes('provided to youtube');
    if (isTopicChannel) reasons.push('topic_channel');

    const isRecognizedPublisher = RECOGNIZED_MUSIC_PUBLISHERS.some((ch) => text.includes(ch));
    if (isRecognizedPublisher) reasons.push('recognized_music_publisher');

    const isReaction = REACTION_PATTERNS.some((p) => p.test(text));
    const isShort = duration < 60 || SHORT_PATTERNS.some((p) => p.test(text));
    const isPodcast = PODCAST_PATTERNS.some((p) => p.test(text));
    const isCompilation = duration > 900 || COMPILATION_PATTERNS.some((p) => p.test(text));
    const isSlowed = SLOWED_LOFI_PATTERNS.some((p) => p.test(text));
    const isFanEdit = FAN_EDIT_PATTERNS.some((p) => p.test(text));
    const isRemix = REMIX_PATTERNS.some((p) => p.test(text));
    const isCover = COVER_PATTERNS.some((p) => p.test(text));
    const isLyricsVideo = LYRICS_PATTERNS.some((p) => p.test(text));
    const isLive = LIVE_PATTERNS.some((p) => p.test(text));
    const isMusicVideo = MUSIC_VIDEO_PATTERNS.some((p) => p.test(text));
    const isExplicitAudio = OFFICIAL_AUDIO_PATTERNS.some((p) => p.test(text));
    const hasMusicSignal = MUSIC_CONTENT_SIGNALS.some((p) => p.test(text));

    // Check if artist name is directly present in raw title (indicates official upload / legitimate artist)
    const isArtistOfficial = artist.length > 2 && rawTitle.toLowerCase().includes(artist.toLowerCase()) &&
      !isReaction && !isSlowed && !isFanEdit && !isCompilation && !isShort;

    // 2. Strict Content Type Assignment
    let contentType = CONTENT_TYPES.UNKNOWN;

    if (isPodcast) {
      contentType = CONTENT_TYPES.PODCAST;
      reasons.push('podcast_keywords');
    } else if (isReaction) {
      contentType = CONTENT_TYPES.REACTION;
      reasons.push('reaction_keywords');
    } else if (isShort) {
      contentType = CONTENT_TYPES.SHORT;
      reasons.push('short_duration_or_keywords');
    } else if (isSlowed) {
      contentType = CONTENT_TYPES.SLOWED;
      reasons.push('slowed_reverb_lofi_keywords');
    } else if (isFanEdit) {
      contentType = CONTENT_TYPES.VIDEO;
      reasons.push('fan_edit_amv_keywords');
    } else if (isRemix) {
      contentType = CONTENT_TYPES.REMIX;
      reasons.push('remix_mashup_keywords');
    } else if (isCover) {
      contentType = CONTENT_TYPES.COVER;
      reasons.push('cover_tribute_keywords');
    } else if (isLyricsVideo) {
      contentType = CONTENT_TYPES.LYRICS;
      reasons.push('lyrics_video_keywords');
    } else if (isLive) {
      contentType = CONTENT_TYPES.LIVE;
      reasons.push('live_performance_keywords');
    } else if (isMusicVideo) {
      contentType = CONTENT_TYPES.VIDEO;
      reasons.push('music_video_keywords');
    } else if (isTopicChannel || isExplicitAudio || (isRecognizedPublisher && !isCover && !isLive && !isRemix && !isSlowed) || (isArtistOfficial && !isCover && !isRemix && !isSlowed)) {
      contentType = CONTENT_TYPES.MUSIC;
      reasons.push('official_music_recording');
    } else if (hasMusicSignal && duration >= 90 && duration <= 480) {
      contentType = CONTENT_TYPES.MUSIC;
      reasons.push('music_keywords_and_standard_duration');
    } else {
      contentType = CONTENT_TYPES.UNKNOWN;
      reasons.push('unclassified_video_upload');
    }

    // 3. Flags Computation
    const isOfficialAudio = (isTopicChannel || isExplicitAudio || (isRecognizedPublisher && contentType === CONTENT_TYPES.MUSIC) || (isArtistOfficial && !isMusicVideo && !isLyricsVideo)) &&
      !isSlowed && !isRemix && !isCover && !isLyricsVideo && !isMusicVideo && !isFanEdit && !isReaction;

    const isOfficialMusic = (isOfficialAudio || isTopicChannel || isRecognizedPublisher || isArtistOfficial) &&
      !isSlowed && !isCover && !isReaction && !isCompilation && !isShort && !isFanEdit;

    const isAudioOnly = contentType === CONTENT_TYPES.MUSIC && (isOfficialAudio || !isMusicVideo);

    const cleanTitle = this.cleanTitle(rawTitle);
    const cleanArtist = this.cleanArtist(artist);
    const musicEntityKey = `${cleanTitle.toLowerCase()} | ${cleanArtist.toLowerCase()}`;

    return {
      contentType,
      isOfficialMusic: !!isOfficialMusic,
      isAudioOnly: !!isAudioOnly,
      isMusicVideo: !!isMusicVideo,
      isLive: !!isLive,
      isCover: !!isCover,
      isRemix: !!isRemix,
      isSlowed: !!isSlowed,
      isLyricsVideo: !!isLyricsVideo,
      isShort: !!isShort,
      isReaction: !!isReaction,
      isCompilation: !!isCompilation,
      musicEntityKey,
      cleanTitle,
      cleanArtist,
      reasons,
    };
  },

  /**
   * Normalizes a raw track item with explicit metadata flags and content type
   */
  normalizeTrack(rawTrack = {}) {
    const rawTitle = rawTrack.title || rawTrack.rawTitle || '';
    const artist = (rawTrack.artist || rawTrack.uploaderName || '').trim();
    const duration = Number(rawTrack.duration) || 210;

    const classification = this.classifySearchResult(rawTrack);

    return {
      id: rawTrack.id || rawTrack.videoId || 'trk_' + Math.random().toString(36).substring(2, 9),
      title: classification.cleanTitle || rawTitle || 'Untitled Track',
      rawTitle,
      artist: classification.cleanArtist || artist || 'Popular Artist',
      album: rawTrack.album || (classification.isOfficialMusic ? 'Single' : null),
      thumbnail: rawTrack.thumbnail || (rawTrack.id ? `https://i.ytimg.com/vi/${rawTrack.id}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400'),
      duration,
      views: rawTrack.views || null,
      genre: rawTrack.genre || 'Pop',
      contentType: classification.contentType,
      isOfficialMusic: classification.isOfficialMusic,
      isAudioOnly: classification.isAudioOnly,
      isMusicVideo: classification.isMusicVideo,
      isLive: classification.isLive,
      isCover: classification.isCover,
      isRemix: classification.isRemix,
      isSlowed: classification.isSlowed,
      isLyricsVideo: classification.isLyricsVideo,
      isShort: classification.isShort,
      isReaction: classification.isReaction,
      isCompilation: classification.isCompilation,
      musicEntityKey: classification.musicEntityKey,
      sourceType: rawTrack.sourceType || 'catalog',
      provider: 'youtube',
      providerTrackId: rawTrack.id || rawTrack.videoId || rawTrack.providerTrackId,
      playbackFormat: (classification.contentType === CONTENT_TYPES.VIDEO || classification.isMusicVideo) ? 'video' : 'audio',
    };
  },

  /**
   * Computes musicScore based on query intent, music identity, fuzzy text match, and heavy penalties
   */
  scoreCandidate(track, intent = {}) {
    let score = 0;
    const cleanQuery = (intent.cleanQuery || '').toLowerCase();
    const fuzzyQuery = normalizeFuzzy(cleanQuery);

    const titleFuzzy = normalizeFuzzy(track.title || '');
    const rawTitleFuzzy = normalizeFuzzy(track.rawTitle || '');
    const artistFuzzy = normalizeFuzzy(track.artist || '');
    const text = `${(track.rawTitle || '').toLowerCase()} ${(track.artist || '').toLowerCase()}`;

    // 1. Text Matching Signals (0 - 100 pts)
    if (fuzzyQuery) {
      if (titleFuzzy === fuzzyQuery) {
        score += 80;
      } else if (titleFuzzy.startsWith(fuzzyQuery)) {
        score += 50;
      } else if (titleFuzzy.includes(fuzzyQuery)) {
        score += 30;
      }

      if (artistFuzzy === fuzzyQuery || artistFuzzy.includes(fuzzyQuery)) {
        score += 35;
      }
      if (rawTitleFuzzy.includes(fuzzyQuery)) {
        score += 20;
      }
    }

    // 2. Official Music & Publisher Signals (0 - 90 pts)
    if (track.isOfficialMusic) score += 40;
    if (track.isAudioOnly) score += 40;
    if (track.contentType === CONTENT_TYPES.MUSIC) score += 40;

    if (RECOGNIZED_MUSIC_PUBLISHERS.some((ch) => text.includes(ch)) || text.includes('- topic')) {
      score += 40;
    }

    // 3. Duration Quality (120s - 360s typical song)
    if (track.duration >= 120 && track.duration <= 360) {
      score += 15;
    } else if (track.duration >= 60 && track.duration <= 600) {
      score += 5;
    }

    // 4. Explicit User Intent Boosts
    if (intent.wantsLyrics) {
      if (track.isLyricsVideo || track.contentType === CONTENT_TYPES.LYRICS) score += 180;
      else score -= 80;
    }
    if (intent.wantsVideo) {
      if (track.isMusicVideo || track.contentType === CONTENT_TYPES.VIDEO) score += 180;
      else score -= 80;
    }
    if (intent.wantsLive) {
      if (track.isLive || track.contentType === CONTENT_TYPES.LIVE) score += 180;
      else score -= 80;
    }
    if (intent.wantsSlowed) {
      if (track.isSlowed || track.contentType === CONTENT_TYPES.SLOWED) score += 180;
      else score -= 80;
    }
    if (intent.wantsRemix) {
      if (track.isRemix || track.contentType === CONTENT_TYPES.REMIX) score += 180;
      else score -= 80;
    }
    if (intent.wantsCover) {
      if (track.isCover || track.contentType === CONTENT_TYPES.COVER) score += 180;
      else score -= 80;
    }
    if (intent.wantsPodcast) {
      if (track.isPodcast || track.contentType === CONTENT_TYPES.PODCAST) score += 200;
      else score -= 100;
    }

    // 5. Heavy Negative Penalties for Non-Requested Variant Spam in Normal Queries
    if (!intent.wantsSlowed && (track.isSlowed || track.contentType === CONTENT_TYPES.SLOWED)) score -= 120;
    if (!intent.wantsRemix && (track.isRemix || track.contentType === CONTENT_TYPES.REMIX || text.includes('amv') || text.includes('edit'))) score -= 120;
    if (!intent.wantsCover && (track.isCover || track.contentType === CONTENT_TYPES.COVER)) score -= 100;
    if (!intent.wantsLyrics && (track.isLyricsVideo || track.contentType === CONTENT_TYPES.LYRICS)) score -= 80;
    if (!intent.wantsLive && (track.isLive || track.contentType === CONTENT_TYPES.LIVE)) score -= 70;
    if (!intent.wantsVideo && (track.isMusicVideo || track.contentType === CONTENT_TYPES.VIDEO)) score -= 40;

    if (track.isShort || track.contentType === CONTENT_TYPES.SHORT) score -= 150;
    if (track.isReaction || track.contentType === CONTENT_TYPES.REACTION) score -= 180;
    if (track.isCompilation) score -= 200;
    if (track.contentType === CONTENT_TYPES.UNKNOWN) score -= 60;

    return Math.max(0, score);
  },

  /**
   * Computes videoScore for candidate video items
   */
  scoreVideoCandidate(track, intent = {}) {
    let score = 0;
    const text = `${track.rawTitle} ${track.artist}`.toLowerCase();
    const cleanQuery = (intent.cleanQuery || '').toLowerCase();
    const fuzzyQuery = normalizeFuzzy(cleanQuery);
    const titleFuzzy = normalizeFuzzy(track.title || '');

    if (fuzzyQuery) {
      if (titleFuzzy === fuzzyQuery) score += 50;
      else if (titleFuzzy.includes(fuzzyQuery)) score += 30;
      else if (normalizeFuzzy(text).includes(fuzzyQuery)) score += 20;
    }

    if (track.isMusicVideo) score += 60;
    if (track.isLyricsVideo) score += 50;
    if (track.isLive) score += 45;
    if (track.isCover) score += 35;
    if (track.isRemix) score += 30;
    if (track.isSlowed) score += 25;

    if (intent.wantsVideo && track.isMusicVideo) score += 80;
    if (intent.wantsLyrics && track.isLyricsVideo) score += 80;

    if (track.isReaction) score -= 100;
    if (track.isShort) score -= 90;
    if (track.isCompilation) score -= 120;

    return Math.max(0, score);
  },

  classify(title, artist = '', duration = 0) {
    const classification = this.classifySearchResult({ title, artist, duration });
    return classification.contentType;
  },

  isCompilation(title, artist = '', duration = 0) {
    const text = `${title} ${artist}`.toLowerCase();
    return duration > 900 || COMPILATION_PATTERNS.some((p) => p.test(text));
  },

  cleanTitle(title) {
    if (!title) return '';
    let cleaned = title
      .replace(/^(official|lyrical|audio|video|exclusive|full\s*song|hd|4k)\s*[:|-]\s*/gi, '')
      .replace(/\s*\(Official\s*(Music\s*)?Video\)/gi, '')
      .replace(/\s*\[Official\s*(Music\s*)?Video\]/gi, '')
      .replace(/\s*\(Official\s*Audio\)/gi, '')
      .replace(/\s*\[Official\s*Audio\]/gi, '')
      .replace(/\s*\(Lyric\s*Video\)/gi, '')
      .replace(/\s*\[Lyric\s*Video\]/gi, '')
      .replace(/\s*\(Official\s*Lyric\s*Video\)/gi, '')
      .replace(/\s*\[Official\s*Lyric\s*Video\]/gi, '')
      .replace(/\s*\(Full\s*Audio\s*Song\)/gi, '')
      .replace(/\s*\[Full\s*Audio\s*Song\]/gi, '')
      .replace(/\s*\(Full\s*Video\s*Song\)/gi, '')
      .replace(/\s*\[Full\s*Video\s*Song\]/gi, '')
      .replace(/\s*\(Full\s*Song\)/gi, '')
      .replace(/\s*\[Full\s*Song\]/gi, '')
      .replace(/\s*\(Audio\)/gi, '')
      .replace(/\s*\[Audio\]/gi, '')
      .replace(/\s*\(Video\)/gi, '')
      .replace(/\s*\[Video\]/gi, '')
      .replace(/\s*\|\s*.*$/g, '')
      .replace(/\s*Full\s*(AUDIO|VIDEO|Song)\s*(Song)?/gi, '')
      .replace(/\s*with\s*lyrics/gi, '')
      .trim();

    if (!cleaned) return title.trim();
    return cleaned;
  },

  cleanArtist(artist) {
    if (!artist) return '';
    return artist
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/\s*VEVO$/i, '')
      .trim();
  },
};
