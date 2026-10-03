import crypto from 'crypto';
const STUN = { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] };
/**
 * ICE servers for WebRTC. STUN always; TURN when configured.
 * - TURN_SECRET set: short-lived credentials (coturn `use-auth-secret` / TURN REST API), valid 6 hours.
 * - else TURN_USERNAME + TURN_CREDENTIAL: static credentials (e.g. Metered, Twilio, Xirsys).
 */
export function buildIceServers(cfg, userId, now = Date.now()) {
  const urls = [...String(cfg.TURN_URLS || '').split(','), cfg.TURN_URL || ''].map((s) => s.trim()).filter(Boolean);
  if (!urls.length) return { iceServers: [STUN], turn: false };
  if (cfg.TURN_SECRET) {
    const username = `${Math.floor(now / 1000) + 6 * 3600}:${userId}`;
    const credential = crypto.createHmac('sha1', cfg.TURN_SECRET).update(username).digest('base64');
    return { iceServers: [STUN, { urls, username, credential }], turn: true };
  }
  if (cfg.TURN_USERNAME && cfg.TURN_CREDENTIAL) return { iceServers: [STUN, { urls, username: cfg.TURN_USERNAME, credential: cfg.TURN_CREDENTIAL }], turn: true };
  return { iceServers: [STUN], turn: false };
}
