// src/pages/Profile.tsx
// 会員情報の閲覧・編集ページ。users/{uid} の内容を表示し、その場で更新できる。
// パスワード変更・メールアドレス変更（再認証つき）にも対応。role は変更不可。
import React, { useEffect, useMemo, useState } from "react";
import {
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { prefectures } from "../data/prefectures";
import { ADULT_AGE, calcAge, isValidBirthday } from "../lib/age";

type Gender = "" | "male" | "female" | "other";

/** 保護者（法定代理人）の続柄の選択肢。登録画面と揃える */
const GUARDIAN_RELATIONSHIPS = ["父", "母", "祖父", "祖母", "その他の親権者・後見人"];

// Firebase Auth のエラーコードを日本語メッセージに変換する
function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "現在のパスワードが正しくありません。";
    case "auth/weak-password":
      return "新しいパスワードが弱すぎます。6文字以上で設定してください。";
    case "auth/too-many-requests":
      return "試行回数が多すぎます。しばらく時間をおいてお試しください。";
    case "auth/requires-recent-login":
      return "セキュリティのため再ログインが必要です。一度ログアウトし、ログインし直してからお試しください。";
    case "auth/email-already-in-use":
      return "このメールアドレスは既に使用されています。";
    case "auth/invalid-email":
      return "メールアドレスの形式が正しくありません。";
    default:
      return "処理に失敗しました。時間をおいて再度お試しください。";
  }
}

