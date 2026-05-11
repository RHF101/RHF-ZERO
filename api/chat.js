import { Groq } from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Pesan kosong' });
  }

  try {
    // Timeout 8 detik (Vercel max 10)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Kamu RHF ZERO. Jawab SINGKAT, 1-2 kalimat SAJA.' },
        { role: 'user', content: message }
      ],
      max_tokens: 100,
      temperature: 0.7
    }, { signal: controller.signal });

    clearTimeout(timeout);

    return res.json({
      mode: 'santai',
      response: completion.choices[0].message.content
    });
  } catch (error) {
    // Selalu kembalikan JSON, jangan HTML error
    return res.json({
      mode: 'santai',
      response: 'Halo! Maaf, ada gangguan. Coba lagi ya 🙏'
    });
  }
}
