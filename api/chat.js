export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Pesan kosong' });
  }

  // Untuk test: balas dummy
  return res.json({
    mode: 'santai',
    response: `Kamu bilang: "${message}". API berhasil terhubung!`,
    sessionId: 'test',
    timestamp: new Date().toISOString()
  });
}
