export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Pesan kosong' });

  const results = [];

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
  // AI #2: GEMINI — perbaiki format request
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
  // Helper: buat OpenAI client dengan explicit apiKey
  // ============================================================
  async function getOpenAI(baseURL, apiKey) {
    const { default: OpenAI } = await import('openai');
    return new OpenAI({ baseURL, apiKey });
  }

  // ============================================================
  // AI #3: OPENROUTER DeepSeek — explicit apiKey
  // ============================================================
  try {
    const or = await getOpenAI('https://openrouter.ai/api/v1', process.env.OPENROUTER_API_KEY);
    await or.chat.completions.create({
      model: 'deepseek/deepseek-chat',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 5
    });
    results.push('✅ OpenRouter-DeepSeek');
  } catch (e) {
    results.push('❌ OpenRouter-DeepSeek: ' + e.message.substring(0, 50));
  }

  // ============================================================
  // AI #4: OPENROUTER Mistral
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
  // AI #5: TOGETHER AI — ganti model
  // ============================================================
  try {
    const t = await getOpenAI('https://api.together.xyz/v1', process.env.TOGETHER_API_KEY);
    await t.chat.completions.create({
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 5
    });
    results.push('✅ Together AI');
  } catch (e) {
    results.push('❌ Together AI: ' + e.message.substring(0, 50));
  }

  // ============================================================
  // AI #6: FIREWORKS
  // ============================================================
  try {
    const fw = await getOpenAI('https://api.fireworks.ai/inference/v1', process.env.FIREWORKS_API_KEY);
    await fw.chat.completions.create({
      model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 5
    });
    results.push('✅ Fireworks');
  } catch (e) {
    results.push('❌ Fireworks: ' + e.message.substring(0, 50));
  }

  // ============================================================
  // AI #7: SAMBANOVA — explicit apiKey
  // ============================================================
  try {
    const sn = await getOpenAI('https://api.sambanova.ai/v1', process.env.SAMBANOVA_API_KEY);
    await sn.chat.completions.create({
      model: 'Meta-Llama-3.1-405B-Instruct',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 5
    });
    results.push('✅ SambaNova');
  } catch (e) {
    results.push('❌ SambaNova: ' + e.message.substring(0, 50));
  }

  // ============================================================
  // AI #8: CEREBRAS
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
    results.push('❌ Cerebras: ' + e.message.substring(0, 50));
  }

  // ============================================================
  // AI #9: NVIDIA NEMOTRON
  // ============================================================
  try {
    const nv = await getOpenAI('https://integrate.api.nvidia.com/v1', process.env.NVIDIA_API_KEY);
    await nv.chat.completions.create({
      model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 5
    });
    results.push('✅ NVIDIA Nemotron');
  } catch (e) {
    results.push('❌ NVIDIA Nemotron: ' + e.message.substring(0, 50));
  }

  // ============================================================
  // AI #10: CFG LABS — coba ganti baseURL
  // ============================================================
  try {
    const cfg = await getOpenAI('https://api.cfg.cfglabs.com/v1', process.env.CFG_LABS_KEY || '');
    await cfg.chat.completions.create({
      model: 'default',
      messages: [{ role: 'user', content: 'OK' }],
      max_tokens: 5
    });
    results.push('✅ CFG Labs');
  } catch (e) {
    results.push('❌ CFG Labs: ' + e.message.substring(0, 50));
  }

  // ============================================================
  // HASIL
  // ============================================================
  const hidup = results.filter(r => r.startsWith('✅')).length;
  const mati = results.filter(r => r.startsWith('❌')).length;

  return res.json({
    mode: 'test',
    response: '📊 STATUS AI RHF ZERO\n\n' + results.join('\n') + '\n\n✅ Hidup: ' + hidup + '/10\n❌ Mati: ' + mati + '/10',
  });
}
