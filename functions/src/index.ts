// functions/src/index.ts
import * as https from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { defineString } from "firebase-functions/params";

admin.initializeApp();
const db = admin.firestore();

// v2 では functions.config() は使いません。
// .env（functions/.env）や環境パラメータ（defineString）を使います。
const ADMIN_UIDS = defineString("ADMIN_UIDS"); // 例: "uidA,uidB"

const parseAdminUids = (): Set<string> => {
  const raw =
    ADMIN_UIDS.value() ||     // functions/.env / .env.local
    process.env.ADMIN_UIDS || // 予備: 環境変数
    "";
  return new Set(
    raw.split(",").map((s) => s.trim()).filter(Boolean)
  );
};

/**
 * 管理者だけが他ユーザーのロールを変更できる
 * data: { targetUid: string, role: "student"|"teacher"|"admin" }
 */
export const setUserRole = https.onCall(async (req) => {
  const caller = req.auth?.uid;
  if (!caller) {
    throw new https.HttpsError("unauthenticated", "Login required");
  }

  // 呼び出し元が管理者か（custom claims or allowlist）
  const token = req.auth?.token as any;
  const isAdminByClaim = token?.admin === true;
  const allowlist = parseAdminUids();
  const isAdminByAllowlist = allowlist.has(caller);

  if (!isAdminByClaim && !isAdminByAllowlist) {
    throw new https.HttpsError("permission-denied", "Not admin");
  }

  const { targetUid, role } = req.data || {};
  if (typeof targetUid !== "string" || typeof role !== "string") {
    throw new https.HttpsError("invalid-argument", "targetUid and role are required");
  }

  // 既存クレームを保持しつつ必要なら追加
  const userRecord = await admin.auth().getUser(targetUid);
  await admin.auth().setCustomUserClaims(targetUid, {
    ...(userRecord.customClaims || {}),
    // admin: role === "admin", // ← roleに連動して admin クレームを付けたいなら有効化
  });

  // Firestore users/{uid}.role を更新（UI/監査用）
  await db.collection("users").doc(targetUid).set(
    {
      role,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { ok: true };
});

/**
 * 初期化用：allowlist に入っている本人が自分に admin クレームを付与
 */
export const bootstrapAdmin = https.onCall(async (req) => {
  const caller = req.auth?.uid;
  const allowlist = parseAdminUids();
  if (!caller || !allowlist.has(caller)) {
    throw new https.HttpsError("permission-denied", "Not in allowlist");
  }
  await admin.auth().setCustomUserClaims(caller, { admin: true });
  await db.collection("users").doc(caller).set({ role: "admin" }, { merge: true });
  return { ok: true };
});
