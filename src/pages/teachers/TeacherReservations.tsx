// src/pages/teachers/TeacherReservations.tsx
// 講師用: 自分宛の予約一覧。オンラインレッスンのみ参加URLを登録できる。
// 講師都合のキャンセルもここから行う（functions の teacherCancelReservation）。
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { useAuth } from "../../contexts/AuthContext";
import { db, functions } from "../../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { tierProgress } from "../../lib/adminStats";

interface Reservation {
  id: string;
  /** 生徒の uid。継続回数を生徒ごとに数えるのに使う */
  userId: string;
  name: string;
  furigana: string;
  email: string;
  phone: string;
  lessonCourse: string;
  lessonDate: string; // "YYYY-MM-DD"
  lessonTime: string; // "HH:mm"
  lessonType: string; // "自宅" | "スタジオ" | "出張" | "オンライン"
  location: string;
  lessonAmount: number | null;
  paymentStatus: string;
  reservationStatus: string;
  /** 予約時点で確定した運営手数料率（逓減制の導入前は null） */
  commissionRate: number | null;
  /** 手数料を差し引いた講師の取り分（導入前は null） */
  teacherPayout: number | null;
  notes?: string;
  /** オンラインレッスンの参加URL（未登録なら空） */
  meetingUrl: string;
  /** 誰がキャンセルしたか（"student" | "teacher" | "operator"） */
  cancelledBy: string;
  cancelReason: string;
}

/** 講師都合キャンセルの記録（teacherCancellations）のうち、画面に出す部分 */
interface CancellationFee {
  stripeFee: number;
  stripeFeeEstimated: boolean;
  settled: boolean;
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending_payment: "決済待ち",
  authorized: "お支払い前（カード枠確保済み）",
  paid: "支払済み",
  voided: "キャンセル（請求なし）",
  refunded: "返金済み",
  refund_failed: "返金手続き中（運営が対応）",
  expired: "期限切れ",
};

const RESERVATION_STATUS_LABELS: Record<string, string> = {
  pending: "確定待ち",
  confirmed: "確定",
  cancelled: "キャンセル済み",
  expired: "期限切れ",
};

function statusLabel(map: Record<string, string>, value: string): string {
  return map[value] || value || "不明";
}

/** 講師がキャンセルできる予約か。サーバー側（teacherCancelReservation）の判定と合わせる */
function canTeacherCancel(r: Reservation): boolean {
  if (r.reservationStatus !== "confirmed") return false;
  if (r.paymentStatus !== "paid" && r.paymentStatus !== "authorized") return false;
  const start = Date.parse(`${r.lessonDate}T${r.lessonTime || "00:00"}:00+09:00`);
  return Number.isFinite(start) && start > Date.now();
}

