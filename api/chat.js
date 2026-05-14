// ============================================================
// RHF ZERO — api/chat.js
// Mode Manual + Detektif + Vision + Scraper + AI Mandor
// ============================================================

import { Groq } from 'groq-sdk';
import { saveMessage } from './memory.js';

// ============================================================
// HELPER
// ============================================================
function extractCode(text) {
  if (!text) return '';
  const match = text.match(/```[\w]*\n([\s\S]*?)```/);
  if (match) return match[1].trim();
  return text.trim();
}

async function getOpenAI(baseURL, apiKey) {
  const { default: OpenAI } = await import('openai');
  return new OpenAI({ baseURL, apiKey });
}

// ============================================================
// MAIN HANDLER
// ============================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, mode, image, uid, chatId } = req.body;
  if (!message && !image) return res.status(400).json({ error: 'Pesan atau gambar kosong' });

  const currentChatId = chatId || 'chat_' + Date.now();
  if (uid) saveMessage(uid, currentChatId, 'user', message || '[Gambar]', mode || 'santai').catch(() => {});

  try {
    // Mode Manual: user pilih
    if (mode === 'serius') return await handleSerius(message, image, res);
    if (mode === 'detektif') return await handleDetektif(message, image, res);
    if (mode === 'scraper') return await handleScraper(message, res);
    
    // Default: Santai
    return await handleSantai(message, res);
  } catch (error) {
    return res.status(500).json({ mode: 'error', response: 'Terjadi kesalahan.' });
  }
}

// ============================================================
// MODE SANTAI
// ============================================================
async function handleSantai(message, res) {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Kamu RHF ZERO, asisten serba bisa. Jawab natural, informatif, tidak perlu singkat kalau memang perlu detail.' },
        { role: 'user', content: message }
      ],
      max_tokens: 2000, temperature: 0.7
    });
    return res.json({ mode: 'santai', response: completion.choices[0].message.content });
  } catch (e) {
    return res.json({ mode: 'santai', response: 'Halo! Ada yang bisa aku bantu?' });
  }
}

// ============================================================
// MODE SERIUS — Kode Panjang
// ============================================================
async function handleSerius(message, image, res) {
  let prompt = message;

  // Kalau ada gambar
  if (image) {
    prompt = `[GAMBAR TERLAMPIR] Analisis gambar ini dan buat kode berdasarkan gambar tersebut.\nDeskripsi user: ${message || 'Tidak ada'}`;
  }

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const parts = [{ text: `Kamu coding expert. Tulis kode LENGKAP untuk: "${prompt}". Output SEMUA kode. Jangan dipotong. Format RAPI.` }];
    
    if (image) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: image.replace(/^data:image\/\w+;base64,/, '')
        }
      });
    }

    const result = await model.generateContent({ contents: [{ parts }] });
    const response = result.response.text();

    return res.json({
      mode: 'serius',
      response: response,
      metadata: { panjangCode: response.length }
    });
  } catch (e) {
    // Fallback ke Groq
    try {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const gen = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8192, temperature: 0.3
      });
      return res.json({ mode: 'serius', response: gen.choices[0].message.content });
    } catch (e2) {
      return res.json({ mode: 'serius', response: 'Gagal generate kode.' });
    }
  }
}

// ============================================================
// MODE DETEKTIF — Vision + Investigasi
// ============================================================
async function handleDetektif(message, image, res) {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const parts = [{
      text: `Kamu detektif digital. ${message ? 'Pertanyaan: ' + message : ''} 
      
Tugasmu:
1. Analisis gambar (jika ada) — deteksi objek, lokasi, metadata visual, kemungkinan tempat/kejadian
2. Cari informasi terkait dari pengetahuanmu
3. Berikan kesimpulan investigasi
4. Jika diminta cari orang/jejak digital, berikan langkah-langkah pelacakan
5. Format laporan yang rapi`
    }];

    if (image) {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: image.replace(/^data:image\/\w+;base64,/, '')
        }
      });
    }

    const result = await model.generateContent({ contents: [{ parts }] });
    return res.json({ mode: 'detektif', response: result.response.text() });
  } catch (e) {
    return res.json({ mode: 'detektif', response: 'Investigasi gagal: ' + e.message });
  }
}

// ============================================================
// MODE SCRAPER — Cari web + gabung HTML
// ============================================================
async function handleScraper(message, res) {
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    // Minta Groq buat HTML yang berisi hasil pencarian
    const prompt = `Buatkan 1 file HTML LENGKAP yang berisi:
1. Hasil pencarian untuk: "${message}"
2. Format seperti halaman hasil pencarian
3. Cantumkan sumber, link, dan ringkasan
4. Desain RAPI dan modern dengan CSS inline
5. SEMUA KODE HARUS LENGKAP, jangan dipotong

OUTPUT KODE HTML SAJA.`;

    const gen = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192, temperature: 0.3
    });

    const code = extractCode(gen.choices[0].message.content);
    return res.json({ mode: 'scraper', response: code || gen.choices[0].message.content });
  } catch (e) {
    return res.json({ mode: 'scraper', response: 'Gagal scraping.' });
  }
}
