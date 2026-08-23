import { contentClassifier, CONTENT_TYPES } from './contentClassifier.js';
import { searchRelevanceEngine } from './searchRelevanceEngine.js';

function cleanSlug(text = '') {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Memory cache for validated playback sources keyed by canonicalTrackId + format
const sourceCache = new Map();
const SOURCE_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export const trackIdentityManager = {
  /**
   * Generates a stable, deterministic canonicalTrackId
   */
  generateCanonicalTrackId(title = '', artist = '') {
    const cleanTitle = contentClassifier.cleanTitle(title);
    const cleanArtist = contentClassifier.cleanArtist(artist);
    const tSlug = cleanSlug(cleanTitle) || 'unknown-track';
    const aSlug = cleanSlug(cleanArtist) || 'unknown-artist';
    return `${tSlug}|${aSlug}`;
  },

  /**
   * Validates whether a candidate playback stream legitimately belongs to the canonical track
   * Returns a confidence score (0 to 100) and validation details.
   */
  validateSourceIdentity(canonicalTrack, candidateSource) {
    if (!canonicalTrack || !candidateSource) {
      return { isValid: false, confidenceScore: 0, reason: 'MISSING_DATA' };
    }

    const normCanonTitle = searchRelevanceEngine.normalize(canonicalTrack.title);
    const normCanonArtist = searchRelevanceEngine.normalize(canonicalTrack.artist);
    const canonDuration = canonicalTrack.duration || 210;

    const candRawTitle = candidateSource.rawTitle || candidateSource.title || '';
    const candCleanTitle = contentClassifier.cleanTitle(candRawTitle);
    const normCandTitle = searchRelevanceEngine.normalize(candCleanTitle);
    const normCandRawTitle = searchRelevanceEngine.normalize(candRawTitle);

    const candRawArtist = candidateSource.artist || candidateSource.uploaderName || '';
    const candCleanArtist = contentClassifier.cleanArtist(candRawArtist);
    const normCandArtist = searchRelevanceEngine.normalize(candCleanArtist);
    const normCandRawArtist = searchRelevanceEngine.normalize(candRawArtist);

    const candDuration = candidateSource.duration || 210;
    const durDiff = Math.abs(candDuration - canonDuration);

    const classification = contentClassifier.classifySearchResult(candidateSource);

    // Skip extreme negative indicators (reactions, shorts, compilations)
    if (classification.isReaction || classification.isShort || classification.isCompilation) {
      return { isValid: false, confidenceScore: 0, reason: 'REACTION_OR_COMPILATION' };
    }

    let confidenceScore = 0;

    // 1. TITLE VALIDATION
    const canonTitleTokens = searchRelevanceEngine.tokenize(normCanonTitle);
    let matchedTitleTokens = 0;
    for (const token of canonTitleTokens) {
      if (normCandRawTitle.includes(token)) matchedTitleTokens++;
    }
    const titleMatchRatio = canonTitleTokens.length > 0 ? matchedTitleTokens / canonTitleTokens.length : 0;

    if (normCandTitle === normCanonTitle || normCandRawTitle === normCanonTitle) {
      confidenceScore += 50; // Exact title match
    } else if (normCandRawTitle.includes(normCanonTitle) || normCanonTitle.includes(normCandTitle)) {
      confidenceScore += 40; // Phrase match
    } else if (titleMatchRatio >= 0.7) {
      confidenceScore += Math.round(titleMatchRatio * 35);
    } else {
      // Title mismatch - fatal for source identity
      return {
        isValid: false,
        confidenceScore: 0,
        reason: `TITLE_MISMATCH: "${candCleanTitle}" does not match "${canonicalTrack.title}"`,
      };
    }

    // 2. ARTIST VALIDATION
    const canonArtistTokens = searchRelevanceEngine.tokenize(normCanonArtist);
    let matchedArtistTokens = 0;
    for (const token of canonArtistTokens) {
      if (normCandRawTitle.includes(token) || normCandRawArtist.includes(token)) {
        matchedArtistTokens++;
      }
    }
    const artistMatchRatio = canonArtistTokens.length > 0 ? matchedArtistTokens / canonArtistTokens.length : 0;

    const isVerifiedLabel =
      /t-series|sony\s*music|zee\s*music|yrf|tips|speed\s*records|white\s*hill|vevo|topic/i.test(
        candRawArtist
      );

    if (normCandArtist === normCanonArtist || normCandRawTitle.includes(normCanonArtist)) {
      confidenceScore += 30;
    } else if (artistMatchRatio >= 0.5 || isVerifiedLabel) {
      confidenceScore += 20;
    } else {
      // Artist mismatch penalty
      confidenceScore -= 30;
    }

    // 3. DURATION VALIDATION (Studio Audio Tolerance)
    if (durDiff <= 15) {
      confidenceScore += 20;
    } else if (durDiff <= 35) {
      confidenceScore += 10;
    } else if (durDiff > 120 && !classification.isMusicVideo) {
      confidenceScore -= 40; // Severe duration mismatch
    }

    // 4. FORMAT BONUS
    if (classification.isOfficialMusic) confidenceScore += 15;
    if (classification.contentType === CONTENT_TYPES.MUSIC) confidenceScore += 10;

    const isValid = confidenceScore >= 50 && titleMatchRatio >= 0.5;

    return {
      isValid,
      confidenceScore: Math.max(0, Math.min(100, confidenceScore)),
      reason: isValid ? 'VALID_IDENTITY_MATCH' : 'INSUFFICIENT_CONFIDENCE',
    };
  },

  /**
   * Resolves the verified playback source for a canonical track
   */
  resolvePlaybackSource(canonicalTrack, candidates = [], targetFormat = 'audio') {
    if (!canonicalTrack) return null;

    const cacheKey = `source:${canonicalTrack.canonicalTrackId || canonicalTrack.id}:${targetFormat}`;
    const cached = sourceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SOURCE_CACHE_TTL_MS) {
      return cached.source;
    }

    let bestSource = null;
    let highestConfidence = -1;

    for (const cand of candidates) {
      const validation = this.validateSourceIdentity(canonicalTrack, cand);
      if (!validation.isValid) continue;

      let score = validation.confidenceScore;
      const classification = contentClassifier.classifySearchResult(cand);

      if (targetFormat === 'audio') {
        if (classification.contentType === CONTENT_TYPES.MUSIC && !classification.isMusicVideo) {
          score += 20; // Prefer pure audio
        }
        if (cand.title?.toLowerCase().includes('official audio') || cand.rawTitle?.toLowerCase().includes('- topic')) {
          score += 15;
        }
      } else {
        if (classification.isMusicVideo || classification.contentType === CONTENT_TYPES.VIDEO) {
          score += 30;
        }
      }

      if (score > highestConfidence) {
        highestConfidence = score;
        bestSource = {
          sourceId: `src_${cand.id || cand.videoId}`,
          canonicalTrackId: canonicalTrack.canonicalTrackId || canonicalTrack.id,
          provider: 'youtube',
          providerTrackId: cand.id || cand.videoId,
          title: canonicalTrack.title,
          artist: canonicalTrack.artist,
          duration: cand.duration || canonicalTrack.duration,
          format: targetFormat,
          confidenceScore: validation.confidenceScore,
        };
      }
    }

    if (bestSource) {
      sourceCache.set(cacheKey, { timestamp: Date.now(), source: bestSource });
    }

    return bestSource;
  },
};
