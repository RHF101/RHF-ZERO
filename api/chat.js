// ============================================================
// RHF ZERO — api/chat.js
// 5 AI Test — Groq | Gemini | OpenRouter | Cerebras | HuggingFace
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Pesan kosong' });

  const results = [];

  async function getOpenAI(baseURL, apiKey) {
    const { default: OpenAI } = await import('openai');
    return new OpenAI({ baseURL, apiKey });
  }

  // ============================================================
  // AI #1: GROQ
  // ============================================================
  try {
    const { Groq } = await import('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 5
    });
    results.push('✅ Groq');
  } catch (e) {
    results.push('❌ Groq: ' + e.message.substring(0, 40));
  }

  // ============================================================
  // AI #2: GEMINI
  // ============================================================
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
    await model.generateContent({ contents: [{ parts: [{ text: 'OK' }] }] });
    results.push('✅ Gemini');
  } catch (e) {
    results.push('❌ Gemini: ' + e.message.substring(0, 40));
  }

  // ============================================================
  // AI #3: OPENROUTER (Mistral)
  // ============================================================
  try {
    const or = await getOpenAI('https://openrouter.ai/api/v1', process.env.OPENROUTER_API_KEY);
    await or.chat.completions.create({
      model: 'mistralai/mistral-large',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 5
    });
    results.push('✅ OpenRouter-Mistral');
  } catch (e) {
    results.push('❌ OpenRouter-Mistral: ' + e.message.substring(0, 40));
  }

  // ============================================================
  // AI #4: CEREBRAS
  // ============================================================
  try {
    const cb = await getOpenAI('https://api.cerebras.ai/v1', process.env.CEREBRAS_API_KEY);
    await cb.chat.completions.create({
      model: 'llama3.3-70b',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 5
    });
    results.push('✅ Cerebras');
  } catch (e) {
    results.push('❌ Cerebras: ' + e.message.substring(0, 40));
  }

  // ============================================================
  // AI #5: HUGGING FACE
  // ============================================================
  try {
    const hf = await getOpenAI('https://api-inference.huggingface.co/v1', process.env.HF_API_KEY);
    await hf.chat.completions.create({
      model: 'mistralai/Mistral-7B-Instruct-v0.3',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 5
    });
    results.push('✅ HuggingFace');
  } catch (e) {
    results.push('❌ HuggingFace: ' + e.message.substring(0, 40));
  }

  // ============================================================
  // HASIL
  // ============================================================
  const hidup = results.filter(r => r.startsWith('✅')).length;
  const mati = results.filter(r => r.startsWith('❌')).length;

  return res.json({
    mode: 'test',
    response: '📊 STATUS 5 AI RHF ZERO\n\n' + results.join('\n') + '\n\n✅ Hidup: ' + hidup + '/5\n❌ Mati: ' + mati + '/5',
  });
}
