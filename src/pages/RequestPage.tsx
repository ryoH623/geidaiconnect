// src/pages/RequestPage.tsx
// 演奏・展示などの依頼フォーム。callable（submitRequest）経由で Firestore 保存＋運営宛メール送信。
// 一般のお問い合わせ（Contact.tsx）とは分離し、依頼に必要な項目を構造化して受け付ける。
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import "../index.css";

const REQUEST_TYPES = [
  "演奏の依頼",
  "展示・制作の依頼",
  "レッスン・講演の依頼",
  "その他",
] as const;

// 必須項目に付ける赤いマーク
const requiredMark = <span className="required-label">必須</span>;

const RequestPage: React.FC = () => {
  const [requestType, setRequestType] = useState("");
  const [name, setName] = useState("");
  const [furigana, setFurigana] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [budget, setBudget] = useState("");
  const [genre, setGenre] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      setSending(true);
      const callable = httpsCallable<
        {
          requestType: string;
          name: string;
          furigana: string;
          email: string;
          phone: string;
          organization?: string;
          eventDate?: string;
          venue?: string;
          budget?: string;
          genre?: string;
          message: string;
        },
        { ok: boolean; message: string }
      >(functions, "submitRequest");

      await callable({
        requestType,
        name,
        furigana,
        email,
        phone,
        organization: organization || undefined,
        eventDate: eventDate || undefined,
        venue: venue || undefined,
        budget: budget || undefined,
        genre: genre || undefined,
        message,
      });

      setSent(true);
    } catch (err: any) {
      console.error("依頼送信エラー:", err);
      setError(
        err?.message || "送信に失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="main-content contact-main">
      <section className="about-section enhanced fade-in-up">
        <h2 className="section-title">演奏・展示などのご依頼</h2>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ textAlign: "left", maxWidth: "600px", width: "100%" }}>
            {sent ? (
              <div style={{ textAlign: "center", margin: "2rem 0" }}>
                <p>ご依頼を受け付けました。</p>
                <p>
                  内容を確認のうえ、担当者よりご入力いただいたメールアドレス宛に
                  ご連絡いたします。
                </p>
              </div>
            ) : (
              <>
                <p style={{ marginBottom: "1.5rem" }}>
                  結婚式・イベントでの演奏、作品の展示・制作、講演など、
                  東京藝術大学出身のアーティストへのご依頼を受け付けています。
                  ご希望の内容が未確定でも、分かる範囲でご記入ください。
                </p>

                <form onSubmit={handleSubmit}>
                  <div className="form-group" style={{ marginBottom: "1rem" }}>
                    <label htmlFor="request-type">依頼の種類{requiredMark}</label>
                    <select
                      id="request-type"
                      value={requestType}
                      onChange={(e) => setRequestType(e.target.value)}
                      required
                      style={{ width: "100%" }}
                      className="form-control"
                    >
                      <option value="">選択してください</option>
                      {REQUEST_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: "1rem" }}>
                    <label htmlFor="request-name">お名前{requiredMark}</label>
                    <input
                      id="request-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      maxLength={100}
                      placeholder="例：藝大 花子"
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: "1rem" }}>
                    <label htmlFor="request-furigana">ふりがな{requiredMark}</label>
                    <input
                      id="request-furigana"
                      type="text"
                      value={furigana}
                      onChange={(e) => setFurigana(e.target.value)}
                      required
                      maxLength={100}
                      placeholder="例：げいだい はなこ"
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: "1rem" }}>
                    <label htmlFor="request-email">メールアドレス{requiredMark}</label>
                    <input
                      id="request-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      maxLength={200}
                      placeholder="例：hanako@example.com"
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: "1rem" }}>
                    <label htmlFor="request-phone">電話番号{requiredMark}</label>
                    <input
                      id="request-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      maxLength={30}
                      placeholder="例：09012345678"
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: "1rem" }}>
                    <label htmlFor="request-organization">
                      会社・団体名（任意）
                    </label>
                    <input
                      id="request-organization"
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      maxLength={200}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: "1rem" }}>
                    <label htmlFor="request-date">
                      希望日・時期（任意 / 例: 2026年10月中旬、未定）
                    </label>
                    <input
                      id="request-date"
                      type="text"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      maxLength={100}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: "1rem" }}>
                    <label htmlFor="request-venue">
                      開催場所（任意 / 例: 東京都内のホテル、オンライン）
                    </label>
                    <input
                      id="request-venue"
                      type="text"
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      maxLength={300}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: "1rem" }}>
                    <label htmlFor="request-budget">
                      ご予算（任意 / 例: 5〜10万円、応相談）
                    </label>
                    <input
                      id="request-budget"
                      type="text"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      maxLength={100}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: "1rem" }}>
                    <label htmlFor="request-genre">
                      希望ジャンル・楽器（任意 / 例: 弦楽四重奏、油絵）
                    </label>
                    <input
                      id="request-genre"
                      type="text"
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      maxLength={200}
                      style={{ width: "100%" }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: "1rem" }}>
                    <label htmlFor="request-message">依頼内容{requiredMark}</label>
                    <textarea
                      id="request-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                      maxLength={5000}
                      rows={8}
                      style={{ width: "100%" }}
                      placeholder="用途（結婚式・イベント・法人行事など）、規模・人数、その他のご希望をご記入ください。"
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
                    {sending ? "送信中..." : "依頼を送信する"}
                  </button>
                </form>
              </>
            )}

            <hr style={{ margin: "2rem 0" }} />

            <p>
              一般的なご質問は
              <Link to="/contact">お問い合わせフォーム</Link>
              をご利用ください。
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default RequestPage;
