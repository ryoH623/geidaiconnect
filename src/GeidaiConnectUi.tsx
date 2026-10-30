import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTeachers } from "./hooks/useTeachers";
import { minCoursePriceLabel } from "./lib/teacherProfiles";
import BudouxText from "./components/BudouxText";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGraduationCap,
  faMagnifyingGlassLocation,
  faStar,
  faHouseChimney,
  faCalendarCheck,
  faCreditCard,
  faHandshake,
  faUserPlus,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { tagIconMap } from "./utils/tagIconMap";
import "./index.css";

// よくある質問の抜粋（全文は /faq）
const faqItems = [
  {
    q: "初心者や子どもでも申し込めますか？",
    a: "はい。「初心者歓迎」の講師が在籍しています。対象年齢は講師ごとに異なるため、各プロフィールをご確認ください。",
  },
  {
    q: "いつ請求されますか？",
    a: "ご予約の時点ではカードのお支払い枠を確保するだけです。実際のお支払いはレッスン前日に確定します。",
  },
  {
    q: "東京藝術大学の公式サービスですか？",
    a: "いいえ。藝大卒業生の有志が運営する民間サービスで、大学および関連団体が運営・公認・提携するものではありません。",
  },
];

// トップページの特徴カード（選ぶ理由を3つに絞る）
const featureItems = [
  {
    icon: faGraduationCap,
    title: "藝大卒の講師だけ",
    text: "講師は全員、東京藝術大学の卒業生。お子さまの習い事から大人の学び直しまで、プロが丁寧に教えます。",
  },
  {
    icon: faHouseChimney,
    title: "通いやすい場所で",
    text: "講師の自宅・スタジオ・ご自宅への出張・オンラインから、通いやすい形を選べます（講師により対応）。",
  },
  {
    icon: faStar,
    title: "レビューで選べる",
    text: "実際に受講した方のレビューや料金、空き日程を見比べて、納得して講師を選べます。",
  },
];

// ご利用の流れ（予約までの3ステップ）
const flowSteps = [
  {
    icon: faMagnifyingGlassLocation,
    title: "講師を探す",
    text: "プロフィールやレビュー、料金を見て講師を選びます。",
  },
  {
    icon: faCalendarCheck,
    title: "日時を選んで予約",
    text: "空き状況カレンダーから日時とコースを選びます。",
  },
  {
    icon: faCreditCard,
    title: "オンライン決済で完了",
    text: "カードで決済すると、予約受付のメールが届きます。",
  },
];

// ヒーローの装飾アート（金彩の月と流れる弦をイメージした抽象画）
const HeroArt: React.FC = () => (
  <svg
    className="hero-art"
    viewBox="0 0 1440 720"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <linearGradient id="heroGold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ecd9a8" stopOpacity="0.9" />
        <stop offset="0.5" stopColor="#b89f6b" stopOpacity="0.6" />
        <stop offset="1" stopColor="#8f7445" stopOpacity="0.35" />
      </linearGradient>
      <radialGradient id="heroGlow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#d9bd82" stopOpacity="0.35" />
        <stop offset="0.7" stopColor="#b89f6b" stopOpacity="0.08" />
        <stop offset="1" stopColor="#b89f6b" stopOpacity="0" />
      </radialGradient>
      {/* 中央のテキスト帯では弦を淡くして文字と重ならないようにする */}
      <linearGradient id="heroStringFade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#c9b078" stopOpacity="0.85" />
        <stop offset="0.28" stopColor="#c9b078" stopOpacity="0.12" />
        <stop offset="0.72" stopColor="#c9b078" stopOpacity="0.12" />
        <stop offset="1" stopColor="#c9b078" stopOpacity="0.85" />
      </linearGradient>
    </defs>

    {/* 金箔の月 */}
    <circle cx="1105" cy="285" r="300" fill="url(#heroGlow)" />
    <circle cx="1105" cy="285" r="205" fill="none" stroke="url(#heroGold)" strokeWidth="1.4" />
    <circle cx="1105" cy="285" r="178" fill="none" stroke="#b89f6b" strokeOpacity="0.28" strokeWidth="1" />
    <circle cx="1105" cy="285" r="230" fill="none" stroke="#b89f6b" strokeOpacity="0.14" strokeWidth="0.8" />

    {/* 流れる五線（弦）— 中央はフェードさせてコピーの可読性を守る */}
    <path d="M-60 430 C 340 320, 760 540, 1500 380" fill="none" stroke="url(#heroStringFade)" strokeWidth="1.4" />
    <path d="M-60 460 C 350 355, 770 570, 1500 415" fill="none" stroke="url(#heroStringFade)" strokeWidth="1.1" opacity="0.7" />
    <path d="M-60 490 C 360 390, 780 600, 1500 450" fill="none" stroke="url(#heroStringFade)" strokeWidth="1" opacity="0.5" />
    <path d="M-60 520 C 370 425, 790 630, 1500 485" fill="none" stroke="url(#heroStringFade)" strokeWidth="0.9" opacity="0.35" />
    <path d="M-60 550 C 380 460, 800 660, 1500 520" fill="none" stroke="url(#heroStringFade)" strokeWidth="0.8" opacity="0.2" />

    {/* 筆致のようなひとはけ */}
    <path
      d="M120 200 C 320 130, 560 170, 700 120 C 600 190, 380 230, 180 235 C 140 232, 110 218, 120 200 Z"
      fill="#b89f6b"
      opacity="0.1"
    />

    {/* 音符のような点 */}
    <circle cx="150" cy="560" r="5" fill="#e3cd97" opacity="0.9" />
    <circle cx="300" cy="610" r="4" fill="#d2b87e" opacity="0.75" />
    <circle cx="1290" cy="560" r="5.5" fill="#e3cd97" opacity="0.85" />
    <circle cx="1180" cy="620" r="3.5" fill="#cdb076" opacity="0.6" />
    <circle cx="250" cy="410" r="3.5" fill="#cdb076" opacity="0.6" />

    {/* きらめき */}
    <path d="M255 150 l5 12 12 5 -12 5 -5 12 -5 -12 -12 -5 12 -5 z" fill="#d8c28a" opacity="0.75" />
    <path d="M830 130 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 z" fill="#cbb27b" opacity="0.55" />
    <path d="M1330 170 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 z" fill="#d8c28a" opacity="0.65" />
    <path d="M90 320 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 z" fill="#cbb27b" opacity="0.5" />
  </svg>
);

