// ============================================================
// AI RAKSASA — Entry Point / API Server
// Deploy: Vercel Serverless Function
// ============================================================

import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { createOrchestrator } from './orchestrator.js';
import { getChatHistory } from '../memory.js';
import { getDownloadFile } from '../output.js';
import { logProgress } from '../utils.js';
import { CONFIG } from './config.js';

const app = express();   // ← INI HARUS ADA

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files (UI)
app.use(express.static('public'));

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    name: 'AI Raksasa',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// CHAT ENDPOINT (UTAMA)
// ============================================================

app.post('/api/chat', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { message, sessionId, files, forceMode } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Pesan tidak boleh kosong', mode: 'error' });
    }

    if (message.length > 50000) {
      return res.status(400).json({ error: 'Pesan terlalu panjang (maks 50.000 karakter)', mode: 'error' });
    }

    const session = sessionId || 'sess_' + Date.now();
    logProgress('REQUEST', `Sesi: ${session} | ${message.substring(0, 80)}...`);

    const orchestrator = createOrchestrator(session);
    const result = await orchestrator.handle(message, { files, forceMode });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    res.json({
      ...result,
      sessionId: session,
      elapsed: elapsed + ' detik',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    logProgress('ERROR', error.message);
    res.status(500).json({
      mode: 'error',
      response: 'Maaf, terjadi kesalahan.',
      error: process.env.APP_ENV === 'development' ? error.message : null,
      sessionId: req.body?.sessionId || null,
    });
  }
});

// ============================================================
// DOWNLOAD ENDPOINT
// ============================================================

app.get('/api/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const file = await getDownloadFile(fileId);

    if (!file) {
      return res.status(404).json({ error: 'File tidak ditemukan' });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.content);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengunduh file' });
  }
});

// ============================================================
// HISTORY ENDPOINT
// ============================================================

app.get('/api/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const history = await getChatHistory(sessionId);

    if (!history) {
      return res.status(404).json({ error: 'Sesi tidak ditemukan' });
    }

    res.json({ sessionId, messageCount: history.length, messages: history });
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil riwayat' });
  }
});

// ============================================================
// TEST ENDPOINT
// ============================================================

app.post('/api/test', async (req, res) => {
  try {
    const { type } = req.body;
    const results = {};

    if (!type || type === 'all' || type === 'splitter') {
      const { splitIntoChunks } = await import('../core.js');   // ← PERBAIKI
      const sampleCode = 'function test() {\n  console.log("hello");\n}\n'.repeat(100);
      const chunks = splitIntoChunks(sampleCode);
      results.splitter = { status: 'ok', chunkCount: chunks.length };
    }

    if (!type || type === 'all' || type === 'detector') {
      const { detectIntent } = await import('../core.js');      // ← PERBAIKI
      const testCases = [
        { input: 'Halo apa kabar?', expected: 'santai' },
        { input: 'Buatkan fungsi sorting array', expected: 'serius' },
      ];
      results.detector = {
        status: 'ok',
        tests: testCases.map(tc => ({
          input: tc.input,
          result: detectIntent(tc.input),
          expected: tc.expected,
          pass: detectIntent(tc.input) === tc.expected,
        })),
      };
    }

    if (!type || type === 'all' || type === 'config') {
      results.config = {
        status: 'ok',
        chunkSize: CONFIG.CHUNK_SIZE,
        overlapSize: CONFIG.OVERLAP_SIZE,
      };
    }

    res.json({ status: 'ok', results, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// ============================================================
// 404 + ERROR HANDLER
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint tidak ditemukan',
    endpoints: ['GET /api/health', 'POST /api/chat', 'GET /api/download/:fileId', 'GET /api/history/:sessionId', 'POST /api/test'],
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================
// EXPORT + STANDALONE
// ============================================================

export default app;

const isStandalone = !process.env.VERCEL;
if (isStandalone) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log('⚡ AI RAKSASA — http://localhost:' + PORT));
  }
