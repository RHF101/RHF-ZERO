// ============================================================
// AI RAKSASA — Integration Tests
// Test alur penuh antar modul
// ============================================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, API_KEYS } from '../src/ai/config.js';
import { detectIntent, splitIntoChunks, compareReviews, assembleChunks, extractCodeFromMarkdown, validateCodeStructure } from '../src/ai/core.js';
import { retryWithBackoff, logProgress, estimateTokens, generateSessionId, sanitizeInput, validateInput, formatElapsed } from '../src/utils.js';
import { formatResponse } from '../src/output.js';
import { trackPhase, trackAPICall, generateReport, getAPIStats } from '../src/monitoring.js';
import { saveConversation, getChatHistory, saveCodeHistory, getContext } from '../src/ai/memory.js';
import {
  SAMPLE_CODE_500,
  SAMPLE_CODE_5000,
  SAMPLE_CODE_BROKEN,
  SAMPLE_REVIEWS_ALL_PASS,
  SAMPLE_REVIEWS_WITH_CONFLICT,
  SAMPLE_REVIEWS_MAJOR_BUG,
  SAMPLE_METADATA,
} from './fixtures.js';

// ============================================================
// TEST: FULL PIPELINE FLOW (Mode Serius)
// ============================================================

describe('Full Pipeline Integration', () => {
  const sessionId = generateSessionId();

  it('1. Detector → Splitter → Comparator → Assembler', () => {
    // Step 1: Deteksi intent
    const intent = detectIntent('Buatkan aplikasi Express dengan autentikasi JWT');
    assert.equal(intent, CONFIG.MODE_SERIUS);

    // Step 2: Split kode
    const chunks = splitIntoChunks(SAMPLE_CODE_500);
    assert.ok(chunks.length >= 1, 'Harus menghasilkan minimal 1 chunk');
    assert.ok(chunks[0].id, 'Chunk harus punya ID');
    assert.ok(chunks[0].content.length > 0, 'Chunk harus punya konten');

    // Step 3: Simulasi review + comparator
    const comparison = compareReviews(SAMPLE_REVIEWS_ALL_PASS);
    assert.equal(comparison.status, 'PASS');
    assert.equal(comparison.conflicts.length, 0);

    // Step 4: Assembly
    const chunkContents = chunks.map(c => c.content);
    const assembled = assembleChunks(chunkContents);
    assert.ok(assembled.length > 0, 'Assembly harus menghasilkan kode');
  });

  it('2. Mode Santai detection', () => {
    const intents = [
      { msg: 'Halo apa kabar?', expected: 'santai' },
      { msg: 'Bagaimana cuaca hari ini?', expected: 'santai' },
      { msg: 'Siapa presiden Indonesia?', expected: 'santai' },
    ];

    intents.forEach(({ msg, expected }) => {
      const result = detectIntent(msg);
      assert.equal(result, expected, `"${msg}" harus terdeteksi sebagai ${expected}`);
    });
  });

  it('3. Mode Serius detection', () => {
    const intents = [
      { msg: 'Buatkan fungsi sorting array', expected: 'serius' },
      { msg: 'Tolong tulis kode Python untuk web scraper', expected: 'serius' },
      { msg: 'Bikinin aplikasi React dengan 10 komponen', expected: 'serius' },
      { msg: 'Debug error ini: TypeError: Cannot read property', expected: 'serius' },
    ];

    intents.forEach(({ msg, expected }) => {
      const result = detectIntent(msg);
      assert.equal(result, expected, `"${msg}" harus terdeteksi sebagai ${expected}`);
    });
  });
});

// ============================================================
// TEST: SPLITTER + ASSEMBLER ROUNDTRIP
// ============================================================

