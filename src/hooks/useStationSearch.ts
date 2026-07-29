// src/hooks/useStationSearch.ts
// HeartRails Express（無料・キー不要の公開API）から駅名で駅を検索し、座標つきで返す。
// 予約時のスタジオ検索で「最寄り駅から探す」の基準地点に使う。
// 住所マスタ（useJapaneseAddresses）と同じく外部オープンデータを直接叩く方式。
import { useState } from "react";

const API_BASE = "https://express.heartrails.com/api/json";

/** 検索結果の駅 1 件（路線違いの重複は名称＋都道府県でまとめ済み） */
export type StationHit = {
  /** 駅名（例: "渋谷"） */
  name: string;
  /** 都道府県名（例: "東京都"） */
  prefecture: string;
  /** 乗り入れ路線（例: ["JR山手線", "東急東横線"]） */
  lines: string[];
  lat: number;
  lng: number;
};

interface HeartRailsStation {
  name: string;
  prefecture: string;
  line: string;
  /** 経度 */
  x: number;
  /** 緯度 */
  y: number;
}

/**
 * 駅名で検索する。HeartRails は路線ごとに 1 件返すため、
 * 同じ駅名・同じ都道府県のものを 1 件にまとめ、座標は先頭のものを代表値とする。
 */
export async function searchStations(name: string): Promise<StationHit[]> {
  const keyword = name.trim();
  if (!keyword) return [];

  const url = `${API_BASE}?method=getStations&name=${encodeURIComponent(keyword)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`駅データの取得に失敗しました (${res.status})`);

  const json = (await res.json()) as {
    response?: { station?: HeartRailsStation[]; error?: string };
  };
  const list = json.response?.station ?? [];

  const merged = new Map<string, StationHit>();
  for (const s of list) {
    if (typeof s.x !== "number" || typeof s.y !== "number") continue;
    const key = `${s.prefecture}/${s.name}`;
    const hit = merged.get(key);
    if (hit) {
      if (s.line && !hit.lines.includes(s.line)) hit.lines.push(s.line);
      continue;
    }
    merged.set(key, {
      name: s.name,
      prefecture: s.prefecture,
      lines: s.line ? [s.line] : [],
      lat: s.y,
      lng: s.x,
    });
  }

  return [...merged.values()];
}

/** 駅名検索の状態をまとめて扱うフック */
export function useStationSearch(): {
  stations: StationHit[];
  loading: boolean;
  error: string;
  search: (name: string) => Promise<void>;
  reset: () => void;
} {
  const [stations, setStations] = useState<StationHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const search = async (name: string) => {
    if (!name.trim()) {
      setStations([]);
      setError("駅名を入力してください。");
      return;
    }
    setLoading(true);
    setError("");
    setStations([]);
    try {
      const list = await searchStations(name);
      setStations(list);
      if (list.length === 0) {
        setError("該当する駅が見つかりませんでした。駅名を確認してください。");
      }
    } catch (err: unknown) {
      console.error("駅検索エラー:", err);
      setError("駅データの取得に失敗しました。時間をおいてお試しください。");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStations([]);
    setError("");
  };

  return { stations, loading, error, search, reset };
}
