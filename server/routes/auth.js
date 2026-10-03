import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import User, { TRAVEL_STYLES } from '../models/User.js';
import { protect, signToken } from '../middleware/auth.js';
import { AppError, wrap } from '../utils/helpers.js';
import { sendMail } from '../services/mail.js';
import { env } from '../config/env.js';

const r = Router();
async function issueVerification(user) {
  const token = crypto.randomBytes(32).toString('hex');
  await User.updateOne({ _id: user._id }, { verifyTokenHash: crypto.createHash('sha256').update(token).digest('hex'), verifyTokenExpires: new Date(Date.now() + 24 * 3600 * 1000) });
  await sendMail({ to: user.email, subject: 'Verify your Travel Together email', text: `Welcome to Travel Together! Confirm your email (valid 24 hours):\n${env.CLIENT_URL[0]}/verify-email/${token}` });
}
export const passwordRule = z.string().min(8, 'At least 8 characters').regex(/[A-Z]/, 'Add an uppercase letter').regex(/[a-z]/, 'Add a lowercase letter').regex(/[0-9]/, 'Add a number').regex(/[^A-Za-z0-9]/, 'Add a special character');
const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_.]{3,24}$/, '3–24 characters: letters, numbers, . or _'),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: passwordRule,
  confirmPassword: z.string(),
  age: z.coerce.number().int().min(18, 'You must be 18 or older').max(100),
  gender: z.enum(['male', 'female', 'non-binary', 'prefer-not-to-say']).optional().default('prefer-not-to-say'),
  city: z.string().trim().min(1, 'Enter your city').max(80),
  country: z.string().trim().max(80).optional().default('India'),
  travelInterests: z.array(z.string().trim().max(40)).max(15).optional().default([]),
  travelStyle: z.array(z.enum(TRAVEL_STYLES)).max(5).optional().default([]),
  budgetMin: z.coerce.number().min(0).optional().default(0),
  budgetMax: z.coerce.number().min(0).optional().default(50000)
}).refine(d => d.password === d.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })
  .refine(d => d.budgetMax >= d.budgetMin, { path: ['budgetMax'], message: 'Max budget must be at least min budget' });

r.post('/register', wrap(async (req, res) => {
  const { confirmPassword, ...d } = registerSchema.parse(req.body);
  if (await User.exists({ email: d.email })) throw new AppError('An account with this email already exists', 409);
  if (await User.exists({ username: d.username })) throw new AppError('That username is taken', 409);
  const user = await User.create({ ...d, password: await bcrypt.hash(d.password, 12) });
  issueVerification(user).catch((e) => console.error('verification email failed:', e.message)); // never blocks signup
  res.status(201).json({ success: true, token: signToken(user), user });
}));

r.post('/login', wrap(async (req, res) => {
  const { email, password } = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }).parse(req.body);
  const user = await User.findOne({ email }).select('+password');
  const ok = user && await bcrypt.compare(password, user.password);
  if (!ok) throw new AppError('Invalid email or password', 401);
  if (user.suspended) throw new AppError('This account has been suspended.', 403);
  res.json({ success: true, token: signToken(user), user });
}));

r.post('/verify-email', wrap(async (req, res) => {
  const { token } = z.object({ token: z.string().min(20) }).parse(req.body);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({ verifyTokenHash: hash, verifyTokenExpires: { $gt: new Date() } }).select('+verifyTokenHash +verifyTokenExpires');
  if (!user) throw new AppError('This verification link is invalid or has expired', 400);
  user.emailVerified = true; user.verifyTokenHash = undefined; user.verifyTokenExpires = undefined; await user.save();
  res.json({ success: true, message: 'Email verified' });
}));
r.post('/resend-verification', protect, wrap(async (req, res) => {
  if (req.user.emailVerified) throw new AppError('Your email is already verified', 400);
  await issueVerification(req.user);
  res.json({ success: true, message: 'Verification email sent' });
}));
r.post('/confirm-email-change', wrap(async (req, res) => {
  const { token } = z.object({ token: z.string().min(20) }).parse(req.body);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({ emailChangeHash: hash, emailChangeExpires: { $gt: new Date() } }).select('+emailChangeHash +emailChangeExpires');
  if (!user || !user.pendingEmail) throw new AppError('This confirmation link is invalid or has expired', 400);
  if (await User.exists({ email: user.pendingEmail, _id: { $ne: user._id } })) throw new AppError('That email is already in use', 409);
  user.email = user.pendingEmail; user.pendingEmail = undefined; user.emailChangeHash = undefined; user.emailChangeExpires = undefined;
  user.emailVerified = true; user.tokenVersion = (user.tokenVersion || 0) + 1; // signs out all sessions for safety
  await user.save();
  res.json({ success: true, message: 'Email updated. Please log in with your new email.' });
}));
r.get('/me', protect, (req, res) => res.json({ success: true, user: req.user }));

// Stateless JWT: logout is handled client-side; this endpoint can invalidate all sessions on request
r.post('/logout', protect, wrap(async (req, res) => {
  if (req.body?.allSessions) { req.user.tokenVersion = (req.user.tokenVersion || 0) + 1; await req.user.save(); }
  res.json({ success: true });
}));

r.post('/forgot-password', wrap(async (req, res) => {
  const { email } = z.object({ email: z.string().trim().toLowerCase().email() }).parse(req.body);
  const user = await User.findOne({ email });
  if (user && !user.suspended) {
    const token = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    await sendMail({ to: email, subject: 'Reset your Travel Together password', text: `Reset your password (valid 30 minutes):\n${env.CLIENT_URL[0]}/reset-password/${token}\n\nIf you did not request this, ignore this email.` });
  }
  // Same response either way so emails cannot be enumerated
  res.json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
}));

r.post('/reset-password', wrap(async (req, res) => {
  const { token, password } = z.object({ token: z.string().min(20), password: passwordRule }).parse(req.body);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({ resetTokenHash: hash, resetTokenExpires: { $gt: new Date() } }).select('+password +resetTokenHash +resetTokenExpires');
  if (!user) throw new AppError('This reset link is invalid or has expired', 400);
  user.password = await bcrypt.hash(password, 12);
  user.resetTokenHash = undefined; user.resetTokenExpires = undefined; user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  res.json({ success: true, message: 'Password updated. You can now log in.' });
}));
export default r;
