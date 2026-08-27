import axios from 'axios';
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
const SOURCE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

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
   * Strict Identity Validation: Compares a playback candidate against the canonical music entity
   */
  validateSourceIdentity(canonicalTrack, candidateSource, targetFormat = 'audio') {
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

    // 1. HARD REJECTION: Reactions, Shorts, and non-canonical Compilations
    if (classification.isReaction || classification.isShort || classification.isCompilation) {
      return { isValid: false, confidenceScore: 0, reason: 'REACTION_OR_COMPILATION' };
    }

    // 2. HARD REJECTION FOR AUDIO: Disallow 9-minute extended music videos when looking for studio audio
    if (targetFormat === 'audio') {
      if (candDuration > 480 && canonDuration < 320) {
        return {
          isValid: false,
          confidenceScore: 0,
          reason: `DURATION_MISMATCH_MUSIC_VIDEO: Candidate duration ${candDuration}s vs canonical ${canonDuration}s`,
        };
      }
      if (durDiff > 120 && !classification.isOfficialMusic) {
        return {
          isValid: false,
          confidenceScore: 0,
          reason: `DURATION_MISMATCH: Difference ${durDiff}s exceeds studio audio tolerance`,
        };
      }
    }

    // 3. TITLE MATCHING
    const canonTitleTokens = searchRelevanceEngine.tokenize(normCanonTitle);
    let matchedTitleTokens = 0;
    for (const token of canonTitleTokens) {
      if (normCandRawTitle.includes(token)) matchedTitleTokens++;
    }
    const titleMatchRatio = canonTitleTokens.length > 0 ? matchedTitleTokens / canonTitleTokens.length : 0;

    let confidenceScore = 0;

    if (normCandTitle === normCanonTitle || normCandRawTitle === normCanonTitle) {
      confidenceScore += 50; // Exact title match
    } else if (normCandRawTitle.includes(normCanonTitle) || normCanonTitle.includes(normCandTitle)) {
      confidenceScore += 40; // Phrase match
    } else if (titleMatchRatio >= 0.7) {
      confidenceScore += Math.round(titleMatchRatio * 35);
    } else {
      return {
        isValid: false,
        confidenceScore: 0,
        reason: `TITLE_MISMATCH: "${candCleanTitle}" does not match "${canonicalTrack.title}"`,
      };
    }

    // 4. ARTIST MATCHING & VERIFIED LABELS
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
      confidenceScore -= 30;
    }

    // 5. DURATION PROXIMITY SCORING
    if (durDiff <= 15) {
      confidenceScore += 20;
    } else if (durDiff <= 35) {
      confidenceScore += 10;
    } else if (durDiff > 90) {
      confidenceScore -= 25;
    }

    // 6. FORMAT & RECORDING BONUSES
    if (targetFormat === 'audio') {
      const isOfficialAudio =
        normCandRawTitle.includes('official audio') ||
        normCandRawTitle.includes('full audio') ||
        normCandRawTitle.includes('audio song') ||
        normCandRawArtist.includes('topic') ||
        normCandRawTitle.includes('पूरा ऑडियो') ||
        normCandRawTitle.includes('lyrical');

      if (isOfficialAudio) confidenceScore += 25;
      if (classification.isOfficialMusic) confidenceScore += 15;
      if (classification.contentType === CONTENT_TYPES.MUSIC) confidenceScore += 10;
    } else {
      if (classification.isMusicVideo || classification.contentType === CONTENT_TYPES.VIDEO) {
        confidenceScore += 30;
      }
    }

    const isValid = confidenceScore >= 50 && titleMatchRatio >= 0.5;

    return {
      isValid,
      confidenceScore: Math.max(0, Math.min(100, confidenceScore)),
      reason: isValid ? 'VALID_IDENTITY_MATCH' : 'INSUFFICIENT_CONFIDENCE',
    };
  },

  /**
   * Resolves the verified playback source from candidate streams
   */
  resolvePlaybackSource(canonicalTrack, candidates = [], targetFormat = 'audio') {
    const canonId =
      canonicalTrack.canonicalTrackId ||
      canonicalTrack.id ||
      this.generateCanonicalTrackId(canonicalTrack.title, canonicalTrack.artist);
    const cacheKey = `source:${canonId}:${targetFormat}`;
    const cached = sourceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SOURCE_CACHE_TTL_MS) {
      return cached.source;
    }

    let bestSource = null;
    let highestConfidence = -1;

    for (const cand of candidates) {
      const validation = this.validateSourceIdentity(canonicalTrack, cand, targetFormat);
      if (!validation.isValid) continue;

      let score = validation.confidenceScore;
      const classification = contentClassifier.classifySearchResult(cand);

      if (targetFormat === 'audio') {
        if (classification.contentType === CONTENT_TYPES.MUSIC && !classification.isMusicVideo) {
          score += 20;
        }
        if (cand.title?.toLowerCase().includes('official audio') || cand.rawTitle?.toLowerCase().includes('- topic')) {
          score += 25;
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
          canonicalTrackId: canonId,
          provider: 'youtube',
          providerTrackId: cand.id || cand.videoId,
          title: canonicalTrack.title,
          artist: canonicalTrack.artist,
          album: canonicalTrack.album || '',
          duration: cand.duration || canonicalTrack.duration,
          format: targetFormat,
          sourceType: targetFormat,
          confidenceScore: validation.confidenceScore,
        };
      }
    }

    if (bestSource) {
      sourceCache.set(cacheKey, { timestamp: Date.now(), source: bestSource });
    }

    return bestSource;
  },

  /**
   * Active Targeted Source Resolution: If pre-bound source is missing or unverified, queries YouTube with audio-first intent
   */
  async fetchAndResolveSource(canonicalTrack, targetFormat = 'audio') {
    const canonId =
      canonicalTrack.canonicalTrackId ||
      canonicalTrack.id ||
      this.generateCanonicalTrackId(canonicalTrack.title, canonicalTrack.artist);
    const cacheKey = `source:${canonId}:${targetFormat}`;
    const cached = sourceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SOURCE_CACHE_TTL_MS) {
      return cached.source;
    }

    try {
      const audioQueries = [
        `${canonicalTrack.title} ${canonicalTrack.artist} official audio`,
        `${canonicalTrack.artist} - Topic ${canonicalTrack.title}`,
        `${canonicalTrack.title} ${canonicalTrack.artist} audio`,
      ];
      const videoQueries = [
        `${canonicalTrack.title} ${canonicalTrack.artist} official video`,
        `${canonicalTrack.title} ${canonicalTrack.artist}`,
      ];

      const queries = targetFormat === 'audio' ? audioQueries : videoQueries;

      const scrapePromises = queries.map(async (queryTerm) => {
        try {
          const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(queryTerm)}`;
          const res = await axios.get(searchUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
            },
            timeout: 5000,
          });

          const candidates = [];
          const match = res.data?.match(/var ytInitialData = ({.+?});<\/script>/);
          if (match) {
            const data = JSON.parse(match[1]);
            const contents =
              data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

            for (const section of contents) {
              const items = section?.itemSectionRenderer?.contents || [];
              for (const item of items) {
                if (item.videoRenderer) {
                  const v = item.videoRenderer;
                  const videoId = v.videoId;
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
                  });
                }
              }
            }
          }
          return candidates;
        } catch {
          return [];
        }
      });

      const queryResults = await Promise.allSettled(scrapePromises);
      const allCandidates = [];
      const seenIds = new Set();

      for (const res of queryResults) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          for (const cand of res.value) {
            if (cand && cand.id && !seenIds.has(cand.id)) {
              seenIds.add(cand.id);
              allCandidates.push(cand);
            }
          }
        }
      }

      let resolved = this.resolvePlaybackSource(canonicalTrack, allCandidates, targetFormat);

      // If audio format was requested but no audio candidate matched, fallback to video queries
      if (!resolved && targetFormat === 'audio') {
        const videoResults = await Promise.allSettled(
          videoQueries.map(async (vq) => {
            try {
              const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(vq)}`;
              const res = await axios.get(searchUrl, {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                  'Accept-Language': 'en-US,en;q=0.9',
                },
                timeout: 5000,
              });
              const cands = [];
              const match = res.data?.match(/var ytInitialData = ({.+?});<\/script>/);
              if (match) {
                const data = JSON.parse(match[1]);
                const contents =
                  data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
                for (const section of contents) {
                  const items = section?.itemSectionRenderer?.contents || [];
                  for (const item of items) {
                    if (item.videoRenderer) {
                      const v = item.videoRenderer;
                      const videoId = v.videoId;
                      const rawTitle = v.title?.runs?.[0]?.text || 'Untitled';
                      const artist = v.ownerText?.runs?.[0]?.text || 'Popular Artist';
                      cands.push({
                        id: videoId,
                        videoId,
                        providerTrackId: videoId,
                        rawTitle,
                        title: rawTitle,
                        artist,
                        duration: 210,
                        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                      });
                    }
                  }
                }
              }
              return cands;
            } catch {
              return [];
            }
          })
        );

        const fallbackCandidates = [];
        for (const r of videoResults) {
          if (r.status === 'fulfilled' && Array.isArray(r.value)) {
            for (const c of r.value) {
              if (c && c.id && !seenIds.has(c.id)) {
                seenIds.add(c.id);
                fallbackCandidates.push(c);
              }
            }
          }
        }

        resolved = this.resolvePlaybackSource(canonicalTrack, fallbackCandidates, 'video');
      }

      return resolved;
    } catch (err) {
      console.warn('Targeted source resolution error:', err.message);
      return null;
    }
  },
};
