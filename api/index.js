export default function handler(req, res) {
  res.json({
    status: 'online',
    name: 'AI Raksasa',
    path: req.url,
    timestamp: new Date().toISOString()
  });
}
