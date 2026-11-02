// 講師プロフィールとコースのデータ層（Firestore の teacherProfiles コレクション）。
//
// もともと講師データは src/data/teachers.ts に静的に持っていたが、
// 講師が自分でコースを作れるようにするため Firestore へ移した。
// 静的ファイルは移行用のシードとしてのみ残している。
//
// 表示に使ってよいのは published が true のものだけ。講師が編集しただけでは
// 公開されず、運営が公開操作をして初めてサイトに出る（事故の防止）。
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';

export const TEACHER_PROFILES = 'teacherProfiles';

/** レッスンの実施方法。オンラインは会場を持たない */
export type LessonType = '自宅' | 'スタジオ' | '出張' | 'オンライン';

/**
 * レッスン料の下限。
 *
 * 手数料が逓減制（18%→15%→10%）のため、極端に安い設定をされると
 * 手数料が運営コストを下回る。金額は自由入力にするが、ここだけは守らせる。
 */
export const MIN_LESSON_PRICE = 3000;

/**
 * 出張可能な範囲の選択肢。
 * 自由入力にすると表記が揺れて生徒が比較できないため、選択式にしている。
 */
export const TRAVEL_RANGES = [
  '自宅から15分以内',
  '自宅から30分以内',
  '自宅から1時間以内',
  '自宅から5km以内',
  '自宅から10km以内',
  '自宅から20km以内',
];

/**
 * 区ごとの出張費（東京23区）。
 * 講師は「基本のレッスン料＋区ごとの出張費」で料金を決められる。対象は出張と
 * スタジオのレッスン（出張は生徒が選んだ区、スタジオはスタジオの所在区で判定）。
 * areaFees が空なら機能は使っていない扱いで出張費は 0 円。設定があれば、
 * 設定した区だけが対応エリアになる。functions/src/areaFees.ts と内容を揃えること。
 */
export const TOKYO_WARDS = [
  '千代田区', '中央区', '港区', '新宿区', '文京区', '台東区', '墨田区', '江東区',
  '品川区', '目黒区', '大田区', '世田谷区', '渋谷区', '中野区', '杉並区', '豊島区',
  '北区', '荒川区', '板橋区', '練馬区', '足立区', '葛飾区', '江戸川区',
];

/** 出張費を取るレッスン方法 */
export const AREA_FEE_LESSON_TYPES: LessonType[] = ['出張', 'スタジオ'];

/** 出張費の上限。サーバー側の MAX_AREA_FEE と揃えること */
export const MAX_AREA_FEE = 20000;

/** 区ごとの出張費を設定しているか */
export function hasAreaFees(teacher: Pick<TeacherProfile, 'areaFees'>): boolean {
  return !!teacher.areaFees && Object.keys(teacher.areaFees).length > 0;
}

/**
 * その区の出張費。区ごとの設定が無い講師は 0、対応エリア外なら null（予約不可）。
 */
export function areaFeeFor(
  teacher: Pick<TeacherProfile, 'areaFees'>,
  ward: string
): number | null {
  if (!hasAreaFees(teacher)) return 0;
  const fees = teacher.areaFees as Record<string, number>;
  return Object.prototype.hasOwnProperty.call(fees, ward) ? fees[ward] : null;
}

/** 自動追加されるオンラインコースの既定料金 */
export const DEFAULT_ONLINE_LESSON_PRICE = 5000;

export interface LessonCourse {
  type: LessonType;
  title: string;
  /** 円。表示は formatPrice を通す */
  price: number;
  note?: string;
  locationDisplay?: string;
  /** 体験レッスンか。true のコースは生徒1人につき1回まで */
  isTrial?: boolean;
}

/** 公開状態。draft と pending はサイトに出ない */
// withdrawn は講師の退会（functions/src/accountDeletion.ts）で付く。再公開はできない
export type TeacherStatus = 'draft' | 'pending' | 'published' | 'withdrawn';

export interface TeacherProfile {
  /** ドキュメントID。講師詳細ページ（/teachers/:id）の URL に使うスラッグ */
  id: string;
  /** Firebase Auth の UID。予約・スケジュールはこれをキーに動く */
  authUid: string;
  name: string;
  furigana: string;
  prefecture: string;
  city: string;
  genres: string[];
  tags?: string[];
  profile: string;
  photo: string;
  courses: LessonCourse[];
  /** オンライン対応可なら、オンラインコースを自動で足す（getCourses 参照） */
  onlineAvailable?: boolean;
  onlineLessonPrice?: number;
  /** 出張可能な範囲。出張コースがある場合に講師詳細ページで案内する */
  travelRange?: string;
  /** 区ごとの出張費（東京23区）。空なら使わない（areaFeeFor 参照） */
  areaFees?: Record<string, number>;
  /** 自宅コースがある講師の町名（番地は含まない）。予約画面の「講師のご自宅（…）」に使う */
  homeTown?: string;
  /** サイトに出てよいか。運営の公開操作でのみ true になる */
  published: boolean;
  status: TeacherStatus;
}

/** 表示用の金額文字列（例: 6,000円） */
export function formatPrice(price: number): string {
  return `${price.toLocaleString()}円`;
}

