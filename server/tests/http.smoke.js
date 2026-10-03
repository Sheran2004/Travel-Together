// Runs WITHOUT MongoDB: verifies validation, auth guards, sanitizing and error format, plus Mongoose schema validation.
import assert from 'node:assert/strict';
process.env.MONGO_URI ||= 'mongodb://127.0.0.1:1/none'; process.env.JWT_SECRET ||= 'test-secret';
const express = (await import('express')).default;
const { sanitize } = await import('../middleware/security.js');
const { errorHandler, notFound } = await import('../middleware/error.js');
const app = express(); app.use(express.json()); app.use(sanitize);
for (const [p, f] of [['/api/push', 'push'], ['/api/users', 'users'], ['/api/auth', 'auth'], ['/api/trips', 'trips'], ['/api/admin', 'admin'], ['/api/conversations', 'chat'], ['/api/reports', null]]) {
  if (f) app.use(p, (await import(`../routes/${f}.js`)).default);
}
app.use('/api/reports', (await import('../routes/social.js')).reports);
app.use('/api/calls', (await import('../routes/social.js')).calls);
app.use('/api', notFound); app.use(errorHandler);
const srv = app.listen(0); const base = `http://127.0.0.1:${srv.address().port}`;
const call = async (m, p, body, h = {}) => { const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', ...h }, body: body && JSON.stringify(body) }); return [r.status, await r.json()]; };
let [s, j] = await call('POST', '/api/auth/register', { name: 'A', email: 'bad', password: 'weak' }); assert.equal(s, 400); assert.equal(j.success, false); assert(j.errors.email && j.errors.password);
[s, j] = await call('POST', '/api/auth/register', { name: 'Test User', username: 'tester', email: 'a@b.co', password: 'Str0ng!Pass', confirmPassword: 'Different1!', age: 25, city: 'Delhi' }); assert.equal(s, 400); assert(j.errors.confirmPassword);
[s, j] = await call('POST', '/api/auth/register', { name: 'Test User', username: 'tester', email: 'a@b.co', password: 'Str0ng!Pass', confirmPassword: 'Str0ng!Pass', age: 15, city: 'Delhi' }); assert.equal(s, 400); assert(j.errors.age);
[s, j] = await call('POST', '/api/auth/login', { email: { $gt: '' }, password: 'x' }); assert.equal(s, 400, 'operator injection rejected');
[s] = await call('GET', '/api/trips/mine'); assert.equal(s, 401);
[s] = await call('POST', '/api/trips', { title: 'x' }); assert.equal(s, 401);
[s] = await call('GET', '/api/admin/stats'); assert.equal(s, 401);
[s] = await call('GET', '/api/conversations'); assert.equal(s, 401);
[s] = await call('POST', '/api/reports', {}); assert.equal(s, 401);
[s, j] = await call('GET', '/api/auth/me', null, { authorization: 'Bearer garbage' }); assert.equal(s, 401); assert.equal(j.success, false);
[s] = await call('POST', '/api/trips/abc/transfer', { userId: 'x' }); assert.equal(s, 401);
[s] = await call('GET', '/api/admin/categories'); assert.equal(s, 401);
[s] = await call('POST', '/api/trips/abc/photos', {}); assert.equal(s, 401);
[s] = await call('GET', '/api/trips/abc/notes'); assert.equal(s, 401);
[s] = await call('POST', '/api/auth/verify-email', { token: 'short' }); assert.equal(s, 400);
[s, j] = await call('GET', '/api/push/key'); assert.equal(s, 200); assert.equal(j.enabled, false);
[s] = await call('POST', '/api/push/subscribe', {}); assert.equal(s, 401);
[s] = await call('POST', '/api/push/test'); assert.equal(s, 401);
[s] = await call('POST', '/api/users/email-change', { newEmail: 'a@b.co', password: 'x' }); assert.equal(s, 401);
[s] = await call('GET', '/api/calls/ice'); assert.equal(s, 401);
[s] = await call('POST', '/api/auth/confirm-email-change', { token: 'x' }); assert.equal(s, 400);
[s, j] = await call('GET', '/api/nope'); assert.equal(s, 404);
srv.close();

// Schema-level validation of a full trip document & user
const Trip = (await import('../models/Trip.js')).default; const User = (await import('../models/User.js')).default;
const t = new Trip({ title: 'Manali Trek', slug: 'manali-trek', destination: 'Manali', latitude: 32.2396, longitude: 77.1887, description: 'x'.repeat(30), startDate: new Date(Date.now() + 864e5), endDate: new Date(Date.now() + 3 * 864e5), budget: 9000, category: 'Trekking', maxMembers: 10, creator: new (await import('mongoose')).default.Types.ObjectId(), itinerary: [{ day: 1, locationName: 'Manali', activity: 'Arrive' }] });
await t.validate(); assert.equal(t.durationDays, 3);
const bad = new Trip({ title: 't', latitude: 999 }); await assert.rejects(bad.validate());
const u = new User({ name: 'A B', username: 'ab_1', email: 'a@b.co', password: 'hash' }); await u.validate(); assert.equal(u.toJSON().password, undefined);
console.log('http smoke + schema tests passed');
process.exit(0);
