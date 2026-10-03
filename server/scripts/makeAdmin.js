import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) { console.error('Usage: npm run make-admin --prefix server -- you@example.com'); process.exit(1); }
await connectDB();
const u = await User.findOneAndUpdate({ email }, { role: 'admin' }, { new: true });
console.log(u ? `${u.email} is now an admin` : `No user found with email ${email}`);
await mongoose.disconnect();