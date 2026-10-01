import multer from 'multer';
import { AppError } from '../utils/helpers.js';

export const RULES = {
  image: { mimes: ['image/jpeg','image/png','image/webp','image/gif'], max: 5 * 1024 * 1024 },
  voice: { mimes: ['audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav','audio/x-m4a'], max: 8 * 1024 * 1024 },
  file: { mimes: ['application/pdf','text/plain','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png'], max: 10 * 1024 * 1024 }
};
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = Object.values(RULES).some(r => r.mimes.includes(file.mimetype.split(';')[0]));
    cb(ok ? null : new AppError('Unsupported file type', 400), ok);
  }
});
