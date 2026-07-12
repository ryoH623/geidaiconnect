// src/pages/admin/AdminContacts.tsx
// 管理者用: お問い合わせ一覧＋対応ステータス変更
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

interface Contact {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string; // "new" | "done"
  seconds: number;
}

const STATUS_LABELS: Record<string, string> = {
  new: "未対応",
  done: "対応済み",
};

const AdminContacts: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError("");

        const snapshot = await getDocs(collection(db, "contacts"));
        const data: Contact[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            name: typeof d.name === "string" ? d.name : "",
            email: typeof d.email === "string" ? d.email : "",
            subject: typeof d.subject === "string" ? d.subject : "",
            message: typeof d.message === "string" ? d.message : "",
            status: typeof d.status === "string" ? d.status : "new",
            seconds: d.createdAt?.seconds ?? 0,
          };
        });

        data.sort((a, b) => b.seconds - a.seconds);
        setContacts(data);
      } catch (err) {
        console.error("お問い合わせ一覧の取得に失敗しました:", err);
        setError("お問い合わせ一覧の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const toggleStatus = async (contact: Contact) => {
    const nextStatus = contact.status === "done" ? "new" : "done";

    try {
      setUpdatingId(contact.id);
      await updateDoc(doc(db, "contacts", contact.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contact.id ? { ...c, status: nextStatus } : c
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
        <span>お問い合わせ一覧（管理）</span>
      </h2>

      <div style={{ maxWidth: "720px", margin: "2rem auto" }}>
        {loading ? (
          <p style={{ textAlign: "center" }}>読み込み中...</p>
        ) : error ? (
          <p style={{ textAlign: "center", color: "#c62828" }}>{error}</p>
        ) : contacts.length === 0 ? (
          <p style={{ textAlign: "center" }}>お問い合わせはありません。</p>
        ) : (
          contacts.map((c) => (
            <div
              key={c.id}
              style={{
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: "10px",
                padding: "16px",
                marginBottom: "12px",
                opacity: c.status === "done" ? 0.7 : 1,
              }}
            >
              <p>
                <strong>件名：</strong>
                {c.subject}
                <span
                  style={{
                    marginLeft: "8px",
                    fontSize: "12px",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    background: c.status === "done" ? "#e0e0e0" : "#fff3cd",
                  }}
                >
                  {STATUS_LABELS[c.status] || c.status}
                </span>
              </p>
              <p>
                <strong>お名前：</strong>
                {c.name}（
                <a href={`mailto:${c.email}`}>{c.email}</a>）
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>
                <strong>内容：</strong>
                <br />
                {c.message}
              </p>
              {c.seconds > 0 && (
                <p style={{ fontSize: "12px", color: "#666" }}>
                  受信日: {new Date(c.seconds * 1000).toLocaleString()}
                </p>
              )}
              <button
                type="button"
                className="form-button"
                onClick={() => toggleStatus(c)}
                disabled={updatingId === c.id}
              >
                {updatingId === c.id
                  ? "更新中..."
                  : c.status === "done"
                  ? "未対応に戻す"
                  : "対応済みにする"}
              </button>
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

export default AdminContacts;
