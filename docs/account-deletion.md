# 退会（アカウント削除）

作成日: 2026-10-05 / ステータス: **実装済み・未デプロイ**

実装は `functions/src/accountDeletion.ts`（index.ts からは再エクスポートのみ）。
本人の退会と運営による強制退会は、同じ `deleteAccount()` を通る。

---

## 1. 入口

| 経路 | 画面 | 関数 | 条件 |
|---|---|---|---|
| 本人 | `/mypage/withdraw`（マイページ下部「退会について」） | `checkMyAccountDeletion` → `deleteMyAccount` | 直前にパスワードで再認証していること（`auth_time` が10分以内） |
| 運営 | `/admin/users` の「強制退会」 | `adminDeleteUser` | admin のみ。理由の入力が必須 |

管理者アカウントはどちらの経路でも削除できない（運営の締め出し防止）。必要なら Firebase コンソールで行う。

## 2. 退会できない条件

次の予約が1件でもあれば退会させない（生徒としての予約・講師としての予約の両方を見る）。
先にキャンセルしてもらう。運営の強制退会も同じ条件。

| 理由 | 判定 |
|---|---|
| 今後のレッスン | 有効な予約で `lessonDate >= 今日（JST）` |
| 決済手続き中 | `reservationStatus === "pending"` |
| お支払い未確定 | `paymentStatus` が `pending_payment` / `authorized` / `payment_failed` で、レッスン日が過去 |

`expired` / `cancelled` / `failed` / `refunded` の予約は終わったものとして無視する。

## 3. 退会で行うこと

| 対象 | 処理 |
|---|---|
| `users/{uid}` | 個人情報を消し、`{ uid, role, createdAt, status: "deleted", deletedBy, deletedAt }` だけを残す（`createdAt` は月別登録数の集計用） |
| Firebase Auth | アカウントを削除（最後に実行） |
| `coupons` | `available` / `reserved` を `cancelled` に（`cancelReason: "退会"`） |
| `referralCodes` | 本人のコードを削除（以後そのコードで紹介を登録できない） |
| `referrals` | 記録は残す。紹介者が退会済みなら紹介者特典は付与しない（被紹介者の特典はそのまま） |
| `reviews` | 本文・評価・講師の返信は残し、`userId` を削除して `authorDeleted: true` を付ける |
| `reservations`（生徒） | 氏名・メール・金額・日時は会計記録として残す。`phone` / `notes` / `lessonLat` / `lessonLng` と、出張レッスンの `location`（生徒の住所）を消す。`studentDeleted: true` |
| `reservationPayouts` | 変更しない |
| `schedules`（講師） | 予約の入っていない枠（`reserved` / `booked` 以外）を削除 |
| `teacherProfiles`（講師） | `published: false`, `status: "withdrawn"`, `withdrawn: true`。管理画面から再公開はできない |
| `deletedEmails/{sha256(メール)}` | 再登録の判定用。メールアドレスそのものは残さない |
| `accountDeletions/{uid}` | 退会の記録（誰が・いつ・なぜ・件数） |
| メール | 本人に退会完了（強制退会の場合は削除）の通知 |

各手順は何度実行しても同じ結果になる。途中で失敗した場合（書き込みや Auth 削除のエラー）は
エラーを返すので、もう一度実行すれば続きから完了する。

## 4. 再登録への対策

退会したメールアドレスで登録し直して紹介コードを入力した場合、紹介は登録するが
`blocked: true` / `blockedReason: "rejoined"` にして特典を止める（同一人物の疑いと同じ扱い）。
運営が `/admin/referrals` で確認し、問題なければ解除できる。

レビュー投稿キャンペーンは対象外（付与には有料のレッスンを1回受ける必要があるため、取り直しの旨味が小さい）。

## 5. 運用上の注意

- 公開中の講師一覧・詳細は `teacherProfiles`（`published == true`）から読むため、退会した講師は自動で表示されなくなる。
  `src/data/teachers.ts` は移行用の初期データで、取り込みは既存のドキュメントを上書きしないため退会者が復活することもない。
- 別の端末にログイン状態が残っている場合は、`AuthContext` が `status: "deleted"` を見てログアウトさせる。
  Firestore ルールでも退会済みの `users` は更新できない。
- 退会者から「レビュー本文に個人が特定できる内容がある」と削除依頼があれば、`/admin/reviews` から個別に削除する。
- 退会した講師の過去の予約・手数料明細は残る。講師への未払いの報酬がある場合は、退会前に精算を済ませる。
- 予約記録の保存期間（会計記録として7年を想定）を過ぎたものの削除は未実装。