/** 自動追加されるオンラインコースの内容。会場がないため locationDisplay を持たない */
function buildOnlineCourse(teacher: TeacherProfile): LessonCourse {
  return {
    type: 'オンライン',
    title: 'オンラインレッスン（60分）',
    price: teacher.onlineLessonPrice || DEFAULT_ONLINE_LESSON_PRICE,
    note: 'ビデオ通話で実施します。参加URLは予約確定後にご案内します。',
  };
}

/**
 * 表示・予約に使うコース一覧。
 *
 * courses をそのまま読まずに必ずこの関数を通すこと。
 * onlineAvailable が true の講師にはオンラインコースをここで足している。
 * ただし courses にオンラインを明示している場合はそちらを優先する
 * （料金を個別に決めている講師の設定を上書きしないため）。
 */
export function getCourses(teacher: TeacherProfile): LessonCourse[] {
  if (!teacher.onlineAvailable) return teacher.courses;
  if (teacher.courses.some((c) => c.type === 'オンライン')) return teacher.courses;
  return [...teacher.courses, buildOnlineCourse(teacher)];
}

/** コース最安値の表示（例: 4,000円〜）。コースが無ければ null */
export function minCoursePriceLabel(teacher: TeacherProfile): string | null {
  const prices = getCourses(teacher)
    .map((c) => c.price)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (prices.length === 0) return null;
  return `${Math.min(...prices).toLocaleString()}円〜`;
}

/** Firestore の areaFees を整える。23区以外のキーや数値でない値は捨てる */
function toAreaFees(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  // 表示順をそろえるため、TOKYO_WARDS の並びで詰め直す
  const src = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const ward of TOKYO_WARDS) {
    const fee = src[ward];
    if (typeof fee === 'number' && Number.isFinite(fee)) out[ward] = fee;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Firestore のドキュメントを TeacherProfile に整える。欠けている項目は既定値で埋める */
export function toTeacherProfile(id: string, d: Record<string, unknown>): TeacherProfile {
  const courses = Array.isArray(d.courses) ? d.courses : [];
  return {
    id,
    authUid: typeof d.authUid === 'string' ? d.authUid : '',
    name: typeof d.name === 'string' ? d.name : '',
    furigana: typeof d.furigana === 'string' ? d.furigana : '',
    prefecture: typeof d.prefecture === 'string' ? d.prefecture : '',
    city: typeof d.city === 'string' ? d.city : '',
    genres: Array.isArray(d.genres) ? (d.genres as string[]) : [],
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : [],
    profile: typeof d.profile === 'string' ? d.profile : '',
    photo: typeof d.photo === 'string' ? d.photo : '',
    courses: courses.map((c) => {
      const course = c as Record<string, unknown>;
      return {
        type: (course.type as LessonType) || '自宅',
        title: typeof course.title === 'string' ? course.title : '',
        // 旧データが文字列（"6,000円"）で入っている場合に備えて数値へ寄せる
        price:
          typeof course.price === 'number'
            ? course.price
            : parseInt(String(course.price ?? '').replace(/[^0-9]/g, ''), 10) || 0,
        note: typeof course.note === 'string' ? course.note : undefined,
        locationDisplay:
          typeof course.locationDisplay === 'string'
            ? course.locationDisplay
            : undefined,
        isTrial: course.isTrial === true,
      };
    }),
    onlineAvailable: d.onlineAvailable === true,
    onlineLessonPrice:
      typeof d.onlineLessonPrice === 'number' ? d.onlineLessonPrice : undefined,
    travelRange: typeof d.travelRange === 'string' ? d.travelRange : undefined,
    homeTown: typeof d.homeTown === 'string' ? d.homeTown : undefined,
    areaFees: toAreaFees(d.areaFees),
    published: d.published === true,
    status: (d.status as TeacherStatus) || 'draft',
  };
}

/**
 * 公開中の講師をすべて取得する。
 *
 * 絞り込みは published の等価条件のみ。範囲条件を混ぜると複合インデックスが
 * 必要になるため、並べ替えは取得後にメモリ上で行う。
 */
export async function fetchPublishedTeachers(): Promise<TeacherProfile[]> {
  const q = query(collection(db, TEACHER_PROFILES), where('published', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toTeacherProfile(d.id, d.data()));
}

/** 運営用。未公開も含めて全件取得する */
export async function fetchAllTeachers(): Promise<TeacherProfile[]> {
  const snap = await getDocs(collection(db, TEACHER_PROFILES));
  return snap.docs.map((d) => toTeacherProfile(d.id, d.data()));
}

/**
 * ログイン中の講師自身のプロフィールを取得する。
 * 未公開でも本人なら読めるよう firestore.rules で許可している。
 */
export async function fetchMyTeacherProfile(
  uid: string
): Promise<TeacherProfile | null> {
  const q = query(collection(db, TEACHER_PROFILES), where('authUid', '==', uid));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return toTeacherProfile(d.id, d.data());
}

/** 1件取得。見つからなければ null */
export async function fetchTeacher(id: string): Promise<TeacherProfile | null> {
  const snap = await getDoc(doc(db, TEACHER_PROFILES, id));
  if (!snap.exists()) return null;
  return toTeacherProfile(snap.id, snap.data());
}
