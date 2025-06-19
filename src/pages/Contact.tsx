import React from "react";
import "../index.css";

const Contact: React.FC = () => {
  return (
    <main className="main-content">
      <section className="about-section enhanced fade-in-up">
        <h2 className="section-title">お問い合わせ</h2>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ textAlign: "left", maxWidth: "600px", width: "100%" }}>
            <p className="terms-section-title">メールアドレス：</p>
            <p>
              <a href="mailto:info@geidaiconnect.com">
                info@geidaiconnect.com
              </a>
            </p>

            <p className="terms-section-title">Googleフォーム：</p>
            <p>
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSdUQUhZb_example"
                target="_blank"
                rel="noopener noreferrer"
              >
                お問い合わせフォームはこちら
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Contact;
