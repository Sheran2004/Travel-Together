import assert from 'node:assert/strict';
import { compatibility, tripRecommendationScore } from '../utils/matching.js';
import { computeBalances } from '../utils/balances.js';
import { haversineKm, boundingBox } from '../utils/geo.js';

// balances: A pays 300 for A,B,C -> B and C each owe A 100
let b = computeBalances([{ amount: 300, paidBy: 'A', participants: ['A', 'B', 'C'] }]);
assert.equal(b.total, 300); assert.deepEqual(b.net, { A: 200, B: -100, C: -100 });
assert.equal(b.settlements.length, 2); assert(b.settlements.every(s => s.to === 'A' && s.amount === 100));
// offsetting expenses settle to one transfer
b = computeBalances([{ amount: 200, paidBy: 'A', participants: ['A', 'B'] }, { amount: 100, paidBy: 'B', participants: ['A', 'B'] }]);
assert.deepEqual(b.settlements, [{ from: 'B', to: 'A', amount: 50 }]);
// geo: Delhi -> Manali ≈ 500 km straight line-ish (≈ 460-520)
const d = haversineKm(28.6139, 77.209, 32.2396, 77.1887); assert(d > 390 && d < 460, `distance ${d}`);
const bb = boundingBox(28.6, 77.2, 100); assert(bb.minLat < 28.6 && bb.maxLat > 28.6);
// matching
const me = { travelStyle: ['Trekking'], travelInterests: ['Trekking', 'Photography'], favoriteDestinations: ['Manali'], budgetMin: 3000, budgetMax: 30000 };
const twin = compatibility(me, { ...me }, [], []); assert.equal(twin.score, 100);
const far = compatibility(me, { travelStyle: ['Luxury'], travelInterests: ['Wine'], favoriteDestinations: ['Goa'], budgetMin: 100000, budgetMax: 200000 }, [], []); assert.equal(far.score, 0);
const part = compatibility(me, { travelStyle: ['Trekking'], travelInterests: ['Food'], favoriteDestinations: ['Goa'], budgetMin: 5000, budgetMax: 25000 }, [], []);
assert(part.score > 0 && part.score < 100 && /travel style/.test(part.explanation), part.explanation);
const rec = tripRecommendationScore({ ...me }, { title: 'Manali Trek', category: 'Trekking', description: '', destination: 'Manali', state: '', travelStyle: 'Trekking', budget: 9000 });
assert(rec.score >= 80);
const { buildIceServers } = await import('../utils/turn.js');
let ice = buildIceServers({}, 'u1'); assert.equal(ice.turn, false); assert.equal(ice.iceServers.length, 1);
ice = buildIceServers({ TURN_URLS: 'turn:a:3478, turns:a:5349', TURN_USERNAME: 'x', TURN_CREDENTIAL: 'y' }, 'u1'); assert.equal(ice.turn, true); assert.deepEqual(ice.iceServers[1].urls, ['turn:a:3478', 'turns:a:5349']); assert.equal(ice.iceServers[1].username, 'x');
const t0 = 1_700_000_000_000; ice = buildIceServers({ TURN_URL: 'turn:a:3478', TURN_SECRET: 's3cret' }, 'u1', t0); const tu = ice.iceServers[1];
assert.equal(tu.username, `${Math.floor(t0 / 1000) + 21600}:u1`);
assert.equal(tu.credential, (await import('node:crypto')).createHmac('sha1', 's3cret').update(tu.username).digest('base64'));
ice = buildIceServers({ TURN_URLS: 'turn:a:3478' }, 'u1'); assert.equal(ice.turn, false, 'TURN urls without credentials are ignored');
const { parseFrom } = await import('../utils/helpers.js');
assert.deepEqual(parseFrom('Travel Together <no-reply@x.com>'), { name: 'Travel Together', email: 'no-reply@x.com' });
assert.deepEqual(parseFrom('plain@x.com'), { name: 'Travel Together', email: 'plain@x.com' });
console.log('logic tests passed');
