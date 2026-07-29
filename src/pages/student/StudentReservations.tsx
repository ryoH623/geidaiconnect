// src/pages/student/StudentReservations.tsx
// 予約履歴一覧。確定済み予約はレッスン前日まで全額返金でキャンセル可能。
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "../../contexts/AuthContext";
import { db, functions } from "../../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import BookingCalendar from "../../components/booking/BookingCalendar";

interface Reservation {
  id: string;
  teacherId: string;
  teacherName: string;
  lessonCourse: string;
  lessonType: string; // "自宅" | "スタジオ" | "出張" | "オンライン"
  lessonDate: string; // "YYYY-MM-DD"
  lessonTime: string; // "HH:mm"
  location: string;
  lessonAmount: number | null;
  paymentStatus: string;
  reservationStatus: string;
  rescheduleCount: number; // 日程変更した回数（1回まで許可）
  /** オンラインレッスンの参加URL（講師が登録するまで空） */
  meetingUrl: string;
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

// レッスン開始日時（JST）。
function lessonStartMs(res: { lessonDate: string; lessonTime: string }): number {
  return new Date(
    `${res.lessonDate}T${res.lessonTime || "00:00"}:00+09:00`
  ).getTime();
}

// 日程変更（振替）可能か: 確定・決済済み(paid/authorized)・自宅/出張/オンライン・未振替・レッスン開始前。
// バックエンド rescheduleReservation の判定と一致させる。
function isReschedulable(res: Reservation): boolean {
  return (
    res.reservationStatus === "confirmed" &&
    (res.paymentStatus === "paid" || res.paymentStatus === "authorized") &&
    (res.lessonType === "自宅" ||
      res.lessonType === "出張" ||
      res.lessonType === "オンライン") &&
    res.rescheduleCount < 1 &&
    Date.now() < lessonStartMs(res)
  );
}

const StudentReservations: React.FC = () => {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  // 日程変更（振替）用: 変更パネルを開いている予約ID・選択中の新日時・送信中フラグ・表示月
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [newSlotDate, setNewSlotDate] = useState("");
  const [newSlotTime, setNewSlotTime] = useState("");
  const [rescheduleMonth, setRescheduleMonth] = useState<Date>(new Date());
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);

  const openReschedule = (res: Reservation) => {
    setReschedulingId(res.id);
    setNewSlotDate("");
    setNewSlotTime("");
    setRescheduleMonth(new Date());
  };

  const closeReschedule = () => {
    setReschedulingId(null);
    setNewSlotDate("");
    setNewSlotTime("");
  };

