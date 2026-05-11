import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'online', name: 'AI Raksasa', timestamp: new Date().toISOString() });
});

// Chat
app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    res.json({
      mode: 'santai',
      response: 'Halo! API berhasil terhubung.',
      sessionId: sessionId || '',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default app;
