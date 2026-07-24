import React from "react";
import { Link } from "react-router-dom";
import "../index.css";

// 特定商取引法に基づく表記。
// 【要記入】の項目は事業者ご本人にしか用意できない情報のため、公開前に必ず実際の値へ置き換えてください。
const Todo: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="legal-todo">【要記入：{children}】</span>
);

const LegalNotice: React.FC = () => {
  return (
    <main className="about-section fade-in-up">
      <h2 className="terms-title">特定商取引法に基づく表記</h2>

      <dl className="legal-table">
        <div className="legal-row">
          <dt>販売事業者名</dt>
          <dd>
            <Todo>事業者名（個人の場合は氏名）</Todo>
          </dd>
        </div>

        <div className="legal-row">
          <dt>運営統括責任者</dt>
          <dd>
            <Todo>運営責任者の氏名</Todo>
          </dd>
        </div>

        <div className="legal-row">
          <dt>所在地</dt>
          <dd>
            <Todo>郵便番号・住所</Todo>
            <p className="legal-note">
              ※通信販売では原則として所在地の記載が必要です。個人事業の場合の取り扱いは要確認。
            </p>
          </dd>
        </div>

        <div className="legal-row">
          <dt>電話番号</dt>
          <dd>
            <Todo>電話番号（受付時間も併記）</Todo>
            <p className="legal-note">
              ※記載が必要です。原則としてお問い合わせに対応できる番号を記載します。
            </p>
          </dd>
        </div>

        <div className="legal-row">
          <dt>メールアドレス</dt>
          <dd>info@geidaiconnect.com</dd>
        </div>

        <div className="legal-row">
          <dt>販売URL</dt>
          <dd>https://geidaiconnect.com</dd>
        </div>

        <div className="legal-row">
          <dt>販売価格</dt>
          <dd>
            各講師のプロフィール・コースページに税込価格で表示します（例：レッスン 4,000円〜）。
          </dd>
        </div>

        <div className="legal-row">
          <dt>商品代金以外の必要料金</dt>
          <dd>
            決済手数料は無料です。音楽スタジオを利用する場合のスタジオ代、出張レッスンの出張費などが発生する場合は生徒のご負担となり、その金額・条件は予約時に画面上に表示、または事前に講師と合意のうえ確定します。
          </dd>
        </div>

        <div className="legal-row">
          <dt>お支払い方法</dt>
          <dd>クレジットカードによるオンライン決済（決済代行：Stripe）。</dd>
        </div>

        <div className="legal-row">
          <dt>お支払い時期</dt>
          <dd>
            ご予約時にクレジットカードのお支払い枠を確保し、レッスン開始日の前日にお支払いが確定します。前日までは請求は発生しません。
          </dd>
        </div>

        <div className="legal-row">
          <dt>役務の提供時期</dt>
          <dd>予約フォームで選択いただいた日時に、レッスン（役務）を提供します。</dd>
        </div>

        <div className="legal-row">
          <dt>キャンセル・返金について</dt>
          <dd>
            レッスン開始日時の前日23:59までのキャンセルは、請求が発生しないため返金の手続きも不要です。当日のキャンセルおよび事前連絡のない不参加（無断キャンセル）については、返金いたしかねます。詳細は
            <Link to="/terms">利用規約</Link>
            第8条（キャンセル・返金）をご覧ください。
          </dd>
        </div>
      </dl>

      <p className="legal-updated">最終更新日：2026年7月23日</p>
    </main>
  );
};

export default LegalNotice;
