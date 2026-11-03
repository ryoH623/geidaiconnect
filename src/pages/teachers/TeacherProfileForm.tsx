// src/pages/teachers/TeacherProfileForm.tsx
// 講師本人がプロフィールとレッスンコースを登録・編集する画面。
//
// 入力の手間を減らすため、決まった選択肢があるもの（レッスン形態・ジャンル・
// タグ・コース名）はすべて選択式にしている。自由入力にしているのは、
// 人によって必ず違う項目（料金・自己紹介・備考）だけ。
//
// 保存は callable（saveMyTeacherProfile）経由。published はここから変えられず、
// 公開するかどうかは運営が決める。
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { db, functions } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import {
  AREA_FEE_LESSON_TYPES,
  MAX_AREA_FEE,
  MIN_LESSON_PRICE,
  TOKYO_WARDS,
  TRAVEL_RANGES,
  fetchMyTeacherProfile,
  formatPrice,
  type LessonCourse,
  type LessonType,
  type TeacherProfile,
} from "../../lib/teacherProfiles";
import { useTownsWithCoords } from "../../hooks/useJapaneseAddresses";
import { WARD_OFFICE_COORDS, haversineKm } from "../../data/tokyoWards";

/** 距離から出張費を入れるときの段階（既定値）。上から順に、その距離以内ならその金額 */
const DEFAULT_FEE_TIERS = [
  { maxKm: "5", fee: "0" },
  { maxKm: "10", fee: "1000" },
  { maxKm: "15", fee: "2000" },
];
/** 段階の上限数 */
const MAX_FEE_TIERS = 5;

const LESSON_TYPES: LessonType[] = ["自宅", "スタジオ", "出張", "オンライン"];

/**
 * 講師カードに出せるタグ。アイコンを用意しているものだけを候補にする。
 * 増やすときは src/utils/tagIconMap.ts も必ず一緒に直すこと。
 */
const TAG_OPTIONS = [
  // 共通
  "初心者歓迎",
  "出張可",
  "体験レッスンあり",
  "オンライン対応",
  "子ども対応",
  "受験対応",
  // 音楽系
  "室内楽対応",
  "伴奏あり",
  "コンクール対応",
  // 美術系
  "デッサン指導",
  "ポートフォリオ添削",
  "画材貸出あり",
];

/**
 * コース名の候補。
 * 毎回自由に書いてもらうとページごとに表記が揺れるため、よく使う形を用意する。
 * 当てはまらない場合のために自由入力も残す。
 */
const COURSE_TITLE_OPTIONS = [
  "30分レッスン",
  "45分レッスン",
  "60分レッスン",
  "90分レッスン",
  "体験レッスン（30分）",
  "体験レッスン（60分）",
];

const STATUS_LABELS: Record<string, string> = {
  draft: "下書き",
  pending: "公開申請中",
  published: "公開中",
};

type CourseDraft = {
  type: LessonType;
  title: string;
  /** 入力途中は空文字を許すため文字列で持つ */
  price: string;
  note: string;
  locationDisplay: string;
  isTrial: boolean;
};

function toDraft(c: LessonCourse): CourseDraft {
  return {
    type: c.type,
    title: c.title,
    price: c.price ? String(c.price) : "",
    note: c.note || "",
    locationDisplay: c.locationDisplay || "",
    isTrial: c.isTrial === true,
  };
}

const emptyCourse: CourseDraft = {
  type: "自宅",
  title: "60分レッスン",
  price: "",
  note: "",
  locationDisplay: "",
  isTrial: false,
};

