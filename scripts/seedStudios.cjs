/**
 * スタジオマスタ（studios コレクション）と、講師の拠点・移動可能距離
 * （users/{uid} の baseLat/baseLng/maxTravelKm）を投入するシードスクリプト。
 *
 * 使い方（エミュレータ）:
 *   1) 別ターミナルで  firebase emulators:start
 *   2) このターミナルで:
 *        FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
 *        GCLOUD_PROJECT=<プロジェクトID> \
 *        node scripts/seedStudios.cjs <講師のuid（任意）>
 *
 * 使い方（本番）:
 *   GOOGLE_APPLICATION_CREDENTIALS=<サービスアカウントjson> \
 *   GCLOUD_PROJECT=<プロジェクトID> \
 *   node scripts/seedStudios.cjs <講師のuid（任意）>
 *
 * 講師uid を渡すと、その users ドキュメントに拠点（渋谷付近）と maxTravelKm=20 を設定する。
 * calendarId は空にしてあるため、外部（Google カレンダー）空き照会はスキップされ、
 * 常に「空き」として扱われる（ローカル検証用）。本番では各スタジオに実カレンダーIDを設定すること。
 */

const admin = require("firebase-admin");

admin.initializeApp({
  projectId: process.env.GCLOUD_PROJECT || "demo-geidaiconnect",
});

const db = admin.firestore();

// 東京〜近郊のサンプルスタジオ（座標は概位置）
const studios = [
  {
    id: "studio-shibuya",
    name: "渋谷サウンドスタジオ",
    prefecture: "東京都",
    city: "渋谷区",
    address: "東京都渋谷区宇田川町1-1",
    lat: 35.6595,
    lng: 139.7005,
    pricePerSlot: 2000,
    calendarId: "",
    active: true,
  },
  {
    id: "studio-setagaya",
    name: "世田谷リハーサルスタジオ",
    prefecture: "東京都",
    city: "世田谷区",
    address: "東京都世田谷区北沢2-2-2",
    lat: 35.6613,
    lng: 139.668,
    pricePerSlot: 1500,
    calendarId: "",
    active: true,
  },
  {
    id: "studio-urawa",
    name: "浦和ミュージックスタジオ",
    prefecture: "埼玉県",
    city: "さいたま市",
    address: "埼玉県さいたま市浦和区高砂1-1",
    lat: 35.8617,
    lng: 139.6455,
    pricePerSlot: 1200,
    calendarId: "",
    active: true,
  },
  {
    id: "studio-yokohama",
    name: "横浜ベイスタジオ",
    prefecture: "神奈川県",
    city: "横浜市",
    address: "神奈川県横浜市西区みなとみらい2-2",
    lat: 35.4578,
    lng: 139.6317,
    pricePerSlot: 1800,
    calendarId: "",
    active: true,
  },
];

async function main() {
  const teacherUid = process.argv[2] || "";

  const batch = db.batch();
  for (const s of studios) {
    batch.set(db.collection("studios").doc(s.id), {
      ...s,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log(`✅ studios を ${studios.length} 件投入しました。`);

  if (teacherUid) {
    // 拠点=渋谷付近、対応可能距離=20km。渋谷/世田谷は到達可、浦和/横浜は圏外になる想定。
    await db.collection("users").doc(teacherUid).set(
      {
        baseLat: 35.6595,
        baseLng: 139.7005,
        maxTravelKm: 20,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    console.log(
      `✅ 講師 users/${teacherUid} に拠点(35.6595,139.7005)/maxTravelKm=20 を設定しました。`
    );
  } else {
    console.log(
      "ℹ️ 講師uid が未指定のため、講師拠点は設定していません（到達判定は距離制限なしになります）。"
    );
  }

  console.log("完了しました。");
  process.exit(0);
}

main().catch((err) => {
  console.error("シードに失敗しました:", err);
  process.exit(1);
});
