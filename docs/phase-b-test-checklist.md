# Phase B 決済フロー テスト手順（Stripe テストモード）

本番デプロイ前に、Stripe **テストモード**で以下を確認する。全項目 OK になってから
`firebase deploy --only functions` → フロント `dist` 再ビルド＆アップロードの順で本番反映する。

## 事前準備
- Stripe を**テストモード**に切り替え、テスト用の Secret Key / Webhook Secret を使う。
  - `functions/.env`（または該当の環境）で `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` をテスト用に。
- ローカル検証なら Functions エミュレータ＋Stripe CLI で Webhook を転送：
  ```bash
  cd functions && npm run serve         # エミュレータ起動
  stripe listen --forward-to http://localhost:5001/<project>/us-central1/stripeWebhook
  ```
  （本番テストプロジェクトへデプロイして検証する場合は Webhook エンドポイントをテスト用に登録）
- テストカード：`4242 4242 4242 4242`（任意の将来日／CVC）。3DS 要求のテストは `4000 0027 6000 3184` 等。
- PayPay：テストモードのリダイレクト画面で「Authorize（成功）」を選ぶ。

## シナリオ1：カード予約＝与信のみ（未請求）
1. 予約フォームで日時を選び、確認画面で**クレジットカード**を選択 →「お支払いへ進む」。
2. テストカードで Checkout 完了。
3. **確認ポイント**
   - Firestore の該当 `reservations` が `paymentStatus: "authorized"`、`reservationStatus: "confirmed"`。
   - `chargeDueAt` がレッスン当日 00:00(JST) になっている。
   - Stripe ダッシュボード（テスト）で PaymentIntent が **`requires_capture`（未キャプチャ）**。
   - 講師にまだ入金されていない（capture 前）。
   - 予約確定メール（paid 用）は**まだ送られない**のが正しい。

## シナリオ2：締切キャプチャ（authorized → paid）
1. テスト予約の `chargeDueAt` を**過去時刻**に手動更新（Firestore コンソール）。
2. `captureDueAuthorizations` を実行（エミュレータなら手動トリガ、テストプロジェクトなら
   Cloud Scheduler の「今すぐ実行」）。
3. **確認ポイント**
   - PaymentIntent が **`succeeded`（キャプチャ済み）**。
   - `reservations` が `paymentStatus: "paid"`、`paidAt` セット。
   - 決済確定メールが**このタイミングで**届く。
   - もう一度実行しても二重請求されない（冪等）。

## シナリオ3：カード予約を締切前にキャンセル＝与信取消
1. シナリオ1の状態（authorized）で、生徒側からキャンセル（`cancelReservation`）。
2. **確認ポイント**
   - PaymentIntent が **`canceled`**（返金明細は出ない＝手数料も発生しない）。
   - `reservations` が `reservationStatus: "cancelled"`、`paymentStatus: "voided"`。
   - 枠（schedules / studioBookings）が `open` に戻る。
   - キャンセルメールが「請求は発生しません」の文面。

## シナリオ4：PayPay 予約＝即時決済
1. 確認画面で **PayPay** を選択 → Checkout で承認。
2. **確認ポイント**
   - `reservations` が即 `paymentStatus: "paid"`、`paidAt` セット。
   - 決済確定メールが届く。
   - PaymentIntent が `succeeded`。

## シナリオ5：PayPay 予約を締切前にキャンセル＝返金
1. シナリオ4の予約を締切前にキャンセル。
2. **確認ポイント**
   - Stripe で**返金**が作成される（テストモードでは手数料は戻らない旨は本番同様）。
   - `reservations` が `reservationStatus: "cancelled"`、`paymentStatus: "refunded"`、`refundId` セット。
   - 枠が open に戻る。

## シナリオ6：予約可能期間（Phase A）
- カレンダーで**本日+31日以降が選べない**、月移動が現在月〜上限月に制限される。
- `createReservationAndCheckout` に範囲外 `date` を渡すと `failed-precondition` で拒否。

## 合否
- 上記すべて OK → 本番反映（functions deploy → dist アップロード）。
- 失敗があれば内容を共有 → 修正して再テスト。

## 既知の未対応（Phase C）
- capture 失敗時（カード期限切れ・限度額等）の生徒への再決済案内・自動キャンセルは未実装。
  現状は `payment_failed` に記録＋ログのみ。
