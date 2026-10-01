import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

// Some ISPs/routers refuse SRV lookups needed by mongodb+srv:// URIs
dns.setServers(['8.8.8.8', '1.1.1.1']);

export async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('MongoDB connected:', mongoose.connection.host);
}