import React from "react";
import "../index.css";

const Faq: React.FC = () => {
  return (
    <main className="main-content titled-section-page">
      <section className="faq-section fade-in-up">
        <h2 className="titled-section">
          <span className="titled-text">よくあるご質問</span>
        </h2>

        <div className="faq-content" style={{ maxWidth: "800px", margin: "0 auto", textAlign: "left" }}>
          <h3>🔰 ご利用に関して</h3>
          <p><strong>Q. GeidaiConnectは東京藝術大学の公式サービスですか？</strong><br />
            A. いいえ。GeidaiConnectは藝大卒業生の有志が運営する民間サービスで、東京藝術大学および関連団体が運営・公認・提携するものではありません。
            講師はいずれも同大学の出身者ですが、大学とは資本・運営上の関係はありません。
          </p>

          <p><strong>Q. 初心者でも申し込めますか？</strong><br />
            A. はい、Geidai Connectには「初心者歓迎」の講師が多数在籍しています。講師プロフィールに「初心者歓迎」タグが表示されています。
          </p>

          <p><strong>Q. どんなジャンルが学べますか？</strong><br />
            A. 音楽（ピアノ・チェロ・声楽など）や美術（絵画・デッサンなど）など、幅広い分野に対応しています。
          </p>

          <p><strong>Q. 子ども向けのレッスンはありますか？</strong><br />
            A. はい、ございます。講師によって対象年齢が異なるため、各プロフィールをご確認ください。
          </p>

          <h3>🏠 レッスン場所について</h3>
          <p><strong>Q. レッスン場所はどこになりますか？</strong><br />
            A. 以下のいずれかからお選びいただけます：<br />
            ・講師の自宅（町名まで公開）<br />
            ・音楽スタジオ（別途スタジオ代が発生）<br />
            ・出張レッスン（ご自宅など）
          </p>

          <p><strong>Q. 講師の住所はどのように伝えられますか？</strong><br />
            A. レッスンが確定した後、運営より予約確認メールでレッスン場所（講師のご自宅住所など）をお知らせします。
            講師の方から直接ご連絡することはありません。
          </p>

          <h3>💰 お支払いについて</h3>
          <p><strong>Q. 支払い方法は何がありますか？</strong><br />
            A. クレジットカードによるオンライン決済のみとなります。予約フォームからお手続きいただけます。
          </p>

          <p><strong>Q. いつ請求されますか？</strong><br />
            A. ご予約の時点ではカードのお支払い枠を確保するだけで、請求は発生しません。
            実際のお支払いはレッスン前日に確定します。
          </p>

          <p><strong>Q. キャンセルした場合は返金されますか？</strong><br />
            A. レッスン前日23:59までにキャンセルされた場合、そもそも請求が発生しないため返金の手続きも不要です。
            当日のキャンセルおよび無断でのご欠席については、返金いたしかねます。
          </p>

          <h3>🗓 予約について</h3>
          <p><strong>Q. レッスンの予約方法は？</strong><br />
            A. 講師のプロフィールから「このコースで予約する」ボタンをクリックし、予約フォームにご入力ください。
          </p>

          <p><strong>Q. 希望の日時に空きがない場合は？</strong><br />
            A. 「その他のご要望」欄にご希望を記入いただければ、講師と個別調整いたします。
          </p>

          <h3>🔒 個人情報について</h3>
          <p><strong>Q. 個人情報は安全ですか？</strong><br />
            A. はい。Geidai Connectではプライバシーポリシーに則り、適切に管理・保護いたします。
          </p>
        </div>
      </section>
    </main>
  );
};

export default Faq;
