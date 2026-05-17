import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: "rhf-confrims",
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

function json(res, status, data) {
  res.status(status).json(data);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const { action, password, data } = req.body;

    if (password !== ADMIN_PASSWORD) {
      return json(res, 401, { error: "Invalid password" });
    }

    // ============================================================
    // CREATE CODE
    // ============================================================
    if (action === "createCode") {
      const { code, type, duration } = data;

      if (!code || !type || !duration) {
        return json(res, 400, {
          error: "Missing fields",
        });
      }

      const now = Date.now();

      const expiresAt =
        type === "trial" ? now + Number(duration) * 1000 : null;

      await db.collection("access_codes").doc(code).set({
        code,
        type,
        duration,
        active: true,
        used_by: "",
        created_at: now,
        expires_at: expiresAt,
      });

      return json(res, 200, {
        success: true,
        message: "Code created",
      });
    }

    // ============================================================
    // DELETE CODE
    // ============================================================
    if (action === "deleteCode") {
      const { code } = data;

      await db.collection("access_codes").doc(code).update({
        active: false,
      });

      return json(res, 200, {
        success: true,
        message: "Code disabled",
      });
    }

    // ============================================================
    // LIST CODES
    // ============================================================
    if (action === "listCodes") {
      const snapshot = await db.collection("access_codes").get();

      const codes = [];

      snapshot.forEach((doc) => {
        codes.push(doc.data());
      });

      return json(res, 200, codes);
    }

    // ============================================================
    // LIST USERS
    // ============================================================
    if (action === "listUsers") {
      const snapshot = await db.collection("users").get();

      const users = [];

      snapshot.forEach((doc) => {
        users.push({
          uid: doc.id,
          ...doc.data(),
        });
      });

      return json(res, 200, users);
    }

    // ============================================================
    // BLOCK USER
    // ============================================================
    if (action === "blockUser") {
      const { uid } = data;

      await db.collection("users").doc(uid).update({
        blocked: true,
      });

      return json(res, 200, {
        success: true,
        message: "User blocked",
      });
    }

    // ============================================================
    // UNBLOCK USER
    // ============================================================
    if (action === "unblockUser") {
      const { uid } = data;

      await db.collection("users").doc(uid).update({
        blocked: false,
      });

      return json(res, 200, {
        success: true,
        message: "User unblocked",
      });
    }

    // ============================================================
    // CHANGE PASSWORD
    // ============================================================
    if (action === "changePassword") {
      const { newPassword } = data;

      await db.collection("admin").doc("config").set({
        password: newPassword,
      });

      return json(res, 200, {
        success: true,
        message: "Password updated",
      });
    }

    return json(res, 400, {
      error: "Unknown action",
    });
  } catch (err) {
    console.error(err);

    return json(res, 500, {
      error: err.message,
    });
  }
                   }
