// src/pages/Register.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

type Gender = "" | "male" | "female" | "other";

const Register: React.FC = () => {
  const navigate = useNavigate();

  // 基本
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // 拡張項目
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastNameKana, setLastNameKana] = useState("");
  const [firstNameKana, setFirstNameKana] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<Gender>("");
  const [birthY, setBirthY] = useState("");
  const [birthM, setBirthM] = useState("");
  const [birthD, setBirthD] = useState("");

  // 規約同意
  const [agree, setAgree] = useState(false);

  // 状態
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // 郵便番号検索のローディング
  const [isSearchingZip, setIsSearchingZip] = useState(false);

  const prefectures = [
    "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
    "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県",
    "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
    "鳥取県","島根県","岡山県","広島県","山口県",
    "徳島県","香川県","愛媛県","高知県",
    "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県"
  ];

  // 1940年〜今年
  const years = useMemo(() => {
    const arr: string[] = [];
    const thisYear = new Date().getFullYear();
    for (let y = 1940; y <= thisYear; y++) arr.push(String(y));
    return arr;
  }, []);
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const days   = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

  // 郵便番号 → 住所自動入力
  const handlePostalBlur = async () => {
    if (postalCode.length !== 7) return;
    try {
      setIsSearchingZip(true);
      const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postalCode}`);
      const data: any = await res.json();
      if (data?.results?.length) {
        const r = data.results[0];
        setPrefecture(r.address1 || "");
        setAddress1(`${r.address2 || ""}${r.address3 || ""}`);
      } else {
        console.warn("郵便番号から住所が見つかりませんでした");
      }
    } catch (e) {
      console.error("郵便番号検索に失敗しました", e);
    } finally {
      setIsSearchingZip(false);
    }
  };

  // 送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 必須チェック
    if (!lastName || !firstName || !lastNameKana || !firstNameKana ||
        !prefecture || !address1 || !phone || !gender ||
        !birthY || !birthM || !birthD || !email) {
      setError("必須項目（*）を入力してください。");
      return;
    }
    if (password !== confirm) {
      setError("パスワードが一致しません。");
      return;
    }
    if (password.length < 8) {
      setError("パスワードは8文字以上にしてください。");
      return;
    }
    if (!agree) {
      setError("利用規約への同意が必要です。");
      return;
    }

    try {
      setSubmitting(true);

      // 1) Auth で作成
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // 2) 表示名（姓+名）
      const displayName = `${lastName}${firstName}`.trim();
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }

      // 3) Firestore にプロフィール保存
      const userRef = doc(db, "users", cred.user.uid);
      await setDoc(
        userRef,
        {
          uid: cred.user.uid,
          role: "student",
          email,
          displayName: displayName || null,
          lastName, firstName,
          lastNameKana, firstNameKana,
          postalCode: postalCode || null,
          prefecture: prefecture || null,
          address1: address1 || null,
          address2: address2 || null,
          phone: phone || null,
          gender: gender || null,
          birthday: (birthY && birthM && birthD) ? { year: birthY, month: birthM, day: birthD } : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          emailVerified: false, // 便宜上保持（実際の真偽は auth 側の値が正）
        },
        { merge: true }
      );

      // 4) メール確認リンクを送信（ユーザーにメール内のリンクを踏んでもらう）
      //    リンクを踏んだ後に戻したい先（例：/login）を設定
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      };
      await sendEmailVerification(cred.user, actionCodeSettings);

      // 5) 完了表示（自動遷移はせず、メール確認を促す）
      setDone(true);
      setError(null);
    } catch (err: any) {
      console.error(err);
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        setError("このメールアドレスは既に登録されています。");
      } else if (code === "auth/invalid-email") {
        setError("メールアドレスの形式が正しくありません。");
      } else if (code === "auth/weak-password") {
        setError("パスワードが弱すぎます。（8文字以上、英数字を含めてください）");
      } else if (code === "auth/too-many-requests") {
        setError("リクエストが多すぎます。しばらく待ってから再度お試しください。");
      } else {
        setError("登録に失敗しました。入力内容をご確認のうえ再度お試しください。");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="register-container register-page">
      <div className="register-box">
        <h2>新規会員登録</h2>
        <p className="required-note"><span className="req">*</span>は入力必須項目です。</p>

        <form onSubmit={handleSubmit} className="register-form form-grid">
          {/* お名前 */}
          <label>お名前<span className="req">*</span></label>
          <div className="split-2">
            <input placeholder="姓" value={lastName} onChange={e=>setLastName(e.target.value)} required />
            <input placeholder="名" value={firstName} onChange={e=>setFirstName(e.target.value)} required />
          </div>

          {/* フリガナ */}
          <label>フリガナ<span className="req">*</span></label>
          <div className="split-2">
            <input placeholder="セイ" value={lastNameKana} onChange={e=>setLastNameKana(e.target.value)} required />
            <input placeholder="メイ" value={firstNameKana} onChange={e=>setFirstNameKana(e.target.value)} required />
          </div>

          {/* 郵便番号（1/2幅・〒付き） */}
          <label>郵便番号</label>
          <div className="postal-row">
            <div className="mark">〒</div>
            <input
              placeholder="例）1500031"
              value={postalCode}
              onChange={e=>setPostalCode(e.target.value.replace(/[^0-9]/g,""))}
              onBlur={handlePostalBlur}
              inputMode="numeric"
            />
          </div>
          {isSearchingZip && (
            <>
              <label></label>
              <div style={{ fontSize: "12px", color: "#777" }}>郵便番号から住所を取得しています…</div>
            </>
          )}

          {/* 都道府県 */}
          <label>都道府県<span className="req">*</span></label>
          <select value={prefecture} onChange={e=>setPrefecture(e.target.value)} required>
            <option value="">選択してください</option>
            {prefectures.map(p => <option key={p} value={p}>{p}</option>)}
          </select>

          {/* 住所1 */}
          <label>住所1（市部区／町・村）<span className="req">*</span></label>
          <input
            placeholder="例）〇〇市△△区□町"
            value={address1}
            onChange={e=>setAddress1(e.target.value)}
            required
          />

          {/* 住所2 */}
          <label className="nowrap">住所2（丁目・番地・マンション名・号室）</label>
          <input
            placeholder="例）△△ 1-4 ○○マンション101号"
            value={address2}
            onChange={e=>setAddress2(e.target.value)}
          />

          {/* 電話番号 */}
          <label>電話番号<span className="req">*</span></label>
          <input
            placeholder="例）00000000000"
            value={phone}
            onChange={e=>setPhone(e.target.value.replace(/[^0-9]/g,""))}
            inputMode="numeric"
            required
          />

          {/* メール */}
          <label>メールアドレス<span className="req">*</span></label>
          <input
            type="email"
            placeholder="例）○○○@example.com"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            required
          />

          {/* 性別 */}
          <label>性別<span className="req">*</span></label>
          <select value={gender} onChange={e=>setGender(e.target.value as Gender)} required>
            <option value="">選択してください</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
            <option value="other">その他</option>
          </select>

          {/* 生年月日 */}
          <label>生年月日<span className="req">*</span></label>
          <div className="split-3">
            <select value={birthY} onChange={e=>setBirthY(e.target.value)} required>
              <option value="">----</option>
              {years.map(y => <option key={y} value={y}>{y} 年</option>)}
            </select>
            <select value={birthM} onChange={e=>setBirthM(e.target.value)} required>
              <option value="">--</option>
              {months.map(m => <option key={m} value={m}>{m} 月</option>)}
            </select>
            <select value={birthD} onChange={e=>setBirthD(e.target.value)} required>
              <option value="">--</option>
              {days.map(d => <option key={d} value={d}>{d} 日</option>)}
            </select>
          </div>

          {/* パスワード */}
          <label>パスワード<span className="req">*</span></label>
          <input
            type="password"
            placeholder="半角英数字8文字以上"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            required
          />

          {/* 確認 */}
          <label>確認用パスワード<span className="req">*</span></label>
          <input
            type="password"
            value={confirm}
            onChange={e=>setConfirm(e.target.value)}
            required
          />

          {/* 規約同意（2カラム跨ぎ） */}
          <div className="row-2">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={agree}
                onChange={e=>setAgree(e.target.checked)}
              />
              <span>
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="login-link">
                  利用規約
                </a>
                に同意して申込みます。未成年者については法定代理人の同意を得ていることを確認します。
              </span>
            </label>
          </div>

          {/* ボタン（2カラム跨ぎ） */}
          <div className="row-2">
            <button
              type="submit"
              className="register-button"
              disabled={!agree || submitting}
              aria-disabled={!agree || submitting}
            >
              <span className="btn-text">{submitting ? "登録中…" : "会員登録"}</span>
            </button>

            {error && <p className="error-message" role="alert">{error}</p>}
            {done && (
              <p className="success-message">
                会員仮登録が完了しました。<br />
                <strong>確認メールを送信しました。</strong> メール内のリンクを開いて本登録を完了してください。<br />
                本登録完了後は <a href="/login" className="login-link">ログイン</a> できます。
              </p>
            )}

            <div className="already-account" style={{ marginTop: 12 }}>
              すでにアカウントをお持ちの方は{" "}
              <a href="/login" className="login-link">こちら</a>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
