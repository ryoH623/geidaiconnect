// src/pages/student/StudentReservations.tsx
// 予約履歴一覧。確定済み予約はレッスン前日まで全額返金でキャンセル可能。
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "../../contexts/AuthContext";
import { db, functions } from "../../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

interface Reservation {
  id: string;
  teacherName: string;
  lessonCourse: string;
  lessonDate: string; // "YYYY-MM-DD"
  lessonTime: string; // "HH:mm"
  location: string;
  lessonAmount: number | null;
  paymentStatus: string;
  reservationStatus: string;
  notes?: string;
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending_payment: "決済待ち",
  authorized: "お支払い前（与信済み）",
  paid: "支払済み",
  refunded: "返金済み",
  voided: "キャンセル（課金なし）",
  payment_failed: "決済失敗",
  expired: "期限切れ",
};

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  pending: "確定待ち",
  confirmed: "確定",
  cancelled: "キャンセル済み",
  expired: "期限切れ",
};

function statusLabel(map: Record<string, string>, value: string): string {
  return map[value] || value || "不明";
}

// JST の今日の日付（"YYYY-MM-DD"）。端末のタイムゾーンに依存しない
function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// キャンセル可能: 確定済みで、決済が「請求済み(paid)」または「与信のみ(authorized)」、
// かつレッスン日が明日以降（前日まで）。バックエンド cancelReservation の判定と一致させる。
function isCancellable(res: {
  reservationStatus: string;
  paymentStatus: string;
  lessonDate: string;
}): boolean {
  return (
    res.reservationStatus === "confirmed" &&
    (res.paymentStatus === "paid" || res.paymentStatus === "authorized") &&
    res.lessonDate > todayJst()
  );
}

// 与信のみ（未請求）の予約か。請求前は「課金なし」、請求済みは「全額返金」と文言を出し分ける。
function isPreCharge(res: { paymentStatus: string }): boolean {
  return res.paymentStatus === "authorized";
}

