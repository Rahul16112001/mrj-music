import assert from 'node:assert/strict';
import { HOME_VERIFICATION_TTLS, getHomeVerificationCacheSize, clearHomeVerificationCache } from './home/homeTrackVerifier.js';

assert.equal(HOME_VERIFICATION_TTLS.success, 60 * 60 * 1000);
assert.equal(HOME_VERIFICATION_TTLS.failure, 30 * 60 * 1000);
clearHomeVerificationCache();
assert.equal(getHomeVerificationCacheSize(), 0);
console.log('home feed verification cache tests: PASS');
