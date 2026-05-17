export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, mode, history, facts, image } = req.body;
  if (!message && !image) return res.status(400).json({ error: 'Pesan kosong' });

  let response = null;

  // Bangun ingatan
  let memoryText = '';
  if (history && history.length > 0) memoryText += '\n[CHAT]\n' + history.slice(-50).join('\n');
  if (facts && facts.length > 0) memoryText += '\n[FAKTA]\n' + facts.slice(-20).map(f => '- ' + f).join('\n');

  // === VISION ===
  if (mode === 'detektif' && image) {
    try {
      const parts = [{ text: message || 'Analisis gambar ini detail.' }];
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: image.replace(/^data:image\/\w+;base64,/, '') } });
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) }
      );
      const data = await res.json();
      response = data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch(e) {}
  }

  // === SERIUS ===
  if (!response && mode === 'serius') {
    const sp = 'Kamu RHF ZERO, coding expert. TULIS KODE SAJA. JANGAN JELASKAN. Output kode dalam markdown.';
    response = await callAI(message, sp, 8192, 0.2);
  }

  // === SANTAI ===
  if (!response) {
    const sp = 'Kamu RHF ZERO. ' + memoryText + '\nJawab SINGKAT natural. Maks 3 kalimat.';
    response = await callAI(message, sp, 300, 0.8);
  }

  if (!response) response = 'Maaf, AI sibuk. Coba lagi.';

  let format = 'txt';
  if (response.includes('<!DOCTYPE html') || response.includes('<html')) format = 'html';
  else if (response.includes('<?php')) format = 'php';
  else if (response.includes('def ') && response.includes('return ')) format = 'py';
  else if (response.includes('function ') || response.includes('const ')) format = 'js';

  return res.json({
    mode: mode || 'santai', response, format,
    simpan: {
      userMsg: (message || '[Gambar]').substring(0, 200),
      aiMsg: response.substring(0, 200),
      isFakta: /aku |saya |namaku |hobiku |ingat /i.test(message || '')
    }
  });
}

async function callAI(msg, sp, maxT, temp) {
  // Groq
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'system', content: sp }, { role: 'user', content: msg }], max_tokens: maxT, temperature: temp })
    });
    const d = await r.json();
    const t = d.choices?.[0]?.message?.content;
    if (t && t.length > 5) return t;
  } catch(e) {}

  // OpenRouter
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://rhf-zero.vercel.app', 'X-Title': 'RHF ZERO' },
      body: JSON.stringify({ model: 'nousresearch/hermes-3-llama-3.1-70b', messages: [{ role: 'system', content: sp }, { role: 'user', content: msg }], max_tokens: maxT, temperature: temp })
    });
    const d = await r.json();
    const t = d.choices?.[0]?.message?.content;
    if (t && t.length > 5) return t;
  } catch(e) {}

  // Gemini
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: sp + '\n\n' + msg }] }] }) }
    );
    const d = await r.json();
    const t = d.candidates?.[0]?.content?.parts?.[0]?.text;
    if (t && t.length > 5) return t;
  } catch(e) {}

  return null;
                                                                                               }