const StudentReservations: React.FC = () => {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (res: Reservation) => {
    const confirmed = window.confirm(
      `以下の予約をキャンセルします。よろしいですか？\n\n` +
        `${res.teacherName} / ${res.lessonCourse}\n` +
        `${res.lessonDate} ${res.lessonTime}\n\n` +
        (isPreCharge(res)
          ? `お支払い前（カード与信のみ）のため、請求は発生しません。`
          : `お支払い済みの料金は全額返金されます。`)
    );
    if (!confirmed) return;

    try {
      setCancellingId(res.id);
      const callable = httpsCallable<
        { reservationId: string },
        { ok: boolean; message: string }
      >(functions, "cancelReservation");
      const result = await callable({ reservationId: res.id });

      alert(result.data?.message || "予約をキャンセルしました。");

      // 画面上のステータスを即時反映する。
      // 与信のみ(authorized)は請求前のため voided、請求済み(paid)は refunded。
      const nextPaymentStatus = isPreCharge(res) ? "voided" : "refunded";
      setReservations((prev) =>
        prev.map((r) =>
          r.id === res.id
            ? {
                ...r,
                reservationStatus: "cancelled",
                paymentStatus: nextPaymentStatus,
              }
            : r
        )
      );
    } catch (err: any) {
      console.error("キャンセルエラー:", err);
      alert(
        err?.message ||
          "キャンセルに失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    if (!user) return;

    const fetchReservations = async () => {
      try {
        setLoading(true);
        setError("");

        // orderBy を付けると複合インデックスが必要になるため、取得後にソートする
        const q = query(
          collection(db, "reservations"),
          where("userId", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);

        const data: Reservation[] = querySnapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            teacherName: typeof d.teacherName === "string" ? d.teacherName : "",
            lessonCourse: typeof d.lessonCourse === "string" ? d.lessonCourse : "",
            lessonDate: typeof d.lessonDate === "string" ? d.lessonDate : "",
            lessonTime: typeof d.lessonTime === "string" ? d.lessonTime : "",
            location: typeof d.location === "string" ? d.location : "",
            lessonAmount:
              typeof d.lessonAmount === "number" ? d.lessonAmount : null,
            paymentStatus:
              typeof d.paymentStatus === "string" ? d.paymentStatus : "",
            reservationStatus:
              typeof d.reservationStatus === "string" ? d.reservationStatus : "",
            notes: typeof d.notes === "string" ? d.notes : "",
          };
        });

        // 日付＋時間の降順（新しい予約が先頭）
        data.sort((a, b) =>
          `${b.lessonDate} ${b.lessonTime}`.localeCompare(
            `${a.lessonDate} ${a.lessonTime}`
          )
        );

        setReservations(data);
      } catch (err) {
        console.error("予約取得エラー:", err);
        setError("予約履歴の取得に失敗しました。時間をおいて再度お試しください。");
      } finally {
        setLoading(false);
      }
    };

    fetchReservations();
  }, [user]);

  return (
    <main className="about-section fade-in-up">
      <h2 className="centered-heading-with-border">
        <span>予約履歴</span>
      </h2>

      <div style={{ maxWidth: "720px", margin: "2rem auto" }}>
        {loading ? (
          <p style={{ textAlign: "center" }}>読み込み中...</p>
        ) : error ? (
          <p style={{ textAlign: "center", color: "#c62828" }}>{error}</p>
        ) : reservations.length === 0 ? (
          <p style={{ textAlign: "center" }}>予約が見つかりません。</p>
        ) : (
          reservations.map((res) => (
            <div
              key={res.id}
              style={{
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: "10px",
                padding: "20px",
                marginBottom: "16px",
              }}
            >
              <div className="form-group">
                <p>
                  <strong>講師名：</strong>
                  {res.teacherName}
                </p>
                <p>
                  <strong>レッスンコース：</strong>
                  {res.lessonCourse}
                </p>
                <p>
                  <strong>日時：</strong>
                  {res.lessonDate} {res.lessonTime}
                </p>
                <p>
                  <strong>場所：</strong>
                  {res.location}
                </p>
                <p>
                  <strong>料金：</strong>
                  {typeof res.lessonAmount === "number"
                    ? `${res.lessonAmount.toLocaleString()}円`
                    : "―"}
                </p>
                <p>
                  <strong>決済状態：</strong>
                  {statusLabel(PAYMENT_STATUS_LABELS, res.paymentStatus)}
                </p>
                <p>
                  <strong>予約状態：</strong>
                  {statusLabel(RESERVATION_STATUS_LABELS, res.reservationStatus)}
                </p>
                {res.notes && (
                  <p>
                    <strong>ご要望：</strong>
                    {res.notes}
                  </p>
                )}
              </div>

              {isCancellable(res) && (
                <div style={{ marginTop: "12px" }}>
                  <button
                    type="button"
                    className="form-button"
                    onClick={() => handleCancel(res)}
                    disabled={cancellingId === res.id}
                    style={{ background: "#c62828", borderColor: "#c62828" }}
                  >
                    {cancellingId === res.id
                      ? "キャンセル処理中..."
                      : isPreCharge(res)
                        ? "この予約をキャンセルする（請求前・課金なし）"
                        : "この予約をキャンセルする（全額返金）"}
                  </button>
                  <p style={{ fontSize: "12px", color: "#666", marginTop: "6px" }}>
                    {isPreCharge(res)
                      ? "キャンセルはレッスン前日まで可能です（お支払い前のため課金なし）。当日のキャンセルはお問い合わせください。"
                      : "キャンセルはレッスン前日まで可能です（全額返金）。当日のキャンセルはお問い合わせください。"}
                  </p>
                </div>
              )}
            </div>
          ))
        )}

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            marginTop: "2rem",
            justifyContent: "center",
          }}
        >
          <Link to="/mypage" className="form-button">
            マイページへ戻る
          </Link>
        </div>
      </div>
    </main>
  );
};

export default StudentReservations;
