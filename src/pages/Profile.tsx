// src/pages/Profile.tsx
// 会員情報の閲覧・編集ページ。users/{uid} の内容を表示し、その場で更新できる。
// メールアドレス（Auth）と role は変更不可。
import React, { useEffect, useMemo, useState } from "react";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { prefectures } from "../data/prefectures";

type Gender = "" | "male" | "female" | "other";

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

  // 状態
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSearchingZip, setIsSearchingZip] = useState(false);

  const years = useMemo(() => {
    const arr: string[] = [];
    const thisYear = new Date().getFullYear();
    for (let y = 1940; y <= thisYear; y++) arr.push(String(y));
    return arr;
  }, []);
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));

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
      </div>
    </div>
  );
};

export default Profile;
