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

## シナリオ1：カード予約＝与信のみ（未請求）
1. 予約フォームで日時を選び、確認画面で「お支払いへ進む」。
   （2026-07-22 以降、支払い方法はクレジットカードのみ。選択 UI は廃止済み）
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

## シナリオ4：支払い方法がカードのみになっていること

※ PayPay は 2026-07-22 に廃止（Stripe Connect 非対応・返金時に手数料が戻らないため）。
旧シナリオ4「PayPay 即時決済」と5「PayPay 返金」は削除した。

1. Checkout の画面を開く。
2. **確認ポイント**
   - 支払い手段として **カードのみ**が表示され、PayPay が出ない。
   - 予約フォームの確認画面に支払い方法の選択肢が出ず、「クレジットカード」と
     請求タイミングの説明だけが表示される。
   - 旧クライアントが `paymentMethod: "paypay"` を送っても card として処理され、
     Functions のログに警告が出る。
