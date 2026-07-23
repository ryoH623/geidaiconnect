// 管理者用: 講師ごとの詳細（月次/年次の売上・成約数、累計、レビュー平均、直近の予約）。
import React, { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { useAdminData } from "../../hooks/useAdminData";
import {
  aggregateMonthlyRevenue,
  toYearSeries,
  availableYears,
  isPaid,
  yen,
  COMMISSION_RATE,
} from "../../lib/adminStats";

const GOLD = "#b89f6b";
const DARK_GOLD = "#7a6a3f";

const AdminTeacherDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { reservations, users, reviews, loading, error } = useAdminData();

  const teacher = useMemo(
    () => users.find((u) => u.id === id),
    [users, id]
  );

  const teacherReservations = useMemo(
    () => reservations.filter((r) => r.teacherId === id),
    [reservations, id]
  );

  const years = useMemo(
    () => availableYears(teacherReservations, []),
    [teacherReservations]
  );
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const series = useMemo(
    () => toYearSeries(aggregateMonthlyRevenue(teacherReservations), year),
    [teacherReservations, year]
  );

  const totals = useMemo(() => {
    let gmv = 0;
    let count = 0;
    for (const r of teacherReservations) {
      if (!isPaid(r)) continue;
      gmv += r.lessonAmount;
      count += 1;
    }
    return { gmv, commission: Math.floor(gmv * COMMISSION_RATE), count };
  }, [teacherReservations]);

  const rating = useMemo(() => {
    const rs = reviews.filter((rv) => rv.teacherId === id);
    if (rs.length === 0) return null;
    return { avg: rs.reduce((s, rv) => s + rv.rating, 0) / rs.length, n: rs.length };
  }, [reviews, id]);

  const recent = useMemo(
    () =>
      [...teacherReservations]
        .sort((a, b) => b.lessonDate.localeCompare(a.lessonDate))
        .slice(0, 10),
    [teacherReservations]
  );

  if (loading) {
    return (
      <main className="admin-page">
        <p style={{ textAlign: "center" }}>読み込み中...</p>
      </main>
    );
  }
  if (error) {
    return (
      <main className="admin-page">
        <p style={{ textAlign: "center", color: "#c62828" }}>{error}</p>
      </main>
    );
  }

  const teacherName =
    teacher?.displayName || teacher?.email || teacherReservations[0]?.teacherName || id;

  return (
    <main className="admin-page">
      <h2 className="centered-heading-with-border">
        <span>講師詳細：{teacherName}</span>
      </h2>

      {teacher && (
        <p style={{ color: "#8a8270" }}>
          {teacher.email}
          {teacher.phone ? `／${teacher.phone}` : ""}
        </p>
      )}

      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-label">累計GMV</p>
          <p className="kpi-value">{yen(totals.gmv)}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">累計手数料</p>
          <p className="kpi-value">{yen(totals.commission)}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">累計成約数</p>
          <p className="kpi-value">{totals.count}件</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">レビュー平均</p>
          <p className="kpi-value">
            {rating ? `★${rating.avg.toFixed(1)}` : "―"}
          </p>
          <p className="kpi-sub">{rating ? `${rating.n}件のレビュー` : "レビューなし"}</p>
        </div>
      </div>

      <div className="admin-toolbar">
        <label htmlFor="year-select">対象年：</label>
        <select
          id="year-select"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
      </div>

      <div className="admin-chart-card">
        <h3>月次 売上（{year}年）</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={(v) => `${(v / 10000).toLocaleString()}万`} />
            <Tooltip formatter={(v) => yen(Number(v))} />
            <Legend />
            <Bar dataKey="gmv" name="GMV" fill={GOLD} radius={[4, 4, 0, 0]} />
            <Bar
              dataKey="commission"
              name="手数料"
              fill={DARK_GOLD}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="admin-chart-card">
        <h3>直近の予約（最新10件）</h3>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>日付</th>
                <th>生徒</th>
                <th>コース</th>
                <th className="num">金額</th>
                <th>決済</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ color: "#a49b85" }}>
                    予約はまだありません。
                  </td>
                </tr>
              ) : (
                recent.map((r) => (
                  <tr key={r.id}>
                    <td>{r.lessonDate}</td>
                    <td>{r.studentName || "―"}</td>
                    <td>{r.lessonCourse || "―"}</td>
                    <td className="num">{yen(r.lessonAmount)}</td>
                    <td>{r.paymentStatus === "paid" ? "支払済み" : r.paymentStatus || "―"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <Link to="/admin/teachers" className="form-button">
          講師一覧へ戻る
        </Link>
      </div>
    </main>
  );
};

export default AdminTeacherDetail;
