// src/components/AddressCascadeSelect.tsx
// 都道府県→市区町村→町名のカスケード選択部品。住所欄と出張可能エリア欄で共用する制御コンポーネント。
// 住所データは Geolonia japanese-addresses API（useJapaneseAddresses フック）から取得する。
import React from "react";
import { usePrefectureCities, useTowns } from "../hooks/useJapaneseAddresses";

/** 「（全域）」選択時に town に入る特別値。呼び出し側で null に変換する */
export const WHOLE_CITY = "__WHOLE__";

export interface AddressValue {
  prefecture: string;
  city: string;
  town: string;
}

export const EMPTY_ADDRESS: AddressValue = { prefecture: "", city: "", town: "" };

interface Props {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  /** label の htmlFor / select の id に使う接頭辞（ページ内で一意にする） */
  idPrefix: string;
  /** true のとき町名の先頭に「（全域）」を追加する（出張エリア用） */
  allowWholeCity?: boolean;
  disabled?: boolean;
}

const AddressCascadeSelect: React.FC<Props> = ({
  value,
  onChange,
  idPrefix,
  allowWholeCity = false,
  disabled = false,
}) => {
  const { data: prefCityMap, loading: prefLoading, error: prefError } = usePrefectureCities();
  const { towns, loading: townsLoading, error: townsError } = useTowns(value.prefecture, value.city);

  const prefectures = prefCityMap ? Object.keys(prefCityMap) : [];
  const cities = prefCityMap && value.prefecture ? prefCityMap[value.prefecture] ?? [] : [];
  const error = prefError || townsError;

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <select
          id={`${idPrefix}-prefecture`}
          className="form-input"
          style={{ flex: "1 1 30%", minWidth: "8.5em" }}
          value={value.prefecture}
          disabled={disabled || prefLoading}
          onChange={(e) => onChange({ prefecture: e.target.value, city: "", town: "" })}
          aria-label="都道府県"
        >
          <option value="">
            {prefLoading ? "読み込み中..." : "都道府県"}
          </option>
          {prefectures.map((pref) => (
            <option key={pref} value={pref}>
              {pref}
            </option>
          ))}
        </select>

        <select
          id={`${idPrefix}-city`}
          className="form-input"
          style={{ flex: "1 1 30%", minWidth: "8.5em" }}
          value={value.city}
          disabled={disabled || !value.prefecture}
          onChange={(e) => onChange({ prefecture: value.prefecture, city: e.target.value, town: "" })}
          aria-label="市区町村"
        >
          <option value="">市区町村</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>

        <select
          id={`${idPrefix}-town`}
          className="form-input"
          style={{ flex: "1 1 30%", minWidth: "8.5em" }}
          value={value.town}
          disabled={disabled || !value.city || townsLoading}
          onChange={(e) => onChange({ ...value, town: e.target.value })}
          aria-label="町名"
        >
          <option value="">{townsLoading ? "読み込み中..." : "町名"}</option>
          {allowWholeCity && value.city && !townsLoading && (
            <option value={WHOLE_CITY}>（全域）</option>
          )}
          {towns.map((town) => (
            <option key={town} value={town}>
              {town}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
};

export default AddressCascadeSelect;
