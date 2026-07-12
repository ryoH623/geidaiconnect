# Stripe Connect 移行設計書

作成日: 2026-07-12 / ステータス: ドラフト（実装着手前のレビュー用）

## 1. 目的と背景

現状の決済は、生徒の支払い（レッスン料＋スタジオ代）が**全額プラットフォームの Stripe アカウント**に入り、講師への報酬支払いはシステム外（手動振込・精算記録なし）である。この構造には次の課題がある。

- **法務**: 講師の売上を預かって後から渡す形は収納代行・資金移動業の論点に触れる
- **経理**: 全額が自社売上として記録され、講師報酬の経費処理が毎月発生する
- **運用**: 講師ごとの精算計算・振込作業が手動で、スケールしない
- **プロダクト**: 講師ダッシュボードに「手取り・入金予定」を正確に表示できない

**Stripe Connect（Express アカウント）**へ移行し、決済時に手数料を差し引いた講師取り分が講師の Connect アカウントへ自動送金される構造にする。プラットフォームは講師のお金を「預からない」。

## 2. 方式の選定

| 項目 | 採用 | 理由 |
|---|---|---|
| アカウント種別 | **Express** | 講師の口座登録・本人確認・振込を Stripe がホスト。Standard は講師に Stripe 管理画面の負担、Custom は自社で KYC UI を作る負担が大きい |
| チャージ方式 | **Destination charge**（`transfer_data`） | 決済は現行どおりプラットフォーム名義の Checkout で行い、講師取り分だけを `transfer_data` で送金。既存フローの変更が最小 |
| 送金額の指定 | **`transfer_data.amount`（金額指定）** | 合計にはスタジオ代が含まれるが、スタジオ代はプラットフォームが預かってスタジオに支払うもの。講師に送るのは「レッスン料 − 手数料」のみなので金額指定が必須 |

### 金額の内訳（例: レッスン料 5,000円・スタジオ代 500円・手数料率 18%）

```
生徒の支払い合計            5,500円
├─ 講師へ自動送金          4,100円  (lessonAmount × (1 - feeRate))
└─ プラットフォーム残額     1,400円
    ├─ プラットフォーム手数料   900円
    └─ スタジオ代預り分        500円  → スタジオへ支払い（従来どおり）
Stripe 決済手数料（約3.6% ≒ 198円）はプラットフォーム負担（destination charge の仕様）
※ 返金時に Stripe 決済手数料は返還されない。前日まで全額返金のキャンセルポリシー下では
   この分がプラットフォームのコストになる（料率設定に織り込み済み）
```

## 3. データモデル変更

### users/{uid}（講師）に追加

```
stripeAccountId:        string | null   // Connect アカウントID (acct_...)
stripeChargesEnabled:   boolean         // account.updated webhook で同期
stripePayoutsEnabled:   boolean         // 〃（true になるまで新フロー決済は使わない）
stripeOnboardedAt:      Timestamp|null
```

### reservations に追加（決済時点の記録として不変で持つ）

```
feeRate:          number        // 適用手数料率（例 0.2）
platformFee:      number        // プラットフォーム手数料（円）
teacherPayout:    number        // 講師送金額（円）
transferId:       string|null   // Stripe Transfer ID（destination charge では charge に紐づく）
payoutModel:      "connect" | "legacy"  // 移行期の判別用
```

### 設定（Functions の defineString / Firestore の config どちらか）

```
PLATFORM_FEE_RATE: 手数料率。当面は全講師一律（将来は users にオーバーライド可）
```

## 4. フロー変更

### 4.1 講師オンボーディング（新規）

1. 新 callable `createConnectOnboardingLink`（要 teacher ロール）
   - `stripeAccountId` 未保有なら `stripe.accounts.create({ type: "express", country: "JP", ... })` → users に保存
   - `stripe.accountLinks.create({ type: "account_onboarding", refresh_url, return_url })` の URL を返す
