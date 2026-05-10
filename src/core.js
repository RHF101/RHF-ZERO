// ============================================================
// AI RAKSASA — Core Functions
// Detector + Splitter + Comparator + Assembler
// ============================================================

import { CONFIG } from './config.js';
import { logProgress } from './utils.js';

// ============================================================
// DETEKTOR INTENT (Santai vs Serius)
// ============================================================

export function detectIntent(message) {
  const codeKeywords = [
    'buat', 'code', 'kode', 'coding', 'program', 'aplikasi',
    'fungsi', 'function', 'class', 'script', 'buatkan',
    '.js', '.py', '.ts', '.html', '.css', '.json', '.java',
    '.go', '.rs', '.cpp', '.c', '.tsx', '.jsx', '.vue',
    'debug', 'error', 'fix', 'perbaiki', 'implementasi',
    'ratusan', 'ribuan', 'baris', 'tulis', 'generate',
    'backend', 'frontend', 'api', 'database', 'query',
    'react', 'vue', 'angular', 'node', 'express',
    'component', 'module', 'package', 'library',
    'bikin', 'bikinin', 'tolong tulis', 'tolong buat',
    'tuliskan', 'buatin', 'kodein', 'ngoding',
    'fullstack', 'endpoint', 'route', 'controller',
    'model', 'schema', 'migration', 'seed',
  ];

  const lowerMessage = message.toLowerCase();

  // Hitung berapa keyword coding yang muncul
  const matchCount = codeKeywords.filter(keyword =>
    lowerMessage.includes(keyword)
  ).length;

  // Deteksi code block dalam pesan
  const hasCodeBlock = message.includes('```');
  const hasTripleBacktick = message.includes('```');

  // Deteksi permintaan eksplisit
  const isExplicitSerious = lowerMessage.includes('mode serius') ||
    lowerMessage.includes('coding mode') ||
    lowerMessage.includes('serius');

  const isExplicitSantai = lowerMessage.includes('mode santai') ||
    lowerMessage.includes('tanya jawab') ||
    lowerMessage.includes('ngobrol');

  // Keputusan
  if (isExplicitSerious) return CONFIG.MODE_SERIUS;
  if (isExplicitSantai) return CONFIG.MODE_SANTAI;

  // Jika ada 2+ keyword coding atau ada code block → serius
  if (matchCount >= 2 || hasCodeBlock || hasTripleBacktick) {
    return CONFIG.MODE_SERIUS;
  }

  // Default: santai
  return CONFIG.MODE_SANTAI;
}

// ============================================================
// PEMOTONG (SPLITTER) — 500 baris + 30 overlap
// ============================================================

