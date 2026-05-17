export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, password, data } = req.body;
  if (!password) return res.status(400).json({ error: 'Password diperlukan' });

  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID || 'rhf-confrims',
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
      });
    }

    const db = getFirestore();

    // Verifikasi password
    const adminDoc = await db.collection('admin').doc('config').get();
    const adminPassword = adminDoc.exists ? adminDoc.data().password : 'admin123';

    if (password !== adminPassword) {
      return res.status(403).json({ error: 'Password admin salah.' });
    }

    switch (action) {
      // ── UBAH PASSWORD ──
      case 'changePassword': {
        const newPass = data?.newPassword;
        if (!newPass || newPass.length < 6) return res.json({ error: 'Password minimal 6 karakter.' });
        await db.collection('admin').doc('config').set({ password: newPass }, { merge: true });
        return res.json({ success: true, message: 'Password berhasil diubah.' });
      }

      // ── BUAT KODE AKSES ──
      case 'createCode': {
        const { code, type, duration } = data || {};
        if (!code) return res.json({ error: 'Kode diperlukan.' });
        const expires = type === 'trial' && duration ? new Date(Date.now() + duration * 1000) : null;
        await db.collection('access_codes').doc(code.toUpperCase()).set({
          code: code.toUpperCase(), type, duration: duration || null,
          active: true, used_by: null,
          created_at: FieldValue.serverTimestamp(),
          expires_at: expires || null
        });
        return res.json({ success: true, code: code.toUpperCase() });
      }

      // ── HAPUS/NONAKTIFKAN KODE ──
      case 'deleteCode': {
        await db.collection('access_codes').doc(data.code.toUpperCase()).update({ active: false });
        return res.json({ success: true });
      }

      // ── LIST KODE ──
      case 'listCodes': {
        const snap = await db.collection('access_codes').orderBy('created_at', 'desc').limit(50).get();
        const codes = [];
        snap.forEach(doc => {
          const d = doc.data();
          codes.push({
            code: d.code, type: d.type, active: d.active,
            used_by: d.used_by, created_at: d.created_at?.toDate?.()?.toISOString(),
            expires_at: d.expires_at?.toDate?.()?.toISOString()
          });
        });
        return res.json({ success: true, codes });
      }

      // ── LIST USER ──
      case 'listUsers': {
        const snap = await db.collection('users').limit(50).get();
        const users = [];
        snap.forEach(doc => users.push({ uid: doc.id, ...doc.data() }));
        return res.json({ success: true, users });
      }

      // ── BLOKIR USER ──
      case 'blockUser': {
        await db.collection('users').doc(data.uid).update({ blocked: true });
        return res.json({ success: true });
      }

      default:
        return res.json({ error: 'Action tidak dikenal.' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
    }
