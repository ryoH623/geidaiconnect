// src/pages/teachers/ScheduleList.tsx
import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";

interface Schedule {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  locationType: string;
  notes: string;
}

const ScheduleList = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, "schedules"), where("teacherId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const data: Schedule[] = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<Schedule, "id">)
      }));
      setSchedules(data);
    } catch (error) {
      console.error("スケジュールの取得に失敗しました:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("このスケジュールを削除しますか？")) return;

    try {
      await deleteDoc(doc(db, "schedules", id));
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error("削除に失敗しました:", error);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [user]);

  if (loading) return <p>読み込み中...</p>;

  return (
    <div style={{ maxWidth: 600, margin: "auto" }}>
      <h2>登録済みスケジュール一覧</h2>
      {schedules.length === 0 ? (
        <p>登録されたスケジュールはありません。</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {schedules.map((schedule) => (
            <li key={schedule.id} style={{ border: "1px solid #ccc", padding: 10, marginBottom: 10 }}>
              <p><strong>日付：</strong>{schedule.date}</p>
              <p><strong>時間：</strong>{schedule.startTime}〜{schedule.endTime}</p>
              <p><strong>方法：</strong>{schedule.locationType}</p>
              <p><strong>備考：</strong>{schedule.notes || "（なし）"}</p>
              <button onClick={() => handleDelete(schedule.id)}>削除</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ScheduleList;
