// api/memory.js — RHF ZERO v5 Memory Layer (Firestore REST)
// Firestore: users/{uid}/chats/{chatId}/messages/{msgId}

const FB_KEY  = 'AIzaSyDKlLibZlP5FlFcgPV1lM_8ykMz1RuXbvA';
const FS_BASE = 'https://firestore.googleapis.com/v1/projects/rhf-zero-26ad2/databases/(default)/documents';

// ══════════════════════════════════════════════════
// Encoder / Decoder Firestore REST
// ══════════════════════════════════════════════════
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean')  return { booleanValue: v };
  if (typeof v === 'number')   return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string')   return { stringValue: v };
  if (Array.isArray(v))        return { arrayValue: { values: v.map(enc) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = enc(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}
function encDoc(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = enc(v);
  return { fields };
}
function dec(v) {
  if (!v) return null;
  if ('nullValue'    in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue'  in v) return v.doubleValue;
  if ('stringValue'  in v) return v.stringValue;
  if ('timestampValue' in v) return new Date(v.timestampValue).getTime();
  if ('arrayValue'   in v) return (v.arrayValue.values || []).map(dec);
  if ('mapValue'     in v) return decDoc(v.mapValue);
  return null;
}
function decDoc(doc) {
  if (!doc || !doc.fields) return {};
  const r = {};
  for (const [k, v] of Object.entries(doc.fields)) r[k] = dec(v);
  if (doc.name) { const p = doc.name.split('/'); r._id = p[p.length - 1]; }
  return r;
}

// ══════════════════════════════════════════════════
// Firestore HTTP helpers
// ══════════════════════════════════════════════════
async function fsGet(path) {
  const r = await fetch(`${FS_BASE}/${path}?key=${FB_KEY}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GET ${path}: ${r.status}`);
  return r.json();
}
async function fsPatch(path, data, mask) {
  let url = `${FS_BASE}/${path}?key=${FB_KEY}`;
  if (mask?.length) url += '&' + mask.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const r = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(encDoc(data)) });
  if (!r.ok) throw new Error(`PATCH ${path}: ${r.status}`);
  return r.json();
}
async function fsPost(path, data) {
  const r = await fetch(`${FS_BASE}/${path}?key=${FB_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(encDoc(data)) });
  if (!r.ok) throw new Error(`POST ${path}: ${r.status}`);
  return r.json();
}
async function fsDel(path) {
  const r = await fetch(`${FS_BASE}/${path}?key=${FB_KEY}`, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) throw new Error(`DELETE ${path}: ${r.status}`);
}
async function fsList(path) {
  const r = await fetch(`${FS_BASE}/${path}?key=${FB_KEY}&pageSize=200`);
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`LIST ${path}: ${r.status}`);
  const d = await r.json();
  return (d.documents || []).map(decDoc);
}

// ══════════════════════════════════════════════════
// Public API (dipakai chat.js & generate.js)
// ══════════════════════════════════════════════════
export async function createChat(uid, chatId, { title = 'Chat Baru', mode = 'santai' } = {}) {
  const now = Date.now();
  await fsPatch(`users/${uid}/chats/${chatId}`, { title, mode, createdAt: now, updatedAt: now });
  return { _id: chatId, title, mode, updatedAt: now };
}

export async function getChats(uid) {
  const docs = await fsList(`users/${uid}/chats`);
  docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return docs;
}

export async function deleteChat(uid, chatId) {
  try {
    const msgs = await fsList(`users/${uid}/chats/${chatId}/messages`);
    for (const m of msgs) if (m._id) await fsDel(`users/${uid}/chats/${chatId}/messages/${m._id}`);
  } catch {}
  await fsDel(`users/${uid}/chats/${chatId}`);
}

export async function deleteAllChats(uid) {
  const chats = await getChats(uid);
  for (const c of chats) await deleteChat(uid, c._id);
}

export async function saveMessage(uid, chatId, { role, content, format = 'txt', mode = 'santai' } = {}) {
  const now = Date.now();
  const doc = await fsPost(`users/${uid}/chats/${chatId}/messages`, { role, content, format, mode, timestamp: now });
  try { await fsPatch(`users/${uid}/chats/${chatId}`, { updatedAt: now }, ['updatedAt']); } catch {}
  return decDoc(doc);
}

export async function getMessages(uid, chatId) {
  const docs = await fsList(`users/${uid}/chats/${chatId}/messages`);
  docs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  return docs;
}

// ══════════════════════════════════════════════════
// HTTP Handler: POST /api/memory
// ══════════════════════════════════════════════════
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action, uid, chatId, data } = req.body;
  if (!uid)    return res.status(400).json({ error: 'UID diperlukan' });
  if (!action) return res.status(400).json({ error: 'Action diperlukan' });

  try {
    switch (action) {
      case 'createChat':    return res.json({ ok: true, chat: await createChat(uid, chatId, data || {}) });
      case 'getChats':      return res.json({ ok: true, chats: await getChats(uid) });
      case 'deleteChat':    await deleteChat(uid, chatId); return res.json({ ok: true });
      case 'deleteAllChats':await deleteAllChats(uid); return res.json({ ok: true });
      case 'saveMessage':   return res.json({ ok: true, message: await saveMessage(uid, chatId, data) });
      case 'getMessages':   return res.json({ ok: true, messages: await getMessages(uid, chatId) });
      default:              return res.status(400).json({ error: 'Action tidak dikenal: ' + action });
    }
  } catch (e) {
    console.error('[memory]', e.message);
    return res.status(500).json({ error: e.message });
  }
}
