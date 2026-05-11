// ============================================================
// AI RAKSASA — api/chat.js
// 10 AI Orchestrator dengan Reti-Reti Double Check
// ============================================================

import { Groq } from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

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
// CLOUDFLARE FUNCTION
// ============================================================

async function callCloudflare(prompt) {
  try {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || 'skipped';
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3-8b-instruct`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CLOUDFLARE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
        }),
      }
    );
    const data = await res.json();
    if (data.success && data.result?.response) {
      return data.result.response;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ============================================================
// HELPER: Ekstrak kode dari respons AI
// ============================================================

function extractCode(text) {
  if (!text) return text;
  const match = text.match(/```[\w]*\n([\s\S]*?)```/);
  if (match) return match[1].trim();
  const match2 = text.match(/```([\s\S]*?)```/);
  if (match2) return match2[1].trim();
  return text.trim();
}

// ============================================================
// HELPER: Validasi kode sederhana
// ============================================================

function validateCode(code) {
  const issues = [];
  const openCurly = (code.match(/\{/g) || []).length;
  const closeCurly = (code.match(/\}/g) || []).length;
  if (openCurly !== closeCurly) {
    issues.push(`Bracket {} tidak seimbang: ${openCurly} vs ${closeCurly}`);
  }

  const openParen = (code.match(/\(/g) || []).length;
  const closeParen = (code.match(/\)/g) || []).length;
  if (openParen !== closeParen) {
    issues.push(`Kurung () tidak seimbang: ${openParen} vs ${closeParen}`);
  }

  const openBracket = (code.match(/\[/g) || []).length;
  const closeBracket = (code.match(/\]/g) || []).length;
  if (openBracket !== closeBracket) {
    issues.push(`Bracket [] tidak seimbang: ${openBracket} vs ${closeBracket}`);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

// ============================================================
// DETEKTOR INTENT (Santai vs Serius)
// ============================================================

function detectIntent(message) {
  const codeKeywords = [
    'buat', 'buatkan', 'bikinin', 'bikin', 'tulis', 'tuliskan',
    'kode', 'code', 'coding', 'program', 'aplikasi', 'fungsi',
    'function', 'class', 'script', 'implementasi', 'debug',
    'fix', 'perbaiki', 'error', 'buatkan fungsi', 'buatkan kode',
    'generate', 'buatin', '.js', '.py', '.ts', '.html', '.css',
    'server', 'api', 'route', 'endpoint', 'backend', 'frontend',
    'database', 'query', 'react', 'vue', 'angular', 'node', 'express',
    'sorting', 'filter', 'loop', 'array', 'object',
  ];

  const lowerMessage = message.toLowerCase();
  const matchCount = codeKeywords.filter(keyword =>
    lowerMessage.includes(keyword)
  ).length;

  if (
    lowerMessage.includes('mode serius') ||
    lowerMessage.includes('coding mode') ||
    lowerMessage.includes('```') ||
    matchCount >= 2
  ) {
    return 'serius';
  }

  if (lowerMessage.includes('mode santai')) {
    return 'santai';
  }

  return matchCount >= 2 ? 'serius' : 'santai';
}

// ============================================================
// MAIN HANDLER
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const { message, sessionId } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Pesan tidak boleh kosong' });
  }

  if (message.length > 20000) {
    return res.status(400).json({ error: 'Pesan terlalu panjang (maks 20.000 karakter)' });
  }

  const intent = detectIntent(message);
  console.log(`[${intent.toUpperCase()}] ${message.substring(0, 80)}`);

  try {
    if (intent === 'santai') {
      return await handleSantai(message, sessionId);
    } else {
      return await handleSerius(message, sessionId, startTime);
    }
  } catch (error) {
    console.error('Handler error:', error.message);
    return res.status(500).json({
      mode: 'error',
      response: 'Maaf, terjadi kesalahan internal.',
      error: error.message,
      sessionId: sessionId || '',
    });
  }
}

// ============================================================
// MODE SANTAI — Groq cepat, jawab singkat & natural
// ============================================================

async function handleSantai(message, sessionId) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'Kamu adalah teman ngobrol yang ramah. Jawab SINGKAT, natural, seperti manusia biasa. MAKSIMAL 2-3 kalimat. Jangan panjang-panjang. Jangan pakai format markdown atau list. Kalau ditanya kabar, jawab santai.',
        },
        { role: 'user', content: message },
      ],
      max_tokens: 200,
      temperature: 0.8,
    });

    const response = completion.choices[0]?.message?.content || 'Maaf, tidak ada respons.';

    return res.json({
      mode: 'santai',
      response: response,
      provider: 'Groq (Llama 3 70B)',
      sessionId: sessionId || '',
    });
  } catch (error) {
    console.error('Santai error:', error.message);
    return res.json({
      mode: 'santai',
      response: 'Halo! Ada yang bisa aku bantu?',
      provider: 'fallback',
      sessionId: sessionId || '',
    });
  }
}

// ============================================================
// MODE SERIUS — Full 10 AI Pipeline + Reti-Reti
// ============================================================

