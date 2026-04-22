const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MEMORY_BUCKETS = new Map();

function getIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  if (Array.isArray(xf) && xf.length) return String(xf[0]).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function readKnowledge() {
  const filePath = path.join(process.cwd(), 'chatbot', 'knowledge.json');
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function systemPrompt(knowledge) {
  const safe = knowledge?.safety?.scope || 'You are a simple site guide.';
  const brand = knowledge?.brand?.name ? `${knowledge.brand.name}` : 'This site';
  const location = knowledge?.brand?.location ? `Location: ${knowledge.brand.location}\n` : '';
  const services = Array.isArray(knowledge?.services) ? knowledge.services.map(s => `- ${s}`).join('\n') : '';
  const email = knowledge?.contact?.email ? knowledge.contact.email : '';

  return [
    `You are a helpful, concise chatbot embedded on ${brand}'s website.`,
    safe,
    'Rules:',
    '- Answer only questions related to this website/business (services, process, pricing/timelines at a high level, and contact info).',
    '- If asked for exact pricing or anything not specified, ask 1-2 clarifying questions and suggest contacting via the site.',
    '- If asked for anything unrelated, say you can only help with WebNest Studio and suggest what you can answer.',
    '- Never claim you performed actions (calls, emails, bookings).',
    '- Keep replies short (2-6 sentences). Use bullet points only when it improves clarity.',
    '',
    location ? location.trimEnd() : '',
    services ? `Services:\n${services}` : '',
    email ? `Contact email: ${email}` : '',
    '',
    knowledge?.brand?.positioning ? `About: ${knowledge.brand.positioning}` : ''
  ].filter(Boolean).join('\n');
}

async function memoryRateLimit(ip, { limit, windowMs }) {
  const now = Date.now();
  const bucketKey = `${ip}:${Math.floor(now / windowMs)}`;
  const count = (MEMORY_BUCKETS.get(bucketKey) || 0) + 1;
  MEMORY_BUCKETS.set(bucketKey, count);

  setTimeout(() => MEMORY_BUCKETS.delete(bucketKey), windowMs + 5000).unref?.();

  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}

async function upstashRateLimit(ip, { limit, windowSeconds }) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const hashed = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 24);
  const key = `rl:chat:${hashed}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;

  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([
      ['INCR', key],
      ['EXPIRE', key, String(windowSeconds), 'NX'],
    ]),
  });

  const data = await res.json().catch(() => null);
  const incr = Array.isArray(data) ? data[0] : null;
  const count = incr?.result ? Number(incr.result) : NaN;
  if (!Number.isFinite(count)) return null;

  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  const ip = getIp(req);
  const limit = 18;
  const windowSeconds = 60;

  try {
    const upstash = await upstashRateLimit(ip, { limit, windowSeconds });
    const rl = upstash || await memoryRateLimit(ip, { limit, windowMs: windowSeconds * 1000 });
    if (!rl.allowed) return json(res, 429, { error: 'Rate limit exceeded. Please try again in a minute.' });
  } catch {
    // If rate limiting fails, continue (best-effort).
  }

  let body = req.body;
  if (!body) {
    const raw = await new Promise(resolve => {
      let s = '';
      req.on('data', chunk => { s += chunk; });
      req.on('end', () => resolve(s));
    });
    try { body = JSON.parse(raw); } catch { body = {}; }
  }

  const message = String(body?.message || '').trim();
  if (!message) return json(res, 400, { error: 'Missing message' });
  if (message.length > 400) return json(res, 400, { error: 'Message too long' });

  const knowledge = readKnowledge();
  const sys = systemPrompt(knowledge);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(res, 500, {
      error: 'Chatbot is not configured yet. Set OPENAI_API_KEY in Vercel environment variables.',
    });
  }

  const model = process.env.CHAT_MODEL || 'gpt-4.1-mini';

  try {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_output_tokens: 260,
        input: [
          {
            role: 'system',
            content: [{ type: 'text', text: sys }],
          },
          {
            role: 'user',
            content: [{ type: 'text', text: message }],
          },
        ],
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = data?.error?.message || 'Upstream model error';
      return json(res, 502, { error: err });
    }

    const reply = (data && typeof data.output_text === 'string' && data.output_text.trim())
      ? data.output_text.trim()
      : '';

    return json(res, 200, { reply: reply || "Sorry — I couldn't generate a response right now." });
  } catch {
    return json(res, 502, { error: 'Chat service is temporarily unavailable.' });
  }
};

