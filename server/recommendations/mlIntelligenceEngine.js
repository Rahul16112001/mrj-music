import { db } from '../db/schema.js';
import { contentClassifier } from '../catalog/contentClassifier.js';
import { musicProvider } from '../providers/musicProvider.js';
import { chartService } from '../charts/chartService.js';
import { viralTrendService } from './viralTrendService.js';
import { sessionManager, personalizationEngine } from './personalizationEngine.js';

// Psychological Circadian Phases & Energy Curves
export const CIRCADIAN_PHASES = {
  MORNING: { name: 'Morning Awakening', targetEnergy: 0.65, targetValence: 0.8, preferredGenres: ['Acoustic', 'Pop', 'Devotional', 'Indie', 'Positive'] },
  AFTERNOON: { name: 'Focus & Flow', targetEnergy: 0.55, targetValence: 0.6, preferredGenres: ['Lo-Fi', 'Chill', 'Melodic', 'Bollywood', 'Ambient'] },
  EVENING: { name: 'Evening Decompression', targetEnergy: 0.85, targetValence: 0.75, preferredGenres: ['Punjabi', 'Party', 'Hip-Hop', 'Pop', 'EDM', 'Workout'] },
  LATE_NIGHT: { name: 'Late Night Chill', targetEnergy: 0.35, targetValence: 0.45, preferredGenres: ['Lo-Fi', 'Soulful', 'Acoustic', 'Sad', 'Midnight', 'Chill'] },
};

// Regional Language & Cultural Clusters
export const REGIONAL_LANGUAGE_CLUSTERS = {
  PUNJABI: ['karan aujla', 'diljit', 'sidhu', 'shubh', 'ap dhillon', 'amrit maan', 'jassi', 'bhangra', 'punjabi'],
  HINDI_BOLLYWOOD: ['arijit', 'pritam', 'shreya', 'neha kakkar', 'jubin', 'atif', 'badshah', 'honey singh', 'bollywood', 'hindi'],
  SOUTH_INDIAN: ['anirudh', 'ar rahman', 'sid sriram', 'devi sri prasad', 'thaman', 'tamil', 'telugu', 'malayalam', 'kannada'],
  BHOJPURI: ['pawan singh', 'khesari', 'shilpi raj', 'bhojpuri'],
  WESTERN_POP: ['the weeknd', 'harry styles', 'taylor swift', 'ed sheeran', 'drake', 'eminem', 'dua lipa', 'billie eilish', 'pop'],
  LOFI_CHILL: ['lofi', 'lo-fi', 'chill', 'ambient', 'sleep', 'relax', 'study', 'focus'],
};

export class MLIntelligenceEngine {
  // 1. Determine Circadian Phase & Day-of-Week Psychological Weight
  getCircadianPhase(localHour = null, dayOfWeek = null) {
    const now = new Date();
    const hour = localHour !== null ? localHour : now.getHours();
    const day = dayOfWeek !== null ? dayOfWeek : now.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat

    let base = CIRCADIAN_PHASES.LATE_NIGHT;
    let phaseName = 'LATE_NIGHT';

    if (hour >= 6 && hour < 11) {
      base = CIRCADIAN_PHASES.MORNING;
      phaseName = 'MORNING';
    } else if (hour >= 11 && hour < 17) {
      base = CIRCADIAN_PHASES.AFTERNOON;
      phaseName = 'AFTERNOON';
    } else if (hour >= 17 && hour < 21) {
      base = CIRCADIAN_PHASES.EVENING;
      phaseName = 'EVENING';
    }

    // Weekend Party / Chill Energy Multiplier
    const isWeekend = day === 5 || day === 6; // Friday / Saturday
    const energyMultiplier = isWeekend && hour >= 18 ? 1.15 : 1.0;

    return {
      phase: phaseName,
      ...base,
      targetEnergy: Math.min(1.0, base.targetEnergy * energyMultiplier),
      isWeekend,
    };
  }

  // 2. Detect Language & Cultural Cluster
  detectLanguageAndCulture(track = {}) {
    const title = (track.title || '').toLowerCase();
    const artist = (track.artist || '').toLowerCase();
    const genre = (track.genre || '').toLowerCase();
    const text = `${title} ${artist} ${genre}`;

    for (const [cluster, keywords] of Object.entries(REGIONAL_LANGUAGE_CLUSTERS)) {
      if (keywords.some(k => text.includes(k))) {
        return cluster;
      }
    }
    return 'UNIVERSAL';
  }

