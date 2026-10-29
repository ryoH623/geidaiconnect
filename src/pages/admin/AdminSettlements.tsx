// src/pages/admin/AdminSettlements.tsx
// 管理者用: 講師への月末精算。月ごと・講師ごとに、レッスンの取り分から講師都合キャンセルの
// 決済手数料を差し引いた振込額を出し、CSV に書き出して「振込済み」にできる。
//
// 対象のレッスン: その月にレッスン日があり、支払いが確定（paid）していてキャンセルされていない予約。
// 差し引く手数料: 未精算の講師都合キャンセルのうち、レッスン日がその月の末日までのもの
// （振込済みにした月は、そのとき差し引いた分を表示する）。
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import { COMMISSION_RATE, yen } from "../../lib/adminStats";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : 0);

interface Lesson {
  id: string;
  teacherId: string;
  teacherName: string;
  studentName: string;
  lessonDate: string;
  lessonTime: string;
  lessonCourse: string;
  lessonAmount: number;
  commission: number;
  payout: number;
}

interface Deduction {
  id: string;
  teacherId: string;
  teacherName: string;
  studentName: string;
  lessonDate: string;
  lessonTime: string;
  stripeFee: number;
  settled: boolean;
  settlementId: string;
}

interface Settlement {
  id: string;
  teacherId: string;
  month: string;
  transferAmount: number;
  settledAtMs: number | null;
}

interface Row {
  teacherId: string;
  teacherName: string;
  lessons: Lesson[];
  deductions: Deduction[];
  lessonTotal: number;
  commissionTotal: number;
  payoutTotal: number;
  deductionTotal: number;
  transferAmount: number;
  settlement: Settlement | null;
}

