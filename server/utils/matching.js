// Transparent rule-based compatibility. NOT an AI model.
const norm = (a = []) => a.map(s => String(s).toLowerCase().trim()).filter(Boolean);
const inter = (a, b) => { const B = new Set(b); return [...new Set(a)].filter(x => B.has(x)); };
const overlapRange = (a0, a1, b0, b1) => {
  const lo = Math.max(a0, b0), hi = Math.min(a1, b1);
  if (hi < lo) return 0;
  const span = Math.max(1, Math.min(a1 - a0, b1 - b0));
  return Math.min(1, (hi - lo + 1) / (span + 1));
};

/**
 * me/other: { travelStyle[], travelInterests[], favoriteDestinations[], budgetMin, budgetMax }
 * myTrips/otherTrips: [{ destination, startDate, endDate, category }]
 */
export function compatibility(me, other, myTrips = [], otherTrips = []) {
  const factors = [];
  const reasons = [];

  const myDest = new Set([...norm(me.favoriteDestinations), ...myTrips.map(t => t.destination.toLowerCase())]);
  const otDest = new Set([...norm(other.favoriteDestinations), ...otherTrips.map(t => t.destination.toLowerCase())]);
  if (myDest.size && otDest.size) {
    const shared = inter([...myDest], [...otDest]);
    factors.push({ w: 25, s: shared.length ? 1 : 0 });
    if (shared.length) reasons.push(`destination (${shared.slice(0, 2).join(', ')})`);
  }
  const ms = norm(me.travelStyle), os = norm(other.travelStyle);
  if (ms.length && os.length) {
    const shared = inter(ms, os);
    factors.push({ w: 20, s: shared.length / Math.min(ms.length, os.length) });
    if (shared.length) reasons.push(`travel style (${shared[0]})`);
  }
  if (me.budgetMax != null && other.budgetMax != null) {
    const s = overlapRange(me.budgetMin || 0, me.budgetMax, other.budgetMin || 0, other.budgetMax);
    factors.push({ w: 20, s });
    if (s >= 0.5) reasons.push('budget');
  }
  const mi = norm(me.travelInterests), oi = norm(other.travelInterests);
  if (mi.length && oi.length) {
    const shared = inter(mi, oi);
    factors.push({ w: 20, s: shared.length / Math.min(mi.length, oi.length) });
    if (shared.length) reasons.push(`${shared[0]} interest`);
  }
  if (myTrips.length && otherTrips.length) {
    const hit = myTrips.some(a => otherTrips.some(b => new Date(a.startDate) <= new Date(b.endDate) && new Date(b.startDate) <= new Date(a.endDate)));
    factors.push({ w: 15, s: hit ? 1 : 0 });
    if (hit) reasons.push('travel dates');
  }
  const totalW = factors.reduce((a, f) => a + f.w, 0);
  if (!totalW) return { score: 0, reasons: [], explanation: 'Add interests, style and budget to your profile to see compatibility.' };
  const score = Math.round((factors.reduce((a, f) => a + f.w * f.s, 0) / totalW) * 100);
  const explanation = reasons.length ? `Matches on ${reasons.join(', ').replace(/, ([^,]*)$/, ' and $1')}.` : 'No strong overlaps yet.';
  return { score, reasons, explanation };
}

export function tripRecommendationScore(user, trip) {
  let score = 0; const why = [];
  const ints = norm(user.travelInterests);
  const hay = `${trip.title} ${trip.category} ${trip.description} ${(trip.activities || []).join(' ')}`.toLowerCase();
  const hits = ints.filter(i => hay.includes(i));
  if (hits.length) { score += 30 + Math.min(20, hits.length * 5); why.push(`your interest in ${hits[0]}`); }
  if (norm(user.favoriteDestinations).some(d => `${trip.destination} ${trip.state}`.toLowerCase().includes(d))) { score += 30; why.push('a favorite destination'); }
  if (trip.travelStyle && norm(user.travelStyle).includes(trip.travelStyle.toLowerCase())) { score += 20; why.push(`${trip.travelStyle} style`); }
  if (trip.budget >= (user.budgetMin || 0) && trip.budget <= (user.budgetMax || Infinity)) { score += 15; why.push('your budget'); }
  return { score, why };
}
