// ============================================================
// RHF ZERO — api/access.js
// Validasi kode akses dari Firestore
// ============================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.body;
  if (!code) return res.status(400).json({ valid: false, error: 'Kode diperlukan' });

  const cleanCode = code.trim().toUpperCase();

  try {
    // Ambil data dari Firestore via REST API
    const FB_KEY = process.env.FIREBASE_API_KEY;
    const FB_PROJECT = process.env.FIREBASE_PROJECT_ID || 'rhf-confrims';
    const url = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/access_codes/${cleanCode}?key=${FB_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    // Kalau dokumen tidak ditemukan
    if (data.error && data.error.code === 404) {
      return res.json({ valid: false, error: 'Kode tidak ditemukan.' });
    }

    if (!data.fields) {
      return res.json({ valid: false, error: 'Kode tidak valid.' });
    }

    const fields = data.fields;

    // Cek apakah kode aktif
    const active = fields.active?.booleanValue;
    if (active === false) {
      return res.json({ valid: false, error: 'Kode dinonaktifkan.' });
    }

    // Cek kadaluarsa (kalau trial)
    if (fields.expires_at?.timestampValue) {
      const expiresAt = new Date(fields.expires_at.timestampValue);
      if (new Date() > expiresAt) {
        return res.json({ valid: false, error: 'Kode sudah kadaluarsa.' });
      }
    }

    // Kode valid
    return res.json({
      valid: true,
      type: fields.type?.stringValue || 'trial',
      expires_at: fields.expires_at?.timestampValue || null
    });

  } catch (error) {
    console.error('Access Error:', error.message);
    return res.status(500).json({ valid: false, error: 'Gagal memvalidasi kode.' });
  }
}
