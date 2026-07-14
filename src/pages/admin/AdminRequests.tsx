// src/pages/admin/AdminRequests.tsx
// 管理者用: 演奏・展示などの依頼一覧＋対応ステータス変更
// お問い合わせ（AdminContacts）と同パターン。依頼は商談として進行段階があるため
// ステータスは new / in_progress / done の3段階セレクトで管理する。
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

interface RequestItem {
  id: string;
  requestType: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  eventDate: string;
  venue: string;
  budget: string;
  genre: string;
  message: string;
  status: string; // "new" | "in_progress" | "done"
  seconds: number;
}

const STATUS_LABELS: Record<string, string> = {
  new: "未対応",
  in_progress: "対応中",
  done: "成約・終了",
};

const STATUS_COLORS: Record<string, string> = {
  new: "#fff3cd",
  in_progress: "#d0e7ff",
  done: "#e0e0e0",
};

const AdminRequests: React.FC = () => {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError("");

        const snapshot = await getDocs(collection(db, "requests"));
        const data: RequestItem[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const str = (v: unknown) => (typeof v === "string" ? v : "");
          return {
            id: docSnap.id,
            requestType: str(d.requestType),
            name: str(d.name),
            email: str(d.email),
            phone: str(d.phone),
            organization: str(d.organization),
            eventDate: str(d.eventDate),
            venue: str(d.venue),
            budget: str(d.budget),
            genre: str(d.genre),
            message: str(d.message),
            status: str(d.status) || "new",
            seconds: d.createdAt?.seconds ?? 0,
          };
        });

        data.sort((a, b) => b.seconds - a.seconds);
        setRequests(data);
      } catch (err) {
        console.error("依頼一覧の取得に失敗しました:", err);
        setError("依頼一覧の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const changeStatus = async (request: RequestItem, nextStatus: string) => {
    if (nextStatus === request.status) return;

    try {
      setUpdatingId(request.id);
      await updateDoc(doc(db, "requests", request.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      setRequests((prev) =>
        prev.map((r) =>
          r.id === request.id ? { ...r, status: nextStatus } : r
        )
      );
    } catch (err) {
      console.error("ステータスの更新に失敗しました:", err);
      alert("ステータスの更新に失敗しました。");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <main className="about-section fade-in-up">
      <h2 className="centered-heading-with-border">
        <span>依頼一覧（管理）</span>
      </h2>

      <div style={{ maxWidth: "720px", margin: "2rem auto" }}>
        {loading ? (
          <p style={{ textAlign: "center" }}>読み込み中...</p>
        ) : error ? (
          <p style={{ textAlign: "center", color: "#c62828" }}>{error}</p>
        ) : requests.length === 0 ? (
          <p style={{ textAlign: "center" }}>依頼はまだありません。</p>
        ) : (
          requests.map((r) => (
            <div
              key={r.id}
              style={{
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: "10px",
                padding: "16px",
                marginBottom: "12px",
                opacity: r.status === "done" ? 0.7 : 1,
              }}
            >
              <p>
                <strong>{r.requestType || "依頼"}</strong>
                <span
                  style={{
                    marginLeft: "8px",
                    fontSize: "12px",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    background: STATUS_COLORS[r.status] || "#fff3cd",
                  }}
                >
                  {STATUS_LABELS[r.status] || r.status}
                </span>
              </p>
              <p>
                <strong>お名前：</strong>
                {r.name}
                {r.organization && `（${r.organization}）`}
              </p>
              <p>
                <strong>連絡先：</strong>
                <a href={`mailto:${r.email}`}>{r.email}</a>
                {r.phone && ` / ${r.phone}`}
              </p>
              {r.eventDate && (
                <p>
                  <strong>希望日・時期：</strong>
                  {r.eventDate}
                </p>
              )}
              {r.venue && (
                <p>
                  <strong>開催場所：</strong>
                  {r.venue}
                </p>
              )}
              {r.budget && (
                <p>
                  <strong>ご予算：</strong>
                  {r.budget}
                </p>
              )}
              {r.genre && (
                <p>
                  <strong>希望ジャンル・楽器：</strong>
                  {r.genre}
                </p>
              )}
              <p style={{ whiteSpace: "pre-wrap" }}>
                <strong>依頼内容：</strong>
                <br />
                {r.message}
              </p>
              {r.seconds > 0 && (
                <p style={{ fontSize: "12px", color: "#666" }}>
                  受信日: {new Date(r.seconds * 1000).toLocaleString()}
                </p>
              )}
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <label htmlFor={`status-${r.id}`}>
                  <strong>対応状況：</strong>
                </label>
                <select
                  id={`status-${r.id}`}
                  className="form-control"
                  value={r.status}
                  onChange={(e) => changeStatus(r, e.target.value)}
                  disabled={updatingId === r.id}
                  style={{ maxWidth: "200px" }}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {updatingId === r.id && <span>更新中...</span>}
              </div>
            </div>
          ))
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

export default AdminRequests;
