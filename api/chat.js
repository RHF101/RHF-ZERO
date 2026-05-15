// ============================================================
// RHF ZERO — api/chat.js
// INGATAN 300 PESAN — FIFO (First In First Out)
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, mode, uid, chatId } = req.body;
  if (!message) return res.status(400).json({ error: 'Pesan kosong' });

  const GROQ_KEY = process.env.GROQ_API_KEY;
  const FB_KEY = process.env.FIREBASE_API_KEY;
  const FB_PROJECT = process.env.FIREBASE_PROJECT_ID;
  const MAX_HISTORY = 300; // ⬅️ 300 pesan maksimal

  // ============================================================
  // RECALL INGATAN (Fakta + 300 chat terakhir)
  // ============================================================
  let memoryText = '';
  let facts = [];
  let history = [];

  if (uid) {
    try {
      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/users/${uid}?key=${FB_KEY}`
      );
      const data = await res.json();
      if (data.fields) {
        facts = data.fields.facts?.stringValue ? JSON.parse(data.fields.facts.stringValue) : [];
        history = data.fields.history?.stringValue ? JSON.parse(data.fields.history.stringValue) : [];
      }
    } catch(e) {}

    if (facts.length > 0) {
      memoryText += '\n[FAKTA USER]\n' + facts.slice(-20).map(f => '- ' + f).join('\n') + '\n';
    }
    if (history.length > 0) {
      memoryText += '\n[RIWAYAT CHAT]\n' + history.slice(-50).join('\n') + '\n';
      // ⬅️ Recall 50 terakhir untuk konteks, tapi simpan 300
    }
  }

  // ============================================================
  // SYSTEM PROMPT
  // ============================================================
  const identity = 'Kamu RHF ZERO, dibuat oleh RHF. Kamu punya ingatan super. Gunakan FAKTA & RIWAYAT CHAT di atas. Jawab personal seperti teman lama.';
  let systemPrompt = identity + '\n' + memoryText;

  if (mode === 'serius') {
    systemPrompt += '\nMode SERIUS. Tulis kode LENGKAP, jangan jelaskan.';
  } else if (mode === 'detektif') {
    systemPrompt += '\nMode DETEKTIF. Analisis mendalam.';
  } else if (mode === 'scraper') {
    systemPrompt += '\nMode SCRAPER. Buat HTML LENGKAP.';
  }

  // ============================================================
  // PANGGIL AI
  // ============================================================
  try {
    const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: mode === 'serius' || mode === 'scraper' ? 8192 : 2000,
        temperature: mode === 'serius' ? 0.2 : 0.7
      })
    });

    const aiData = await aiRes.json();
    const response = aiData.choices?.[0]?.message?.content || 'Maaf, tidak ada respons.';

    // ============================================================
    // SIMPAN KE INGATAN (FIFO: 300 max)
    // ============================================================
    if (uid) {
// Tambah pesan baru
history.push('👤: ' + message.substring(0, 200));
history.push('🤖: ' + response.substring(0, 200));

// Setiap 10 pesan, buat ringkasan
if (history.length % 10 === 0) {
  try {
    const summaryRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Buat ringkasan SINGKAT dari percakapan ini. Tangkap: topik utama, keputusan, fakta penting, dan preferensi user. Maks 3 kalimat.' },
          { role: 'user', content: history.slice(-10).join('\n') }
        ],
        max_tokens: 200,
        temperature: 0.3
      })
    });
    const sData = await summaryRes.json();
    const ringkasan = sData.choices?.[0]?.message?.content || '';
    if (ringkasan) {
      history.push('📝 Ringkasan: ' + ringkasan);
    }
  } catch(e) {}
}

      // JAGA MAKS 300 — hapus yang paling depan kalau kelebihan
      if (history.length > MAX_HISTORY) {
        history = history.slice(-MAX_HISTORY);
      }

      // Simpan fakta baru kalau ada
      const lowerMsg = message.toLowerCase();
      if (lowerMsg.includes('aku ') || lowerMsg.includes('saya ') || lowerMsg.includes('namaku ') || lowerMsg.includes('hobiku ') || lowerMsg.includes('ingat ')) {
        facts.push(message);
        if (facts.length > 30) facts = facts.slice(-30);
      }

      // Simpan ke Firebase
      try {
        await fetch(
          `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/users/${uid}?key=${FB_KEY}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                facts: { stringValue: JSON.stringify(facts) },
                history: { stringValue: JSON.stringify(history) },
                updatedAt: { timestampValue: new Date().toISOString() }
              }
            })
          }
        );
      } catch(e) {}
    }

    return res.json({ 
  mode: mode || 'santai', 
  response: response + '\n\n---\n📊 DEBUG INGATAN: ' + (memoryText ? 'ADA (' + memoryText.length + ' karakter)' : 'KOSONG'),
});
  } catch(e) {
    return res.json({ mode: 'santai', response: 'Halo! Ada yang bisa RHF bantu?' });
  }
}
