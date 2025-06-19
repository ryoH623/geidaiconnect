// src/components/ReviewForm.tsx
import { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

interface Props {
  teacherId: string;
}

export default function ReviewForm({ teacherId }: Props) {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const auth = getAuth();
  const user = auth.currentUser;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating || !comment) return;

    try {
      await addDoc(collection(db, "reviews"), {
        teacherId,
        rating,
        comment,
        createdAt: Timestamp.now(),
        userId: user?.uid ?? null,
      });
      setSuccess(true);
      setRating(0);
      setComment("");
    } catch (err) {
      alert("エラーが発生しました。再度お試しください。");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="review-form">
      <h4>レビューを投稿</h4>

      <label>評価（1〜5）:</label>
      <select value={rating} onChange={(e) => setRating(Number(e.target.value))} required>
        <option value="">選択してください</option>
        {[1, 2, 3, 4, 5].map((num) => (
          <option key={num} value={num}>
            ★ {num}
          </option>
        ))}
      </select>

      <label>コメント:</label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        required
        placeholder="コメントを入力してください"
      />

      <button type="submit">投稿</button>

      {success && <p style={{ color: "green" }}>レビューを投稿しました！</p>}
    </form>
  );
}
