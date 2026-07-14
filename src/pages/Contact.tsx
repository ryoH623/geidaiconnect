// src/pages/Contact.tsx
// お問い合わせフォーム。callable（submitContact）経由で Firestore 保存＋運営宛メール送信。
import React, { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import "../index.css";

const Contact: React.FC = () => {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // ログイン中は氏名・メールを初期値として自動入力する
  useEffect(() => {
    if (!user) return;
    setName((prev) => prev || user.displayName || "");
    setEmail((prev) => prev || user.email || "");
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      setSending(true);
      const callable = httpsCallable<
        { name: string; email: string; subject: string; message: string },
        { ok: boolean; message: string }
      >(functions, "submitContact");

      await callable({ name, email, subject, message });

      setSent(true);
    } catch (err: any) {
      console.error("お問い合わせ送信エラー:", err);
      setError(
        err?.message ||
          "送信に失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="main-content contact-main">
      <section className="about-section enhanced fade-in-up">
        <h2 className="section-title">お問い合わせ</h2>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ textAlign: "left", maxWidth: "600px", width: "100%" }}>
            {sent ? (
              <div style={{ textAlign: "center", margin: "2rem 0" }}>
                <p>お問い合わせを受け付けました。</p>
                <p>
                  内容を確認のうえ、担当者よりご入力いただいたメールアドレス宛に
                  ご連絡いたします。
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label htmlFor="contact-name">お名前</label>
                  <input
                    id="contact-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={100}
                    style={{ width: "100%" }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label htmlFor="contact-email">メールアドレス</label>
                  <input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{ width: "100%" }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label htmlFor="contact-subject">件名</label>
                  <input
                    id="contact-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    maxLength={200}
                    style={{ width: "100%" }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label htmlFor="contact-message">お問い合わせ内容</label>
                  <textarea
                    id="contact-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    maxLength={5000}
                    rows={8}
                    style={{ width: "100%" }}
                  />
                </div>

                {error && (
                  <p style={{ color: "#c62828", marginBottom: "1rem" }}>
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  className="form-button"
                  disabled={sending}
                >
                  {sending ? "送信中..." : "送信する"}
                </button>
              </form>
            )}

            <hr style={{ margin: "2rem 0" }} />

            <p className="terms-section-title">メールでのお問い合わせ：</p>
            <p>
              <a href="mailto:info@geidaiconnect.com">
                info@geidaiconnect.com
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Contact;
