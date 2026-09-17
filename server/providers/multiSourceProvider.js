import crypto from 'crypto';
import axios from 'axios';
import { db } from '../db/schema.js';
import { searchYouTubeHighEnd } from '../catalog/youtubeScraper.js';
import { normalizeArtworkUrl } from './providerUtils.js';
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

function decodeHtml(value) {
  if (typeof value !== 'string') return value || '';
  return value
    .replace(/&amp;/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function extractArtistAndTitle(rawTitle, rawArtist) {
  let title = String(rawTitle || '').trim();
  let artist = String(rawArtist || '').trim();

  // Clean channel artifacts from artist
  artist = artist.replace(/vevo$/i, '').replace(/\s*-\s*topic$/i, '').replace(/\s*official\s*(channel)?$/i, '').trim();

  const isLabelArtist = !artist || artist.toLowerCase() === 'youtube' || /vevo|records|series|music|channel|official|company|entertainment|media/i.test(artist);

  if (title.includes(' | ')) {
    const parts = title.split(' | ').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      title = parts[0];
      if (isLabelArtist) artist = parts[1];
    }
  } else if (title.includes(' - ')) {
    const parts = title.split(' - ').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const candidateArtist = parts[0];
      const candidateTitle = parts.slice(1).join(' - ');
      if (isLabelArtist) {
        artist = candidateArtist;
        title = candidateTitle;
      } else {
        title = candidateTitle;
      }
    }
  }

  title = cleanTitleString(title);
  artist = artist.replace(/vevo$/i, '').trim();

  return { title, artist };
}

function cleanTitleString(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/\s*[\(\[][^\)\]]*(feat|ft\b|official|video|audio|lyric|from|ost|album|deluxe|bonus|soundtrack|hd|4k)[^\)\]]*[\)\]]/gi, '')
    .replace(/^(official|lyrical|audio|video|exclusive|full\s*song|hd|4k)\s*[:|-]\s*/gi, '')
    .replace(/\s*\|\s*.*$/g, '')
    .replace(/\s*-\s*(official|lyrical|audio|video|exclusive).*$/gi, '')
    .replace(/\s*(feat\.?|ft\.?)\s+.*$/gi, '')
    .trim();
}

async function searchArtists(query, limit = 15) {
  try {
    const url = `https://www.jiosaavn.com/api.php?__call=search.getArtistResults&_format=json&_marker=0&cc=in&includeMetaTags=1&q=${encodeURIComponent(query)}&n=${limit}&p=1`;
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 3500 });
    const results = res.data?.results || [];
    return results.map((a) => {
      const id = a.id || a.artistid || a.name;
      const name = decodeHtml(a.name || a.title);
      const image = normalizeArtworkUrl(a.image?.replace(/50x50/g, '500x500').replace(/150x150/g, '500x500')) || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400';
      return {
        id,
        name,
        title: name,
        image,
        thumbnail: image,
        category: 'Artist',
        role: a.role || 'Artist',
        followerCount: a.follower_count ? `${a.follower_count} Followers` : 'Popular Artist',
        type: 'artist',
      };
    });
  } catch (_) {
    return [];
  }
}

async function searchAlbums(query, limit = 15) {
  try {
    const url = `https://www.jiosaavn.com/api.php?__call=search.getAlbumResults&_format=json&_marker=0&cc=in&includeMetaTags=1&q=${encodeURIComponent(query)}&n=${limit}&p=1`;
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 3500 });
    const results = res.data?.results || [];
    return results.map((alb) => {
      const id = alb.albumid || alb.id;
      const title = decodeHtml(alb.title || alb.name);
      const artist = decodeHtml(alb.primary_artists || alb.music || (typeof alb.artist === 'string' ? alb.artist : 'Various Artists'));
      const image = normalizeArtworkUrl(alb.image?.replace(/50x50/g, '500x500').replace(/150x150/g, '500x500'));
      return {
        id: id || title,
        albumId: id,
        title,
        name: title,
        artist,
        thumbnail: image,
        image,
        year: alb.year || (alb.release_date ? alb.release_date.slice(0, 4) : '2024'),
        trackCount: Number(alb.more_info?.song_pids ? alb.more_info.song_pids.split(',').length : (alb.numsongs || 10)),
        type: 'album',
      };
    });
  } catch (_) {
    return [];
  }
}

