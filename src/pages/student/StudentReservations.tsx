import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { db } from "../../firebase";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
} from "firebase/firestore";
import { cancelReservation } from "../../utils/cancelReservation";

interface Reservation {
  id: string;
  teacherName: string;
  lessonDate: Timestamp;
  lessonLocation: string;
  status: string;
  notes?: string;
}

const StudentReservations: React.FC = () => {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchReservations = async () => {
      try {
        const q = query(
          collection(db, "reservations"),
          where("studentId", "==", user.uid),
          orderBy("lessonDate", "desc")
        );
        const querySnapshot = await getDocs(q);

        const data: Reservation[] = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Reservation[];

        setReservations(data);
      } catch (error) {
        console.error("予約取得エラー:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReservations();
  }, [user]);

  const handleCancel = async (id: string) => {
    if (!window.confirm("この予約をキャンセルしますか？")) return;
    try {
      await cancelReservation(id);
      setReservations((prev) =>
        prev.map((res) =>
          res.id === id ? { ...res, status: "canceled" } : res
        )
      );
      alert("キャンセルが完了しました。");
    } catch (error) {
      console.error("キャンセルエラー:", error);
      alert("キャンセルに失敗しました。");
    }
  };

  if (!user) return <p>ログインが必要です。</p>;
  if (loading) return <p>読み込み中...</p>;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold mb-4">予約履歴</h2>

      {reservations.length === 0 ? (
        <p>予約が見つかりません。</p>
      ) : (
        <ul className="space-y-4">
          {reservations.map((res) => (
            <li
              key={res.id}
              className="border rounded p-4 bg-white shadow-md"
            >
              <p>
                <strong>講師:</strong> {res.teacherName}
              </p>
              <p>
                <strong>日時:</strong>{" "}
                {res.lessonDate.toDate().toLocaleString("ja-JP")}
              </p>
              <p>
                <strong>場所:</strong> {res.lessonLocation}
              </p>
              <p>
                <strong>ステータス:</strong>{" "}
                {res.status === "canceled" ? "キャンセル済" : "予約中"}
              </p>
              {res.notes && (
                <p>
                  <strong>ご要望:</strong> {res.notes}
                </p>
              )}
              {res.status !== "canceled" && (
                <button
                  onClick={() => handleCancel(res.id)}
                  className="mt-2 px-4 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  キャンセル
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default StudentReservations;
