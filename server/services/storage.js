import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { AppError } from '../utils/helpers.js';
import { RULES } from '../middleware/upload.js';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'uploads');
if (env.CLOUDINARY) cloudinary.config(env.CLOUDINARY);
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/wav': 'wav', 'application/pdf': 'pdf', 'text/plain': 'txt', 'application/zip': 'zip', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };

/** kind: image | voice | file. Returns { url, provider }. Uses Cloudinary when configured, otherwise local disk (development). */
export async function saveUpload(file, kind) {
  const rule = RULES[kind];
  const mime = file.mimetype.split(';')[0];
  if (!rule || !rule.mimes.includes(mime)) throw new AppError(`Invalid ${kind} type`, 400);
  if (file.size > rule.max) throw new AppError(`${kind} exceeds ${Math.round(rule.max / 1048576)}MB limit`, 400);
  if (env.CLOUDINARY) {
    const resource_type = kind === 'image' ? 'image' : kind === 'voice' ? 'video' : 'raw';
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({ folder: `travel-together/${kind}`, resource_type }, (e, r) => (e ? reject(e) : resolve(r))).end(file.buffer);
    });
    return { url: result.secure_url, provider: 'cloudinary' };
  }
  await fs.promises.mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${EXT[mime] || 'bin'}`;
  await fs.promises.writeFile(path.join(dir, name), file.buffer);
  return { url: `${env.SERVER_URL}/uploads/${name}`, provider: 'local' };
}
export const uploadsDir = dir;
