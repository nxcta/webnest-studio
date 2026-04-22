const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MEMORY_BUCKETS = new Map();
const RESPONSE_CACHE = new Map();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'for', 'from',
  'get', 'how', 'i', 'if', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or',
  'please', 'the', 'to', 'us', 'we', 'what', 'when', 'where', 'who', 'with',
  'you', 'your'
]);

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

function normalizeText(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(input) {
  return normalizeText(input)
    .split(' ')
    .filter(Boolean)
    .filter(token => token.length > 1 && !STOPWORDS.has(token));
}

function jaccardSimilarity(aTokens, bTokens) {
  if (!aTokens.length || !bTokens.length) return 0;
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let intersection = 0;
  a.forEach(token => {
    if (b.has(token)) intersection += 1;
  });
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function maybeFaqAnswer(knowledge, userMessage) {
  const faqs = Array.isArray(knowledge?.faq) ? knowledge.faq : [];
  if (!faqs.length) return null;

  const normalizedUser = normalizeText(userMessage);
  const userTokens = tokenize(userMessage);
  if (!normalizedUser || !userTokens.length) return null;

  let best = null;
  for (const item of faqs) {
    const q = String(item?.q || '').trim();
    const a = String(item?.a || '').trim();
    if (!q || !a) continue;

    const normalizedQ = normalizeText(q);
    const qTokens = tokenize(q);
    const score = jaccardSimilarity(userTokens, qTokens);
    const directContains = normalizedQ.includes(normalizedUser) || normalizedUser.includes(normalizedQ);
    const weightedScore = directContains ? Math.max(score, 0.99) : score;

    if (!best || weightedScore > best.score) {
      best = { score: weightedScore, answer: a };
    }
  }

  return best && best.score >= 0.34 ? best.answer : null;
}

function getCachedReply(cacheKey) {
  const cached = RESPONSE_CACHE.get(cacheKey);
  if (!cached) return null;
  if ((Date.now() - cached.createdAt) > CACHE_TTL_MS) {
    RESPONSE_CACHE.delete(cacheKey);
    return null;
  }
  return cached.reply;
}

function setCachedReply(cacheKey, reply) {
  RESPONSE_CACHE.set(cacheKey, { reply, createdAt: Date.now() });
}

function systemPrompt(knowledge) {
  const safe = knowledge?.safety?.scope || 'You are a simple site guide.';
  const brand = knowledge?.brand?.name ? `${knowledge.brand.name}` : 'This site';
  const location = knowledge?.brand?.location ? `Location: ${knowledge.brand.location}\n` : '';
  const services = Array.isArray(knowledge?.services) ? knowledge.services.map(s => `- ${s}`).join('\n') : '';
  const email = knowledge?.contact?.email ? knowledge.contact.email : '';
  const nextStep = knowledge?.contact?.best_next_step ? knowledge.contact.best_next_step : '';
  const tone = knowledge?.assistant_prefs?.tone || 'professional';
  const pricingStyle = knowledge?.assistant_prefs?.pricing_style || 'quote_only';
  const primaryCta = knowledge?.assistant_prefs?.primary_cta || 'both_equal';

  return [
    `You are a helpful, concise chatbot embedded on ${brand}'s website.`,
    safe,
    'Rules:',
    `- Tone must be ${tone}, confident, and concise.`,
    '- Answer only questions related to this website/business (services, process, pricing/timelines at a high level, and contact info).',
    pricingStyle === 'quote_only'
      ? '- Never provide fixed or estimated price numbers. Explain that pricing is custom and invite the user to request a quote.'
      : '- If asked for exact pricing or anything not specified, ask 1-2 clarifying questions and suggest contacting via the site.',
    primaryCta === 'both_equal'
      ? '- When suggesting next steps, offer both the website Contact form and email equally.'
      : '- Keep calls-to-action aligned with the configured primary contact method.',
    '- If asked for anything unrelated, say you can only help with WebNest Studio and suggest what you can answer.',
    '- Never claim you performed actions (calls, emails, bookings).',
    '- Keep replies short (2-6 sentences). Use bullet points only when it improves clarity.',
    '',
    location ? location.trimEnd() : '',
    services ? `Services:\n${services}` : '',
    email ? `Contact email: ${email}` : '',
    nextStep ? `Preferred next step: ${nextStep}` : '',
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
  const normalizedMessage = normalizeText(message);
  const cacheKey = crypto.createHash('sha256').update(normalizedMessage).digest('hex').slice(0, 24);

  const faqReply = maybeFaqAnswer(knowledge, message);
  if (faqReply) return json(res, 200, { reply: faqReply, source: 'faq' });

  const cachedReply = getCachedReply(cacheKey);
  if (cachedReply) return json(res, 200, { reply: cachedReply, source: 'cache' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(res, 503, {
      error: 'Chatbot AI is temporarily unavailable right now. Please use the contact form or email webneststudiobkdn@gmail.com for help.',
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
            content: [{ type: 'input_text', text: sys }],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: message }],
          },
        ],
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const rawMsg = String(data?.error?.message || '').toLowerCase();
      const rawCode = String(data?.error?.code || '').toLowerCase();
      const isQuotaError =
        rawCode.includes('insufficient_quota') ||
        rawMsg.includes('exceeded your current quota') ||
        rawMsg.includes('insufficient_quota') ||
        rawMsg.includes('billing');

      if (isQuotaError) {
        return json(res, 503, {
          error: 'Our chatbot is temporarily unavailable due to API quota limits. Please try again later.',
        });
      }

      const err = data?.error?.message || 'Upstream model error';
      return json(res, 502, { error: err });
    }

    const reply = (data && typeof data.output_text === 'string' && data.output_text.trim())
      ? data.output_text.trim()
      : '';

    if (reply) setCachedReply(cacheKey, reply);
    return json(res, 200, { reply: reply || "Sorry — I couldn't generate a response right now.", source: 'llm' });
  } catch {
    return json(res, 502, { error: 'Chat service is temporarily unavailable.' });
  }
};

