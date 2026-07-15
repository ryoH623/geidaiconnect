# 決済タイミング改修 設計メモ（カード保存→締切請求方式）

## 目的
キャンセルのたびに発生する Stripe 決済手数料（約 3.6%）の運営者負担をなくす。
「早めのキャンセルは請求も返金も発生しない／直前・無断は確定して請求」を実現し、
全額返金ポリシー（利用規約 第7条）と両立させる。

## 前提・制約
- 予約可能期間は **本日から 1 ヶ月以内**（今回の要件）。
- Stripe のカード与信（オーソリ）は **約 7 日で失効** → 「予約時にオーソリして締切までホールド」は
  7 日超先の予約に使えない。**よって与信ホールド方式は不採用**。
- 採用方式：**予約時はカードを保存（請求しない）→ キャンセル締切日にオフセッションで請求**。
  - 締切前キャンセル → 未請求のまま取消 → **手数料ゼロ・返金不要**。
  - 締切到来 → 請求（確定）。締切後キャンセル・無断は返金なし（規約どおり）→ 取りっぱぐれなし。

## 全体フロー

### 1. 予約時（フロント → `createReservation`）
- Stripe Checkout を **`mode: "setup"`**（カード保存のみ・請求なし）で開始、または SetupIntent + Elements。
  - 最小改修は Checkout `setup` モード（現行の redirect フローを踏襲）。
- 予約枠は現行同様にホールド（`schedules`/`studioBookings` を pending）。
- 予約可能期間チェック：`date` が本日〜+30 日以内でなければ拒否（フロントのカレンダーも +30 日で上限）。

### 2. カード保存完了（Webhook `checkout.session.completed` / setup モード）
- SetupIntent から `customer` と `payment_method` を取得し予約に保存
  （`stripeCustomerId`, `stripePaymentMethodId`）。
- 予約を `reservationStatus: "confirmed"`, `paymentStatus: "card_saved"`（未請求・確定予約）に更新。
- 生徒へ「予約確定（当日◯日前に自動決済されます）」の通知メール。

### 3. 締切日に自動請求（新設スケジュール関数 `chargeDueReservations`）
- 定期実行（例：1 時間毎）。対象＝`paymentStatus == "card_saved"` かつ
  「請求時点（＝キャンセル締切：レッスン開始の前日 23:59 目安）を過ぎた」予約。
- 各予約で PaymentIntent をオフセッション作成：
  `customer`, `payment_method`, `amount = totalAmount`, `off_session: true`, `confirm: true`,
  冪等キー（`reservationId` ベース）で二重請求防止。
- 成功 → `paymentStatus: "paid"`, `paidAt`、確定通知。
- 失敗（`authentication_required` / カード拒否 / 残高不足 / 期限切れ）
  → `paymentStatus: "payment_failed"`、下記リカバリへ。

### 4. 決済失敗リカバリ（Phase C）
- 生徒へ「決済に失敗しました。◯時間以内にお支払いください」通知＋**オンセッション決済リンク**
  （3DS 再認証や別カード入力）。
- 期限内に解消しなければ予約を `cancelled` にし、枠を開放（講師にも通知）。

### 5. キャンセル
- **締切前（`card_saved`）**：予約を `cancelled` にし枠開放。請求していないので**返金不要・手数料ゼロ**。
  保存カードは detach（任意）。
- **締切後（`paid`）**：規約どおり原則返金なし。講師都合の場合のみ全額返金（この返金は手数料が発生するが稀）。

## データモデル追加（`reservations`）
- `stripeCustomerId: string | null`
- `stripePaymentMethodId: string | null`
- `chargeDueAt: Timestamp`（請求予定時刻＝キャンセル締切）
- `paymentStatus` の値を拡張：`card_saved` / `paid` / `payment_failed` / `expired` / `cancelled`
- 既存の即時決済（`pending_payment`）からの移行期は両系統を許容。

## 請求タイミングの定義
- **請求時点 = キャンセル締切 = レッスン開始日の前日 23:59**（規約と一致）。
  - 締切前キャンセル＝無請求、締切以降＝請求済みで返金なし、と一貫する。
- （将来）締切と請求点をずらしたい場合は `chargeDueAt` の算出だけ変更すればよい。

## エッジケース・留意点
- **オフセッション決済の失敗**（拒否/期限切れ/残高不足/SCA 要求）。日本の 3DS2 では
  `authentication_required` が返ることがある → オンセッション復帰リンクが必須（Phase C）。
- **二重請求防止**：ステータス遷移をトランザクション化＋冪等キー。
- **カード未保存**（setup 未完了で離脱）：予約は成立させない（枠を掴んだままにしない）。
  現行の期限切れ pending 開放（`releaseExpiredHolds`）と同方針で回収。
- **no-show 対策**：締切（前日）に請求済みのため、当日 no-show でも取りっぱぐれない。
- **Webhook**：setup モード完了と、必要なら PaymentIntent 系イベントの購読追加。

## 実装フェーズ
- **Phase A（先行・小）**：予約可能期間を「1 ヶ月以内」に制限
  - フロント：`BookingCalendar` の選択可能上限を +30 日に。
  - バック：`createReservation` で `date` を検証（本日〜+30 日）。
- **Phase B（中核）**：即時決済 → カード保存（setup）＋確定未請求予約＋締切スケジュール請求＋
  締切前キャンセルは無請求。
- **Phase C（堅牢化）**：決済失敗リカバリ（通知＋オンセッション復帰リンク＋期限切れ自動キャンセル）。

## 規約への波及
- 採用時、第5〜7条に「予約時はカード情報の登録のみで、レッスンのキャンセル期限到来時に決済（請求）されます」旨を一文追加。

## 要確認事項
- 請求時点＝「前日 23:59」でよいか（もっと早め/遅めにするか）。
- 決済失敗時の猶予時間と自動キャンセルの要否（Phase C の運用）。
- カード保存に Checkout `setup` モード（redirect）で進めるか、Elements（埋め込み）にするか。
