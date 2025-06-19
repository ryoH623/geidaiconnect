// src/components/ReviewList.tsx
import { useEffect, useState } from "react";
import { deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
} from "firebase/firestore";

interface Props {
  teacherId: string;
}

type Review = {
  id: string;
  rating: number;
  comment: string;
  createdAt: { seconds: number };
  reply?: string;
};

export default function ReviewList({ teacherId }: Props) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editComment, setEditComment] = useState("");
  const [editRating, setEditRating] = useState<number>(0);
  const [replyText, setReplyText] = useState("");
  const [replyingId, setReplyingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const q = query(
          collection(db, "reviews"),
          where("teacherId", "==", teacherId),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const reviewData = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Review[];
        setReviews(reviewData);
      } catch (error) {
        console.error("レビューの取得に失敗しました", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [teacherId]);

  const startEdit = (review: Review) => {
    setEditingId(review.id);
    setEditComment(review.comment);
    setEditRating(review.rating);
  };

  const saveEdit = async (id: string) => {
    try {
      const reviewRef = doc(db, "reviews", id);
      await updateDoc(reviewRef, {
        comment: editComment,
        rating: editRating,
      });
      setReviews((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, comment: editComment, rating: editRating } : r
        )
      );
      setEditingId(null);
    } catch (err) {
      alert("更新に失敗しました");
    }
  };

  const deleteReview = async (id: string) => {
    if (!window.confirm("このレビューを削除してもよろしいですか？")) return;

    try {
      await deleteDoc(doc(db, "reviews", id));
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert("削除に失敗しました。もう一度お試しください。");
    }
  };

  const handleReplySubmit = async (id: string) => {
    try {
      const reviewRef = doc(db, "reviews", id);
      await updateDoc(reviewRef, {
        reply: replyText,
      });
      setReviews((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, reply: replyText } : r
        )
      );
      setReplyingId(null);
      setReplyText("");
    } catch (err) {
      alert("返信の送信に失敗しました。");
    }
  };

  if (loading) return <p>読み込み中...</p>;

  return (
    <div className="review-list">
      <h4>レビュー一覧</h4>
      {reviews.length === 0 ? (
        <p>まだレビューはありません。</p>
      ) : (
        <ul>
          {reviews.map((r) => (
            <li key={r.id}>
              {editingId === r.id ? (
                <>
                  <select
                    value={editRating}
                    onChange={(e) => setEditRating(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5].map((num) => (
                      <option key={num} value={num}>
                        ★ {num}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={editComment}
                    onChange={(e) => setEditComment(e.target.value)}
                  />
                  <button onClick={() => saveEdit(r.id)}>保存</button>
                  <button onClick={() => setEditingId(null)}>キャンセル</button>
                </>
              ) : (
                <>
                  <strong>
                    評価: {"★".repeat(r.rating)}
                    {"☆".repeat(5 - r.rating)}
                  </strong>
                  <p>{r.comment}</p>
                  <small>
                    投稿日:{" "}
                    {new Date(r.createdAt.seconds * 1000).toLocaleDateString()}
                  </small>
                  {r.reply && (
                    <div
                      className="reply-box"
                      style={{
                        marginTop: "8px",
                        paddingLeft: "12px",
                        borderLeft: "3px solid #ccc",
                      }}
                    >
                      <strong>先生からの返信:</strong>
                      <p>{r.reply}</p>
                    </div>
                  )}
                  <br />
                  <button onClick={() => startEdit(r)}>編集</button>
                  <button
                    onClick={() => deleteReview(r.id)}
                    className="delete-button"
                  >
                    削除
                  </button>
                  {!r.reply && (
                    <button onClick={() => setReplyingId(r.id)}>返信する</button>
                  )}
                  {replyingId === r.id && (
                    <div style={{ marginTop: "8px" }}>
                      <textarea
                        placeholder="返信内容を入力してください"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        style={{ width: "100%", minHeight: "60px" }}
                      />
                      <br />
                      <button onClick={() => handleReplySubmit(r.id)}>送信</button>
                      <button
                        onClick={() => {
                          setReplyingId(null);
                          setReplyText("");
                        }}
                      >
                        キャンセル
                      </button>
                    </div>
                  )}
                  <hr />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
