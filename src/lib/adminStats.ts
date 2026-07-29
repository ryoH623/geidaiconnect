// 管理ダッシュボード用の集計ロジック（純粋関数）。
import type { Birthday } from "./age";

// 「売上」の定義: GMV = 支払済み(paid)予約の lessonAmount 合計、
//   手数料(運営の取り分) = GMV × COMMISSION_RATE。計上は lessonDate（レッスン実施日）基準。

/** 運営の手数料率（GMV に対する割合）。変更する場合はここを直す。 */
export const COMMISSION_RATE = 0.18;

export interface ReservationLite {
  id: string;
  userId: string;
  teacherId: string;
  teacherName: string;
  studentName: string;
  lessonCourse: string;
  lessonAmount: number;
  lessonDate: string; // "YYYY-MM-DD"
  paymentStatus: string;
  reservationStatus: string;
}

export interface UserLite {
  id: string;
  displayName: string;
  email: string;
  role: string;
  phone: string;
  createdAtMs: number | null;
  /** 生年月日。年齢・未成年判定に使う（未入力なら null） */
  birthday: Birthday | null;
  /** 未成年の場合に登録される保護者（法定代理人）情報 */
  guardian: {
    name: string;
    nameKana: string;
    relationship: string;
    phone: string;
  } | null;
}

export interface ReviewLite {
  teacherId: string;
  rating: number;
}

/** 売上として計上する予約か（カード決済が確定済み）。 */
export function isPaid(r: ReservationLite): boolean {
  return r.paymentStatus === "paid";
}

/** GMV から運営手数料を算出（円未満切り捨て）。 */
export function commissionOf(gmv: number): number {
  return Math.floor(gmv * COMMISSION_RATE);
}

/** "YYYY-MM-DD" → "YYYY-MM"。不正な値は空文字。 */
export function monthKey(dateStr: string): string {
  return /^\d{4}-\d{2}/.test(dateStr) ? dateStr.slice(0, 7) : "";
}

export function yen(n: number): string {
  return `${Math.round(n).toLocaleString("ja-JP")}円`;
}

export interface MonthlyRevenue {
  month: string; // "YYYY-MM"
  gmv: number;
  commission: number;
  count: number;
}