  // 3. Extract Multi-Dimensional Acoustic Vector from Track metadata
  extractAcousticVector(track = {}) {
    const title = (track.title || '').toLowerCase();
    const artist = (track.artist || '').toLowerCase();
    const genre = (track.genre || '').toLowerCase();
    const cluster = this.detectLanguageAndCulture(track);

    let energy = 0.5;
    let valence = 0.5;
    let danceability = 0.5;
    let estimatedBPM = 105;
    let acousticness = 0.4;

    if (
      title.includes('acoustic') || title.includes('unplugged') || title.includes('lofi') ||
      title.includes('lo-fi') || title.includes('piano') || title.includes('sleep') ||
      genre.includes('chill') || genre.includes('ambient') || genre.includes('focus') ||
      cluster === 'LOFI_CHILL'
    ) {
      energy = 0.25;
      valence = 0.4;
      danceability = 0.3;
      estimatedBPM = 75;
      acousticness = 0.85;
    } else if (
      title.includes('remix') || title.includes('club') || title.includes('party') ||
      title.includes('phonk') || title.includes('edm') || genre.includes('workout') ||
      genre.includes('party') || genre.includes('dance') || cluster === 'PUNJABI' ||
      artist.includes('anirudh') || artist.includes('badshah')
    ) {
      energy = 0.9;
      valence = 0.85;
      danceability = 0.88;
      estimatedBPM = 128;
      acousticness = 0.15;
    } else if (
      title.includes('sad') || title.includes('dard') || title.includes('judaai') ||
      genre.includes('sad') || genre.includes('melancholy')
    ) {
      energy = 0.35;
      valence = 0.2;
      danceability = 0.35;
      estimatedBPM = 80;
      acousticness = 0.7;
    } else if (
      title.includes('love') || title.includes('romantic') || title.includes('ishq') ||
      title.includes('pyaar') || genre.includes('romance') || cluster === 'HINDI_BOLLYWOOD'
    ) {
      energy = 0.55;
      valence = 0.7;
      danceability = 0.55;
      estimatedBPM = 95;
      acousticness = 0.6;
    }

    return {
      energy,
      valence,
      danceability,
      estimatedBPM,
      acousticness,
      cluster,
      genre: track.genre || 'Pop',
      artist: track.artist || '',
      title: track.title || '',
    };
  }

  // 4. Compute Cosine & Harmonic Compatibility Distance
  calculateHarmonicDistance(vecA, vecB) {
    const dEnergy = Math.abs(vecA.energy - vecB.energy);
    const dValence = Math.abs(vecA.valence - vecB.valence);
    const dDance = Math.abs(vecA.danceability - vecB.danceability);
    const dAcoustic = Math.abs(vecA.acousticness - vecB.acousticness);
    const dBPM = Math.abs(vecA.estimatedBPM - vecB.estimatedBPM) / 100.0;
    const sameCluster = vecA.cluster === vecB.cluster ? 0.0 : 0.15;

    // Weighted distance (0.0 = perfect acoustic match, 1.0 = distant)
    const distance = 0.3 * dEnergy + 0.25 * dValence + 0.15 * dDance + 0.15 * dAcoustic + 0.15 * Math.min(1.0, dBPM) + sameCluster;
    return Math.max(0.0, 1.0 - distance);
  }

