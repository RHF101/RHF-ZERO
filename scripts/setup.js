// ============================================================
// AI RAKSASA — Setup Script
// Setup env + test semua API + deploy check
// Jalankan: node scripts/setup.js
// ============================================================

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

console.log('⚡ AI RAKSASA — Setup Script\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ============================================================
// STEP 1: CEK .env.local
// ============================================================

console.log('📋 STEP 1: Memeriksa .env.local...\n');

const REQUIRED_VARS = [
  'GROQ_API_KEY',
  'GEMINI_API_KEY',
  'DEEPSEEK_API_KEY',
  'MISTRAL_API_KEY',
  'CEREBRAS_API_KEY',
  'TOGETHER_API_KEY',
  'FIREWORKS_API_KEY',
  'TAVILY_API_KEY',
  'NVIDIA_API_KEY',
  'CLOUDFLARE_API_KEY',
  'CLOUDFLARE_ACCOUNT_ID',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
];

let envVars = {};

if (existsSync('.env.local')) {
  const envContent = readFileSync('.env.local', 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length > 0) {
      envVars[key.trim()] = rest.join('=').trim();
    }
  });
  console.log('   ✅ .env.local ditemukan\n');
} else if (existsSync('.env.example')) {
  console.log('   ⚠️  .env.local tidak ditemukan');
  console.log('   📝 Membuat dari .env.example...');
  const example = readFileSync('.env.example', 'utf-8');
  writeFileSync('.env.local', example);
  console.log('   ✅ .env.local dibuat. Silakan isi API key lalu jalankan ulang.\n');
  process.exit(0);
} else {
  console.log('   ❌ .env.example tidak ditemukan. Pastikan file tersedia.\n');
  process.exit(1);
}

// ============================================================
// STEP 2: VALIDASI ENV
// ============================================================

console.log('🔑 STEP 2: Memvalidasi environment variables...\n');

let missingVars = [];
let emptyVars = [];

REQUIRED_VARS.forEach(varName => {
  if (!(varName in envVars)) {
    missingVars.push(varName);
  } else if (!envVars[varName] || envVars[varName] === '') {
    emptyVars.push(varName);
  }
});

if (missingVars.length > 0) {
  console.log(`   ❌ Variabel tidak ditemukan (${missingVars.length}):`);
  missingVars.forEach(v => console.log(`      - ${v}`));
}

if (emptyVars.length > 0) {
  console.log(`   ⚠️  Variabel kosong (${emptyVars.length}):`);
  emptyVars.forEach(v => console.log(`      - ${v}`));
}

if (missingVars.length === 0 && emptyVars.length === 0) {
  console.log('   ✅ Semua 15 environment variables terisi!\n');
} else {
  console.log('\n   ❌ Lengkapi semua variabel di .env.local lalu jalankan ulang.\n');
  process.exit(1);
}

// ============================================================
// STEP 3: TEST KONEKSI API
// ============================================================

console.log('🌐 STEP 3: Menguji koneksi API...\n');

const API_TESTS = [
  {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/models',
    headers: { 'Authorization': `Bearer ${envVars.GROQ_API_KEY}` },
    okStatus: 200,
  },
  {
    name: 'Gemini',
    url: `https://generativelanguage.googleapis.com/v1beta/models?key=${envVars.GEMINI_API_KEY}`,
    headers: {},
    okStatus: 200,
  },
  {
    name: 'DeepSeek',
    url: 'https://api.deepseek.com/v1/models',
    headers: { 'Authorization': `Bearer ${envVars.DEEPSEEK_API_KEY}` },
    okStatus: 200,
  },
  {
    name: 'Mistral',
    url: 'https://api.mistral.ai/v1/models',
    headers: { 'Authorization': `Bearer ${envVars.MISTRAL_API_KEY}` },
    okStatus: 200,
  },
  {
    name: 'Together AI',
    url: 'https://api.together.xyz/v1/models',
    headers: { 'Authorization': `Bearer ${envVars.TOGETHER_API_KEY}` },
    okStatus: 200,
  },
  {
    name: 'Cerebras',
    url: 'https://api.cerebras.ai/v1/models',
    headers: { 'Authorization': `Bearer ${envVars.CEREBRAS_API_KEY}` },
    okStatus: 200,
  },
  {
    name: 'Fireworks',
    url: 'https://api.fireworks.ai/inference/v1/models',
    headers: { 'Authorization': `Bearer ${envVars.FIREWORKS_API_KEY}` },
    okStatus: 200,
  },
  {
    name: 'Tavily',
    url: 'https://api.tavily.com/search',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: envVars.TAVILY_API_KEY, query: 'test', max_results: 1 }),
    method: 'POST',
    okStatus: 200,
  },
  {
    name: 'NVIDIA NIM',
    url: 'https://api.nvcf.nvidia.com/v2/nvcf/models',
    headers: { 'Authorization': `Bearer ${envVars.NVIDIA_API_KEY}` },
    okStatus: 200,
  },
  {
    name: 'Cloudflare',
    url: `https://api.cloudflare.com/client/v4/accounts/${envVars.CLOUDFLARE_ACCOUNT_ID}/ai/models`,
    headers: { 'Authorization': `Bearer ${envVars.CLOUDFLARE_API_KEY}` },
    okStatus: 200,
  },
];