export function splitIntoChunks(code) {
  if (!code || typeof code !== 'string') {
    return [{
      id: 'P1',
      barisAwal: 1,
      barisAkhir: 1,
      content: '',
    }];
  }

  const lines = code.split('\n');
  const totalLines = lines.length;

  // Kalau lebih pendek dari CHUNK_SIZE, langsung return 1 chunk
  if (totalLines <= CONFIG.CHUNK_SIZE) {
    return [{
      id: 'P1',
      barisAwal: 1,
      barisAkhir: totalLines,
      content: code,
    }];
  }

  const chunks = [];
  let currentStart = 0;
  let chunkIndex = 1;

  while (currentStart < totalLines) {
    let idealEnd = currentStart + CONFIG.CHUNK_SIZE;

    // Jangan melebihi total baris
    if (idealEnd >= totalLines) {
      idealEnd = totalLines;
    } else {
      // Cari batas aman: akhir fungsi/class (baris kosong atau tutup bracket)
      const searchWindow = lines.slice(idealEnd - CONFIG.MIN_CHUNK, idealEnd + (CONFIG.MAX_CHUNK - CONFIG.MIN_CHUNK));

      let bestCut = idealEnd;
      let foundSafeCut = false;

      // Cari dari idealEnd mundur dulu (prioritas dekat 500)
      for (let i = Math.min(idealEnd, totalLines - 1); i >= Math.max(idealEnd - 100, currentStart + CONFIG.MIN_CHUNK); i--) {
        const line = lines[i]?.trim() || '';
        // Batas aman: baris kosong, tutup fungsi }, tutup class }, tutup objek ]
        if (
          line === '' ||
          line === '}' ||
          line === '};' ||
          line === '})' ||
          line === '];' ||
          line === '});' ||
          line === '}' ||
          line.startsWith('export ') ||
          line.startsWith('module.exports')
        ) {
          bestCut = i + 1; // Potong setelah baris ini
          foundSafeCut = true;
          break;
        }
      }

      // Kalau tidak ketemu batas aman, cari maju
      if (!foundSafeCut) {
        for (let i = idealEnd; i < Math.min(idealEnd + 100, totalLines); i++) {
          const line = lines[i]?.trim() || '';
          if (
            line === '' ||
            line === '}' ||
            line === '};' ||
            line === '})'
          ) {
            bestCut = i + 1;
            foundSafeCut = true;
            break;
          }
        }
      }

      // Fallback: potong di idealEnd
      if (!foundSafeCut) {
        bestCut = idealEnd;
      }

      idealEnd = bestCut;
    }

    // Ambil potongan + overlap
    const chunkStart = currentStart;
    const chunkEnd = Math.min(idealEnd, totalLines);
    const chunkLines = lines.slice(chunkStart, chunkEnd);

    // Tambah overlap dari potongan berikutnya (kalau ada)
    let overlapLines = [];
    if (chunkEnd < totalLines) {
      const overlapEnd = Math.min(chunkEnd + CONFIG.OVERLAP_SIZE, totalLines);
      overlapLines = lines.slice(chunkEnd, overlapEnd);
    }

    const contentLines = [...chunkLines, ...overlapLines];

    chunks.push({
      id: `P${chunkIndex}`,
      barisAwal: chunkStart + 1,
      barisAkhir: chunkEnd,
      content: contentLines.join('\n'),
    });

    // Geser ke potongan berikutnya (mundur overlap biar nyambung)
    currentStart = chunkEnd;
    chunkIndex++;
  }

  logProgress('SPLITTER', `${chunks.length} potongan dari ${totalLines} baris`);
  return chunks;
}

// ============================================================
// KOMPARATOR (Voting Mayoritas)
// ============================================================

export function compareReviews(reviews) {
  // reviews = [{ errors, warnings, fixedCode, status }, ...]
  // Biasanya 3 review: Gemini, DeepSeek, Mistral

  const validReviews = reviews.filter(r => r && r.status !== 'error');

  if (validReviews.length === 0) {
    return {
      status: 'GAGAL',
      finalCode: reviews[0]?.fixedCode || '',
      conflicts: [],
      votingSummary: 'Semua AI gagal review',
    };
  }

  // Kumpulkan semua error
  const allErrors = validReviews.flatMap(r => r.errors || []);
  const allWarnings = validReviews.flatMap(r => r.warnings || []);

  // Deduplikasi error
  const uniqueErrors = [...new Set(allErrors)];
  const uniqueWarnings = [...new Set(allWarnings)];

  // Voting: hitung berapa AI yang setuju tiap error
  const errorVotes = {};
  allErrors.forEach(e => {
    errorVotes[e] = (errorVotes[e] || 0) + 1;
  });

  const warningVotes = {};
  allWarnings.forEach(w => {
    warningVotes[w] = (warningVotes[w] || 0) + 1;
  });

  // Conflicts: error yang hanya dilaporkan 1 AI
  const conflicts = Object.entries(errorVotes)
    .filter(([, count]) => count === 1)
    .map(([error]) => error);

  const conflictWarnings = Object.entries(warningVotes)
    .filter(([, count]) => count === 1)
    .map(([warning]) => warning);

  // Pilih fixedCode terbaik (prioritas: yang paling banyak perbaikan)
  let finalCode;
  if (validReviews.length >= 3 && validReviews[0].fixedCode) {
    // Mayoritas: kalau 2+ AI hasilkan kode mirip, pakai itu
    finalCode = validReviews[0].fixedCode;
  } else if (validReviews.length >= 1) {
    finalCode = validReviews[0].fixedCode;
  } else {
    finalCode = reviews[0]?.fixedCode || '';
  }

  // Tentukan status
  let status;
  const totalIssues = uniqueErrors.length + conflicts.length;

  if (totalIssues === 0) {
    status = 'PASS';
  } else if (conflicts.length === 0 && uniqueErrors.length <= 3) {
    status = 'REVISI';
  } else if (uniqueErrors.length > 3 || conflicts.length > 2) {
    status = 'GAGAL';
  } else {
    status = 'REVISI';
  }

  return {
    status,
    finalCode,
    confirmedErrors: uniqueErrors.filter(e => errorVotes[e] >= 2),
    confirmedWarnings: uniqueWarnings.filter(w => warningVotes[w] >= 2),
    conflicts: [...conflicts, ...conflictWarnings],
    votingSummary: `${validReviews.length}/${reviews.length} AI berhasil review, ${uniqueErrors.length} errors, ${conflicts.length} conflicts`,
  };
}

