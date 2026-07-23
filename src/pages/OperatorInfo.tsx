import React from "react";
import "../index.css";

const OperatorInfo: React.FC = () => {
  return (
    // App.tsx 側の <main className="main-content"> の中に入る前提で、ここでは <section> だけ返す
    <section className="operator-info-section fade-in-up">
      <h2 className="titled-section">運営者情報</h2>

      <div className="operator-content">
        <p>
          <strong>所在地：</strong>
          東京都（詳細はお問い合わせ時に開示）
        </p>
        <p>
          <strong>設立：</strong>
          2025年（予定）
        </p>

        <h3>事業内容：</h3>
        <ul>
          <li>藝大卒講師による音楽・美術レッスンの仲介</li>
          <li>演奏・展示などのマッチング</li>
          <li>その他、芸術家支援に関する事業</li>
        </ul>

        <h3>東京藝術大学との関係：</h3>
        <p>
          GeidaiConnect（本サービス）は、東京藝術大学の卒業生が参加する民間の仲介サービスです。
          東京藝術大学および同大学の関連団体が運営・監修・公認・提携するものではなく、大学とは資本・運営上の関係はありません。
          なお「藝大」「東京藝術大学」等の名称は、講師の経歴（出身校）を示す目的で使用しています。
        </p>
      </div>
    </section>
  );
};

export default OperatorInfo;
