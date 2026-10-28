// 退会済みメールアドレスの台帳。
//
// 退会と再登録を繰り返して友達紹介の特典を取り直すことを防ぐため、
// 退会者のメールアドレスをハッシュにして残す（アドレスそのものは残さない）。
// 退会処理（accountDeletion.ts）と紹介コードの適用（campaigns.ts）の両方から
// 使うため、どちらにも依存しない小さなモジュールに切り出している。
import * as admin from "firebase-admin";
import { createHash } from "crypto";

function normalize(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}

/** 正規化したメールアドレスの SHA-256。空なら "" */
export function emailHash(raw: unknown): string {
  const email = normalize(raw);
  if (!email) return "";
  return createHash("sha256").update(email).digest("hex");
}

export function deletedEmailRef(hash: string) {
  return admin.firestore().collection("deletedEmails").doc(hash);
}

/** このメールアドレスで退会したことがあるか */
export async function wasDeletedEmail(raw: unknown): Promise<boolean> {
  const hash = emailHash(raw);
  if (!hash) return false;
  const snap = await deletedEmailRef(hash).get();
  return snap.exists;
}
