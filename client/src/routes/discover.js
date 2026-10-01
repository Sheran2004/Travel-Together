import { Router } from 'express';
import Trip from '../models/Trip.js';
import User from '../models/User.js';
import { protect, optionalAuth } from '../middleware/auth.js';
import { AppError, wrap, escapeRegex } from '../utils/helpers.js';
import { DESTINATIONS, findDestination } from '../utils/destinations.js';
import { env } from '../config/env.js';

const r = Router();
// Nominatim's usage policy requires a User-Agent that identifies you. Set CONTACT_EMAIL in server/.env.
const UA = `TravelTogether/1.0 (${process.env.CONTACT_EMAIL || 'set-CONTACT_EMAIL-in-env'})`;
const cache = new Map();
const cached = async (key, ttl, fn) => { const hit = cache.get(key); if (hit && hit.exp > Date.now()) return hit.v; const v = await fn(); cache.set(key, { v, exp: Date.now() + ttl }); if (cache.size > 500) cache.delete(cache.keys().next().value); return v; };
let lastNominatim = 0;
const throttle = async () => { const wait = 1100 - (Date.now() - lastNominatim); if (wait > 0) await new Promise(r => setTimeout(r, wait)); lastNominatim = Date.now(); }; // Nominatim policy: max 1 req/s

const shape = (p) => ({
  displayName: p.display_name, latitude: parseFloat(p.lat), longitude: parseFloat(p.lon),
  destination: p.name || p.address?.city || p.address?.town || p.address?.village || p.display_name.split(',')[0],
  city: p.address?.city || p.address?.town || p.address?.village || p.address?.county || p.name || '',
  state: p.address?.state || '', country: p.address?.country || '', type: p.type
});

/* Geocoding via OpenStreetMap Nominatim (server-side proxy: sets a proper User-Agent, throttles, caches) */
r.get('/geo/search', protect, wrap(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) throw new AppError('Type at least 2 characters', 400);
  const results = await cached(`s:${q.toLowerCase()}`, 10 * 60000, async () => {
    await throttle();
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(q)}`;
    const resp = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new AppError('Location search is temporarily unavailable', 502);
    return (await resp.json()).map(shape);
  }).catch(e => { throw e instanceof AppError ? e : new AppError('Location search is temporarily unavailable', 502); });
  res.json({ success: true, results });
}));
r.get('/geo/reverse', protect, wrap(async (req, res) => {
  const lat = +req.query.lat, lng = +req.query.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new AppError('lat and lng are required', 400);
  const result = await cached(`r:${lat.toFixed(3)},${lng.toFixed(3)}`, 60 * 60000, async () => {
    await throttle();
    const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new AppError('Location lookup is temporarily unavailable', 502);
    const p = await resp.json(); if (p.error) throw new AppError('No place found at that point', 404);
    return shape(p);
  });
  res.json({ success: true, result });
}));

/* Routing via the public OSRM demo server (driving). Falls back cleanly on failure. */
r.get('/geo/route', protect, wrap(async (req, res) => {
  const pts = String(req.query.points || '').split(';').map(p => p.split(',').map(Number)).filter(p => p.length === 2 && p.every(Number.isFinite));
  if (pts.length < 2 || pts.length > 25) throw new AppError('Provide 2–25 points as lat,lng;lat,lng', 400);
  const key = pts.map(p => p.map(n => n.toFixed(4)).join(',')).join(';');
  const data = await cached(`route:${key}`, 60 * 60000, async () => {
    const coords = pts.map(([la, ln]) => `${ln},${la}`).join(';');
    const resp = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new AppError('Routing is temporarily unavailable', 502);
    const j = await resp.json();
    if (j.code !== 'Ok' || !j.routes?.[0]) throw new AppError('No drivable route found between these places', 404);
    const rt = j.routes[0];
    return { distanceKm: Math.round(rt.distance / 100) / 10, durationHours: Math.round(rt.duration / 360) / 10, line: rt.geometry.coordinates.map(([ln, la]) => [la, ln]) };
  });
  res.json({ success: true, ...data });
}));

/* Real weather via Open-Meteo (no API key). */
const WMO = { 0: 'Clear sky', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail' };
r.get('/weather', wrap(async (req, res) => {
  const lat = +req.query.lat, lng = +req.query.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new AppError('lat and lng are required', 400);
  const data = await cached(`w:${lat.toFixed(2)},${lng.toFixed(2)}`, 15 * 60000, async () => {
    const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) throw new AppError('Weather is temporarily unavailable', 502);
    const j = await resp.json();
    return {
      current: { temperature: j.current.temperature_2m, condition: WMO[j.current.weather_code] || 'Unknown', wind: j.current.wind_speed_10m, humidity: j.current.relative_humidity_2m },
      forecast: j.daily.time.map((d, i) => ({ date: d, condition: WMO[j.daily.weather_code[i]] || 'Unknown', max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i], rainChance: j.daily.precipitation_probability_max[i] })), source: 'Open-Meteo'
    };
  });
  res.json({ success: true, ...data });
}));

/* Destinations: editorial info + live counts from MongoDB */
const countsFor = async () => {
  const active = { status: 'active', visibility: 'public', startDate: { $gt: new Date() } };
  const rows = await Trip.aggregate([{ $match: active }, { $group: { _id: { $toLower: '$destination' }, n: { $sum: 1 }, state: { $first: '$state' } } }]);
  return rows;
};
const countFor = (d, rows) => rows.filter(r => r._id.includes(d.name.toLowerCase()) || (d.slug === 'himachal-pradesh' && ['spiti', 'kasol', 'shimla', 'dharamshala'].some(k => r._id.includes(k)))).reduce((a, r) => a + r.n, 0);
r.get('/destinations', wrap(async (_req, res) => {
  const rows = await countsFor();
  res.json({ success: true, destinations: DESTINATIONS.map(d => ({ ...d, activeTrips: countFor(d, rows) })) });
}));
r.get('/destinations/:slug', wrap(async (req, res) => {
  const d = findDestination(req.params.slug);
  if (!d) throw new AppError('Destination not found', 404);
  const re = new RegExp(escapeRegex(d.name), 'i');
  const trips = await Trip.find({ status: 'active', visibility: 'public', startDate: { $gt: new Date() }, $or: [{ destination: re }, { city: re }, ...(d.slug === 'himachal-pradesh' ? [{ state: re }] : [])] }).sort('startDate').limit(24).populate('creator', 'name username profileImage');
  res.json({ success: true, destination: { ...d, activeTrips: trips.length }, trips });
}));

/* Client bootstrap config */
r.get('/meta', (_req, res) => {
  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  if (env.TURN_URL) iceServers.push({ urls: env.TURN_URL, username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL });
  res.json({ success: true, iceServers, uploads: env.CLOUDINARY ? 'cloudinary' : 'local' });
});
export default r;