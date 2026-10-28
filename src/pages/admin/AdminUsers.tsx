// src/pages/admin/AdminUsers.tsx
// 管理者用: 全ユーザーの一覧と、運営による強制退会（規約違反など）。
// 強制退会は本人の退会と同じ処理（adminDeleteUser → accountDeletion.ts）を通る。
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebase";
import { collection, getDocs } from "firebase/firestore";

interface UserRow {
  id: string;
  displayName: string;
  email: string;
  role: string;
  phone: string;
  deleted: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "管理者",
  teacher: "講師",
  student: "生徒",
};

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 強制退会の対象と入力中の理由
  const [target, setTarget] = useState<UserRow | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState("");

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const snapshot = await getDocs(collection(db, "users"));
      const data: UserRow[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          displayName: typeof d.displayName === "string" ? d.displayName : "",
          email: typeof d.email === "string" ? d.email : "",
          role: typeof d.role === "string" ? d.role : "",
          phone: typeof d.phone === "string" ? d.phone : "",
          deleted: d.status === "deleted",
        };
      });

      // 退会済みは末尾にまとめる
      data.sort(
        (a, b) =>
          Number(a.deleted) - Number(b.deleted) ||
          a.displayName.localeCompare(b.displayName, "ja")
      );
      setUsers(data);
    } catch (err) {
      console.error("ユーザー一覧の取得に失敗しました:", err);
      setError("ユーザー一覧の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleDelete = async () => {
    if (!target) return;
    setActionError("");
    if (!reason.trim()) {
      setActionError("削除の理由を入力してください。");
      return;
    }
    if (
      !window.confirm(
        `${target.displayName || target.email} さんのアカウントを削除します。元に戻せません。よろしいですか？`
      )
    ) {
      return;
    }
    try {
      setWorking(true);
      const callable = httpsCallable<
        { uid: string; reason: string },
        { ok: boolean }
      >(functions, "adminDeleteUser");
      await callable({ uid: target.id, reason: reason.trim() });
      setActionNotice(`${target.displayName || target.email} さんを退会処理しました。`);
      setTarget(null);
      setReason("");
      await fetchAll();
    } catch (err: any) {
      console.error("強制退会に失敗しました:", err);
      setActionError(
        typeof err?.message === "string" && err.message
          ? err.message
          : "退会処理に失敗しました。"
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="about-section fade-in-up">
      <h2 className="centered-heading-with-border">
        <span>ユーザー一覧（管理）</span>
      </h2>

      <div style={{ maxWidth: "900px", margin: "2rem auto" }}>
        {actionNotice && (
          <p className="success-message" style={{ textAlign: "center" }}>
            {actionNotice}
          </p>
        )}

        {target && (
          <div
            style={{
              border: "1px solid #f0c4c4",
              borderRadius: 8,
              padding: "1rem",
              marginBottom: "1.5rem",
              background: "#fdf5f5",
            }}
          >
            <h3 style={{ marginTop: 0 }}>強制退会</h3>
            <p style={{ margin: "0 0 0.5rem" }}>
              対象: {target.displayName || "（名前未設定）"}（{target.email || target.id}）
            </p>
            <p style={{ fontSize: "0.85rem", color: "#666" }}>
              本人の退会と同じ処理を行います（会員情報の削除・クーポンの無効化・レビューの匿名化・
              講師プロフィールの非公開化）。今後の予約が残っている場合は実行できないため、
              先に予約をキャンセルしてください。本人には削除の通知メールが届きます。
            </p>
            <textarea
              className="form-control"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="例: 利用規約第◯条に違反する行為を確認したため"
              style={{ maxWidth: 520, width: "100%" }}
            />
            {actionError && (
              <p className="error-message" role="alert">{actionError}</p>
            )}
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <button
                type="button"
                className="form-button"
                onClick={handleDelete}
                disabled={working}
              >
                {working ? "処理中…" : "退会させる"}
              </button>
              <button
                type="button"
                className="form-button"
                onClick={() => {
                  setTarget(null);
                  setReason("");
                  setActionError("");
                }}
                disabled={working}
              >
                やめる
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: "center" }}>読み込み中...</p>
        ) : error ? (
          <p style={{ textAlign: "center", color: "#c62828" }}>{error}</p>
        ) : users.length === 0 ? (
          <p style={{ textAlign: "center" }}>ユーザーはいません。</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #ccc", textAlign: "left" }}>
                  <th style={{ padding: "8px" }}>氏名</th>
                  <th style={{ padding: "8px" }}>メールアドレス</th>
                  <th style={{ padding: "8px" }}>電話番号</th>
                  <th style={{ padding: "8px" }}>ロール</th>
                  <th style={{ padding: "8px" }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    style={{
                      borderBottom: "1px solid #eee",
                      color: u.deleted ? "#aaa" : undefined,
                    }}
                  >
                    <td style={{ padding: "8px" }}>{u.displayName || "―"}</td>
                    <td style={{ padding: "8px" }}>{u.email || "―"}</td>
                    <td style={{ padding: "8px" }}>{u.phone || "―"}</td>
                    <td style={{ padding: "8px" }}>
                      {ROLE_LABELS[u.role] || u.role || "―"}
                      {u.deleted && "（退会済み）"}
                    </td>
                    <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                      {!u.deleted && u.role !== "admin" && (
                        <button
                          type="button"
                          onClick={() => {
                            setTarget(u);
                            setReason("");
                            setActionError("");
                            setActionNotice("");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#c62828",
                            cursor: "pointer",
                            fontSize: "0.85rem",
                          }}
                        >
                          強制退会
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <Link to="/admin" className="form-button">
            管理画面トップへ戻る
          </Link>
        </div>
      </div>
    </main>
  );
};

export default AdminUsers;
