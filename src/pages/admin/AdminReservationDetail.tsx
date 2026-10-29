// src/pages/admin/AdminReservationDetail.tsx
// 管理者用: 予約1件の詳細（連絡先・場所・金額の内訳・決済・キャンセル）と、運営による取り消し。
import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebase";
import {
  CANCELLED_BY_LABELS,
  PAYMENT_STATUS,
  RESERVATION_STATUS,
  StatusBadge,
  formatLessonDate,
} from "../../lib/adminReservationLabels";
import { yen } from "../../lib/adminStats";

type Data = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : null);

function formatTs(v: unknown): string {
  if (!(v instanceof Timestamp)) return "";
  return v.toDate().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card: "カード（当日0時に請求）",
  konbini: "コンビニ払い",
};

const REFUND_OUTCOME_LABELS: Record<string, string> = {
  voided: "与信取消（請求なし）",
  refunded: "全額返金",
  failed: "返金失敗（要手動対応）",
};

/** 値が空の行は出さない */
const Rows: React.FC<{ rows: Array<[string, React.ReactNode]> }> = ({ rows }) => (
  <dl className="detail-list">
    {rows
      .filter(([, v]) => v !== "" && v !== null && v !== undefined)
      .map(([k, v]) => (
        <div key={k} className="detail-row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
  </dl>
);

const AdminReservationDetail: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const [r, setR] = useState<Data | null>(null);
  const [payout, setPayout] = useState<Data | null>(null);
  const [teacherCancel, setTeacherCancel] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reason, setReason] = useState("");
  const [reopenSlot, setReopenSlot] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");
  const [cancelError, setCancelError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [resSnap, payoutSnap, tcSnap] = await Promise.all([
        getDoc(doc(db, "reservations", id)),
        getDoc(doc(db, "reservationPayouts", id)),
        getDoc(doc(db, "teacherCancellations", id)),
      ]);
      if (!resSnap.exists()) {
        setError("予約が見つかりませんでした。");
        return;
      }
      setR(resSnap.data());
      setPayout(payoutSnap.exists() ? payoutSnap.data() : null);
      setTeacherCancel(tcSnap.exists() ? tcSnap.data() : null);
    } catch (err) {
      console.error("予約詳細の取得に失敗しました:", err);
      setError("予約詳細の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancel = async () => {
    setCancelMessage("");
    setCancelError("");
    if (!reason.trim()) {
      setCancelError("取り消しの理由を入力してください。");
      return;
    }
    const ok = window.confirm(
      "この予約を取り消します。\n" +
        "・請求前なら与信を取り消し、請求後なら生徒へ全額返金します\n" +
        "・使ったクーポンは生徒に戻します\n" +
        "・生徒と講師にメールが届きます（理由も載ります）\n\n" +
        "取り消しは元に戻せません。よろしいですか？"
    );
    if (!ok) return;
    try {
      setCancelling(true);
      const call = httpsCallable<
        { reservationId: string; reason: string; reopenSlot: boolean },
        { ok: boolean; message: string }
      >(functions, "adminCancelReservation");
      const res = await call({ reservationId: id, reason: reason.trim(), reopenSlot });
      setCancelMessage(res.data.message);
      setReason("");
      await load();
    } catch (err) {
      console.error("取り消しに失敗しました:", err);
      setCancelError(
        err instanceof Error ? err.message : "取り消しに失敗しました。"
      );
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <main className="admin-page">
        <p style={{ textAlign: "center" }}>読み込み中...</p>
      </main>
    );
  }
  if (error || !r) {
    return (
      <main className="admin-page">
        <p style={{ textAlign: "center", color: "#c62828" }}>{error}</p>
        <p style={{ textAlign: "center" }}>
          <Link to="/admin/reservations">予約一覧へ戻る</Link>
        </p>
      </main>
    );
  }

  const paymentStatus = str(r.paymentStatus);
  const reservationStatus = str(r.reservationStatus);
  const pi = str(r.stripePaymentIntentId);
  const stripeBase =
    r.stripeLivemode === true
      ? "https://dashboard.stripe.com"
      : "https://dashboard.stripe.com/test";
  const canCancel =
    reservationStatus === "confirmed" && ["paid", "authorized"].includes(paymentStatus);
  const lessonStartMs = Date.parse(`${str(r.lessonDate)}T${str(r.lessonTime) || "00:00"}:00+09:00`);
  const isFutureLesson = Number.isFinite(lessonStartMs) && lessonStartMs > Date.now();
  const userId = str(r.userId);
  const teacherId = str(r.teacherId);
  const commissionRate = num(payout?.commissionRate);

  return (
    <main className="admin-page">
      <h2 className="centered-heading-with-border">
        <span>予約の詳細</span>
      </h2>

      <div className="detail-header">
        <div>
          <div className="detail-header-date">
            {formatLessonDate(str(r.lessonDate))} {str(r.lessonTime)}
          </div>
          <div className="detail-header-sub">
            {str(r.name) || "―"} さん ／ {str(r.teacherName) || "―"} 先生
          </div>
        </div>
        <div className="status-stack status-stack--row">
          <StatusBadge map={RESERVATION_STATUS} value={reservationStatus} />
          <StatusBadge map={PAYMENT_STATUS} value={paymentStatus} />
        </div>
      </div>

      {paymentStatus === "refund_failed" && (
        <p className="admin-alert">
          返金に失敗しています。Stripe の管理画面から手動で返金してください。
          {pi && (
            <>
              {" "}
              <a href={`${stripeBase}/payments/${pi}`} target="_blank" rel="noreferrer">
                Stripe で開く
              </a>
            </>
          )}
        </p>
      )}

      <div className="detail-grid">
        <section className="admin-chart-card detail-card">
          <h3>レッスン</h3>
          <Rows
            rows={[
              ["日時", `${formatLessonDate(str(r.lessonDate))} ${str(r.lessonTime)}`],
              ["時間", num(r.durationMin) ? `${num(r.durationMin)}分` : ""],
              [
                "講師",
                teacherId ? (
                  <Link to={`/admin/teachers/${teacherId}`}>{str(r.teacherName)}</Link>
                ) : (
                  str(r.teacherName)
                ),
              ],
              ["コース", str(r.lessonCourse)],
              ["形式", str(r.lessonType)],
              ["場所", str(r.location)],
              ["スタジオ", str(r.studioName)],
              ["オンラインURL", str(r.meetingUrl)],
              ["備考", str(r.notes)],
              ["受講完了", r.lessonCompleted === true ? "完了" : ""],
              ["レビュー", str(r.reviewId) ? "投稿済み" : ""],
            ]}
          />
        </section>

        <section className="admin-chart-card detail-card">
          <h3>生徒</h3>
          <Rows
            rows={[
              ["氏名", str(r.name)],
              ["ふりがな", str(r.furigana)],
              [
                "メール",
                str(r.email) ? <a href={`mailto:${str(r.email)}`}>{str(r.email)}</a> : "",
              ],
              [
                "ログイン用メール",
                str(r.userEmail) && str(r.userEmail) !== str(r.email) ? str(r.userEmail) : "",
              ],
              ["電話", str(r.phone) ? <a href={`tel:${str(r.phone)}`}>{str(r.phone)}</a> : ""],
              [
                "クーポン・紹介",
                userId ? (
                  <Link to={`/admin/users/${userId}/campaigns`}>この生徒の履歴を見る</Link>
                ) : (
                  ""
                ),
              ],
            ]}
          />
        </section>

        <section className="admin-chart-card detail-card">
          <h3>金額</h3>
          <Rows
            rows={[
              ["レッスン料", num(r.lessonAmount) != null ? yen(num(r.lessonAmount)!) : ""],
              ["スタジオ代", num(r.studioFee) ? yen(num(r.studioFee)!) : ""],
              [
                "クーポン",
                num(r.couponDiscount)
                  ? `−${yen(num(r.couponDiscount)!)}（${str(r.couponName)}）`
                  : "",
              ],
              ["お支払い額", num(r.totalAmount) != null ? yen(num(r.totalAmount)!) : ""],
              [
                "運営手数料",
                payout && num(payout.commissionAmount) != null
                  ? `${yen(num(payout.commissionAmount)!)}${
                      commissionRate != null ? `（${Math.round(commissionRate * 1000) / 10}%）` : ""
                    }`
                  : "",
              ],
              [
                "講師の取り分",
                payout && num(payout.teacherPayout) != null ? yen(num(payout.teacherPayout)!) : "",
              ],
            ]}
          />
        </section>

        <section className="admin-chart-card detail-card">
          <h3>決済</h3>
          <Rows
            rows={[
              ["支払い方法", PAYMENT_METHOD_LABELS[str(r.paymentMethod)] || str(r.paymentMethod)],
              ["予約日時", formatTs(r.createdAt)],
              ["請求予定", paymentStatus === "authorized" ? formatTs(r.chargeDueAt) : ""],
              ["請求確定", formatTs(r.paidAt)],
              [
                "Stripe",
                pi ? (
                  <a href={`${stripeBase}/payments/${pi}`} target="_blank" rel="noreferrer">
                    決済を Stripe で開く
                  </a>
                ) : (
                  ""
                ),
              ],
              ["返金ID", str(r.refundId)],
              ["予約ID", <code key="id">{id}</code>],
            ]}
          />
        </section>

        {reservationStatus === "cancelled" && (
          <section className="admin-chart-card detail-card">
            <h3>キャンセル</h3>
            <Rows
              rows={[
                ["誰の都合か", CANCELLED_BY_LABELS[str(r.cancelledBy)] || str(r.cancelledBy) || "生徒都合"],
                ["理由", str(r.cancelReason)],
                ["日時", formatTs(r.cancelledAt)],
                [
                  "返金",
                  teacherCancel
                    ? REFUND_OUTCOME_LABELS[str(teacherCancel.refundOutcome)] || ""
                    : "",
                ],
                [
                  "講師から差し引く手数料",
                  teacherCancel && num(teacherCancel.stripeFee)
                    ? `${yen(num(teacherCancel.stripeFee)!)}${
                        teacherCancel.stripeFeeEstimated ? "（見積もり）" : ""
                      }・${teacherCancel.settled ? "精算済み" : "未精算"}`
                    : "",
                ],
                [
                  "運営負担の手数料",
                  num(r.operatorStripeFee) ? yen(num(r.operatorStripeFee)!) : "",
                ],
              ]}
            />
          </section>
        )}
      </div>

      {canCancel && (
        <section className="admin-chart-card detail-card detail-danger">
          <h3>運営による取り消し</h3>
          <p className="detail-note">
            トラブルや問い合わせへの対応で、運営の判断で予約を取り消します。生徒の負担はありません
            （請求前は与信取消、請求後は全額返金。クーポンも戻します）。返金で戻らない決済手数料は運営の負担です。
            講師の都合による場合は、講師に予約一覧からキャンセルしてもらうと手数料を講師負担にできます。
          </p>
          <label htmlFor="admin-cancel-reason" className="detail-label">
            取り消しの理由（生徒・講師へのメールに載ります）
          </label>
          <textarea
            id="admin-cancel-reason"
            className="detail-textarea"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例：講師と連絡が取れないため、運営の判断で取り消しました。"
            disabled={cancelling}
          />
          {isFutureLesson && (
            <label className="detail-check">
              <input
                type="checkbox"
                checked={reopenSlot}
                onChange={(e) => setReopenSlot(e.target.checked)}
                disabled={cancelling}
              />
              この時間枠を再び予約できるようにする（チェックしなければ枠は閉じます）
            </label>
          )}
          {cancelError && <p style={{ color: "#c62828", margin: "0.5rem 0 0" }}>{cancelError}</p>}
          <button
            type="button"
            className="detail-danger-button"
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? "取り消し中..." : "この予約を取り消す"}
          </button>
        </section>
      )}
      {cancelMessage && <p className="admin-success">{cancelMessage}</p>}

      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <Link to="/admin/reservations" className="form-button">
          予約一覧へ戻る
        </Link>
      </div>
    </main>
  );
};

export default AdminReservationDetail;
