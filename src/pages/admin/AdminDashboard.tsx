// 管理者用ダッシュボード: KPI サマリーと月次の売上・予約・新規生徒の推移グラフ。
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
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
  newUsersYearSeries,
  monthKpis,
  rateStats,
  availableYears,
  yen,
  COMMISSION_RATE,
} from "../../lib/adminStats";

const GOLD = "#b89f6b";
const DARK_GOLD = "#7a6a3f";
const BLUE = "#6b8fb8";
const GREEN = "#8a9a5b";

const AdminDashboard: React.FC = () => {
  const { reservations, users, reviews, loading, error } = useAdminData();
  void reviews;

  const years = useMemo(
    () => availableYears(reservations, users),
    [reservations, users]
  );
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const revenueSeries = useMemo(
    () => toYearSeries(aggregateMonthlyRevenue(reservations), year),
    [reservations, year]
  );
  const studentSeries = useMemo(
    () => newUsersYearSeries(users, "student", year),
    [users, year]
  );

  const thisMonth = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1
  ).padStart(2, "0")}`;
  const kpis = useMemo(
    () => monthKpis(reservations, users, thisMonth),
    [reservations, users, thisMonth]
  );
  const rates = useMemo(() => rateStats(reservations), [reservations]);

  const yearTotal = useMemo(
    () =>
      revenueSeries.reduce(
        (acc, m) => {
          acc.gmv += m.gmv;
          acc.commission += m.commission;
          acc.count += m.count;
          return acc;
        },
        { gmv: 0, commission: 0, count: 0 }
      ),
    [revenueSeries]
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

  return (
    <main className="admin-page">
      <h2 className="centered-heading-with-border">
        <span>ダッシュボード</span>
      </h2>

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
        <span style={{ color: "#a49b85", fontSize: "0.85rem" }}>
          （手数料率 {Math.round(COMMISSION_RATE * 100)}%）
        </span>
      </div>

      {/* 今月の KPI */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-label">今月のGMV（取扱高）</p>
          <p className="kpi-value">{yen(kpis.gmv)}</p>
          <p className="kpi-sub">支払済み {kpis.paidCount} 件</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">今月の手数料収入</p>
          <p className="kpi-value">{yen(kpis.commission)}</p>
          <p className="kpi-sub">GMV × {Math.round(COMMISSION_RATE * 100)}%</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">今月の新規生徒</p>
          <p className="kpi-value">{kpis.newStudents}人</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">今月の稼働講師</p>
          <p className="kpi-value">{kpis.activeTeachers}人</p>
          <p className="kpi-sub">予約が成立した講師数</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">成約率 / キャンセル率</p>
          <p className="kpi-value">
            {Math.round(rates.confirmRate * 100)}%
            <span style={{ fontSize: "0.9rem", color: "#a49b85" }}>
              {" "}
              / {Math.round(rates.cancelRate * 100)}%
            </span>
          </p>
          <p className="kpi-sub">全期間・全予約 {rates.total} 件</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">客単価（平均）</p>
          <p className="kpi-value">{yen(rates.avgPrice)}</p>
          <p className="kpi-sub">支払済み予約の平均</p>
        </div>
      </div>

      {/* 年間サマリー */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-label">{year}年 GMV 合計</p>
          <p className="kpi-value">{yen(yearTotal.gmv)}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">{year}年 手数料 合計</p>
          <p className="kpi-value">{yen(yearTotal.commission)}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">{year}年 成約レッスン数</p>
          <p className="kpi-value">{yearTotal.count}件</p>
        </div>
      </div>

      {/* 売上推移 */}
      <div className="admin-chart-card">
        <h3>月次 売上推移（{year}年）</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={revenueSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={(v) => `${(v / 10000).toLocaleString()}万`} />
            <Tooltip formatter={(v) => yen(Number(v))} />
            <Legend />
            <Bar dataKey="gmv" name="GMV（取扱高）" fill={GOLD} radius={[4, 4, 0, 0]} />
            <Bar
              dataKey="commission"
              name="手数料収入"
              fill={DARK_GOLD}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 予約数推移 */}
      <div className="admin-chart-card">
        <h3>月次 成約レッスン数（{year}年）</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={revenueSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" />
            <YAxis allowDecimals={false} />
            <Tooltip formatter={(v) => `${Number(v)} 件`} />
            <Line
              type="monotone"
              dataKey="count"
              name="成約レッスン数"
              stroke={GREEN}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 新規生徒数推移 */}
      <div className="admin-chart-card">
        <h3>月次 新規生徒数（{year}年）</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={studentSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" />
            <YAxis allowDecimals={false} />
            <Tooltip formatter={(v) => `${Number(v)} 人`} />
            <Bar
              dataKey="count"
              name="新規生徒数"
              fill={BLUE}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <Link to="/admin" className="form-button">
          管理画面トップへ戻る
        </Link>
      </div>
    </main>
  );
};

export default AdminDashboard;
