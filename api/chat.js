// ============================================================
// RHF ZERO — api/chat.js
// MODE SERIUS 3 AI + MEMORI TIAP AKUN GOOGLE
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, mode, uid } = req.body;
  if (!message) return res.status(400).json({ error: 'Pesan kosong' });

  const GROQ_KEY = process.env.GROQ_API_KEY;
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const OR_KEY = process.env.OPENROUTER_API_KEY;
  const FB_KEY = process.env.FIREBASE_API_KEY;
  const FB_PROJECT = process.env.FIREBASE_PROJECT_ID;

  // ============================================================
  // RECALL INGATAN (dari akun Google/uid)
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
        if (facts.length > 0) memoryText += '\n[FAKTA USER]\n' + facts.slice(-10).map(f => '- ' + f).join('\n');
        if (history.length > 0) memoryText += '\n[CHAT TERAKHIR]\n' + history.slice(-15).join('\n');
      }
    } catch(e) {}
  }

  // ============================================================
  // SYSTEM PROMPT
  // ============================================================
  const identity = 'Kamu RHF ZERO, dibuat oleh RHF. Kamu punya ingatan. Gunakan fakta & chat history user untuk jawab personal.';
  let systemPrompt = identity + '\n' + memoryText;

  if (mode === 'serius') {
    systemPrompt += '\nMode: SERIUS. Tulis kode LENGKAP, RAPI, jangan potong.';
  } else if (mode === 'detektif') {
    systemPrompt += '\nMode: DETEKTIF. Analisis mendalam.';
  } else if (mode === 'scraper') {
    systemPrompt += '\nMode: SCRAPER. Buat HTML LENGKAP.';
  } else {
    systemPrompt += '\nMode: SANTAI. Jawab natural, personal.';
  }

  try {
    let response = '';

    // ============================================================
    // MODE SERIUS: 3 AI (Groq → Gemini → DeepSeek)
    // ============================================================
    if (mode === 'serius') {
      let code = '';

      // --- 1. GROQ GENERATE ---
      try {
        const gRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }],
            max_tokens: 8192, temperature: 0.3
          })
        });
        const gData = await gRes.json();
        code = gData.choices?.[0]?.message?.content || '';
      } catch(e) {}

      // --- 2. GEMINI REVIEW ---
      if (code && GEMINI_KEY) {
        try {
          const gemRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `REVIEW kode ini. Cari typo, bug, format error. PERBAIKI & output KODE FINAL.\n\n${code}` }] }]
              })
            }
          );
          const gemData = await gemRes.json();
          const reviewed = gemData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (reviewed && reviewed.length > 20) code = reviewed;
        } catch(e) {}
      }

      // --- 3. DEEPSEEK VERIFIKASI ---
      if (code && OR_KEY) {
        try {
          const dsRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OR_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'deepseek/deepseek-chat',
              messages: [{ role: 'user', content: `Verifikasi kode ini. Cek logic & kelengkapan. Output KODE FINAL.\n\n${code}` }],
              max_tokens: 8192, temperature: 0.1
            })
          });
          const dsData = await dsRes.json();
          const verified = dsData.choices?.[0]?.message?.content || '';
          if (verified && verified.length > 20) code = verified;
        } catch(e) {}
      }

      response = code || 'Gagal generate kode.';
    } else {
      // ============================================================
      // MODE LAIN: Groq langsung
      // ============================================================
      const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }],
          max_tokens: mode === 'scraper' ? 8192 : 2000,
          temperature: 0.7
        })
      });
      const aiData = await aiRes.json();
      response = aiData.choices?.[0]?.message?.content || 'Maaf, tidak ada respons.';
    }

    // ============================================================
    // SIMPAN KE MEMORI (per akun Google)
    // ============================================================
    if (uid) {
      try {
        history.push('User: ' + message.substring(0, 150));
        history.push('AI: ' + response.substring(0, 200));
        if (history.length > 30) history = history.slice(-30);

        const lowerMsg = message.toLowerCase();
        if (lowerMsg.includes('aku ') || lowerMsg.includes('saya ') || lowerMsg.includes('namaku ') || lowerMsg.includes('hobiku ')) {
          facts.push(message);
          if (facts.length > 20) facts = facts.slice(-20);
        }

        await fetch(
          `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/users/${uid}?key=${FB_KEY}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                facts: { stringValue: JSON.stringify(facts) },
                history: { stringValue: JSON.stringify(history) },
                email: { stringValue: uid + '@gmail.com' },
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
