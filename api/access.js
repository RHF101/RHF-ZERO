export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { code } = req.body;
  if (!code) return res.json({ valid: false, error: "Kode diperlukan" });

  let db = { codes: [] };
  try { db = JSON.parse(process.env.ADMIN_DATA || "{}"); } catch(e) {}

  const found = (db.codes || []).find(c => c.code === code.trim().toUpperCase() && c.active !== false);
  if (!found) return res.json({ valid: false, error: "Kode tidak ditemukan." });
  if (found.expires_at && new Date(found.expires_at) < new Date()) return res.json({ valid: false, error: "Kode kadaluarsa." });

  return res.json({ valid: true, type: found.type });
}
