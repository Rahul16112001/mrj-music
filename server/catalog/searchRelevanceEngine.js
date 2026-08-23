import { contentClassifier, CONTENT_TYPES } from './contentClassifier.js';
import { INTENT_TYPES } from './searchIntentEngine.js';

// Hard minimum threshold for text relevance
const MIN_TEXT_RELEVANCE_THRESHOLD = 30;

function cleanString(str = '') {
  if (typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeString(str = '') {
  const clean = cleanString(str);
  return clean ? clean.split(' ').filter(Boolean) : [];
}

/**
 * Fast Levenshtein distance for fuzzy typo matching
 */
function levenshteinDistance(s1, s2) {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const d = [];
  for (let i = 0; i <= s1.length; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }

  return d[s1.length][s2.length];
}

function calculateFuzzyRatio(s1, s2) {
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s1, s2);
  return Math.max(0, (maxLen - dist) / maxLen);
}

export const searchRelevanceEngine = {
  normalize(text) {
    return cleanString(text);
  },

  tokenize(text) {
    return tokenizeString(text);
  },

  /**
   * Evaluates and scores candidate relevance against normalized query and intent
   */
  scoreCandidate(candidate, rawQuery = '', intent = {}) {
    const normQuery = cleanString(intent.cleanQuery || rawQuery);
    const queryTokens = tokenizeString(normQuery);

    if (!normQuery || queryTokens.length === 0) {
      return { relevanceScore: 0, finalScore: 0, isRelevant: false, candidate };
    }

    const rawTitle = candidate.rawTitle || candidate.title || '';
    const cleanTitle = contentClassifier.cleanTitle(rawTitle);
    const normTitle = cleanString(cleanTitle);
    const normRawTitle = cleanString(rawTitle);
    const titleTokens = tokenizeString(normTitle);

    const rawArtist = candidate.artist || '';
    const cleanArtist = contentClassifier.cleanArtist(rawArtist);
    const normArtist = cleanString(cleanArtist);
    const normRawArtist = cleanString(rawArtist);
    const artistTokens = tokenizeString(normArtist);

    const normAlbum = cleanString(candidate.album || '');
    const albumTokens = tokenizeString(normAlbum);

    const allCandidateTokens = new Set([...titleTokens, ...artistTokens, ...albumTokens]);

    // 1. HARD RELEVANCE GATE: Check for any genuine lexical connection
    let matchedQueryTokens = 0;
    for (const qToken of queryTokens) {
      if (allCandidateTokens.has(qToken)) {
        matchedQueryTokens++;
        continue;
      }
      // Check prefix token match (e.g. "desi" matches "desikalakaar")
      let hasTokenPrefix = false;
      for (const cToken of allCandidateTokens) {
        if (cToken.startsWith(qToken) || qToken.startsWith(cToken)) {
          matchedQueryTokens += 0.8;
          hasTokenPrefix = true;
          break;
        }
      }
      if (!hasTokenPrefix) {
        // Fallback fuzzy token match for small typos (e.g. "kalakar" vs "kalakaar")
        for (const cToken of allCandidateTokens) {
          if (cToken.length >= 4 && qToken.length >= 4) {
            const ratio = calculateFuzzyRatio(qToken, cToken);
            if (ratio >= 0.8) {
              matchedQueryTokens += 0.75;
              break;
            }
          }
        }
      }
    }

    const hasPhraseInTitle = normTitle.includes(normQuery) || normRawTitle.includes(normQuery);
    const hasPhraseInArtist = normArtist.includes(normQuery) || normRawArtist.includes(normQuery);
    const hasPhraseInAlbum = normAlbum.includes(normQuery);

    const hasAnyMatch = matchedQueryTokens > 0 || hasPhraseInTitle || hasPhraseInArtist || hasPhraseInAlbum;

    // If query is a single word (e.g. "desi") and candidate has no match at all, it's 100% irrelevant!
    if (!hasAnyMatch) {
      return {
        relevanceScore: 0,
        finalScore: 0,
        isRelevant: false,
        candidate,
      };
    }

    // 2. DETAILED RELEVANCE SCORING
    let relevanceScore = 0;

    // A. TITLE MATCHING (Highest Weight)
    if (normTitle === normQuery || normRawTitle === normQuery) {
      relevanceScore += 500; // EXACT TITLE MATCH
    } else if (normTitle.startsWith(normQuery) || normRawTitle.startsWith(normQuery)) {
      relevanceScore += 350; // PREFIX TITLE MATCH (e.g. "desi" matches "desi kalakaar")
    } else if (hasPhraseInTitle) {
      relevanceScore += 280; // PHRASE TITLE MATCH
    }

    // Word boundary start match (e.g. "desi" matches "superstar desi kalakaar")
    for (const tToken of titleTokens) {
      if (tToken === normQuery) {
        relevanceScore += 180;
        break;
      } else if (tToken.startsWith(normQuery)) {
        relevanceScore += 120;
        break;
      }
    }

    // Token Coverage in Title
    let titleTokenHits = 0;
    for (const qToken of queryTokens) {
      if (titleTokens.includes(qToken)) titleTokenHits++;
    }
    const titleTokenRatio = titleTokenHits / queryTokens.length;
    relevanceScore += Math.round(titleTokenRatio * 200);

    // If all query tokens exist in title (in any order)
    if (titleTokenRatio === 1.0) {
      relevanceScore += 150;
    }

    // B. ARTIST MATCHING (High Weight)
    if (normArtist === normQuery || normRawArtist === normQuery) {
      relevanceScore += 400; // EXACT ARTIST MATCH
    } else if (normArtist.startsWith(normQuery) || normRawArtist.startsWith(normQuery)) {
      relevanceScore += 250;
    } else if (hasPhraseInArtist) {
      relevanceScore += 180;
    }

    let artistTokenHits = 0;
    for (const qToken of queryTokens) {
      if (artistTokens.includes(qToken)) artistTokenHits++;
    }
    relevanceScore += Math.round((artistTokenHits / queryTokens.length) * 120);

    // C. ALBUM MATCHING (Medium Weight)
    if (normAlbum === normQuery) {
      relevanceScore += 250;
    } else if (hasPhraseInAlbum) {
      relevanceScore += 140;
    }

    // D. FUZZY MATCHING (Fallback for small spelling discrepancies)
    if (relevanceScore < 200 && queryTokens.length >= 2) {
      const fuzzyRatio = calculateFuzzyRatio(normTitle, normQuery);
      if (fuzzyRatio >= 0.75) {
        relevanceScore += Math.round(fuzzyRatio * 80);
      }
    }

    // 3. HARD THRESHOLD VALIDATION
    const isRelevant = relevanceScore >= MIN_TEXT_RELEVANCE_THRESHOLD && matchedQueryTokens >= (queryTokens.length > 1 ? 0.8 : 0.5);

    if (!isRelevant) {
      return {
        relevanceScore: 0,
        finalScore: 0,
        isRelevant: false,
        candidate,
      };
    }

    // 4. CLASSIFICATION & FORMAT SCORING
    const classification = contentClassifier.classifySearchResult(candidate);
    let finalScore = relevanceScore;

    // Boost official releases and high quality music
    if (classification.isOfficialMusic) {
      finalScore += 40;
    }
    if (classification.contentType === CONTENT_TYPES.MUSIC) {
      finalScore += 50;
    }

    // 5. INTENT & VARIANT PENALTIES
    if (!intent.wantsSlowed && !intent.wantsRemix && !intent.wantsCover && !intent.wantsLive && !intent.wantsLyrics) {
      // Normal query: Heavily penalize derivative formats
      if (classification.isSlowed) finalScore -= 250;
      if (classification.isRemix) finalScore -= 180;
      if (classification.isCover) finalScore -= 180;
      if (classification.isLive) finalScore -= 120;
      if (classification.isLyricsVideo) finalScore -= 80;
      if (classification.isReaction) finalScore -= 350;
      if (classification.isCompilation) finalScore -= 350;
      if (classification.isMusicVideo && candidate.playbackFormat === 'audio') {
        // Slight penalty for long video if pure audio is available
        finalScore -= 20;
      }
    } else {
      // User explicitly wanted a variant
      if (intent.wantsSlowed && classification.isSlowed) finalScore += 200;
      if (intent.wantsRemix && classification.isRemix) finalScore += 200;
      if (intent.wantsCover && classification.isCover) finalScore += 200;
      if (intent.wantsLive && classification.isLive) finalScore += 200;
      if (intent.wantsLyrics && classification.isLyricsVideo) finalScore += 200;
    }

    // 6. POPULARITY TIE-BREAKER (Small bonus only, max 15 points)
    const views = parseInt((candidate.views || '0').replace(/[^0-9]/g, ''), 10) || 0;
    if (views > 10000000) finalScore += 15;
    else if (views > 1000000) finalScore += 10;
    else if (views > 100000) finalScore += 5;

    return {
      relevanceScore,
      finalScore,
      isRelevant: true,
      candidate: {
        ...candidate,
        relevanceScore,
        finalScore,
      },
    };
  },

  /**
   * Filters and ranks candidates based on pure search relevance
   */
  filterAndRank(candidates = [], rawQuery = '', intent = {}, limit = 30) {
    if (!Array.isArray(candidates) || candidates.length === 0) return [];
    const normQuery = cleanString(intent.cleanQuery || rawQuery);
    if (!normQuery) return [];

    const scoredList = [];
    const seenEntities = new Set();

    for (const c of candidates) {
      const evaluation = this.scoreCandidate(c, rawQuery, intent);
      if (!evaluation.isRelevant || evaluation.finalScore <= 0) continue;

      const track = evaluation.candidate;
      const entityKey = track.canonicalMusicEntityId || track.musicEntityKey || `${cleanString(track.title)}|${cleanString(track.artist)}`;

      // Deduplicate identical songs
      if (seenEntities.has(entityKey)) continue;
      seenEntities.add(entityKey);

      scoredList.push(track);
    }

    // Sort descending by finalScore (Relevance first, tie-breaking second)
    scoredList.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

    return scoredList.slice(0, limit);
  },
};
