// src/pages/ReviewSubmissionPage.tsx
import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { db, auth } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function ReviewSubmissionPage() {
  const [searchParams] = useSearchParams();
  const teacherId = searchParams.get("teacher");
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) {
      alert("ログインしてからレビューを投稿してください。");
      return;
    }

    try {
      await addDoc(collection(db, "reviews"), {
        teacherId,
        userId: user.uid,
        rating: Number(rating),
        comment,
        // 表示側（ReviewList）が createdAt を参照するため、フィールド名を統一する
        createdAt: serverTimestamp(),
      });
      alert("レビューを送信しました！");
      setRating("");
      setComment("");
    } catch (error) {
      console.error("レビュー保存エラー:", error);
      alert("レビューの送信に失敗しました。");
    }
  };

  return (
    <div
      className="review-form-container"
      style={{
        marginTop: "10rem",
        padding: "2rem",
        maxWidth: "600px",
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      <h2>レビューを投稿</h2>
      {teacherId ? (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label>評価（1〜5）</label><br />
            <select
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              required
            >
              <option value="">選択してください</option>
              {[1, 2, 3, 4, 5].map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label>コメント</label><br />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
              rows={5}
              style={{ width: "100%" }}
              placeholder="講師の対応やレッスンの感想などをご記入ください"
            />
          </div>

          <button type="submit">投稿</button>
        </form>
      ) : (
        <p>講師IDが指定されていません。</p>
      )}
    </div>
  );
}
