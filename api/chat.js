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

  const identity = 'Kamu RHF ZERO, dibuat oleh RHF. Gunakan ingatan di bawah.';
  let systemPrompt = identity + '\n' + memoryText;
  if (mode === 'serius') systemPrompt += '\nMode SERIUS. Tulis kode LENGKAP.';
  else if (mode === 'detektif') systemPrompt += '\nMode DETEKTIF.';
  else if (mode === 'scraper') systemPrompt += '\nMode SCRAPER. Buat HTML LENGKAP.';

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
        max_tokens: mode === 'serius' || mode === 'scraper' ? 8192 : 2000,
        temperature: mode === 'serius' ? 0.2 : 0.7
      })
    });

    const aiData = await aiRes.json();
    const response = aiData.choices?.[0]?.message?.content || 'Maaf, tidak ada respons.';

    return res.json({
      mode: mode || 'santai',
      response: response + '\n\n---\n📊 DEBUG: ' + (memoryText ? 'INGATAN ADA (' + memoryText.length + ' karakter)' : 'INGATAN KOSONG'),
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
