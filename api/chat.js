// ============================================================
// RHF ZERO — 10 AI Fail Safe
// Kalau satu mati → lanjut berikutnya → tidak crash
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Pesan kosong' });

  const results = [];
  const prompt = message;

  // ============================================================
  // AI #1: GROQ
  // ============================================================
  try {
    const { Groq } = await import('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const res = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Kamu RHF ZERO. Jawab SINGKAT 1-3 kalimat.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 200
    });
    results.push({ ai: 'Groq', status: '✅ HIDUP', response: res.choices[0].message.content });
  } catch (e) {
    results.push({ ai: 'Groq', status: '❌ MATI', error: e.message.substring(0, 60) });
  }

  // ============================================================
  // AI #2: GEMINI
  // ============================================================
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const geminiAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = geminiAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const res = await model.generateContent(prompt);
    results.push({ ai: 'Gemini', status: '✅ HIDUP', response: res.response.text().substring(0, 100) });
  } catch (e) {
    results.push({ ai: 'Gemini', status: '❌ MATI', error: e.message.substring(0, 60) });
  }

  // ============================================================
  // AI #3: OPENROUTER (DeepSeek)
  // ============================================================
  try {
    const { default: OpenAI } = await import('openai');
    const openrouter = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    const res = await openrouter.chat.completions.create({
      model: 'deepseek/deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200
    });
    results.push({ ai: 'OpenRouter-DeepSeek', status: '✅ HIDUP', response: res.choices[0].message.content });
  } catch (e) {
    results.push({ ai: 'OpenRouter-DeepSeek', status: '❌ MATI', error: e.message.substring(0, 60) });
  }

  // ============================================================
  // AI #4: OPENROUTER (Mistral)
  // ============================================================
  try {
    const { default: OpenAI } = await import('openai');
    const openrouter = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
    });
    const res = await openrouter.chat.completions.create({
      model: 'mistralai/mistral-large',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200
    });
    results.push({ ai: 'OpenRouter-Mistral', status: '✅ HIDUP', response: res.choices[0].message.content });
  } catch (e) {
    results.push({ ai: 'OpenRouter-Mistral', status: '❌ MATI', error: e.message.substring(0, 60) });
  }

  // ============================================================
  // AI #5: TOGETHER AI
  // ============================================================
  try {
    const { default: OpenAI } = await import('openai');
    const together = new OpenAI({
      baseURL: 'https://api.together.xyz/v1',
      apiKey: process.env.TOGETHER_API_KEY,
    });
    const res = await together.chat.completions.create({
      model: 'mistralai/Mixtral-8x22B-Instruct-v0.1',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200
    });
    results.push({ ai: 'Together AI', status: '✅ HIDUP', response: res.choices[0].message.content });
  } catch (e) {
    results.push({ ai: 'Together AI', status: '❌ MATI', error: e.message.substring(0, 60) });
  }

  // ============================================================
  // AI #6: FIREWORKS
  // ============================================================
  try {
    const { default: OpenAI } = await import('openai');
    const fireworks = new OpenAI({
      baseURL: 'https://api.fireworks.ai/inference/v1',
      apiKey: process.env.FIREWORKS_API_KEY,
    });
    const res = await fireworks.chat.completions.create({
      model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200
    });
    results.push({ ai: 'Fireworks', status: '✅ HIDUP', response: res.choices[0].message.content });
  } catch (e) {
    results.push({ ai: 'Fireworks', status: '❌ MATI', error: e.message.substring(0, 60) });
  }

  // ============================================================
  // AI #7: SAMBANOVA
  // ============================================================
  try {
    const { default: OpenAI } = await import('openai');
    const sambanova = new OpenAI({
      baseURL: 'https://api.sambanova.ai/v1',
      apiKey: process.env.SAMBANOVA_API_KEY,
    });
    const res = await sambanova.chat.completions.create({
      model: 'Meta-Llama-3.1-405B-Instruct',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200
    });
    results.push({ ai: 'SambaNova', status: '✅ HIDUP', response: res.choices[0].message.content });
  } catch (e) {
    results.push({ ai: 'SambaNova', status: '❌ MATI', error: e.message.substring(0, 60) });
  }

  // ============================================================
  // AI #8: CEREBRAS
  // ============================================================
  try {
    const { default: OpenAI } = await import('openai');
    const cerebras = new OpenAI({
      baseURL: 'https://api.cerebras.ai/v1',
      apiKey: process.env.CEREBRAS_API_KEY,
    });
    const res = await cerebras.chat.completions.create({
      model: 'llama3.3-70b',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200
    });
    results.push({ ai: 'Cerebras', status: '✅ HIDUP', response: res.choices[0].message.content });
  } catch (e) {
    results.push({ ai: 'Cerebras', status: '❌ MATI', error: e.message.substring(0, 60) });
  }

  // ============================================================
  // AI #9: NVIDIA NIM
  // ============================================================
  try {
    const { default: OpenAI } = await import('openai');
    const nvidia = new OpenAI({
      baseURL: 'https://integrate.api.nvidia.com/v1',
      apiKey: process.env.NVIDIA_API_KEY,
    });
    const res = await nvidia.chat.completions.create({
      model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200
    });
    results.push({ ai: 'NVIDIA Nemotron', status: '✅ HIDUP', response: res.choices[0].message.content });
  } catch (e) {
    results.push({ ai: 'NVIDIA Nemotron', status: '❌ MATI', error: e.message.substring(0, 60) });
  }

  // ============================================================
  // AI #10: CFG LABS
  // ============================================================
  try {
    const { default: OpenAI } = await import('openai');
    const cfglabs = new OpenAI({
      baseURL: 'https://api.cfg.cfglabs.com/v1',
      apiKey: process.env.CFG_LABS_KEY || '',
    });
    const res = await cfglabs.chat.completions.create({
      model: 'default',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200
    });
    results.push({ ai: 'CFG Labs', status: '✅ HIDUP', response: res.choices[0].message.content });
  } catch (e) {
    results.push({ ai: 'CFG Labs', status: '❌ MATI', error: e.message.substring(0, 60) });
  }

  // ============================================================
  // HASIL
  // ============================================================
  const hidup = results.filter(r => r.status.includes('HIDUP'));
  const mati = results.filter(r => r.status.includes('MATI'));

  return res.json({
    mode: 'test',
    totalAI: results.length,
    hidup: hidup.length,
    mati: mati.length,
    daftarHidup: hidup.map(r => r.ai),
    daftarMati: mati.map(r => ({ ai: r.ai, error: r.error })),
    response: hidup.length > 0 ? hidup[0].response : 'Semua AI mati',
    semua: results,
  });
      }