  const handleReschedule = async (res: Reservation) => {
    if (!newSlotDate || !newSlotTime) {
      alert("変更先の日時を選んでください。");
      return;
    }
    const confirmed = window.confirm(
      `以下の予約の日程を変更します。よろしいですか？\n\n` +
        `${res.teacherName} / ${res.lessonCourse}\n` +
        `変更前：${res.lessonDate} ${res.lessonTime}\n` +
        `変更後：${newSlotDate} ${newSlotTime}\n\n` +
        `お支払いはそのまま新しい日時へ引き継がれます（追加請求・返金はありません）。\n` +
        `日程変更は1回までです。`
    );
    if (!confirmed) return;

    try {
      setRescheduleSubmitting(true);
      const callable = httpsCallable<
        { reservationId: string; newDate: string; newTime: string },
        { ok: boolean; message: string }
      >(functions, "rescheduleReservation");
      const result = await callable({
        reservationId: res.id,
        newDate: newSlotDate,
        newTime: newSlotTime,
      });

      alert(result.data?.message || "予約の日程を変更しました。");

      // 画面へ即時反映（新日時・振替回数）
      setReservations((prev) =>
        prev.map((r) =>
          r.id === res.id
            ? {
                ...r,
                lessonDate: newSlotDate,
                lessonTime: newSlotTime,
                rescheduleCount: r.rescheduleCount + 1,
              }
            : r
        )
      );
      closeReschedule();
    } catch (err: any) {
      console.error("日程変更エラー:", err);
      alert(
        err?.message ||
          "日程変更に失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setRescheduleSubmitting(false);
    }
  };

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
            teacherId: typeof d.teacherId === "string" ? d.teacherId : "",
            teacherName: typeof d.teacherName === "string" ? d.teacherName : "",
            lessonCourse: typeof d.lessonCourse === "string" ? d.lessonCourse : "",
            lessonType: typeof d.lessonType === "string" ? d.lessonType : "",
            lessonDate: typeof d.lessonDate === "string" ? d.lessonDate : "",
            lessonTime: typeof d.lessonTime === "string" ? d.lessonTime : "",
            location: typeof d.location === "string" ? d.location : "",
            meetingUrl: typeof d.meetingUrl === "string" ? d.meetingUrl : "",
            lessonAmount:
              typeof d.lessonAmount === "number" ? d.lessonAmount : null,
            paymentStatus:
              typeof d.paymentStatus === "string" ? d.paymentStatus : "",
            reservationStatus:
              typeof d.reservationStatus === "string" ? d.reservationStatus : "",
            rescheduleCount:
              typeof d.rescheduleCount === "number" ? d.rescheduleCount : 0,
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
                  {res.lessonType === "オンライン" ? "オンライン" : res.location}
                </p>
                {res.lessonType === "オンライン" &&
                  res.reservationStatus !== "cancelled" && (
                    <p>
                      <strong>参加URL：</strong>
                      {res.meetingUrl ? (
                        <a
                          href={res.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ textDecoration: "underline" }}
                        >
                          {res.meetingUrl}
                        </a>
                      ) : (
                        <span style={{ color: "#666" }}>
                          講師が登録し次第、こちらと前日のメールでご案内します。
                        </span>
                      )}
                    </p>
                  )}
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

              {isReschedulable(res) && (
                <div style={{ marginTop: "12px" }}>
                  {reschedulingId === res.id ? (
                    <div
                      style={{
                        border: "1px solid #e0dccf",
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <p style={{ margin: "0 0 8px", fontWeight: "bold" }}>
                        新しい日時を選んでください（{res.lessonType}のレッスン）
                      </p>
                      <BookingCalendar
                        teacherId={res.teacherId}
                        requiredMethod={res.lessonType}
                        displayMonth={rescheduleMonth}
                        onChangeMonth={(m: Date) => setRescheduleMonth(m)}
                        onDateTimeSelect={(d, t) => {
                          setNewSlotDate(d);
                          setNewSlotTime(t);
                        }}
                      />
                      <p style={{ fontSize: 13, color: "#444", margin: "8px 0" }}>
                        選択中：
                        {newSlotDate && newSlotTime
                          ? `${newSlotDate} ${newSlotTime}`
                          : "未選択"}
                      </p>
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <button
                          type="button"
                          className="form-button"
                          onClick={() => handleReschedule(res)}
                          disabled={
                            rescheduleSubmitting || !newSlotDate || !newSlotTime
                          }
                        >
                          {rescheduleSubmitting
                            ? "変更中..."
                            : "この日時に変更する"}
                        </button>
                        <button
                          type="button"
                          className="form-button"
                          onClick={closeReschedule}
                          disabled={rescheduleSubmitting}
                          style={{ background: "#888", borderColor: "#888" }}
                        >
                          やめる
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="form-button"
                        onClick={() => openReschedule(res)}
                        style={{ background: "#2e6da4", borderColor: "#2e6da4" }}
                      >
                        日程を変更する
                      </button>
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#666",
                          marginTop: "6px",
                        }}
                      >
                        日程変更はレッスン開始前まで、1回まで可能です（追加請求・返金はありません）。
                      </p>
                    </>
                  )}
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