async function handleSerius(message, sessionId, startTime) {
  const results = {
    generate: [],
    review: [],
    final: null,
    errors: [],
  };

  // ---------- FASE 1: GENERATE PARALEL (6 AI) ----------
  const generatePrompt = `Kamu adalah AI coding expert.

TUGAS: Tulis kode lengkap untuk permintaan ini:
"${message}"

ATURAN:
1. Output KODE SAJA dalam markdown code block.
2. Kode HARUS LENGKAP, tidak boleh kepotong.
3. Format RAPI: indentasi 2 spasi.
4. Jangan jelaskan, langsung tulis kode.
5. Maksimal 500 baris.
6. Pastikan semua bracket, kurung, dan tag TERTUTUP.

TULIS KODE SEKARANG:`;

  const generateTasks = [
    { name: 'Groq', fn: () => groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: generatePrompt }],
      max_tokens: 4096, temperature: 0.3,
    })},
    { name: 'Together', fn: () => together.chat.completions.create({
      model: 'mistralai/Mixtral-8x22B-Instruct-v0.1',
      messages: [{ role: 'user', content: generatePrompt }],
      max_tokens: 4096, temperature: 0.3,
    })},
    { name: 'Fireworks', fn: () => fireworks.chat.completions.create({
      model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
      messages: [{ role: 'user', content: generatePrompt }],
      max_tokens: 4096, temperature: 0.3,
    })},
    { name: 'Cerebras', fn: () => cerebras.chat.completions.create({
      model: 'llama3.3-70b',
      messages: [{ role: 'user', content: generatePrompt }],
      max_tokens: 4096, temperature: 0.3,
    })},
    { name: 'Mistral', fn: () => mistralClient.chat.completions.create({
      model: 'mistral-large-latest',
      messages: [{ role: 'user', content: generatePrompt }],
      max_tokens: 4096, temperature: 0.3,
    })},
    { name: 'DeepInfra', fn: () => deepinfra.chat.completions.create({
      model: 'meta-llama/Llama-3.3-70B-Instruct',
      messages: [{ role: 'user', content: generatePrompt }],
      max_tokens: 4096, temperature: 0.3,
    })},
  ];

  const generateResults = await Promise.allSettled(
    generateTasks.map(t => t.fn())
  );

  generateResults.forEach((result, i) => {
    const name = generateTasks[i].name;
    if (result.status === 'fulfilled') {
      const content = result.value.choices[0]?.message?.content || '';
      const code = extractCode(content);
      const validation = validateCode(code);
      results.generate.push({ provider: name, code, validation, success: true });
    } else {
      results.errors.push(`${name}: ${result.reason?.message || 'gagal'}`);
      results.generate.push({ provider: name, code: null, validation: null, success: false });
    }
  });

  // ---------- FASE 2: REVIEW DENGAN GEMINI ----------
  const successfulCodes = results.generate.filter(g => g.success && g.code);
  let bestCode = '';

  if (successfulCodes.length > 0) {
    // Pilih kode terbaik (paling panjang & valid)
    const validCodes = successfulCodes.filter(g => g.validation?.valid);
    const candidateCodes = validCodes.length > 0 ? validCodes : successfulCodes;
    bestCode = candidateCodes.sort((a, b) => b.code.length - a.code.length)[0].code;

    // Review dengan Gemini
    try {
      const reviewPrompt = `Kamu adalah CODE REVIEWER.

REVIEW kode berikut untuk:
1. Typo atau syntax error
2. Logic error atau bug
3. Kode yang kepotong atau tidak lengkap
4. Format dan indentasi

PERBAIKI kode jika ada masalah. Outputkan KODE FINAL yang sudah sempurna dalam markdown code block.

KODE:
${bestCode}`;

      const reviewResult = await geminiModel.generateContent(reviewPrompt);
      const reviewText = reviewResult.response.text();
      const reviewedCode = extractCode(reviewText) || bestCode;

      const validationAfter = validateCode(reviewedCode);

      results.review.push({
        provider: 'Gemini',
        originalLength: bestCode.length,
        reviewedLength: reviewedCode.length,
        validation: validationAfter,
      });

      bestCode = reviewedCode;
    } catch (e) {
      results.errors.push('Gemini review: ' + e.message);
      results.review.push({ provider: 'Gemini', error: e.message });
    }
  } else {
    bestCode = '// Semua AI gagal generate kode.\n// Error: ' + results.errors.join('; ');
  }

  // ---------- FASE 3: FINAL OUTPUT ----------
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const providersUsed = results.generate.filter(g => g.success).length;

  const finalValidation = validateCode(bestCode);

  const response = bestCode.length > 3000
    ? bestCode.substring(0, 3000) + '\n\n// ... (kode dilanjutkan, total ' + bestCode.length + ' karakter)'
    : bestCode;

  return res.json({
    mode: 'serius',
    response: response,
    metadata: {
      panjangCode: bestCode.length,
      providersDigunakan: providersUsed + ' dari 6',
      direviewOleh: results.review.length > 0 ? 'Gemini' : 'Tidak',
      validasiStruktur: finalValidation.valid ? '✅ Valid' : '⚠️ ' + finalValidation.issues.join('; '),
      errors: results.errors.length > 0 ? results.errors : null,
      waktuProses: elapsed + ' detik',
    },
    sessionId: sessionId || '',
  });
    }
