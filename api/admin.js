export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, password, data } = req.body;

  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');

    if (getApps().length === 0) {
      const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID || 'rhf-confrims',
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
          privateKey: privateKey,
        }),
      });
    }

    const db = getFirestore();

    // Ambil password dari Firestore, kalau belum ada, buat default
    const adminRef = db.collection('admin').doc('config');
    const adminDoc = await adminRef.get();
    
    let adminPassword = 'admin123';
    if (adminDoc.exists && adminDoc.data().password) {
      adminPassword = adminDoc.data().password;
    } else {
      await adminRef.set({ password: 'admin123' });
    }

    // VERIFIKASI PASSWORD
    if (password !== adminPassword) {
      return res.status(403).json({ error: 'Password salah.' });
    }

    switch (action) {
      case 'changePassword': {
        const newPass = data?.newPassword;
        if (!newPass || newPass.length < 6) return res.json({ error: 'Minimal 6 karakter.' });
        await adminRef.update({ password: newPass });
        return res.json({ success: true });
      }

      case 'createCode': {
        const code = (data?.code || '').trim().toUpperCase();
        if (!code) return res.json({ error: 'Kode diperlukan.' });
        const type = data?.type || 'trial';
        const duration = type === 'trial' ? (data?.duration || 3600) : null;
        const expires = duration ? new Date(Date.now() + duration * 1000) : null;

        await db.collection('access_codes').doc(code).set({
          code, type, duration,
          active: true, used_by: null,
          created_at: FieldValue.serverTimestamp(),
          expires_at: expires || null
        });
        return res.json({ success: true, code });
      }

      case 'deleteCode': {
        const code = (data?.code || '').trim().toUpperCase();
        await db.collection('access_codes').doc(code).update({ active: false });
        return res.json({ success: true });
      }

      case 'listCodes': {
        const snap = await db.collection('access_codes').orderBy('created_at', 'desc').limit(50).get();
        const codes = [];
        snap.forEach(doc => {
          const d = doc.data();
          codes.push({
            code: d.code, type: d.type, active: d.active,
            used_by: d.used_by,
            created_at: d.created_at?.toDate?.()?.toISOString(),
            expires_at: d.expires_at?.toDate?.()?.toISOString()
          });
        });
        return res.json({ success: true, codes });
      }

      case 'listUsers': {
        const snap = await db.collection('users').limit(50).get();
        const users = [];
        snap.forEach(doc => users.push({ uid: doc.id, ...doc.data() }));
        return res.json({ success: true, users });
      }

      case 'blockUser': {
        await db.collection('users').doc(data?.uid).update({ blocked: true });
        return res.json({ success: true });
      }

      default:
        return res.json({ error: 'Action tidak dikenal.' });
    }
  } catch (error) {
    console.error('Admin Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
