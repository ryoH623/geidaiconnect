// src/lib/age.ts
// 生年月日の妥当性チェックと年齢計算。
// 会員登録・プロフィール編集・管理画面で同じ判定を使うため共通化する。

/** users/{uid}.birthday の形。セレクトの値をそのまま入れるため文字列で保持する */
export interface Birthday {
  year: string;
  month: string;
  day: string;
}

/** 成年年齢（民法上、2022年4月から18歳） */
export const ADULT_AGE = 18;

/**
 * 実在する日付かどうか。
 * 2月31日のような組み合わせは Date が翌月に繰り上げるため、
 * 生成後の年月日が入力と一致するかで判定する。
 */
export function isRealDate(year: string, month: string, day: string): boolean {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return false;
  }
  const date = new Date(y, m - 1, d);
  return (
    date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
  );
}

/** 生年月日として妥当か（実在する日付、かつ未来でない） */
export function isValidBirthday(
  year: string,
  month: string,
  day: string,
  now: Date = new Date()
): boolean {
  if (!year || !month || !day) return false;
  if (!isRealDate(year, month, day)) return false;
  return new Date(Number(year), Number(month) - 1, Number(day)) <= now;
}

/** 満年齢。生年月日が不正なら null */
export function calcAge(
  birthday: Birthday | null | undefined,
  now: Date = new Date()
): number | null {
  if (!birthday) return null;
  const { year, month, day } = birthday;
  if (!isValidBirthday(year, month, day, now)) return null;

  let age = now.getFullYear() - Number(year);
  const beforeBirthdayThisYear =
    now.getMonth() + 1 < Number(month) ||
    (now.getMonth() + 1 === Number(month) && now.getDate() < Number(day));
  if (beforeBirthdayThisYear) age -= 1;
  return age;
}

/** 未成年か。生年月日が不明・不正な場合は false（判定できないものを未成年扱いしない） */
export function isMinor(
  birthday: Birthday | null | undefined,
  now: Date = new Date()
): boolean {
  const age = calcAge(birthday, now);
  return age !== null && age < ADULT_AGE;
}
