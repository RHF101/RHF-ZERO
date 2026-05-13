// ============================================================
// RHF ZERO — api/chat.js
// Mode Produksi - 3 AI Fail-Safe (Groq, Gemini, OpenRouter)
// ============================================================

import { Groq } from 'groq-sdk';

// ============================================================
// HELPER: Ekstrak kode dari Markdown
// ============================================================
function extractCode(text) {
  if (!text) return '';
  const match = text.match(/```[\w]*\n([\s\S]*?)```/);
  if (match) return match[1].trim();
  return text.trim();
}

// ============================================================
// DETEKTOR MODE
// ============================================================
function detectIntent(message) {
  const keywords = ['buat', 'buatkan', 'tulis', 'kode', 'code', 'coding', 'fungsi', 'function', 'class', 'script', 'debug', 'fix', 'perbaiki', '.js', '.py', '.html', '.css', 'server', 'api', 'database'];
  const m = message.toLowerCase();
  if (m.includes('mode serius') || m.includes('```')) return 'serius';
  return keywords.filter(k => m.includes(k)).length >= 2 ? 'serius' : 'santai';
}

// ============================================================
// MAIN HANDLER
// ============================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Pesan kosong' });

  const intent = detectIntent(message);

  try {
    if (intent === 'santai') {
      return await handleSantai(message, res);
    } else {
      return await handleSerius(message, res);
    }
  } catch (error) {
    return res.json({ mode: 'error', response: 'Terjadi kesalahan sistem.' });
  }
}

// ============================================================
// MODE SANTAI (Groq)
// ============================================================
async function handleSantai(message, res) {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Kamu RHF ZERO. Jawab singkat, natural, 1-3 kalimat max.' },
        { role: 'user', content: message }
      ],
      max_tokens: 200, temperature: 0.8
    });
    return res.json({ mode: 'santai', response: completion.choices[0].message.content });
  } catch (e) {
    return res.json({ mode: 'santai', response: 'Halo! Ada yang bisa aku bantu?' });
  }
}

// ============================================================
// MODE SERIUS — 3 AI FAIL-SAFE
// ============================================================
async function handleSerius(message, res) {
  const errors = [];
  let bestCode = '';

  const prompt = `Kamu coding expert. Tulis kode untuk: "${message}". Output KODE SAJA dalam markdown code block. Format RAPI.`;

  // --- 1. GENERATE: Coba Groq dulu, kalau mati coba OpenRouter ---
  console.log('[Serius] Fase Generate...');
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const gen = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192, temperature: 0.3
    });
    bestCode = extractCode(gen.choices[0]?.message?.content);
    console.log('[Serius] Groq Generate OK');
  } catch (e) {
    console.error('[Serius] Groq Gagal:', e.message);
    errors.push('Generate: Groq mati, coba OpenRouter...');
    
    try {
      const { default: OpenAI } = await import('openai');
      const or = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY });
      const gen = await or.chat.completions.create({
        model: 'mistralai/mistral-large',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8192, temperature: 0.3
      });
      bestCode = extractCode(gen.choices[0]?.message?.content);
      console.log('[Serius] OpenRouter Generate OK (Fallback)');
    } catch (e2) {
      console.error('[Serius] OpenRouter Juga Gagal:', e2.message);
      errors.push('Generate: Semua AI mati.');
      return res.json({ mode: 'serius', response: 'Maaf, semua AI generator sedang sibuk. Coba lagi nanti.' });
    }
  }

  if (!bestCode || bestCode.length < 10) {
    return res.json({ mode: 'serius', response: 'Kode gagal dibuat. Coba lagi.' });
  }

  // --- 2. REVIEW: Coba Gemini, kalau mati loncat ---
  console.log('[Serius] Fase Review...');
  let reviewedCode = bestCode;
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const rev = await model.generateContent(`REVIEW kode ini. Cari typo, bug, format error. PERBAIKI & OUTPUT KODE FINAL.\n\n${bestCode}`);
    const fixed = extractCode(rev.response.text());
    if (fixed && fixed.length > 10) {
      reviewedCode = fixed;
      console.log('[Serius] Gemini Review OK');
    }
  } catch (e) {
    console.error('[Serius] Gemini Review Gagal:', e.message);
    errors.push('Review: Gemini mati, kode tetap diproses.');
  }

  // --- 3. VERIFIKASI: Coba OpenRouter (DeepSeek), kalau mati loncat ---
  console.log('[Serius] Fase Verifikasi...');
  let finalCode = reviewedCode;
  try {
    const { default: OpenAI } = await import('openai');
    const or = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY });
    const ver = await or.chat.completions.create({
      model: 'deepseek/deepseek-chat',
      messages: [{ role: 'user', content: `Verifikasi kode ini. Cek logika & kelengkapan. Output KODE FINAL.\n\n${reviewedCode}` }],
      max_tokens: 8192, temperature: 0.1
    });
    const fixed = extractCode(ver.choices[0]?.message?.content);
    if (fixed && fixed.length > 10) {
      finalCode = fixed;
      console.log('[Serius] DeepSeek Verifikasi OK');
    }
  } catch (e) {
    console.error('[Serius] DeepSeek Verifikasi Gagal:', e.message);
    errors.push('Verifikasi: DeepSeek mati, kode tetap aman.');
  }

  return res.json({
    mode: 'serius',
    response: finalCode,
    metadata: { errors: errors.length > 0 ? errors : null }
  });
        }
