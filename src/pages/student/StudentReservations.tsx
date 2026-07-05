// src/pages/student/StudentReservations.tsx
// 予約履歴一覧（閲覧のみ）。キャンセル・返金は仕様確定後に別途実装する。
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebase";
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
  paid: "支払済み",
  expired: "期限切れ",
};

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  pending: "確定待ち",
  confirmed: "確定",
  expired: "期限切れ",
};

function statusLabel(map: Record<string, string>, value: string): string {
  return map[value] || value || "不明";
}

const StudentReservations: React.FC = () => {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
