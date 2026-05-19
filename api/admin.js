export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { action, password, data } = req.body;
  if (!password) return res.status(400).json({ error: "Password diperlukan" });
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: "Password salah." });

  let db = { codes: [], users: [] };
  try { db = JSON.parse(process.env.ADMIN_DATA || "{}"); } catch(e) {}

  if (action === "listCodes") return res.json(db.codes || []);
  if (action === "listUsers") return res.json(db.users || []);
  if (action === "createCode") {
    const c = data.code.toUpperCase();
    if (!c) return res.json({ error: "Kode kosong" });
    if (db.codes.find(x => x.code === c)) return res.json({ error: "Kode sudah ada" });
    db.codes.push({ code: c, type: data.type || "trial", active: true, used_by: null, created_at: new Date().toISOString(), expires_at: data.type === "trial" ? new Date(Date.now() + (data.duration||3600)*1000).toISOString() : null });
    return res.json({ success: true, code: c });
  }
  if (action === "deleteCode") {
    const f = db.codes.find(x => x.code === data.code.toUpperCase());
    if (f) f.active = false;
    return res.json({ success: true });
  }
  if (action === "blockUser") {
    const u = db.users.find(x => x.uid === data.uid);
    if (u) u.blocked = true; else db.users.push({ uid: data.uid, blocked: true });
    return res.json({ success: true });
  }
  if (action === "unblockUser") {
    const u = db.users.find(x => x.uid === data.uid);
    if (u) u.blocked = false;
    return res.json({ success: true });
  }
  return res.json({ error: "Action tidak dikenal" });
}