const TeacherProfileForm: React.FC = () => {
  const { user } = useAuth();

  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [name, setName] = useState("");
  const [furigana, setFurigana] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [city, setCity] = useState("");
  // 郵便番号と番地は users/{uid}（本人と運営だけが読める）に保存する。
  // teacherProfiles は公開中だと誰でも読めるため、自宅の番地を置くと外から見えてしまう。
  const [postalCode, setPostalCode] = useState("");
  const [town, setTown] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [zipSearching, setZipSearching] = useState(false);
  const [zipError, setZipError] = useState("");
  const [genres, setGenres] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [courses, setCourses] = useState<CourseDraft[]>([]);
  const [onlineAvailable, setOnlineAvailable] = useState(false);
  const [onlinePrice, setOnlinePrice] = useState("");
  const [travelRange, setTravelRange] = useState("");
  // 区ごとの出張費（東京23区）。入力中は文字列で持ち、対応しない区はキーごと消す
  const [areaFeeEnabled, setAreaFeeEnabled] = useState(false);
  const [areaFees, setAreaFees] = useState<Record<string, string>>({});
  // 距離から出張費を自動で入れるための段階。保存はせず、入れた結果（areaFees）だけを保存する
  const [feeTiers, setFeeTiers] = useState(DEFAULT_FEE_TIERS);
  // 最後の段階より遠い区の出張費。空なら対応しない
  const [farFee, setFarFee] = useState("");
  const [tierNotice, setTierNotice] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const p = await fetchMyTeacherProfile(user.uid);
        if (cancelled) return;

        if (!p) {
          setLoadError(
            "講師プロフィールが見つかりませんでした。運営にお問い合わせください。"
          );
          return;
        }

        setProfile(p);
        setName(p.name);
        // 郵便番号と番地は users 側にある（公開される teacherProfiles には置かない）
        try {
          const meSnap = await getDoc(doc(db, "users", user.uid));
          const me = meSnap.exists() ? meSnap.data() : {};
          if (!cancelled) {
            setPostalCode(String(me?.postalCode || ""));
            setTown(String(me?.address1 || ""));
            setAddressLine(String(me?.address2 || ""));
          }
        } catch (meErr) {
          console.error("会員情報の取得に失敗しました", meErr);
        }
        setFurigana(p.furigana);
        setPrefecture(p.prefecture);
        setCity(p.city);
        setGenres(p.genres);
        setTags(p.tags || []);
        setBio(p.profile);
        setCourses(p.courses.map(toDraft));
        setOnlineAvailable(p.onlineAvailable === true);
        setOnlinePrice(p.onlineLessonPrice ? String(p.onlineLessonPrice) : "");
        setTravelRange(p.travelRange || "");
        setAreaFeeEnabled(!!p.areaFees && Object.keys(p.areaFees).length > 0);
        setAreaFees(
          Object.fromEntries(
            Object.entries(p.areaFees || {}).map(([ward, fee]) => [ward, String(fee)])
          )
        );
      } catch (err) {
        console.error("プロフィールの取得に失敗しました", err);
        if (!cancelled) setLoadError("プロフィールの取得に失敗しました。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  /**
   * 郵便番号から住所を引く。会員登録・会員情報の画面と同じ zipcloud を使う。
   * 都道府県と市区町村は検索の絞り込みに使うため、ここで自動的に埋める。
   */
  const lookupPostalCode = async (code: string) => {
    const digits = code.replace(/[^0-9]/g, "");
    if (digits.length !== 7) return;

    try {
      setZipSearching(true);
      setZipError("");
      const res = await fetch(
        `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`
      );
      const data: any = await res.json();
      const hit = data?.results?.[0];
      if (!hit) {
        setZipError("この郵便番号の住所が見つかりませんでした。");
        return;
      }
      setPrefecture(hit.address1 || "");
      setCity(hit.address2 || "");
      setTown(hit.address3 || "");
    } catch (err) {
      console.error("住所の検索に失敗しました", err);
      setZipError("住所の検索に失敗しました。");
    } finally {
      setZipSearching(false);
    }
  };

  // 出張コースがある場合だけ、出張可能な範囲を聞く
  const hasTravelCourse = courses.some((c) => c.type === "出張");
  // 出張・スタジオのコースがある場合だけ、区ごとの出張費を設定できる
  const hasAreaFeeCourse = courses.some((c) =>
    AREA_FEE_LESSON_TYPES.includes(c.type)
  );
  // 距離の起点（講師の自宅の町名の代表座標）。区ごとの出張費を設定するときだけ読む
  const useAreaFeeTools = hasAreaFeeCourse && areaFeeEnabled;
  const { towns: baseTowns, loading: baseTownsLoading } = useTownsWithCoords(
    useAreaFeeTools ? prefecture : "",
    useAreaFeeTools ? city : ""
  );
  const baseCoords = useMemo(() => {
    const withCoords = baseTowns.filter(
      (t) => typeof t.lat === "number" && typeof t.lng === "number"
    );
    if (withCoords.length === 0) return null;
    // 郵便番号から入る町名（例: 桜新町）と住所データの町名（例: 桜新町一丁目）は
    // 表記がずれることがあるため、前方一致まで見る
    const name = town.trim();
    const hit =
      (name &&
        (withCoords.find((t) => t.name === name) ||
          withCoords.find((t) => t.name.startsWith(name) || name.startsWith(t.name)))) ||
      null;
    if (hit) return { lat: hit.lat as number, lng: hit.lng as number, label: `${city}${hit.name}` };
    // 町名が引けなければ市区町村の中心（町名の代表座標の平均）
    const lat = withCoords.reduce((sum, t) => sum + (t.lat as number), 0) / withCoords.length;
    const lng = withCoords.reduce((sum, t) => sum + (t.lng as number), 0) / withCoords.length;
    return { lat, lng, label: `${city}の中心` };
  }, [baseTowns, town, city]);

  // 各区の区役所までの直線距離(km)
  const wardDistances = useMemo(() => {
    if (!baseCoords) return {} as Record<string, number>;
    return Object.fromEntries(
      TOKYO_WARDS.map((w) => [w, haversineKm(baseCoords, WARD_OFFICE_COORDS[w])])
    ) as Record<string, number>;
  }, [baseCoords]);

  /** 段階の設定から23区の出張費を入れ直す */
  const applyFeeTiers = () => {
    setTierNotice("");
    if (!baseCoords) return;
    const tiers = feeTiers
      .map((t) => ({ maxKm: Number(t.maxKm), fee: Number(t.fee) }))
      .filter((t) => t.maxKm > 0 && Number.isFinite(t.maxKm));
    if (tiers.length === 0) {
      setTierNotice("距離と金額を1段以上入力してください。");
      return;
    }
    const invalid = [...tiers.map((t) => t.fee), ...(farFee.trim() ? [Number(farFee)] : [])].some(
      (fee) => !Number.isInteger(fee) || fee < 0 || fee > MAX_AREA_FEE
    );
    if (invalid) {
      setTierNotice(`金額は0円以上${formatPrice(MAX_AREA_FEE)}以下の整数で入力してください。`);
      return;
    }
    if (
      Object.keys(areaFees).length > 0 &&
      !window.confirm("いま入っている区ごとの出張費を、この設定で入れ直します。よろしいですか？")
    ) {
      return;
    }
    tiers.sort((a, b) => a.maxKm - b.maxKm);
    const next: Record<string, string> = {};
    for (const ward of TOKYO_WARDS) {
      const d = wardDistances[ward];
      const tier = tiers.find((t) => d <= t.maxKm);
      if (tier) next[ward] = String(tier.fee);
      else if (farFee.trim()) next[ward] = String(Number(farFee));
    }
    setAreaFees(next);
    setTierNotice(
      `${Object.keys(next).length}区に出張費を入れました。必要に応じて区ごとに直してから保存してください。`
    );
  };

  // 自宅コースがある場合だけ、会場になる自宅の番地までを必須にする
  const hasHomeCourse = courses.some((c) => c.type === "自宅");

  const toggleIn = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  const updateCourse = (index: number, patch: Partial<CourseDraft>) => {
    setCourses((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c))
    );
  };

  const toggleWard = (ward: string) => {
    setAreaFees((prev) => {
      const next = { ...prev };
      if (ward in next) delete next[ward];
      else next[ward] = "0";
      return next;
    });
  };

  const setAllWards = (on: boolean) => {
    setAreaFees((prev) =>
      on
        ? Object.fromEntries(TOKYO_WARDS.map((w) => [w, prev[w] ?? "0"]))
        : {}
    );
  };

  const addCourse = () => setCourses((prev) => [...prev, { ...emptyCourse }]);

  const removeCourse = (index: number) => {
    if (!window.confirm("このコースを削除します。よろしいですか？")) return;
    setCourses((prev) => prev.filter((_, i) => i !== index));
  };

  /** 送信前の確認。サーバー側でも同じ検証をしているが、先に気づけるようにする */
  const validate = (submit: boolean): string => {
    if (!name.trim()) return "お名前を入力してください。";

    for (let i = 0; i < courses.length; i += 1) {
      const c = courses[i];
      const label = `${i + 1}件目のコース`;
      if (!c.title.trim()) return `${label}: コース名を入力してください。`;
      const price = Number(c.price);
      if (!c.price.trim() || !Number.isFinite(price)) {
        return `${label}: 料金を入力してください。`;
      }
      if (price < MIN_LESSON_PRICE) {
        return `${label}: 料金は${formatPrice(MIN_LESSON_PRICE)}以上で設定してください。`;
      }
    }

    if (submit && courses.length === 0) {
      return "公開申請にはコースが1件以上必要です。";
    }
    if (hasAreaFeeCourse && areaFeeEnabled) {
      const wards = Object.keys(areaFees);
      if (wards.length === 0) {
        return "区ごとの出張費: 対応する区を1つ以上選んでください。";
      }
      for (const ward of wards) {
        const fee = Number(areaFees[ward]);
        if (
          areaFees[ward].trim() === "" ||
          !Number.isInteger(fee) ||
          fee < 0 ||
          fee > MAX_AREA_FEE
        ) {
          return `区ごとの出張費: ${ward}は0円以上${formatPrice(MAX_AREA_FEE)}以下で入力してください。`;
        }
      }
    }
    if (submit && hasTravelCourse && !travelRange) {
      return "出張レッスンのコースがあるため、出張可能な範囲を選択してください。";
    }
    if (submit && hasHomeCourse && (!/^\d{7}$/.test(postalCode) || !addressLine.trim())) {
      return "自宅レッスンのコースがあるため、郵便番号と番地・建物名を入力してください。";
    }
    return "";
  };

  const save = async (submit: boolean) => {
    setError("");
    setNotice("");

    const message = validate(submit);
    if (message) {
      setError(message);
      return;
    }

    if (
      submit &&
      !window.confirm(
        "この内容で公開を申請します。運営が確認したうえで公開します。よろしいですか？"
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      const callable = httpsCallable<
        Record<string, unknown>,
        { ok: boolean; teacherId: string; status: string }
      >(functions, "saveMyTeacherProfile");

      const res = await callable({
        name: name.trim(),
        furigana: furigana.trim(),
        prefecture,
        city,
        postalCode,
        town,
        addressLine,
        genres,
        tags,
        profile: bio.trim(),
        courses: courses.map((c) => ({
          type: c.type,
          title: c.title.trim(),
          price: Number(c.price),
          note: c.note.trim(),
          // オンラインは会場がないので送らない
          locationDisplay: c.type === "オンライン" ? "" : c.locationDisplay.trim(),
          isTrial: c.isTrial,
        })),
        travelRange: hasTravelCourse ? travelRange : "",
        // 使わない場合は空で送る（サーバー側で丸ごと置き換える）
        areaFees:
          hasAreaFeeCourse && areaFeeEnabled
            ? Object.fromEntries(
                Object.entries(areaFees).map(([ward, fee]) => [ward, Number(fee)])
              )
            : {},
        onlineAvailable,
        ...(onlineAvailable && onlinePrice.trim()
          ? { onlineLessonPrice: Number(onlinePrice) }
          : {}),
        submit,
      });

      setProfile((prev) =>
        prev ? { ...prev, status: res.data.status as TeacherProfile["status"] } : prev
      );
      setNotice(
        submit
          ? "公開を申請しました。運営が確認のうえ公開します。"
          : "保存しました。"
      );
    } catch (err: any) {
      console.error("保存に失敗しました", err);
      setError(err?.message || "保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="about-section fade-in-up">
        <p style={{ textAlign: "center", marginTop: "2rem" }}>読み込み中です…</p>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="about-section fade-in-up">
        <p style={{ textAlign: "center", marginTop: "2rem", color: "#c62828" }}>
          {loadError}
        </p>
      </main>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #ddd",
    // このプロジェクトには全体の box-sizing 指定が無い。
    // 付けないと width:100% に padding と border が加算されて右にはみ出す。
    boxSizing: "border-box",
    // ラベル内で改行させるため。inline 要素のままだと入力欄が見出しの右に並ぶ
    display: "block",
  };

  return (
    <main className="about-section fade-in-up">
      <h2 className="centered-heading-with-border heading-oneline">
        <span>プロフィール・コースの登録</span>
      </h2>

      <div style={{ maxWidth: "720px", margin: "2rem auto" }}>
        <p style={{ color: "#8a8270", lineHeight: 1.9 }}>
          現在の状態：
          <strong>{STATUS_LABELS[profile?.status || "draft"]}</strong>
          {profile?.published && "（サイトに掲載中）"}
          <br />
          入力後に「公開を申請する」を押すと、運営が確認したうえでサイトに掲載します。
          保存しただけでは掲載されません。
        </p>

        {/* 基本情報 */}
        <section style={{ marginTop: "2rem" }}>
          <h3>基本情報</h3>
          <div style={{ display: "grid", gap: 12 }}>
            <label>
              お名前
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
            </label>

            <label>
              ふりがな
              <input
                type="text"
                value={furigana}
                onChange={(e) => setFurigana(e.target.value)}
                style={inputStyle}
              />
            </label>

            <label>
              郵便番号
              <input
                type="text"
                inputMode="numeric"
                value={postalCode}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 7);
                  setPostalCode(v);
                  if (v.length === 7) lookupPostalCode(v);
                }}
                onBlur={() => lookupPostalCode(postalCode)}
                maxLength={7}
                placeholder="例）1500031（ハイフンなし）"
                style={inputStyle}
              />
              <span style={{ fontSize: "0.8rem", color: "#666" }}>
                {zipSearching
                  ? "住所を検索しています…"
                  : "入力すると住所が自動で入ります。引越された場合はここを変更してください。"}
              </span>
              {zipError && (
                <span style={{ fontSize: "0.8rem", color: "#c62828" }}>{zipError}</span>
              )}
            </label>

            <label>
              住所（都道府県・市区町村・町名）
              <input
                type="text"
                value={[prefecture, city, town].filter(Boolean).join("")}
                readOnly
                placeholder="郵便番号を入力すると自動で入ります"
                style={{ ...inputStyle, background: "#f7f5f0" }}
              />
              <span style={{ fontSize: "0.8rem", color: "#666" }}>
                講師ページには都道府県と市区町村までを掲載します。自宅レッスンのコースがある場合は、予約画面に町名まで表示します。
              </span>
            </label>

            <label>
              番地・建物名
              <input
                type="text"
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                maxLength={200}
                placeholder="例）1-2-3 ○○マンション101"
                style={inputStyle}
              />
              <span style={{ fontSize: "0.8rem", color: "#666" }}>
                {hasHomeCourse
                  ? "自宅レッスンのコースがあるため必須です。"
                  : "自宅レッスンのコースを作る場合は必須です。"}
                講師ページには掲載されず、自宅レッスンを予約した生徒にのみ予約受付メールでお知らせします。
              </span>
            </label>
          </div>
        </section>

        {/* 指導ジャンルは応募時の専攻から引き継がれ、通常は変わらないため画面に出さない。
            値は保持したまま保存するので、消えることはない。変更が必要なときは運営が対応する。 */}

        {/* タグ */}
        <section style={{ marginTop: "2rem" }}>
          <h3>特徴タグ</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TAG_OPTIONS.map((t) => (
              <label
                key={t}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 20,
                  padding: "4px 12px",
                  cursor: "pointer",
                  background: tags.includes(t) ? "#efe9db" : "#fff",
                }}
              >
                <input
                  type="checkbox"
                  checked={tags.includes(t)}
                  onChange={() => setTags((prev) => toggleIn(prev, t))}
                  style={{ marginRight: 6 }}
                />
                {t}
              </label>
            ))}
          </div>
        </section>

        {/* 自己紹介 */}
        <section style={{ marginTop: "2rem" }}>
          <h3>自己紹介</h3>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={6}
            maxLength={2000}
            placeholder="ご経歴や指導方針をご記入ください。"
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </section>

        {/* コース */}
        <section style={{ marginTop: "2rem" }}>
          <h3>レッスンコース</h3>
          <p style={{ fontSize: "0.85rem", color: "#666", lineHeight: 1.8 }}>
            料金は{formatPrice(MIN_LESSON_PRICE)}以上で設定してください。
            <br />
            体験レッスンに指定したコースは、生徒1人につき1回のみ予約できます。
          </p>

          {courses.length === 0 && (
            <p style={{ color: "#8a8270" }}>
              コースがまだありません。「コースを追加」から登録してください。
            </p>
          )}

          {courses.map((c, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: "16px",
                marginBottom: "12px",
                background: "#fff",
                display: "grid",
                gap: 10,
              }}
            >
              <div
                style={{ display: "flex", justifyContent: "space-between", gap: 8 }}
              >
                <strong>コース {i + 1}</strong>
                <button
                  type="button"
                  onClick={() => removeCourse(i)}
                  style={{
                    border: "none",
                    background: "none",
                    color: "#c62828",
                    cursor: "pointer",
                  }}
                >
                  削除
                </button>
              </div>

              <label>
                レッスン形態
                <select
                  value={c.type}
                  onChange={(e) =>
                    updateCourse(i, { type: e.target.value as LessonType })
                  }
                  style={inputStyle}
                >
                  {LESSON_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                コース名
                <select
                  value={
                    COURSE_TITLE_OPTIONS.includes(c.title) ? c.title : "__custom__"
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    updateCourse(i, { title: v === "__custom__" ? "" : v });
                  }}
                  style={inputStyle}
                >
                  {COURSE_TITLE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                  <option value="__custom__">その他（自由入力）</option>
                </select>
                {!COURSE_TITLE_OPTIONS.includes(c.title) && (
                  <input
                    type="text"
                    value={c.title}
                    onChange={(e) => updateCourse(i, { title: e.target.value })}
                    placeholder="コース名を入力"
                    style={{ ...inputStyle, marginTop: 6 }}
                  />
                )}
              </label>

              <label>
                料金（円）
                <input
                  type="number"
                  inputMode="numeric"
                  min={MIN_LESSON_PRICE}
                  step={500}
                  value={c.price}
                  onChange={(e) => updateCourse(i, { price: e.target.value })}
                  placeholder={String(MIN_LESSON_PRICE)}
                  style={inputStyle}
                />
                {c.price &&
                  Number(c.price) > 0 &&
                  Number(c.price) < MIN_LESSON_PRICE && (
                    <span style={{ color: "#c62828", fontSize: "0.85rem" }}>
                      {formatPrice(MIN_LESSON_PRICE)}以上で設定してください。
                    </span>
                  )}
              </label>

              {c.type !== "オンライン" && (
                <label>
                  実施場所の表示（任意）
                  <input
                    type="text"
                    value={c.locationDisplay}
                    onChange={(e) =>
                      updateCourse(i, { locationDisplay: e.target.value })
                    }
                    placeholder="例: 東京都世田谷区桜新町"
                    style={inputStyle}
                  />
                </label>
              )}

              <label>
                備考（任意）
                <input
                  type="text"
                  value={c.note}
                  onChange={(e) => updateCourse(i, { note: e.target.value })}
                  placeholder="例: スタジオ代込み"
                  style={inputStyle}
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={c.isTrial}
                  onChange={(e) => updateCourse(i, { isTrial: e.target.checked })}
                />
                体験レッスンにする（生徒1人につき1回まで）
              </label>
            </div>
          ))}

          <button type="button" className="form-button" onClick={addCourse}>
            コースを追加
          </button>
        </section>

        {/* 出張可能な範囲。出張コースがあるときだけ聞く */}
        {hasTravelCourse && (
          <section style={{ marginTop: "2rem" }}>
            <h3>出張可能な範囲</h3>
            <p style={{ fontSize: "0.85rem", color: "#666", lineHeight: 1.8 }}>
              ご自宅を起点に、出張レッスンが可能な範囲の目安を選択してください。
              講師ページで生徒に案内します。
            </p>
            <select
              value={travelRange}
              onChange={(e) => setTravelRange(e.target.value)}
              style={inputStyle}
            >
              <option value="">選択してください</option>
              {TRAVEL_RANGES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </section>
        )}

        {/* 区ごとの出張費。出張・スタジオのコースがあるときだけ聞く */}
        {hasAreaFeeCourse && (
          <section style={{ marginTop: "2rem" }}>
            <h3>区ごとの出張費（東京23区）</h3>
            <p style={{ fontSize: "0.85rem", color: "#666", lineHeight: 1.8 }}>
              出張・スタジオのレッスンは、場所の区によってコースの料金に出張費を足せます
              （出張は生徒が選んだ区、スタジオはスタジオのある区で決まります）。
              設定すると、選んだ区だけが対応エリアになり、それ以外の場所では予約を受け付けません。
            </p>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={areaFeeEnabled}
                onChange={(e) => setAreaFeeEnabled(e.target.checked)}
              />
              区ごとに出張費を設定する
            </label>

            {areaFeeEnabled && (
              <>
                <div className="area-fee-tiers">
                  <h4>距離から自動で入れる</h4>
                  {baseCoords ? (
                    <p className="area-fee-tiers-lead">
                      ご自宅（{baseCoords.label}）から各区の区役所までの直線距離で、出張費を入れます。
                      入れたあとに区ごとに直せます。
                    </p>
                  ) : (
                    <p className="area-fee-tiers-lead">
                      {baseTownsLoading
                        ? "ご自宅の位置を調べています…"
                        : "上の「住所」で郵便番号（または都道府県・市区町村）を入力すると使えます。"}
                    </p>
                  )}
                  {feeTiers.map((t, i) => (
                    <div key={i} className="area-fee-tier-row">
                      <span>{i === 0 ? "" : "〜"}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={t.maxKm}
                        onChange={(e) =>
                          setFeeTiers((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, maxKm: e.target.value } : x))
                          )
                        }
                        aria-label={`${i + 1}段目の距離`}
                      />
                      <span>km まで：+</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={MAX_AREA_FEE}
                        step={500}
                        value={t.fee}
                        onChange={(e) =>
                          setFeeTiers((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, fee: e.target.value } : x))
                          )
                        }
                        aria-label={`${i + 1}段目の出張費`}
                      />
                      <span>円</span>
                      {feeTiers.length > 1 && (
                        <button
                          type="button"
                          className="area-fee-tier-remove"
                          onClick={() => setFeeTiers((prev) => prev.filter((_, j) => j !== i))}
                          aria-label={`${i + 1}段目を削除`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  {feeTiers.length < MAX_FEE_TIERS && (
                    <button
                      type="button"
                      className="admin-tool-button"
                      onClick={() =>
                        setFeeTiers((prev) => [...prev, { maxKm: "", fee: "" }])
                      }
                    >
                      段階を追加
                    </button>
                  )}
                  <div className="area-fee-tier-row">
                    <span>それより遠い区：+</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_AREA_FEE}
                      step={500}
                      value={farFee}
                      onChange={(e) => setFarFee(e.target.value)}
                      placeholder="空欄"
                      aria-label="それより遠い区の出張費"
                    />
                    <span>円（空欄なら対応しない）</span>
                  </div>
                  <button
                    type="button"
                    className="form-button"
                    onClick={applyFeeTiers}
                    disabled={!baseCoords}
                  >
                    この設定で23区の出張費を入れる
                  </button>
                  {tierNotice && <p className="area-fee-tiers-notice">{tierNotice}</p>}
                </div>

                <div style={{ display: "flex", gap: 8, margin: "0.75rem 0" }}>
                  <button
                    type="button"
                    className="admin-tool-button"
                    onClick={() => setAllWards(true)}
                  >
                    すべての区を選ぶ
                  </button>
                  <button
                    type="button"
                    className="admin-tool-button"
                    onClick={() => setAllWards(false)}
                  >
                    すべて外す
                  </button>
                </div>
                <div className="area-fee-grid">
                  {TOKYO_WARDS.map((ward) => {
                    const on = ward in areaFees;
                    return (
                      <div
                        key={ward}
                        className={`area-fee-row${on ? " is-on" : ""}`}
                      >
                        <label>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggleWard(ward)}
                          />
                          {ward}
                          {typeof wardDistances[ward] === "number" && (
                            <small className="area-fee-distance">
                              約{wardDistances[ward].toFixed(1)}km
                            </small>
                          )}
                        </label>
                        <span className="area-fee-input">
                          +
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={MAX_AREA_FEE}
                            step={500}
                            value={on ? areaFees[ward] : ""}
                            disabled={!on}
                            onChange={(e) =>
                              setAreaFees((prev) => ({ ...prev, [ward]: e.target.value }))
                            }
                            aria-label={`${ward}の出張費`}
                          />
                          円
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: "0.85rem", color: "#666", lineHeight: 1.8 }}>
                  出張費のかからない区は 0 円のまま選んでください。
                  出張費には運営手数料がかからず、全額が講師の取り分になります。
                </p>
              </>
            )}
          </section>
        )}

        {/* オンライン対応 */}
        <section style={{ marginTop: "2rem" }}>
          <h3>オンラインレッスン</h3>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={onlineAvailable}
              onChange={(e) => setOnlineAvailable(e.target.checked)}
            />
            オンラインレッスンに対応する
          </label>
          {onlineAvailable && (
            <p style={{ fontSize: "0.85rem", color: "#666", lineHeight: 1.8 }}>
              上のコースにオンラインを登録していない場合、
              オンラインレッスン（60分）を自動で追加します。料金を指定しない場合は既定額になります。
            </p>
          )}
          {onlineAvailable && (
            <label>
              オンラインの料金（円・任意）
              <input
                type="number"
                inputMode="numeric"
                min={MIN_LESSON_PRICE}
                step={500}
                value={onlinePrice}
                onChange={(e) => setOnlinePrice(e.target.value)}
                style={inputStyle}
              />
            </label>
          )}
        </section>

        {error && (
          <p style={{ color: "#c62828", marginTop: "1.5rem" }}>{error}</p>
        )}
        {notice && (
          <p style={{ color: "#2e7d32", marginTop: "1.5rem" }}>{notice}</p>
        )}

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginTop: "1.5rem",
          }}
        >
          <button
            type="button"
            className="form-button"
            onClick={() => save(false)}
            disabled={saving}
          >
            {saving ? "保存中..." : "保存する（下書き）"}
          </button>
          <button
            type="button"
            className="form-button"
            onClick={() => save(true)}
            disabled={saving}
          >
            {saving ? "送信中..." : "公開を申請する"}
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: "2rem" }}>
          <Link to="/schedule-list" className="form-button">
            スケジュール管理へ
          </Link>
        </div>
      </div>
    </main>
  );
};

export default TeacherProfileForm;