  // 5. Generate Real-Time Dynamic Autoplay Queue (25+ Transition Tracks) with Anti-Fatigue Clustering
  async generateDynamicQueue(userId, options = {}) {
    const {
      currentTrack = null,
      playedTrackIds = [],
      currentQueueIds = [],
      countryCode = 'IN',
      localHour = null,
      dayOfWeek = null,
      sessionId = null,
      isEarlySkip = false,
    } = options;

    const circadian = this.getCircadianPhase(localHour, dayOfWeek);
    const seedVector = currentTrack ? this.extractAcousticVector(currentTrack) : {
      energy: circadian.targetEnergy,
      valence: circadian.targetValence,
      danceability: 0.6,
      estimatedBPM: 105,
      acousticness: 0.4,
      cluster: 'UNIVERSAL',
    };

    const excludedIds = new Set([
      ...(currentTrack ? [currentTrack.id] : []),
      ...(Array.isArray(playedTrackIds) ? playedTrackIds : []),
      ...(Array.isArray(currentQueueIds) ? currentQueueIds : []),
    ]);

    // Gather Candidate Pools in parallel:
    // 1. Seed Track Related Candidates
    // 2. Regional Trending Charts
    // 3. Viral Instagram / TikTok Reels
    // 4. User Profile, Liked, History
    const [seedCandidates, regionalCharts, viralReels, userProfile, userLiked, userHistory] = await Promise.all([
      currentTrack ? musicProvider.getCandidatePool(currentTrack) : Promise.resolve([]),
      chartService.getTrending(countryCode || 'IN'),
      viralTrendService.getViralReelsTracks(countryCode || 'IN', 20),
      userId ? db.getTasteProfile(userId) : Promise.resolve(null),
      userId ? db.getLikedTracks(userId) : Promise.resolve([]),
      userId ? db.getUserHistory(userId) : Promise.resolve([]),
    ]);

    const session = sessionId ? sessionManager.getSession(sessionId) : null;
    const dislikedArtists = new Set(userProfile?.disliked_artists || []);
    const preferredArtists = userProfile?.preferred_artists || {};
    const preferredGenres = userProfile?.preferred_genres || {};
    const likedTrackIds = new Set(userLiked.map(t => t.id));

    // Combine candidate pools
    const rawCandidates = [
      ...seedCandidates,
      ...(regionalCharts.tracks || []),
      ...viralReels,
      ...userLiked,
    ];

    const uniqueMap = new Map();
    for (const raw of rawCandidates) {
      if (!raw || !raw.id || excludedIds.has(raw.id)) continue;
      const normalized = contentClassifier.normalizeTrack(raw);
      if (normalized.isCompilation || normalized.isReaction || dislikedArtists.has(normalized.artist)) continue;
      if (!uniqueMap.has(normalized.id)) {
        uniqueMap.set(normalized.id, normalized);
      }
    }

    const allCandidates = Array.from(uniqueMap.values());

    // Score Candidates using Multi-Vector Scoring
    const scoredCandidates = allCandidates.map(track => {
      const trackVec = this.extractAcousticVector(track);
      const acousticSimilarity = this.calculateHarmonicDistance(seedVector, trackVec);

      let score = acousticSimilarity * 40; // Base: 0 - 40 pts

      // A. Cultural & Language Cluster Match (+15 pts)
      if (trackVec.cluster === seedVector.cluster && seedVector.cluster !== 'UNIVERSAL') {
        score += 15;
      }

      // B. Artist & Genre Affinity (0 - 25 pts)
      const artistScore = preferredArtists[track.artist] || 0;
      score += Math.min(25, artistScore * 2);

      if (track.genre && preferredGenres[track.genre]) {
        score += Math.min(15, preferredGenres[track.genre]);
      }

      // C. Liked Track Affinity (+15 pts)
      if (likedTrackIds.has(track.id)) {
        score += 15;
      }

      // D. Viral Reels Trend Boost (+12 pts)
      if (track.isViral) {
        score += 12;
      }

      // E. Circadian Rhythm Alignment (0 - 15 pts)
      const dCircadianEnergy = Math.abs(trackVec.energy - circadian.targetEnergy);
      score += Math.max(0, (1.0 - dCircadianEnergy) * 15);

      // F. Early Skip Penalty Feedback (Auto-Fixing)
      if (isEarlySkip && track.artist === currentTrack?.artist) {
        score -= 40; // Deprioritize immediately on early skip
      }

      return {
        ...track,
        matchScore: Math.round(score),
        cluster: trackVec.cluster,
        transitionReason: track.isViral
          ? '🔥 Trending on Reels'
          : artistScore > 10
          ? `Because you love ${track.artist}`
          : circadian.name,
      };
    });

    // Sort by Match Score
    scoredCandidates.sort((a, b) => b.matchScore - a.matchScore);

    // Spotify-Grade Artist Separation Rule (Max 2 tracks per artist in top 10)
    const artistCounts = new Map();
    const deduplicatedQueue = [];

    for (const track of scoredCandidates) {
      const count = artistCounts.get(track.artist) || 0;
      if (count < 2 || deduplicatedQueue.length > 12) {
        deduplicatedQueue.push(track);
        artistCounts.set(track.artist, count + 1);
      }
      if (deduplicatedQueue.length >= 30) break;
    }

    // Epsilon-Greedy Interleaving: 70% Core Matches + 20% Viral Reels + 10% Serendipitous Fresh
    const topMatches = deduplicatedQueue.slice(0, 16);
    const viralMatches = scoredCandidates.filter(t => t.isViral && !topMatches.some(m => m.id === t.id)).slice(0, 6);
    const freshDiscoveries = scoredCandidates.slice(16).filter(t => !t.isViral && (preferredArtists[t.artist] || 0) < 5).slice(0, 4);

    const mergedQueue = [...topMatches];
    if (viralMatches.length > 0) mergedQueue.splice(3, 0, viralMatches[0]);
    if (viralMatches.length > 1) mergedQueue.splice(7, 0, viralMatches[1]);
    if (freshDiscoveries.length > 0) mergedQueue.splice(5, 0, freshDiscoveries[0]);
    if (freshDiscoveries.length > 1) mergedQueue.splice(11, 0, freshDiscoveries[1]);

    return {
      status: 'success',
      circadianPhase: circadian.name,
      seedTrack: currentTrack ? { title: currentTrack.title, artist: currentTrack.artist, cluster: seedVector.cluster } : null,
      queue: mergedQueue.slice(0, 25),
    };
  }

