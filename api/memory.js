// api/memory.js — RHF ZERO Memory Layer (Firestore REST API)
// Handles: createChat, getChats, deleteChat, saveMessage, getMessages
// Endpoint handler: POST /api/memory

const FIREBASE_API_KEY = 'AIzaSyDKlLibZlP5FlFcgPV1lM_8ykMz1RuXbvA';
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/rhf-zero-26ad2/databases/(default)/documents';

// ════════════════════════════════════════════════════════
// HELPER: Firestore value encoder/decoder
// ════════════════════════════════════════════════════════

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = encodeValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function encodeDocument(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = encodeValue(v);
  }
  return { fields };
}

function decodeValue(val) {
  if (!val) return null;
  if ('nullValue' in val) return null;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('stringValue' in val) return val.stringValue;
  if ('timestampValue' in val) return new Date(val.timestampValue).getTime();
  if ('arrayValue' in val) return (val.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in val) return decodeDocument(val.mapValue);
  return null;
}

function decodeDocument(doc) {
  if (!doc || !doc.fields) return {};
  const result = {};
  for (const [k, v] of Object.entries(doc.fields)) {
    result[k] = decodeValue(v);
  }
  // Ekstrak ID dari name path jika ada
  if (doc.name) {
    const parts = doc.name.split('/');
    result._id = parts[parts.length - 1];
  }
  return result;
}

// ════════════════════════════════════════════════════════
// HELPER: Firestore REST requests
// ════════════════════════════════════════════════════════

async function fsGet(path) {
  const url = `${FIRESTORE_BASE}/${path}?key=${FIREBASE_API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) {
    if (r.status === 404) return null;
    throw new Error(`Firestore GET failed: ${r.status} ${await r.text()}`);
  }
  return r.json();
}

async function fsPatch(path, data, updateMask) {
  let url = `${FIRESTORE_BASE}/${path}?key=${FIREBASE_API_KEY}`;
  if (updateMask && updateMask.length > 0) {
    url += '&' + updateMask.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  }
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(encodeDocument(data))
  });
  if (!r.ok) throw new Error(`Firestore PATCH failed: ${r.status} ${await r.text()}`);
  return r.json();
}

async function fsPost(path, data) {
  const url = `${FIRESTORE_BASE}/${path}?key=${FIREBASE_API_KEY}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(encodeDocument(data))
  });
  if (!r.ok) throw new Error(`Firestore POST failed: ${r.status} ${await r.text()}`);
  return r.json();
}

async function fsDelete(path) {
  const url = `${FIRESTORE_BASE}/${path}?key=${FIREBASE_API_KEY}`;
  const r = await fetch(url, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) throw new Error(`Firestore DELETE failed: ${r.status}`);
  return true;
}

async function fsList(path) {
  const url = `${FIRESTORE_BASE}/${path}?key=${FIREBASE_API_KEY}&pageSize=200`;
  const r = await fetch(url);
  if (!r.ok) {
    if (r.status === 404) return [];
    throw new Error(`Firestore LIST failed: ${r.status} ${await r.text()}`);
  }
  const data = await r.json();
  return (data.documents || []).map(decodeDocument);
}

// ════════════════════════════════════════════════════════
// PUBLIC API FUNCTIONS
// ════════════════════════════════════════════════════════

/**
 * createChat — Buat/update chat room (idempoten via PATCH)
 */
async function createChat(uid, chatId, { title = 'Chat Baru', mode = 'santai' } = {}) {
  const path = `users/${uid}/chats/${chatId}`;
  const now = Date.now();
  const data = { title, mode, updatedAt: now, createdAt: now };
  await fsPatch(path, data);
  return { _id: chatId, ...data };
}

/**
 * getChats — Ambil semua chat rooms user, sorted by updatedAt desc
 */
async function getChats(uid) {
  const docs = await fsList(`users/${uid}/chats`);
  docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return docs;
}

/**
 * deleteChat — Hapus chat room + semua messages-nya
 */
async function deleteChat(uid, chatId) {
  // Hapus semua messages dulu
  try {
    const messages = await fsList(`users/${uid}/chats/${chatId}/messages`);
    for (const msg of messages) {
      if (msg._id) {
        await fsDelete(`users/${uid}/chats/${chatId}/messages/${msg._id}`);
      }
    }
  } catch (e) {
    console.error('[deleteChat] Error deleting messages:', e.message);
  }
  // Hapus chat room
  await fsDelete(`users/${uid}/chats/${chatId}`);
  return true;
}

/**
 * saveMessage — Simpan pesan ke subcollection messages (auto-generated ID)
 */
async function saveMessage(uid, chatId, { role, content, format = 'txt', mode = 'santai' } = {}) {
  const path = `users/${uid}/chats/${chatId}/messages`;
  const now = Date.now();
  const data = { role, content, format, mode, timestamp: now };

  // POST ke collection untuk auto-generated ID
  const doc = await fsPost(path, data);

  // Update updatedAt di parent chat
  try {
    await fsPatch(`users/${uid}/chats/${chatId}`, { updatedAt: now }, ['updatedAt']);
  } catch (e) {
    // Non-fatal
  }

  return decodeDocument(doc);
}

/**
 * getMessages — Ambil semua messages dari sebuah chat, sorted by timestamp
 */
async function getMessages(uid, chatId) {
  const docs = await fsList(`users/${uid}/chats/${chatId}/messages`);
  docs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  return docs;
}

// ════════════════════════════════════════════════════════
// HANDLER: POST /api/memory (Next.js serverless)
// ════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, uid, chatId, data } = req.body;

  if (!uid) return res.status(400).json({ error: 'UID diperlukan' });
  if (!action) return res.status(400).json({ error: 'Action diperlukan' });

  try {
    switch (action) {
      case 'createChat': {
        if (!chatId) return res.status(400).json({ error: 'chatId diperlukan' });
        const result = await createChat(uid, chatId, data || {});
        return res.json({ ok: true, chat: result });
      }

      case 'getChats': {
        const chats = await getChats(uid);
        return res.json({ ok: true, chats });
      }

      case 'deleteChat': {
        if (!chatId) return res.status(400).json({ error: 'chatId diperlukan' });
        await deleteChat(uid, chatId);
        return res.json({ ok: true });
      }

      case 'saveMessage': {
        if (!chatId) return res.status(400).json({ error: 'chatId diperlukan' });
        if (!data) return res.status(400).json({ error: 'data pesan diperlukan' });
        const msg = await saveMessage(uid, chatId, data);
        return res.json({ ok: true, message: msg });
      }

      case 'getMessages': {
        if (!chatId) return res.status(400).json({ error: 'chatId diperlukan' });
        const messages = await getMessages(uid, chatId);
        return res.json({ ok: true, messages });
      }

      default:
        return res.status(400).json({ error: `Action tidak dikenal: ${action}` });
    }
  } catch (err) {
    console.error('[memory.js] Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// Export untuk dipakai chat.js
export { saveMessage, createChat };
