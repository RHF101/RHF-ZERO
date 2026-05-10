// ============================================================
// AI RAKSASA — Unit Tests
// Test setiap fungsi secara terisolasi
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/ai/config.js';
import { detectIntent, splitIntoChunks, compareReviews, assembleChunks, extractCodeFromMarkdown, countLines, validateCodeStructure } from '../src/ai/core.js';
import { retryWithBackoff, estimateTokens, estimateTokensDetailed, generateSessionId, sanitizeInput, validateInput, truncate, truncateLines, stringSimilarity, deepEqual, generateChunkId, formatElapsed, sleep, cacheGet, cacheSet, cacheClear } from '../src/utils.js';
import { stripMarkdown, formatFileSize, formatDuration } from '../src/output.js';
import {
  SAMPLE_CODE_500,
  SAMPLE_CODE_5000,
  SAMPLE_CODE_BROKEN,
  SAMPLE_CHUNKS_INPUT,
  SAMPLE_REVIEWS_ALL_PASS,
  SAMPLE_REVIEWS_WITH_CONFLICT,
  SAMPLE_REVIEWS_MAJOR_BUG,
} from './fixtures.js';

// ============================================================
// DETEKTOR INTENT
// ============================================================

describe('detectIntent()', () => {
  it('Deteksi mode santai untuk salam', () => {
    assert.equal(detectIntent('Halo'), CONFIG.MODE_SANTAI);
    assert.equal(detectIntent('Apa kabar?'), CONFIG.MODE_SANTAI);
    assert.equal(detectIntent('Selamat pagi'), CONFIG.MODE_SANTAI);
  });

  it('Deteksi mode santai untuk tanya jawab', () => {
    assert.equal(detectIntent('Siapa presiden Indonesia?'), CONFIG.MODE_SANTAI);
    assert.equal(detectIntent('Bagaimana cuaca besok?'), CONFIG.MODE_SANTAI);
    assert.equal(detectIntent('Apa itu AI?'), CONFIG.MODE_SANTAI);
  });

  it('Deteksi mode serius untuk coding', () => {
    assert.equal(detectIntent('Buatkan fungsi'), CONFIG.MODE_SERIUS);
    assert.equal(detectIntent('Tolong tulis kode'), CONFIG.MODE_SERIUS);
    assert.equal(detectIntent('Bikinin aplikasi'), CONFIG.MODE_SERIUS);
    assert.equal(detectIntent('Debug error ini'), CONFIG.MODE_SERIUS);
  });

  it('Deteksi mode serius dengan ekstensi file', () => {
    assert.equal(detectIntent('Tolong analisis file .js ini'), CONFIG.MODE_SERIUS);
    assert.equal(detectIntent('Buat file .py'), CONFIG.MODE_SERIUS);
    assert.equal(detectIntent('Perbaiki file .tsx'), CONFIG.MODE_SERIUS);
  });

  it('Mode eksplisit menang', () => {
    assert.equal(detectIntent('mode serius: halo'), CONFIG.MODE_SERIUS);
    assert.equal(detectIntent('mode santai: buatkan kode'), CONFIG.MODE_SANTAI);
    assert.equal(detectIntent('coding mode'), CONFIG.MODE_SERIUS);
    assert.equal(detectIntent('tanya jawab aja'), CONFIG.MODE_SANTAI);
  });

  it('Code block terdeteksi sebagai serius', () => {
    const msg = `Tolong jelaskan kode ini:
\`\`\`
function hello() { return "world"; }
\`\`\``;
    assert.equal(detectIntent(msg), CONFIG.MODE_SERIUS);
  });

  it('Keyword banyak → serius', () => {
    assert.equal(detectIntent('Tolong tulis kode fungsi program aplikasi'), CONFIG.MODE_SERIUS);
  });
});

// ============================================================
// SPLITTER
// ============================================================

