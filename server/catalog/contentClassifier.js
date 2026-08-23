/**
 * Content Classifier & Normalizer for MRJ Music
 * Distinguishes official music, audio-first songs, videos, podcasts, covers, remixes, and compilations.
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

const REACTION_PATTERNS = [/\breaction\b/i, /\breacts\b/i, /\bfirst\s*time\s*hearing\b/i, /\breview\b/i];
const REMIX_PATTERNS = [/\bremix\b/i, /\bclub\s*mix\b/i, /\bedm\s*mix\b/i, /\bdj\s*mix\b/i, /\bdj\b/i];
const SLOWED_PATTERNS = [/\bslowed(\s*and\s*reverb)?\b/i, /\breverb\b/i, /\b8d\s*audio\b/i];
const LIVE_PATTERNS = [/\blive\b/i, /\bconcert\b/i, /\btour\b/i, /\bacoustic\s*live\b/i, /\bunplugged\b/i];
const LYRIC_PATTERNS = [/\blyric\s*video\b/i, /\blyrics\b/i, /\bwith\s*lyrics\b/i, /\blyrical\b/i];
const COVER_PATTERNS = [/\bcover\b/i, /\bacoustic\s*cover\b/i, /\btribute\b/i, /\bkaraoke\b/i, /\binstrumental\b/i];
const OFFICIAL_AUDIO_PATTERNS = [/\bofficial\s*audio\b/i, /\baudio\s*track\b/i, /\bprovided\s*to\s*youtube\b/i, /\boriginal\s*soundtrack\b/i, /\bauto-generated\b/i];
const OFFICIAL_VIDEO_PATTERNS = [/\bofficial\s*video\b/i, /\bofficial\s*music\s*video\b/i, /\bmusic\s*video\b/i, /\bfull\s*video\s*song\b/i, /\bvideo\s*song\b/i];
const PODCAST_PATTERNS = [/\bpodcast\b/i, /\bepisode\s*\d+\b/i, /\btalk\s*show\b/i, /\binterview\b/i];

export const contentClassifier = {
  /**
   * Normalizes a raw track item with explicit metadata flags and content type
   */
  normalizeTrack(rawTrack = {}) {
    const title = rawTrack.title || '';
    const artist = rawTrack.artist || '';
    const duration = Number(rawTrack.duration) || 210;
    const text = `${title} ${artist}`.toLowerCase();

    const isCompilation = duration > 900 || COMPILATION_PATTERNS.some((p) => p.test(text));
    const isReaction = REACTION_PATTERNS.some((p) => p.test(text));
    const isPodcast = PODCAST_PATTERNS.some((p) => p.test(text));
    const isLive = LIVE_PATTERNS.some((p) => p.test(text));
    const isRemix = REMIX_PATTERNS.some((p) => p.test(text));
    const isSlowed = SLOWED_PATTERNS.some((p) => p.test(text));
    const isCover = COVER_PATTERNS.some((p) => p.test(text));
    const isLyricVideo = LYRIC_PATTERNS.some((p) => p.test(text));
    const isOfficialAudio = OFFICIAL_AUDIO_PATTERNS.some((p) => p.test(text));
    const isMusicVideo = OFFICIAL_VIDEO_PATTERNS.some((p) => p.test(text));
    const isLabelUpload = OFFICIAL_LABEL_CHANNELS.some((ch) => text.includes(ch));

    const isOfficialMusic = isOfficialAudio || isLabelUpload || (!isCover && !isReaction && !isCompilation);
    const isAudioOnly = isOfficialAudio || (!isMusicVideo && !isReaction && !isPodcast);

    let contentType = CONTENT_TYPES.MUSIC;
    if (isPodcast) contentType = CONTENT_TYPES.PODCAST;
    else if (isMusicVideo || isReaction) contentType = CONTENT_TYPES.VIDEO;

    return {
      id: rawTrack.id || 'trk_' + Math.random().toString(36).substring(2, 9),
      title: this.cleanTitle(title),
      rawTitle: title,
      artist: artist || 'Unknown Artist',
      album: rawTrack.album || 'Single',
      thumbnail: rawTrack.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
      duration,
      views: rawTrack.views,
      genre: rawTrack.genre || 'Pop',
      contentType,
      isOfficialMusic,
      isAudioOnly,
      isMusicVideo,
      isLive,
      isRemix: isRemix || isSlowed,
      isCover,
      isPodcast,
      isCompilation,
      isReaction,
      sourceType: rawTrack.sourceType || 'catalog',
      provider: rawTrack.provider || 'youtube',
      providerTrackId: rawTrack.providerTrackId || rawTrack.id,
      playbackFormat: 'audio',
    };
  },

  /**
   * Scores and ranks candidate tracks based on music-first rules and query intent
   */
  scoreCandidate(track, intent = {}) {
    let score = 0;
    const text = `${track.title} ${track.artist}`.toLowerCase();
    const query = (intent.cleanQuery || '').toLowerCase();

    // 1. Text match (0 - 60 pts)
    if (query) {
      if (text.includes(query)) score += 40;
      if (track.title.toLowerCase().startsWith(query)) score += 20;
      if (track.artist.toLowerCase().startsWith(query)) score += 15;
    }

    // 2. Music-First Audio Preference (0 - 50 pts)
    if (track.contentType === CONTENT_TYPES.MUSIC) score += 40;
    if (track.isOfficialMusic) score += 25;
    if (track.isAudioOnly) score += 20;
    if (track.duration >= 120 && track.duration <= 360) score += 15; // Typical song length

    // 3. Intent-Driven Adjustments
    if (intent.wantsLyrics && track.isLyricVideo) score += 50;
    if (intent.wantsLive && track.isLive) score += 50;
    if (intent.wantsCover && track.isCover) score += 50;
    if (intent.wantsRemix && track.isRemix) score += 50;
    if (intent.wantsSlowed && track.isSlowed) score += 50;
    if (intent.wantsVideo && track.isMusicVideo) score += 60;
    if (intent.wantsPodcast && track.isPodcast) score += 70;

    // 4. Penalties for non-requested modifications / spam
    if (!intent.wantsCover && track.isCover) score -= 30;
    if (!intent.wantsLive && track.isLive) score -= 25;
    if (!intent.wantsRemix && track.isRemix) score -= 20;
    if (track.isReaction) score -= 80;
    if (track.isCompilation) score -= 90;
    if (track.contentType === CONTENT_TYPES.VIDEO && !intent.wantsVideo) score -= 15;

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
