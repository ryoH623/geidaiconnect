// src/pages/admin/AdminUsers.tsx
// 管理者用: 全ユーザーの一覧（閲覧のみ）
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../../firebase";
import { collection, getDocs } from "firebase/firestore";

interface UserRow {
  id: string;
  displayName: string;
  email: string;
  role: string;
  phone: string;
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

  useEffect(() => {
    const fetchAll = async () => {
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
          };
        });

        data.sort((a, b) => a.displayName.localeCompare(b.displayName, "ja"));
        setUsers(data);
      } catch (err) {
        console.error("ユーザー一覧の取得に失敗しました:", err);
        setError("ユーザー一覧の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  return (
    <main className="about-section fade-in-up">
      <h2 className="centered-heading-with-border">
        <span>ユーザー一覧（管理）</span>
      </h2>

      <div style={{ maxWidth: "900px", margin: "2rem auto" }}>
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
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "8px" }}>{u.displayName || "―"}</td>
                    <td style={{ padding: "8px" }}>{u.email || "―"}</td>
                    <td style={{ padding: "8px" }}>{u.phone || "―"}</td>
                    <td style={{ padding: "8px" }}>
                      {ROLE_LABELS[u.role] || u.role || "―"}
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
