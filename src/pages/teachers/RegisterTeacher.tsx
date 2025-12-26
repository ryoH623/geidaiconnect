import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";

const RegisterTeacher = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Firebase Authentication にユーザーを作成
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Firestore に「users/{uid}」として講師データを登録
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: displayName,
        role: "teacher", // 🔑 講師として登録
        createdAt: serverTimestamp(),
      });

      alert("講師としての登録が完了しました！");
    } catch (error: any) {
      console.error("登録エラー:", error);
      alert(`登録に失敗しました: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleRegister} style={{ maxWidth: 400, margin: "auto" }}>
      <h2>講師 新規登録</h2>
      <label>名前</label>
      <input
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        required
      />
      <label>メールアドレス</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <label>パスワード</label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? "登録中…" : "登録する"}
      </button>
    </form>
  );
};

export default RegisterTeacher;
