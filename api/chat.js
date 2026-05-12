// ============================================================
// RHF ZERO — api/chat.js
// 10 AI Survival Mode — Cek Mati/Hidup, Retry, Skip, Teknik Muter
// ============================================================

import { Groq } from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { saveMessage } from './memory.js';

// ============================================================
// 10 AI CLIENTS
// ============================================================

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const geminiAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = geminiAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

const together = new OpenAI({
  baseURL: 'https://api.together.xyz/v1',
  apiKey: process.env.TOGETHER_API_KEY,
});

const fireworks = new OpenAI({
  baseURL: 'https://api.fireworks.ai/inference/v1',
  apiKey: process.env.FIREWORKS_API_KEY,
});

const sambanova = new OpenAI({
  baseURL: 'https://api.sambanova.ai/v1',
  apiKey: process.env.SAMBANOVA_API_KEY,
});

const cerebras = new OpenAI({
  baseURL: 'https://api.cerebras.ai/v1',
  apiKey: process.env.CEREBRAS_API_KEY,
});

const nvidia = new OpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY,
});

const cfglabs = new OpenAI({
  baseURL: 'https://api.cfg.cfglabs.com/v1',
  apiKey: process.env.CFG_LABS_KEY || '',
});

// ============================================================
// HELPER
// ============================================================

function extractCode(text) {
  if (!text) return '';
  const match = text.match(/```[\w]*\n([\s\S]*?)```/);
  if (match) return match[1].trim();
  return text.trim();
}

function detectIntent(message) {
  const keywords = ['buat', 'buatkan', 'bikinin', 'tulis', 'kode', 'code', 'coding', 'fungsi', 'function', 'class', 'script', 'debug', 'fix', 'perbaiki', 'generate', '.js', '.py', '.ts', '.html', '.css', 'server', 'api', 'route', 'endpoint', 'database', 'react', 'vue', 'node', 'express', 'sorting', 'loop', 'array'];
  const m = message.toLowerCase();
  if (m.includes('mode serius') || m.includes('```')) return 'serius';
  if (m.includes('mode santai')) return 'santai';
  return keywords.filter(k => m.includes(k)).length >= 2 ? 'serius' : 'santai';
}

// ============================================================
// RETRY WRAPPER — Coba 3x dengan delay
// ============================================================

async function withRetry(fn, retries = 3, delayMs = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fn();
      if (res) return res;
    } catch (e) {}
    if (i < retries - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return null;
}

// ============================================================
// CEK SATU AI — Hidup atau Mati
// ============================================================

async function checkOneAI(name, fn) {
  try {
    const res = await fn();
    if (!res) return { name, alive: false, reason: 'null response' };
    
    const content = res.choices?.[0]?.message?.content || res.response?.text?.() || '';
    if (!content || content.length < 1) return { name, alive: false, reason: 'empty response' };
    
    return { name, alive: true };
  } catch (e) {
    return { name, alive: false, reason: e.message.substring(0, 80) };
  }
}

// ============================================================
// CEK SEMUA AI — CEPAT (5 detik timeout per AI)
// ============================================================

