import dotenv from 'dotenv';
dotenv.config();
const req = (k) => { if (!process.env[k]) { console.error(`Missing required env var ${k}. Copy .env.example to .env`); process.exit(1); } return process.env[k]; };
export const env = {
  PORT: Number(process.env.PORT) || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGO_URI: req('MONGO_URI'),
  JWT_SECRET: req('JWT_SECRET'),
  CLIENT_URL: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(s => s.trim()),
  SERVER_URL: process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`,
  CLOUDINARY: process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
    ? { cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET } : null,
  SMTP_URL: process.env.SMTP_URL || '',
  MAIL_FROM: process.env.MAIL_FROM || 'Travel Together <no-reply@traveltogether.app>',
  TURN_URL: process.env.TURN_URL || '', TURN_USERNAME: process.env.TURN_USERNAME || '', TURN_CREDENTIAL: process.env.TURN_CREDENTIAL || ''
};
