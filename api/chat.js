// ============================================================
// RHF ZERO — api/chat.js
// SEMUA IMPORT DI ATAS — TIDAK ADA DYNAMIC IMPORT
// ============================================================

import { Groq } from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// ============================================================
// CLIENTS (Langsung init, pakai try-catch)
// ============================================================

let groq = null;
let geminiModel = null;
let openrouter = null;

try { groq = new Groq({ apiKey: process.env.GROQ_API_KEY }); } catch(e) {}
try {
  const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  geminiModel = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
} catch(e) {}
try {
  openrouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  });
} catch(e) {}

// ============================================================
// HELPER
// ============================================================
function extractCode(text) {
  if (!text) return '';
  const match = text.match(/```[\w]*\n([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

// ============================================================
// MAIN HANDLER
// ============================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, mode, image } = req.body;
  if (!message && !image) return res.status(400).json({ error: 'Pesan kosong' });

  try {
    if (mode === 'serius') return await handleSerius(message, image, res);
    if (mode === 'detektif') return await handleDetektif(message, image, res);
    if (mode === 'scraper') return await handleScraper(message, res);
    return await handleSantai(message, res);
  } catch (error) {
    return res.status(500).json({ mode: 'error', response: 'Terjadi kesalahan.' });
  }
}

// ============================================================
// MODE SANTAI
// ============================================================
async function handleSantai(message, res) {
  if (!groq) return res.json({ mode: 'santai', response: 'Halo! Sistem sedang sibuk.' });
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Kamu RHF ZERO. Jawab natural, informatif.' },
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
// MODE SERIUS
// ============================================================
async function handleSerius(message, image, res) {
  let prompt = `Kamu coding expert. Tulis kode LENGKAP untuk: "${message}". Output SEMUA kode, jangan dipotong. Format RAPI.`;

  // Coba Gemini dulu (paling lengkap)
  if (geminiModel) {
    try {
      const parts = [{ text: prompt }];
      if (image) {
        parts.push({ inlineData: { mimeType: 'image/png', data: image.replace(/^data:image\/\w+;base64,/, '') } });
      }
      const result = await geminiModel.generateContent({ contents: [{ parts }] });
      return res.json({ mode: 'serius', response: result.response.text() });
    } catch (e) {}
  }

  // Fallback Groq
  if (groq) {
    try {
      const gen = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8192, temperature: 0.3
      });
      return res.json({ mode: 'serius', response: gen.choices[0].message.content });
    } catch (e) {}
  }

  return res.json({ mode: 'serius', response: 'Gagal generate kode.' });
}

// ============================================================
// MODE DETEKTIF
// ============================================================
async function handleDetektif(message, image, res) {
  if (!geminiModel) return res.json({ mode: 'detektif', response: 'Mode detektif butuh Gemini.' });
  try {
    const parts = [{
      text: `Kamu detektif digital. ${message || 'Analisis gambar ini.'} 
1. Analisis gambar — objek, lokasi, metadata visual
2. Berikan kesimpulan investigasi
3. Format laporan rapi`
    }];
    if (image) {
      parts.push({ inlineData: { mimeType: 'image/png', data: image.replace(/^data:image\/\w+;base64,/, '') } });
    }
    const result = await geminiModel.generateContent({ contents: [{ parts }] });
    return res.json({ mode: 'detektif', response: result.response.text() });
  } catch (e) {
    return res.json({ mode: 'detektif', response: 'Investigasi gagal.' });
  }
}

// ============================================================
// MODE SCRAPER
// ============================================================
async function handleScraper(message, res) {
  if (!groq) return res.json({ mode: 'scraper', response: 'Mode scraper butuh Groq.' });
  try {
    const prompt = `Buatkan 1 file HTML LENGKAP berisi hasil pencarian untuk: "${message}". Format seperti search engine. Ada sumber, link, ringkasan. Desain modern CSS inline. KODE LENGKAP.`;
    const gen = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192, temperature: 0.3
    });
    const code = extractCode(gen.choices[0].message.content);
    return res.json({ mode: 'scraper', response: code || gen.choices[0].message.content });
  } catch (e) {
    return res.json({ mode: 'scraper', response: 'Scraping gagal.' });
  }
}
