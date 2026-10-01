import { ZodError } from 'zod';
import { env } from '../config/env.js';
export const notFound = (req, res) => res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
export function errorHandler(err, _req, res, _next) {
  let status = err.status || 500, message = err.message || 'Server error', errors;
  if (err instanceof ZodError) { status = 400; message = 'Validation failed'; errors = Object.fromEntries(err.issues.map(i => [i.path.join('.') || '_', i.message])); }
  else if (err.name === 'ValidationError') { status = 400; errors = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message])); message = 'Validation failed'; }
  else if (err.name === 'CastError') { status = 400; message = 'Invalid identifier'; }
  else if (err.code === 11000) { status = 409; const f = Object.keys(err.keyPattern || {})[0]; message = f ? `That ${f} is already in use` : 'Duplicate entry'; }
  else if (err.name === 'MulterError') { status = 400; message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message; }
  if (status >= 500) { console.error(err); if (env.NODE_ENV === 'production') message = 'Something went wrong on our side'; }
  res.status(status).json({ success: false, message, ...(errors && { errors }) });
}
