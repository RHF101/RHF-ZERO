import { Groq } from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// Init clients
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const geminiAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const gemini = geminiAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// OpenAI-compatible clients
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

const together = new OpenAI({
  baseURL: 'https://api.together.xyz/v1',
  apiKey: process.env.TOGETHER_API_KEY,
});

const fireworks = new OpenAI({
  baseURL: 'https://api.fireworks.ai/inference/v1',
  apiKey: process.env.FIREWORKS_API_KEY,
});

const deepinfra = new OpenAI({
  baseURL: 'https://api.deepinfra.com/v1/openai',
  apiKey: process.env.DEEPINFRA_API_KEY,
});

const cerebras = new OpenAI({
  baseURL: 'https://api.cerebras.ai/v1',
  apiKey: process.env.CEREBRAS_API_KEY,
});

const mistral = new OpenAI({
  baseURL: 'https://api.mistral.ai/v1',
  apiKey: process.env.MISTRAL_API_KEY,
});

const nvidia = new OpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: process.env.NVIDIA_API_KEY,
});

// Cloudflare
async function callCloudflare(prompt) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID || 'skipped'}/ai/run/@cf/meta/llama-3-8b-instruct`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CLOUDFLARE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
    }
  );
  const data = await res.json();
  return data.result?.response || 'Cloudflare error';
}

// ============================================================
// DETEKTOR INTENT
// ============================================================
function detectIntent(msg) {
  const codeWords = ['buat', 'kode', 'coding', 'fungsi', 'program', 'aplikasi', 'tulis', 'fix', 'debug', 'script', '.js', '.py', '.ts', 'implementasi', 'server', 'api', 'route'];
  const match = codeWords.filter(w => msg.toLowerCase().includes(w)).length;
  return match >= 2 ? 'serius' : 'santai';
}

// ============================================================
// HANDLER
// ============================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, sessionId } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Pesan kosong' });
  }

  const intent = detectIntent(message);

  try {
    if (intent === 'santai') {
      // Mode Santai: Groq cepat, jawab singkat
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Kamu teman ngobrol. Jawab SINGKAT, natural, 1-3 kalimat max. Jangan panjang-panjang.' },
          { role: 'user', content: message },
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      return res.json({
        mode: 'santai',
        response: completion.choices[0].message.content,
        provider: 'Groq',
        sessionId: sessionId || '',
      });
    }

    // Mode Serius: 10 AI paralel
    const prompt = `Kamu AI coding expert. Tulis kode untuk: ${message}. Maks 500 baris. Format rapi.`;

    const [groqRes, geminiRes, togetherRes, fireworksRes, cerebrasRes, mistralRes] = await Promise.allSettled([
      groq.chat.completions.create({ model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], max_tokens: 4096 }),
      gemini.generateContent(prompt),
      together.chat.completions.create({ model: 'mistralai/Mixtral-8x22B-Instruct-v0.1', messages: [{ role: 'user', content: prompt }], max_tokens: 4096 }),
      fireworks.chat.completions.create({ model: 'accounts/fireworks/models/llama-v3p3-70b-instruct', messages: [{ role: 'user', content: prompt }], max_tokens: 4096 }),
      cerebras.chat.completions.create({ model: 'llama3.3-70b', messages: [{ role: 'user', content: prompt }], max_tokens: 4096 }),
      mistral.chat.completions.create({ model: 'mistral-large-latest', messages: [{ role: 'user', content: prompt }], max_tokens: 4096 }),
    ]);

    const responses = [
      groqRes.status === 'fulfilled' ? groqRes.value.choices[0].message.content : 'Groq gagal',
      geminiRes.status === 'fulfilled' ? geminiRes.value.response.text() : 'Gemini gagal',
      togetherRes.status === 'fulfilled' ? togetherRes.value.choices[0].message.content : 'Together gagal',
      fireworksRes.status === 'fulfilled' ? fireworksRes.value.choices[0].message.content : 'Fireworks gagal',
      cerebrasRes.status === 'fulfilled' ? cerebrasRes.value.choices[0].message.content : 'Cerebras gagal',
      mistralRes.status === 'fulfilled' ? mistralRes.value.choices[0].message.content : 'Mistral gagal',
    ];

    // Pilih respons terbaik (paling panjang & lengkap)
    const best = responses
      .filter(r => !r.includes('gagal'))
      .sort((a, b) => b.length - a.length)[0] || responses[0];

    return res.json({
      mode: 'serius',
      response: best,
      providersCalled: 6,
      totalResponses: responses.filter(r => !r.includes('gagal')).length,
      sessionId: sessionId || '',
    });
  } catch (error) {
    return res.status(500).json({
      mode: 'error',
      response: 'Maaf, terjadi kesalahan: ' + error.message,
      sessionId: sessionId || '',
    });
  }
      }
