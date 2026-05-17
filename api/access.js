export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { code } = req.body;
  if (!code) return res.status(400).json({ valid: false, error: 'Kode diperlukan' });

  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');

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
    const doc = await db.collection('access_codes').doc(code.trim().toUpperCase()).get();

    if (!doc.exists) {
      return res.json({ valid: false, error: 'Kode tidak ditemukan.' });
    }

    const data = doc.data();
    if (!data.active) {
      return res.json({ valid: false, error: 'Kode dinonaktifkan.' });
    }

    if (data.expires_at) {
      const now = new Date();
      const expires = data.expires_at.toDate();
      if (now > expires) {
        return res.json({ valid: false, error: 'Kode kadaluarsa.' });
      }
    }

    return res.json({ valid: true, type: data.type });
  } catch (error) {
    return res.status(500).json({ valid: false, error: error.message });
  }
}
