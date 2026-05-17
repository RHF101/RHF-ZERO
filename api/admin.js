export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, password, data } = req.body;
  if (!password) return res.status(400).json({ error: 'Password diperlukan' });

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Password salah.' });
  }

  // Database dari ENV
  let db = { codes: [], users: [] };
  try {
    const raw = process.env.ADMIN_DATA || '{"codes":[],"users":[]}';
    db = JSON.parse(raw);
  } catch(e) {}

  try {
    switch (action) {
      case 'createCode': {
        const code = (data?.code || '').trim().toUpperCase();
        if (!code) return res.json({ error: 'Kode diperlukan.' });
        if (db.codes.find(c => c.code === code)) return res.json({ error: 'Kode sudah ada.' });

        const type = data?.type || 'trial';
        const duration = type === 'trial' ? (data?.duration || 3600) : null;
        const expires = duration ? new Date(Date.now() + duration * 1000).toISOString() : null;

        db.codes.push({
          code, type, duration,
          active: true, used_by: null,
          created_at: new Date().toISOString(),
          expires_at: expires
        });

        // Simpan ke ENV — tidak bisa, tapi kita return data ke user untuk disimpan manual
        // Untuk sekarang, kita simpan di memory aja
        return res.json({ 
          success: true, 
          code,
          warning: 'Simpan kode ini. ENV belum bisa diupdate otomatis.',
          codes: db.codes
        });
      }

      case 'deleteCode': {
        const code = (data?.code || '').trim().toUpperCase();
        const found = db.codes.find(c => c.code === code);
        if (found) found.active = false;
        return res.json({ success: true, codes: db.codes });
      }

      case 'listCodes': {
        return res.json({ success: true, codes: db.codes });
      }

      case 'listUsers': {
        return res.json({ success: true, users: db.users });
      }

      case 'blockUser': {
        const uid = data?.uid;
        const user = db.users.find(u => u.uid === uid);
        if (user) user.blocked = true;
        else db.users.push({ uid, blocked: true, email: '', accessCode: '' });
        return res.json({ success: true, users: db.users });
      }

      case 'unblockUser': {
        const uid = data?.uid;
        const user = db.users.find(u => u.uid === uid);
        if (user) user.blocked = false;
        return res.json({ success: true, users: db.users });
      }

      default:
        return res.json({ error: 'Action tidak dikenal.' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