2. フロント: マイページ（講師向け）に「振込口座を登録する」ボタン → 返却 URL へリダイレクト
3. Webhook: `account.updated` を stripeWebhook に追加し、`charges_enabled` / `payouts_enabled` を users に同期
4. 講師ダッシュボード（今後実装）に登録状況バッジを表示

### 4.2 決済（createReservationAndCheckout の変更）

- 講師の `stripePayoutsEnabled === true` のとき、Checkout セッションに追加:

```ts
payment_intent_data: {
  transfer_data: {
    destination: teacherStripeAccountId,
    amount: teacherPayout,          // lessonAmount − platformFee（スタジオ代は含めない）
  },
  // on_behalf_of は当面付けない（明細名義をプラットフォームに保つ）
},
```

- 未オンボーディング講師は **legacy フロー（現行）にフォールバック**し、`payoutModel: "legacy"` を記録（移行期の共存）
- 金額計算はサーバー側のみで行い、reservations に内訳を保存

### 4.3 返金（cancelReservation の変更）

- `stripe.refunds.create({ payment_intent, reverse_transfer: true })` で講師送金分も自動で引き戻す
- 講師残高不足で reverse に失敗するケース（送金→即引き出し後の返金）に備え、失敗時は管理者通知メール＋ reservations にフラグを立てて手動精算
- legacy 予約は現行の返金処理のまま

### 4.4 Webhook 追加分

- `account.updated`: users の enabled フラグ同期
- （任意）`transfer.created` / `payout.paid`: 講師ダッシュボードの「入金済み」表示に使う場合に追加

## 5. 段階導入プラン

| フェーズ | 内容 | 完了条件 |
|---|---|---|
| P0 | Stripe ダッシュボードで Connect（Express）有効化、手数料率の決定、利用規約に報酬・手数料条項を追記 | テスト環境で acct 作成可 |
| P1 | オンボーディング（callable＋マイページ導線＋account.updated webhook） | テスト講師が payouts_enabled になる |
| P2 | 決済の destination charge 化（未登録講師は legacy フォールバック）＋ reservations 内訳記録 | テストカードで送金内訳が意図どおり |
| P3 | 返金の reverse_transfer 対応 | 返金テスト通過 |
| P4 | 講師ダッシュボード連携（手取り・入金状況表示）、legacy フローの廃止判断 | 全講師オンボーディング完了 |

## 6. 要確認事項（実装前に必ず検証）

1. **PayPay × destination charge の互換性**: 現在 `payment_method_types: ["card", "paypay"]`。PayPay が Connect の destination charge / transfer_data に対応しているか Stripe ドキュメントとテスト環境で要確認。非対応なら「PayPay 決済は legacy 扱い（別途精算）」か「カードのみ Connect」の分岐が必要
2. **講師側の受け入れ**: Express オンボーディングでは講師が個人事業主として本人確認・口座登録を行う。案内文と FAQ の整備が必要
3. **手数料率**: **一律 18% で開始（暫定決定・2026-07 協議）**。逓減制（例: 同一講師×生徒の継続 6 回目以降 15%。直接取引の抑止も兼ねる）は運用が安定してから導入。reservations に適用率を記録するため後からの変更・逓減化は過去データと矛盾しない
4. **既存 paid 予約の扱い**: 移行前の売上は従来どおり手動精算（本設計の対象外）。`payoutModel` フィールドで区別できる
5. **Stripe 手数料の負担**: destination charge では決済手数料はプラットフォーム負担。手数料率の設定にこのコストを織り込むこと

## 7. 影響ファイル（実装時）

- `functions/src/index.ts`: `createConnectOnboardingLink`（新規）、`createReservationAndCheckout`（transfer_data 追加・内訳記録）、`stripeWebhook`（account.updated）、`cancelReservation`（reverse_transfer）
- `src/pages/MyPage.tsx` または講師ダッシュボード: オンボーディング導線
- `firestore.rules`: 変更不要の見込み（users の追加フィールドは本人 read で足りる。ただし enabled フラグの書き込みは Functions のみ）
- `.env` / パラメータ: `PLATFORM_FEE_RATE` 追加
