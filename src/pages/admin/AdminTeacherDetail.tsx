// 管理者用: 講師ごとの詳細（月次/年次の売上・成約数、累計、レビュー平均、直近の予約、講師都合キャンセル）。
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
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
  commissionOfReservation,
} from "../../lib/adminStats";

const GOLD = "#b89f6b";
const DARK_GOLD = "#7a6a3f";

/** 講師都合キャンセルの記録（functions の teacherCancelReservation が作る） */
interface TeacherCancellation {
  id: string;
  lessonDate: string;
  lessonTime: string;
  studentName: string;
  reason: string;
  refundOutcome: string;
  stripeFee: number;
  stripeFeeEstimated: boolean;
  settled: boolean;
}

const REFUND_OUTCOME_LABELS: Record<string, string> = {
  voided: "与信取消（請求なし）",
  refunded: "全額返金",
  failed: "返金失敗（要手動対応）",
};

const AdminTeacherDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { reservations, users, reviews, loading, error } = useAdminData();
  const [cancellations, setCancellations] = useState<TeacherCancellation[]>([]);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    getDocs(query(collection(db, "teacherCancellations"), where("teacherId", "==", id)))
      .then((snap) => {
        if (!alive) return;
        const list = snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            lessonDate: typeof x.lessonDate === "string" ? x.lessonDate : "",
            lessonTime: typeof x.lessonTime === "string" ? x.lessonTime : "",
            studentName: typeof x.studentName === "string" ? x.studentName : "",
            reason: typeof x.reason === "string" ? x.reason : "",
            refundOutcome: typeof x.refundOutcome === "string" ? x.refundOutcome : "",
            stripeFee: typeof x.stripeFee === "number" ? x.stripeFee : 0,
            stripeFeeEstimated: x.stripeFeeEstimated === true,
            settled: x.settled === true,
          };
        });
        list.sort((a, b) => b.lessonDate.localeCompare(a.lessonDate));
        setCancellations(list);
      })
      .catch((err) => console.error("講師都合キャンセルの取得に失敗しました:", err));
    return () => {
      alive = false;
    };
  }, [id]);

  const unsettledFee = useMemo(
    () => cancellations.reduce((s, c) => (c.settled ? s : s + c.stripeFee), 0),
    [cancellations]
  );

  /** 月末精算で講師への支払いから差し引いたら、精算済みの印を付ける */
  const markSettled = async (c: TeacherCancellation) => {
    if (
      !window.confirm(
        `${c.lessonDate} ${c.lessonTime}（${c.studentName}）の決済手数料 ${yen(c.stripeFee)} を精算済みにします。よろしいですか？`
      )
    ) {
      return;
    }
    setSettlingId(c.id);
    try {
      await updateDoc(doc(db, "teacherCancellations", c.id), {
        settled: true,
        settledAt: serverTimestamp(),
      });
      setCancellations((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, settled: true } : x))
      );
    } catch (err) {
      console.error("精算済みにできませんでした:", err);
      alert("精算済みにできませんでした。");
    } finally {
      setSettlingId(null);
    }
  };

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
    let commission = 0;
    let count = 0;
    for (const r of teacherReservations) {
      if (!isPaid(r)) continue;
      gmv += r.lessonAmount;
      // 料率は予約ごとに異なる（逓減制）ため、合計から逆算せず1件ずつ足す
      commission += commissionOfReservation(r);
      count += 1;
    }
    return { gmv, commission, count };
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
          <p className="kpi-label">講師都合キャンセル</p>
          <p className="kpi-value">{cancellations.length}件</p>
          <p className="kpi-sub">未精算の差引額 {yen(unsettledFee)}</p>
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

      <div className="admin-chart-card">
        <h3>講師都合のキャンセル</h3>
        <p style={{ color: "#8a8270", fontSize: "0.9rem" }}>
          返金して戻ってこなかった Stripe の決済手数料は講師の負担です。
          月末の精算で講師への支払いから差し引いたら「精算済みにする」を押してください。
        </p>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>日時</th>
                <th>生徒</th>
                <th>理由</th>
                <th>返金</th>
                <th className="num">差引額</th>
                <th>精算</th>
              </tr>
            </thead>
            <tbody>
              {cancellations.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: "#a49b85" }}>
                    講師都合のキャンセルはありません。
                  </td>
                </tr>
              ) : (
                cancellations.map((c) => (
                  <tr key={c.id}>
                    <td>
                      {c.lessonDate} {c.lessonTime}
                    </td>
                    <td>{c.studentName || "―"}</td>
                    <td>{c.reason || "―"}</td>
                    <td>{REFUND_OUTCOME_LABELS[c.refundOutcome] || c.refundOutcome || "―"}</td>
                    <td className="num">
                      {c.stripeFee > 0
                        ? `${yen(c.stripeFee)}${c.stripeFeeEstimated ? "（見積）" : ""}`
                        : "―"}
                    </td>
                    <td>
                      {c.stripeFee <= 0 ? (
                        "―"
                      ) : c.settled ? (
                        "精算済み"
                      ) : (
                        <button
                          type="button"
                          onClick={() => markSettled(c)}
                          disabled={settlingId === c.id}
                        >
                          {settlingId === c.id ? "更新中..." : "精算済みにする"}
                        </button>
                      )}
                    </td>
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