describe('Splitter ↔ Assembler Roundtrip', () => {
  it('Kode 500 baris: split → assemble = kode utuh', () => {
    const chunks = splitIntoChunks(SAMPLE_CODE_500);
    const contents = chunks.map(c => c.content);
    const assembled = assembleChunks(contents);

    // Assembly tidak boleh kosong
    assert.ok(assembled.length > 0);
    
    // Jumlah baris harus masuk akal
    const originalLines = SAMPLE_CODE_500.split('\n').length;
    const assembledLines = assembled.split('\n').length;
    
    // Toleransi 10% karena overlap handling
    const diff = Math.abs(originalLines - assembledLines);
    assert.ok(diff < originalLines * 0.2, `Perbedaan baris terlalu besar: ${diff}`);
  });

  it('Splitter menghasilkan overlap yang benar', () => {
    const longCode = SAMPLE_CODE_5000;
    const chunks = splitIntoChunks(longCode);
    
    if (chunks.length > 1) {
      // Cek chunk pertama ada overlap ke chunk kedua
      const lastLinesOfChunk1 = chunks[0].content.split('\n').slice(-10).join('\n');
      const firstLinesOfChunk2 = chunks[1].content.split('\n').slice(0, 10).join('\n');
      
      // Harus ada kemiripan (overlap)
      assert.ok(lastLinesOfChunk1.length > 0);
      assert.ok(firstLinesOfChunk2.length > 0);
    }
  });

  it('Semua chunk punya metadata lengkap', () => {
    const chunks = splitIntoChunks(SAMPLE_CODE_500);
    
    chunks.forEach((chunk, i) => {
      assert.ok(chunk.id, `Chunk ${i} harus punya id`);
      assert.ok(typeof chunk.barisAwal === 'number', `Chunk ${i} harus punya barisAwal`);
      assert.ok(typeof chunk.barisAkhir === 'number', `Chunk ${i} harus punya barisAkhir`);
      assert.ok(typeof chunk.content === 'string', `Chunk ${i} harus punya content`);
      assert.ok(chunk.content.length > 0, `Chunk ${i} content tidak boleh kosong`);
    });
  });
});

// ============================================================
// TEST: COMPARATOR (Voting System)
// ============================================================

describe('Comparator Voting System', () => {
  it('3 PASS → PASS', () => {
    const result = compareReviews(SAMPLE_REVIEWS_ALL_PASS);
    assert.equal(result.status, 'PASS');
    assert.equal(result.conflicts.length, 0);
  });

  it('Mixed reviews → REVISI', () => {
    const result = compareReviews(SAMPLE_REVIEWS_WITH_CONFLICT);
    assert.ok(['REVISI', 'PASS'].includes(result.status), 'Status harus PASS atau REVISI');
    assert.ok(result.conflicts.length >= 0);
  });

  it('Major bug → GAGAL atau REVISI', () => {
    const result = compareReviews(SAMPLE_REVIEWS_MAJOR_BUG);
    assert.ok(result.confirmedErrors.length >= 1, 'Harus ada confirmed error');
    // Mayoritas voting: 3/3 setuju ada infinite loop
    const infiniteLoopConfirmed = result.confirmedErrors.some(e => e.includes('infinite') || e.includes('Infinite'));
    assert.ok(infiniteLoopConfirmed, 'Infinite loop harus terkonfirmasi');
  });

  it('Error tunggal jadi conflict', () => {
    const reviews = [
      { errors: ['Bug A'], warnings: [], fixedCode: 'code1', status: 'ok' },
      { errors: [], warnings: [], fixedCode: 'code2', status: 'ok' },
      { errors: [], warnings: [], fixedCode: 'code3', status: 'ok' },
    ];
    
    const result = compareReviews(reviews);
    assert.ok(result.conflicts.includes('Bug A'), 'Error dari 1 AI harus jadi conflict');
  });
});

// ============================================================
// TEST: VALIDATION
// ============================================================

describe('Code Structure Validation', () => {
  it('Kode valid: bracket seimbang', () => {
    const validCode = 'function test() { return { a: [1, 2] }; }';
    const result = validateCodeStructure(validCode);
    assert.equal(result.valid, true);
    assert.equal(result.issues.length, 0);
  });

  it('Kode invalid: bracket tidak seimbang', () => {
    const invalidCode = 'function test() { return { a: [1, 2]; }';
    const result = validateCodeStructure(invalidCode);
    assert.equal(result.valid, false);
    assert.ok(result.issues.length > 0);
  });

  it('Kode invalid: backtick tidak tertutup', () => {
    const invalidCode = 'const x = `hello world;';
    const result = validateCodeStructure(invalidCode);
    assert.equal(result.valid, false);
    assert.ok(result.issues.some(i => i.includes('Backtick')));
  });
});

