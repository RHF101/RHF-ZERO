// api/admin.js - DATABASE ENV VERCEL
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, password, data } = req.body;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

  if (password !== ADMIN_PASSWORD) {
    return res.status(403).json({ error: 'Password salah' });
  }

  // Ambil database dari ENV
  let db;
  try {
    db = JSON.parse(process.env.ADMIN_DATA || '{"codes":[],"users":[]}');
  } catch(e) {
    db = { codes: [], users: [] };
  }

  try {
    if (action === 'createCode') {
      const code = data.code.trim().toUpperCase();
      if (!code) return res.json({ error: 'Kode kosong' });
      if (db.codes.find(c => c.code === code)) return res.json({ error: 'Kode sudah ada' });
      
      db.codes.push({
        code, type: data.type || 'trial',
        active: true, used_by: null,
        created_at: new Date().toISOString(),
        expires_at: data.type === 'trial' ? new Date(Date.now() + (data.duration || 3600) * 1000).toISOString() : null
      });
    }

    else if (action === 'deleteCode') {
      const code = data.code.trim().toUpperCase();
      const found = db.codes.find(c => c.code === code);
      if (found) found.active = false;
    }

    else if (action === 'listCodes') {
      return res.json(db.codes);
    }

    else if (action === 'blockUser') {
      const user = db.users.find(u => u.uid === data.uid);
      if (user) user.blocked = true;
      else db.users.push({ uid: data.uid, blocked: true });
    }

    else if (action === 'unblockUser') {
      const user = db.users.find(u => u.uid === data.uid);
      if (user) user.blocked = false;
    }

    else if (action === 'listUsers') {
      return res.json(db.users);
    }

    // Simpan ke ENV (via response, karena gak bisa update ENV langsung)
    return res.json({ success: true, data: db });
    
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