async function searchPlaylists(query, limit = 15) {
  try {
    const url = `https://www.jiosaavn.com/api.php?__call=search.getPlaylistResults&_format=json&_marker=0&cc=in&includeMetaTags=1&q=${encodeURIComponent(query)}&n=${limit}&p=1`;
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 3500 });
    const results = res.data?.results || [];
    return results.map((p) => {
      const id = p.listid || p.id;
      const title = decodeHtml(p.listname || p.title || p.name);
      const image = normalizeArtworkUrl(p.image?.replace(/50x50/g, '500x500').replace(/150x150/g, '500x500'));
      return {
        id: id || title,
        playlistId: id,
        title,
        name: title,
        author: decodeHtml(p.firstname ? `${p.firstname} ${p.lastname || ''}`.trim() : (p.username || 'JioSaavn Editor')),
        thumbnail: image,
        image,
        trackCount: Number(p.count || p.numsongs || 20),
        type: 'playlist',
      };
    });
  } catch (_) {
    return [];
  }
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
    || (rawRequested && rawCandidate === rawRequested)
    || (candidateTitle && requestedTitle && (candidateTitle.includes(requestedTitle) || requestedTitle.includes(candidateTitle)));
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
    if (!query?.trim()) return { query: '', songs: [], videos: [], artists: [], albums: [], playlists: [], podcasts: [], results: [] };
    const providerLimit = Math.max(10, Math.ceil(limit / 2));
    const fetchArtists = type === 'all' || type === 'artists';
    const fetchAlbums = type === 'all' || type === 'albums';
    const fetchPlaylists = type === 'all' || type === 'playlists';

    const [responses, artists, albums, playlists] = await Promise.all([
      Promise.all([
        ...providers.slice(0, 4).map((provider) => provider.search(query, providerLimit).catch(() => [])),
        searchYouTubeHighEnd(`${query} official audio`, providerLimit).catch(() => []),
      ]),
      fetchArtists ? searchArtists(query, 15) : Promise.resolve([]),
      fetchAlbums ? searchAlbums(query, 15) : Promise.resolve([]),
      fetchPlaylists ? searchPlaylists(query, 15) : Promise.resolve([]),
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
    return { query: query.trim(), songs, videos: [], artists, albums, playlists, podcasts: [], results: songs };
  },

  async searchMulti(query, limit = 30) {
    const result = await this.search(query, 'all', limit);
    return { ...result, providerPriority: ['youtube_music', 'jiosaavn', 'jamendo', 'audius', 'youtube_video', 'scraper'] };
  },

  async resolveStream(trackOrId) {
    const rawId = typeof trackOrId === 'string' ? trackOrId : trackOrId?.canonicalTrackId || trackOrId?.id;
    const rawTitle = typeof trackOrId === 'object' ? trackOrId?.title : null;
    const rawArtist = typeof trackOrId === 'object' ? trackOrId?.artist : null;
    const extracted = extractArtistAndTitle(rawTitle, rawArtist);
    const title = extracted.title || rawTitle;
    const artist = extracted.artist || rawArtist;
    const effectiveTitle = title || rawTitle;
    if (!rawId && !effectiveTitle) return null;
    const id = rawId || `track_${crypto.createHash('sha256').update(`${effectiveTitle}:${artist || ''}`).digest('hex').slice(0, 16)}`;

    let candidates = [];
    if (id.startsWith('ytm_')) {
      const cleanVideoId = id.slice(4);
      candidates.push({ provider: innertubeProvider, providerTrackId: cleanVideoId });
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
      candidates.push({ provider: youtubeVideoProvider, providerTrackId: cleanVideoId });
    } else if (id.startsWith('ytv_')) {
      const cleanVideoId = id.slice(4);
      candidates.push({ provider: youtubeVideoProvider, providerTrackId: cleanVideoId });
      candidates.push({ provider: innertubeProvider, providerTrackId: cleanVideoId });
      const mappings = await getCachedMappings(id);
      candidates.push(...mappings.map((mapping) => ({
        provider: providers.find((provider) => provider.name === mapping.provider_name),
        providerTrackId: mapping.provider_track_id,
      })).filter((candidate) => candidate.provider));
    } else if (id.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
      candidates.push({ provider: innertubeProvider, providerTrackId: id });
      candidates.push({ provider: youtubeVideoProvider, providerTrackId: id });
      const mappings = await getCachedMappings(id);
      candidates.push(...mappings.map((mapping) => ({
        provider: providers.find((provider) => provider.name === mapping.provider_name),
        providerTrackId: mapping.provider_track_id,
      })).filter((candidate) => candidate.provider));
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
