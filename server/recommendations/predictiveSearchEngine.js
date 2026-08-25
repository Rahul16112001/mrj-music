import { db } from '../db/schema.js';
import { musicProvider } from '../providers/musicProvider.js';
import { searchRelevanceEngine } from '../catalog/searchRelevanceEngine.js';

// Levenshtein distance for fuzzy typo correction
function levenshteinDistance(s1 = '', s2 = '') {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;
  const d = [];
  for (let i = 0; i <= s1.length; i++) d[i] = [i];
  for (let j = 0; j <= s2.length; j++) d[0][j] = j;
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[s1.length][s2.length];
}

function fuzzyMatch(str1 = '', str2 = '') {
  const s1 = searchRelevanceEngine.normalize(str1);
  const s2 = searchRelevanceEngine.normalize(str2);
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.88;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(s1, s2);
  return (maxLen - dist) / maxLen;
}

// Semantic Lyrics Knowledge Base (Connecting famous lyric hooks to songs)
const LYRICS_INDEX = [
  {
    lyricsSnippet: 'main tenu samjhawan ki na tere bina lagda jee',
    songTitle: 'Samjhawan',
    artist: 'Arijit Singh & Shreya Ghoshal',
    category: 'Romantic Bollywood',
    thumbnail: 'https://c.saavncdn.com/artists/Arijit_Singh_002_20230323062147_500x500.jpg'
  },
  {
    lyricsSnippet: 'koi aisa geet gaoon jisse dil jhoom jaye',
    songTitle: 'Main Koi Aisa Geet Gaoon',
    artist: 'Abhijeet & Alka Yagnik',
    category: '90s Bollywood',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400'
  },
  {
    lyricsSnippet: 'dil diyan gallan karange roz roz beh ke',
    songTitle: 'Dil Diyan Gallan',
    artist: 'Atif Aslam',
    category: 'Romantic Bollywood',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400'
  },
  {
    lyricsSnippet: 'tere bin main dekhun na kisi aur ko',
    songTitle: 'Tere Bin',
    artist: 'Rahat Fateh Ali Khan & Asees Kaur',
    category: 'Romantic Bollywood',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400'
  },
  {
    lyricsSnippet: 'kesariya tera ishq hai piya rang jaaun jo main haath lagaun',
    songTitle: 'Kesariya',
    artist: 'Arijit Singh',
    category: 'Bollywood Romantic',
    thumbnail: 'https://c.saavncdn.com/807/Kesariya-From-Brahmastra-Hindi-2022-20220717092820-500x500.jpg'
  },
  {
    lyricsSnippet: 'apna bana le piya apna bana le piya dil ke nagar mein',
    songTitle: 'Apna Bana Le',
    artist: 'Arijit Singh',
    category: 'Bollywood Romantic',
    thumbnail: 'https://c.saavncdn.com/026/Bhediya-Hindi-2022-20230203140228-500x500.jpg'
  },
  {
    lyricsSnippet: 'husn tera tauba tauba jisse dekh ke dil dole',
    songTitle: 'Tauba Tauba',
    artist: 'Karan Aujla',
    category: 'Punjabi Hits',
    thumbnail: 'https://c.saavncdn.com/807/Tauba-Tauba-From-Bad-Newz-Hindi-2024-20240702111004-500x500.jpg'
  },
  {
    lyricsSnippet: 'sir te khoon sawar so high sidhu moose wala',
    songTitle: 'So High',
    artist: 'Sidhu Moose Wala',
    category: 'Punjabi Legend',
    thumbnail: 'https://c.saavncdn.com/artists/Sidhu_Moose_Wala_003_20230613093228_500x500.jpg'
  },
  {
    lyricsSnippet: 'i said ooh im blinded by the lights',
    songTitle: 'Blinding Lights',
    artist: 'The Weeknd',
    category: 'Synthpop',
    thumbnail: 'https://i.scdn.co/image/ab6761610000e5eb214f3cf1cbe7139c1e26ffbb'
  },
  {
    lyricsSnippet: 'i can buy myself flowers write my name in the sand',
    songTitle: 'Flowers',
    artist: 'Miley Cyrus',
    category: 'Global Pop',
    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400'
  }
];

