import React, { useState } from "react";
import { db, auth } from "../firebase";
import { addDoc, collection } from "firebase/firestore";

const TeacherScheduleForm: React.FC = () => {
  const [date, setDate] = useState("");
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [location, setLocation] = useState("自宅");
  const [note, setNote] = useState("");

  const timeOptions = Array.from({ length: 25 }, (_, i) => {
    const hour = Math.floor(i / 2) + 10;
    const minutes = i % 2 === 0 ? "00" : "30";
    return `${String(hour).padStart(2, "0")}:${minutes}`;
  });

  const toggleTimeSlot = (time: string) => {
    setTimeSlots((prev) =>
      prev.includes(time)
        ? prev.filter((t) => t !== time)
        : [...prev, time]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const user = auth.currentUser;

    if (!user) {
      alert("ログインしてください。");
      return;
    }

    try {
      await addDoc(collection(db, "schedules"), {
        uid: user.uid,
        date,
        timeSlots,
        location,
        note,
        createdAt: new Date(),
      });

      alert("スケジュールを登録しました！");
      setDate("");
      setTimeSlots([]);
      setLocation("自宅");
      setNote("");
    } catch (error) {
      console.error("スケジュール登録エラー:", error);
      alert("登録に失敗しました");
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 bg-white shadow-md rounded-md mt-20">
      <h2 className="text-2xl font-semibold mb-4 text-center border-l-4 border-gray-500 pl-4">
        講師スケジュール登録フォーム
      </h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block mb-1 font-medium">レッスン日</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>

        <div className="mb-4">
          <label className="block mb-1 font-medium">時間帯（複数選択可）</label>
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto border p-2 rounded">
            {timeOptions.map((time) => (
              <label key={time} className="flex items-center">
                <input
                  type="checkbox"
                  checked={timeSlots.includes(time)}
                  onChange={() => toggleTimeSlot(time)}
                  className="mr-2"
                />
                {time}
              </label>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block mb-1 font-medium">レッスン方法</label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="自宅">自宅</option>
            <option value="スタジオ">スタジオ</option>
            <option value="出張">出張</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block mb-1 font-medium">備考</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border rounded px-3 py-2"
            rows={3}
            placeholder="例）スタジオの場所、楽器持参の有無など"
          />
        </div>

        <button
          type="submit"
          className="bg-gray-800 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded w-full"
        >
          登録する
        </button>
      </form>
    </div>
  );
};

export default TeacherScheduleForm;