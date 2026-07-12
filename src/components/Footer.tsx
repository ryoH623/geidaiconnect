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
          <a href="/privacy">プライバシーポリシー</a>
          <a href="/contact">お問い合わせ</a>
          <a href="/recruit">講師募集</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
