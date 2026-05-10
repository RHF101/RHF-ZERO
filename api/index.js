export default function handler(req, res) {
  res.status(200).json({
    status: 'online',
    name: 'AI Raksasa',
    timestamp: new Date().toISOString()
  });
}
