import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', name: 'AI Raksasa', timestamp: new Date().toISOString() });
});

// Chat
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message) return res.status(400).json({ error: 'Pesan kosong' });

    // Test response dulu
    res.json({
      mode: 'santai',
      response: 'Halo! Aku AI Raksasa. API berhasil terhubung. Silakan kirim pesan.',
      sessionId: sessionId || 'test',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route tidak ditemukan' });
});

export default app;