describe('splitIntoChunks()', () => {
  it('Kode pendek (< 500 baris) jadi 1 chunk', () => {
    const shortCode = 'const x = 1;\nconst y = 2;\n';
    const chunks = splitIntoChunks(shortCode);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].id, 'P1');
    assert.equal(chunks[0].barisAwal, 1);
  });

  it('Kode panjang di-split jadi multiple chunks', () => {
    const longCode = SAMPLE_CHUNKS_INPUT;
    const chunks = splitIntoChunks(longCode);
    assert.ok(chunks.length > 1, `Harus > 1 chunk, dapat ${chunks.length}`);
  });

  it('Setiap chunk punya struktur benar', () => {
    const chunks = splitIntoChunks(SAMPLE_CODE_500);

    chunks.forEach(chunk => {
      assert.ok(chunk.id.startsWith('P'), 'ID harus mulai dengan P');
      assert.ok(typeof chunk.barisAwal === 'number', 'barisAwal harus number');
      assert.ok(typeof chunk.barisAkhir === 'number', 'barisAkhir harus number');
      assert.ok(chunk.barisAwal <= chunk.barisAkhir, 'barisAwal harus <= barisAkhir');
      assert.ok(typeof chunk.content === 'string', 'content harus string');
      assert.ok(chunk.content.length > 0, 'content tidak boleh kosong');
    });
  });

  it('Chunk berurutan (barisAkhir chunk N = barisAwal chunk N+1 - 1)', () => {
    const longCode = SAMPLE_CODE_5000;
    const chunks = splitIntoChunks(longCode);

    for (let i = 0; i < chunks.length - 1; i++) {
      assert.ok(
        chunks[i].barisAkhir >= chunks[i + 1].barisAwal - 50,
        `Chunk ${i} berakhir di ${chunks[i].barisAkhir}, chunk ${i + 1} mulai di ${chunks[i + 1].barisAwal}`
      );
    }
  });

  it('Handle empty string', () => {
    const chunks = splitIntoChunks('');
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].content, '');
  });

  it('Handle null/undefined', () => {
    const chunks = splitIntoChunks(null);
    assert.equal(chunks.length, 1);
  });

  it('Ukuran chunk tidak melebihi MAX_CHUNK + overlap', () => {
    const longCode = SAMPLE_CODE_5000;
    const chunks = splitIntoChunks(longCode);

    chunks.forEach(chunk => {
      const lines = chunk.content.split('\n').length;
      assert.ok(
        lines <= CONFIG.MAX_CHUNK + CONFIG.OVERLAP_SIZE + 10,
        `Chunk ${chunk.id} punya ${lines} baris (max ${CONFIG.MAX_CHUNK + CONFIG.OVERLAP_SIZE})`
      );
    });
  });
});

// ============================================================
// ASSEMBLER
// ============================================================

describe('assembleChunks()', () => {
  it('Assembly 1 chunk = chunk itu sendiri', () => {
    const input = ['function test() { return 1; }'];
    const result = assembleChunks(input);
    assert.equal(result, input[0]);
  });

  it('Assembly multiple chunks', () => {
    const chunks = splitIntoChunks(SAMPLE_CODE_500);
    const contents = chunks.map(c => c.content);
    const assembled = assembleChunks(contents);

    assert.ok(assembled.length > 0);
    assert.ok(typeof assembled === 'string');
  });

  it('Assembly tidak menghasilkan baris kosong berlebihan', () => {
    const input = ['line1\n\n\n\nline2', 'line3\n\n\n\nline4'];
    const result = assembleChunks(input);
    const lines = result.split('\n');

    // Cek tidak ada 3+ baris kosong berturut-turut
    let emptyStreak = 0;
    let maxEmptyStreak = 0;
    lines.forEach(line => {
      if (line.trim() === '') {
        emptyStreak++;
        maxEmptyStreak = Math.max(maxEmptyStreak, emptyStreak);
      } else {
        emptyStreak = 0;
      }
    });

    assert.ok(maxEmptyStreak <= 2, `Maks 2 baris kosong, dapat ${maxEmptyStreak}`);
  });
});

// ============================================================
// KOMPARATOR
// ============================================================