  // 6. Generate 4 Distinct AI Daily Mixes Clustered by Mood & Genre
  async generateDailyMixes(userId, countryCode = 'IN') {
    const [profile, liked, history, regionalTrending, viralReels] = await Promise.all([
      userId ? db.getTasteProfile(userId) : Promise.resolve(null),
      userId ? db.getLikedTracks(userId) : Promise.resolve([]),
      userId ? db.getUserHistory(userId) : Promise.resolve([]),
      chartService.getTrending(countryCode || 'IN'),
      viralTrendService.getViralReelsTracks(countryCode || 'IN', 25),
    ]);

    const cleanLiked = liked.map(t => contentClassifier.normalizeTrack(t));
    const cleanHistory = history.map(t => contentClassifier.normalizeTrack(t));
    const cleanRegional = (regionalTrending.tracks || []).map(t => contentClassifier.normalizeTrack(t));

    // Top Preferred Artists & Genres
    const topArtists = Object.entries(profile?.preferred_artists || {})
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const top1 = topArtists[0] || 'Arijit Singh';
    const top2 = topArtists[1] || 'Karan Aujla';
    const top3 = topArtists[2] || 'The Weeknd';

    // Mix 1: High Energy & Heavy Rotation (Upbeat Pop / Punjabi / Party)
    const mix1Tracks = [
      ...cleanLiked.filter(t => this.extractAcousticVector(t).energy >= 0.6),
      ...cleanHistory.filter(t => this.extractAcousticVector(t).energy >= 0.6),
      ...cleanRegional.filter(t => this.extractAcousticVector(t).energy >= 0.65),
    ].slice(0, 15);

    // Mix 2: Soulful & Romantic Melodies (Vocal, Romance, Ballads)
    const mix2Tracks = [
      ...cleanLiked.filter(t => this.extractAcousticVector(t).valence >= 0.5 && this.extractAcousticVector(t).energy < 0.7),
      ...cleanHistory.filter(t => (t.artist.includes('Arijit') || t.artist.includes('Jasleen') || t.artist.includes('Pritam'))),
      ...cleanRegional.filter(t => this.extractAcousticVector(t).energy < 0.65),
    ].slice(0, 15);

    // Mix 3: Late Night Chill & Lo-Fi (Acoustic, Relax, Focus)
    const mix3Tracks = [
      ...cleanLiked.filter(t => this.extractAcousticVector(t).energy < 0.5),
      ...cleanHistory.filter(t => this.extractAcousticVector(t).energy < 0.5),
      ...cleanRegional.filter(t => this.extractAcousticVector(t).energy < 0.5),
    ].slice(0, 15);

    // Mix 4: Viral Reels & Fresh Discoveries (Instagram Trending, New Sounds)
    const mix4Tracks = [
      ...viralReels,
      ...cleanRegional.filter(t => !topArtists.includes(t.artist)),
    ].slice(0, 15);

    return {
      status: 'success',
      dailyMixes: [
        {
          id: 'mix_1_energy',
          title: 'Daily Mix 1',
          subtitle: `${top2}, Badshah & High Energy Hits`,
          vibe: '⚡ High Energy & Hits',
          color: 'from-amber-600 to-rose-900',
          posterImage: mix1Tracks[0]?.thumbnail || 'https://c.saavncdn.com/artists/Karan_Aujla_003_20230622081014_500x500.jpg',
          tracksCount: mix1Tracks.length,
          tracks: mix1Tracks,
        },
        {
          id: 'mix_2_soul',
          title: 'Daily Mix 2',
          subtitle: `${top1}, Shreya Ghoshal & Soulful Melodies`,
          vibe: '❤️ Romantic & Melodic',
          color: 'from-rose-600 to-pink-950',
          posterImage: mix2Tracks[0]?.thumbnail || 'https://c.saavncdn.com/artists/Arijit_Singh_002_20230323062147_500x500.jpg',
          tracksCount: mix2Tracks.length,
          tracks: mix2Tracks,
        },
        {
          id: 'mix_3_chill',
          title: 'Daily Mix 3',
          subtitle: `${top3}, Lo-Fi & Late Night Chill`,
          vibe: '🌙 Late Night Lounge',
          color: 'from-indigo-600 to-slate-950',
          posterImage: mix3Tracks[0]?.thumbnail || 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop',
          tracksCount: mix3Tracks.length,
          tracks: mix3Tracks,
        },
        {
          id: 'mix_4_viral',
          title: 'Daily Mix 4',
          subtitle: 'Instagram Viral & Fresh Discoveries',
          vibe: '🔥 Viral Social Radar',
          color: 'from-purple-600 to-violet-950',
          posterImage: mix4Tracks[0]?.thumbnail || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop',
          tracksCount: mix4Tracks.length,
          tracks: mix4Tracks,
        },
      ],
    };
  }
}

export const mlIntelligenceEngine = new MLIntelligenceEngine();
