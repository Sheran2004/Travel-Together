export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 70);
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));
export const sameId = (a, b) => String(a?._id || a) === String(b?._id || b);
export const paginate = (q, def = 12) => {
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(q.limit) || def));
  return { page, limit, skip: (page - 1) * limit };
};

/** 'Travel Together <no-reply@x.com>' -> { name, email } */
export const parseFrom = (s) => {
  const m = /^(.*?)\s*<(.+?)>$/.exec(String(s || '').trim());
  return m ? { name: m[1].replace(/^"|"$/g, '').trim() || 'Travel Together', email: m[2].trim() } : { name: 'Travel Together', email: String(s || '').trim() };
};
