// src/pages/Withdraw.tsx
// 退会ページ。退会で何が起きるかを示し、パスワードで再認証してから
// deleteMyAccount（Cloud Functions）を呼ぶ。後始末（クーポン・レビュー・予約の
// 個人情報・講師の公開状態）はすべてサーバー側で行う。
//
// 退会が終わるとログアウト状態になるため、このページは ProtectedRoute で包まず、
// 未ログインかつ未完了のときだけログイン画面へ送る。
import React, { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
} from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

type Blocker = {
  reservationId: string;
  lessonDate: string;
  lessonTime: string;
  as: "student" | "teacher";
  counterpart: string;
  reason: "upcoming" | "pending" | "unsettled";
};

type CheckResult = {
  ok: boolean;
  canDelete: boolean;
  message: string;
  blockers: Blocker[];
};

const BLOCKER_REASON_LABEL: Record<Blocker["reason"], string> = {
  upcoming: "今後のレッスン",
  pending: "決済手続き中",
  unsettled: "お支払い未確定",
};

function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "パスワードが正しくありません。";
    case "auth/too-many-requests":
      return "試行回数が多すぎます。しばらく時間をおいてお試しください。";
    default:
      return "";
  }
}

const Withdraw: React.FC = () => {
  const { user, role } = useAuth();

  const [checking, setChecking] = useState(true);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [checkError, setCheckError] = useState("");

  const [agreed, setAgreed] = useState(false);
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user || done) return;
    let cancelled = false;
    (async () => {
      try {
        setChecking(true);
        const callable = httpsCallable<unknown, CheckResult>(
          functions,
          "checkMyAccountDeletion"
        );
        const res = await callable({});
        if (!cancelled) setCheck(res.data);
      } catch (err) {
        console.error("[withdraw] 退会可否の確認に失敗:", err);
        if (!cancelled) {
          setCheckError("退会できるかの確認に失敗しました。時間をおいて再度お試しください。");
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, done]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      setError("ログイン状態を確認できませんでした。ログインし直してください。");
      return;
    }
    if (!agreed) {
      setError("退会後の取り扱いをご確認のうえ、チェックを入れてください。");
      return;
    }

    try {
      setWorking(true);

      // サーバー側で「直近にログインしたか」を確認するため、先に再認証する
      try {
        await reauthenticateWithCredential(
          currentUser,
          EmailAuthProvider.credential(currentUser.email, password)
        );
      } catch (authErr: any) {
        setError(
          authErrorMessage(authErr?.code) ||
            "本人確認に失敗しました。時間をおいて再度お試しください。"
        );
        return;
      }
      // 再認証で auth_time が新しくなった ID トークンを使わせる
      await currentUser.getIdToken(true);

      const callable = httpsCallable<unknown, { ok: boolean }>(
        functions,
        "deleteMyAccount"
      );
      await callable({});

      setDone(true);
      setPassword("");
      // Auth のアカウントはサーバーで削除済み。手元のログイン状態も消す
      await signOut(auth).catch(() => undefined);
    } catch (err: any) {
      console.error("[withdraw] 退会に失敗:", err);
      const blockers = err?.details?.blockers;
      if (Array.isArray(blockers) && blockers.length > 0) {
        setCheck({
          ok: true,
          canDelete: false,
          message: String(err?.message || ""),
          blockers,
        });
      }
      setError(
        typeof err?.message === "string" && err.message
          ? err.message
          : "退会処理に失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setWorking(false);
    }
  };

  if (done) {
    return (
      <main className="about-section fade-in-up">
        <h2 className="centered-heading-with-border">
          <span>退会手続きが完了しました</span>
        </h2>
        <div style={{ maxWidth: "640px", margin: "2rem auto", lineHeight: 1.9 }}>
          <p>
            Geidai Connect をご利用いただき、ありがとうございました。
            登録されていたメールアドレス宛に、退会完了のお知らせをお送りしました。
          </p>
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <Link to="/" className="form-button">
              トップページへ
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: "/mypage/withdraw" }} />;
  }

  const isTeacher = role === "teacher";
  const reservationsLink = isTeacher ? "/teacher/reservations" : "/history";

  return (
    <main className="about-section fade-in-up">
      <h2 className="centered-heading-with-border">
        <span>退会</span>
      </h2>

      <div style={{ maxWidth: "640px", margin: "2rem auto", lineHeight: 1.9 }}>
        <h3>退会すると</h3>
        <ul style={{ paddingLeft: "1.2em" }}>
          <li>ログインできなくなり、会員情報（氏名・住所・電話番号など）は削除されます。</li>
          <li>お持ちのクーポンは無効になります。再登録しても元には戻りません。</li>
          <li>あなたの紹介コードは使えなくなります。</li>
          <li>投稿したレビューは、投稿者が分からない形で掲載を続けます。</li>
          <li>
            ご予約の記録（日時・金額・お名前など）は、法令に基づく保存期間のあいだ運営が保管します。
          </li>
          {isTeacher && (
            <li>講師プロフィールは非公開になり、予約の入っていない空き枠は削除されます。</li>
          )}
        </ul>

        {checking ? (
          <p style={{ textAlign: "center" }}>確認中...</p>
        ) : checkError ? (
          <p className="error-message" role="alert">{checkError}</p>
        ) : check && !check.canDelete ? (
          <section
            style={{
              marginTop: "1.5rem",
              padding: "1rem 1.25rem",
              border: "1px solid #e0c4c4",
              borderRadius: "8px",
              background: "#fdf6f6",
            }}
          >
            <p style={{ margin: 0 }}>{check.message}</p>
            {check.blockers.length > 0 && (
              <ul style={{ paddingLeft: "1.2em", marginBottom: 0 }}>
                {check.blockers.map((b) => (
                  <li key={b.reservationId}>
                    {b.lessonDate} {b.lessonTime}
                    {b.counterpart ? `　${b.counterpart}` : ""}
                    {b.counterpart ? (b.as === "student" ? " 先生" : " 様") : ""}
                    （{BLOCKER_REASON_LABEL[b.reason]}）
                  </li>
                ))}
              </ul>
            )}
            {check.blockers.some((b) => b.reason === "upcoming") && (
              <p style={{ marginBottom: 0 }}>
                <Link to={reservationsLink}>予約の確認・キャンセルはこちら</Link>
              </p>
            )}
          </section>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="register-form form-grid"
            style={{ marginTop: "1.5rem" }}
          >
            <label style={{ display: "flex", gap: "0.5em", alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ marginTop: "0.45em" }}
              />
              <span>上記の内容を確認し、退会します。</span>
            </label>

            <label>確認のため、パスワードを入力してください</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />

            <div className="row-2">
              <button
                type="submit"
                className="register-button"
                disabled={working || !agreed || !password}
                aria-disabled={working || !agreed || !password}
                style={{ background: "#b23b3b", borderColor: "#b23b3b" }}
              >
                <span className="btn-text">{working ? "処理中…" : "退会する"}</span>
              </button>
              {error && <p className="error-message" role="alert">{error}</p>}
            </div>
          </form>
        )}

        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <Link to="/mypage" className="form-button">
            マイページへ戻る
          </Link>
        </div>
      </div>
    </main>
  );
};

export default Withdraw;
