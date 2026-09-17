import crypto from 'crypto';
import { db } from '../db/schema.js';
import { searchYouTubeHighEnd } from '../catalog/youtubeScraper.js';
import { innertubeProvider } from './innertubeProvider.js';
import { jiosaavnProvider } from './jiosaavnProvider.js';
import { jamendoProvider } from './jamendoProvider.js';
import { audiusProvider } from './audiusProvider.js';
import { youtubeVideoProvider } from './youtubeVideoProvider.js';

const providers = [
  innertubeProvider,
  jiosaavnProvider,
  jamendoProvider,
  audiusProvider,
  youtubeVideoProvider,
];

const mappingCache = new Map();
const MAPPING_CACHE_TTL_MS = 30 * 60 * 1000;

async function getCachedMappings(canonicalTrackId) {
  const cached = mappingCache.get(canonicalTrackId);
  if (cached && cached.expiresAt > Date.now()) return cached.mappings;
  const mappings = await db.getMappingsByCanonicalId(canonicalTrackId).catch(() => []);
  mappingCache.set(canonicalTrackId, { mappings, expiresAt: Date.now() + MAPPING_CACHE_TTL_MS });
  return mappings;
}

function canonicalIdFor(providerName, providerTrackId) {
  if (providerName === 'youtube_music') return `ytm_${providerTrackId}`;
  return `map_${crypto.createHash('sha256').update(`${providerName}:${providerTrackId}`).digest('hex').slice(0, 32)}`;
}

async function persistMapping(track, canonicalTrackId) {
  const payload = {
    canonicalTrackId,
    providerName: track.provider,
    providerTrackId: track.providerTrackId,
    sourceType: track.sourceType || track.provider,
    normalizedTitle: track.title,
    normalizedArtist: track.artist,
    album: track.album,
    duration: track.duration,
    artworkUrl: track.thumbnail,
    providerMetadata: track.providerMetadata || {},
  };
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const saved = Boolean(await db.upsertProviderMapping(payload));
      if (saved) mappingCache.delete(canonicalTrackId);
      return saved;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  console.warn('[resolver] provider mapping persistence failed', {
    canonicalTrackId,
    provider: track.provider,
    providerTrackId: track.providerTrackId,
    error: lastError?.message || 'unknown error',
  });
  return false;
}

function normalizeResult(track) {
  const providerTrackId = track.providerTrackId || track.id;
  const canonicalTrackId = track.provider === 'youtube_music'
    ? canonicalIdFor(track.provider, providerTrackId)
    : track.canonicalTrackId || canonicalIdFor(track.provider, providerTrackId);
  return {
    ...track,
    id: canonicalTrackId,
    canonicalTrackId,
    sources: [{
      provider: track.provider,
      providerTrackId,
      status: 'available',
      streamUrl: null,
    }],
  };
}

function dedupeKey(track) {
  return `${String(track.title || '').toLowerCase().replace(/\W+/g, ' ').trim()}::${String(track.artist || '').toLowerCase().replace(/\W+/g, ' ').trim()}`;
}

function cleanTitleString(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/\s*[\(\[][^\)\]]*(feat|ft\b|official|video|audio|lyric|from|ost|album|deluxe|bonus|soundtrack|hd|4k)[^\)\]]*[\)\]]/gi, '')
    .replace(/^(official|lyrical|audio|video|exclusive|full\s*song|hd|4k)\s*[:|-]\s*/gi, '')
    .replace(/\s*\|\s*.*$/g, '')
    .replace(/\s*-\s*(official|lyrical|audio|video|exclusive).*$/gi, '')
    .trim();
}

