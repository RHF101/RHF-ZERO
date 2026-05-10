// ============================================================
// AI RAKSASA — Entry Point / API Server
// Deploy: Vercel Serverless Function
// ============================================================

import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { createOrchestrator } from './ai/orchestrator.js';
import { getSession, getChatHistory } from './memory.js';
import { generateDownloadUrl, getDownloadFile } from './output.js';
import { logProgress } from './utils.js';
import { CONFIG } from './config.js';

const app = express();

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
    mode: process.env.APP_ENV || 'development',
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

    // Validasi input
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Pesan tidak boleh kosong',
        mode: 'error'
      });
    }

    if (message.length > 50000) {
      return res.status(400).json({
        error: 'Pesan terlalu panjang (maks 50.000 karakter)',
        mode: 'error'
      });
    }

    const session = sessionId || 'sess_' + Date.now();

    logProgress('REQUEST', `Sesi: ${session} | ${message.substring(0, 80)}...`);

    // Buat orchestrator
    const orchestrator = createOrchestrator(session);

    // Jalankan
    const result = await orchestrator.handle(message, { files, forceMode });

    // Tambah metadata response
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
      response: 'Maaf, terjadi kesalahan. Silakan coba lagi.',
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
      return res.status(404).json({ error: 'File tidak ditemukan atau sudah kadaluarsa' });
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

    res.json({
      sessionId,
      messageCount: history.length,
      messages: history,
    });
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
      // Test splitter
      const { splitIntoChunks } = await import('./core.js');
      const sampleCode = 'function test() {\n  console.log("hello");\n}\n'.repeat(100);
      const chunks = splitIntoChunks(sampleCode);
      results.splitter = {
        status: 'ok',
        chunkCount: chunks.length,
        avgSize: Math.round(chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length),
      };
    }

    if (!type || type === 'all' || type === 'detector') {
      // Test detector
      const { detectIntent } = await import('./core.js');
      const testCases = [
        { input: 'Halo apa kabar?', expected: 'santai' },
        { input: 'Buatkan fungsi untuk sorting array', expected: 'serius' },
        { input: 'Tolong tulis kode Python', expected: 'serius' },
        { input: 'Bagaimana cuaca hari ini?', expected: 'santai' },
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
      // Test config
      results.config = {
        status: 'ok',
        chunkSize: CONFIG.CHUNK_SIZE,
        overlapSize: CONFIG.OVERLAP_SIZE,
        mode: process.env.APP_ENV || 'development',
      };
    }

    res.json({
      status: 'ok',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
    });
  }
});

// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint tidak ditemukan',
    availableEndpoints: [
      'GET  /api/health',
      'POST /api/chat',
      'GET  /api/download/:fileId',
      'GET  /api/history/:sessionId',
      'POST /api/test',
    ],
  });
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.APP_ENV === 'development' ? err.message : null,
  });
});

// ============================================================
// EXPORT FOR VERCEL SERVERLESS
// ============================================================

export default app;

// ============================================================
// STANDALONE MODE (npm run dev / npm start)
// ============================================================

if (process.env.NODE_ENV !== 'production' || process.env.STANDALONE === 'true') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log('⚡ AI RAKSASA — Server berjalan');
    console.log(`   URL: http://localhost:${PORT}`);
    console.log(`   Chat: http://localhost:${PORT}/api/chat`);
    console.log(`   UI: http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log('');
  });
                                             }
