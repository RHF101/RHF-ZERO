export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, mode, history, facts, image } = req.body;
  if (!message && !image) return res.status(400).json({ error: 'Pesan kosong' });

  let response = null;
  const startTime = Date.now();

  // ============================================================
  // MODE DETEKTIF / VISION — Gemini
  // ============================================================
  if (mode === 'detektif' && image) {
    try {
      const geminiKey = process.env.GEMINI_API_KEY;
      const parts = [{ text: message || 'Analisis gambar ini secara detail.' }];
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: image.replace(/^data:image\/\w+;base64,/, '') } });
      
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts }] })
        }
      );
      const geminiData = await geminiRes.json();
      response = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch(e) {}
  }

  // ============================================================
  // MODE SERIUS — PROMPT TEGAS
  // ============================================================
  if (!response && mode === 'serius') {
    const systemPrompt = 'Kamu RHF ZERO, coding expert. TULIS KODE SAJA. JANGAN JELASKAN. JANGAN ANALISIS. JANGAN BERI SARAN. HANYA KODE. Output dalam markdown code block. Kode HARUS LENGKAP.';
    response = await callAI(message, systemPrompt, 8192, 0.2);
  }

  // ============================================================
  // MODE SANTAI — CEPAT
  // ============================================================
  if (!response) {
    const systemPrompt = 'Kamu RHF ZERO, dibuat oleh RHF. Jawab SINGKAT, natural, bahasa Indonesia. Maks 3 kalimat.';
    response = await callAI(message, systemPrompt, 300, 0.8);
  }

  if (!response) response = 'Maaf, AI sedang sibuk. Coba lagi.';

  // Deteksi format
  let format = 'txt';
  if (response.includes('<!DOCTYPE html') || response.includes('<html')) format = 'html';
  else if (response.includes('<?php')) format = 'php';
  else if (response.includes('def ') && response.includes('return ')) format = 'py';
  else if (response.includes('function ') || response.includes('const ')) format = 'js';

  return res.json({
    mode: mode || 'santai',
    response: response,
    format: format,
    waktu: ((Date.now() - startTime) / 1000).toFixed(1) + 's',
    simpan: {
      userMsg: (message || '[Gambar]').substring(0, 200),
      aiMsg: response.substring(0, 200),
      isFakta: /aku |saya |namaku |hobiku |ingat /i.test(message || '')
    }
  });
}

// ============================================================
// UNIVERSAL AI CALLER
// ============================================================
async function callAI(message, systemPrompt, maxTokens, temp) {
  // Groq
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }],
        max_tokens: maxTokens, temperature: temp
      })
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (text && text.length > 5) return text;
  } catch(e) {}

  // OpenRouter
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://rhf-zero.vercel.app',
        'X-Title': 'RHF ZERO'
      },
      body: JSON.stringify({
        model: 'nousresearch/hermes-3-llama-3.1-70b',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }],
        max_tokens: maxTokens, temperature: temp
      })
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (text && text.length > 5) return text;
  } catch(e) {}

  // Gemini
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt + '\n\n' + message }] }] })
      }
    );
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text && text.length > 5) return text;
  } catch(e) {}

  return null;
}
