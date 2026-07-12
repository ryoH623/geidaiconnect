// src/pages/admin/AdminReviews.tsx
// 管理者用: 全レビューの一覧＋削除（不適切レビュー対応）
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../../firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";

interface Review {
  id: string;
  teacherId: string;
  userId: string;
  rating: number;
  comment: string;
  seconds: number; // 投稿時刻（createdAt / timestamp のどちらか）
}

const AdminReviews: React.FC = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError("");

        const snapshot = await getDocs(collection(db, "reviews"));
        const data: Review[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            teacherId: typeof d.teacherId === "string" ? d.teacherId : "",
            userId: typeof d.userId === "string" ? d.userId : "",
            rating: typeof d.rating === "number" ? d.rating : 0,
            comment: typeof d.comment === "string" ? d.comment : "",
            seconds: d.createdAt?.seconds ?? d.timestamp?.seconds ?? 0,
          };
        });

        data.sort((a, b) => b.seconds - a.seconds);
        setReviews(data);
      } catch (err) {
        console.error("レビュー一覧の取得に失敗しました:", err);
        setError("レビュー一覧の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const handleDelete = async (review: Review) => {
    if (
      !window.confirm(
        `このレビューを削除しますか？\n\n講師: ${review.teacherId}\n内容: ${review.comment}`
      )
    ) {
      return;
    }

    try {
      setDeletingId(review.id);
      await deleteDoc(doc(db, "reviews", review.id));
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
    } catch (err) {
      console.error("レビューの削除に失敗しました:", err);
      alert("削除に失敗しました。もう一度お試しください。");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="about-section fade-in-up">
      <h2 className="centered-heading-with-border">
        <span>レビュー管理</span>
      </h2>

      <div style={{ maxWidth: "720px", margin: "2rem auto" }}>
        {loading ? (
          <p style={{ textAlign: "center" }}>読み込み中...</p>
        ) : error ? (
          <p style={{ textAlign: "center", color: "#c62828" }}>{error}</p>
        ) : reviews.length === 0 ? (
          <p style={{ textAlign: "center" }}>レビューはありません。</p>
        ) : (
          reviews.map((r) => (
            <div
              key={r.id}
              style={{
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: "10px",
                padding: "16px",
                marginBottom: "12px",
              }}
            >
              <p>
                <strong>講師：</strong>
                {r.teacherId}
              </p>
              <p>
                <strong>評価：</strong>
                {"★".repeat(r.rating)}
                {"☆".repeat(Math.max(0, 5 - r.rating))}
              </p>
              <p>
                <strong>内容：</strong>
                {r.comment}
              </p>
              {r.seconds > 0 && (
                <p style={{ fontSize: "12px", color: "#666" }}>
                  投稿日: {new Date(r.seconds * 1000).toLocaleDateString()}
                </p>
              )}
              <button
                type="button"
                className="form-button"
                onClick={() => handleDelete(r)}
                disabled={deletingId === r.id}
                style={{ background: "#c62828", borderColor: "#c62828" }}
              >
                {deletingId === r.id ? "削除中..." : "このレビューを削除"}
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

export default AdminReviews;
