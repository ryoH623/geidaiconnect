// 管理画面の予約一覧・予約詳細で共通に使う、状態の表示名と色・日付の表示。
import React from "react";

// [表示名, バッジの色]
export const PAYMENT_STATUS: Record<string, [string, string]> = {
  pending_payment: ["決済待ち", "gray"],
  authorized: ["カード確保済み", "blue"],
  paid: ["支払済み", "green"],
  refunded: ["返金済み", "gray"],
  voided: ["与信取消", "gray"],
  refund_failed: ["返金失敗・要対応", "red"],
  payment_failed: ["決済失敗", "red"],
  expired: ["期限切れ", "gray"],
};

export const RESERVATION_STATUS: Record<string, [string, string]> = {
  pending: ["確定待ち", "amber"],
  confirmed: ["確定", "green"],
  cancelled: ["キャンセル", "red"],
  expired: ["期限切れ", "gray"],
};

export const CANCELLED_BY_LABELS: Record<string, string> = {
  student: "生徒都合",
  teacher: "講師都合",
  operator: "運営による取消",
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

/** "YYYY-MM-DD" → "2026/11/12（木）" */
export function formatLessonDate(date: string): string {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return date || "―";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${m[1]}/${Number(m[2])}/${Number(m[3])}（${WEEKDAYS[d.getDay()]}）`;
}

/** 日本時間の今日（YYYY-MM-DD） */
export function todayJst(): string {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export const StatusBadge: React.FC<{
  map: Record<string, [string, string]>;
  value: string;
}> = ({ map, value }) => {
  const [label, color] = map[value] || [value || "不明", "gray"];
  return <span className={`status-badge status-badge--${color}`}>{label}</span>;
};