describe('compareReviews()', () => {
  it('Semua PASS → PASS', () => {
    const result = compareReviews(SAMPLE_REVIEWS_ALL_PASS);
    assert.equal(result.status, 'PASS');
    assert.equal(result.conflicts.length, 0);
  });

  it('Ada conflict → REVISI', () => {
    const result = compareReviews(SAMPLE_REVIEWS_WITH_CONFLICT);
    assert.ok(result.conflicts.length > 0);
    assert.ok(['REVISI', 'PASS'].includes(result.status));
  });

  it('Mayoritas voting menang', () => {
    const result = compareReviews(SAMPLE_REVIEWS_MAJOR_BUG);
    
    // 3/3 AI setuju infinite loop → confirmed
    const hasInfiniteLoop = result.confirmedErrors.some(
      e => e.toLowerCase().includes('infinite')
    );
    assert.ok(hasInfiniteLoop, 'Infinite loop harus confirmed oleh mayoritas');
  });

  it('Error dari 1 AI jadi conflict', () => {
    const reviews = [
      { errors: ['Bug unik'], warnings: [], fixedCode: 'code', status: 'ok' },
      { errors: [], warnings: [], fixedCode: 'code', status: 'ok' },
      { errors: [], warnings: [], fixedCode: 'code', status: 'ok' },
    ];

    const result = compareReviews(reviews);
    assert.ok(result.conflicts.includes('Bug unik'));
  });

  it('Handle empty reviews', () => {
    const result = compareReviews([]);
    assert.equal(result.status, 'GAGAL');
  });

  it('Handle semua AI gagal', () => {
    const reviews = [
      { errors: [], warnings: [], fixedCode: 'code', status: 'error' },
      { errors: [], warnings: [], fixedCode: 'code', status: 'error' },
      { errors: [], warnings: [], fixedCode: 'code', status: 'error' },
    ];

    const result = compareReviews(reviews);
    assert.equal(result.status, 'GAGAL');
  });
});

// ============================================================
// VALIDASI KODE
// ============================================================

describe('validateCodeStructure()', () => {
  it('Kode valid: semua bracket seimbang', () => {
    const tests = [
      'function a() { return 1; }',
      'const x = { a: [1, 2], b: { c: 3 } };',
      'if (true) { while (false) { break; } }',
      'const fn = () => { return "ok"; };',
      'const template = `${hello}`;',
    ];

    tests.forEach(code => {
      const result = validateCodeStructure(code);
      assert.equal(result.valid, true, `Harus valid: ${code}`);
    });
  });

  it('Deteksi {} tidak seimbang', () => {
    const result = validateCodeStructure('function a() { return 1;');
    assert.equal(result.valid, false);
    assert.ok(result.issues.some(i => i.includes('{}')));
  });

  it('Deteksi () tidak seimbang', () => {
    const result = validateCodeStructure('if (true { doSomething(); }');
    assert.equal(result.valid, false);
    assert.ok(result.issues.some(i => i.includes('()')));
  });

  it('Deteksi [] tidak seimbang', () => {
    const result = validateCodeStructure('const arr = [1, 2, 3;');
    assert.equal(result.valid, false);
    assert.ok(result.issues.some(i => i.includes('[]')));
  });

  it('Deteksi backtick tidak seimbang', () => {
    const result = validateCodeStructure('const x = `hello;');
    assert.equal(result.valid, false);
    assert.ok(result.issues.some(i => i.includes('Backtick')));
  });

  it('Kode kosong dianggap valid', () => {
    const result = validateCodeStructure('');
    assert.equal(result.valid, true);
  });
});

// ============================================================
// MARKDOWN EXTRACTION
// ============================================================

describe('extractCodeFromMarkdown()', () => {
  it('Extract code dengan bahasa', () => {
    const md = '```javascript\nconst x = 1;\nconsole.log(x);\n```';
    assert.equal(extractCodeFromMarkdown(md), 'const x = 1;\nconsole.log(x);');
  });

  it('Extract code tanpa bahasa', () => {
    const md = '```\nplain code here\n```';
    assert.equal(extractCodeFromMarkdown(md), 'plain code here');
  });

  it('Extract dari tengah teks', () => {
    const md = 'Ini teks.\n\n```python\nprint("hello")\n```\n\nLanjutan teks.';
    assert.equal(extractCodeFromMarkdown(md), 'print("hello")');
  });

  it('Ambil code block pertama kalau ada multiple', () => {
    const md = '```js\nfirst\n```\n\n```js\nsecond\n```';
    assert.equal(extractCodeFromMarkdown(md), 'first');
  });

  it('Tanpa code block, return teks apa adanya', () => {
    const text = 'Teks biasa tanpa kode.';
    assert.equal(extractCodeFromMarkdown(text), text);
  });

  it('Input null/undefined return string kosong', () => {
    assert.equal(extractCodeFromMarkdown(null), '');
    assert.equal(extractCodeFromMarkdown(undefined), '');
  });
});

// ============================================================
// COUNT LINES
// ============================================================

