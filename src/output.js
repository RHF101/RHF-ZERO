// ============================================================
// AI RAKSASA — Output Handler
// Formatter + Download + Metadata
// ============================================================

import { writeFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { CONFIG } from './ai/config.js';
import { countLines, validateCodeStructure } from './ai/core.js';
import { logProgress } from './utils.js';

// ============================================================
// FORMAT RESPONSE
// ============================================================

export async function formatResponse(assembled, scanResult, progress) {
  const code = assembled.code || assembled;
  const analysis = assembled.analysis || '';
  const returnedIssues = assembled.returnedIssues || [];

  // Hitung statistik
  const lineCount = countLines(code);
  const charCount = code.length;
  const validation = validateCodeStructure(code);

  // Metadata
  const metadata = {
    panjangCode: charCount.toLocaleString('id-ID'),
    jumlahBaris: lineCount.toLocaleString('id-ID'),
    strukturValid: validation.valid,
    issuesDikembalikan: returnedIssues.length,
    scanKeamanan: scanResult?.security?.safe !== false ? '✅ Lolos' : '⚠️ Ada catatan',
    dicekOleh: 'Gemini + DeepSeek + Mistral (Reti-Reti Double Check)',
    waktuProses: progress?.length > 0 
      ? progress.filter(p => p.phase).length + ' fase' 
      : 'Full pipeline',
  };

  // Generate download link
  let downloadUrl = null;
  try {
    downloadUrl = await saveDownloadFile(code);
  } catch (error) {
    logProgress('OUTPUT', `Download gagal: ${error.message}`);
  }

  // Format response text
  let responseText = '';

  // Kalau ada analysis dari AI Perakit
  if (analysis) {
    responseText += `📊 **Analisis:** ${analysis}\n\n`;
  }

  // Kalau ada issues yang dikembalikan
  if (returnedIssues.length > 0) {
    responseText += `⚠️ **Issues Dikembalikan (tidak diperbaiki):**\n`;
    returnedIssues.forEach((issue, i) => {
      responseText += `${i + 1}. **${issue.chunkId || '?'}** (baris ${issue.baris || '?'}): ${issue.masalah || issue}\n`;
      if (issue.rekomendasi) {
        responseText += `   💡 Rekomendasi: ${issue.rekomendasi}\n`;
      }
    });
    responseText += '\n';
  }

  // Kode utama
  responseText += `${code}`;

  return {
    mode: 'serius',
    response: responseText,
    rawCode: code,
    metadata,
    downloadUrl,
    analysis,
    returnedIssues,
    validation,
    scanResult,
  };
}

// ============================================================
// DOWNLOAD FILE
// ============================================================

const DOWNLOAD_DIR = join(process.cwd(), 'public', 'download');

function ensureDownloadDir() {
  if (!existsSync(DOWNLOAD_DIR)) {
    mkdirSync(DOWNLOAD_DIR, { recursive: true });
  }
}

export async function saveDownloadFile(code) {
  ensureDownloadDir();

  const fileId = randomUUID().slice(0, 8);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `ai-raksasa-${timestamp}-${fileId}.txt`;
  const filepath = join(DOWNLOAD_DIR, filename);

  // Tulis file
  writeFileSync(filepath, code, 'utf-8');

  // Simpan metadata download
  const metaPath = join(DOWNLOAD_DIR, `${fileId}.json`);
  writeFileSync(metaPath, JSON.stringify({
    fileId,
    filename,
    filepath,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + CONFIG.DOWNLOAD_EXPIRY_MS).toISOString(),
    size: code.length,
  }), 'utf-8');

  // Bersihkan file kadaluarsa
  cleanupOldDownloads();

  return `/api/download/${fileId}`;
}

export async function getDownloadFile(fileId) {
  ensureDownloadDir();

  const metaPath = join(DOWNLOAD_DIR, `${fileId}.json`);

  if (!existsSync(metaPath)) {
    return null;
  }

  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));

    // Cek kadaluarsa
    if (new Date(meta.expiresAt) < new Date()) {
      // Hapus file kadaluarsa
      try { unlinkSync(metaPath); } catch (e) {}
      try { unlinkSync(join(DOWNLOAD_DIR, meta.filename)); } catch (e) {}
      return null;
    }

    // Baca file
    if (!existsSync(join(DOWNLOAD_DIR, meta.filename))) {
      return null;
    }

    const content = readFileSync(join(DOWNLOAD_DIR, meta.filename), 'utf-8');

    return {
      filename: meta.filename,
      content,
      size: meta.size,
      createdAt: meta.createdAt,
    };
  } catch (error) {
    return null;
  }
}

// ============================================================
// GENERATE DOWNLOAD URL (Alternatif — return konten langsung)
// ============================================================

export function generateDownloadUrl(code, filename = 'kode.txt') {
  // Untuk file kecil, return data URL
  if (code.length < 100000) {
    const base64 = Buffer.from(code, 'utf-8').toString('base64');
    return `data:text/plain;base64,${base64}`;
  }

  // Untuk file besar, harus lewat saveDownloadFile
  return null;
}

// ============================================================
// CLEANUP DOWNLOAD LAMA
// ============================================================

function cleanupOldDownloads() {
  try {
    ensureDownloadDir();
    const fs = require('fs');
    const files = fs.readdirSync(DOWNLOAD_DIR);
    const now = Date.now();

    files.forEach(file => {
      if (file.endsWith('.json')) {
        const metaPath = join(DOWNLOAD_DIR, file);
        try {
          const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
          const expiry = new Date(meta.expiresAt).getTime();
          if (now > expiry) {
            unlinkSync(metaPath);
            try { unlinkSync(join(DOWNLOAD_DIR, meta.filename)); } catch (e) {}
          }
        } catch (e) {}
      }
    });
  } catch (error) {
    // Silent fail — cleanup tidak kritis
  }
}

// ============================================================
// FORMAT MARKDOWN KE PLAIN TEXT
// ============================================================

export function stripMarkdown(text) {
  if (!text) return '';

  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '[KODE]')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/~~(.*?)~~/g, '$1')
    .trim();
}

// ============================================================
// FORMAT UKURAN FILE
// ============================================================

export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ============================================================
// FORMAT DURASI
// ============================================================

export function formatDuration(ms) {
  if (ms < 1000) return ms + 'ms';
  if (ms < 60000) return (ms / 1000).toFixed(1) + ' detik';
  return (ms / 60000).toFixed(1) + ' menit';
      }
