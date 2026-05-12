export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Pesan kosong' });
  }

  return res.json({
    mode: 'santai',
    response: 'Kamu bilang: "' + message + '". Debug berhasil!'
  });
}