const TeacherReservations: React.FC = () => {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // オンライン予約ごとの参加URL入力欄（予約ID → 入力中の値）
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({});
  const [savingUrlId, setSavingUrlId] = useState<string | null>(null);
  const [urlMessage, setUrlMessage] = useState<Record<string, string>>({});
  // 講師都合キャンセル: 理由の入力欄を開いている予約と、その入力値
  const [cancelOpenId, setCancelOpenId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<Record<string, string>>({});
  const [fees, setFees] = useState<Map<string, CancellationFee>>(new Map());

  const handleTeacherCancel = async (res: Reservation) => {
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelMessage((prev) => ({ ...prev, [res.id]: "キャンセルの理由を入力してください。" }));
      return;
    }
    if (
      !window.confirm(
        `以下の予約を講師都合でキャンセルします。よろしいですか？\n\n` +
          `${res.name} 様 / ${res.lessonCourse}\n${res.lessonDate} ${res.lessonTime}\n\n` +
          `生徒には理由を添えてメールでお知らせします。この操作は取り消せません。`
      )
    ) {
      return;
    }

    setCancellingId(res.id);
    setCancelMessage((prev) => ({ ...prev, [res.id]: "" }));
    try {
      const callable = httpsCallable<
        { reservationId: string; reason: string },
        { ok: boolean; message: string }
      >(functions, "teacherCancelReservation");
      const result = await callable({ reservationId: res.id, reason });

      setReservations((prev) =>
        prev.map((r) =>
          r.id === res.id
            ? { ...r, reservationStatus: "cancelled", cancelledBy: "teacher", cancelReason: reason }
            : r
        )
      );
      setCancelOpenId(null);
      setCancelReason("");
      setCancelMessage((prev) => ({
        ...prev,
        [res.id]: result.data?.message || "予約をキャンセルしました。",
      }));
    } catch (err: any) {
      console.error("講師都合キャンセルに失敗:", err);
      setCancelMessage((prev) => ({
        ...prev,
        [res.id]: err?.message || "キャンセルに失敗しました。時間をおいて再度お試しください。",
      }));
    } finally {
      setCancellingId(null);
    }
  };

  const handleSaveMeetingUrl = async (reservationId: string) => {
    const value = (urlDrafts[reservationId] ?? "").trim();
    setSavingUrlId(reservationId);
    setUrlMessage((prev) => ({ ...prev, [reservationId]: "" }));

    try {
      const callable = httpsCallable<
        { reservationId: string; meetingUrl: string },
        { ok: boolean; message: string }
      >(functions, "setMeetingUrl");
      const res = await callable({ reservationId, meetingUrl: value });

      setReservations((prev) =>
        prev.map((r) => (r.id === reservationId ? { ...r, meetingUrl: value } : r))
      );
      setUrlMessage((prev) => ({
        ...prev,
        [reservationId]: res.data?.message || "保存しました。",
      }));
    } catch (err: any) {
      console.error("参加URLの保存に失敗:", err);
      setUrlMessage((prev) => ({
        ...prev,
        [reservationId]: err?.message || "保存に失敗しました。",
      }));
    } finally {
      setSavingUrlId(null);
    }
  };

  useEffect(() => {
    if (!user) return;

    const fetchReservations = async () => {
      try {
        setLoading(true);
        setError("");

        // orderBy を付けると複合インデックスが必要になるため、取得後にソートする
        const q = query(
          collection(db, "reservations"),
          where("teacherId", "==", user.uid)
        );
        // 手数料明細は別コレクション（生徒からは読めない）。予約 ID で突き合わせる。
        const payoutQ = query(
          collection(db, "reservationPayouts"),
          where("teacherId", "==", user.uid)
        );
        // 講師都合キャンセルで差し引く決済手数料
        const cancellationQ = query(
          collection(db, "teacherCancellations"),
          where("teacherId", "==", user.uid)
        );
        const [querySnapshot, payoutSnapshot, cancellationSnapshot] = await Promise.all([
          getDocs(q),
          getDocs(payoutQ),
          getDocs(cancellationQ),
        ]);

        const feeMap = new Map<string, CancellationFee>();
        for (const c of cancellationSnapshot.docs) {
          const v = c.data();
          feeMap.set(c.id, {
            stripeFee: typeof v.stripeFee === "number" ? v.stripeFee : 0,
            stripeFeeEstimated: v.stripeFeeEstimated === true,
            settled: v.settled === true,
          });
        }
        setFees(feeMap);

        const payouts = new Map<string, { rate: number; payout: number }>();
        for (const p of payoutSnapshot.docs) {
          const v = p.data();
          if (
            typeof v.commissionRate === "number" &&
            typeof v.teacherPayout === "number"
          ) {
            payouts.set(p.id, { rate: v.commissionRate, payout: v.teacherPayout });
          }
        }

        const data: Reservation[] = querySnapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            userId: typeof d.userId === "string" ? d.userId : "",
            name: typeof d.name === "string" ? d.name : "",
            furigana: typeof d.furigana === "string" ? d.furigana : "",
            email: typeof d.email === "string" ? d.email : "",
            phone: typeof d.phone === "string" ? d.phone : "",
            lessonCourse: typeof d.lessonCourse === "string" ? d.lessonCourse : "",
            lessonDate: typeof d.lessonDate === "string" ? d.lessonDate : "",
            lessonTime: typeof d.lessonTime === "string" ? d.lessonTime : "",
            lessonType: typeof d.lessonType === "string" ? d.lessonType : "",
            location: typeof d.location === "string" ? d.location : "",
            meetingUrl: typeof d.meetingUrl === "string" ? d.meetingUrl : "",
            lessonAmount:
              typeof d.lessonAmount === "number" ? d.lessonAmount : null,
            paymentStatus:
              typeof d.paymentStatus === "string" ? d.paymentStatus : "",
            reservationStatus:
              typeof d.reservationStatus === "string" ? d.reservationStatus : "",
            commissionRate: payouts.get(docSnap.id)?.rate ?? null,
            teacherPayout: payouts.get(docSnap.id)?.payout ?? null,
            notes: typeof d.notes === "string" ? d.notes : "",
            cancelledBy: typeof d.cancelledBy === "string" ? d.cancelledBy : "",
            cancelReason: typeof d.cancelReason === "string" ? d.cancelReason : "",
          };
        });

        // 日付＋時間の降順（新しい予約が先頭）
        data.sort((a, b) =>
          `${b.lessonDate} ${b.lessonTime}`.localeCompare(
            `${a.lessonDate} ${a.lessonTime}`
          )
        );

        setReservations(data);
      } catch (err) {
        console.error("予約取得エラー:", err);
        setError("予約一覧の取得に失敗しました。時間をおいて再度お試しください。");
      } finally {
        setLoading(false);
      }
    };

    fetchReservations();
  }, [user]);

  // 生徒ごとの受講回数と、次の割引までの残り回数
  const studentProgress = useMemo(() => {
    const byStudent = new Map<string, { name: string; count: number }>();
    for (const r of reservations) {
      if (r.paymentStatus !== "paid" || !r.userId) continue;
      const cur = byStudent.get(r.userId) ?? { name: r.name, count: 0 };
      cur.count += 1;
      if (r.name) cur.name = r.name;
      byStudent.set(r.userId, cur);
    }
    return [...byStudent.entries()]
      .map(([userId, v]) => ({
        userId,
        name: v.name || "（氏名不明）",
        progress: tierProgress(v.count),
      }))
      .sort((a, b) => b.progress.count - a.progress.count);
  }, [reservations]);

  return (
    <main className="about-section fade-in-up">
      <h2 className="centered-heading-with-border">
        <span>予約一覧（講師用）</span>
      </h2>

      <div style={{ maxWidth: "720px", margin: "2rem auto" }}>
        {!loading && !error && studentProgress.length > 0 && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "20px",
              marginBottom: "24px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>継続レッスンによる手数料の割引</h3>
            <p style={{ color: "#8a8270", fontSize: "0.9rem" }}>
              同じ生徒さんへのレッスンが積み重なるほど、運営手数料が下がり、
              先生のお受け取りが増えます（10回で15%、50回で10%）。
              回数は成立したレッスンのみを数えます。
            </p>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>生徒</th>
                  <th className="num">受講回数</th>
                  <th className="num">現在の手数料</th>
                  <th>次の割引まで</th>
                </tr>
              </thead>
              <tbody>
                {studentProgress.map((s) => (
                  <tr key={s.userId}>
                    <td>{s.name}</td>
                    <td className="num">{s.progress.count}回</td>
                    <td className="num">{Math.round(s.progress.rate * 100)}%</td>
                    <td>
                      {s.progress.remaining != null && s.progress.nextRate != null
                        ? `あと${s.progress.remaining}回で ${Math.round(
                            s.progress.nextRate * 100
                          )}%`
                        : "最大割引に到達"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: "center" }}>読み込み中...</p>
        ) : error ? (
          <p style={{ textAlign: "center", color: "#c62828" }}>{error}</p>
        ) : reservations.length === 0 ? (
          <p style={{ textAlign: "center" }}>予約はまだありません。</p>
        ) : (
          reservations.map((res) => (
            <div
              key={res.id}
              style={{
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: "10px",
                padding: "20px",
                marginBottom: "16px",
              }}
            >
              <div className="form-group">
                <p>
                  <strong>生徒氏名：</strong>
                  {res.name}
                  {res.furigana && `（${res.furigana}）`}
                </p>
                <p>
                  <strong>連絡先：</strong>
                  {res.email}
                  {res.phone && ` / ${res.phone}`}
                </p>
                <p>
                  <strong>レッスンコース：</strong>
                  {res.lessonCourse}
                </p>
                <p>
                  <strong>日時：</strong>
                  {res.lessonDate} {res.lessonTime}
                </p>
                <p>
                  <strong>場所：</strong>
                  {res.location}
                </p>
                <p>
                  <strong>料金：</strong>
                  {typeof res.lessonAmount === "number"
                    ? `${res.lessonAmount.toLocaleString()}円`
                    : "―"}
                </p>
                {res.teacherPayout != null && res.commissionRate != null && (
                  <p>
                    <strong>お受け取り：</strong>
                    {res.teacherPayout.toLocaleString()}円
                    <span style={{ color: "#8a8270", fontSize: "0.85rem" }}>
                      （運営手数料 {Math.round(res.commissionRate * 100)}% を差引後）
                    </span>
                  </p>
                )}
                <p>
                  <strong>決済状態：</strong>
                  {statusLabel(PAYMENT_STATUS_LABELS, res.paymentStatus)}
                </p>
                <p>
                  <strong>予約状態：</strong>
                  {statusLabel(RESERVATION_STATUS_LABELS, res.reservationStatus)}
                </p>
                {res.notes && (
                  <p>
                    <strong>ご要望：</strong>
                    {res.notes}
                  </p>
                )}
                {res.reservationStatus === "cancelled" && res.cancelledBy === "teacher" && (
                  <>
                    <p>
                      <strong>キャンセル：</strong>
                      講師都合{res.cancelReason && `（理由：${res.cancelReason}）`}
                    </p>
                    {(fees.get(res.id)?.stripeFee ?? 0) > 0 && (
                      <p>
                        <strong>差し引く決済手数料：</strong>
                        {fees.get(res.id)!.stripeFee.toLocaleString()}円
                        {fees.get(res.id)!.stripeFeeEstimated && "（見積もり）"}
                        <span style={{ color: "#8a8270", fontSize: "0.85rem" }}>
                          {fees.get(res.id)!.settled
                            ? "（精算済み）"
                            : "（次回のお支払いから差し引きます）"}
                        </span>
                      </p>
                    )}
                  </>
                )}
              </div>

              {cancelMessage[res.id] && (
                <p style={{ fontSize: "0.9rem", margin: "0.5rem 0" }}>{cancelMessage[res.id]}</p>
              )}

              {canTeacherCancel(res) && (
                <div style={{ marginTop: 12 }}>
                  {cancelOpenId !== res.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCancelOpenId(res.id);
                        setCancelReason("");
                      }}
                      style={{
                        border: "none",
                        background: "none",
                        color: "#c62828",
                        cursor: "pointer",
                        padding: 0,
                        textDecoration: "underline",
                      }}
                    >
                      この予約を講師都合でキャンセルする
                    </button>
                  ) : (
                    <div
                      style={{
                        padding: "0.9rem",
                        border: "1px solid #e5c4c4",
                        borderRadius: 8,
                        background: "#fff8f8",
                      }}
                    >
                      <label htmlFor={`cancel-reason-${res.id}`} style={{ fontWeight: "bold" }}>
                        キャンセルの理由（生徒へのメールに記載されます）
                      </label>
                      <textarea
                        id={`cancel-reason-${res.id}`}
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        maxLength={500}
                        rows={3}
                        placeholder="例）体調不良のため"
                        style={{ width: "100%", marginTop: 6 }}
                      />
                      <p style={{ fontSize: "0.85rem", color: "#666", margin: "0.5rem 0" }}>
                        生徒への請求は発生せず、お支払い済みの場合は全額返金します。
                        {res.paymentStatus === "paid"
                          ? "この予約はお支払いが確定しているため、返金しても戻ってこない決済手数料（約3.6%）を先生のお受け取りから差し引きます。"
                          : "レッスン当日0時以降（お支払い確定後）のキャンセルは、戻ってこない決済手数料（約3.6%）を先生のお受け取りから差し引きます。"}
                      </p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="form-button"
                          onClick={() => handleTeacherCancel(res)}
                          disabled={cancellingId === res.id}
                        >
                          {cancellingId === res.id ? "キャンセル処理中..." : "キャンセルを確定する"}
                        </button>
                        <button
                          type="button"
                          className="form-button"
                          onClick={() => setCancelOpenId(null)}
                          disabled={cancellingId === res.id}
                        >
                          やめる
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {res.lessonType === "オンライン" &&
                res.reservationStatus !== "cancelled" && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "0.9rem",
                      border: "1px solid #ddd",
                      borderRadius: 8,
                      background: "#fafafa",
                    }}
                  >
                    <label
                      htmlFor={`meeting-url-${res.id}`}
                      style={{ fontWeight: "bold" }}
                    >
                      オンラインレッスンの参加URL
                    </label>
                    <p
                      style={{
                        fontSize: "0.85rem",
                        color: "#666",
                        margin: "0.25rem 0 0.5rem",
                      }}
                    >
                      Zoom・Google Meet などの会議URLを登録すると、生徒のマイページと
                      前日のリマインドメールに表示されます。
                    </p>
                    <input
                      id={`meeting-url-${res.id}`}
                      type="url"
                      value={urlDrafts[res.id] ?? res.meetingUrl}
                      onChange={(e) =>
                        setUrlDrafts((prev) => ({
                          ...prev,
                          [res.id]: e.target.value,
                        }))
                      }
                      placeholder="https://us02web.zoom.us/j/..."
                      maxLength={500}
                      style={{ width: "100%" }}
                    />
                    <button
                      type="button"
                      className="form-button"
                      onClick={() => handleSaveMeetingUrl(res.id)}
                      disabled={savingUrlId === res.id}
                      style={{ marginTop: 8 }}
                    >
                      {savingUrlId === res.id ? "保存中..." : "URLを保存"}
                    </button>
                    {urlMessage[res.id] && (
                      <p style={{ fontSize: "0.85rem", margin: "0.5rem 0 0" }}>
                        {urlMessage[res.id]}
                      </p>
                    )}
                    {!res.meetingUrl && (
                      <p
                        style={{
                          fontSize: "0.85rem",
                          color: "#c62828",
                          margin: "0.5rem 0 0",
                        }}
                      >
                        まだ登録されていません。レッスン前日までにご登録ください。
                      </p>
                    )}
                  </div>
                )}
            </div>
          ))
        )}

        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            marginTop: "2rem",
            justifyContent: "center",
          }}
        >
          <Link to="/mypage" className="form-button">
            マイページへ戻る
          </Link>
        </div>
      </div>
    </main>
  );
};

export default TeacherReservations;
