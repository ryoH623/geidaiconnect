// 東京23区の基準地点（区役所のおおよその位置）。
// 講師プロフィール編集で「距離から出張費を自動で入れる」ときの距離計算に使う。
// 区の広さによっては区役所から遠い地域もあるため、出した金額は講師が手直しする前提。
export const WARD_OFFICE_COORDS: Record<string, { lat: number; lng: number }> = {
  千代田区: { lat: 35.694, lng: 139.7536 },
  中央区: { lat: 35.6706, lng: 139.772 },
  港区: { lat: 35.6581, lng: 139.7516 },
  新宿区: { lat: 35.6938, lng: 139.7036 },
  文京区: { lat: 35.7081, lng: 139.7522 },
  台東区: { lat: 35.7126, lng: 139.78 },
  墨田区: { lat: 35.7107, lng: 139.8016 },
  江東区: { lat: 35.673, lng: 139.8171 },
  品川区: { lat: 35.6092, lng: 139.7302 },
  目黒区: { lat: 35.6415, lng: 139.6982 },
  大田区: { lat: 35.5613, lng: 139.716 },
  世田谷区: { lat: 35.6466, lng: 139.6532 },
  渋谷区: { lat: 35.664, lng: 139.6982 },
  中野区: { lat: 35.7074, lng: 139.6638 },
  杉並区: { lat: 35.6995, lng: 139.6364 },
  豊島区: { lat: 35.7262, lng: 139.7166 },
  北区: { lat: 35.7528, lng: 139.7337 },
  荒川区: { lat: 35.736, lng: 139.7834 },
  板橋区: { lat: 35.7512, lng: 139.7094 },
  練馬区: { lat: 35.7356, lng: 139.6517 },
  足立区: { lat: 35.775, lng: 139.8044 },
  葛飾区: { lat: 35.7434, lng: 139.8473 },
  江戸川区: { lat: 35.7068, lng: 139.8683 },
};

/** 2地点間の直線距離(km) */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
