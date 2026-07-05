import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../firebase";

type ScheduleItem = {
  id: string;
  teacherId: string;
  date: string;
  time: string;
  lessonMethods: string[];
  status?: string;
  isAvailable?: boolean;
};

type GroupedSchedule = {
  date: string;
  items: ScheduleItem[];
};

const SCHEDULES_COLLECTION = "schedules";

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function getMethodLabel(methods: string[]): string {
  if (methods.length === 0) return "未設定";
  return uniqueSorted(methods).join(" / ");
}

function getWeekdayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  const labels = ["日", "月", "火", "水", "木", "金", "土"];
  return labels[date.getDay()] ?? "";
}

function isSunday(dateKey: string): boolean {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return date.getDay() === 0;
}

function isSaturday(dateKey: string): boolean {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  return date.getDay() === 6;
}

function groupByDate(items: ScheduleItem[]): GroupedSchedule[] {
  const map = new Map<string, ScheduleItem[]>();

  items.forEach((item) => {
    const current = map.get(item.date) ?? [];
    current.push(item);
    map.set(item.date, current);
  });

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, groupedItems]) => ({
      date,
      items: groupedItems.sort((a, b) => a.time.localeCompare(b.time)),
    }));
}

export default function ScheduleList() {
  const navigate = useNavigate();

  const [teacherId, setTeacherId] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string>("");
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setTeacherId(user?.uid ?? "");
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchSchedules = useCallback(async () => {
    if (!teacherId) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const schedulesRef = collection(db, SCHEDULES_COLLECTION);
      const q = query(
        schedulesRef,
        where("teacherId", "==", teacherId),
        orderBy("date", "asc"),
        orderBy("time", "asc")
      );

      const snapshot = await getDocs(q);

      const nextItems: ScheduleItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          teacherId: typeof data.teacherId === "string" ? data.teacherId : "",
          date: typeof data.date === "string" ? data.date : "",
          time: typeof data.time === "string" ? data.time : "",
          lessonMethods: Array.isArray(data.lessonMethods)
            ? data.lessonMethods.filter((v): v is string => typeof v === "string")
            : [],
          status: typeof data.status === "string" ? data.status : "",
          isAvailable:
            typeof data.isAvailable === "boolean" ? data.isAvailable : true,
        };
      });

      setItems(nextItems);
    } catch (error) {
      console.error("スケジュール一覧の取得に失敗しました:", error);
      setErrorMessage(
        "スケジュール一覧の取得に失敗しました。Firestore のインデックスや権限設定をご確認ください。"
      );
    } finally {
      setIsLoading(false);
    }
  }, [teacherId]);

  useEffect(() => {
    if (!isAuthLoading && teacherId) {
      fetchSchedules();
    }
  }, [fetchSchedules, isAuthLoading, teacherId]);

  const groupedSchedules = useMemo(() => {
    return groupByDate(items);
  }, [items]);

  const handleDeleteSlot = async (item: ScheduleItem) => {
    const ok = window.confirm(
      `${item.date} ${item.time} の枠を削除しますか？`
    );
    if (!ok) return;

    setSuccessMessage("");
    setErrorMessage("");
    setIsDeleting(item.id);

    try {
      await deleteDoc(doc(db, SCHEDULES_COLLECTION, item.id));

      setItems((prev) => prev.filter((v) => v.id !== item.id));
      setSuccessMessage(`${item.date} ${item.time} の枠を削除しました。`);
    } catch (error) {
      console.error("時間枠の削除に失敗しました:", error);
      setErrorMessage("時間枠の削除に失敗しました。再度お試しください。");
    } finally {
      setIsDeleting("");
    }
  };

  const handleEditDate = (date: string) => {
    navigate(`/schedule-form?editDate=${encodeURIComponent(date)}&mode=bulk`);
  };

  if (isAuthLoading) {
    return (
      <div className="schedule-list-page">
        <div className="schedule-list-container">
          <h1 className="schedule-list-title">登録済みスケジュール一覧</h1>
          <p className="schedule-list-loading">ログイン情報を確認しています...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="schedule-list-page">
      <div className="schedule-list-container">
        <div className="schedule-list-header">
          <div>
            <h1 className="schedule-list-title">登録済みスケジュール一覧</h1>
            <p className="schedule-list-description">
              登録済みの時間枠を日付ごとに確認できます。削除や編集導線もここから利用できます。
            </p>
          </div>

          <button
            type="button"
            className="schedule-list-add-button"
            onClick={() => navigate("/schedule-form")}
          >
            新しく登録する
          </button>
        </div>

        {successMessage && (
          <div className="schedule-list-message schedule-list-message--success">
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="schedule-list-message schedule-list-message--error">
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <p className="schedule-list-loading">スケジュールを読み込み中です...</p>
        ) : groupedSchedules.length === 0 ? (
          <div className="schedule-list-empty">
            <p>まだ登録済みスケジュールはありません。</p>
          </div>
        ) : (
          <div className="schedule-list-groups">
            {groupedSchedules.map((group) => {
              const weekday = getWeekdayLabel(group.date);
              const weekdayClass = isSunday(group.date)
                ? "is-sunday"
                : isSaturday(group.date)
                ? "is-saturday"
                : "";

              return (
                <section key={group.date} className="schedule-list-group-card">
                  <div className="schedule-list-group-header">
                    <div>
                      <h2 className={`schedule-list-group-title ${weekdayClass}`}>
                        {group.date}（{weekday}）
                      </h2>
                      <p className="schedule-list-group-count">
                        {group.items.length}枠登録
                      </p>
                    </div>

                    <button
                      type="button"
                      className="schedule-list-edit-button"
                      onClick={() => handleEditDate(group.date)}
                    >
                      この日を編集へ戻る
                    </button>
                  </div>

                  <div className="schedule-list-table-wrap">
                    <table className="schedule-list-table">
                      <thead>
                        <tr>
                          <th>時間</th>
                          <th>レッスン場所</th>
                          <th>状態</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.time}</td>
                            <td>{getMethodLabel(item.lessonMethods)}</td>
                            <td>
                              {item.isAvailable === false
                                ? "受付停止"
                                : item.status || "open"}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="schedule-list-delete-button"
                                onClick={() => handleDeleteSlot(item)}
                                disabled={isDeleting === item.id}
                              >
                                {isDeleting === item.id ? "削除中..." : "この枠を削除"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}