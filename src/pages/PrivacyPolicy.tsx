import React from "react";
import "../index.css";

const PrivacyPolicy: React.FC = () => {
  return (
    <main className="main-content">
      <section className="privacy-policy-section fade-in-up">
        <h2 className="titled-section">プライバシーポリシー</h2>

        <div className="privacy-content">
          <h3>1. 事業者情報</h3>
          <p>
            サービス名：GeidaiConnect<br />
            代表者名：半澤遼太郎<br />
            お問い合わせ：info@geidaiconnect.com
          </p>

          <h3>2. 取得する個人情報</h3>
          <p>氏名、メールアドレス、電話番号、レビュー投稿内容、アクセス履歴（ログ・Cookie）</p>

          <h3>3. 利用目的</h3>
          <ul>
            <li>レッスン予約や講師との連絡</li>
            <li>お問い合わせ対応</li>
            <li>サービス向上のための分析</li>
          </ul>

          <h3>4. 第三者提供</h3>
          <p>本人の同意なく第三者に提供することはありません。ただし、法令に基づく場合を除きます。</p>

          <h3>5. 安全管理</h3>
          <p>取得した個人情報は、不正アクセス・漏洩を防止するための対策を講じ、適切に管理します。</p>

          <h3>6. 利用者の権利</h3>
          <p>自己の個人情報について開示・訂正・削除を請求できます。上記連絡先までご連絡ください。</p>

          <h3>7. Cookieの使用</h3>
          <p>Cookie等を使用することがあります。無効にしたい場合はブラウザの設定をご確認ください。</p>

          <h3>8. 改定</h3>
          <p>本ポリシーは予告なく改定されることがあります。改定後は本ページにて告知いたします。</p>

          <h3>9. お問い合わせ</h3>
          <p>
            プライバシーに関するご質問・ご相談は、<br />
            お問い合わせフォームよりご連絡ください。
            <br />
            制定日：2025年6月1日
          </p>
        </div>
      </section>
    </main>
  );
};

export default PrivacyPolicy;