const GeidaiConnectUi: React.FC = () => {
  // 講師データは Firestore（公開中のみ）から読む
  const { teachers, loading: teachersLoading } = useTeachers();

  const [selectedPrefecture, setSelectedPrefecture] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  const prefectureOptions = useMemo(
    () => Array.from(new Set(teachers.map((t) => t.prefecture))).sort(),
    [teachers]
  );

  // ジャンルは実際に講師がいるものだけを候補にする
  const genreOptions = useMemo(
    () => Array.from(new Set(teachers.flatMap((t) => t.genres))).sort(),
    [teachers]
  );

  const cityOptions = selectedPrefecture
    ? Array.from(
        new Set(
          teachers
            .filter((t) => t.prefecture === selectedPrefecture)
            .map((t) => t.city)
        )
      ).sort()
    : [];

  // 絞り込みはすべて任意。未選択なら全講師を表示する
  const filteredTeachers = teachers.filter(
    (teacher) =>
      (!selectedPrefecture || teacher.prefecture === selectedPrefecture) &&
      (!selectedCity || teacher.city === selectedCity) &&
      (!selectedSubject || teacher.genres.includes(selectedSubject))
  );

  return (
    <div className="top-page">
      <section className="hero">
        <HeroArt />
        <div className="hero-inner">
          <p className="hero-eyebrow">
            <span className="nowrap-unit">東京藝術大学卒業生とつながる</span>
            <span className="nowrap-unit">マッチングサービス</span>
          </p>
          <h1 className="hero-title">
            藝大の才能を、
            <br />
            あなたのそばに。
          </h1>
          <p className="hero-lead">
            学ぶ人にも、頼む人にも。
            <br />
            芸術のプロと出会える場所、GeidaiConnect。
          </p>
          <div className="hero-actions">
            <a href="#search" className="hero-cta">
              講師を探す
            </a>
            <a href="#about" className="hero-cta hero-cta--ghost">
              GeidaiConnectとは
            </a>
          </div>
        </div>
      </section>

      <section id="search" className="search-section fade-in-up">
        <h3>講師を探す</h3>
        <p className="top-section-lead">
          <BudouxText>
            気になる講師を選ぶと、プロフィール・レッスン内容の確認と予約ができます。
          </BudouxText>
        </p>
        <p className="service-area-note">
          現在の対応エリア：{prefectureOptions.join("・")}（順次拡大中）
        </p>

        <div className="selectors">
          <select
            value={selectedPrefecture}
            onChange={(e) => {
              setSelectedPrefecture(e.target.value);
              setSelectedCity("");
            }}
            aria-label="都道府県で絞り込む"
          >
            <option value="">都道府県（すべて）</option>
            {prefectureOptions.map((pref) => (
              <option key={pref} value={pref}>
                {pref}
              </option>
            ))}
          </select>

          {selectedPrefecture && (
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              aria-label="市区町村で絞り込む"
            >
              <option value="">市区町村（すべて）</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          )}

          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            aria-label="ジャンルで絞り込む"
          >
            <option value="">ジャンル（すべて）</option>
            {genreOptions.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>

        {teachersLoading ? (
          <p style={{ textAlign: "center" }}>講師情報を読み込んでいます…</p>
        ) : filteredTeachers.length > 0 ? (
          <div className="teacher-card-grid">
            {filteredTeachers.map((teacher) => {
              const price = minCoursePriceLabel(teacher);
              return (
                <Link
                  key={teacher.id}
                  to={`/teachers/${teacher.id}`}
                  className="tcard"
                >
                  {teacher.photo ? (
                    <img
                      src={teacher.photo}
                      alt={`${teacher.name}の写真`}
                      className="tcard-photo"
                      loading="lazy"
                    />
                  ) : (
                    // 写真が未登録の講師は、名前の頭文字で代わりの画像を出す
                    <div className="tcard-photo tcard-photo--placeholder" aria-hidden="true">
                      <span>{teacher.name.slice(0, 1)}</span>
                    </div>
                  )}
                  <div className="tcard-body">
                    <p className="tcard-genre">{teacher.genres.join("、")}</p>
                    <h4 className="tcard-name">
                      {teacher.name}
                      <span className="tcard-kana">{teacher.furigana}</span>
                    </h4>
                    <p className="tcard-area">
                      {teacher.prefecture} {teacher.city}
                    </p>
                    {teacher.tags && teacher.tags.length > 0 && (
                      <div className="teacher-tags">
                        {teacher.tags.map((tag) => (
                          <span key={tag} className="tag">
                            {tagIconMap[tag] && (
                              <FontAwesomeIcon
                                icon={tagIconMap[tag]}
                                style={{ marginRight: "0.3rem" }}
                              />
                            )}
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="tcard-footer">
                      {price && (
                        <span className="tcard-price">
                          レッスン {price}
                        </span>
                      )}
                      <span className="tcard-cta">詳細・予約へ →</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="teacher-empty-note">
            条件に合う講師が見つかりませんでした。絞り込みを変更してお試しください。
          </p>
        )}
      </section>
      <section id="about" className="features-section top-about">
        <h3>
          GeidaiConnectとは
          <span className="heading-reading">（ゲイダイ・コネクト）</span>
        </h3>
        <p className="top-section-lead">
          <BudouxText>
            東京藝術大学で研鑽を積んだプロの芸術家に、直接学び、直接依頼できる、音楽と美術のためのマッチングサービスです。
          </BudouxText>
        </p>
        <div className="feature-grid feature-grid--three">
          {featureItems.map((item) => (
            <div key={item.title} className="feature-card">
              <div className="feature-icon">
                <FontAwesomeIcon icon={item.icon} />
              </div>
              <h4>{item.title}</h4>
              <p>
                <BudouxText>{item.text}</BudouxText>
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="flow-section top-flow">
        <h3>ご利用の流れ</h3>
        <div className="flow-grid">
          {flowSteps.map((step, i) => (
            <div key={step.title} className="flow-card">
              <span className="flow-step-number">{i + 1}</span>
              <div className="flow-icon">
                <FontAwesomeIcon icon={step.icon} />
              </div>
              <h4>{step.title}</h4>
              <p>
                <BudouxText>{step.text}</BudouxText>
              </p>
            </div>
          ))}
        </div>
        <p className="flow-note">
          キャンセルの取り扱いについては<Link to="/terms">利用規約</Link>をご覧ください。
        </p>
      </section>

      <section className="top-entry-grid" aria-label="ご依頼・講師募集">
        <Link to="/request" className="top-entry-card">
          <div className="feature-icon">
            <FontAwesomeIcon icon={faHandshake} />
          </div>
          <div className="top-entry-body">
            <h3>演奏・制作のご依頼</h3>
            <p>
              <BudouxText>
                演奏会やイベントへの出演、作品の制作・展示など、藝大卒のプロへのご依頼を承ります。
              </BudouxText>
            </p>
            <span className="top-entry-cta">
              依頼内容を相談する <FontAwesomeIcon icon={faChevronRight} />
            </span>
          </div>
        </Link>
        <Link to="/recruit" className="top-entry-card">
          <div className="feature-icon">
            <FontAwesomeIcon icon={faUserPlus} />
          </div>
          <div className="top-entry-body">
            <h3>講師として登録する</h3>
            <p>
              <BudouxText>
                東京藝術大学の卒業生の方へ。空いた時間にレッスンを開いて、教える場を広げませんか。
              </BudouxText>
            </p>
            <span className="top-entry-cta">
              講師募集を見る <FontAwesomeIcon icon={faChevronRight} />
            </span>
          </div>
        </Link>
      </section>

      <section className="features-section top-faq">
        <h3>よくあるご質問</h3>
        <dl className="top-faq-list">
          {faqItems.map((item) => (
            <div key={item.q} className="top-faq-item">
              <dt>
                <span className="top-faq-mark">Q</span>
                {item.q}
              </dt>
              <dd>
                <BudouxText>{item.a}</BudouxText>
              </dd>
            </div>
          ))}
        </dl>
        <p className="flow-note">
          <Link to="/faq">ほかのご質問を見る</Link>
        </p>
      </section>
    </div>
  );
};

export default GeidaiConnectUi;