const Profile: React.FC = () => {
  const { user } = useAuth();

  // 基本情報
  const [email, setEmail] = useState("");
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

  // 保護者（法定代理人）情報。18歳未満のときだけ必須になる。
  const [guardianName, setGuardianName] = useState("");
  const [guardianNameKana, setGuardianNameKana] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");

  // 状態
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSearchingZip, setIsSearchingZip] = useState(false);

  // パスワード変更
  const [currentPwForPassword, setCurrentPwForPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  // メールアドレス変更
  const [currentPwForEmail, setCurrentPwForEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailVerifySent, setEmailVerifySent] = useState(false);

  const years = useMemo(() => {
    const arr: string[] = [];
    const thisYear = new Date().getFullYear();
    for (let y = 1940; y <= thisYear; y++) arr.push(String(y));
    return arr;
  }, []);
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

  // 入力中の生年月日から算出。未成年なら保護者欄を表示・必須化する。
  const age = useMemo(
    () => calcAge({ year: birthY, month: birthM, day: birthD }),
    [birthY, birthM, birthD]
  );
  const minor = age !== null && age < ADULT_AGE;

  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        const snap = await getDoc(doc(db, "users", user.uid));

        if (!snap.exists()) {
          setLoadError("会員情報が見つかりませんでした。");
          return;
        }

        const d = snap.data();
        setEmail(typeof d.email === "string" ? d.email : user.email || "");
        setLastName(typeof d.lastName === "string" ? d.lastName : "");
        setFirstName(typeof d.firstName === "string" ? d.firstName : "");
        setLastNameKana(typeof d.lastNameKana === "string" ? d.lastNameKana : "");
        setFirstNameKana(typeof d.firstNameKana === "string" ? d.firstNameKana : "");
        setPostalCode(typeof d.postalCode === "string" ? d.postalCode : "");
        setPrefecture(typeof d.prefecture === "string" ? d.prefecture : "");
        setAddress1(typeof d.address1 === "string" ? d.address1 : "");
        setAddress2(typeof d.address2 === "string" ? d.address2 : "");
        setPhone(typeof d.phone === "string" ? d.phone : "");
        setGender((d.gender as Gender) || "");
        setBirthY(d.birthday?.year ?? "");
        setBirthM(d.birthday?.month ?? "");
        setBirthD(d.birthday?.day ?? "");
        setGuardianName(d.guardian?.name ?? "");
        setGuardianNameKana(d.guardian?.nameKana ?? "");
        setGuardianRelationship(d.guardian?.relationship ?? "");
        setGuardianPhone(d.guardian?.phone ?? "");
      } catch (err) {
        console.error("会員情報の取得に失敗しました:", err);
        setLoadError("会員情報の取得に失敗しました。時間をおいて再度お試しください。");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaved(false);

    if (!user) return;

    if (
      !lastName || !firstName || !lastNameKana || !firstNameKana ||
      !prefecture || !address1 || !phone || !gender ||
      !birthY || !birthM || !birthD
    ) {
      setSaveError("必須項目（*）を入力してください。");
      return;
    }

    if (!isValidBirthday(birthY, birthM, birthD)) {
      setSaveError("生年月日が正しくありません。実在する日付をお選びください。");
      return;
    }

    if (minor) {
      if (!guardianName.trim() || !guardianNameKana.trim() || !guardianRelationship) {
        setSaveError("18歳未満の方は、保護者のお名前・フリガナ・続柄をご入力ください。");
        return;
      }
      if (!/^[ぁ-んー\s　]+$/.test(guardianNameKana.trim())) {
        setSaveError("保護者のフリガナはひらがなでご入力ください。");
        return;
      }
      if (!/^\d{10,11}$/.test(guardianPhone.replace(/[-\s　]/g, ""))) {
        setSaveError("保護者の電話番号は10〜11桁の数字でご入力ください。");
        return;
      }
    }

    try {
      setSaving(true);

      const displayName = `${lastName}${firstName}`.trim();

      // role / email / uid / createdAt は書き換えない
      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: displayName || null,
          lastName,
          firstName,
          lastNameKana,
          firstNameKana,
          postalCode: postalCode || null,
          prefecture: prefecture || null,
          address1: address1 || null,
          address2: address2 || null,
          phone: phone || null,
          gender: gender || null,
          birthday: { year: birthY, month: birthM, day: birthD },
          // 成人済みになったら保護者情報は保持しない
          guardian: minor
            ? {
                name: guardianName.trim(),
                nameKana: guardianNameKana.trim(),
                relationship: guardianRelationship,
                phone: guardianPhone.replace(/[-\s　]/g, ""),
                consentedAt: serverTimestamp(),
              }
            : null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (auth.currentUser && displayName) {
        await updateProfile(auth.currentUser, { displayName });
      }

      setSaved(true);
    } catch (err) {
      console.error("会員情報の更新に失敗しました:", err);
      setSaveError("会員情報の更新に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSaved(false);

    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      setPwError("ログイン状態を確認できませんでした。ログインし直してください。");
      return;
    }

    if (newPassword.length < 6) {
      setPwError("新しいパスワードは6文字以上で入力してください。");
      return;
    }

    if (newPassword !== newPassword2) {
      setPwError("新しいパスワード（確認）が一致しません。");
      return;
    }

    try {
      setPwSaving(true);

      // セキュリティ操作のため、現在のパスワードで再認証してから変更する
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPwForPassword
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);

      setPwSaved(true);
      setCurrentPwForPassword("");
      setNewPassword("");
      setNewPassword2("");
    } catch (err: any) {
      console.error("パスワード変更に失敗しました:", err);
      setPwError(authErrorMessage(err?.code));
    } finally {
      setPwSaving(false);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailVerifySent(false);

    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      setEmailError("ログイン状態を確認できませんでした。ログインし直してください。");
      return;
    }

    if (!newEmail || newEmail === currentUser.email) {
      setEmailError("現在と異なる新しいメールアドレスを入力してください。");
      return;
    }

    try {
      setEmailSaving(true);

      const credential = EmailAuthProvider.credential(
        currentUser.email,
        currentPwForEmail
      );
      await reauthenticateWithCredential(currentUser, credential);

      // 新アドレス宛の確認メールのリンクをクリックした時点で変更が適用される
      await verifyBeforeUpdateEmail(currentUser, newEmail, {
        url: `${window.location.origin}/login`,
      });

      setEmailVerifySent(true);
      setCurrentPwForEmail("");
      setNewEmail("");
    } catch (err: any) {
      console.error("メールアドレス変更に失敗しました:", err);
      setEmailError(authErrorMessage(err?.code));
    } finally {
      setEmailSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="register-container register-page">
        <div className="register-box">
          <h2>会員情報</h2>
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="register-container register-page">
        <div className="register-box">
          <h2>会員情報</h2>
          <p className="error-message" role="alert">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="register-container register-page">
      <div className="register-box">
        <h2>会員情報</h2>
        <p className="required-note"><span className="req">*</span>は入力必須項目です。</p>

        <form onSubmit={handleSubmit} className="register-form form-grid">
          <label>メールアドレス</label>
          <input type="email" value={email} disabled />

          <label>お名前<span className="req">*</span></label>
          <div className="split-2">
            <input placeholder="姓" value={lastName} onChange={e => setLastName(e.target.value)} required />
            <input placeholder="名" value={firstName} onChange={e => setFirstName(e.target.value)} required />
          </div>

          <label>フリガナ<span className="req">*</span></label>
          <div className="split-2">
            <input placeholder="セイ" value={lastNameKana} onChange={e => setLastNameKana(e.target.value)} required />
            <input placeholder="メイ" value={firstNameKana} onChange={e => setFirstNameKana(e.target.value)} required />
          </div>

          <label>郵便番号</label>
          <div className="postal-row">
            <div className="mark">〒</div>
            <input
              placeholder="例）1500031"
              value={postalCode}
              onChange={e => setPostalCode(e.target.value.replace(/[^0-9]/g, ""))}
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

          <label>都道府県<span className="req">*</span></label>
          <select value={prefecture} onChange={e => setPrefecture(e.target.value)} required>
            <option value="">選択してください</option>
            {prefectures.map((p) => (
              <option key={p.code} value={p.name}>{p.name}</option>
            ))}
          </select>

          <label>住所1（市部区／町・村）<span className="req">*</span></label>
          <input
            placeholder="例）〇〇市△△区□町"
            value={address1}
            onChange={e => setAddress1(e.target.value)}
            required
          />

          <label className="nowrap">住所2（丁目・番地・マンション名・号室）</label>
          <input
            placeholder="例）△△ 1-4 ○○マンション101号"
            value={address2}
            onChange={e => setAddress2(e.target.value)}
          />

          <label>電話番号<span className="req">*</span></label>
          <input
            placeholder="例）00000000000"
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            required
          />

          <label>性別<span className="req">*</span></label>
          <select value={gender} onChange={e => setGender(e.target.value as Gender)} required>
            <option value="">選択してください</option>
            <option value="male">男性</option>
            <option value="female">女性</option>
            <option value="other">その他</option>
          </select>

          <label>生年月日<span className="req">*</span></label>
          <div className="split-3">
            <select value={birthY} onChange={e => setBirthY(e.target.value)} required>
              <option value="">----</option>
              {years.map((y) => <option key={y} value={y}>{y} 年</option>)}
            </select>
            <select value={birthM} onChange={e => setBirthM(e.target.value)} required>
              <option value="">--</option>
              {months.map((m) => <option key={m} value={m}>{m} 月</option>)}
            </select>
            <select value={birthD} onChange={e => setBirthD(e.target.value)} required>
              <option value="">--</option>
              {days.map((d) => <option key={d} value={d}>{d} 日</option>)}
            </select>
          </div>

          {/* 18歳未満のときだけ表示。登録画面と同じ項目を保つ */}
          {minor && (
            <>
              {/* .form-grid は2カラムグリッドのため、見出しのみ row-2 で全幅にする */}
              <div
                className="row-2"
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: "0.9rem 1rem",
                  background: "#fafafa",
                }}
              >
                <p style={{ fontWeight: "bold", margin: "0 0 0.25rem" }}>
                  保護者（法定代理人）の情報
                </p>
                <p style={{ fontSize: "0.85rem", color: "#666", margin: 0 }}>
                  18歳未満の方のご利用には、保護者の方の同意が必要です。
                </p>
              </div>

              <label>保護者のお名前<span className="req">*</span></label>
              <input
                type="text"
                placeholder="例：藝大 太郎"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                maxLength={100}
                required
              />

              <label>保護者のフリガナ<span className="req">*</span></label>
              <input
                type="text"
                placeholder="例：げいだい たろう"
                value={guardianNameKana}
                onChange={(e) => setGuardianNameKana(e.target.value)}
                maxLength={100}
                required
              />

              <label>続柄<span className="req">*</span></label>
              <select
                value={guardianRelationship}
                onChange={(e) => setGuardianRelationship(e.target.value)}
                required
              >
                <option value="">選択してください</option>
                {GUARDIAN_RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <label>保護者の電話番号<span className="req">*</span></label>
              <input
                type="tel"
                placeholder="例：09012345678"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                maxLength={20}
                required
              />
            </>
          )}

          <div className="row-2">
            <button
              type="submit"
              className="register-button"
              disabled={saving}
              aria-disabled={saving}
            >
              <span className="btn-text">{saving ? "保存中…" : "変更を保存"}</span>
            </button>

            {saveError && <p className="error-message" role="alert">{saveError}</p>}
            {saved && (
              <p className="success-message">会員情報を更新しました。</p>
            )}
          </div>
        </form>

        <hr style={{ margin: "2rem 0" }} />

        {/* パスワード変更 */}
        <h3>パスワードの変更</h3>
        <form onSubmit={handlePasswordChange} className="register-form form-grid">
          <label>現在のパスワード</label>
          <input
            type="password"
            value={currentPwForPassword}
            onChange={(e) => setCurrentPwForPassword(e.target.value)}
            autoComplete="current-password"
            required
          />

          <label>新しいパスワード</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="6文字以上"
            required
          />

          <label>新しいパスワード（確認）</label>
          <input
            type="password"
            value={newPassword2}
            onChange={(e) => setNewPassword2(e.target.value)}
            autoComplete="new-password"
            required
          />

          <div className="row-2">
            <button
              type="submit"
              className="register-button"
              disabled={pwSaving}
              aria-disabled={pwSaving}
            >
              <span className="btn-text">
                {pwSaving ? "変更中…" : "パスワードを変更"}
              </span>
            </button>

            {pwError && <p className="error-message" role="alert">{pwError}</p>}
            {pwSaved && (
              <p className="success-message">パスワードを変更しました。</p>
            )}
          </div>
        </form>

        <hr style={{ margin: "2rem 0" }} />

        {/* メールアドレス変更 */}
        <h3>メールアドレスの変更</h3>
        <p style={{ fontSize: "13px", color: "#666" }}>
          新しいメールアドレス宛に確認メールが届きます。メール内のリンクをクリックした時点で変更が適用されます。
          変更後は再ログインが必要になる場合があります。
        </p>
        <form onSubmit={handleEmailChange} className="register-form form-grid">
          <label>現在のパスワード</label>
          <input
            type="password"
            value={currentPwForEmail}
            onChange={(e) => setCurrentPwForEmail(e.target.value)}
            autoComplete="current-password"
            required
          />

          <label>新しいメールアドレス</label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />

          <div className="row-2">
            <button
              type="submit"
              className="register-button"
              disabled={emailSaving}
              aria-disabled={emailSaving}
            >
              <span className="btn-text">
                {emailSaving ? "送信中…" : "確認メールを送信"}
              </span>
            </button>

            {emailError && (
              <p className="error-message" role="alert">{emailError}</p>
            )}
            {emailVerifySent && (
              <p className="success-message">
                確認メールを送信しました。メール内のリンクをクリックすると変更が完了します。
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
