// ============================================================
// RHF ZERO — api/chat.js
// 10 AI — Rete-Rete System (Potong → Generate → Review → Verifikasi → Rakit)
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
  apiKey: process.env.CFG_LABS_KEY || process.env.CFG_LABS_API_KEY || '',
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

function validateCode(code) {
  const issues = [];
  if ((code.match(/\{/g) || []).length !== (code.match(/\}/g) || []).length) issues.push('{} tidak seimbang');
  if ((code.match(/\(/g) || []).length !== (code.match(/\)/g) || []).length) issues.push('() tidak seimbang');
  return { valid: issues.length === 0, issues };
}

function detectIntent(message) {
  const keywords = ['buat', 'buatkan', 'bikinin', 'tulis', 'kode', 'code', 'coding', 'fungsi', 'function', 'class', 'script', 'debug', 'fix', 'perbaiki', 'generate', '.js', '.py', '.ts', '.html', '.css', 'server', 'api', 'route', 'endpoint', 'backend', 'frontend', 'database', 'react', 'vue', 'node', 'express', 'sorting', 'loop', 'array'];
  const m = message.toLowerCase();
  const count = keywords.filter(k => m.includes(k)).length;
  if (m.includes('mode serius') || m.includes('```')) return 'serius';
  if (m.includes('mode santai')) return 'santai';
  return count >= 2 ? 'serius' : 'santai';
}

// ============================================================
// SPLITTER: Potong kode per 400 baris
// ============================================================

function splitIntoChunks(code) {
  const lines = code.split('\n');
  const chunks = [];
  let i = 0;
  while (i < lines.length) {
    chunks.push(lines.slice(i, i + 400).join('\n'));
    i += 400;
  }
  return chunks;
}

function assembleChunks(chunks) {
  return chunks.join('\n');
}

// ============================================================
// CEK AI HIDUP/MATI — per command
// ============================================================

async function checkAIs() {
  const testPrompt = 'Jawab "OK" saja.';
  const tests = [
    { name: 'Groq', fn: () => groq.chat.completions.create({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: testPrompt }], max_tokens: 5 }) },
    { name: 'Gemini', fn: () => geminiModel.generateContent(testPrompt) },
    { name: 'OpenRouter', fn: () => openrouter.chat.completions.create({ model: 'deepseek/deepseek-chat', messages: [{ role: 'user', content: testPrompt }], max_tokens: 5 }) },
    { name: 'Together', fn: () => together.chat.completions.create({ model: 'mistralai/Mixtral-8x22B-Instruct-v0.1', messages: [{ role: 'user', content: testPrompt }], max_tokens: 5 }) },
    { name: 'Fireworks', fn: () => fireworks.chat.completions.create({ model: 'accounts/fireworks/models/llama-v3p3-70b-instruct', messages: [{ role: 'user', content: testPrompt }], max_tokens: 5 }) },
    { name: 'SambaNova', fn: () => sambanova.chat.completions.create({ model: 'Meta-Llama-3.1-405B-Instruct', messages: [{ role: 'user', content: testPrompt }], max_tokens: 5 }) },
    { name: 'Cerebras', fn: () => cerebras.chat.completions.create({ model: 'llama3.3-70b', messages: [{ role: 'user', content: testPrompt }], max_tokens: 5 }) },
    { name: 'NVIDIA', fn: () => nvidia.chat.completions.create({ model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5', messages: [{ role: 'user', content: testPrompt }], max_tokens: 5 }) },
    { name: 'CFG-Labs', fn: () => cfglabs.chat.completions.create({ model: 'default', messages: [{ role: 'user', content: testPrompt }], max_tokens: 5 }) },
  ];

  const results = await Promise.allSettled(tests.map(t => t.fn()));
  const alive = [];
  const dead = [];

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      alive.push(tests[i].name);
    } else {
      dead.push(tests[i].name + ': ' + (r.reason?.message || 'mati'));
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
  if (message.length > 20000) return res.status(400).json({ error: 'Terlalu panjang' });

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
    return res.status(500).json({ mode: 'error', response: 'Maaf, terjadi kesalahan.', chatId: currentChatId });
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
        { role: 'system', content: 'Kamu RHF ZERO, asisten ramah. Jawab SINGKAT, 1-3 kalimat max, natural.' },
        { role: 'user', content: message }
      ],
      max_tokens: 200,
      temperature: 0.8
    });
    return { mode: 'santai', response: res.choices[0].message.content, provider: 'Groq' };
  } catch (e) {
    return { mode: 'santai', response: 'Halo! Ada yang bisa aku bantu?', provider: 'fallback' };
  }
}

