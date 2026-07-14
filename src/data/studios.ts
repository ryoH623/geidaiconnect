// スタジオマスタの型定義。
// 実データは Firestore の `studios` コレクションに保存する（フロント表示＋Functions の
// 料金/座標/カレンダー参照で共有するため）。初期投入は scripts/seedStudios.cjs を参照。
//
// 地域（prefecture / city）は src/data/prefectures.ts・citiesByPrefecture.ts の「名称」で保持する。
// prefecture は名称（例: "東京都"）、city は市区町村名（例: "世田谷区"）。

/** Firestore `studios/{id}` ドキュメント 1 件の形。 */
export interface Studio {
  id: string;
  name: string;
  /** 都道府県「名称」（例: "東京都"）。prefectures[].name と一致させる */
  prefecture: string;
  /** 市区町村「名称」（例: "世田谷区"）。citiesByPrefecture[code] の要素と一致させる */
  city: string;
  address?: string;
  /** 緯度（登録時にジオコーディング。実行時ジオコーディングはしない） */
  lat: number;
  /** 経度 */
  lng: number;
  /** 1 コマ（30分）あたりのスタジオ代（JPY・整数）。Stripe の unit_amount に合わせて number */
  pricePerSlot: number;
  /** 空き照会に使う Google カレンダー ID。空の場合は外部空き照会をスキップ（＝常に空き扱い） */
  calendarId: string;
  /** 検索対象に含めるか */
  active: boolean;
}

/**
 * getAvailableStudios（Cloud Function）が返す、生徒に提示する空きスタジオ 1 件の形。
 * 講師が到達可能（拠点からの距離が maxTravelKm 以内）かつ、その日時に空きがあるものだけが返る。
 */
export interface AvailableStudio {
  id: string;
  name: string;
  address?: string;
  /** 1 コマ（30分）あたりのスタジオ代（JPY・整数） */
  pricePerSlot: number;
  /** 講師拠点からの直線距離(km)。講師拠点が未設定の場合は null */
  distanceKm: number | null;
  /** 生徒が選択した町名からの直線距離(km)。町名未選択・座標なしの場合は null */
  studentDistanceKm: number | null;
}
