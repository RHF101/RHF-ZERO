export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, mode, history, facts } = req.body;
  if (!message) return res.status(400).json({ error: 'Pesan kosong' });

  const GROQ_KEY = process.env.GROQ_API_KEY;

  // Bangun ingatan dari history & facts (dikirim frontend)
  let memoryText = '';
  if (facts && facts.length > 0) {
    memoryText += '\n[FAKTA USER]\n' + facts.slice(-20).map(f => '- ' + f).join('\n') + '\n';
  }
  if (history && history.length > 0) {
    memoryText += '\n[RIWAYAT CHAT]\n' + history.slice(-50).join('\n') + '\n';
  }

  // ============================================================
  // SYSTEM PROMPT
  // ============================================================
  const identity = 'Kamu RHF ZERO, dibuat oleh RHF. Gunakan ingatan di bawah.';
  let systemPrompt = identity + '\n' + memoryText;

  if (mode === 'serius') {
    const butuhPenjelasan = /jelaskan|bagaimana|cara|contoh|panduan|tutor|maksud|kenapa/i.test(message);
    if (butuhPenjelasan) {
      systemPrompt += '\nMode SERIUS. Berikan kode LENGKAP + penjelasan singkat.';
    } else {
      systemPrompt += '\nMode SERIUS. TULIS KODE SAJA. Jangan jelaskan apapun. Langsung output kode dalam markdown.';
    }
    systemPrompt += '\n\nATURAN KODE:\n- Kode HARUS LENGKAP, tidak boleh kepotong\n- Semua bracket, tag, kurung HARUS TERTUTUP\n- Indentasi RAPI (2 spasi)\n- Jangan pakai placeholder seperti // TODO atau ...\n- Kalau HTML: sertakan <!DOCTYPE html> sampai </html>\n- Kalau JS: fungsi harus bisa langsung dijalankan\n- Cek ulang sebelum output';
  } else if (mode === 'detektif') {
    systemPrompt += '\nMode DETEKTIF. Analisis mendalam.';
  } else if (mode === 'scraper') {
    systemPrompt += '\nMode SCRAPER. Buat HTML LENGKAP.';
  }

  try {
    const userMessage = memoryText ? `[INGATAN]\n${memoryText}\n\n[PESAN]\n${message}` : message;

    const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 8192,
        temperature: mode === 'serius' ? 0.2 : 0.7
      })
    });

    const aiData = await aiRes.json();
    const response = aiData.choices?.[0]?.message?.content || 'Maaf, tidak ada respons.';

    // Deteksi format kode untuk download
    let format = 'txt';
    const code = response;
    if (code.includes('<!DOCTYPE html') || code.includes('<html')) format = 'html';
    else if (code.includes('<?php')) format = 'php';
    else if (code.includes('body {') || code.includes('@import')) format = 'css';
    else if (code.includes('def ') && code.includes('return ')) format = 'py';
    else if (code.includes('function ') || code.includes('const ') || code.includes('let ')) format = 'js';
    else if (code.includes('package ') && code.includes('class ')) format = 'java';
    else if (code.includes('import React')) format = 'jsx';
    else if (code.includes('CREATE TABLE') || code.includes('SELECT ')) format = 'sql';

    return res.json({
      mode: mode || 'santai',
      response: response,
      format: format,
      simpan: {
        userMsg: message.substring(0, 200),
        aiMsg: response.substring(0, 200),
        isFakta: /aku |saya |namaku |hobiku |ingat /i.test(message)
      }
    });
  } catch(e) {
    return res.json({ mode: 'santai', response: 'Halo! Ada yang bisa RHF bantu?' });
  }
}
