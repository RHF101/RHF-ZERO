export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, mode, history, facts } = req.body;
  if (!message) return res.status(400).json({ error: 'Pesan kosong' });

  const OR_KEY = process.env.OPENROUTER_API_KEY;

  // Bangun ingatan
  let memoryText = '';
  if (facts && facts.length > 0) {
    memoryText += '\n[FAKTA USER]\n' + facts.slice(-20).map(f => '- ' + f).join('\n') + '\n';
  }
  if (history && history.length > 0) {
    memoryText += '\n[RIWAYAT CHAT]\n' + history.slice(-50).join('\n') + '\n';
  }

  // System prompt
  let systemPrompt = 'Kamu RHF ZERO, dibuat oleh RHF.';

  if (mode === 'serius') {
    const butuhPenjelasan = /jelaskan|bagaimana|cara|contoh|panduan|tutor|maksud|kenapa/i.test(message);
    if (butuhPenjelasan) {
      systemPrompt = 'Kamu RHF ZERO, coding expert. Berikan kode LENGKAP + penjelasan singkat.';
    } else {
      systemPrompt = 'Kamu RHF ZERO, coding expert. TULIS KODE SAJA. Output kode dalam markdown.';
    }
    systemPrompt += '\nATURAN: Kode HARUS LENGKAP. Bracket TERTUTUP.';
  } else if (mode === 'detektif') {
    systemPrompt += '\nMode DETEKTIF. Analisis mendalam.';
  } else if (mode === 'scraper') {
    systemPrompt += '\nMode SCRAPER. Buat HTML LENGKAP.';
  } else {
    systemPrompt += '\nJawab natural, personal. Gunakan ingatan di bawah.';
    systemPrompt += '\n' + memoryText;
  }

  try {
    let userMessage = message;
    if (memoryText && mode !== 'serius') {
      userMessage = `[INGATAN]\n${memoryText}\n\n[PESAN]\n${message}`;
    }

    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OR_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://rhf-zero.vercel.app',
        'X-Title': 'RHF ZERO'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-large',
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