// Seed Knowledge Base for Instant Matching
const KNOWLEDGE_SEEDS = {
  IN: [
    { title: 'Arijit Singh', type: 'artist', category: 'Bollywood', popularity: 99, image: 'https://c.saavncdn.com/artists/Arijit_Singh_002_20230323062147_500x500.jpg' },
    { title: 'Karan Aujla', type: 'artist', category: 'Punjabi', popularity: 98, image: 'https://c.saavncdn.com/artists/Karan_Aujla_003_20230622081014_500x500.jpg' },
    { title: 'Diljit Dosanjh', type: 'artist', category: 'Punjabi', popularity: 97, image: 'https://c.saavncdn.com/artists/Diljit_Dosanjh_004_20221007180447_500x500.jpg' },
    { title: 'Shreya Ghoshal', type: 'artist', category: 'Bollywood', popularity: 95, image: 'https://c.saavncdn.com/artists/Shreya_Ghoshal_003_20221118090547_500x500.jpg' },
    { title: 'Anirudh Ravichander', type: 'artist', category: 'South Indian', popularity: 96, image: 'https://c.saavncdn.com/artists/Anirudh_Ravichander_003_20230914101416_500x500.jpg' },
    { title: 'Sidhu Moose Wala', type: 'artist', category: 'Punjabi', popularity: 97, image: 'https://c.saavncdn.com/artists/Sidhu_Moose_Wala_003_20230613093228_500x500.jpg' },
    { title: 'Pritam', type: 'artist', category: 'Bollywood', popularity: 94, image: 'https://c.saavncdn.com/artists/Pritam_003_20221104104037_500x500.jpg' },
    { title: 'A.R. Rahman', type: 'artist', category: 'Indian Classic', popularity: 96, image: 'https://c.saavncdn.com/artists/A_R_Rahman_002_20210219084126_500x500.jpg' },
    { title: 'King', type: 'artist', category: 'Indie Pop', popularity: 93, image: 'https://c.saavncdn.com/artists/King_002_20221021074052_500x500.jpg' },
    { title: 'AP Dhillon', type: 'artist', category: 'Punjabi', popularity: 95, image: 'https://c.saavncdn.com/artists/AP_Dhillon_000_20210928072044_500x500.jpg' },
    { title: 'Badshah', type: 'artist', category: 'Commercial Rap', popularity: 92, image: 'https://c.saavncdn.com/artists/Badshah_005_20230613094018_500x500.jpg' },
    { title: 'Pawan Singh', type: 'artist', category: 'Bhojpuri', popularity: 91, image: 'https://c.saavncdn.com/artists/Pawan_Singh_003_20221118090822_500x500.jpg' },
    { title: 'Khesari Lal Yadav', type: 'artist', category: 'Bhojpuri', popularity: 90, image: 'https://c.saavncdn.com/artists/Khesari_Lal_Yadav_002_20221118090729_500x500.jpg' },
    { title: 'Ritviz', type: 'artist', category: 'Indie Electronic', popularity: 91, image: 'https://c.saavncdn.com/artists/Ritviz_000_20191219143714_500x500.jpg' },
    { title: 'Prateek Kuhad', type: 'artist', category: 'Indie Acoustic', popularity: 90, image: 'https://c.saavncdn.com/artists/Prateek_Kuhad_001_20200813133824_500x500.jpg' },
    { title: 'Abdul Hannan', type: 'artist', category: 'Indie Pop', popularity: 89, image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400' },
    { title: 'Tauba Tauba', type: 'song', artist: 'Karan Aujla', category: 'Punjabi Hits', popularity: 99 },
    { title: 'Apna Bana Le', type: 'song', artist: 'Arijit Singh', category: 'Bollywood Romantic', popularity: 98 },
    { title: 'Kesariya', type: 'song', artist: 'Arijit Singh', category: 'Bollywood Romantic', popularity: 98 },
    { title: 'Iraaday', type: 'song', artist: 'Abdul Hannan & Rovalio', category: 'Indie Acoustic', popularity: 95 },
    { title: 'Wavy', type: 'song', artist: 'Karan Aujla', category: 'Punjabi Hits', popularity: 96 },
    { title: 'Born to Shine', type: 'song', artist: 'Diljit Dosanjh', category: 'Punjabi Hits', popularity: 96 },
    { title: 'Winning Speech', type: 'song', artist: 'Karan Aujla', category: 'Punjabi Hits', popularity: 95 },
    { title: 'Maan Meri Jaan', type: 'song', artist: 'King', category: 'Indie Pop', popularity: 96 },
    { title: 'Aaj Ki Raat', type: 'song', artist: 'Madhubanti Bagchi & Sachin-Jigar', category: 'Bollywood Item', popularity: 98 },
    { title: 'So High', type: 'song', artist: 'Sidhu Moose Wala', category: 'Punjabi Legend', popularity: 96 },
    { title: 'Sage', type: 'song', artist: 'Ritviz', category: 'Indie Pop', popularity: 93 },
    { title: 'Kasoor', type: 'song', artist: 'Prateek Kuhad', category: 'Indie Acoustic', popularity: 92 },
  ],
  GLOBAL: [
    { title: 'Taylor Swift', type: 'artist', category: 'Global Pop', popularity: 100, image: 'https://i.scdn.co/image/ab6761610000e5eb5a00969a4698c3132a15fbb0' },
    { title: 'The Weeknd', type: 'artist', category: 'R&B Pop', popularity: 99, image: 'https://i.scdn.co/image/ab6761610000e5eb214f3cf1cbe7139c1e26ffbb' },
    { title: 'Drake', type: 'artist', category: 'Hip-Hop', popularity: 98, image: 'https://i.scdn.co/image/ab6761610000e5eb4293385d324db8558179afd9' },
    { title: 'Ed Sheeran', type: 'artist', category: 'Pop / Acoustic', popularity: 97, image: 'https://i.scdn.co/image/ab6761610000e5eb12a2efab6123490b4d455ec3' },
    { title: 'Billie Eilish', type: 'artist', category: 'Alt Pop', popularity: 98, image: 'https://i.scdn.co/image/ab6761610000e5eb1d9774618e47bf14175ce084' },
    { title: 'Bruno Mars', type: 'artist', category: 'Pop Soul', popularity: 96, image: 'https://i.scdn.co/image/ab6761610000e5ebc36dd9eb55fb0db4911f25dd' },
    { title: 'Blinding Lights', type: 'song', artist: 'The Weeknd', category: 'Synthpop', popularity: 99 },
    { title: 'Cruel Summer', type: 'song', artist: 'Taylor Swift', category: 'Pop', popularity: 99 },
    { title: 'Shape of You', type: 'song', artist: 'Ed Sheeran', category: 'Pop', popularity: 98 },
    { title: 'Die With A Smile', type: 'song', artist: 'Lady Gaga & Bruno Mars', category: 'Ballad', popularity: 100 },
  ],
};

class PredictiveSearchEngine {
  constructor() {
    this.trie = new Map();
    this.buildPrefixIndex();
  }

  buildPrefixIndex() {
    const allSeeds = [...KNOWLEDGE_SEEDS.IN, ...KNOWLEDGE_SEEDS.GLOBAL];
    for (const item of allSeeds) {
      const normalized = searchRelevanceEngine.normalize(item.title);
      for (let i = 1; i <= normalized.length; i++) {
        const prefix = normalized.substring(0, i);
        if (!this.trie.has(prefix)) {
          this.trie.set(prefix, []);
        }
        const bucket = this.trie.get(prefix);
        if (!bucket.some(x => x.title === item.title)) {
          bucket.push(item);
        }
      }
    }
  }

  getTrendingKeywords(country = 'IN') {
    const isIndia = (country || 'IN').toUpperCase() === 'IN';
    if (isIndia) {
      return [
        'Tauba Tauba',
        'Arijit Singh',
        'Karan Aujla',
        'Apna Bana Le',
        'Stree 2 Songs',
        'Diljit Dosanjh',
        'Aaj Ki Raat',
        'Maan Meri Jaan',
        'Sidhu Moose Wala',
        'Lo-Fi Bollywood',
        'Pawan Singh',
        'Anirudh Mass Hits',
      ];
    }
    return [
      'Taylor Swift',
      'Die With A Smile',
      'The Weeknd',
      'Birds of a Feather',
      'Billie Eilish',
      'Cruel Summer',
      'Drake',
      'Sabrina Carpenter',
      'Bruno Mars',
      'Ed Sheeran',
      'Spotify Viral 50',
    ];
  }

  /**
   * Search lyrics index for matches
   */
  findLyricsMatch(query = '') {
    const norm = searchRelevanceEngine.normalize(query);
    if (!norm || norm.length < 4) return null;

    for (const item of LYRICS_INDEX) {
      const normLyrics = searchRelevanceEngine.normalize(item.lyricsSnippet);
      const ratio = fuzzyMatch(norm, normLyrics);
      if (normLyrics.includes(norm) || norm.includes(normLyrics) || ratio >= 0.65) {
        return item;
      }
    }
    return null;
  }

  /**
   * Fuzzy search across knowledge seeds (for handling typos like 'arijt sing', 'karan ojla')
   */
  findFuzzySeedMatch(normQuery = '') {
    if (!normQuery || normQuery.length < 2) return null;
    const allSeeds = [...KNOWLEDGE_SEEDS.IN, ...KNOWLEDGE_SEEDS.GLOBAL];
    let bestMatch = null;
    let bestScore = 0;

    for (const seed of allSeeds) {
      const normTitle = searchRelevanceEngine.normalize(seed.title);
      const ratio = fuzzyMatch(normQuery, normTitle);
      if (ratio > bestScore && ratio >= 0.68) {
        bestScore = ratio;
        bestMatch = seed;
      }
    }
    return bestMatch;
  }

  async predictIntent(query = '', country = 'IN', userId = null) {
    const rawClean = (query || '').trim();
    const normQuery = searchRelevanceEngine.normalize(rawClean);

    // 1. If Empty query: return trending keywords & user recent search history
    if (!normQuery) {
      const trending = this.getTrendingKeywords(country);
      let userHistory = [];
      if (userId) {
        try {
          userHistory = await db.getSearchHistory(userId);
        } catch (_) {}
      }
      return {
        query: '',
        trendingKeywords: trending,
        recentSearches: (userHistory || []).slice(0, 8),
        topPrediction: null,
        suggestions: trending.slice(0, 6),
        instantSongs: [],
      };
    }

    // 2. Fetch User Taste Profile
    let userTaste = null;
    if (userId) {
      try {
        userTaste = await db.getTasteProfile(userId);
      } catch (_) {}
    }
    const preferredArtists = new Set(Object.keys(userTaste?.preferred_artists || {}));
    const likedArtists = new Set(userTaste?.liked_artists || []);
    const preferredGenres = new Set(Object.keys(userTaste?.preferred_genres || {}));

    // 3. Check for Semantic Lyrics Match
    const lyricsMatch = this.findLyricsMatch(normQuery);

    // 4. Exact Trie Matches + Typo-tolerant Fuzzy Matches
    const trieMatches = this.trie.get(normQuery) || [];
    const fuzzySeed = this.findFuzzySeedMatch(normQuery);

    // 5. Live Catalog Query via MusicProvider
    let catalogResults = { songs: [], artists: [], albums: [] };
    try {
      catalogResults = await musicProvider.search(rawClean, 'all', 12);
    } catch (err) {
      console.warn('Predictive search provider fallback:', err.message);
    }

    // 6. Score and Rank Suggestions
    const suggestionCandidates = new Map();

    // Natural completions
    suggestionCandidates.set(rawClean, { text: rawClean, score: 500, type: 'query' });
    suggestionCandidates.set(`${rawClean} song`, { text: `${rawClean} song`, score: 480, type: 'query' });
    suggestionCandidates.set(`${rawClean} songs`, { text: `${rawClean} songs`, score: 470, type: 'query' });
    suggestionCandidates.set(`${rawClean} lyrics`, { text: `${rawClean} lyrics`, score: 450, type: 'query' });

    // If lyrics matched, surface high-intent suggestion
    if (lyricsMatch) {
      suggestionCandidates.set(`${lyricsMatch.songTitle} (Lyrics Match)`, {
        text: lyricsMatch.songTitle,
        score: 600,
        type: 'song',
        data: {
          title: lyricsMatch.songTitle,
          artist: lyricsMatch.artist,
          thumbnail: lyricsMatch.thumbnail,
          subtitle: `Song • Matched by lyrics: "${lyricsMatch.lyricsSnippet.substring(0, 32)}..."`,
          category: lyricsMatch.category,
        },
      });
    }

    // Add Fuzzy match if found
    if (fuzzySeed) {
      suggestionCandidates.set(fuzzySeed.title, {
        text: fuzzySeed.title,
        score: 550,
        type: fuzzySeed.type,
        data: fuzzySeed,
      });
      suggestionCandidates.set(`${fuzzySeed.title} songs`, {
        text: `${fuzzySeed.title} songs`,
        score: 530,
        type: 'query',
      });
    }

    // Add Trie matches
    for (const match of trieMatches) {
      let score = 400 + match.popularity;
      if (match.type === 'artist') score += 50;

      if (preferredArtists.has(match.title) || likedArtists.has(match.title) || (match.artist && preferredArtists.has(match.artist))) {
        score += 150;
      }
      if (match.category && preferredGenres.has(match.category.toLowerCase())) {
        score += 80;
      }

      suggestionCandidates.set(match.title, {
        text: match.title,
        score,
        type: match.type,
        data: match,
      });
    }

    // Add live catalog songs & artists (supporting ANY artist, not just verified)
    for (const artist of catalogResults.artists || []) {
      const normName = searchRelevanceEngine.normalize(artist.name);
      let score = normName.startsWith(normQuery) ? 460 : 350;
      if (preferredArtists.has(artist.name)) score += 120;
      suggestionCandidates.set(artist.name, {
        text: artist.name,
        score,
        type: 'artist',
        data: artist,
      });
    }

    for (const song of catalogResults.songs || []) {
      const normTitle = searchRelevanceEngine.normalize(song.title);
      let score = normTitle.startsWith(normQuery) ? 450 : 320;
      if (preferredArtists.has(song.artist)) score += 100;
      suggestionCandidates.set(song.title, {
        text: song.title,
        score,
        type: 'song',
        data: song,
      });
    }

    const sortedSuggestions = Array.from(suggestionCandidates.values())
      .sort((a, b) => b.score - a.score);

    const finalQuerySuggestions = [];
    const seen = new Set();
    for (const item of sortedSuggestions) {
      const lower = item.text.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        finalQuerySuggestions.push(item.text);
      }
      if (finalQuerySuggestions.length >= 8) break;
    }

    // 7. Top Prediction Hero Card
    let topPrediction = null;
    const topItem = sortedSuggestions.find(s => s.type === 'artist' || s.type === 'song');
    if (topItem && topItem.data) {
      if (topItem.type === 'artist') {
        topPrediction = {
          type: 'artist',
          title: topItem.data.name || topItem.data.title,
          subtitle: topItem.data.subtitle || 'Artist',
          thumbnail: topItem.data.image || topItem.data.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
          category: topItem.data.category || 'Artist',
        };
      } else {
        const t = topItem.data;
        topPrediction = {
          type: 'song',
          id: t.id || t.providerTrackId || 'song_pred',
          title: t.title,
          subtitle: t.subtitle || `Song • ${t.artist || 'Artist'}`,
          artist: t.artist || 'Artist',
          thumbnail: t.thumbnail || t.image || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
          duration: t.duration || 210,
          providerTrackId: t.providerTrackId || t.id,
          streamUrl: t.streamUrl || `https://mrj-music.vercel.app/api/music/stream/${t.providerTrackId || t.id}`,
        };
      }
    }

    // 8. Instant Songs (Prioritize pure audio; fallback to video stream)
    const instantSongs = (catalogResults.songs || []).slice(0, 10).map(s => {
      const streamUrl = s.streamUrl 
        || (s.audioSource?.url) 
        || `https://mrj-music.vercel.app/api/music/stream/${s.providerTrackId || s.id}`;
      return {
        id: s.id || s.providerTrackId,
        canonicalTrackId: s.canonicalTrackId || s.id,
        title: s.title,
        artist: s.artist || 'Artist',
        album: s.album || '',
        thumbnail: s.thumbnail || s.image,
        duration: s.duration || 210,
        genre: s.genre || '',
        isAudioPreferred: !!(s.audioSource?.url || !s.isVideoOnly),
        providerTrackId: s.providerTrackId || s.id,
        streamUrl,
      };
    });

    return {
      query: rawClean,
      trendingKeywords: this.getTrendingKeywords(country),
      topPrediction,
      suggestions: finalQuerySuggestions,
      instantSongs,
    };
  }

  /**
   * Strictly Categorized & ML-Ranked Search Hub
   */
  async searchCategorized(query = '', category = 'all', country = 'IN', userId = null) {
    const rawClean = (query || '').trim();
    if (!rawClean) {
      return { songs: [], artists: [], albums: [], playlists: [] };
    }

    // 1. Fetch User Taste Profile
    let userTaste = null;
    if (userId) {
      try {
        userTaste = await db.getTasteProfile(userId);
      } catch (_) {}
    }
    const preferredArtists = new Set(Object.keys(userTaste?.preferred_artists || {}));
    const preferredGenres = new Set(Object.keys(userTaste?.preferred_genres || {}));

    // 2. Fetch Catalog Results for requested category
    const providerType = category.toLowerCase() === 'all' ? 'all' : category.toLowerCase();
    let rawResults = { songs: [], artists: [], albums: [], playlists: [] };

    try {
      rawResults = await musicProvider.search(rawClean, providerType, 30);
    } catch (err) {
      console.warn('Categorized search provider fallback:', err.message);
    }

    // 3. Check for Lyrics Match in Songs
    const lyricsMatch = this.findLyricsMatch(rawClean);
    let songs = (rawResults.songs || []).map(s => {
      let score = 100;
      if (preferredArtists.has(s.artist)) score += 50;
      if (s.genre && preferredGenres.has(s.genre.toLowerCase())) score += 30;
      if (lyricsMatch && (s.title.toLowerCase().includes(lyricsMatch.songTitle.toLowerCase()) || s.artist.toLowerCase().includes(lyricsMatch.artist.toLowerCase()))) {
        score += 100;
      }
      return {
        id: s.id || s.providerTrackId,
        canonicalTrackId: s.canonicalTrackId || s.id,
        title: s.title,
        artist: s.artist || 'Artist',
        album: s.album || '',
        thumbnail: s.thumbnail || s.image,
        duration: s.duration || 210,
        genre: s.genre || '',
        score,
        isAudioPreferred: !!(s.audioSource?.url || !s.isVideoOnly),
        providerTrackId: s.providerTrackId || s.id,
        streamUrl: s.streamUrl || `https://mrj-music.vercel.app/api/music/stream/${s.providerTrackId || s.id}`,
      };
    }).sort((a, b) => b.score - a.score);

    // 4. Artists (inclusive of any artist, popular and indie)
    const artists = (rawResults.artists || []).map(a => ({
      id: a.id || a.name,
      name: a.name,
      image: a.image || a.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
      category: a.category || 'Artist',
      followerCount: a.followerCount || a.subscribers || '100K+ Fans',
    }));

    // 5. Albums
    const albums = (rawResults.albums || []).map(alb => ({
      id: alb.id,
      title: alb.title || alb.name,
      artist: alb.artist || 'Various Artists',
      thumbnail: alb.thumbnail || alb.image,
      year: alb.year || '2024',
      trackCount: alb.trackCount || alb.songsCount || 10,
    }));

    // 6. Playlists
    const playlists = (rawResults.playlists || []).map(p => ({
      id: p.id,
      title: p.title || p.name,
      author: p.author || p.creator || 'MRJ Music',
      thumbnail: p.thumbnail || p.image,
      trackCount: p.trackCount || 25,
    }));

    return {
      query: rawClean,
      category,
      songs,
      artists,
      albums,
      playlists,
    };
  }
}

export const predictiveSearchEngine = new PredictiveSearchEngine();
