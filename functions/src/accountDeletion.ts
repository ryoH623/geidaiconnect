// 退会（アカウント削除）。
//
// 本人の退会（deleteMyAccount）と、運営による強制退会（adminDeleteUser）は
// 同じ deleteAccount() を通す。処理の中身は docs/account-deletion.md を参照。
//
// 方針の要点:
//   - 未完了の予約（今後のレッスン・決済手続き中・決済が確定していないもの）が
//     1件でもあれば退会させない。先にキャンセルしてもらう。
//   - 予約（reservations / reservationPayouts）は会計・税務の記録として残す。
//     ただし住所・電話・メモ・座標など、記録に不要な個人情報は消す。
//   - レビューは本文と評価を残し、投稿者との紐付け（userId）だけ外す。
//   - users/{uid} は個人情報を消した「退会済み」の印だけを残す
//     （予約などから uid を引いたときに、存在しない人ではなく退会者だと分かるように）。
//   - Firebase Auth のアカウントは最後に削除する。途中で失敗しても、
//     もう一度実行すれば続きから同じ結果になるよう、各手順は何度実行してもよい形にしている。
import * as admin from "firebase-admin";
import { https, logger } from "firebase-functions/v1";

import { deletedEmailRef, emailHash } from "./deletedEmails";
import { buildInfoMailHtml, sendMailSafe } from "./mailer";

/** 本人退会で求める「直近のログイン」の猶予（秒）。乗っ取られたセッションでの退会を防ぐ */
const RECENT_LOGIN_SEC = 10 * 60;

/** これらのステータスの予約は終わったものとして扱う（退会を妨げない） */
const CLOSED_STATUSES = new Set([
  "expired",
  "cancelled",
  "canceled",
  "failed",
  "refunded",
]);

/** 決済が確定していない支払い状態。レッスン日が過ぎていても退会を止める */
const UNSETTLED_PAYMENT_STATUSES = new Set([
  "pending_payment",
  "authorized",
  "payment_failed",
]);

/** 予約が入っている枠。予約の記録と対応するため削除しない */
const RESERVED_SCHEDULE_STATUSES = new Set(["reserved", "booked"]);

