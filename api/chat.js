// ============================================================
// RHF ZERO — api/chat.js
// 10 AI Orchestrator + Rete-Rete + Memory
// Mode Santai + Serius (Batch: Generate → Review → Verifikasi)
// ============================================================

import { Groq } from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { saveMessage } from './memory.js';

// ============================================================
// INISIALISASI CLIENTS
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

const deepinfra = new OpenAI({
  baseURL: 'https://api.deepinfra.com/v1/openai',
  apiKey: process.env.DEEPINFRA_API_KEY,
});

const cerebras = new OpenAI({
  baseURL: 'https://api.cerebras.ai/v1',
  apiKey: process.env.CEREBRAS_API_KEY,
});

const mistralClient = new OpenAI({
  baseURL: 'https://api.mistral.ai/v1',
  apiKey: process.env.MISTRAL_API_KEY,
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

// ============================================================
// DETEKTOR
// ============================================================

function detectIntent(message) {
  const keywords = ['buat', 'buatkan', 'bikinin', 'tulis', 'kode', 'code', 'coding', 'fungsi', 'function', 'class', 'script', 'debug', 'fix', 'perbaiki', 'generate', '.js', '.py', '.ts', '.html', '.css', 'server', 'api', 'route', 'endpoint', 'backend', 'frontend', 'database', 'react', 'vue', 'node', 'express', 'sorting', 'loop', 'array'];
  const m = message.toLowerCase();
  const count = keywords.filter(k => m.includes(k)).length;
  if (m.includes('mode serius') || m.includes('```')) return 'serius';
  if (m.includes('mode santai')) return 'santai';
  return count >= 2 ? 'serius' : 'santai';
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
// MODE SERIUS — BATCH SYSTEM
// ============================================================

async function modeSerius(message, startTime) {
  const errors = [];
  let bestCode = '';
  let providersUsed = 0;

  const prompt = `Kamu coding expert. Tulis kode lengkap untuk: "${message}". Output KODE SAJA dalam markdown code block. Format RAPI, indentasi 2 spasi. Kode HARUS LENGKAP.`;

  // ============================================================
  // BATCH 1: GENERATE — satu per satu, tidak paralel
  // ============================================================
  const generators = [
    { name: 'Groq', fn: () => groq.chat.completions.create({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: 4096, temperature: 0.3 }) },
    { name: 'Mistral', fn: () => mistralClient.chat.completions.create({ model: 'mistral-large-latest', messages: [{ role: 'user', content: prompt }], max_tokens: 4096, temperature: 0.3 }) },
    { name: 'Cerebras', fn: () => cerebras.chat.completions.create({ model: 'llama3.3-70b', messages: [{ role: 'user', content: prompt }], max_tokens: 4096, temperature: 0.3 }) },
    { name: 'Together', fn: () => together.chat.completions.create({ model: 'mistralai/Mixtral-8x22B-Instruct-v0.1', messages: [{ role: 'user', content: prompt }], max_tokens: 4096, temperature: 0.3 }) },
    { name: 'Fireworks', fn: () => fireworks.chat.completions.create({ model: 'accounts/fireworks/models/llama-v3p3-70b-instruct', messages: [{ role: 'user', content: prompt }], max_tokens: 4096, temperature: 0.3 }) },
    { name: 'DeepInfra', fn: () => deepinfra.chat.completions.create({ model: 'meta-llama/Llama-3.3-70B-Instruct', messages: [{ role: 'user', content: prompt }], max_tokens: 4096, temperature: 0.3 }) },
  ];

  const generatedCodes = [];

  for (const gen of generators) {
    try {
      const res = await gen.fn();
      const code = extractCode(res.choices[0]?.message?.content || '');
      if (code && code.length > 20) {
        generatedCodes.push({ provider: gen.name, code });
        providersUsed++;
      }
    } catch (e) {
      errors.push(gen.name + ': gagal');
    }
  }

  if (generatedCodes.length === 0) {
    return {
      mode: 'serius',
      response: 'Maaf, semua AI gagal generate kode.',
      metadata: { errors, providersDigunakan: '0', waktuProses: ((Date.now() - startTime) / 1000).toFixed(1) + ' detik' }
    };
  }

  // Pilih kode terbaik (paling panjang = paling lengkap)
  bestCode = generatedCodes.sort((a, b) => b.code.length - a.code.length)[0].code;

  // ============================================================
  // BATCH 2: REVIEW — Gemini periksa
  // ============================================================
  let reviewed = false;
  try {
    const reviewRes = await geminiModel.generateContent(
      `REVIEW kode berikut. Cari typo, bug, format error, kode kepotong. PERBAIKI. Output KODE FINAL dalam markdown code block.\n\nKODE:\n${bestCode}`
    );
    const reviewText = reviewRes.response.text();
    const fixed = extractCode(reviewText);
    if (fixed && fixed.length > 20) {
      bestCode = fixed;
      reviewed = true;
    }
  } catch (e) {
    errors.push('Review: ' + e.message);
  }

  // ============================================================
  // BATCH 3: VERIFIKASI — DeepSeek cek ulang
  // ============================================================
  let verified = false;
  try {
    const verifyRes = await openrouter.chat.completions.create({
      model: 'deepseek/deepseek-chat',
      messages: [
        { role: 'system', content: 'Cek kode ini untuk typo, logic error, dan kelengkapan. Kalau ada masalah, perbaiki. Output KODE FINAL dalam markdown code block.' },
        { role: 'user', content: bestCode.substring(0, 6000) }
      ],
      max_tokens: 4096, temperature: 0.1
    });
    const verifyText = verifyRes.choices[0]?.message?.content || '';
    const fixed = extractCode(verifyText);
    if (fixed && fixed.length > 20) {
      bestCode = fixed;
      verified = true;
    }
  } catch (e) {
    errors.push('Verifikasi: ' + e.message);
  }

  // ============================================================
  // FINAL
  // ============================================================
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const validation = validateCode(bestCode);

  const response = bestCode.length > 3500
    ? bestCode.substring(0, 3500) + '\n\n// ... (total ' + bestCode.length + ' karakter)'
    : bestCode;

  return {
    mode: 'serius',
    response,
    metadata: {
      panjangCode: bestCode.length,
      providersDigunakan: providersUsed + ' AI (Generate: ' + providersUsed + ', Review: ' + (reviewed ? '1' : '0') + ', Verifikasi: ' + (verified ? '1' : '0') + ')',
      validasiStruktur: validation.valid ? '✅ Valid' : '⚠️ ' + validation.issues.join('; '),
      errors: errors.length > 0 ? errors : null,
      waktuProses: elapsed + ' detik',
    },
  };
                                                            }