async function checkAllAIs() {
  const testPrompt = 'Say OK';
  const tests = [
    { name: 'Groq', fn: () => withRetry(() => groq.chat.completions.create({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: testPrompt }], max_tokens: 5 }), 2, 1000) },
    { name: 'Gemini', fn: () => withRetry(() => geminiModel.generateContent(testPrompt), 2, 1000) },
    { name: 'OpenRouter', fn: () => withRetry(() => openrouter.chat.completions.create({ model: 'deepseek/deepseek-chat', messages: [{ role: 'user', content: testPrompt }], max_tokens: 5 }), 2, 1000) },
    { name: 'Together', fn: () => withRetry(() => together.chat.completions.create({ model: 'mistralai/Mixtral-8x22B-Instruct-v0.1', messages: [{ role: 'user', content: testPrompt }], max_tokens: 5 }), 2, 1000) },
    { name: 'Fireworks', fn: () => withRetry(() => fireworks.chat.completions.create({ model: 'accounts/fireworks/models/llama-v3p3-70b-instruct', messages: [{ role: 'user', content: testPrompt }], max_tokens: 5 }), 2, 1000) },
    { name: 'SambaNova', fn: () => withRetry(() => sambanova.chat.completions.create({ model: 'Meta-Llama-3.1-405B-Instruct', messages: [{ role: 'user', content: testPrompt }], max_tokens: 5 }), 2, 1000) },
    { name: 'Cerebras', fn: () => withRetry(() => cerebras.chat.completions.create({ model: 'llama3.3-70b', messages: [{ role: 'user', content: testPrompt }], max_tokens: 5 }), 2, 1000) },
    { name: 'NVIDIA', fn: () => withRetry(() => nvidia.chat.completions.create({ model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5', messages: [{ role: 'user', content: testPrompt }], max_tokens: 5 }), 2, 1000) },
    { name: 'CFG-Labs', fn: () => withRetry(() => cfglabs.chat.completions.create({ model: 'default', messages: [{ role: 'user', content: testPrompt }], max_tokens: 5 }), 2, 1000) },
  ];

  const results = await Promise.allSettled(tests.map(t => checkOneAI(t.name, t.fn)));
  
  const alive = [];
  const dead = [];
  
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value.alive) {
      alive.push(r.value.name);
    } else {
      const info = r.status === 'fulfilled' ? r.value : { name: 'unknown', reason: 'crash' };
      dead.push(info.name + ': ' + (info.reason || 'timeout'));
    }
  });

  return { alive, dead };
}

// ============================================================
// MAIN HANDLER
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const startTime = Date.now();
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
      result = await modeSerius(message, startTime);
    }
    if (uid) saveMessage(uid, currentChatId, 'ai', result.response, intent, result.metadata || null).catch(() => {});
    return res.json({ ...result, chatId: currentChatId });
  } catch (error) {
    return res.status(500).json({ mode: 'error', response: 'Maaf, error internal.', chatId: currentChatId });
  }
}

// ============================================================
// MODE SANTAI
// ============================================================

async function modeSantai(message) {
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
  } catch (e) {
    return { mode: 'santai', response: 'Halo! Ada yang bisa aku bantu?' };
  }
}

// ============================================================
// MODE SERIUS — SURVIVAL MODE
// ============================================================

