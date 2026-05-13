// ============================================================
// RHF ZERO — api/chat.js
// 5 AI Mode — Groq | Gemini | DeepSeek | OpenRouter | Baseten
// Fail-Safe: 1 mati → lanjut → tidak crash
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Pesan kosong' });

  const results = [];

  // ============================================================
  // Helper: OpenAI client dengan explicit apiKey
  // ============================================================
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
    results.push('❌ Groq: ' + e.message.substring(0, 50));
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
    results.push('❌ Gemini: ' + e.message.substring(0, 50));
  }

  // ============================================================
  // AI #3: DEEPSEEK (Direct)
  // ============================================================
  try {
    const ds = await getOpenAI('https://api.deepseek.com/v1', process.env.DEEPSEEK_API_KEY);
    await ds.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 5
    });
    results.push('✅ DeepSeek');
  } catch (e) {
    results.push('❌ DeepSeek: ' + e.message.substring(0, 50));
  }

  // ============================================================
  // AI #4: OPENROUTER (Mistral)
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
    results.push('❌ OpenRouter-Mistral: ' + e.message.substring(0, 50));
  }

  // ============================================================
  // AI #5: BASETEN (Nemotron Super)
  // ============================================================
  try {
    const bt = await getOpenAI('https://api.baseten.co/v1', process.env.BASETEN_API_KEY);
    await bt.chat.completions.create({
      model: 'nvidia/llama-3.3-nemotron-super-49b-v1',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 5
    });
    results.push('✅ Baseten-Nemotron');
  } catch (e) {
    results.push('❌ Baseten-Nemotron: ' + e.message.substring(0, 50));
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
