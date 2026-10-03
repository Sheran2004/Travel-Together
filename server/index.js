import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { sanitize, helmetConfig } from './middleware/security.js';
import { mailMode } from './services/mail.js';
import { errorHandler, notFound } from './middleware/error.js';
import { uploadsDir } from './services/storage.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import tripRoutes from './routes/trips.js';
import chatRoutes, { messageRouter, uploads } from './routes/chat.js';
import { connections, invitations, notifications, reports, calls } from './routes/social.js';
import discover from './routes/discover.js';
import admin from './routes/admin.js';
import pushRoutes from './routes/push.js';
import { initSocket } from './socket.js';
import Trip from './models/Trip.js';
import { ensureCategories } from './services/categories.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet(helmetConfig));
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
if (env.NODE_ENV !== 'test') app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(sanitize);
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many requests. Please slow down.' } }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, message: { success: false, message: 'Too many attempts. Try again in a few minutes.' } });
app.use(['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/verify-email', '/api/auth/resend-verification', '/api/auth/confirm-email-change', '/api/users/email-change'], authLimiter);
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff') }));

app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok', time: new Date() }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/conversations', chatRoutes);
app.use('/api/messages', messageRouter);
app.use('/api/uploads', uploads);
app.use('/api/connections', connections);
app.use('/api/invitations', invitations);
app.use('/api/notifications', notifications);
app.use('/api/reports', reports);
app.use('/api/calls', calls);
app.use('/api/admin', admin);
app.use('/api/push', pushRoutes);
app.use('/api', discover);
app.use('/api', notFound);

// Optional: serve the built client from the same server (single-host deployment)
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'client', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { setHeaders: (res, p) => { if (p.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache'); else if (p.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); } }));
  app.get('*', (_req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(dist, 'index.html')); });
}

app.use(errorHandler);

const server = http.createServer(app);
initSocket(server);

await connectDB();
await ensureCategories();
const markCompleted = () => Trip.updateMany({ status: 'active', endDate: { $lt: new Date() } }, { status: 'completed' }).catch(e => console.error('completion job', e.message));
await markCompleted(); setInterval(markCompleted, 60 * 60 * 1000);
server.listen(env.PORT, () => {
  console.log(`Travel Together API on ${env.SERVER_URL} (${env.NODE_ENV}) | mail: ${mailMode}`);
  if (env.NODE_ENV === 'production') {
    if (!env.CLOUDINARY) console.warn('WARNING: Cloudinary is not configured. Uploaded photos/voice notes are stored on local disk and will be LOST on restart.');
    if (mailMode === 'console') console.warn('WARNING: no email provider configured (BREVO_API_KEY or SMTP_URL). Verification and reset emails will only be logged.');
  }
});