// ============================================================
// MODE SERIUS — RETE-RETE FULL SYSTEM
// ============================================================

async function modeSerius(message, startTime) {
  const errors = [];
  let finalCode = '';
  let providersUsed = 0;
  let reviewed = false;
  let verified = false;
  let assembled = false;

  // ---- FASE 0: CEK AI HIDUP/MATI ----
  const { alive, dead } = await checkAIs();
  dead.forEach(d => errors.push('MATI: ' + d));

  if (alive.length === 0) {
    return {
      mode: 'serius',
      response: 'Semua AI mati. Coba lagi nanti.',
      metadata: { errors, providersDigunakan: '0' }
    };
  }

  const prompt = `Kamu coding expert. Tulis kode lengkap untuk: "${message}". Output KODE SAJA dalam markdown code block. Format RAPI, indentasi 2 spasi. Kode HARUS LENGKAP.`;

  // ---- FASE 1: GENERATE (hanya AI yang hidup) ----
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
    try {
      const res = await fn();
      const code = extractCode(res.choices[0]?.message?.content || '');
      if (code && code.length > 20) {
        generatedCodes.push({ provider: name, code });
        providersUsed++;
      }
    } catch (e) {
      errors.push(name + ': error generate');
    }
  }

  if (generatedCodes.length === 0) {
    return {
      mode: 'serius',
      response: 'Semua AI gagal generate.',
      metadata: { errors, providersDigunakan: '0' }
    };
  }

  // Pilih kode terbaik
  let bestCode = generatedCodes.sort((a, b) => b.code.length - a.code.length)[0].code;

  // ---- FASE 2: POTONG JADI CHUNK 400 BARIS ----
  const chunks = splitIntoChunks(bestCode);

  // ---- FASE 3: REVIEW PER CHUNK (Gemini) ----
  const reviewedChunks = [];
  for (let i = 0; i < chunks.length; i++) {
    try {
      const reviewRes = await geminiModel.generateContent(
        `REVIEW potongan kode berikut. Cari typo, bug, format error. PERBAIKI jika ada. Output KODE SAJA.\n\nKODE:\n${chunks[i]}`
      );
      const fixed = extractCode(reviewRes.response.text());
      reviewedChunks.push(fixed || chunks[i]);
      reviewed = true;
    } catch (e) {
      reviewedChunks.push(chunks[i]);
      errors.push('Review chunk ' + (i + 1) + ': ' + e.message);
    }
  }
  bestCode = assembleChunks(reviewedChunks);

  // ---- FASE 4: VERIFIKASI (DeepSeek via OpenRouter) ----
  if (alive.includes('OpenRouter')) {
    try {
      const verifyRes = await openrouter.chat.completions.create({
        model: 'deepseek/deepseek-chat',
        messages: [
          { role: 'system', content: 'Verifikasi kode. Cek typo, logic, kelengkapan. Perbaiki. Output KODE FINAL.' },
          { role: 'user', content: bestCode.substring(0, 15000) }
        ],
        max_tokens: 8192, temperature: 0.1
      });
      const fixed = extractCode(verifyRes.choices[0]?.message?.content || '');
      if (fixed && fixed.length > 20) {
        bestCode = fixed;
        verified = true;
      }
    } catch (e) {
      errors.push('Verifikasi: ' + e.message);
    }
  }

  // ---- FASE 5: RAKIT ULANG + VALIDASI ----
  const finalValidation = validateCode(bestCode);
  if (!finalValidation.valid) {
    errors.push('Kode final masih ada issues: ' + finalValidation.issues.join('; '));
  }
  assembled = true;

  // ---- FINAL OUTPUT ----
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  return {
    mode: 'serius',
    response: bestCode,
    metadata: {
      panjangCode: bestCode.length,
      aiHidup: alive.length,
      aiMati: dead.length,
      daftarMati: dead,
      providersDigunakan: providersUsed + ' AI (Gen: ' + providersUsed + ', Rev: ' + (reviewed ? 'Yes' : 'No') + ', Ver: ' + (verified ? 'Yes' : 'No') + ', Rakit: Yes)',
      validasiStruktur: finalValidation.valid ? '✅ Valid' : '⚠️ ' + finalValidation.issues.join('; '),
      errors: errors.length > 0 ? errors : null,
      waktuProses: elapsed + ' detik',
    },
  };
}
