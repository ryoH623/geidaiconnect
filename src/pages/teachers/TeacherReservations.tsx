// src/pages/teachers/TeacherReservations.tsx
// 講師用: 自分宛の予約一覧。オンラインレッスンのみ参加URLを登録できる。
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "../../contexts/AuthContext";
import { db, functions } from "../../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

interface Reservation {
  id: string;
  name: string;
  furigana: string;
  email: string;
  phone: string;
  lessonCourse: string;
  lessonDate: string; // "YYYY-MM-DD"
  lessonTime: string; // "HH:mm"
  lessonType: string; // "自宅" | "スタジオ" | "出張" | "オンライン"
  location: string;
  lessonAmount: number | null;
  paymentStatus: string;
  reservationStatus: string;
  notes?: string;
  /** オンラインレッスンの参加URL（未登録なら空） */
  meetingUrl: string;
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending_payment: "決済待ち",
  paid: "支払済み",
  refunded: "返金済み",
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

const TeacherReservations: React.FC = () => {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // オンライン予約ごとの参加URL入力欄（予約ID → 入力中の値）
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({});
  const [savingUrlId, setSavingUrlId] = useState<string | null>(null);
  const [urlMessage, setUrlMessage] = useState<Record<string, string>>({});

  const handleSaveMeetingUrl = async (reservationId: string) => {
    const value = (urlDrafts[reservationId] ?? "").trim();
    setSavingUrlId(reservationId);
    setUrlMessage((prev) => ({ ...prev, [reservationId]: "" }));

    try {
      const callable = httpsCallable<
        { reservationId: string; meetingUrl: string },
        { ok: boolean; message: string }
      >(functions, "setMeetingUrl");
      const res = await callable({ reservationId, meetingUrl: value });

      setReservations((prev) =>
        prev.map((r) => (r.id === reservationId ? { ...r, meetingUrl: value } : r))
      );
      setUrlMessage((prev) => ({
        ...prev,
        [reservationId]: res.data?.message || "保存しました。",
      }));
    } catch (err: any) {
      console.error("参加URLの保存に失敗:", err);
      setUrlMessage((prev) => ({
        ...prev,
        [reservationId]: err?.message || "保存に失敗しました。",
      }));
    } finally {
      setSavingUrlId(null);
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
          where("teacherId", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);

        const data: Reservation[] = querySnapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            name: typeof d.name === "string" ? d.name : "",
            furigana: typeof d.furigana === "string" ? d.furigana : "",
            email: typeof d.email === "string" ? d.email : "",
            phone: typeof d.phone === "string" ? d.phone : "",
            lessonCourse: typeof d.lessonCourse === "string" ? d.lessonCourse : "",
            lessonDate: typeof d.lessonDate === "string" ? d.lessonDate : "",
            lessonTime: typeof d.lessonTime === "string" ? d.lessonTime : "",
            lessonType: typeof d.lessonType === "string" ? d.lessonType : "",
            location: typeof d.location === "string" ? d.location : "",
            meetingUrl: typeof d.meetingUrl === "string" ? d.meetingUrl : "",
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
        setError("予約一覧の取得に失敗しました。時間をおいて再度お試しください。");
      } finally {
        setLoading(false);
      }
    };

    fetchReservations();
  }, [user]);

  return (
    <main className="about-section fade-in-up">
      <h2 className="centered-heading-with-border">
        <span>予約一覧（講師用）</span>
      </h2>

      <div style={{ maxWidth: "720px", margin: "2rem auto" }}>
        {loading ? (
          <p style={{ textAlign: "center" }}>読み込み中...</p>
        ) : error ? (
          <p style={{ textAlign: "center", color: "#c62828" }}>{error}</p>
        ) : reservations.length === 0 ? (
          <p style={{ textAlign: "center" }}>予約はまだありません。</p>
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
                  <strong>生徒氏名：</strong>
                  {res.name}
                  {res.furigana && `（${res.furigana}）`}
                </p>
                <p>
                  <strong>連絡先：</strong>
                  {res.email}
                  {res.phone && ` / ${res.phone}`}
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

              {res.lessonType === "オンライン" &&
                res.reservationStatus !== "cancelled" && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "0.9rem",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      background: "#fafafa",
                    }}
                  >
                    <label
                      htmlFor={`meeting-url-${res.id}`}
                      style={{ fontWeight: "bold" }}
                    >
                      オンラインレッスンの参加URL
                    </label>
                    <p
                      style={{
                        fontSize: "0.85rem",
                        color: "#666",
                        margin: "0.25rem 0 0.5rem",
                      }}
                    >
                      Zoom・Google Meet などの会議URLを登録すると、生徒のマイページと
                      前日のリマインドメールに表示されます。
                    </p>
                    <input
                      id={`meeting-url-${res.id}`}
                      type="url"
                      value={urlDrafts[res.id] ?? res.meetingUrl}
                      onChange={(e) =>
                        setUrlDrafts((prev) => ({
                          ...prev,
                          [res.id]: e.target.value,
                        }))
                      }
                      placeholder="https://us02web.zoom.us/j/..."
                      maxLength={500}
                      style={{ width: "100%" }}
                    />
                    <button
                      type="button"
                      className="form-button"
                      onClick={() => handleSaveMeetingUrl(res.id)}
                      disabled={savingUrlId === res.id}
                      style={{ marginTop: 8 }}
                    >
                      {savingUrlId === res.id ? "保存中..." : "URLを保存"}
                    </button>
                    {urlMessage[res.id] && (
                      <p style={{ fontSize: "0.85rem", margin: "0.5rem 0 0" }}>
                        {urlMessage[res.id]}
                      </p>
                    )}
                    {!res.meetingUrl && (
                      <p
                        style={{
                          fontSize: "0.85rem",
                          color: "#c62828",
                          margin: "0.5rem 0 0",
                        }}
                      >
                        まだ登録されていません。レッスン前日までにご登録ください。
                      </p>
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

export default TeacherReservations;
