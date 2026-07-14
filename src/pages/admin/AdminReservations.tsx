// src/pages/admin/AdminReservations.tsx
// 管理者用: 全予約の一覧（閲覧のみ）
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../../firebase";
import { collection, getDocs } from "firebase/firestore";

interface Reservation {
  id: string;
  name: string;
  teacherName: string;
  lessonCourse: string;
  lessonDate: string;
  lessonTime: string;
  lessonAmount: number | null;
  paymentStatus: string;
  reservationStatus: string;
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

const AdminReservations: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError("");

        // 件数が増えたら日付フィルタやページングの導入を検討する
        const snapshot = await getDocs(collection(db, "reservations"));
        const data: Reservation[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            name: typeof d.name === "string" ? d.name : "",
            teacherName: typeof d.teacherName === "string" ? d.teacherName : "",
            lessonCourse: typeof d.lessonCourse === "string" ? d.lessonCourse : "",
            lessonDate: typeof d.lessonDate === "string" ? d.lessonDate : "",
            lessonTime: typeof d.lessonTime === "string" ? d.lessonTime : "",
            lessonAmount:
              typeof d.lessonAmount === "number" ? d.lessonAmount : null,
            paymentStatus:
              typeof d.paymentStatus === "string" ? d.paymentStatus : "",
            reservationStatus:
              typeof d.reservationStatus === "string" ? d.reservationStatus : "",
          };
        });

        data.sort((a, b) =>
          `${b.lessonDate} ${b.lessonTime}`.localeCompare(
            `${a.lessonDate} ${a.lessonTime}`
          )
        );

        setReservations(data);
      } catch (err) {
        console.error("予約一覧の取得に失敗しました:", err);
        setError("予約一覧の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  return (
    <main className="about-section fade-in-up">
      <h2 className="centered-heading-with-border">
        <span>予約一覧（管理）</span>
      </h2>

      <div style={{ maxWidth: "900px", margin: "2rem auto" }}>
        {loading ? (
          <p style={{ textAlign: "center" }}>読み込み中...</p>
        ) : error ? (
          <p style={{ textAlign: "center", color: "#c62828" }}>{error}</p>
        ) : reservations.length === 0 ? (
          <p style={{ textAlign: "center" }}>予約はありません。</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #ccc", textAlign: "left" }}>
                  <th style={{ padding: "8px" }}>日時</th>
                  <th style={{ padding: "8px" }}>生徒</th>
                  <th style={{ padding: "8px" }}>講師</th>
                  <th style={{ padding: "8px" }}>コース</th>
                  <th style={{ padding: "8px" }}>金額</th>
                  <th style={{ padding: "8px" }}>決済</th>
                  <th style={{ padding: "8px" }}>予約状態</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                      {r.lessonDate} {r.lessonTime}
                    </td>
                    <td style={{ padding: "8px" }}>{r.name}</td>
                    <td style={{ padding: "8px" }}>{r.teacherName}</td>
                    <td style={{ padding: "8px" }}>{r.lessonCourse}</td>
                    <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                      {typeof r.lessonAmount === "number"
                        ? `${r.lessonAmount.toLocaleString()}円`
                        : "―"}
                    </td>
                    <td style={{ padding: "8px" }}>
                      {statusLabel(PAYMENT_STATUS_LABELS, r.paymentStatus)}
                    </td>
                    <td style={{ padding: "8px" }}>
                      {statusLabel(RESERVATION_STATUS_LABELS, r.reservationStatus)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <Link to="/admin" className="form-button">
            管理画面トップへ戻る
          </Link>
        </div>
      </div>
    </main>
  );
};

export default AdminReservations;
