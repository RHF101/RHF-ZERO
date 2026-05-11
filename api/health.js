export default function handler(req, res) {
  res.json({
    status: 'online',
    name: 'AI Raksasa',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}
