const crypto = require('crypto');

const CHALLENGES = new Map();
const RATE_BUCKETS = new Map();

const CHALLENGE_TTL_MS = 1000 * 60 * 5; // 5 minutes
const RATE_LIMIT = 40;
const RATE_WINDOW_MS = 1000 * 60;

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function getIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  if (Array.isArray(xf) && xf.length) return String(xf[0]).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

function rateLimit(ip) {
  const now = Date.now();
  const key = `${ip}:${Math.floor(now / RATE_WINDOW_MS)}`;
  const next = (RATE_BUCKETS.get(key) || 0) + 1;
  RATE_BUCKETS.set(key, next);
  setTimeout(() => RATE_BUCKETS.delete(key), RATE_WINDOW_MS + 5000).unref?.();
  return next <= RATE_LIMIT;
}

function cleanExpiredChallenges() {
  const now = Date.now();
  for (const [id, item] of CHALLENGES.entries()) {
    if ((now - item.createdAt) > CHALLENGE_TTL_MS) {
      CHALLENGES.delete(id);
    }
  }
}

function makeChallenge() {
  const a = Math.floor(Math.random() * 8) + 2;
  const b = Math.floor(Math.random() * 8) + 2;
  const ops = ['+', '-', '*'];
  const op = ops[Math.floor(Math.random() * ops.length)];

  let answer = 0;
  if (op === '+') answer = a + b;
  if (op === '-') answer = a - b;
  if (op === '*') answer = a * b;

  const id = crypto.randomBytes(16).toString('hex');
  CHALLENGES.set(id, {
    answer: String(answer),
    createdAt: Date.now(),
    attempts: 0,
  });

  return { token: id, question: `${a} ${op} ${b} = ?` };
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = await new Promise(resolve => {
    let s = '';
    req.on('data', chunk => { s += chunk; });
    req.on('end', () => resolve(s));
  });
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

module.exports = async function handler(req, res) {
  applySecurityHeaders(res);
  cleanExpiredChallenges();

  const ip = getIp(req);
  if (!rateLimit(ip)) {
    return json(res, 429, { error: 'Too many requests. Please try again shortly.' });
  }

  if (req.method === 'GET') {
    const challenge = makeChallenge();
    return json(res, 200, challenge);
  }

  if (req.method === 'POST') {
    const body = await parseBody(req);
    const token = String(body?.token || '').trim();
    const answer = String(body?.answer || '').replace(/\s+/g, '').trim();

    if (!token || token.length > 80) return json(res, 400, { error: 'Invalid token' });
    if (!answer || answer.length > 20 || !/^-?\d+$/.test(answer)) {
      return json(res, 400, { error: 'Invalid answer format' });
    }

    const challenge = CHALLENGES.get(token);
    if (!challenge) return json(res, 400, { error: 'Challenge expired. Please refresh and try again.' });

    challenge.attempts += 1;
    if (challenge.attempts > 5) {
      CHALLENGES.delete(token);
      return json(res, 429, { error: 'Too many attempts. Please request a new challenge.' });
    }

    if ((Date.now() - challenge.createdAt) > CHALLENGE_TTL_MS) {
      CHALLENGES.delete(token);
      return json(res, 400, { error: 'Challenge expired. Please refresh and try again.' });
    }

    const ok = answer === challenge.answer;
    if (!ok) return json(res, 400, { error: 'Incorrect challenge answer.' });

    CHALLENGES.delete(token);
    return json(res, 200, { ok: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return json(res, 405, { error: 'Method not allowed' });
};

