// ============================================================
// RHF ZERO — api/reader.js
// Universal File Reader — Baca semua jenis file
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';

const geminiAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const visionModel = geminiAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { content, fileName, fileType, isBase64 } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Konten file kosong' });
  }

  try {
    let result;

    // Gambar → Vision
    if (fileType && fileType.startsWith('image/')) {
      result = await readImage(content, fileType);
    }
    // PDF/DOCX/XLSX → sudah dalam bentuk teks dari frontend
    else if (fileName && /\.(pdf|docx|xlsx|pptx)$/i.test(fileName)) {
      result = await analyzeDocument(content, fileName);
    }
    // Kode → analisis
    else if (fileName && /\.(js|ts|py|html|css|php|java|go|rs|cpp|c|rb|swift|sql)$/i.test(fileName)) {
      result = await analyzeCode(content, fileName);
    }
    // JSON/CSV/XML → analisis data
    else if (fileName && /\.(json|csv|xml|yaml|yml|toml)$/i.test(fileName)) {
      result = await analyzeData(content, fileName);
    }
    // Teks umum
    else {
      result = await analyzeText(content, fileName);
    }

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Reader error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

async function readImage(base64, mimeType) {
  const mimeMatch = base64.match(/^data:(image\/\w+);base64,/);
  const mime = mimeMatch ? mimeMatch[1] : mimeType || 'image/png';
  const data = base64.replace(/^data:image\/\w+;base64,/, '');

  const result = await visionModel.generateContent([
    { text: 'Jelaskan gambar ini secara detail. Sebutkan semua objek, warna, bentuk, posisi, teks (jika ada), suasana, dan detail penting lainnya.' },
    { inlineData: { mimeType: mime, data } },
  ]);

  return {
    type: 'image',
    fileName: 'gambar',
    analysis: result.response.text(),
  };
}

async function analyzeDocument(text, fileName) {
  const model = geminiAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Analisis dokumen berikut (${fileName}). Berikan ringkasan, poin-poin penting, dan insight utama.

DOKUMEN:
${text.substring(0, 30000)}`;

  const result = await model.generateContent(prompt);

  return {
    type: 'document',
    fileName,
    analysis: result.response.text(),
    originalLength: text.length,
  };
}

async function analyzeCode(code, fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const model = geminiAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Analisis kode ${ext.toUpperCase()} berikut. Berikan:
1. Ringkasan fungsi kode
2. Struktur utama
3. Potensi bug atau masalah
4. Saran perbaikan

KODE:
${code.substring(0, 20000)}`;

  const result = await model.generateContent(prompt);

  return {
    type: 'code',
    fileName,
    language: ext,
    analysis: result.response.text(),
    codeLength: code.length,
  };
}

async function analyzeData(content, fileName) {
  const ext = fileName.split('.').pop().toLowerCase();
  const model = geminiAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Analisis data ${ext.toUpperCase()} berikut. Berikan:
1. Struktur data
2. Jumlah entri/keys
3. Insight dari data
4. Anomali (jika ada)

DATA:
${content.substring(0, 15000)}`;

  const result = await model.generateContent(prompt);

  return {
    type: 'data',
    fileName,
    format: ext,
    analysis: result.response.text(),
  };
}

async function analyzeText(text, fileName) {
  const model = geminiAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Analisis teks berikut. Berikan ringkasan dan poin utama.

TEKS:
${text.substring(0, 20000)}`;

  const result = await model.generateContent(prompt);

  return {
    type: 'text',
    fileName,
    analysis: result.response.text(),
    textLength: text.length,
  };
}
