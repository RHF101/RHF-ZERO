// ============================================================
// RHF ZERO — api/chat.js
// 10 AI Orchestrator + Rete-Rete Double Check + Memory
// ============================================================

import { Groq } from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { saveMessage, createChatRoom } from './memory.js';

// ============================================================
// INISIALISASI 10 AI CLIENTS
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

const nvidia = new OpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY,
});

// ============================================================
// HELPER
// ============================================================

function extractCode(text) {
  if (!text) return '';
  const match = text.match(/```[\w]*\n([\s\S]*?)```/);
  if (match) return match[1].trim();
  const match2 = text.match(/```([\s\S]*?)```/);
  if (match2) return match2[1].trim();
  return text.trim();
}

function validateCode(code) {
  const issues = [];
  const openCurly = (code.match(/\{/g) || []).length;
  const closeCurly = (code.match(/\}/g) || []).length;
  if (openCurly !== closeCurly) issues.push(`Bracket {} tidak seimbang: ${openCurly} vs ${closeCurly}`);
  const openParen = (code.match(/\(/g) || []).length;
  const closeParen = (code.match(/\)/g) || []).length;
  if (openParen !== closeParen) issues.push(`Kurung () tidak seimbang: ${openParen} vs ${closeParen}`);
  const openBracket = (code.match(/\[/g) || []).length;
  const closeBracket = (code.match(/\]/g) || []).length;
  if (openBracket !== closeBracket) issues.push(`Bracket [] tidak seimbang: ${openBracket} vs ${closeBracket}`);
  return { valid: issues.length === 0, issues };
}

// ============================================================
// DETEKTOR
// ============================================================

function detectIntent(message) {
  const codeKeywords = [
    'buat', 'buatkan', 'bikinin', 'bikin', 'tulis', 'tuliskan',
    'kode', 'code', 'coding', 'program', 'aplikasi', 'fungsi',
    'function', 'class', 'script', 'implementasi', 'debug',
    'fix', 'perbaiki', 'error', 'generate', 'buatin',
    '.js', '.py', '.ts', '.html', '.css', '.java', '.go', '.rs',
    'server', 'api', 'route', 'endpoint', 'backend', 'frontend',
    'database', 'query', 'react', 'vue', 'angular', 'node', 'express',
    'sorting', 'filter', 'loop', 'array', 'object', 'komponen',
    'fullstack', 'rest api', 'json', 'xml', 'sql', 'nosql',
  ];
  const lowerMessage = message.toLowerCase();
  const matchCount = codeKeywords.filter(kw => lowerMessage.includes(kw)).length;
  if (lowerMessage.includes('mode serius') || lowerMessage.includes('coding mode') || lowerMessage.includes('```')) return 'serius';
  if (lowerMessage.includes('mode santai')) return 'santai';
  return matchCount >= 2 ? 'serius' : 'santai';
}

// ============================================================
// MAIN HANDLER
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const startTime = Date.now();
  const { message, uid, chatId } = req.body;

  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
  if (message.length > 20000) return res.status(400).json({ error: 'Pesan terlalu panjang (maks 20.000 karakter)' });

  const intent = detectIntent(message);
  const currentChatId = chatId || 'chat_' + Date.now();

  if (uid) saveMessage(uid, currentChatId, 'user', message, intent).catch(() => {});

  try {
    let result;
    if (intent === 'santai') {
      result = await handleSantai(message);
    } else {
      result = await handleSerius(message, startTime);
    }
    if (uid) saveMessage(uid, currentChatId, 'ai', result.response, intent, result.metadata || null).catch(() => {});
    return res.json({ ...result, chatId: currentChatId });
  } catch (error) {
    console.error('Handler error:', error.message);
    return res.status(500).json({ mode: 'error', response: 'Maaf, terjadi kesalahan internal.', error: error.message, chatId: currentChatId });
  }
}

// ============================================================
// MODE SANTAI
// ============================================================

