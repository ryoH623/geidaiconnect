import React from "react";
import "../index.css";

const Footer: React.FC = () => {
  return (
    <footer className="footer refined-footer">
      <div className="footer-content">
        <p>&copy; {new Date().getFullYear()} GeidaiConnect. All rights reserved.</p>
        <div className="footer-links">
          <a href="/about">運営者情報</a>
          <a href="/terms">利用規約</a>
          <a href="/legal">特定商取引法に基づく表記</a>
          <a href="/privacy">プライバシーポリシー</a>
          <a href="/contact">お問い合わせ</a>
          <a href="/recruit">講師募集</a>
        </div>
        <p className="footer-disclaimer">
          GeidaiConnectは東京藝術大学の卒業生有志による民間サービスです。東京藝術大学および関連団体が運営・公認・提携するものではありません。
        </p>
      </div>
    </footer>
  );
};

export default Footer;
