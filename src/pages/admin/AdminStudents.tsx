// 管理者用: 登録済み生徒の一覧。予約実績（支払済み件数・累計GMV）も併記。
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAdminData } from "../../hooks/useAdminData";
import { isPaid, yen } from "../../lib/adminStats";

const AdminStudents: React.FC = () => {
  const { reservations, users, loading, error } = useAdminData();

  const rows = useMemo(() => {
    const spend = new Map<string, { count: number; gmv: number }>();
    for (const r of reservations) {
      if (!isPaid(r) || !r.userId) continue;
      const cur = spend.get(r.userId) ?? { count: 0, gmv: 0 };
      cur.count += 1;
      cur.gmv += r.lessonAmount;
      spend.set(r.userId, cur);
    }
    return users
      .filter((u) => u.role === "student")
      .map((u) => ({
        ...u,
        paidCount: spend.get(u.id)?.count ?? 0,
        gmv: spend.get(u.id)?.gmv ?? 0,
      }))
      .sort((a, b) => b.gmv - a.gmv || a.displayName.localeCompare(b.displayName, "ja"));
  }, [reservations, users]);

  return (
    <main className="admin-page">
      <h2 className="centered-heading-with-border">
        <span>登録済み生徒一覧</span>
      </h2>

      {loading ? (
        <p style={{ textAlign: "center" }}>読み込み中...</p>
      ) : error ? (
        <p style={{ textAlign: "center", color: "#c62828" }}>{error}</p>
      ) : (
        <>
          <p style={{ color: "#8a8270" }}>登録生徒数：{rows.length}人</p>
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>氏名</th>
                  <th>メールアドレス</th>
                  <th>電話番号</th>
                  <th className="num">受講回数</th>
                  <th className="num">累計支払額</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td>{u.displayName || "―"}</td>
                    <td>{u.email || "―"}</td>
                    <td>{u.phone || "―"}</td>
                    <td className="num">{u.paidCount}</td>
                    <td className="num">{yen(u.gmv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <Link to="/admin" className="form-button">
          管理画面トップへ戻る
        </Link>
      </div>
    </main>
  );
};

export default AdminStudents;
