// ============================================================
// RHF ZERO — api/chat.js
// FITUR INGATAN SUPER PANJANG + ANTI CRASH
// ============================================================

import { Groq } from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { saveMessage } from './memory.js';

// ============================================================
// INISIALISASI CLIENT (Try-Catch biar aman)
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
  openrouter = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY });
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
// MEMORY UTILS (Database Ingatan)
// ============================================================
async function getUserMemory(uid) {
  if (!uid) return [];
  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const { getApps, initializeApp, cert } = await import('firebase-admin/app');
    
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
      });
    }
    
    const db = getFirestore();
    const snapshot = await db.collection('user_memory').doc(uid).collection('facts').get();
    const facts = [];
    snapshot.forEach(doc => facts.push(doc.data().fact));
    return facts;
  } catch(e) { return []; }
}

async function saveUserMemory(uid, fact) {
  if (!uid || !fact) return;
  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const { getApps, initializeApp, cert } = await import('firebase-admin/app');
    
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
      });
    }
    
    const db = getFirestore();
    await db.collection('user_memory').doc(uid).collection('facts').add({ fact });
  } catch(e) {}
}

// ============================================================
// MAIN HANDLER
// ============================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, mode, image, uid, chatId } = req.body;
  if (!message && !image) return res.status(400).json({ error: 'Pesan kosong' });

  const currentChatId = chatId || 'chat_' + Date.now();

  if (uid) saveMessage(uid, currentChatId, 'user', message || '[Gambar]', mode || 'santai').catch(() => {});

  try {
    // ============================================================
    // 1. RECALL INGATAN: Ambil semua fakta tentang user
    // ============================================================
    const userFacts = await getUserMemory(uid);
    const memoryContext = userFacts.length > 0 
      ? '\n\n[INGATAN TENTANG PENGGUNA]\n' + userFacts.map(f => `- ${f}`).join('\n') + '\n[/INGATAN]\n'
      : '';

    let result;
    if (mode === 'serius') result = await handleSerius(message, image, memoryContext);
    else if (mode === 'detektif') result = await handleDetektif(message, image, memoryContext);
    else if (mode === 'scraper') result = await handleScraper(message, memoryContext);
    else result = await handleSantai(message, memoryContext);

    // ============================================================
    // 2. SIMPAN FAKTA OTOMATIS: AI cek apakah ada fakta baru
    // ============================================================
    if (uid) {
      saveMessage(uid, currentChatId, 'ai', result.response, mode || 'santai').catch(() => {});
      
      // Cek fakta baru menggunakan Gemini
      if (geminiModel) {
        try {
          const checkFact = await geminiModel.generateContent(
            `Dari percakapan ini, apakah ada FAKTA PENTING tentang user yang perlu diingat? (misal: nama, hobi, pekerjaan, project). Jika tidak ada, jawab "TIDAK". Jika ada, tulis faktanya dengan format "FAKTA: [isi fakta]".\n\nUser: ${message}\nAI: ${result.response}`
          );
          const factText = checkFact.response.text();
          if (factText.includes('FAKTA:')) {
            const fact = factText.split('FAKTA:')[1].split('\n')[0].trim();
            if (fact && fact.length > 3) {
              await saveUserMemory(uid, fact);
            }
          }
        } catch(e) {}
      }
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ mode: 'error', response: 'Terjadi kesalahan internal.' });
  }
}

// ============================================================
// MODE SANTAI (Dengan Ingatan Super Panjang)
// ============================================================
async function handleSantai(message, context) {
  if (!groq) return { mode: 'santai', response: 'Sistem sedang sibuk.' };
  try {
    const sysPrompt = `Kamu RHF ZERO, asisten pribadi yang setia. ${context}\n\nGunakan ingatan ini untuk personalisasi jawaban. Jawab natural dan informatif.`;
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 2000, temperature: 0.7
    });
    return { mode: 'santai', response: completion.choices[0].message.content };
  } catch (e) {
    return { mode: 'santai', response: 'Halo! Maaf, aku agak lupa. Bisa diulang?' };
  }
}

// ============================================================
// MODE SERIUS
// ============================================================
async function handleSerius(message, image, context) {
  let prompt = `${context}\n\nTulis kode LENGKAP untuk: "${message}". Output SEMUA, jangan dipotong.`;
  
  if (geminiModel) {
    try {
      const parts = [{ text: prompt }];
      if (image) parts.push({ inlineData: { mimeType: 'image/png', data: image.replace(/^data:image\/\w+;base64,/, '') } });
      const res = await geminiModel.generateContent({ contents: [{ parts }] });
      return { mode: 'serius', response: res.response.text() };
    } catch(e) {}
  }
  
  if (groq) {
    try {
      const gen = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 8192, temperature: 0.3
      });
      return { mode: 'serius', response: gen.choices[0].message.content };
    } catch(e) {}
  }
  
  return { mode: 'serius', response: 'Gagal generate kode.' };
}

// ============================================================
// MODE DETEKTIF
// ============================================================
async function handleDetektif(message, image, context) {
  if (!geminiModel) return { mode: 'detektif', response: 'Mode detektif butuh Gemini.' };
  try {
    const parts = [{ text: `Kamu detektif digital. ${context}\n\n${message || 'Analisis gambar ini.'}` }];
    if (image) parts.push({ inlineData: { mimeType: 'image/png', data: image.replace(/^data:image\/\w+;base64,/, '') } });
    const res = await geminiModel.generateContent({ contents: [{ parts }] });
    return { mode: 'detektif', response: res.response.text() };
  } catch (e) {
    return { mode: 'detektif', response: 'Gagal analisis.' };
  }
}

// ============================================================
// MODE SCRAPER
// ============================================================
async function handleScraper(message, context) {
  if (!groq) return { mode: 'scraper', response: 'Mode scraper butuh Groq.' };
  try {
    const prompt = `${context}\n\nBuatkan HTML LENGKAP hasil pencarian untuk: "${message}". Desain modern, ada sumber & ringkasan. Kode HARUS LENGKAP.`;
    const gen = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 8192, temperature: 0.3
    });
    const code = extractCode(gen.choices[0].message.content);
    return { mode: 'scraper', response: code || gen.choices[0].message.content };
  } catch (e) {
    return { mode: 'scraper', response: 'Gagal scraping.' };
  }
            }
