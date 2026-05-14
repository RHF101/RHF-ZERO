// ============================================================
// RHF ZERO — api/chat.js
// INGATAN PENUH — Fakta + 350 Baris Chat Terakhir
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, mode, uid, chatId } = req.body;
  if (!message) return res.status(400).json({ error: 'Pesan kosong' });

  const GROQ_KEY = process.env.GROQ_API_KEY;
  const FB_KEY = process.env.FIREBASE_API_KEY;
  const FB_PROJECT = process.env.FIREBASE_PROJECT_ID;
  const currentChatId = chatId || 'chat_' + Date.now();

  // ============================================================
  // 1. RECALL: Fakta + 350 baris chat terakhir
  // ============================================================
  let memoryText = '';

  if (uid) {
    try {
      // Ambil fakta
      const memRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/user_memory/${uid}?key=${FB_KEY}`
      );
      const memData = await memRes.json();
      if (memData.fields?.facts?.stringValue) {
        const facts = JSON.parse(memData.fields.facts.stringValue);
        if (facts.length > 0) {
          memoryText += '\n[FAKTA TENTANG USER]\n' + facts.slice(-10).map(f => '- ' + f).join('\n') + '\n';
        }
      }

      // Ambil 350 baris chat terakhir
      const chatRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/chats/${uid}/messages?orderBy=timestamp&limit=50&key=${FB_KEY}`
      );
      const chatData = await chatRes.json();
      if (chatData.documents) {
        const recentChats = chatData.documents.slice(-25).map(doc => {
          const fields = doc.fields || {};
          const role = fields.role?.stringValue || '';
          const content = (fields.content?.stringValue || '').substring(0, 150);
          return role + ': ' + content;
        });
        if (recentChats.length > 0) {
          memoryText += '\n[CHAT TERAKHIR]\n' + recentChats.join('\n') + '\n';
        }
      }
    } catch(e) {}
  }

  // ============================================================
  // 2. IDENTITAS + SYSTEM PROMPT
  // ============================================================
  const identity = `Kamu RHF ZERO, dibuat oleh RHF. Kamu punya ingatan penuh tentang user.`;
  let systemPrompt = identity + '\n\n' + memoryText;
  
  if (mode === 'serius') systemPrompt += '\nTulis kode LENGKAP.';
  else if (mode === 'detektif') systemPrompt += '\nKamu detektif digital.';
  else if (mode === 'scraper') systemPrompt += '\nBuat HTML LENGKAP.';
  else systemPrompt += '\nJawab natural, personal, seperti teman lama. Gunakan ingatan di atas.';

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
    // 4. SIMPAN CHAT + FAKTA OTOMATIS
    // ============================================================
    if (uid) {
      // Simpan chat
      try {
        await fetch(
          `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/chats/${uid}/messages?key=${FB_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                role: { stringValue: 'user' },
                content: { stringValue: message },
                timestamp: { timestampValue: new Date().toISOString() },
                chatId: { stringValue: currentChatId }
              }
            })
          }
        );
        await fetch(
          `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/chats/${uid}/messages?key=${FB_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                role: { stringValue: 'ai' },
                content: { stringValue: response },
                timestamp: { timestampValue: new Date().toISOString() },
                chatId: { stringValue: currentChatId }
              }
            })
          }
        );
      } catch(e) {}

      // Simpan fakta (kalau ada)
      const lowerMsg = message.toLowerCase();
      if (lowerMsg.includes('aku ') || lowerMsg.includes('saya ') || lowerMsg.includes('namaku ')) {
        try {
          const existingFacts = memoryText.includes('[FAKTA') 
            ? memoryText.split('[FAKTA')[1].split('[/FAKTA]')[0].split('\n').filter(f => f.startsWith('- ')).map(f => f.replace('- ', ''))
            : [];
          existingFacts.push(message);
          const uniqueFacts = [...new Set(existingFacts)].slice(-20);
          
          await fetch(
            `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/user_memory/${uid}?key=${FB_KEY}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fields: {
                  facts: { stringValue: JSON.stringify(uniqueFacts) },
                  updatedAt: { timestampValue: new Date().toISOString() }
                }
              })
            }
          );
        } catch(e) {}
      }
    }

    return res.json({ mode: mode || 'santai', response, chatId: currentChatId });
  } catch(e) {
    return res.json({ mode: 'santai', response: 'Halo! Ada yang bisa RHF bantu?' });
  }
}
