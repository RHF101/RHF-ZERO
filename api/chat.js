// ============================================================
// RHF ZERO — api/chat.js
// INGATAN SIMPLE — Fakta + Chat History dalam 1 dokumen
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, mode, uid } = req.body;
  if (!message) return res.status(400).json({ error: 'Pesan kosong' });

  const GROQ_KEY = process.env.GROQ_API_KEY;
  const FB_KEY = process.env.FIREBASE_API_KEY;
  const FB_PROJECT = process.env.FIREBASE_PROJECT_ID;

  // ============================================================
  // 1. RECALL INGATAN
  // ============================================================
  let memoryText = '';

  if (uid) {
    try {
      const res = await fetch(
        `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/users/${uid}?key=${FB_KEY}`
      );
      const data = await res.json();
      if (data.fields) {
        const facts = data.fields.facts?.stringValue 
          ? JSON.parse(data.fields.facts.stringValue) 
          : [];
        const history = data.fields.history?.stringValue 
          ? JSON.parse(data.fields.history.stringValue) 
          : [];

        if (facts.length > 0) {
          memoryText += '\n[FAKTA]\n' + facts.slice(-10).map(f => '- ' + f).join('\n') + '\n';
        }
        if (history.length > 0) {
          memoryText += '\n[CHAT TERAKHIR]\n' + history.slice(-15).join('\n') + '\n';
        }
      }
    } catch(e) {}
  }

  // ============================================================
  // 2. SYSTEM PROMPT
  // ============================================================
  const identity = `Kamu RHF ZERO, dibuat oleh RHF. Kamu punya ingatan. Gunakan ingatan di bawah untuk jawab. Kalau tidak ada, ngobrol biasa.`;
  let systemPrompt = identity + '\n' + memoryText;
  
  if (mode === 'serius') systemPrompt += '\nMode: Coding. Tulis kode LENGKAP.';
  else if (mode === 'detektif') systemPrompt += '\nMode: Detektif. Analisis mendalam.';
  else if (mode === 'scraper') systemPrompt += '\nMode: Scraper. Buat HTML LENGKAP.';
  else systemPrompt += '\nMode: Santai. Jawab natural, personal.';

  // ============================================================
  // 3. PANGGIL GROQ
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
        temperature: 0.7
      })
    });

    const aiData = await aiRes.json();
    const response = aiData.choices?.[0]?.message?.content || 'Maaf, tidak ada respons.';

    // ============================================================
    // 4. SIMPAN CHAT + FAKTA
    // ============================================================
    if (uid) {
      try {
        // Ambil data lama
        const oldRes = await fetch(
          `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/users/${uid}?key=${FB_KEY}`
        );
        const oldData = await oldRes.json();
        
        let facts = [];
        let history = [];
        
        if (oldData.fields) {
          facts = oldData.fields.facts?.stringValue ? JSON.parse(oldData.fields.facts.stringValue) : [];
          history = oldData.fields.history?.stringValue ? JSON.parse(oldData.fields.history.stringValue) : [];
        }

        // Tambah ke history
        history.push('User: ' + message);
        history.push('AI: ' + response.substring(0, 200));
        if (history.length > 30) history = history.slice(-30); // Maks 30 baris

        // Tambah fakta kalau relevan
        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes('aku ') || lowerMsg.includes('saya ') || lowerMsg.includes('namaku ') || lowerMsg.includes('hobiku ')) {
          facts.push(message);
          if (facts.length > 20) facts = facts.slice(-20);
        }

        // Simpan ke Firebase
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

    return res.json({ mode: mode || 'santai', response });
  } catch(e) {
    return res.json({ mode: 'santai', response: 'Halo! Ada yang bisa RHF bantu?' });
  }
}