/** 支払済み予約を lessonDate の月ごとに集計（月キー昇順）。 */
export function aggregateMonthlyRevenue(
  reservations: ReservationLite[]
): MonthlyRevenue[] {
  const map = new Map<string, { gmv: number; count: number }>();
  for (const r of reservations) {
    if (!isPaid(r)) continue;
    const m = monthKey(r.lessonDate);
    if (!m) continue;
    const cur = map.get(m) ?? { gmv: 0, count: 0 };
    cur.gmv += r.lessonAmount;
    cur.count += 1;
    map.set(m, cur);
  }
  return [...map.entries()]
    .map(([month, v]) => ({
      month,
      gmv: v.gmv,
      commission: commissionOf(v.gmv),
      count: v.count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** 指定年の 12 か月ぶんに整形（データが無い月は 0 埋め）。ラベルは "M月"。 */
export function toYearSeries(
  monthly: MonthlyRevenue[],
  year: number
): (MonthlyRevenue & { label: string })[] {
  const byMonth = new Map(monthly.map((m) => [m.month, m]));
  return Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const key = `${year}-${mm}`;
    const hit = byMonth.get(key);
    return {
      month: key,
      label: `${i + 1}月`,
      gmv: hit?.gmv ?? 0,
      commission: hit?.commission ?? 0,
      count: hit?.count ?? 0,
    };
  });
}

export interface MonthlyCount {
  month: string;
  count: number;
  label: string;
}

/** 指定ロールのユーザーを createdAt の月ごとに集計し、指定年の 12 か月へ整形。 */
export function newUsersYearSeries(
  users: UserLite[],
  role: string,
  year: number
): MonthlyCount[] {
  const map = new Map<string, number>();
  for (const u of users) {
    if (u.role !== role || u.createdAtMs == null) continue;
    const d = new Date(u.createdAtMs);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const key = `${year}-${mm}`;
    return { month: key, label: `${i + 1}月`, count: map.get(key) ?? 0 };
  });
}

export interface TeacherStat {
  teacherId: string;
  name: string;
  gmv: number;
  commission: number;
  paidCount: number;
  avgRating: number | null;
  reviewCount: number;
}

/** 講師ごとの売上・予約数・レビュー平均を集計（GMV 降順）。 */
export function perTeacherStats(
  teachers: UserLite[],
  reservations: ReservationLite[],
  reviews: ReviewLite[]
): TeacherStat[] {
  const rev = new Map<string, { gmv: number; count: number }>();
  for (const r of reservations) {
    if (!isPaid(r)) continue;
    const cur = rev.get(r.teacherId) ?? { gmv: 0, count: 0 };
    cur.gmv += r.lessonAmount;
    cur.count += 1;
    rev.set(r.teacherId, cur);
  }
  const rat = new Map<string, { sum: number; n: number }>();
  for (const rv of reviews) {
    if (!rv.teacherId || typeof rv.rating !== "number") continue;
    const cur = rat.get(rv.teacherId) ?? { sum: 0, n: 0 };
    cur.sum += rv.rating;
    cur.n += 1;
    rat.set(rv.teacherId, cur);
  }
  return teachers
    .map((t) => {
      const rv = rev.get(t.id) ?? { gmv: 0, count: 0 };
      const rt = rat.get(t.id);
      return {
        teacherId: t.id,
        name: t.displayName || t.email || t.id,
        gmv: rv.gmv,
        commission: commissionOf(rv.gmv),
        paidCount: rv.count,
        avgRating: rt ? rt.sum / rt.n : null,
        reviewCount: rt?.n ?? 0,
      };
    })
    .sort((a, b) => b.gmv - a.gmv);
}

export interface Kpis {
  gmv: number;
  commission: number;
  paidCount: number;
  newStudents: number;
  activeTeachers: number;
}

/** 指定月（"YYYY-MM"）の KPI。 */
export function monthKpis(
  reservations: ReservationLite[],
  users: UserLite[],
  ym: string
): Kpis {
  let gmv = 0;
  let paidCount = 0;
  const activeTeacherIds = new Set<string>();
  for (const r of reservations) {
    if (!isPaid(r) || monthKey(r.lessonDate) !== ym) continue;
    gmv += r.lessonAmount;
    paidCount += 1;
    if (r.teacherId) activeTeacherIds.add(r.teacherId);
  }
  let newStudents = 0;
  for (const u of users) {
    if (u.role !== "student" || u.createdAtMs == null) continue;
    const d = new Date(u.createdAtMs);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key === ym) newStudents += 1;
  }
  return {
    gmv,
    commission: commissionOf(gmv),
    paidCount,
    newStudents,
    activeTeachers: activeTeacherIds.size,
  };
}

export interface RateStats {
  total: number;
  confirmed: number;
  cancelled: number;
  confirmRate: number; // 0..1
  cancelRate: number; // 0..1
  avgPrice: number; // 客単価（paid の平均 lessonAmount）
}

/** 成約率・キャンセル率・客単価（全期間）。 */
export function rateStats(reservations: ReservationLite[]): RateStats {
  const total = reservations.length;
  let confirmed = 0;
  let cancelled = 0;
  let paidSum = 0;
  let paidCount = 0;
  for (const r of reservations) {
    if (r.reservationStatus === "confirmed") confirmed += 1;
    if (r.reservationStatus === "cancelled") cancelled += 1;
    if (isPaid(r)) {
      paidSum += r.lessonAmount;
      paidCount += 1;
    }
  }
  return {
    total,
    confirmed,
    cancelled,
    confirmRate: total ? confirmed / total : 0,
    cancelRate: total ? cancelled / total : 0,
    avgPrice: paidCount ? paidSum / paidCount : 0,
  };
}

/** データ中に出現する年（lessonDate と createdAt）の降順リスト。年切替の選択肢に使う。 */
export function availableYears(
  reservations: ReservationLite[],
  users: UserLite[]
): number[] {
  const years = new Set<number>();
  for (const r of reservations) {
    const m = monthKey(r.lessonDate);
    if (m) years.add(Number(m.slice(0, 4)));
  }
  for (const u of users) {
    if (u.createdAtMs != null) years.add(new Date(u.createdAtMs).getFullYear());
  }
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
}
