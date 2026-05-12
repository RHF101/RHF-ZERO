import { Groq } from 'groq-sdk';
import { saveMessage } from './memory.js';

// ============================================================
// LAZY INIT — AI hanya dibuat saat dipakai
// ============================================================

function getGroq() {
  try { return new Groq({ apiKey: process.env.GROQ_API_KEY }); } catch(e) { return null; }
}

async function getGeminiModel() {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    return ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
  } catch(e) { return null; }
}

function getOpenAI(baseURL, apiKey) {
  try {
    const { default: OpenAI } = await import('openai');
    return new OpenAI({ baseURL, apiKey });
  } catch(e) { return null; }
}

// ============================================================
// DETEKTOR
// ============================================================

function detectIntent(message) {
  const keywords = ['buat', 'buatkan', 'tulis', 'kode', 'code', 'coding', 'fungsi', 'function', 'class', 'script', 'debug', 'fix', 'perbaiki', 'generate', '.js', '.py', '.html', '.css', 'server', 'api', 'database', 'react', 'vue', 'node', 'express'];
  const m = message.toLowerCase();
  if (m.includes('mode serius') || m.includes('```')) return 'serius';
  if (m.includes('mode santai')) return 'santai';
  return keywords.filter(k => m.includes(k)).length >= 2 ? 'serius' : 'santai';
}

// ============================================================
// MAIN HANDLER
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, uid, chatId } = req.body;
  if (!message) return res.status(400).json({ error: 'Pesan kosong' });

  const intent = detectIntent(message);
  const currentChatId = chatId || 'chat_' + Date.now();
  if (uid) saveMessage(uid, currentChatId, 'user', message, intent).catch(() => {});

  try {
    let result;
    if (intent === 'santai') {
      result = await modeSantai(message);
    } else {
      result = await modeSerius(message);
    }
    if (uid) saveMessage(uid, currentChatId, 'ai', result.response, intent, {}).catch(() => {});
    return res.json({ ...result, chatId: currentChatId });
  } catch (error) {
    return res.json({ mode: 'error', response: 'Maaf, error: ' + error.message, chatId: currentChatId });
  }
}

// ============================================================
// MODE SANTAI
// ============================================================

async function modeSantai(message) {
  const groq = getGroq();
  if (!groq) return { mode: 'santai', response: 'Halo! Ada yang bisa aku bantu?' };

  try {
    const res = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Kamu RHF ZERO. Jawab SINGKAT, 1-3 kalimat, natural.' },
        { role: 'user', content: message }
      ],
      max_tokens: 200, temperature: 0.8
    });
    return { mode: 'santai', response: res.choices[0].message.content };
  } catch(e) {
    return { mode: 'santai', response: 'Halo! Ada yang bisa aku bantu?' };
  }
}

// ============================================================
// MODE SERIUS — Lazy load AI, skip yang mati
// ============================================================

async function modeSerius(message) {
  const errors = [];
  let bestCode = '';

  const prompt = `Kamu coding expert. Tulis kode lengkap untuk: "${message}". Output KODE SAJA dalam markdown code block. Format RAPI. Kode HARUS LENGKAP.`;

  // Coba Groq dulu
  const groq = getGroq();
  if (groq) {
    try {
      const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8192, temperature: 0.3
      });
      const code = extractCode(res.choices[0]?.message?.content || '');
      if (code && code.length > 20) bestCode = code;
    } catch(e) { errors.push('Groq: ' + e.message); }
  }

  // Coba Gemini
  const gemini = await getGeminiModel();
  if (gemini && !bestCode) {
    try {
      const res = await gemini.generateContent(prompt);
      const code = extractCode(res.response.text());
      if (code && code.length > 20) bestCode = code;
    } catch(e) { errors.push('Gemini: ' + e.message); }
  }

  if (!bestCode || bestCode.length < 20) {
    return { mode: 'serius', response: 'Maaf, semua AI gagal generate. Coba lagi.', metadata: { errors } };
  }

  // Review dengan Gemini (kalau bisa)
  if (gemini) {
    try {
      const rev = await gemini.generateContent(`REVIEW kode. Cari typo, bug. PERBAIKI. Output KODE FINAL.\n\nKODE:\n${bestCode}`);
      const fixed = extractCode(rev.response.text());
      if (fixed && fixed.length > 20) bestCode = fixed;
    } catch(e) { errors.push('Review: ' + e.message); }
  }

  return {
    mode: 'serius',
    response: bestCode,
    metadata: {
      panjangCode: bestCode.length,
      errors: errors.length > 0 ? errors : null,
    }
  };
}

function extractCode(text) {
  if (!text) return '';
  const match = text.match(/```[\w]*\n([\s\S]*?)```/);
  if (match) return match[1].trim();
  return text.trim();
        }