async function handleSantai(message) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Kamu adalah RHF ZERO, asisten yang ramah. Jawab SINGKAT, natural, 1-3 kalimat max. Jangan panjang. Jangan sebutkan kamu AI atau gabungan.' },
        { role: 'user', content: message },
      ],
      max_tokens: 200,
      temperature: 0.8,
    });
    const response = completion.choices[0]?.message?.content || 'Halo! Ada yang bisa aku bantu?';
    return { mode: 'santai', response, provider: 'Groq' };
  } catch (error) {
    return { mode: 'santai', response: 'Halo! Ada yang bisa aku bantu?', provider: 'fallback' };
  }
}

// ============================================================
// MODE SERIUS — 6 AI + GEMINI L1 + RETE-RETE L2
// ============================================================

async function handleSerius(message, startTime) {
  const results = { generate: [], review: [], l2review: [], errors: [] };

  // ---------- FASE 1: GENERATE PARALEL (6 AI) ----------
  const generatePrompt = `Kamu adalah coding expert.\n\nTUGAS: Tulis kode lengkap untuk:\n"${message}"\n\nATURAN:\n1. Output KODE SAJA dalam markdown code block.\n2. Kode HARUS LENGKAP, tidak boleh kepotong.\n3. Format RAPI: indentasi 2 spasi.\n4. Jangan jelaskan, langsung tulis kode.\n5. Maksimal 500 baris.\n6. Pastikan semua bracket, kurung, dan tag TERTUTUP.\n\nTULIS KODE SEKARANG:`;

  const generateTasks = [
    { name: 'Groq', fn: () => groq.chat.completions.create({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: generatePrompt }], max_tokens: 4096, temperature: 0.3 }) },
    { name: 'Together', fn: () => together.chat.completions.create({ model: 'mistralai/Mixtral-8x22B-Instruct-v0.1', messages: [{ role: 'user', content: generatePrompt }], max_tokens: 4096, temperature: 0.3 }) },
    { name: 'Fireworks', fn: () => fireworks.chat.completions.create({ model: 'accounts/fireworks/models/llama-v3p3-70b-instruct', messages: [{ role: 'user', content: generatePrompt }], max_tokens: 4096, temperature: 0.3 }) },
    { name: 'Cerebras', fn: () => cerebras.chat.completions.create({ model: 'llama3.3-70b', messages: [{ role: 'user', content: generatePrompt }], max_tokens: 4096, temperature: 0.3 }) },
    { name: 'Mistral', fn: () => mistralClient.chat.completions.create({ model: 'mistral-large-latest', messages: [{ role: 'user', content: generatePrompt }], max_tokens: 4096, temperature: 0.3 }) },
    { name: 'DeepInfra', fn: () => deepinfra.chat.completions.create({ model: 'meta-llama/Llama-3.3-70B-Instruct', messages: [{ role: 'user', content: generatePrompt }], max_tokens: 4096, temperature: 0.3 }) },
  ];

  const generateResults = await Promise.allSettled(generateTasks.map(t => t.fn()));
  generateResults.forEach((result, i) => {
    const name = generateTasks[i].name;
    if (result.status === 'fulfilled') {
      const content = result.value.choices[0]?.message?.content || '';
      const code = extractCode(content);
      const validation = validateCode(code);
      results.generate.push({ provider: name, code, validation, success: true });
    } else {
      results.errors.push(name + ': ' + (result.reason?.message || 'gagal'));
      results.generate.push({ provider: name, code: null, validation: null, success: false });
    }
  });

  // ---------- FASE 2: REVIEW GEMINI (LAPIS 1) ----------
  const successfulCodes = results.generate.filter(g => g.success && g.code);
  let bestCode = '';

  if (successfulCodes.length > 0) {
    const validCodes = successfulCodes.filter(g => g.validation?.valid);
    const candidates = validCodes.length > 0 ? validCodes : successfulCodes;
    bestCode = candidates.sort((a, b) => b.code.length - a.code.length)[0].code;

    try {
      const reviewResult = await geminiModel.generateContent(
        `Kamu adalah CODE REVIEWER.\n\nREVIEW kode berikut untuk:\n1. Typo atau syntax error\n2. Logic error atau bug\n3. Kode yang kepotong atau tidak lengkap\n4. Format dan indentasi\n\nPERBAIKI kode jika ada masalah. Outputkan KODE FINAL yang sudah sempurna dalam markdown code block.\n\nKODE:\n${bestCode}`
      );
      const reviewText = reviewResult.response.text();
      const reviewedCode = extractCode(reviewText) || bestCode;
      const validationAfter = validateCode(reviewedCode);
      results.review.push({ provider: 'Gemini L1', originalLength: bestCode.length, reviewedLength: reviewedCode.length, validation: validationAfter });
      bestCode = reviewedCode;
    } catch (e) {
      results.errors.push('Gemini L1: ' + e.message);
    }
  } else {
    bestCode = '// Semua AI gagal generate kode.\n// Error: ' + results.errors.join('; ');
  }

  // ---------- FASE 3: RETE-RETE LAPIS 2 (3 AI verifikasi) ----------
  if (bestCode && results.errors.length === 0) {
    const l2Reviewers = [
      {
        name: 'DeepSeek',
        fn: () => openrouter.chat.completions.create({
          model: 'deepseek/deepseek-chat',
          messages: [
            { role: 'system', content: 'Kamu verifier kode. Cek konsistensi, typo, logic, dan false alarm dari review sebelumnya. Output JSON: {"verified": true/false, "falseAlarms": [], "newIssues": [], "summary": ""}' },
            { role: 'user', content: 'Kode:\n' + bestCode.substring(0, 6000) + '\n\nTemuan Lapis 1:\n' + JSON.stringify(results.review) },
          ],
          max_tokens: 2048, temperature: 0.1,
        }),
      },
      {
        name: 'Gemini L2',
        fn: () => geminiModel.generateContent(
          'Kamu verifier kode (Lapis 2). Cek false alarm dan konsistensi. Kode:\n' + bestCode.substring(0, 5000) + '\n\nReview L1:\n' + JSON.stringify(results.review) + '\n\nOutput JSON: {"verified": true/false, "falseAlarms": [], "newIssues": [], "summary": ""}'
        ),
      },
      {
        name: 'Mistral L2',
        fn: () => mistralClient.chat.completions.create({
          model: 'mistral-large-latest',
          messages: [
            { role: 'system', content: 'Kamu security reviewer. Cek keamanan, error handling, dan edge case. Output JSON: {"verified": true/false, "securityIssues": [], "summary": ""}' },
            { role: 'user', content: 'Kode:\n' + bestCode.substring(0, 5000) },
          ],
          max_tokens: 2048, temperature: 0.1,
        }),
      },
    ];

    const l2Results = await Promise.allSettled(l2Reviewers.map(r => r.fn()));
    l2Results.forEach((r, i) => {
      const name = l2Reviewers[i].name;
      if (r.status === 'fulfilled') {
        try {
          let text = '';
          if (r.value.choices) {
            text = r.value.choices[0]?.message?.content || '';
          } else if (r.value.response) {
            text = r.value.response.text();
          }
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { verified: true };
          results.l2review.push({ provider: name, ...parsed });
        } catch (e) {
          results.l2review.push({ provider: name, verified: true, error: 'Parse error' });
        }
      } else {
        results.errors.push(name + ': ' + (r.reason?.message || 'gagal'));
      }
    });
  }

  // ---------- FINAL OUTPUT ----------
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const providersUsed = results.generate.filter(g => g.success).length;
  const l2Count = results.l2review.length;
  const finalValidation = validateCode(bestCode);

  const response = bestCode.length > 3000
    ? bestCode.substring(0, 3000) + '\n\n// ... (kode dilanjutkan, total ' + bestCode.length + ' karakter)'
    : bestCode;

  return {
    mode: 'serius',
    response: response,
    metadata: {
      panjangCode: bestCode.length,
      providersDigunakan: providersUsed + ' dari 6',
      direviewOleh: 'Gemini L1' + (l2Count > 0 ? ' + ' + l2Count + ' AI (Rete-Rete L2)' : ''),
      validasiStruktur: finalValidation.valid ? '✅ Valid' : '⚠️ ' + finalValidation.issues.join('; '),
      errors: results.errors.length > 0 ? results.errors : null,
      waktuProses: elapsed + ' detik',
    },
  };
  }