function previousMonth(): string {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

function lastDayOf(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

/** Excel で文字化けしないよう BOM を付けて CSV をダウンロードする */
function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const AdminSettlements: React.FC = () => {
  const [month, setMonth] = useState(previousMonth());
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [openId, setOpenId] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [resSnap, payoutSnap, tcSnap, stSnap] = await Promise.all([
        getDocs(collection(db, "reservations")),
        getDocs(collection(db, "reservationPayouts")),
        getDocs(collection(db, "teacherCancellations")),
        getDocs(collection(db, "teacherSettlements")),
      ]);

      const payoutById = new Map(payoutSnap.docs.map((d) => [d.id, d.data()]));
      const ls: Lesson[] = [];
      for (const d of resSnap.docs) {
        const x = d.data();
        if (x.paymentStatus !== "paid" || x.reservationStatus !== "confirmed") continue;
        const lessonAmount = num(x.lessonAmount);
        const p = payoutById.get(d.id);
        // 逓減制の導入前の予約は明細が無いので従来の固定率で計算する
        const commission =
          p && typeof p.commissionAmount === "number"
            ? p.commissionAmount
            : Math.floor(lessonAmount * COMMISSION_RATE);
        const payout =
          p && typeof p.teacherPayout === "number" ? p.teacherPayout : lessonAmount - commission;
        ls.push({
          id: d.id,
          teacherId: str(x.teacherId),
          teacherName: str(x.teacherName),
          studentName: str(x.name),
          lessonDate: str(x.lessonDate),
          lessonTime: str(x.lessonTime),
          lessonCourse: str(x.lessonCourse),
          lessonAmount,
          commission,
          payout,
        });
      }
      setLessons(ls);

      setDeductions(
        tcSnap.docs
          .map((d) => {
            const x = d.data();
            return {
              id: d.id,
              teacherId: str(x.teacherId),
              teacherName: str(x.teacherName),
              studentName: str(x.studentName),
              lessonDate: str(x.lessonDate),
              lessonTime: str(x.lessonTime),
              stripeFee: num(x.stripeFee),
              settled: x.settled === true,
              settlementId: str(x.settlementId),
            };
          })
          .filter((x) => x.stripeFee > 0)
      );

      setSettlements(
        stSnap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            teacherId: str(x.teacherId),
            month: str(x.month),
            transferAmount: num(x.transferAmount),
            settledAtMs: x.settledAt instanceof Timestamp ? x.settledAt.toMillis() : null,
          };
        })
      );
    } catch (err) {
      console.error("精算データの取得に失敗しました:", err);
      setError("精算データの取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo<Row[]>(() => {
    const monthEnd = lastDayOf(month);
    const byTeacher = new Map<string, Row>();
    const rowOf = (teacherId: string, teacherName: string) => {
      let row = byTeacher.get(teacherId);
      if (!row) {
        const settlement = settlements.find((s) => s.id === `${teacherId}_${month}`) ?? null;
        row = {
          teacherId,
          teacherName,
          lessons: [],
          deductions: [],
          lessonTotal: 0,
          commissionTotal: 0,
          payoutTotal: 0,
          deductionTotal: 0,
          transferAmount: 0,
          settlement,
        };
        byTeacher.set(teacherId, row);
      }
      if (!row.teacherName && teacherName) row.teacherName = teacherName;
      return row;
    };

    for (const l of lessons) {
      if (l.lessonDate.slice(0, 7) !== month) continue;
      rowOf(l.teacherId, l.teacherName).lessons.push(l);
    }
    for (const d of deductions) {
      const settlementId = `${d.teacherId}_${month}`;
      const settledHere = d.settled && d.settlementId === settlementId;
      const pending = !d.settled && d.lessonDate <= monthEnd;
      if (!settledHere && !pending) continue;
      // 振込済みの月は、そのとき差し引いた分だけを出す
      const isSettledMonth = settlements.some((s) => s.id === settlementId);
      if (isSettledMonth && !settledHere) continue;
      rowOf(d.teacherId, d.teacherName).deductions.push(d);
    }

    const list = [...byTeacher.values()];
    for (const row of list) {
      row.lessons.sort((a, b) => `${a.lessonDate} ${a.lessonTime}`.localeCompare(`${b.lessonDate} ${b.lessonTime}`));
      row.lessonTotal = row.lessons.reduce((s, l) => s + l.lessonAmount, 0);
      row.commissionTotal = row.lessons.reduce((s, l) => s + l.commission, 0);
      row.payoutTotal = row.lessons.reduce((s, l) => s + l.payout, 0);
      row.deductionTotal = row.deductions.reduce((s, d) => s + d.stripeFee, 0);
      row.transferAmount = row.payoutTotal - row.deductionTotal;
    }
    return list.sort((a, b) => a.teacherName.localeCompare(b.teacherName, "ja"));
  }, [month, lessons, deductions, settlements]);

  const totals = useMemo(
    () => ({
      lessonTotal: rows.reduce((s, r) => s + r.lessonTotal, 0),
      commissionTotal: rows.reduce((s, r) => s + r.commissionTotal, 0),
      transferAmount: rows.reduce((s, r) => s + r.transferAmount, 0),
      unsettled: rows.filter((r) => !r.settlement).length,
    }),
    [rows]
  );

  const markSettled = async (row: Row) => {
    const settlementId = `${row.teacherId}_${month}`;
    const ok = window.confirm(
      `${row.teacherName} 先生の ${month} 分を「振込済み」にします。\n` +
        `振込額：${yen(row.transferAmount)}\n` +
        (row.deductions.length > 0
          ? `差し引いた決済手数料 ${row.deductions.length}件 も精算済みになります。\n`
          : "") +
        "\nよろしいですか？"
    );
    if (!ok) return;
    try {
      setSavingId(row.teacherId);
      const batch = writeBatch(db);
      batch.set(doc(db, "teacherSettlements", settlementId), {
        teacherId: row.teacherId,
        teacherName: row.teacherName,
        month,
        lessonCount: row.lessons.length,
        lessonTotal: row.lessonTotal,
        commissionTotal: row.commissionTotal,
        payoutTotal: row.payoutTotal,
        deductionTotal: row.deductionTotal,
        transferAmount: row.transferAmount,
        reservationIds: row.lessons.map((l) => l.id),
        cancellationIds: row.deductions.map((d) => d.id),
        settledBy: auth.currentUser?.uid ?? "",
        settledAt: serverTimestamp(),
      });
      for (const d of row.deductions) {
        batch.update(doc(db, "teacherCancellations", d.id), {
          settled: true,
          settledAt: serverTimestamp(),
          settlementId,
        });
      }
      await batch.commit();
      await load();
    } catch (err) {
      console.error("振込済みにできませんでした:", err);
      window.alert("振込済みにできませんでした。時間をおいて再度お試しください。");
    } finally {
      setSavingId("");
    }
  };

  const exportSummary = () => {
    downloadCsv(`精算一覧_${month}.csv`, [
      ["対象月", "講師名", "講師ID", "レッスン件数", "レッスン料合計", "運営手数料", "講師取り分", "差し引く決済手数料", "振込額", "状態"],
      ...rows.map((r) => [
        month,
        r.teacherName,
        r.teacherId,
        r.lessons.length,
        r.lessonTotal,
        r.commissionTotal,
        r.payoutTotal,
        r.deductionTotal,
        r.transferAmount,
        r.settlement ? "振込済み" : "未精算",
      ]),
    ]);
  };

  const exportDetail = () => {
    const lines: Array<Array<string | number>> = [
      ["対象月", "講師名", "区分", "レッスン日", "時刻", "生徒", "コース", "レッスン料", "運営手数料", "講師取り分", "差し引く額", "予約ID"],
    ];
    for (const r of rows) {
      for (const l of r.lessons) {
        lines.push([month, r.teacherName, "レッスン", l.lessonDate, l.lessonTime, l.studentName, l.lessonCourse, l.lessonAmount, l.commission, l.payout, "", l.id]);
      }
      for (const d of r.deductions) {
        lines.push([month, r.teacherName, "講師都合キャンセルの決済手数料", d.lessonDate, d.lessonTime, d.studentName, "", "", "", "", d.stripeFee, d.id]);
      }
    }
    downloadCsv(`精算明細_${month}.csv`, lines);
  };

  return (
    <main className="admin-page">
      <h2 className="centered-heading-with-border">
        <span>月末精算（講師への支払い）</span>
      </h2>

      <div className="admin-toolbar">
        <label>
          対象月：
          <input
            type="month"
            className="admin-search"
            style={{ flex: "none", width: "auto" }}
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </label>
        <button type="button" className="admin-tool-button" onClick={exportSummary} disabled={loading || rows.length === 0}>
          一覧を CSV で書き出す
        </button>
        <button type="button" className="admin-tool-button" onClick={exportDetail} disabled={loading || rows.length === 0}>
          明細を CSV で書き出す
        </button>
      </div>

      <p className="detail-note">
        その月にレッスン日があり、支払いが確定した予約が対象です。講師都合キャンセルで戻らなかった決済手数料は、
        未精算のものを振込額から差し引きます。振り込んだら「振込済みにする」を押してください。
      </p>

      {loading ? (
        <p style={{ textAlign: "center" }}>読み込み中...</p>
      ) : error ? (
        <p style={{ textAlign: "center", color: "#c62828" }}>{error}</p>
      ) : (
        <>
          <div className="kpi-grid">
            <div className="kpi-card">
              <p className="kpi-label">レッスン料合計</p>
              <p className="kpi-value">{yen(totals.lessonTotal)}</p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">運営手数料</p>
              <p className="kpi-value">{yen(totals.commissionTotal)}</p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">講師への振込合計</p>
              <p className="kpi-value">{yen(totals.transferAmount)}</p>
            </div>
            <div className="kpi-card">
              <p className="kpi-label">未精算の講師</p>
              <p className="kpi-value">{totals.unsettled}人</p>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="admin-empty">{month} に精算の対象はありません。</p>
          ) : (
            <div className="admin-table-card">
              <table className="admin-table admin-table--reservations">
                <thead>
                  <tr>
                    <th>講師</th>
                    <th className="num">件数</th>
                    <th className="num">レッスン料</th>
                    <th className="num">運営手数料</th>
                    <th className="num">講師取り分</th>
                    <th className="num">差引手数料</th>
                    <th className="num">振込額</th>
                    <th>状態</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <React.Fragment key={r.teacherId}>
                      <tr>
                        <td>
                          <div className="cell-main">
                            <Link to={`/admin/teachers/${r.teacherId}`}>{r.teacherName || r.teacherId}</Link>
                          </div>
                          <button
                            type="button"
                            className="admin-link-button"
                            onClick={() => setOpenId(openId === r.teacherId ? "" : r.teacherId)}
                          >
                            {openId === r.teacherId ? "明細を閉じる" : "明細を見る"}
                          </button>
                        </td>
                        <td className="num">{r.lessons.length}</td>
                        <td className="num">{yen(r.lessonTotal)}</td>
                        <td className="num">{yen(r.commissionTotal)}</td>
                        <td className="num">{yen(r.payoutTotal)}</td>
                        <td className="num">{r.deductionTotal > 0 ? `−${yen(r.deductionTotal)}` : "―"}</td>
                        <td className="num">
                          <div className="cell-main" style={{ fontWeight: "bold", color: r.transferAmount < 0 ? "#a12626" : undefined }}>
                            {yen(r.transferAmount)}
                          </div>
                        </td>
                        <td>
                          {r.settlement ? (
                            <>
                              <span className="status-badge status-badge--green">振込済み</span>
                              {r.settlement.settledAtMs && (
                                <div className="cell-sub">
                                  {new Date(r.settlement.settledAtMs).toLocaleDateString("ja-JP")}
                                </div>
                              )}
                            </>
                          ) : (
                            <button
                              type="button"
                              className="admin-tool-button"
                              onClick={() => markSettled(r)}
                              disabled={savingId === r.teacherId}
                            >
                              {savingId === r.teacherId ? "保存中..." : "振込済みにする"}
                            </button>
                          )}
                        </td>
                      </tr>
                      {openId === r.teacherId && (
                        <tr className="detail-subrow">
                          <td colSpan={8}>
                            <table className="admin-table">
                              <tbody>
                                {r.lessons.map((l) => (
                                  <tr key={l.id}>
                                    <td>
                                      <Link to={`/admin/reservations/${l.id}`}>
                                        {l.lessonDate} {l.lessonTime}
                                      </Link>
                                    </td>
                                    <td>{l.studentName}</td>
                                    <td>{l.lessonCourse}</td>
                                    <td className="num">{yen(l.lessonAmount)}</td>
                                    <td className="num">取り分 {yen(l.payout)}</td>
                                  </tr>
                                ))}
                                {r.deductions.map((d) => (
                                  <tr key={d.id}>
                                    <td>
                                      <Link to={`/admin/reservations/${d.id}`}>
                                        {d.lessonDate} {d.lessonTime}
                                      </Link>
                                    </td>
                                    <td>{d.studentName}</td>
                                    <td>講師都合キャンセルの決済手数料</td>
                                    <td className="num"></td>
                                    <td className="num" style={{ color: "#a12626" }}>−{yen(d.stripeFee)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

export default AdminSettlements;
