// src/pages/admin/AdminReservations.tsx
// 管理者用: 全予約の一覧（閲覧のみ）。今後／過去／キャンセル等で切り替え、名前で絞り込める。
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import { collection, getDocs } from "firebase/firestore";
import {
  CANCELLED_BY_LABELS,
  PAYMENT_STATUS,
  RESERVATION_STATUS,
  StatusBadge as Badge,
  formatLessonDate as formatDate,
  todayJst,
} from "../../lib/adminReservationLabels";

interface Reservation {
  id: string;
  name: string;
  teacherId: string;
  teacherName: string;
  lessonCourse: string;
  lessonType: string;
  lessonDate: string;
  lessonTime: string;
  totalAmount: number | null;
  couponDiscount: number;
  paymentStatus: string;
  reservationStatus: string;
  cancelledBy: string;
}

type Tab = "upcoming" | "past" | "inactive" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "upcoming", label: "今後の予約" },
  { key: "past", label: "終了したレッスン" },
  { key: "inactive", label: "キャンセル・期限切れ" },
  { key: "all", label: "すべて" },
];

const str = (v: unknown) => (typeof v === "string" ? v : "");

const AdminReservations: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("upcoming");
  const [keyword, setKeyword] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError("");

        // 件数が増えたら日付フィルタやページングの導入を検討する
        const snapshot = await getDocs(collection(db, "reservations"));
        const data: Reservation[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const lessonAmount = typeof d.lessonAmount === "number" ? d.lessonAmount : null;
          return {
            id: docSnap.id,
            name: str(d.name),
            teacherId: str(d.teacherId),
            teacherName: str(d.teacherName),
            lessonCourse: str(d.lessonCourse),
            lessonType: str(d.lessonType),
            lessonDate: str(d.lessonDate),
            lessonTime: str(d.lessonTime),
            totalAmount: typeof d.totalAmount === "number" ? d.totalAmount : lessonAmount,
            couponDiscount: typeof d.couponDiscount === "number" ? d.couponDiscount : 0,
            paymentStatus: str(d.paymentStatus),
            reservationStatus: str(d.reservationStatus),
            cancelledBy: str(d.cancelledBy),
          };
        });

        setReservations(data);
      } catch (err) {
        console.error("予約一覧の取得に失敗しました:", err);
        setError("予約一覧の取得に失敗しました。");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const grouped = useMemo(() => {
    const today = todayJst();
    const groups: Record<Tab, Reservation[]> = { upcoming: [], past: [], inactive: [], all: [] };
    for (const r of reservations) {
      groups.all.push(r);
      if (r.reservationStatus === "cancelled" || r.reservationStatus === "expired") {
        groups.inactive.push(r);
      } else if (r.lessonDate >= today) {
        groups.upcoming.push(r);
      } else {
        groups.past.push(r);
      }
    }
    const key = (r: Reservation) => `${r.lessonDate} ${r.lessonTime}`;
    // 今後は近い順、それ以外は新しい順
    groups.upcoming.sort((a, b) => key(a).localeCompare(key(b)));
    for (const k of ["past", "inactive", "all"] as const) {
      groups[k].sort((a, b) => key(b).localeCompare(key(a)));
    }
    return groups;
  }, [reservations]);

  const rows = useMemo(() => {
    const q = keyword.trim();
    if (!q) return grouped[tab];
    return grouped[tab].filter((r) => r.name.includes(q) || r.teacherName.includes(q));
  }, [grouped, tab, keyword]);

  const needsAction = reservations.filter((r) => r.paymentStatus === "refund_failed").length;

  return (
    <main className="admin-page">
      <h2 className="centered-heading-with-border">
        <span>予約一覧（管理）</span>
      </h2>

      {loading ? (
        <p style={{ textAlign: "center" }}>読み込み中...</p>
      ) : error ? (
        <p style={{ textAlign: "center", color: "#c62828" }}>{error}</p>
      ) : (
        <>
          {needsAction > 0 && (
            <p className="admin-alert">
              返金に失敗した予約が {needsAction} 件あります。Stripe の管理画面で手動返金してください。
            </p>
          )}

          <div className="admin-tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                className={`admin-tab${tab === t.key ? " is-active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
                <span className="admin-tab-count">{grouped[t.key].length}</span>
              </button>
            ))}
          </div>

          <div className="admin-toolbar">
            <input
              type="search"
              className="admin-search"
              placeholder="生徒名・講師名で絞り込み"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <span style={{ color: "#8a8270", fontSize: "0.9rem" }}>{rows.length}件</span>
          </div>

          {rows.length === 0 ? (
            <p className="admin-empty">該当する予約はありません。</p>
          ) : (
            <div className="admin-table-card">
              <table className="admin-table admin-table--reservations">
                <thead>
                  <tr>
                    <th>レッスン日時</th>
                    <th>生徒</th>
                    <th>講師 / コース</th>
                    <th className="num">金額</th>
                    <th>状態</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="is-clickable"
                      onClick={() => navigate(`/admin/reservations/${r.id}`)}
                    >
                      <td>
                        <div className="cell-main">
                          <Link
                            to={`/admin/reservations/${r.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {formatDate(r.lessonDate)}
                          </Link>
                        </div>
                        <div className="cell-sub">
                          {r.lessonTime || "―"}
                          {r.lessonType && ` ・ ${r.lessonType}`}
                        </div>
                      </td>
                      <td>
                        <div className="cell-main">{r.name || "―"}</div>
                      </td>
                      <td className="cell-wrap">
                        <div className="cell-main">
                          {r.teacherId ? (
                            <Link
                              to={`/admin/teachers/${r.teacherId}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {r.teacherName || "―"}
                            </Link>
                          ) : (
                            r.teacherName || "―"
                          )}
                        </div>
                        <div className="cell-sub">{r.lessonCourse}</div>
                      </td>
                      <td className="num">
                        <div className="cell-main">
                          {r.totalAmount != null ? `${r.totalAmount.toLocaleString()}円` : "―"}
                        </div>
                        {r.couponDiscount > 0 && (
                          <div className="cell-sub">クーポン −{r.couponDiscount.toLocaleString()}円</div>
                        )}
                      </td>
                      <td>
                        <div className="status-stack">
                          <Badge map={RESERVATION_STATUS} value={r.reservationStatus} />
                          <Badge map={PAYMENT_STATUS} value={r.paymentStatus} />
                        </div>
                        {r.cancelledBy && (
                          <div className="cell-sub">
                            {CANCELLED_BY_LABELS[r.cancelledBy] || r.cancelledBy}
                          </div>
                        )}
                      </td>
                    </tr>
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

export default AdminReservations;
