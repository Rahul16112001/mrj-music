/**
 * Content Classifier & Normalizer for MRJ Music
 * Distinguishes official music tracks, music videos, lyrics videos, live performances, covers, remixes, and podcasts.
 */

export const CONTENT_TYPES = {
  MUSIC: 'music',
  VIDEO: 'video',
  PODCAST: 'podcast',
  UNKNOWN: 'unknown',
};

const OFFICIAL_LABEL_CHANNELS = [
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
  'ed sheeran',
  'taylor swift',
  'the weeknd',
  'arijit singh',
  'shreya ghoshal',
  'coldplay',
  'dua lipa',
  'imagine dragons',
  'justin bieber',
  'billie eilish',
  'bad bunny',
  'drake',
  'eminem',
  'bruno mars',
];

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

const FAN_EDIT_PATTERNS = [
  /\b(amv|anime\s*mix|anime\s*music\s*video|fanmade|fan\s*made|status\s*video|whatsapp\s*status|shorts?|reels?|tiktok)\b/i,
];

const REACTION_PATTERNS = [/\breaction\b/i, /\breacts\b/i, /\bfirst\s*time\s*hearing\b/i, /\breview\b/i, /\bvlog\b/i];
const REMIX_PATTERNS = [/\bremix\b/i, /\bclub\s*mix\b/i, /\bedm\s*mix\b/i, /\bdj\s*mix\b/i, /\bdj\b/i, /\bmashup\b/i];
const SLOWED_PATTERNS = [/\bslowed(\s*and\s*reverb)?\b/i, /\breverb\b/i, /\b8d\s*audio\b/i, /\blofi\s*flip\b/i];
const LIVE_PATTERNS = [/\blive\b/i, /\bconcert\b/i, /\btour\b/i, /\bacoustic\s*live\b/i, /\bunplugged\b/i, /\bperformance\b/i];
const LYRIC_PATTERNS = [/\blyric\s*video\b/i, /\blyrics\b/i, /\bwith\s*lyrics\b/i, /\blyrical(\s*video)?\b/i];
const COVER_PATTERNS = [/\bcover\b/i, /\bacoustic\s*cover\b/i, /\btribute\b/i, /\bkaraoke\b/i, /\binstrumental\b/i, /\bfemale\s*version\b/i, /\bmale\s*version\b/i];
const OFFICIAL_AUDIO_PATTERNS = [/\bofficial\s*audio\b/i, /\baudio\s*track\b/i, /\bprovided\s*to\s*youtube\b/i, /\boriginal\s*soundtrack\b/i, /\bauto-generated\b/i, /\bfull\s*audio\b/i, /\baudio\s*song\b/i];
const OFFICIAL_VIDEO_PATTERNS = [/\bofficial\s*(music\s*)?video\b/i, /\bmusic\s*video\b/i, /\bfull\s*video\s*song\b/i, /\bvideo\s*song\b/i, /\bfull\s*video\b/i, /\bmv\b/i];
const SHORT_PATTERNS = [/\b#?shorts?\b/i, /\btiktok\b/i, /\breels?\b/i];
const PODCAST_PATTERNS = [/\bpodcast\b/i, /\bepisode\s*\d+\b/i, /\btalk\s*show\b/i, /\binterview\b/i];

export const contentClassifier = {
  /**
   * Normalizes a raw track item with explicit metadata flags and content type
   */
  normalizeTrack(rawTrack = {}) {
    const rawTitle = rawTrack.title || rawTrack.rawTitle || '';
    const artist = (rawTrack.artist || rawTrack.uploaderName || '').trim();
    const duration = Number(rawTrack.duration) || 210;
    const text = `${rawTitle} ${artist}`.toLowerCase();

    const isTopicChannel = artist.toLowerCase().endsWith('- topic') || text.includes('provided to youtube');
    const isLabelOrArtistChannel = OFFICIAL_LABEL_CHANNELS.some((ch) => text.includes(ch));
    const isReaction = REACTION_PATTERNS.some((p) => p.test(text));
    const isShort = duration < 60 || SHORT_PATTERNS.some((p) => p.test(text));
    const isPodcast = PODCAST_PATTERNS.some((p) => p.test(text));
    const isCompilation = duration > 900 || COMPILATION_PATTERNS.some((p) => p.test(text));
    const isFanEdit = FAN_EDIT_PATTERNS.some((p) => p.test(text));
    const isLive = LIVE_PATTERNS.some((p) => p.test(text));
    const isRemix = REMIX_PATTERNS.some((p) => p.test(text));
    const isSlowed = SLOWED_PATTERNS.some((p) => p.test(text));
    const isCover = COVER_PATTERNS.some((p) => p.test(text));
    const isLyricsVideo = LYRIC_PATTERNS.some((p) => p.test(text));
    const isMusicVideo = OFFICIAL_VIDEO_PATTERNS.some((p) => p.test(text));

    // Explicit official audio
    const isExplicitAudio = OFFICIAL_AUDIO_PATTERNS.some((p) => p.test(text));
    const isOfficialAudio = (isTopicChannel || isExplicitAudio) && !isLyricsVideo && !isMusicVideo && !isCover && !isReaction && !isFanEdit;

    // Official music (audio track OR official verified artist/label release)
    const isOfficialMusic = (isOfficialAudio || isTopicChannel || (isLabelOrArtistChannel && !isCover && !isReaction && !isCompilation && !isShort && !isFanEdit));
    const isAudioOnly = isOfficialAudio || isTopicChannel || (!isMusicVideo && !isLyricsVideo && !isLive && !isReaction && !isPodcast && !isShort && !isCover && !isFanEdit);

    let contentType = CONTENT_TYPES.MUSIC;
    if (isPodcast) {
      contentType = CONTENT_TYPES.PODCAST;
    } else if (isReaction || isShort || isFanEdit) {
      contentType = CONTENT_TYPES.VIDEO;
    } else if (isMusicVideo || isLyricsVideo || isLive || isCover) {
      contentType = CONTENT_TYPES.VIDEO;
    } else if (isOfficialMusic || isAudioOnly) {
      contentType = CONTENT_TYPES.MUSIC;
    } else {
      contentType = CONTENT_TYPES.UNKNOWN;
    }

    const cleanTitle = this.cleanTitle(rawTitle);

    return {
      id: rawTrack.id || rawTrack.videoId || 'trk_' + Math.random().toString(36).substring(2, 9),
      title: cleanTitle || rawTitle || 'Untitled Track',
      rawTitle,
      artist: artist.replace(/\s*-\s*Topic$/i, '').trim() || 'Popular Artist',
      album: rawTrack.album || 'Single',
      thumbnail: rawTrack.thumbnail || (rawTrack.id ? `https://i.ytimg.com/vi/${rawTrack.id}/hqdefault.jpg` : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400'),
      duration,
      views: rawTrack.views || null,
      genre: rawTrack.genre || 'Pop',
      contentType,
      isOfficialMusic: !!isOfficialMusic,
      isMusicVideo: !!isMusicVideo,
      isAudioOnly: !!isAudioOnly,
      isLive: !!isLive,
      isCover: !!isCover,
      isRemix: !!isRemix,
      isSlowed: !!isSlowed,
      isLyricsVideo: !!isLyricsVideo,
      isShort: !!isShort,
      isReaction: !!isReaction,
      isCompilation: !!isCompilation,
      sourceType: rawTrack.sourceType || 'catalog',
      provider: 'youtube',
      providerTrackId: rawTrack.id || rawTrack.videoId || rawTrack.providerTrackId,
      playbackFormat: contentType === CONTENT_TYPES.VIDEO ? 'video' : 'audio',
    };
  },

  /**
   * Conceptually computes:
   * musicScore = titleMatch + artistMatch + officialMusicSignal + musicContentSignal
   *              + metadataQuality + providerQuality + durationQuality
   *              - (lyricsVideoPenalty + musicVideoPenalty + fanUploadPenalty + reactionPenalty
   *                 + shortPenalty + slowedPenalty + coverPenalty + unrelatedVideoPenalty)
   */
  scoreCandidate(track, intent = {}) {
    let score = 0;
    const titleLower = (track.title || '').toLowerCase();
    const rawTitleLower = (track.rawTitle || '').toLowerCase();
    const artistLower = (track.artist || '').toLowerCase();
    const cleanQuery = (intent.cleanQuery || '').toLowerCase();
    const text = `${rawTitleLower} ${artistLower}`;

    // 1. Text & Entity Matches (0 - 80 pts)
    if (cleanQuery) {
      if (titleLower === cleanQuery) score += 60;
      else if (titleLower.startsWith(cleanQuery)) score += 35;
      else if (titleLower.includes(cleanQuery)) score += 20;

      if (artistLower === cleanQuery || artistLower.includes(cleanQuery)) score += 30;
      if (rawTitleLower.includes(cleanQuery)) score += 15;
    }

    // 2. Official Music & Audio Signals (0 - 85 pts)
    if (track.isOfficialMusic) score += 40;
    if (track.isAudioOnly) score += 35;
    if (track.contentType === CONTENT_TYPES.MUSIC) score += 35;

    // Verified Official Artist / Label Upload (e.g. Ed Sheeran, The Weeknd, T-Series)
    if (OFFICIAL_LABEL_CHANNELS.some((ch) => text.includes(ch)) || text.includes('- topic')) {
      score += 40;
    }

    // 3. Duration Quality (120s - 360s is standard song)
    if (track.duration >= 120 && track.duration <= 360) {
      score += 15;
    } else if (track.duration >= 60 && track.duration <= 600) {
      score += 5;
    }

    // 4. Intent-Driven Boosts and Non-Intent Dampening
    if (intent.wantsLyrics) {
      if (track.isLyricsVideo) score += 150;
      else score -= 60;
    }
    if (intent.wantsVideo) {
      if (track.isMusicVideo) score += 150;
      else score -= 60;
    }
    if (intent.wantsLive) {
      if (track.isLive) score += 150;
      else score -= 60;
    }
    if (intent.wantsSlowed) {
      if (track.isSlowed) score += 150;
      else score -= 60;
    }
    if (intent.wantsRemix) {
      if (track.isRemix) score += 150;
      else score -= 60;
    }
    if (intent.wantsCover) {
      if (track.isCover) score += 150;
      else score -= 60;
    }
    if (intent.wantsPodcast) {
      if (track.isPodcast) score += 160;
      else score -= 70;
    }

    // 5. Penalties (Strict music-first: official audio > music video > lyrics video > covers/slowed/reactions)
    if (!intent.wantsVideo && track.isMusicVideo && !track.isOfficialMusic) score -= 30;
    if (!intent.wantsLyrics && track.isLyricsVideo) score -= 40;
    if (!intent.wantsSlowed && track.isSlowed) score -= 45;
    if (!intent.wantsRemix && (track.isRemix || text.includes('amv') || text.includes('anime mix'))) score -= 50;
    if (!intent.wantsCover && track.isCover) score -= 50;
    if (!intent.wantsLive && track.isLive) score -= 40;
    if (track.isShort) score -= 80;
    if (track.isReaction) score -= 90;
    if (track.isCompilation) score -= 100;
    if (track.contentType === CONTENT_TYPES.UNKNOWN) score -= 40;

    return Math.max(0, score);
  },

  /**
   * Conceptually computes videoScore for video category candidate ranking
   */
  scoreVideoCandidate(track, intent = {}) {
    let score = 0;
    const text = `${track.rawTitle} ${track.artist}`.toLowerCase();
    const cleanQuery = (intent.cleanQuery || '').toLowerCase();

    if (cleanQuery && text.includes(cleanQuery)) score += 30;
    if (track.isMusicVideo) score += 50;
    if (track.isLyricsVideo) score += 40;
    if (track.isLive) score += 35;
    if (track.isCover) score += 30;
    if (track.isRemix) score += 25;
    if (intent.wantsVideo && track.isMusicVideo) score += 60;
    if (intent.wantsLyrics && track.isLyricsVideo) score += 60;

    if (track.isReaction) score -= 70;
    if (track.isShort) score -= 60;
    if (track.isCompilation) score -= 80;

    return Math.max(0, score);
  },

  classify(title, artist = '', duration = 0) {
    const normalized = this.normalizeTrack({ title, artist, duration });
    return normalized.contentType;
  },

  isCompilation(title, artist = '', duration = 0) {
    const text = `${title} ${artist}`.toLowerCase();
    return duration > 900 || COMPILATION_PATTERNS.some((p) => p.test(text));
  },

  cleanTitle(title) {
    if (!title) return '';
    let cleaned = title
      .replace(/\s*\(Official\s*(Music\s*)?Video\)/gi, '')
      .replace(/\s*\[Official\s*(Music\s*)?Video\]/gi, '')
      .replace(/\s*\(Official\s*Audio\)/gi, '')
      .replace(/\s*\[Official\s*Audio\]/gi, '')
      .replace(/\s*\(Lyric\s*Video\)/gi, '')
      .replace(/\s*\[Lyric\s*Video\]/gi, '')
      .replace(/\s*\(Audio\)/gi, '')
      .replace(/\s*\[Audio\]/gi, '')
      .replace(/\s*\(Full\s*Video\s*Song\)/gi, '')
      .replace(/\s*\[Full\s*Video\s*Song\]/gi, '')
      .replace(/\s*\(Full\s*Audio\s*Song\)/gi, '')
      .replace(/\s*\[Full\s*Audio\s*Song\]/gi, '')
      .replace(/\s*\(Full\s*Song\)/gi, '')
      .replace(/\s*\[Full\s*Song\]/gi, '')
      .replace(/\s*\(Video\)/gi, '')
      .trim();

    if (!cleaned) return title.trim();
    return cleaned;
  },
};
