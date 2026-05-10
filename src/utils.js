// ============================================================
// AI RAKSASA — Utilities
// Retry, Logger, Token Counter, Validator, Sanitizer
// ============================================================

import { CONFIG } from './ai/config.js';

// ============================================================
// RETRY DENGAN BACKOFF
// ============================================================

export async function retryWithBackoff(fn, maxRetries = CONFIG.MAX_RETRIES, delayMs = CONFIG.RETRY_DELAY_MS) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const backoff = delayMs * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 500;

        console.log(`  ⚠️  Retry ${attempt}/${maxRetries} — menunggu ${Math.round(backoff + jitter)}ms`);

        await new Promise(resolve => setTimeout(resolve, backoff + jitter));
      }
    }
  }

  throw lastError;
}

// ============================================================
// LOGGER
// ============================================================

export function logProgress(phase, message, details = {}) {
  const timestamp = new Date().toISOString().slice(11, 19);
  const prefix = `[${timestamp}]`;

  const iconMap = {
    'START': '🚀',
    'DONE': '✅',
    'ERROR': '❌',
    'WARNING': '⚠️',
    'MODE': '🎯',
    'FASE 0': '🔍',
    'FASE 1': '⚡',
    'FASE 2': '🔬',
    'FASE 3': '🔬',
    'FASE 4': '🧩',
    'FASE 5': '🛡️',
    'REQUEST': '📥',
    'AI': '🤖',
    'SPLITTER': '✂️',
    'MEMORY': '💾',
    'OUTPUT': '📤',
  };

  const icon = iconMap[phase] || '📌';
  const msg = typeof message === 'string' ? message : JSON.stringify(message);

  console.log(`${prefix} ${icon} [${phase}] ${msg}`);

  if (details && Object.keys(details).length > 0) {
    const detailStr = Object.entries(details)
      .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : v}`)
      .join(', ');
    console.log(`     └─ ${detailStr}`);
  }
}

// ============================================================
// ESTIMASI TOKEN
// ============================================================

export function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;

  // Estimasi kasar: 1 token ≈ 4 karakter (berlaku untuk kebanyakan model)
  // Untuk kode: 1 token ≈ 3.5 karakter
  const chars = text.length;

  // Deteksi apakah ini kode atau teks biasa
  const codeIndicators = ['function', 'const', 'let', 'var', 'import', 'export', 'class', '{', '}', '=>', ';'];
  const isCode = codeIndicators.some(ind => text.includes(ind));

  if (isCode) {
    return Math.ceil(chars / 3.5);
  }

  return Math.ceil(chars / 4);
}

export function estimateTokensDetailed(text) {
  if (!text || typeof text !== 'string') {
    return { characters: 0, estimatedTokens: 0, estimatedLines: 0 };
  }

  const chars = text.length;
  const lines = text.split('\n').length;
  const words = text.split(/\s+/).length;

  // Estimasi token
  const tokensByChar = Math.ceil(chars / 4);
  const tokensByWord = Math.ceil(words * 1.3);

  // Rata-rata
  const estimatedTokens = Math.ceil((tokensByChar + tokensByWord) / 2);

  return {
    characters: chars,
    estimatedTokens,
    estimatedLines: lines,
    estimatedWords: words,
  };
}

// ============================================================
// VALIDATOR
// ============================================================

export function validateInput(input) {
  const errors = [];

  if (!input || typeof input !== 'string') {
    errors.push('Input harus berupa string');
    return { valid: false, errors };
  }

  if (input.trim().length === 0) {
    errors.push('Input tidak boleh kosong');
  }

  if (input.length > CONFIG.MAX_INPUT_LENGTH) {
    errors.push(`Input terlalu panjang (maks ${CONFIG.MAX_INPUT_LENGTH.toLocaleString('id-ID')} karakter)`);
  }

  // Deteksi input berbahaya
  const dangerousPatterns = [
    { pattern: /<script\b/i, msg: 'Mengandung tag script' },
    { pattern: /eval\s*\(/i, msg: 'Mengandung eval()' },
    { pattern: /process\.env/i, msg: 'Mencoba akses environment variables' },
    { pattern: /require\s*\(\s*['"]child_process['"]/, msg: 'Mencoba akses child_process' },
    { pattern: /fetch\s*\(\s*['"]file:\/\//, msg: 'Mencoba akses file lokal' },
  ];

  for (const { pattern, msg } of dangerousPatterns) {
    if (pattern.test(input)) {
      errors.push(`⚠️  ${msg}`);
    }
  }

  return {
    valid: errors.filter(e => !e.startsWith('⚠️')).length === 0,
    warnings: errors.filter(e => e.startsWith('⚠️')).length > 0,
    errors,
  };
}

// ============================================================
// SANITIZER
// ============================================================

export function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return '';

  // Hapus karakter null dan kontrol
  let sanitized = input
    .replace(/\0/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Hapus karakter Unicode berbahaya
  sanitized = sanitized
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width characters
    .replace(/[\u2028\u2029]/g, '\n'); // Line/paragraph separator

  // Batasi panjang
  if (sanitized.length > CONFIG.MAX_INPUT_LENGTH) {
    sanitized = sanitized.substring(0, CONFIG.MAX_INPUT_LENGTH) + '\n\n[INPUT DIPOTONG — terlalu panjang]';
  }

  return sanitized.trim();
}

// ============================================================
// FORMAT WAKTU
// ============================================================

export function formatElapsed(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} detik`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)} menit ${Math.round((ms % 60000) / 1000)} detik`;
  return `${(ms / 3600000).toFixed(1)} jam`;
}

export function timestamp() {
  return new Date().toISOString();
}

export function timestampCompact() {
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

// ============================================================
// RANDOM HELPERS
// ============================================================

export function generateSessionId() {
  return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
}

export function generateChunkId(index) {
  return `P${String(index).padStart(3, '0')}`;
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// TRUNCATE TEXT
// ============================================================

export function truncate(text, maxLength = 100, suffix = '...') {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

export function truncateLines(text, maxLines = 10) {
  if (!text) return '';
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} baris lagi)`;
}

// ============================================================
// DEEP EQUAL (untuk komparasi objek)
// ============================================================

export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

// ============================================================
// STRING SIMILARITY (Levenshtein Distance sederhana)
// ============================================================

export function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1;

  // Hitung karakter yang sama
  let matches = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) {
      matches++;
    }
  }

  return matches / longer.length;
}

// ============================================================
// BATCH PROCESSOR
// ============================================================

export async function processBatch(items, fn, batchSize = 5, delayBetweenBatches = 100) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    const batchPromises = batch.map(item => fn(item).catch(error => ({ error })));
    const batchResults = await Promise.all(batchPromises);

    results.push(...batchResults);

    if (i + batchSize < items.length) {
      await sleep(delayBetweenBatches);
    }
  }

  return results;
}

// ============================================================
// CACHE SEDERHANA (In-Memory)
// ============================================================

const cache = new Map();

export function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

export function cacheSet(key, value, ttlMs = 300000) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

export function cacheClear() {
  cache.clear();
}

// Auto cleanup cache setiap 5 menit
setInterval(() => {
  const now = Date.now();
  cache.forEach((entry, key) => {
    if (now > entry.expiresAt) {
      cache.delete(key);
    }
  });
}, 300000);
