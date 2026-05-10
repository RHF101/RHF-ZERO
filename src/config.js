// ============================================================
// AI RAKSASA — Konfigurasi Utama
// Constants + API Keys + Models
// ============================================================

import 'dotenv/config';

// ============================================================
// KONSTANTA
// ============================================================

export const CONFIG = {
  // Ukuran potongan kode
  CHUNK_SIZE: 500,
  OVERLAP_SIZE: 30,
  MIN_CHUNK: 450,
  MAX_CHUNK: 550,

  // Token limits per AI type
  MAX_OUTPUT_TOKENS_FAST: 4096,
  MAX_OUTPUT_TOKENS_REVIEW: 4096,
  MAX_OUTPUT_TOKENS_FINAL: 8192,

  // Retry
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,

  // Mode
  MODE_SANTAI: 'santai',
  MODE_SERIUS: 'serius',

  // Timeout (ms)
  API_TIMEOUT: 120000,
  ASSEMBLY_TIMEOUT: 180000,

  // Max input
  MAX_INPUT_LENGTH: 50000,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB

  // Download
  DOWNLOAD_EXPIRY_MS: 3600000, // 1 jam

  // Vector memory
  VECTOR_DIMENSIONS: 768,
  MAX_MEMORY_RESULTS: 20,
};

// ============================================================
// API KEYS (dari environment variables)
// ============================================================

export const API_KEYS = {
  // 10 AI Provider
  GROQ: process.env.GROQ_API_KEY || '',
  GEMINI: process.env.GEMINI_API_KEY || '',
  DEEPSEEK: process.env.DEEPSEEK_API_KEY || '',
  MISTRAL: process.env.MISTRAL_API_KEY || '',
  CEREBRAS: process.env.CEREBRAS_API_KEY || '',
  TOGETHER: process.env.TOGETHER_API_KEY || '',
  FIREWORKS: process.env.FIREWORKS_API_KEY || '',
  TAVILY: process.env.TAVILY_API_KEY || '',
  NVIDIA: process.env.NVIDIA_API_KEY || '',
  CLOUDFLARE: process.env.CLOUDFLARE_API_KEY || '',
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',

  // Firebase
  FIREBASE_API_KEY: process.env.VITE_FIREBASE_API_KEY || '',
  FIREBASE_PROJECT_ID: process.env.VITE_FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',

  // Canva
  CANVA_PUBLIC_KEY: process.env.CANVA_PUBLIC_KEY || '',
  CANVA_KID: process.env.CANVA_KID || '',
};

// ============================================================
// MODEL LIST
// ============================================================

export const MODELS = {
  // Generate (Fase 1)
  GROQ: 'llama-3.3-70b-versatile',
  CEREBRAS: 'llama3.3-70b',
  TOGETHER: 'mistralai/Mixtral-8x22B-Instruct-v0.1',
  FIREWORKS: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
  MISTRAL: 'mistral-large-latest',

  // Review (Fase 2 & 3)
  GEMINI: 'gemini-2.5-pro-exp-03-25',
  DEEPSEEK: 'deepseek-chat',
  // MISTRAL sudah di atas, dipakai untuk review juga

  // Final Scan (Fase 5)
  NVIDIA: 'meta/llama-3.3-70b-instruct',
  CLOUDFLARE: '@cf/meta/llama-3.3-70b-instruct',
};

// ============================================================
// VALIDASI API KEYS SAAT STARTUP
// ============================================================

export function validateAPIKeys() {
  const required = [
    { key: 'GROQ', name: 'Groq Cloud' },
    { key: 'GEMINI', name: 'Google Gemini' },
    { key: 'DEEPSEEK', name: 'DeepSeek' },
    { key: 'MISTRAL', name: 'Mistral AI' },
  ];

  const optional = [
    { key: 'CEREBRAS', name: 'Cerebras' },
    { key: 'TOGETHER', name: 'Together AI' },
    { key: 'FIREWORKS', name: 'Fireworks AI' },
    { key: 'TAVILY', name: 'Tavily Search' },
    { key: 'NVIDIA', name: 'NVIDIA NIM' },
    { key: 'CLOUDFLARE', name: 'Cloudflare Workers AI' },
  ];

  const errors = [];
  const warnings = [];

  for (const { key, name } of required) {
    if (!API_KEYS[key]) {
      errors.push(`❌ ${name} (${key}) — WAJIB diisi`);
    }
  }

  for (const { key, name } of optional) {
    if (!API_KEYS[key]) {
      warnings.push(`⚠️  ${name} (${key}) — tidak diisi, fitur terkait akan dinonaktifkan`);
    }
  }

  // Firebase
  if (!API_KEYS.FIREBASE_PROJECT_ID) {
    warnings.push('⚠️  Firebase — tidak diisi, memori tidak akan tersimpan');
  }

  return { errors, warnings };
}

// ============================================================
// CEK AVAILABILITY
// ============================================================

export function isProviderAvailable(provider) {
  const key = API_KEYS[provider.toUpperCase()];
  return key && key.length > 10;
}

export function getAvailableProviders() {
  const providers = [];
  
  if (isProviderAvailable('groq')) providers.push('groq');
  if (isProviderAvailable('gemini')) providers.push('gemini');
  if (isProviderAvailable('deepseek')) providers.push('deepseek');
  if (isProviderAvailable('mistral')) providers.push('mistral');
  if (isProviderAvailable('cerebras')) providers.push('cerebras');
  if (isProviderAvailable('together')) providers.push('together');
  if (isProviderAvailable('fireworks')) providers.push('fireworks');
  if (isProviderAvailable('tavily')) providers.push('tavily');
  if (isProviderAvailable('nvidia')) providers.push('nvidia');
  if (isProviderAvailable('cloudflare')) providers.push('cloudflare');
  
  return providers;
}

// ============================================================
// LOG SAAT STARTUP
// ============================================================

const validation = validateAPIKeys();

if (validation.errors.length > 0) {
  console.error('\n❌ KONFIGURASI ERROR:');
  validation.errors.forEach(e => console.error('  ' + e));
  console.error('');
}

if (validation.warnings.length > 0) {
  console.warn('\n⚠️  KONFIGURASI WARNING:');
  validation.warnings.forEach(w => console.warn('  ' + w));
  console.warn('');
}

const available = getAvailableProviders();
console.log('✅ Provider tersedia:', available.length + '/10');
console.log('   ' + available.join(', '));
console.log('');
