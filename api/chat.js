// api/chat.js — RHF ZERO Chat Handler v2 (3D + Memory)

import { saveMessage, createChat } from './memory.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, mode, history, facts, image, uid, chatId } = req.body;
  if (!message && !image) return res.status(400).json({ error: 'Pesan kosong' });

  let response = null;

  // Bangun ingatan konteks
  let memoryText = '';
  if (history && history.length > 0) memoryText += '\n[CHAT]\n' + history.slice(-50).join('\n');
  if (facts && facts.length > 0) memoryText += '\n[FAKTA]\n' + facts.slice(-20).map(f => '- ' + f).join('\n');

  // ═══════════════════════════════════════════
  // MODE: DETEKTIF (Vision — analisis gambar)
  // ═══════════════════════════════════════════
  if (mode === 'detektif' && image) {
    try {
      const parts = [{ text: message || 'Analisis gambar ini secara detail dan mendalam.' }];
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: image.replace(/^data:image\/\w+;base64,/, '')
        }
      });
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts }] })
        }
      );
      const data = await r.json();
      response = data.candidates?.[0]?.content?.parts?.[0]?.text;
    } catch (e) {
      console.error('[detektif] Gemini vision error:', e.message);
    }
  }

  // ═══════════════════════════════════════════
  // MODE: SERIUS (coding expert)
  // ═══════════════════════════════════════════
  if (!response && mode === 'serius') {
    const sp = `Kamu RHF ZERO, coding expert tingkat tinggi.
TULIS KODE SAJA — JANGAN beri penjelasan, preamble, atau komentar berlebihan.
Output kode dalam markdown code block sesuai bahasa yang diminta.
Pastikan kode LENGKAP, berjalan, dan production-ready.`;
    response = await callAI(message, sp, 8192, 0.2);
  }

  // ═══════════════════════════════════════════
  // MODE: SCRAPER (web scraping / data extraction)
  // ═══════════════════════════════════════════
  if (!response && mode === 'scraper') {
    const sp = `Kamu RHF ZERO, expert web scraping dan data extraction.
Tulis kode scraper LENGKAP (Python/Node.js) sesuai kebutuhan.
Gunakan library populer (requests, BeautifulSoup, puppeteer, cheerio, dll).
Output KODE SAJA dalam markdown code block. Pastikan production-ready.`;
    response = await callAI(message, sp, 8192, 0.2);
  }

  // ═══════════════════════════════════════════
  // MODE: 3D (Three.js scene generator)
  // ═══════════════════════════════════════════
  if (!response && mode === '3d') {
    const sp = `Kamu RHF ZERO, expert 3D graphics dengan Three.js.

Tugas: Buat scene Three.js LENGKAP dalam satu file HTML yang bisa langsung dijalankan di browser.

WAJIB IKUTI ATURAN INI:
1. Output HANYA kode HTML mentah dari <!DOCTYPE html> sampai </html>. TIDAK ADA teks lain, TIDAK ADA markdown, TIDAK ADA penjelasan.
2. Gunakan CDN PERSIS ini (jangan ubah):
   - Three.js: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
   - OrbitControls: https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js
3. Scene harus berisi semua elemen yang diminta user (objek, karakter, pohon, tanah/map, cuaca, hujan, langit, dll).
4. Gunakan AnimationLoop (renderer.setAnimationLoop) agar animasi berjalan mulus.
5. Tambahkan OrbitControls agar user bisa rotate/zoom/pan dengan mouse.
6. Gunakan lighting yang dramatis: AmbientLight + DirectionalLight + optional PointLight/SpotLight.
7. Background canvas: hitam atau warna langit sesuai konteks.
8. Lebar canvas 100% viewport (window.innerWidth x window.innerHeight), responsive ke resize.
9. Jika ada karakter/objek humanoid — buat dari geometri dasar (Box, Sphere, Cylinder) yang digabung jadi grup.
10. Jika ada hujan — buat particle system (Points geometry, ribuan titik yang jatuh).
11. Jika ada tanah/map — buat PlaneGeometry horizontal, bisa dengan warna hijau/coklat atau grid.
12. Jika ada pohon — buat dari ConeGeometry (daun) + CylinderGeometry (batang).
13. Jika ada langit — buat SphereGeometry besar yang membungkus scene (skybox) atau gradient fog.
14. JANGAN gunakan THREE.CapsuleGeometry (tidak ada di r128). Gunakan CylinderGeometry + SphereGeometry sebagai gantinya.
15. JANGAN gunakan THREE.OrbitControls langsung — akses via THREE.OrbitControls setelah load script CDN.

Buat scene semenarik dan sedetail mungkin sesuai permintaan user.`;

    response = await callAI(message, sp, 8192, 0.3);

    // Bersihkan respons — pastikan hanya HTML murni
    if (response) {
      // Hapus markdown code fences jika ada
      response = response
        .replace(/^```html\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      // Pastikan dimulai dengan <!DOCTYPE html>
      if (!response.toLowerCase().startsWith('<!doctype html') && !response.toLowerCase().startsWith('<html')) {
        // Coba ekstrak HTML dari dalam respons
        const htmlMatch = response.match(/<!DOCTYPE html[\s\S]*<\/html>/i);
        if (htmlMatch) {
          response = htmlMatch[0];
        }
      }
    }
  }

  // ═══════════════════════════════════════════
  // MODE: SANTAI (default — casual chat)
  // ═══════════════════════════════════════════
  if (!response) {
    const sp = `Kamu RHF ZERO, asisten AI personal yang cerdas dan friendly.
${memoryText}
Jawab SINGKAT, natural, dan helpful. Maksimal 3-4 kalimat kecuali diminta lebih panjang.
Gunakan bahasa Indonesia santai. Boleh campuran bahasa jika konteksnya teknis.`;
    response = await callAI(message, sp, 600, 0.8);
  }

  if (!response) response = 'Maaf, semua AI provider sedang sibuk. Coba lagi dalam beberapa detik.';

  // ── Deteksi format output ──
  let format = 'txt';
  const r = response;
  if (r.includes('<!DOCTYPE html') || r.includes('<!doctype html') || r.includes('<html')) format = 'html';
  else if (r.includes('<?php')) format = 'php';
  else if (r.includes('import ') && r.includes('def ')) format = 'py';
  else if (r.includes('def ') && r.includes('return ')) format = 'py';
  else if (r.includes('const ') || r.includes('function ') || r.includes('async ')) format = 'js';
  else if (r.includes('SELECT ') || r.includes('FROM ')) format = 'sql';

  // ── Simpan ke Firebase via memory.js ──
  if (uid && chatId) {
    try {
      await createChat(uid, chatId, {
        title: (message || 'Chat').substring(0, 40),
        mode: mode || 'santai'
      });

      await saveMessage(uid, chatId, {
        role: 'user',
        content: message || '[Gambar]',
        format: 'txt',
        mode: mode || 'santai',
      });

      await saveMessage(uid, chatId, {
        role: 'ai',
        content: response,
        format,
        mode: mode || 'santai',
      });
    } catch (memErr) {
      console.error('[chat.js] Memory save error:', memErr.message);
    }
  }

  return res.json({
    mode: mode || 'santai',
    response,
    format,
    simpan: {
      userMsg: (message || '[Gambar]').substring(0, 200),
      aiMsg: response.substring(0, 200),
      isFakta: /aku |saya |namaku |hobiku |ingat /i.test(message || '')
    }
  });
}

// ════════════════════════════════════════════════════════
// callAI — Waterfall: Groq → OpenRouter → Gemini
// ════════════════════════════════════════════════════════
async function callAI(msg, sp, maxT, temp) {

  // ── GROQ (Llama 3.3 70B) ──
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: sp },
          { role: 'user', content: msg }
        ],
        max_tokens: maxT,
        temperature: temp
      })
    });
    const d = await r.json();
    const t = d.choices?.[0]?.message?.content;
    if (t && t.length > 10) return t;
  } catch (e) {
    console.error('[callAI] Groq error:', e.message);
  }

  // ── OPENROUTER (Hermes 3 Llama 70B) ──
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://rhf-zero.vercel.app',
        'X-Title': 'RHF ZERO'
      },
      body: JSON.stringify({
        model: 'nousresearch/hermes-3-llama-3.1-70b',
        messages: [
          { role: 'system', content: sp },
          { role: 'user', content: msg }
        ],
        max_tokens: maxT,
        temperature: temp
      })
    });
    const d = await r.json();
    const t = d.choices?.[0]?.message?.content;
    if (t && t.length > 10) return t;
  } catch (e) {
    console.error('[callAI] OpenRouter error:', e.message);
  }

  // ── GEMINI 2.5 Flash (fallback terakhir) ──
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: sp + '\n\nUser: ' + msg }] }]
        })
      }
    );
    const d = await r.json();
    const t = d.candidates?.[0]?.content?.parts?.[0]?.text;
    if (t && t.length > 10) return t;
  } catch (e) {
    console.error('[callAI] Gemini error:', e.message);
  }

  return null;
}
