// ============================================================
// RHF ZERO — api/vision.js
// Gemini Vision — Lihat & Pahami Gambar
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';

const geminiAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const visionModel = geminiAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, prompt } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'Gambar tidak ditemukan' });
  }

  try {
    const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    const userPrompt = prompt || 'Jelaskan gambar ini secara detail. Apa yang kamu lihat? Sebutkan semua objek, warna, posisi, suasana, dan detail penting.';

    const result = await visionModel.generateContent([
      { text: userPrompt },
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      },
    ]);

    const response = result.response.text();

    res.json({
      success: true,
      response: response,
      mimeType: mimeType,
    });
  } catch (error) {
    console.error('Vision error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