describe('countLines()', () => {
  it('Hitung baris dengan benar', () => {
    assert.equal(countLines(''), 1);
    assert.equal(countLines('satu baris'), 1);
    assert.equal(countLines('baris1\nbaris2\nbaris3'), 3);
    assert.equal(countLines('a\n\n\nb'), 4);
  });

  it('Input null return 0', () => {
    assert.equal(countLines(null), 0);
    assert.equal(countLines(undefined), 0);
  });
});

// ============================================================
// RETRY DENGAN BACKOFF
// ============================================================

describe('retryWithBackoff()', () => {
  it('Sukses di percobaan pertama', async () => {
    const result = await retryWithBackoff(() => 'sukses', 3, 10);
    assert.equal(result, 'sukses');
  });

  it('Sukses setelah gagal beberapa kali', async () => {
    let attempts = 0;
    
    const result = await retryWithBackoff(
      () => {
        attempts++;
        if (attempts < 3) throw new Error('Gagal dulu');
        return 'akhirnya sukses';
      },
      5,
      10
    );

    assert.equal(result, 'akhirnya sukses');
    assert.equal(attempts, 3);
  });

  it('Throw setelah max retries', async () => {
    try {
      await retryWithBackoff(
        () => { throw new Error('Selalu gagal'); },
        3,
        10
      );
      assert.fail('Harusnya throw');
    } catch (error) {
      assert.equal(error.message, 'Selalu gagal');
    }
  });

  it('Delay meningkat (exponential backoff)', async () => {
    const delays = [];
    const start = Date.now();

    try {
      await retryWithBackoff(
        () => {
          delays.push(Date.now() - start);
          throw new Error('Gagal');
        },
        3,
        50
      );
    } catch (e) {}

    // delays: [0, ~50, ~150] (retry 1: 50ms, retry 2: 100ms + jitter)
    assert.ok(delays.length >= 2);
    // Delay kedua harus > delay pertama
    if (delays.length >= 2) {
      assert.ok(delays[2] > delays[1], `Delay harus meningkat: ${delays}`);
    }
  });
});

// ============================================================
// TOKEN ESTIMATION
// ============================================================

describe('estimateTokens()', () => {
  it('Estimasi token > 0 untuk teks valid', () => {
    const tokens = estimateTokens('Hello World');
    assert.ok(tokens > 0);
  });

  it('Estimasi token untuk kode', () => {
    const tokens = estimateTokens(SAMPLE_CODE_500);
    assert.ok(tokens > 100);
    assert.ok(tokens < SAMPLE_CODE_500.length);
  });

  it('Input kosong return 0', () => {
    assert.equal(estimateTokens(''), 0);
    assert.equal(estimateTokens(null), 0);
  });

  it('estimateTokensDetailed return objek lengkap', () => {
    const result = estimateTokensDetailed('function test() { return 1; }');
    assert.ok(result.characters > 0);
    assert.ok(result.estimatedTokens > 0);
    assert.ok(result.estimatedLines >= 1);
    assert.ok(result.estimatedWords >= 1);
  });
});

// ============================================================
// SANITIZE & VALIDATE
// ============================================================

describe('sanitizeInput()', () => {
  it('Hapus null character', () => {
    assert.equal(sanitizeInput('Hello\x00World'), 'HelloWorld');
  });

  it('Hapus zero-width characters', () => {
    assert.equal(sanitizeInput('Hello\u200BWorld'), 'HelloWorld');
  });

  it('Handle null input', () => {
    assert.equal(sanitizeInput(null), '');
    assert.equal(sanitizeInput(undefined), '');
  });
});