async function modeSerius(message, startTime) {
  const errors = [];
  let bestCode = '';
  let providersUsed = 0;

  // ---- FASE 0: CEK AI ----
  const { alive, dead } = await checkAllAIs();
  dead.forEach(d => errors.push('MATI: ' + d));

  if (alive.length === 0) {
    return {
      mode: 'serius',
      response: '⚠️ Semua AI sedang mati atau kena limit. Coba lagi nanti.',
      metadata: { aiHidup: 0, aiMati: dead.length, daftarMati: dead, waktuProses: ((Date.now() - startTime) / 1000).toFixed(1) + ' detik' }
    };
  }

  // ---- FASE 1: GENERATE (hanya AI hidup, retry 3x) ----
  const prompt = `Kamu coding expert. Tulis kode lengkap untuk: "${message}". Output KODE SAJA dalam markdown code block. Format RAPI. Kode HARUS LENGKAP.`;

  const generatorMap = {
    'Groq': () => groq.chat.completions.create({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: 8192, temperature: 0.3 }),
    'OpenRouter': () => openrouter.chat.completions.create({ model: 'mistralai/mistral-large', messages: [{ role: 'user', content: prompt }], max_tokens: 8192, temperature: 0.3 }),
    'Together': () => together.chat.completions.create({ model: 'mistralai/Mixtral-8x22B-Instruct-v0.1', messages: [{ role: 'user', content: prompt }], max_tokens: 8192, temperature: 0.3 }),
    'Fireworks': () => fireworks.chat.completions.create({ model: 'accounts/fireworks/models/llama-v3p3-70b-instruct', messages: [{ role: 'user', content: prompt }], max_tokens: 8192, temperature: 0.3 }),
    'SambaNova': () => sambanova.chat.completions.create({ model: 'Meta-Llama-3.1-405B-Instruct', messages: [{ role: 'user', content: prompt }], max_tokens: 8192, temperature: 0.3 }),
    'Cerebras': () => cerebras.chat.completions.create({ model: 'llama3.3-70b', messages: [{ role: 'user', content: prompt }], max_tokens: 8192, temperature: 0.3 }),
    'NVIDIA': () => nvidia.chat.completions.create({ model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5', messages: [{ role: 'user', content: prompt }], max_tokens: 8192, temperature: 0.3 }),
    'CFG-Labs': () => cfglabs.chat.completions.create({ model: 'default', messages: [{ role: 'user', content: prompt }], max_tokens: 8192, temperature: 0.3 }),
  };

  const generatedCodes = [];

  for (const name of alive) {
    const fn = generatorMap[name];
    if (!fn) continue;

    const res = await withRetry(async () => {
      const r = await fn();
      const code = extractCode(r.choices[0]?.message?.content || '');
      if (code && code.length > 20) return code;
      return null;
    }, 3, 1500);

    if (res) {
      generatedCodes.push({ provider: name, code: res });
      providersUsed++;
    } else {
      errors.push(name + ': gagal setelah 3x retry');
    }
  }

  if (generatedCodes.length === 0) {
    return {
      mode: 'serius',
      response: '⚠️ Semua AI hidup tapi gagal generate. Coba lagi.',
      metadata: { aiHidup: alive.length, aiMati: dead.length, errors, waktuProses: ((Date.now() - startTime) / 1000).toFixed(1) + ' detik' }
    };
  }

  // Pilih kode terbaik
  bestCode = generatedCodes.sort((a, b) => b.code.length - a.code.length)[0].code;

  // ---- FASE 2: REVIEW (Gemini, kalau hidup) ----
  if (alive.includes('Gemini')) {
    const reviewed = await withRetry(async () => {
      const r = await geminiModel.generateContent(`REVIEW kode. Cari typo, bug, format error. PERBAIKI. Output KODE FINAL.\n\nKODE:\n${bestCode}`);
      return extractCode(r.response.text());
    }, 2, 1000);

    if (reviewed && reviewed.length > 20) {
      bestCode = reviewed;
    } else {
      errors.push('Gemini review gagal');
    }
  }

  // ---- FASE 3: VERIFIKASI (OpenRouter DeepSeek, kalau hidup) ----
  if (alive.includes('OpenRouter')) {
    const verified = await withRetry(async () => {
      const r = await openrouter.chat.completions.create({
        model: 'deepseek/deepseek-chat',
        messages: [
          { role: 'system', content: 'Verifikasi kode. Cek typo, logic, kelengkapan. Perbaiki. Output KODE FINAL.' },
          { role: 'user', content: bestCode.substring(0, 12000) }
        ],
        max_tokens: 8192, temperature: 0.1
      });
      return extractCode(r.choices[0]?.message?.content || '');
    }, 2, 1000);

    if (verified && verified.length > 20) {
      bestCode = verified;
    } else {
      errors.push('Verifikasi gagal');
    }
  }

  // ---- FINAL ----
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  return {
    mode: 'serius',
    response: bestCode,
    metadata: {
      panjangCode: bestCode.length,
      aiHidup: alive.length,
      aiMati: dead.length,
      daftarAIHidup: alive,
      daftarAIMati: dead,
      providersDigunakan: providersUsed + ' AI generate',
      errors: errors.length > 0 ? errors : null,
      waktuProses: elapsed + ' detik',
    },
  };
}
