import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ============================================================
// HEALTH CHECK — PASTI JALAN
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
// LOAD MODULES DENGAN TRY-CATCH (SUPAYA TIDAK CRASH)
// ============================================================
let createOrchestrator, getChatHistory, getDownloadFile, logProgress, CONFIG;

try {
  const orchestratorModule = await import('./orchestrator.js');
  createOrchestrator = orchestratorModule.createOrchestrator;
  console.log('✅ orchestrator loaded');
} catch (e) {
  console.error('❌ orchestrator gagal:', e.message);
}

try {
  const memoryModule = await import('../memory.js');
  getChatHistory = memoryModule.getChatHistory;
  console.log('✅ memory loaded');
} catch (e) {
  console.error('❌ memory gagal:', e.message);
}

try {
  const outputModule = await import('../output.js');
  getDownloadFile = outputModule.getDownloadFile;
  console.log('✅ output loaded');
} catch (e) {
  console.error('❌ output gagal:', e.message);
}

try {
  const utilsModule = await import('../utils.js');
  logProgress = utilsModule.logProgress;
  console.log('✅ utils loaded');
} catch (e) {
  console.error('❌ utils gagal:', e.message);
}

try {
  const configModule = await import('./config.js');
  CONFIG = configModule.CONFIG;
  console.log('✅ config loaded');
} catch (e) {
  console.error('❌ config gagal:', e.message);
}

// ============================================================
// CHAT ENDPOINT — HANYA JALAN KALAU MODULE LENGKAP
// ============================================================
app.post('/api/chat', async (req, res) => {
  if (!createOrchestrator) {
    return res.status(500).json({ error: 'Orchestrator tidak tersedia. Periksa API keys.' });
  }

  try {
    const { message, sessionId, files, forceMode } = req.body;
    if (!message) return res.status(400).json({ error: 'Pesan kosong' });

    const session = sessionId || 'sess_' + Date.now();
    if (logProgress) logProgress('REQUEST', session.substring(0, 12));

    const orchestrator = createOrchestrator(session);
    const result = await orchestrator.handle(message, { files, forceMode });

    res.json({ ...result, sessionId: session });
  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// DOWNLOAD ENDPOINT
// ============================================================
app.get('/api/download/:fileId', async (req, res) => {
  if (!getDownloadFile) return res.status(500).json({ error: 'Download tidak tersedia' });
  try {
    const file = await getDownloadFile(req.params.fileId);
    if (!file) return res.status(404).json({ error: 'File tidak ditemukan' });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.content);
  } catch (e) {
    res.status(500).json({ error: 'Gagal download' });
  }
});

// ============================================================
// HISTORY ENDPOINT
// ============================================================
app.get('/api/history/:sessionId', async (req, res) => {
  if (!getChatHistory) return res.status(500).json({ error: 'History tidak tersedia' });
  try {
    const history = await getChatHistory(req.params.sessionId);
    if (!history) return res.status(404).json({ error: 'Sesi tidak ditemukan' });
    res.json({ sessionId: req.params.sessionId, messageCount: history.length, messages: history });
  } catch (e) {
    res.status(500).json({ error: 'Gagal ambil history' });
  }
});

// ============================================================
// 404 HANDLER
// ============================================================
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

// ============================================================
// EXPORT
// ============================================================
export default app;
