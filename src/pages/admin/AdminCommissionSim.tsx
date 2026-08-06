// 管理者用: 手数料の逓減制（変動手数料）を過去実績に当てはめた場合の試算。
// 閾値・料率を画面上で変えて収益インパクトを比較するための検討ツール。データは変更しない。
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAdminData } from "../../hooks/useAdminData";
import {
  simulateCommission,
  pairDistribution,
  yen,
  COMMISSION_RATE,
  type CommissionTier,
} from "../../lib/adminStats";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

/** 比較する案。閾値の妥当性を並べて判断するためのプリセット。 */
const PRESETS: { name: string; tiers: CommissionTier[] }[] = [
  {
    name: "現行（固定18%）",
    tiers: [{ minCount: 0, rate: COMMISSION_RATE }],
  },
  {
    name: "案A　10回→15% / 50回→10%",
    tiers: [
      { minCount: 0, rate: 0.18 },
      { minCount: 10, rate: 0.15 },
      { minCount: 50, rate: 0.1 },
    ],
  },
  {
    name: "案B　20回→15% / 60回→10%",
    tiers: [
      { minCount: 0, rate: 0.18 },
      { minCount: 20, rate: 0.15 },
      { minCount: 60, rate: 0.1 },
    ],
  },
  {
    name: "案C　10回→16% / 50回→13%",
    tiers: [
      { minCount: 0, rate: 0.18 },
      { minCount: 10, rate: 0.16 },
      { minCount: 50, rate: 0.13 },
    ],
  },
];

const AdminCommissionSim: React.FC = () => {
  const { reservations, loading, error } = useAdminData();

  // 自由入力の案（初期値はご提案どおり）
  const [t1, setT1] = useState(10);
  const [r1, setR1] = useState(15);
  const [t2, setT2] = useState(50);
  const [r2, setR2] = useState(10);

  const customTiers: CommissionTier[] = useMemo(
    () => [
      { minCount: 0, rate: COMMISSION_RATE },
      { minCount: t1, rate: r1 / 100 },
      { minCount: t2, rate: r2 / 100 },
    ],
    [t1, r1, t2, r2]
  );

  const custom = useMemo(
    () => simulateCommission(reservations, customTiers),
    [reservations, customTiers]
  );
  const presetResults = useMemo(
    () => PRESETS.map((p) => ({ name: p.name, sim: simulateCommission(reservations, p.tiers) })),
    [reservations]
  );
  const dist = useMemo(() => pairDistribution(reservations), [reservations]);

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
        <span>手数料 逓減制シミュレーション</span>
      </h2>

      <p style={{ color: "#8a8270", fontSize: "0.9rem" }}>
        「同じ生徒 × 同じ講師」の累計受講回数に応じて手数料率を下げた場合の試算です。
        成立（支払済み）レッスンのみを対象とし、返金・与信取消は除外しています。
        回数は古い順に数え、各予約には「それ以前の回数」で決まる率を当てています（非遡及）。
        <strong>この画面は計算のみで、データは一切変更しません。</strong>
      </p>

      {/* 全体像 */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-label">対象レッスン（累計）</p>
          <p className="kpi-value">{custom.paidCount}件</p>
          <p className="kpi-sub">GMV {yen(custom.gmv)}</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">生徒×講師のペア数</p>
          <p className="kpi-value">{dist.totalPairs}組</p>
          <p className="kpi-sub">最多 {dist.maxCount} 回</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">現行の手数料（固定18%）</p>
          <p className="kpi-value">{yen(custom.currentCommission)}</p>
        </div>
      </div>

      {/* ペアの継続回数分布 */}
      <div className="admin-chart-card">
        <h3>生徒×講師ペアの継続回数分布</h3>
        <p style={{ color: "#8a8270", fontSize: "0.85rem" }}>
          閾値を何回に置くべきかの判断材料です。GMV構成比が大きいレンジに閾値を置くほど減収幅が大きくなります。
        </p>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>継続回数</th>
                <th className="num">ペア数</th>
                <th className="num">レッスン件数</th>
                <th className="num">GMV</th>
                <th className="num">GMV構成比</th>
              </tr>
            </thead>
            <tbody>
              {dist.rows.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="num">{r.pairs}</td>
                  <td className="num">{r.lessons}</td>
                  <td className="num">{yen(r.gmv)}</td>
                  <td className="num">{pct(r.gmvShare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 案の比較 */}
      <div className="admin-chart-card">
        <h3>案の比較</h3>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>案</th>
                <th className="num">手数料収入</th>
                <th className="num">現行との差</th>
                <th className="num">実効料率</th>
              </tr>
            </thead>
            <tbody>
              {presetResults.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td className="num">{yen(p.sim.newCommission)}</td>
                  <td
                    className="num"
                    style={{ color: p.sim.delta < 0 ? "#c62828" : "#8a8270" }}
                  >
                    {p.sim.delta === 0
                      ? "―"
                      : `${p.sim.delta > 0 ? "+" : ""}${yen(p.sim.delta)}（${
                          p.sim.currentCommission
                            ? ((p.sim.delta / p.sim.currentCommission) * 100).toFixed(1)
                            : "0.0"
                        }%）`}
                  </td>
                  <td className="num">{pct(p.sim.effectiveRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 自由入力 */}
      <div className="admin-chart-card">
        <h3>閾値を自由に試す</h3>
        <div
          style={{
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <label>
            初回から{" "}
            <input
              type="number"
              value={t1}
              min={1}
              onChange={(e) => setT1(Number(e.target.value))}
              style={{ width: "4.5rem" }}
            />{" "}
            回で
            <input
              type="number"
              value={r1}
              min={0}
              max={100}
              onChange={(e) => setR1(Number(e.target.value))}
              style={{ width: "4.5rem", marginLeft: "0.5rem" }}
            />
            %
          </label>
          <label>
            <input
              type="number"
              value={t2}
              min={1}
              onChange={(e) => setT2(Number(e.target.value))}
              style={{ width: "4.5rem" }}
            />{" "}
            回で
            <input
              type="number"
              value={r2}
              min={0}
              max={100}
              onChange={(e) => setR2(Number(e.target.value))}
              style={{ width: "4.5rem", marginLeft: "0.5rem" }}
            />
            %
          </label>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card">
            <p className="kpi-label">この案の手数料収入</p>
            <p className="kpi-value">{yen(custom.newCommission)}</p>
            <p className="kpi-sub">実効料率 {pct(custom.effectiveRate)}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">現行との差</p>
            <p
              className="kpi-value"
              style={{ color: custom.delta < 0 ? "#c62828" : undefined }}
            >
              {custom.delta > 0 ? "+" : ""}
              {yen(custom.delta)}
            </p>
            <p className="kpi-sub">
              {custom.currentCommission
                ? `${((custom.delta / custom.currentCommission) * 100).toFixed(1)}%`
                : "―"}
            </p>
          </div>
        </div>

        <div style={{ overflowX: "auto", marginTop: "1rem" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>段階</th>
                <th className="num">料率</th>
                <th className="num">レッスン件数</th>
                <th className="num">GMV</th>
                <th className="num">手数料</th>
              </tr>
            </thead>
            <tbody>
              {custom.buckets.map((b) => (
                <tr key={b.label}>
                  <td>{b.label}</td>
                  <td className="num">{pct(b.rate)}</td>
                  <td className="num">{b.count}</td>
                  <td className="num">{yen(b.gmv)}</td>
                  <td className="num">{yen(b.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <Link to="/admin" className="form-button">
          管理画面トップへ戻る
        </Link>
      </div>
    </main>
  );
};

export default AdminCommissionSim;