function todayJst(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

export type DeletionBlocker = {
  reservationId: string;
  lessonDate: string;
  lessonTime: string;
  /** この予約での立場 */
  as: "student" | "teacher";
  /** 相手の名前（生徒なら講師名、講師なら生徒名） */
  counterpart: string;
  reason: "upcoming" | "pending" | "unsettled";
};

/** 退会を妨げる予約の一覧。空なら退会できる */
export async function findDeletionBlockers(uid: string): Promise<DeletionBlocker[]> {
  const db = admin.firestore();
  const today = todayJst();

  // 等価条件のみで引き、状態と日付はメモリ上で判定する（複合インデックスを避けるため）
  const [asStudent, asTeacher] = await Promise.all([
    db.collection("reservations").where("userId", "==", uid).get(),
    db.collection("reservations").where("teacherId", "==", uid).get(),
  ]);

  const out: DeletionBlocker[] = [];
  const seen = new Set<string>();

  const inspect = (
    doc: FirebaseFirestore.QueryDocumentSnapshot,
    as: "student" | "teacher"
  ) => {
    if (seen.has(doc.id)) return;
    const r = doc.data() || {};
    const rstatus = String(r.reservationStatus ?? "").toLowerCase();
    const payment = String(r.paymentStatus ?? "").toLowerCase();
    if (CLOSED_STATUSES.has(rstatus) || CLOSED_STATUSES.has(payment)) return;

    const lessonDate = typeof r.lessonDate === "string" ? r.lessonDate : "";
    let reason: DeletionBlocker["reason"] | null = null;
    if (rstatus === "pending") {
      reason = "pending";
    } else if (UNSETTLED_PAYMENT_STATUSES.has(payment)) {
      // 与信のみ・請求失敗など。レッスン日が過ぎていても精算が終わっていない
      reason = lessonDate && lessonDate < today ? "unsettled" : "upcoming";
    } else if (!lessonDate || lessonDate >= today) {
      // 当日のレッスンもまだ終わっていない可能性があるため含める
      reason = "upcoming";
    }
    if (!reason) return;

    seen.add(doc.id);
    out.push({
      reservationId: doc.id,
      lessonDate,
      lessonTime: typeof r.lessonTime === "string" ? r.lessonTime : "",
      as,
      counterpart:
        as === "student"
          ? String(r.teacherName ?? "")
          : String(r.name ?? r.userName ?? ""),
      reason,
    });
  };

  asStudent.docs.forEach((d) => inspect(d, "student"));
  asTeacher.docs.forEach((d) => inspect(d, "teacher"));

  out.sort((a, b) =>
    `${a.lessonDate} ${a.lessonTime}`.localeCompare(`${b.lessonDate} ${b.lessonTime}`)
  );
  return out;
}

function blockerMessage(blockers: DeletionBlocker[]): string {
  const hasPending = blockers.some((b) => b.reason === "pending");
  const hasUnsettled = blockers.some((b) => b.reason === "unsettled");
  if (hasUnsettled) {
    return "お支払いが確定していない予約があるため、退会できません。お問い合わせください。";
  }
  if (hasPending) {
    return "決済手続き中の予約があるため、退会できません。手続きを完了するか、時間をおいてからお試しください。";
  }
  return "今後のレッスンの予約が残っているため、退会できません。先に予約をキャンセルしてください。";
}

type DeletedBy =
  | { type: "self" }
  | { type: "admin"; adminUid: string; reason: string };

type DeletionSummary = {
  couponsCancelled: number;
  reviewsAnonymized: number;
  reservationsRedacted: number;
  schedulesDeleted: number;
  teacherProfilesUnpublished: number;
};

/**
 * 退会処理の本体。各手順は何度実行しても同じ結果になる（途中で失敗したら再実行してよい）。
 * 未完了の予約がある場合は failed-precondition を投げ、何も変更しない。
 */
async function deleteAccount(uid: string, by: DeletedBy): Promise<DeletionSummary> {
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const user = userSnap.exists ? userSnap.data() || {} : {};
  const role = String(user.role || "");
  const alreadyDeleted = user.status === "deleted";

  // 管理者アカウントは画面からは削除させない（運営が締め出されるのを防ぐ）
  if (role === "admin") {
    throw new https.HttpsError(
      "failed-precondition",
      "管理者アカウントはこの画面から削除できません。"
    );
  }

  const blockers = await findDeletionBlockers(uid);
  if (blockers.length > 0) {
    throw new https.HttpsError("failed-precondition", blockerMessage(blockers), {
      blockers,
    });
  }

  // メール送信・再登録判定のため、Auth を消す前に連絡先を控えておく
  let authUser: admin.auth.UserRecord | null = null;
  try {
    authUser = await admin.auth().getUser(uid);
  } catch (error: any) {
    if (error?.code !== "auth/user-not-found") throw error;
  }
  const email = authUser?.email || (typeof user.email === "string" ? user.email : "");
  const displayName =
    (typeof user.displayName === "string" && user.displayName) ||
    authUser?.displayName ||
    "";
  const hash = emailHash(email);

  const summary: DeletionSummary = {
    couponsCancelled: 0,
    reviewsAnonymized: 0,
    reservationsRedacted: 0,
    schedulesDeleted: 0,
    teacherProfilesUnpublished: 0,
  };

  const [coupons, referralCodes, reviews, reservations, schedules, profiles] =
    await Promise.all([
      db.collection("coupons").where("userId", "==", uid).get(),
      db.collection("referralCodes").where("uid", "==", uid).get(),
      db.collection("reviews").where("userId", "==", uid).get(),
      db.collection("reservations").where("userId", "==", uid).get(),
      db.collection("schedules").where("teacherId", "==", uid).get(),
      db.collection("teacherProfiles").where("authUid", "==", uid).get(),
    ]);

  // BulkWriter は個々の書き込みが失敗しても close() では例外にならないため、
  // 失敗を数えておき、1件でもあれば Auth を消す前に止める（再実行で続きから直せる）。
  const writer = db.bulkWriter();
  let failedWrites = 0;
  writer.onWriteError((err) => {
    const retry = err.failedAttempts < 3;
    if (!retry) {
      failedWrites += 1;
      logger.error("deleteAccount: 書き込みに失敗", {
        uid,
        path: err.documentRef.path,
        error: err.message,
      });
    }
    return retry;
  });

  // 1. 未使用のクーポンを無効化（退会後に使われることはないが、集計で未使用残高に数えないため）
  for (const doc of coupons.docs) {
    const status = String((doc.data() || {}).status || "");
    if (status !== "available" && status !== "reserved") continue;
    writer.set(
      doc.ref,
      {
        status: "cancelled",
        cancelReason: "退会",
        cancelledByAccountDeletion: true,
        cancelledAt: FieldValue.serverTimestamp(),
        statusBeforeCancel: status,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    summary.couponsCancelled += 1;
  }

  // 2. 紹介コードを削除（退会者のコードで新たに紹介が登録されないように）。
  //    紹介の記録（referrals）は残す。紹介者が退会済みなら紹介者特典は付与しない
  //    （campaigns.ts の processReferralMilestones 側で判定）。
  for (const doc of referralCodes.docs) {
    writer.delete(doc.ref);
  }
  if (typeof user.referralCode === "string" && user.referralCode) {
    writer.delete(db.collection("referralCodes").doc(user.referralCode));
  }

  // 3. レビューは残し、投稿者との紐付けだけ外す。
  //    予約（reservationId）経由で運営は追えるが、公開側からは辿れない。
  for (const doc of reviews.docs) {
    writer.set(
      doc.ref,
      {
        userId: FieldValue.delete(),
        authorDeleted: true,
        authorDeletedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    summary.reviewsAnonymized += 1;
  }

  // 4. 生徒としての予約。氏名・メール・金額・日時は会計記録として残し、
  //    それ以外の個人情報（電話・メモ・出張先の住所と座標）を消す。
  for (const doc of reservations.docs) {
    const r = doc.data() || {};
    writer.set(
      doc.ref,
      {
        phone: null,
        notes: null,
        lessonLat: null,
        lessonLng: null,
        // 出張レッスンの場所は生徒の自宅住所。スタジオ名などはそのまま残す
        ...(r.lessonType === "出張" ? { location: null } : {}),
        studentDeleted: true,
        studentDeletedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    summary.reservationsRedacted += 1;
  }

  // 5. 講師: 空き枠を消し、プロフィールを非公開にする。
  //    予約が入った枠は予約の記録と対応するため残す。
  for (const doc of schedules.docs) {
    const status = String((doc.data() || {}).status || "");
    if (RESERVED_SCHEDULE_STATUSES.has(status)) continue;
    writer.delete(doc.ref);
    summary.schedulesDeleted += 1;
  }
  for (const doc of profiles.docs) {
    writer.set(
      doc.ref,
      {
        published: false,
        withdrawn: true,
        withdrawnAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    summary.teacherProfilesUnpublished += 1;
  }

  // 6. 再登録での紹介特典の取り直しを防ぐ台帳（メールアドレスはハッシュのみ）
  if (hash) {
    writer.set(
      deletedEmailRef(hash),
      {
        emailHash: hash,
        uids: FieldValue.arrayUnion(uid),
        lastDeletedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  // 7. 退会の記録（誰が・いつ・なぜ）。運営のみ閲覧可
  writer.set(
    db.collection("accountDeletions").doc(uid),
    {
      uid,
      role: role || null,
      deletedBy: by.type,
      adminUid: by.type === "admin" ? by.adminUid : null,
      reason: by.type === "admin" ? by.reason : null,
      emailHash: hash || null,
      summary,
      deletedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // 8. users は個人情報を消し、退会済みの印だけを残す（set で上書き）。
  //    createdAt は個人情報ではなく、管理画面の月別登録数の集計に使うため残す。
  writer.set(userRef, {
    uid,
    role: role || null,
    createdAt: user.createdAt ?? null,
    status: "deleted",
    deletedBy: by.type,
    deletedAt: alreadyDeleted && user.deletedAt ? user.deletedAt : FieldValue.serverTimestamp(),
  });

  await writer.close();
  if (failedWrites > 0) {
    throw new https.HttpsError(
      "internal",
      "退会処理の途中でエラーが発生しました。お手数ですが、もう一度お試しください。"
    );
  }

  // 9. 最後に Auth のアカウントを削除する
  try {
    await admin.auth().deleteUser(uid);
  } catch (error: any) {
    if (error?.code !== "auth/user-not-found") {
      logger.error("deleteAccount: Auth の削除に失敗", { uid, error });
      throw new https.HttpsError(
        "internal",
        "退会処理の途中でエラーが発生しました。お手数ですが、もう一度お試しください。"
      );
    }
  }

  logger.info("deleteAccount done", { uid, role, by: by.type, summary });

  // 10. 完了の連絡（失敗しても退会自体は成立している）
  if (email && !alreadyDeleted) {
    await sendMailSafe({
      to: email,
      subject: "【Geidai Connect】退会手続きが完了しました",
      html: buildInfoMailHtml({
        greetingName: displayName || "会員",
        intro:
          by.type === "self"
            ? [
                "Geidai Connect をご利用いただき、ありがとうございました。",
                "退会手続きが完了しましたので、お知らせいたします。",
              ]
            : [
                "利用規約第13条に基づき、運営にてアカウントを削除いたしましたので、お知らせいたします。",
              ],
        rows: [],
        outro: [
          "お持ちだったクーポンは無効になりました。投稿いただいたレビューは、投稿者が分からない形で引き続き掲載いたします。",
          "ご予約の記録は、法令に基づく保存期間のあいだ運営にて保管いたします。",
          "お心当たりのない場合は、お手数ですが support@geidaiconnect.com までご連絡ください。",
        ],
      }),
    });
  }

  return summary;
}

// ========================================
// Callable: 退会できるかの確認（退会画面を開いたときに呼ぶ）
// ========================================
export const checkMyAccountDeletion = https.onCall(
  async (
    _data: unknown,
    context
  ): Promise<{ ok: boolean; canDelete: boolean; message: string; blockers: DeletionBlocker[] }> => {
    if (!context.auth) {
      throw new https.HttpsError("unauthenticated", "ログインが必要です。");
    }
    const uid = context.auth.uid;

    const userSnap = await admin.firestore().collection("users").doc(uid).get();
    if (String(userSnap.data()?.role || "") === "admin") {
      return {
        ok: true,
        canDelete: false,
        message: "管理者アカウントはこの画面から退会できません。",
        blockers: [],
      };
    }

    const blockers = await findDeletionBlockers(uid);
    return {
      ok: true,
      canDelete: blockers.length === 0,
      message: blockers.length ? blockerMessage(blockers) : "",
      blockers,
    };
  }
);

// ========================================
// Callable: 本人の退会
//
// 直前にパスワードで再認証していることを求める（auth_time で判定）。
// ログインしたまま放置された端末から第三者に退会させられるのを防ぐため。
// ========================================
export const deleteMyAccount = https.onCall(
  async (_data: unknown, context): Promise<{ ok: boolean }> => {
    if (!context.auth) {
      throw new https.HttpsError("unauthenticated", "ログインが必要です。");
    }
    const uid = context.auth.uid;

    const authTime = Number(context.auth.token.auth_time || 0);
    if (!authTime || Date.now() / 1000 - authTime > RECENT_LOGIN_SEC) {
      throw new https.HttpsError(
        "unauthenticated",
        "確認のため、もう一度パスワードを入力してください。"
      );
    }

    await deleteAccount(uid, { type: "self" });
    return { ok: true };
  }
);

// ========================================
// Callable(admin): 運営による強制退会（規約違反など）
//
// 理由の入力は必須。記録は accountDeletions/{uid} に残る。
// ========================================
export const adminDeleteUser = https.onCall(
  async (
    data: { uid?: string; reason?: string },
    context
  ): Promise<{ ok: boolean; summary: DeletionSummary }> => {
    if (!context.auth) {
      throw new https.HttpsError("unauthenticated", "ログインが必要です。");
    }
    const adminUid = context.auth.uid;
    const adminSnap = await admin.firestore().collection("users").doc(adminUid).get();
    if (String(adminSnap.data()?.role || "") !== "admin") {
      throw new https.HttpsError("permission-denied", "管理者権限が必要です。");
    }

    const uid = typeof data?.uid === "string" ? data.uid.trim() : "";
    const reason = typeof data?.reason === "string" ? data.reason.trim() : "";
    if (!uid) {
      throw new https.HttpsError("invalid-argument", "対象のユーザーを指定してください。");
    }
    if (!reason) {
      throw new https.HttpsError("invalid-argument", "削除の理由を入力してください。");
    }
    if (uid === adminUid) {
      throw new https.HttpsError(
        "failed-precondition",
        "ご自身のアカウントはこの操作で削除できません。"
      );
    }

    const summary = await deleteAccount(uid, { type: "admin", adminUid, reason });
    logger.info("adminDeleteUser done", { adminUid, uid });
    return { ok: true, summary };
  }
);
