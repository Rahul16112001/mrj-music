import axios from 'axios';
import { contentClassifier, CONTENT_TYPES } from './contentClassifier.js';
import { searchRelevanceEngine } from './searchRelevanceEngine.js';
import { searchYouTubeHighEnd } from './youtubeScraper.js';

function cleanSlug(text = '') {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function extractPrimarySongTitle(rawTitle) {
  let t = rawTitle || '';
  t = t.replace(/^(exclusive|official|lyrical|video|audio|full\s*song|hd|4k)\s*[:|-]\s*/i, '');
  t = t.replace(/^[\"\'\s]+|[\"\'\s]+$/g, '');

  const cutMatch = t.match(/^(.*?)(?:\s*(?:full\s*(?:audio|video|song|track)|official\s*(?:video|audio|song)|lyrical(?:\s*video)?|video\s*song|audio\s*song|lyrics|\(|\||-|:))/i);
  if (cutMatch && cutMatch[1] && cutMatch[1].trim().length >= 2) {
    return cutMatch[1].trim().replace(/^[\"\'\s]+|[\"\'\s]+$/g, '');
  }
  return t.split(/[\-\|\:]/)[0].trim();
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

    // 3. TITLE MATCHING & ALBUM TRACK DISAMBIGUATION
    // Disambiguate different songs in the same album (e.g. Love Dose in Desi Kalakaar album)
    const extractedSongName = extractPrimarySongTitle(candRawTitle);
    const normExtractedSongName = searchRelevanceEngine.normalize(extractedSongName);

    if (
      normExtractedSongName.length >= 3 &&
      !normExtractedSongName.includes(normCanonTitle) &&
      !normCanonTitle.includes(normExtractedSongName)
    ) {
      const targetTokens = searchRelevanceEngine.tokenize(normCanonTitle);
      const extractedTokens = searchRelevanceEngine.tokenize(normExtractedSongName);
      const matched = targetTokens.filter((t) => extractedTokens.includes(t)).length;
      if (matched === 0) {
        return {
          isValid: false,
          confidenceScore: 0,
          reason: `DIFFERENT_SONG_IN_SAME_ALBUM: Candidate primary song "${extractedSongName}" does not match target "${canonicalTrack.title}"`,
        };
      }
    }

    const canonTitleTokens = searchRelevanceEngine.tokenize(normCanonTitle);
    let matchedTitleTokens = 0;
    for (const token of canonTitleTokens) {
      if (normCandRawTitle.includes(token)) matchedTitleTokens++;
    }
    const titleMatchRatio = canonTitleTokens.length > 0 ? matchedTitleTokens / canonTitleTokens.length : 0;

    let confidenceScore = 0;

    if (normCandTitle === normCanonTitle || normCandRawTitle === normCanonTitle || normExtractedSongName === normCanonTitle) {
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

    // 4. ARTIST MATCHING & STRICT SINGER DISAMBIGUATION
    const canonArtistTokens = searchRelevanceEngine.tokenize(normCanonArtist);
    let matchedArtistTokens = 0;
    for (const token of canonArtistTokens) {
      if (token.length > 2 && (normCandRawTitle.includes(token) || normCandRawArtist.includes(token))) {
        matchedArtistTokens++;
      }
    }
    const artistMatchRatio = canonArtistTokens.length > 0 ? matchedArtistTokens / canonArtistTokens.length : 0;
    const isTopicChannel = normCandRawArtist.includes('topic') && (normCandRawArtist.includes(normCanonArtist) || artistMatchRatio >= 0.5);

    // Hard reject if artist does not match (prevents wrong singer playing under common song title)
    if (artistMatchRatio < 0.4 && !isTopicChannel) {
      return {
        isValid: false,
        confidenceScore: 0,
        reason: `ARTIST_MISMATCH: Candidate "${candRawArtist}" - "${candRawTitle}" does not match singer "${canonicalTrack.artist}"`,
      };
    }

    if (normCandArtist === normCanonArtist || normCandRawTitle.includes(normCanonArtist)) {
      confidenceScore += 35;
    } else if (artistMatchRatio >= 0.5 || isTopicChannel) {
      confidenceScore += 25;
    } else {
      confidenceScore -= 30;
    }

    // 5. DURATION PROXIMITY SCORING (Strict Studio Track Duration Lock)
    if (targetFormat === 'audio') {
      if (durDiff > 45) {
        return {
          isValid: false,
          confidenceScore: 0,
          reason: `DURATION_MISMATCH: Candidate duration ${candDuration}s vs canonical ${canonDuration}s (Diff ${durDiff}s exceeds tolerance)`,
        };
      }
      if (durDiff <= 8) {
        confidenceScore += 40; // Exact album master duration match
      } else if (durDiff <= 20) {
        confidenceScore += 20;
      } else if (durDiff > 30) {
        confidenceScore -= 40;
      }
    } else {
      if (durDiff <= 25) confidenceScore += 20;
    }

    // 6. VERIFIED RECORD LABEL & CHANNEL BONUSES
    const isRecognizedLabel =
      /t-series|sony\s*music|zee\s*music|speed\s*records|yrf|tips|saregama|white\s*hill|vevo|topic|universal|warner|aditya\s*music/i.test(
        candRawArtist
      );
    if (isRecognizedLabel || isTopicChannel) {
      confidenceScore += 30;
    }

    // 7. FORMAT & RECORDING BONUSES
    if (targetFormat === 'audio') {
      const isOfficialAudio =
        normCandRawTitle.includes('official audio') ||
        normCandRawTitle.includes('full audio') ||
        normCandRawTitle.includes('audio song') ||
        normCandRawArtist.includes('topic') ||
        normCandRawTitle.includes('पूरा ऑडियो');

      if (isOfficialAudio) confidenceScore += 35;
      if (classification.isOfficialMusic) confidenceScore += 20;
      if (classification.contentType === CONTENT_TYPES.MUSIC && !classification.isMusicVideo) confidenceScore += 15;
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
    const cacheKey = `source_v3:${canonId}:${targetFormat}`;
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
    const cacheKey = `source_v3:${canonId}:${targetFormat}`;
    const cached = sourceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SOURCE_CACHE_TTL_MS) {
      return cached.source;
    }

    try {
      const audioQueries = [
        `${canonicalTrack.artist} - Topic ${canonicalTrack.title}`,
        `${canonicalTrack.title} ${canonicalTrack.artist} official audio`,
        `${canonicalTrack.title} ${canonicalTrack.artist} audio`,
      ];
      const videoQueries = [
        `${canonicalTrack.title} ${canonicalTrack.artist} official video`,
        `${canonicalTrack.title} ${canonicalTrack.artist}`,
      ];

      const queries = targetFormat === 'audio' ? audioQueries : videoQueries;

      const scrapePromises = queries.map(q => searchYouTubeHighEnd(q, 15));
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