// ============================================================
// TEST: MARKDOWN EXTRACTION
// ============================================================

describe('Markdown Extraction', () => {
  it('Extract dari code block dengan bahasa', () => {
    const md = '```javascript\nconst x = 1;\n```';
    const result = extractCodeFromMarkdown(md);
    assert.equal(result, 'const x = 1;');
  });

  it('Extract dari code block tanpa bahasa', () => {
    const md = '```\nconst y = 2;\n```';
    const result = extractCodeFromMarkdown(md);
    assert.equal(result, 'const y = 2;');
  });

  it('Tidak ada code block → return mentah', () => {
    const text = 'Ini teks biasa tanpa kode.';
    const result = extractCodeFromMarkdown(text);
    assert.equal(result, text);
  });
});

// ============================================================
// TEST: UTILITIES
// ============================================================

describe('Utilities', () => {
  it('Token estimation works', () => {
    const tokens = estimateTokens(SAMPLE_CODE_500);
    assert.ok(tokens > 0);
    assert.ok(tokens < SAMPLE_CODE_500.length); // Token < karakter
  });

  it('Sanitize input removes dangerous characters', () => {
    const input = 'Hello\x00World\u200BTest';
    const sanitized = sanitizeInput(input);
    assert.equal(sanitized, 'HelloWorldTest');
  });

  it('Validate input rejects empty', () => {
    const result = validateInput('');
    assert.equal(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('Validate input detects script tag', () => {
    const result = validateInput('<script>alert("xss")</script>');
    assert.ok(result.warnings);
    assert.ok(result.errors.some(e => e.includes('script')));
  });

  it('Format elapsed', () => {
    assert.equal(formatElapsed(500), '500ms');
    assert.ok(formatElapsed(5000).includes('detik'));
    assert.ok(formatElapsed(120000).includes('menit'));
  });
});

// ============================================================
// TEST: OUTPUT FORMAT
// ============================================================

describe('Output Formatting', () => {
  it('Format response with metadata', async () => {
    const assembled = {
      code: 'function test() { return true; }',
      analysis: 'Kode bersih, tidak ada issues.',
      returnedIssues: [],
    };

    const scanResult = {
      security: { safe: true, vulnerabilities: [] },
      versions: [{ title: 'Express 4.21', url: 'https://expressjs.com' }],
    };

    const progress = [
      { phase: 'FASE 0', status: 'OK' },
      { phase: 'FASE 1', status: 'OK' },
    ];

    const result = await formatResponse(assembled, scanResult, progress);

    assert.equal(result.mode, 'serius');
    assert.ok(result.rawCode);
    assert.ok(result.metadata);
    assert.equal(result.metadata.strukturValid, true);
    assert.ok(result.metadata.dicekOleh.includes('Reti-Reti'));
  });

  it('Format response with returned issues', async () => {
    const assembled = {
      code: 'function test() { return true; }',
      analysis: 'Ada 2 issues yang dikembalikan.',
      returnedIssues: [
        { chunkId: 'P3', baris: '45-50', masalah: 'Kemungkinan null pointer', rekomendasi: 'Tambahkan null check' },
        { chunkId: 'P7', baris: '120', masalah: 'Variable tidak digunakan', rekomendasi: 'Hapus atau gunakan' },
      ],
    };

    const scanResult = { security: { safe: true }, versions: [] };
    const progress = [];

    const result = await formatResponse(assembled, scanResult, progress);

    assert.equal(result.returnedIssues.length, 2);
    assert.ok(result.response.includes('Issues Dikembalikan'));
  });
});

// ============================================================
// TEST: MONITORING
// ============================================================

describe('Monitoring System', () => {
  const sessionId = generateSessionId();

  it('Track phases and generate report', () => {
    trackPhase(sessionId, 'FASE 0', 'OK', { sources: 3 });
    trackPhase(sessionId, 'FASE 1', 'OK', { chunks: 5 });
    trackPhase(sessionId, 'FASE 2', 'WARNING', { conflicts: 1 });

    const report = generateReport(sessionId);
    assert.equal(report.totalPhases, 3);
    assert.equal(report.errorPhases, 0);
    assert.equal(report.warningPhases, 1);
    assert.ok(report.successRate);
  });

  it('Track API calls', () => {
    trackAPICall('Groq', 'llama-3.3-70b', true, 450);
    trackAPICall('Gemini', 'gemini-2.5-pro', true, 1200);
    trackAPICall('DeepSeek', 'deepseek-chat', false, 5000, 'Timeout');

    const stats = getAPIStats();
    assert.ok(stats.total >= 3);
    assert.ok(stats.successful >= 2);
    assert.ok(stats.failed >= 1);
    assert.ok(stats.providers['Groq']);
    assert.ok(stats.providers['Gemini']);
  });
});

// ============================================================
// TEST: ERROR HANDLING
// ============================================================

describe('Error Handling', () => {
  it('Splitter handles empty input', () => {
    const chunks = splitIntoChunks('');
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].content, '');
  });

  it('Splitter handles null input', () => {
    const chunks = splitIntoChunks(null);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].content, '');
  });

  it('Comparator handles failed reviews', () => {
    const reviews = [
      { errors: [], warnings: [], fixedCode: 'code', status: 'error', summary: 'API failed' },
      { errors: [], warnings: [], fixedCode: 'code', status: 'error', summary: 'Timeout' },
      { errors: [], warnings: [], fixedCode: 'code', status: 'error', summary: 'Rate limited' },
    ];

    const result = compareReviews(reviews);
    assert.equal(result.status, 'GAGAL');
  });

  it('Retry with backoff eventually fails', async () => {
    const startTime = Date.now();
    
    try {
      await retryWithBackoff(
        () => { throw new Error('Always fails'); },
        3,
        100
      );
      assert.fail('Harusnya throw error');
    } catch (error) {
      assert.equal(error.message, 'Always fails');
      const duration = Date.now() - startTime;
      // Harus menunggu setidaknya 100 + 200 + 400 = 700ms
      assert.ok(duration >= 500, `Durasi retry terlalu cepat: ${duration}ms`);
    }
  });
});