let failedTests = [];

for (const test of API_TESTS) {
  try {
    const options = {
      method: test.method || 'GET',
      headers: test.headers,
    };
    if (test.body) options.body = test.body;

    const response = await fetch(test.url, options);

    if (response.status === test.okStatus || response.ok) {
      console.log(`   ✅ ${test.name} — Terhubung (${response.status})`);
    } else {
      const text = await response.text().catch(() => '');
      console.log(`   ⚠️  ${test.name} — Status ${response.status}: ${text.substring(0, 80)}`);
      failedTests.push(test.name);
    }
  } catch (error) {
    console.log(`   ❌ ${test.name} — Gagal: ${error.message}`);
    failedTests.push(test.name);
  }
}

console.log('');
if (failedTests.length === 0) {
  console.log('   🎉 Semua 10 API terhubung!\n');
} else {
  console.log(`   ⚠️  ${failedTests.length} API gagal: ${failedTests.join(', ')}`);
  console.log('   Periksa kembali API key di .env.local\n');
}

// ============================================================
// STEP 4: INSTALL DEPENDENCIES
// ============================================================

console.log('📦 STEP 4: Memeriksa dependencies...\n');

if (existsSync('package.json') && existsSync('node_modules')) {
  console.log('   ✅ node_modules sudah ada\n');
} else if (existsSync('package.json')) {
  console.log('   📥 Menginstall dependencies...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('   ✅ Dependencies terinstall\n');
  } catch (error) {
    console.log('   ❌ Gagal install. Jalankan: npm install\n');
  }
} else {
  console.log('   ❌ package.json tidak ditemukan\n');
}

// ============================================================
// STEP 5: CEK DEPLOY SIAP
// ============================================================

console.log('🚀 STEP 5: Cek kesiapan deploy...\n');

const checks = [
  { name: '.env.local', pass: existsSync('.env.local') },
  { name: 'package.json', pass: existsSync('package.json') },
  { name: 'vercel.json', pass: existsSync('vercel.json') },
  { name: 'src/app.js', pass: existsSync('src/app.js') },
  { name: 'node_modules', pass: existsSync('node_modules') },
  { name: 'Semua API terhubung', pass: failedTests.length === 0 },
  { name: 'Semua env terisi', pass: missingVars.length === 0 && emptyVars.length === 0 },
];

let allPass = true;
checks.forEach(check => {
  if (check.pass) {
    console.log(`   ✅ ${check.name}`);
  } else {
    console.log(`   ❌ ${check.name}`);
    allPass = false;
  }
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (allPass) {
  console.log('\n🎉 SIAP DEPLOY! Jalankan: vercel --prod\n');
} else {
  console.log('\n⚠️  Ada yang perlu diperbaiki sebelum deploy.\n');
}

// ============================================================
// STEP 6: TAMPILKAN PERINTAH
// ============================================================

console.log('📋 Perintah berguna:');
console.log('   npm run dev       → Jalankan development server');
console.log('   npm test          → Jalankan semua test');
console.log('   npm run deploy    → Deploy ke Vercel production');
console.log('');
