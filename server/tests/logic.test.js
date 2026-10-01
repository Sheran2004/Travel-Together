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
console.log('logic tests passed');
