// src/hooks/useJapaneseAddresses.ts
// Geolonia japanese-addresses オープンデータAPIから住所マスタ（都道府県→市区町村→町名）を取得するフック。
// 講師募集フォームの住所欄・出張可能エリア欄で共用する。
// モジュールレベルで Promise をキャッシュするため、複数コンポーネントから使っても fetch は各1回。
import { useEffect, useState } from "react";

const API_BASE = "https://geolonia.github.io/japanese-addresses/api";

/** 都道府県名 → 市区町村名の配列 */
export type PrefectureCityMap = Record<string, string[]>;

/** 丁目正規化後の町名と代表座標（丁目ごとの座標の平均。座標なしの町は null） */
export type TownWithCoords = {
  name: string;
  lat: number | null;
  lng: number | null;
};

interface GeoloniaTown {
  town: string;
  koaza: string;
  lat: number | null;
  lng: number | null;
}

let prefCityPromise: Promise<PrefectureCityMap> | null = null;
const townPromises = new Map<string, Promise<TownWithCoords[]>>();

function fetchPrefectureCities(): Promise<PrefectureCityMap> {
  if (!prefCityPromise) {
    prefCityPromise = fetch(`${API_BASE}/ja.json`).then((res) => {
      if (!res.ok) throw new Error(`住所データの取得に失敗しました (${res.status})`);
      return res.json() as Promise<PrefectureCityMap>;
    });
    // 失敗時はキャッシュを破棄して再試行できるようにする
    prefCityPromise.catch(() => {
      prefCityPromise = null;
    });
  }
  return prefCityPromise;
}

function fetchTownsWithCoords(
  prefecture: string,
  city: string
): Promise<TownWithCoords[]> {
  const key = `${prefecture}/${city}`;
  let promise = townPromises.get(key);
  if (!promise) {
    const url = `${API_BASE}/ja/${encodeURIComponent(prefecture)}/${encodeURIComponent(city)}.json`;
    promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`町名データの取得に失敗しました (${res.status})`);
        return res.json() as Promise<GeoloniaTown[]>;
      })
      .then((list) => {
        // 「北沢一丁目」「北沢二丁目」→「北沢」に正規化してグループ化（丁目・番地は別欄で入力する）。
        // 座標は同じ町のエントリのうち有効なものの平均を代表値とする。
        const groups = new Map<string, { latSum: number; lngSum: number; count: number }>();
        const order: string[] = [];
        for (const t of list) {
          const name = t.town.replace(/[一二三四五六七八九十百〇0-9０-９]+丁目$/, "");
          if (name === "") continue;
          let g = groups.get(name);
          if (!g) {
            g = { latSum: 0, lngSum: 0, count: 0 };
            groups.set(name, g);
            order.push(name);
          }
          if (
            typeof t.lat === "number" &&
            typeof t.lng === "number" &&
            Number.isFinite(t.lat) &&
            Number.isFinite(t.lng)
          ) {
            g.latSum += t.lat;
            g.lngSum += t.lng;
            g.count += 1;
          }
        }
        return order.map((name) => {
          const g = groups.get(name)!;
          return g.count > 0
            ? { name, lat: g.latSum / g.count, lng: g.lngSum / g.count }
            : { name, lat: null, lng: null };
        });
      });
    promise.catch(() => {
      townPromises.delete(key);
    });
    townPromises.set(key, promise);
  }
  return promise;
}

function fetchTowns(prefecture: string, city: string): Promise<string[]> {
  return fetchTownsWithCoords(prefecture, city).then((list) =>
    list.map((t) => t.name)
  );
}

/** 都道府県一覧と、都道府県→市区町村のマップを返す */
export function usePrefectureCities(): {
  data: PrefectureCityMap | null;
  loading: boolean;
  error: string;
} {
  const [data, setData] = useState<PrefectureCityMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPrefectureCities()
      .then((map) => {
        if (cancelled) return;
        setData(map);
        setError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("住所データ取得エラー:", err);
        setError("住所データの取得に失敗しました。ページを再読み込みしてください。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}

/** 指定した都道府県・市区町村の町名一覧を返す（未選択の間は空配列） */
export function useTowns(prefecture: string, city: string): {
  towns: string[];
  loading: boolean;
  error: string;
} {
  const [towns, setTowns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!prefecture || !city) {
      setTowns([]);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setTowns([]);
    fetchTowns(prefecture, city)
      .then((list) => {
        if (cancelled) return;
        setTowns(list);
        setError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("町名データ取得エラー:", err);
        setError("町名データの取得に失敗しました。市区町村を選び直してください。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [prefecture, city]);

  return { towns, loading, error };
}

/** 指定した都道府県・市区町村の町名一覧を代表座標つきで返す（未選択の間は空配列） */
export function useTownsWithCoords(prefecture: string, city: string): {
  towns: TownWithCoords[];
  loading: boolean;
  error: string;
} {
  const [towns, setTowns] = useState<TownWithCoords[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!prefecture || !city) {
      setTowns([]);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setTowns([]);
    fetchTownsWithCoords(prefecture, city)
      .then((list) => {
        if (cancelled) return;
        setTowns(list);
        setError("");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("町名データ取得エラー:", err);
        setError("町名データの取得に失敗しました。市区町村を選び直してください。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [prefecture, city]);

  return { towns, loading, error };
}
