// 管理者用: 登録済み講師の一覧。売上（GMV/手数料）・成約数・レビュー平均を併記し、詳細ページへ。
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAdminData } from "../../hooks/useAdminData";
import { perTeacherStats, yen } from "../../lib/adminStats";

const AdminTeachers: React.FC = () => {
  const { reservations, users, reviews, loading, error } = useAdminData();

  const teachers = useMemo(() => users.filter((u) => u.role === "teacher"), [users]);
  const stats = useMemo(
    () => perTeacherStats(teachers, reservations, reviews),
    [teachers, reservations, reviews]
  );

  return (
    <main className="admin-page">
      <h2 className="centered-heading-with-border">
        <span>登録済み講師一覧</span>
      </h2>

      {loading ? (
        <p style={{ textAlign: "center" }}>読み込み中...</p>
      ) : error ? (
        <p style={{ textAlign: "center", color: "#c62828" }}>{error}</p>
      ) : (
        <>
          <p style={{ color: "#8a8270" }}>登録講師数：{stats.length}人</p>
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>講師名</th>
                  <th className="num">GMV（累計）</th>
                  <th className="num">手数料（累計）</th>
                  <th className="num">成約数</th>
                  <th className="num">レビュー平均</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stats.map((t) => (
                  <tr key={t.teacherId}>
                    <td>{t.name}</td>
                    <td className="num">{yen(t.gmv)}</td>
                    <td className="num">{yen(t.commission)}</td>
                    <td className="num">{t.paidCount}</td>
                    <td className="num">
                      {t.avgRating != null
                        ? `★${t.avgRating.toFixed(1)}（${t.reviewCount}）`
                        : "―"}
                    </td>
                    <td>
                      <Link to={`/admin/teachers/${t.teacherId}`}>詳細</Link>
                    </td>
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

export default AdminTeachers;
