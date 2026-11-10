// 区ごとの出張費（東京23区）。
//
// 講師は「基本のレッスン料＋区ごとの出張費」で料金を決められる。対象は会場が
// 講師の自宅以外になる出張とスタジオのレッスン（出張は生徒が選んだ区、
// スタジオはスタジオの所在区で判定する）。
//
// teacherProfiles.areaFees が空なら機能は使っていない扱いで、どこでも出張費 0 円。
// 1件でも設定があれば、設定した区だけを対応エリアとし、それ以外は予約を受け付けない。
// フロントの src/lib/teacherProfiles.ts と内容を揃えること。

export const TOKYO_WARDS = [
  "千代田区", "中央区", "港区", "新宿区", "文京区", "台東区", "墨田区", "江東区",
  "品川区", "目黒区", "大田区", "世田谷区", "渋谷区", "中野区", "杉並区", "豊島区",
  "北区", "荒川区", "板橋区", "練馬区", "足立区", "葛飾区", "江戸川区",
];

/** 出張費を取るレッスン方法 */
export const AREA_FEE_LESSON_TYPES = ["出張", "スタジオ"];

/** 出張費の上限。桁の打ち間違いを止める */
export const MAX_AREA_FEE = 20000;

export type AreaFees = Record<string, number>;

/** 保存用に整える。23区以外のキー・不正な金額は捨てる（範囲外の金額はエラー） */
export function sanitizeAreaFees(raw: unknown): AreaFees {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: AreaFees = {};
  for (const [ward, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!TOKYO_WARDS.includes(ward)) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const fee = Math.floor(value);
    if (fee < 0 || fee > MAX_AREA_FEE) {
      throw new Error(
        `${ward}の出張費は0円以上${MAX_AREA_FEE.toLocaleString()}円以下で設定してください。`
      );
    }
    out[ward] = fee;
  }
  return out;
}

/** Firestore から読んだ値を AreaFees に寄せる（壊れた値は無視） */
export function readAreaFees(raw: unknown): AreaFees {
  try {
    return sanitizeAreaFees(raw);
  } catch {
    return {};
  }
}

/**
 * その区の出張費。
 * 機能を使っていない講師は 0、対応エリア外なら null（＝予約不可）。
 */
export function areaFeeFor(areaFees: AreaFees, ward: string): number | null {
  if (Object.keys(areaFees).length === 0) return 0;
  return Object.prototype.hasOwnProperty.call(areaFees, ward) ? areaFees[ward] : null;
}
