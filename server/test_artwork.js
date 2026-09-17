import assert from 'node:assert/strict';
import { normalizeHomeTrack } from './home/homeTrackNormalizer.js';

const good = normalizeHomeTrack({ provider: 'jiosaavn', providerTrackId: 'good', title: 'Good', artist: 'Artist', artworkUrl: 'https://img.saavncdn.com/500x500/cover.jpg' });
assert.match(good.artworkUrl, /800x800/);
const tooSmall = normalizeHomeTrack({ provider: 'jiosaavn', providerTrackId: 'small', title: 'Small', artist: 'Artist', artworkUrl: 'https://img.saavncdn.com/150x150/cover.jpg' });
assert.match(tooSmall.artworkUrl, /800x800/);
const explicitSmall = normalizeHomeTrack({ provider: 'jamendo', providerTrackId: 'small', title: 'Small', artist: 'Artist', artworkUrl: 'https://img.test/200x200/cover.jpg' });
assert.equal(explicitSmall, null);
console.log('artwork quality tests: PASS');
