// Strips Mongo operator keys ($..., a.b) from user input to prevent NoSQL injection.
const clean = (o) => {
  if (Array.isArray(o)) return o.map(clean);
  if (o && typeof o === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(o)) { if (k.startsWith('$') || k.includes('.')) continue; out[k] = clean(v); }
    return out;
  }
  return o;
};
export const sanitize = (req, _res, next) => {
  if (req.body) req.body = clean(req.body);
  if (req.query) { const q = clean(req.query); for (const k of Object.keys(req.query)) delete req.query[k]; Object.assign(req.query, q); }
  if (req.params) req.params = clean(req.params);
  next();
};
