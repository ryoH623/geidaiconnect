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
      </div>
    </section>
  );
};

export default OperatorInfo;