function titleKey(value) {
  return cleanTitleString(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function rawTitleKey(value) {
  return String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function tokenSet(value) {
  return new Set(titleKey(value).split(/\s+/).filter((token) => token.length > 1));
}

function matchesRequestedTrack(candidate, title, artist) {
  const requestedTitle = titleKey(title);
  const candidateTitle = titleKey(candidate.title);
  const rawRequested = rawTitleKey(title);
  const rawCandidate = rawTitleKey(candidate.title);
  const titlesMatch = (requestedTitle && candidateTitle === requestedTitle)
    || (rawRequested && rawCandidate === rawRequested);
  if (!titlesMatch) return false;
  const requestedArtistTokens = tokenSet(artist);
  if (requestedArtistTokens.size === 0) return true;
  const candidateArtistTokens = tokenSet(candidate.artist);
  return [...requestedArtistTokens].some((token) => candidateArtistTokens.has(token));
}

function isLikelySameTrack(left, right) {
  return matchesRequestedTrack(left, right.title, right.artist)
    || matchesRequestedTrack(right, left.title, left.artist);
}

export const multiSourceProvider = {
  async search(query, type = 'all', limit = 30) {
    if (!query?.trim()) return { query: '', songs: [], videos: [], artists: [], albums: [], podcasts: [], results: [] };
    // Keep room for lower-priority providers in the merged result. Asking the
    // primary provider for the full limit used to crowd out every YouTube-video
    // fallback before it could be displayed.
    const providerLimit = Math.max(10, Math.ceil(limit / 2));
    const responses = await Promise.all([
      ...providers.slice(0, 4).map((provider) => provider.search(query, providerLimit).catch(() => [])),
      // Regular YouTube is search fallback only; it is still needed in results
      // when InnerTube/providers do not carry a regional or rare song.
      searchYouTubeHighEnd(`${query} official audio`, providerLimit).catch(() => []),
    ]);
    const songs = [];
    const seen = new Set();
    const canonicalByKey = new Map();
    const canonicalEntries = [];
    const mappingWrites = [];
    for (const response of responses) {
      for (const rawTrack of response) {
        if (!rawTrack?.providerTrackId && !rawTrack?.id) continue;
        const candidate = rawTrack.provider
          ? rawTrack
          : {
            ...rawTrack,
            provider: 'youtube_video',
            providerTrackId: rawTrack.providerTrackId || rawTrack.videoId || rawTrack.id,
            sourceType: 'youtube_video',
          };
        const track = normalizeResult(candidate);
        const key = dedupeKey(track);
        const existingCanonicalId = canonicalByKey.get(key)
          || canonicalEntries.find((entry) => isLikelySameTrack(entry.track, track))?.canonicalTrackId;
        if (existingCanonicalId) {
          canonicalByKey.set(key, existingCanonicalId);
          mappingWrites.push(persistMapping(track, existingCanonicalId));
          continue;
        }
        canonicalByKey.set(key, track.canonicalTrackId);
        canonicalEntries.push({ track, canonicalTrackId: track.canonicalTrackId });
        mappingWrites.push(persistMapping(track, track.canonicalTrackId));
        if (seen.has(key) || songs.length >= limit) continue;
        seen.add(key);
        songs.push(track);
      }
    }
    await Promise.all(mappingWrites);
    return { query: query.trim(), songs, videos: [], artists: [], albums: [], podcasts: [], results: songs };
  },

  async searchMulti(query, limit = 30) {
    const result = await this.search(query, 'songs', limit);
    return { ...result, providerPriority: ['youtube_music', 'jiosaavn', 'jamendo', 'audius', 'youtube_video', 'scraper'] };
  },

  async resolveStream(trackOrId) {
    const rawId = typeof trackOrId === 'string' ? trackOrId : trackOrId?.canonicalTrackId || trackOrId?.id;
    const effectiveTitle = typeof trackOrId === 'object' ? trackOrId?.title : null;
    if (!rawId && !effectiveTitle) return null;
    const id = rawId || `track_${crypto.createHash('sha256').update(`${effectiveTitle}:${trackOrId?.artist || ''}`).digest('hex').slice(0, 16)}`;

    let candidates = [];
    if (id.startsWith('ytm_')) {
      candidates.push({ provider: innertubeProvider, providerTrackId: id.slice(4) });
      const mappings = await getCachedMappings(id);
      console.info('[resolver] canonical mapping lookup', {
        canonicalTrackId: id,
        mappingCount: mappings.length,
        providers: mappings.map((mapping) => mapping.provider_name),
      });
      candidates.push(...mappings.map((mapping) => ({
        provider: providers.find((provider) => provider.name === mapping.provider_name),
        providerTrackId: mapping.provider_track_id,
      })).filter((candidate) => candidate.provider && candidate.provider.name !== 'youtube_music'));

      // InnerTube search IDs are also YouTube media IDs. When the private
      // music player endpoint is unavailable to an unauthenticated server,
      // try the exact media ID through the regular direct-audio extractors
      // before broad metadata-based searches. This preserves the requested
      // YouTube version and avoids silently substituting a different song
      // from JioSaavn when the original YouTube audio is still playable.
      candidates.push({ provider: youtubeVideoProvider, providerTrackId: id.slice(4) });
    } else if (id.startsWith('map_')) {
      const mappings = await getCachedMappings(id);
      candidates = mappings.map((mapping) => ({
        provider: providers.find((provider) => provider.name === mapping.provider_name),
        providerTrackId: mapping.provider_track_id,
      })).filter((candidate) => candidate.provider);
    } else if (id.startsWith('canonical_') && typeof trackOrId === 'object') {
      // Home feed regional IDs retain the real provider ID separately.
      // Resolve that provider directly instead of accidentally sending the
      // canonical wrapper ID to every provider.
      const canonicalBody = id.slice('canonical_'.length);
      const providerName = canonicalBody.startsWith('youtube_video_') || canonicalBody.startsWith('youtube_')
        ? 'youtube_video'
        : ['jiosaavn', 'jamendo', 'audius', 'scraper'].find((name) => canonicalBody.startsWith(`${name}_`));
      const provider = providers.find((candidate) => candidate.name === providerName)
        || providers.find((candidate) => candidate.name === trackOrId.provider);
      if (provider && trackOrId.providerTrackId) {
        candidates.push({ provider, providerTrackId: trackOrId.providerTrackId });
      }
    } else {
      candidates = providers.map((provider) => ({ provider, providerTrackId: id }));
    }
    const title = typeof trackOrId === 'object' ? trackOrId.title : null;
    const artist = typeof trackOrId === 'object' ? trackOrId.artist : null;

    // Fast-path: When title is present, resolve via JioSaavn studio audio immediately (sub-350ms)
    if (title) {
      try {
        const cleanTitle = cleanTitleString(title) || title;
        const searchQueries = [
          ...(artist ? [`${artist} ${cleanTitle}`.trim(), `${cleanTitle} ${artist}`.trim()] : []),
          cleanTitle,
          ...(cleanTitle !== title ? (artist ? [`${artist} ${title}`.trim(), `${title} ${artist}`.trim()] : [title]) : []),
        ].filter(Boolean);
        let match = null;
        for (const query of searchQueries) {
          const results = await jiosaavnProvider.search(query, 20).catch(() => []);
          const candidates = results
            .filter((candidate) => matchesRequestedTrack(candidate, title, artist))
            .sort((left, right) => Number(Boolean(right.providerMetadata?.is320kbps)) - Number(Boolean(left.providerMetadata?.is320kbps)));
          if (candidates.length > 0) {
            match = candidates[0];
            break;
          }
        }
        if (match) {
          const stream = await jiosaavnProvider.resolveStream(match);
          if (stream?.ok && stream.url) {
            return { ...stream, canonicalTrackId: id };
          }
        }
      } catch (err) {
        console.warn('[resolver] fast-path JioSaavn failed, falling through', err?.message);
      }
    }

    const preferredProvider = typeof trackOrId === 'object' ? trackOrId.provider : null;
    const ordered = [...candidates].sort((left, right) => {
      // For a YouTube Music canonical ID, preserve the exact requested
      // YouTube media before substituting a catalog match from another
      // provider. InnerTube remains the primary path; youtubeVideoProvider
      // is only the same-ID extraction fallback. This prevents a JioSaavn
      // result from replacing the selected remix/live/version prematurely.
      if (id.startsWith('ytm_')) {
        const rank = (candidate) => candidate.provider.name === 'youtube_music'
          ? 0
          : candidate.provider.name === 'youtube_video'
            ? 1
            : 2;
        const leftRank = rank(left);
        const rightRank = rank(right);
        if (leftRank !== rightRank) return leftRank - rightRank;
      }
      if (preferredProvider) {
        const leftPreferred = left.provider.name === preferredProvider ? 0 : 1;
        const rightPreferred = right.provider.name === preferredProvider ? 0 : 1;
        if (leftPreferred !== rightPreferred) return leftPreferred - rightPreferred;
      }
      return left.provider.priority - right.provider.priority;
    });
    for (const candidate of ordered) {
      const stream = await candidate.provider.resolveStream({
        ...(typeof trackOrId === 'object' ? trackOrId : {}),
        providerTrackId: candidate.providerTrackId,
      });
      if (stream?.ok && stream.url) return { ...stream, canonicalTrackId: id };
    }

    // Last resort: use the existing YouTube scraper only to discover a video
    if (title) {
      const cleanTitle = cleanTitleString(title) || title;
      const query = `${cleanTitle} ${artist || ''}`.trim();
      for (const provider of [jiosaavnProvider, jamendoProvider, audiusProvider]) {
        const searchQueries = [
          query,
          `${artist || ''} ${cleanTitle}`.trim(),
          cleanTitle,
          ...(cleanTitle !== title ? [`${title} ${artist || ''}`.trim(), `${artist || ''} ${title}`.trim(), title] : []),
          artist,
        ].filter(Boolean);
        const matches = [];
        const seenProviderTracks = new Set();
        for (const searchQuery of searchQueries) {
          const results = await provider.search(searchQuery, 50).catch(() => []);
          for (const result of results) {
            const providerTrackId = result.providerTrackId || result.id;
            if (!providerTrackId || seenProviderTracks.has(providerTrackId)) continue;
            seenProviderTracks.add(providerTrackId);
            matches.push(result);
          }
        }
        console.info('[resolver] fallback search', { provider: provider.name, matchCount: matches.length });
        let match = matches
          .filter((candidate) => matchesRequestedTrack(candidate, title, artist))
          .sort((left, right) => Number(Boolean(right.providerMetadata?.is320kbps))
            - Number(Boolean(left.providerMetadata?.is320kbps)))[0];
        if (!match && !artist) {
          match = matches
            .filter((candidate) => titleKey(candidate.title) === titleKey(title))
            .sort((left, right) => Number(Boolean(right.providerMetadata?.is320kbps))
              - Number(Boolean(left.providerMetadata?.is320kbps)))[0];
        }
        if (!match) continue;
        const persisted = await persistMapping(match, id);
        console.info('[resolver] fallback match selected', {
          canonicalTrackId: id,
          provider: provider.name,
          providerTrackId: match.providerTrackId,
          title: match.title,
          artist: match.artist,
          persisted,
        });
        const stream = await provider.resolveStream(match);
        if (stream?.ok && stream.url) return { ...stream, canonicalTrackId: id };
      }

      const scraped = await searchYouTubeHighEnd(`${title} ${artist || ''}`, 3).catch(() => []);
      for (const candidate of scraped) {
        const stream = await youtubeVideoProvider.resolveStream(candidate.providerTrackId || candidate.videoId || candidate.id);
        if (stream?.ok && stream.url) return { ...stream, canonicalTrackId: id, sourceType: 'scraper' };
      }
    }
    return null;
  },
};

export default multiSourceProvider;
