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
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Kamu RHF ZERO. Jawab singkat natural 1-3 kalimat.' },
        { role: 'user', content: message }
      ],
      max_tokens: 200
    });

    return res.json({
      mode: 'santai',
      response: completion.choices[0].message.content
    });
  } catch (error) {
    return res.json({
      mode: 'santai',
      response: 'Halo! Ada yang bisa aku bantu?',
      error: error.message
    });
  }
}
