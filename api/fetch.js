// ============================================================
// RHF ZERO — api/fetch.js
// Baca URL — Fetch & Analisis halaman web
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';

const geminiAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = geminiAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL tidak ditemukan' });
  }

  // Pastikan URL lengkap
  let fullUrl = url.trim();
  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
    fullUrl = 'https://' + fullUrl;
  }

  try {
    // Fetch halaman
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'RHF-ZERO/1.0 (AI Assistant)',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return res.status(422).json({
        success: false,
        error: 'Gagal fetch URL: ' + response.status + ' ' + response.statusText,
      });
    }

    const html = await response.text();

    // Ekstrak teks dari HTML (sederhana)
    const text = extractText(html);

    if (!text || text.length < 10) {
      return res.json({
        success: true,
        url: fullUrl,
        analysis: 'Halaman ini tidak memiliki cukup konten teks untuk dianalisis. Mungkin halaman kosong atau hanya berisi gambar/script.',
        textLength: text.length,
      });
    }

    // Analisis dengan Gemini
    const prompt = `Analisis halaman web berikut. Berikan:
1. Judul atau topik utama
2. Ringkasan isi (3-5 kalimat)
3. Poin-poin penting
4. Jenis konten (artikel, dokumentasi, berita, dll)

URL: ${fullUrl}

KONTEN:
${text.substring(0, 15000)}`;

    const result = await model.generateContent(prompt);
    const analysis = result.response.text();

    res.json({
      success: true,
      url: fullUrl,
      analysis: analysis,
      textLength: text.length,
    });
  } catch (error) {
    console.error('Fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

// Ekstrak teks dari HTML
function extractText(html) {
  // Hapus script, style, dan tag HTML
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  return text.substring(0, 20000);
}
