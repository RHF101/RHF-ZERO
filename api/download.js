export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, filename } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Kode tidak boleh kosong' });
  }

  const safeFilename = (filename || 'kode.txt')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 100);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.send(code);
}
