// src/pages/teachers/ScheduleForm.tsx
import React, { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";

const ScheduleForm = () => {
  const { user } = useAuth();

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:00");
  const [locationType, setLocationType] = useState("自宅");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      await addDoc(collection(db, "schedules"), {
        teacherId: user.uid,
        date,
        startTime,
        endTime,
        locationType,
        notes,
        createdAt: serverTimestamp(),
      });
      alert("スケジュールを登録しました");
      setDate("");
      setStartTime("10:00");
      setEndTime("11:00");
      setLocationType("自宅");
      setNotes("");
    } catch (error) {
      console.error("登録エラー:", error);
      alert("登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const timeOptions = [
    "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30",
    "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30",
    "18:00", "18:30", "19:00", "19:30"
  ];

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 500, margin: "auto" }}>
      <h2>スケジュール登録</h2>

      <label>レッスン日</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

      <label>開始時間</label>
      <select value={startTime} onChange={(e) => setStartTime(e.target.value)} required>
        {timeOptions.map(time => <option key={time} value={time}>{time}</option>)}
      </select>

      <label>終了時間</label>
      <select value={endTime} onChange={(e) => setEndTime(e.target.value)} required>
        {timeOptions.map(time => <option key={time} value={time}>{time}</option>)}
      </select>

      <label>レッスン方法</label>
      <select value={locationType} onChange={(e) => setLocationType(e.target.value)} required>
        <option value="自宅">自宅</option>
        <option value="スタジオ">スタジオ</option>
        <option value="出張">出張</option>
      </select>

      <label>備考</label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="場所の詳細や注意事項など"
      />

      <button type="submit" disabled={loading}>
        {loading ? "登録中..." : "登録する"}
      </button>
    </form>
  );
};

export default ScheduleForm;