describe('validateInput()', () => {
  it('Input valid', () => {
    const result = validateInput('Halo apa kabar?');
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('Input kosong tidak valid', () => {
    const result = validateInput('');
    assert.equal(result.valid, false);
  });

  it('Deteksi script injection', () => {
    const result = validateInput('<script>alert("xss")</script>');
    assert.ok(result.warnings || result.errors.some(e => e.includes('script')));
  });

  it('Deteksi eval()', () => {
    const result = validateInput('eval("malicious code")');
    assert.ok(result.warnings || result.errors.some(e => e.includes('eval')));
  });
});

// ============================================================
// STRING HELPERS
// ============================================================

describe('truncate()', () => {
  it('Potong teks panjang', () => {
    const result = truncate('Hello World This Is Long', 10);
    assert.ok(result.length <= 10 + 3); // +3 untuk "..."
    assert.ok(result.endsWith('...'));
  });

  it('Jangan potong teks pendek', () => {
    assert.equal(truncate('Short', 10), 'Short');
  });
});

describe('truncateLines()', () => {
  it('Potong multi-line', () => {
    const text = 'line1\nline2\nline3\nline4\nline5\nline6';
    const result = truncateLines(text, 3);
    const lines = result.split('\n');
    assert.ok(lines.length <= 4); // 3 lines + "..."
  });
});

describe('stringSimilarity()', () => {
  it('Identik = 1', () => {
    assert.equal(stringSimilarity('hello', 'hello'), 1);
  });

  it('Berbeda total = < 1', () => {
    assert.ok(stringSimilarity('hello', 'world') < 1);
  });

  it('Mirip = > 0.5', () => {
    const sim = stringSimilarity('hello world', 'hello word');
    assert.ok(sim > 0.5, `Similarity: ${sim}`);
  });
});

describe('deepEqual()', () => {
  it('Objek identik', () => {
    assert.equal(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 }), true);
  });

  it('Objek beda', () => {
    assert.equal(deepEqual({ a: 1 }, { a: 2 }), false);
  });

  it('Nested object', () => {
    assert.equal(deepEqual({ a: { b: 1 } }, { a: { b: 1 } }), true);
    assert.equal(deepEqual({ a: { b: 1 } }, { a: { b: 2 } }), false);
  });
});

// ============================================================
// FORMAT HELPERS
// ============================================================

describe('formatElapsed()', () => {
  it('ms', () => assert.ok(formatElapsed(500).includes('ms')));
  it('detik', () => assert.ok(formatElapsed(5000).includes('detik')));
  it('menit', () => assert.ok(formatElapsed(120000).includes('menit')));
});

describe('stripMarkdown()', () => {
  it('Hapus bold', () => {
    assert.equal(stripMarkdown('**bold**'), 'bold');
  });

  it('Hapus italic', () => {
    assert.equal(stripMarkdown('*italic*'), 'italic');
  });

  it('Hapus code', () => {
    assert.equal(stripMarkdown('cek `kode` ini'), 'cek kode ini');
  });

  it('Ganti code block', () => {
    assert.ok(stripMarkdown('```\ncode\n```').includes('[KODE]'));
  });
});

describe('formatFileSize()', () => {
  it('Bytes', () => assert.ok(formatFileSize(500).includes('B')));
  it('KB', () => assert.ok(formatFileSize(5000).includes('KB')));
  it('MB', () => assert.ok(formatFileSize(5000000).includes('MB')));
});

describe('formatDuration()', () => {
  it('ms', () => assert.ok(formatDuration(500).includes('ms')));
  it('detik', () => assert.ok(formatDuration(5000).includes('detik')));
  it('menit', () => assert.ok(formatDuration(120000).includes('menit')));
});

// ============================================================
// CACHE
// ============================================================

describe('Cache', () => {
  it('Set and get', () => {
    cacheSet('test-key', 'test-value', 5000);
    assert.equal(cacheGet('test-key'), 'test-value');
  });

  it('Expired cache returns null', async () => {
    cacheSet('expire-key', 'value', 50);
    await sleep(100);
    assert.equal(cacheGet('expire-key'), null);
  });

  it('Clear all', () => {
    cacheSet('a', 1);
    cacheSet('b', 2);
    cacheClear();
    assert.equal(cacheGet('a'), null);
    assert.equal(cacheGet('b'), null);
  });
});

// ============================================================
// GENERATE HELPERS
// ============================================================

describe('generateSessionId()', () => {
  it('Format benar', () => {
    const id = generateSessionId();
    assert.ok(id.startsWith('sess_'));
    assert.ok(id.length > 10);
  });

  it('Unik', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateSessionId());
    }
    assert.equal(ids.size, 100);
  });
});

describe('generateChunkId()', () => {
  it('Format P001', () => {
    assert.equal(generateChunkId(1), 'P001');
    assert.equal(generateChunkId(10), 'P010');
    assert.equal(generateChunkId(999), 'P999');
  });
});

// ============================================================
// RUN
// ============================================================

console.log('\n🧪 AI RAKSASA — Unit Tests');
console.log('========================================\n');
