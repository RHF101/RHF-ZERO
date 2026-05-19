// api/memory.js — RHF ZERO Memory Handler (Firebase Firestore REST API)

const FIREBASE_BASE = 'https://firestore.googleapis.com/v1/projects/rhf-confrims/databases/(default)/documents';
const API_KEY = 'AIzaSyDNFXLa8WGAqhLnc8RrLLTgP3nLWvXkd1w';

// ── HELPER: Firestore REST ──
async function firestoreRequest(path, method = 'GET', body = null) {
  const url = `${FIREBASE_BASE}${path}?key=${API_KEY}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Firestore error ${res.status}: ${err}`);
  }
  // DELETE returns empty body
  if (method === 'DELETE') return null;
  return res.json();
}

// ── HELPER: Convert JS value → Firestore field ──
function toFirestoreField(val) {
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') return { integerValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (val === null || val === undefined) return { nullValue: null };
  return { stringValue: String(val) };
}

// ── HELPER: Convert Firestore field → JS value ──
function fromFirestoreField(field) {
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.integerValue !== undefined) return Number(field.integerValue);
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.nullValue !== undefined) return null;
  return null;
}

// ── HELPER: Convert Firestore document → plain object ──
function fromFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const obj = {};
  for (const [key, val] of Object.entries(doc.fields)) {
    obj[key] = fromFirestoreField(val);
  }
  // Extract ID from doc.name (last segment)
  if (doc.name) obj._id = doc.name.split('/').pop();
  return obj;
}

// ── ACTIONS ──

// createChat: buat room chat baru
async function createChat(uid, chatId, data = {}) {
  const title = data.title || 'Chat Baru';
  const timestamp = Date.now();
  const docBody = {
    fields: {
      title: toFirestoreField(title),
      createdAt: toFirestoreField(timestamp),
      updatedAt: toFirestoreField(timestamp),
      mode: toFirestoreField(data.mode || 'santai'),
    }
  };
  // Use chatId as document ID
  const result = await firestoreRequest(
    `/users/${uid}/chats/${chatId}`,
    'PATCH',
    docBody
  );
  return { success: true, chatId, doc: fromFirestoreDoc(result) };
}

// getChats: ambil semua chat rooms user (urut updatedAt desc)
async function getChats(uid) {
  const url = `${FIREBASE_BASE}/users/${uid}/chats?key=${API_KEY}&orderBy=updatedAt+desc&pageSize=50`;
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`getChats error ${res.status}`);
  const data = await res.json();
  const docs = (data.documents || []).map(fromFirestoreDoc).filter(Boolean);
  // Sort by updatedAt desc (Firestore orderBy may require index, fallback sort)
  docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return { success: true, chats: docs };
}

// deleteChat: hapus chat room + semua messages
async function deleteChat(uid, chatId) {
  // 1. Hapus semua messages dalam chatId
  const msgsUrl = `${FIREBASE_BASE}/users/${uid}/chats/${chatId}/messages?key=${API_KEY}&pageSize=300`;
  const msgsRes = await fetch(msgsUrl, { headers: { 'Content-Type': 'application/json' } });
  if (msgsRes.ok) {
    const msgsData = await msgsRes.json();
    const docs = msgsData.documents || [];
    for (const doc of docs) {
      const msgPath = '/' + doc.name.split('/documents/')[1];
      await firestoreRequest(msgPath, 'DELETE').catch(() => {});
    }
  }
  // 2. Hapus chat document
  await firestoreRequest(`/users/${uid}/chats/${chatId}`, 'DELETE');
  return { success: true, chatId };
}

// saveMessage: simpan pesan ke chat room
async function saveMessage(uid, chatId, data = {}) {
  const msgId = data.msgId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = Date.now();
  const docBody = {
    fields: {
      role: toFirestoreField(data.role || 'user'),
      content: toFirestoreField(data.content || ''),
      timestamp: toFirestoreField(timestamp),
      format: toFirestoreField(data.format || 'txt'),
      mode: toFirestoreField(data.mode || 'santai'),
    }
  };
  // Simpan pesan
  await firestoreRequest(
    `/users/${uid}/chats/${chatId}/messages/${msgId}`,
    'PATCH',
    docBody
  );
  // Update updatedAt di chat room
  const chatUpdate = {
    fields: {
      updatedAt: toFirestoreField(timestamp),
      lastMessage: toFirestoreField((data.content || '').substring(0, 80)),
    }
  };
  await firestoreRequest(
    `/users/${uid}/chats/${chatId}?updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=lastMessage`,
    'PATCH',
    chatUpdate
  ).catch(() => {});
  return { success: true, msgId };
}

// getMessages: ambil semua pesan dari chat room
async function getMessages(uid, chatId) {
  const url = `${FIREBASE_BASE}/users/${uid}/chats/${chatId}/messages?key=${API_KEY}&pageSize=200`;
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`getMessages error ${res.status}`);
  const data = await res.json();
  const docs = (data.documents || []).map(fromFirestoreDoc).filter(Boolean);
  // Sort by timestamp asc
  docs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  return { success: true, messages: docs };
}

// ── MAIN HANDLER ──
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, uid, chatId, data } = req.body || {};

  if (!uid) return res.status(400).json({ error: 'uid diperlukan' });
  if (!action) return res.status(400).json({ error: 'action diperlukan' });

  try {
    switch (action) {
      case 'createChat':
        return res.json(await createChat(uid, chatId || `chat_${Date.now()}`, data || {}));
      case 'getChats':
        return res.json(await getChats(uid));
      case 'deleteChat':
        if (!chatId) return res.status(400).json({ error: 'chatId diperlukan' });
        return res.json(await deleteChat(uid, chatId));
      case 'saveMessage':
        if (!chatId) return res.status(400).json({ error: 'chatId diperlukan' });
        return res.json(await saveMessage(uid, chatId, data || {}));
      case 'getMessages':
        if (!chatId) return res.status(400).json({ error: 'chatId diperlukan' });
        return res.json(await getMessages(uid, chatId));
      default:
        return res.status(400).json({ error: `Action tidak dikenal: ${action}` });
    }
  } catch (e) {
    console.error('[memory.js]', e.message);
    return res.status(500).json({ error: e.message });
  }
}

// ── EXPORT untuk dipakai di chat.js ──
export { saveMessage, createChat };