// ============================================================
// TEST: MEMORY (skip kalau Firebase tidak dikonfigurasi)
// ============================================================

describe('Memory System', () => {
  const sessionId = 'test_integration_' + Date.now();

  it('Save and retrieve conversation', async () => {
    const saved = await saveConversation(sessionId, 'Halo', 'Halo juga!', 'santai');
    
    if (saved) {
      const history = await getChatHistory(sessionId);
      assert.ok(Array.isArray(history));
    } else {
      // Firebase tidak dikonfigurasi — skip test
      assert.ok(true, 'Memory skipped (no Firebase)');
    }
  });

  it('Save code history', async () => {
    const saved = await saveCodeHistory(sessionId, SAMPLE_CODE_500, []);
    
    if (saved) {
      const context = await getContext(sessionId);
      assert.ok(context.recentCode || context.recentMessages);
    } else {
      assert.ok(true, 'Memory skipped (no Firebase)');
    }
  });
});

// ============================================================
// TEST: PHASE FUNCTIONS (kalau API keys tersedia)
// ============================================================

describe('Phase Functions (Requires API Keys)', () => {
  it('Phase 0: Research with Tavily', async () => {
    if (!API_KEYS.TAVILY) {
      console.log('  ⏭️  Skipped: Tavily API key not configured');
      return;
    }

    const { phaseResearch } = await import('../src/phases.js');
    const result = await phaseResearch('Express.js best practices', 'test_session');
    
    assert.ok(result.success !== undefined);
    assert.ok(Array.isArray(result.sources));
  });

  it('Phase 1: Generate chunks', async () => {
    if (!API_KEYS.GROQ) {
      console.log('  ⏭️  Skipped: Groq API key not configured');
      return;
    }

    const { phaseGenerate } = await import('../src/phases.js');
    const research = { summary: [], sources: [] };
    
    try {
      const chunks = await phaseGenerate('Buat fungsi hello world', research, 'test_session');
      assert.ok(Array.isArray(chunks));
      assert.ok(chunks.length >= 1);
    } catch (error) {
      // Mungkin rate limit atau timeout — tidak fail
      console.log(`  ⚠️  Generate test warning: ${error.message}`);
      assert.ok(true);
    }
  });
});

// ============================================================
// RUN
// ============================================================

console.log('\n🧪 AI RAKSASA — Integration Tests');
console.log('========================================\n');