// ============================================================
// ASSEMBLER (Rakit Fisik — Non-AI Script)
// ============================================================

export function assembleChunks(chunkContents) {
  if (!chunkContents || chunkContents.length === 0) return '';
  if (chunkContents.length === 1) return chunkContents[0];

  // Gabung semua potongan
  let assembled = '';
  const overlapSize = CONFIG.OVERLAP_SIZE;

  for (let i = 0; i < chunkContents.length; i++) {
    const chunk = chunkContents[i];
    const lines = chunk.split('\n');

    if (i === 0) {
      // Potongan pertama: ambil semua, simpan overlap untuk dicek
      assembled = chunk;
    } else {
      // Potongan berikutnya: hapus overlap dari potongan sebelumnya
      const trimmedLines = lines.slice(overlapSize);
      assembled += '\n' + trimmedLines.join('\n');
    }
  }

  // Bersihkan: hapus baris kosong berlebihan (max 2 baris kosong berturut-turut)
  const cleanedLines = [];
  let emptyCount = 0;

  for (const line of assembled.split('\n')) {
    if (line.trim() === '') {
      emptyCount++;
      if (emptyCount <= 2) {
        cleanedLines.push(line);
      }
    } else {
      emptyCount = 0;
      cleanedLines.push(line);
    }
  }

  return cleanedLines.join('\n');
}

// ============================================================
// HELPER: Ekstrak kode dari markdown code block
// ============================================================

export function extractCodeFromMarkdown(text) {
  if (!text) return '';

  // Cari code block dengan bahasa
  const match = text.match(/```[\w]*\n([\s\S]*?)```/);
  if (match) return match[1].trim();

  // Cari code block tanpa bahasa
  const match2 = text.match(/```([\s\S]*?)```/);
  if (match2) return match2[1].trim();

  // Tidak ada code block, return apa adanya
  return text.trim();
}

// ============================================================
// HELPER: Hitung baris kode
// ============================================================

export function countLines(code) {
  if (!code) return 0;
  return code.split('\n').length;
}

// ============================================================
// HELPER: Validasi struktur kode dasar
// ============================================================

export function validateCodeStructure(code) {
  const issues = [];

  // Cek bracket seimbang
  const curlyOpen = (code.match(/\{/g) || []).length;
  const curlyClose = (code.match(/\}/g) || []).length;
  if (curlyOpen !== curlyClose) {
    issues.push(`Bracket {} tidak seimbang: ${curlyOpen} buka, ${curlyClose} tutup`);
  }

  const parenOpen = (code.match(/\(/g) || []).length;
  const parenClose = (code.match(/\)/g) || []).length;
  if (parenOpen !== parenClose) {
    issues.push(`Kurung () tidak seimbang: ${parenOpen} buka, ${parenClose} tutup`);
  }

  const bracketOpen = (code.match(/\[/g) || []).length;
  const bracketClose = (code.match(/\]/g) || []).length;
  if (bracketOpen !== bracketClose) {
    issues.push(`Bracket [] tidak seimbang: ${bracketOpen} buka, ${bracketClose} tutup`);
  }

  // Cek backtick tidak tertutup (template literal)
  const backtickCount = (code.match(/`/g) || []).length;
  if (backtickCount % 2 !== 0) {
    issues.push(`Backtick (\`) tidak seimbang: ${backtickCount}`);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
         }
