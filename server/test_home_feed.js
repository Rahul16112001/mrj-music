import assert from 'node:assert/strict';
import { normalizeHomeTrack } from './home/homeTrackNormalizer.js';

const youtubeMusic = normalizeHomeTrack({
  provider: 'youtube_music', providerTrackId: 'home-ytm', title: 'Shape &amp; of You', artist: 'Ed Sheeran',
  album: 'Divide', duration: 233, artworkUrl: 'https://i.ytimg.com/vi/home-ytm/hqdefault.jpg',
});
assert.equal(youtubeMusic.canonicalTrackId, 'ytm_home-ytm');
assert.equal(youtubeMusic.title, 'Shape & of You');
assert.match(youtubeMusic.artworkUrl, /maxresdefault\.jpg$/);

const regional = normalizeHomeTrack({
  provider: 'jiosaavn', providerTrackId: 'regional-123', title: 'Regional Track', artist: 'Regional Artist',
  artworkUrl: 'https://img.saavncdn.com/150x150/cover.jpg', sourceAvailable: true,
});
assert.match(regional.canonicalTrackId, /^canonical_jiosaavn_regional_123_[a-f0-9]{12}$/);
assert.equal(regional.sourceAvailable, true);
assert.equal(normalizeHomeTrack({ provider: 'jiosaavn', providerTrackId: 'bad', title: 'Wrong', artist: 'Artist', artworkUrl: 'https://example.com/a.jpg' }, { requestedTitle: 'Expected' }), null);
console.log('home feed normalization tests: PASS');
