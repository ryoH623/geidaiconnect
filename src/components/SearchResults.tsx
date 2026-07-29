// 検索結果ページ（/search?keyword=&category=）。
// レイアウトは他ページに合わせ、白カード枠＋中央見出し＋トップページと同じ講師カードで表示する。
// 各カードはクリックで講師詳細（/teachers/:id）へ遷移する。
import React from "react";
import { useLocation, Link } from "react-router-dom";
import { teachers, Teacher } from "../data/teachers";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { tagIconMap } from "../utils/tagIconMap";
import "../index.css";

// コース最安値（例: "4,000円〜"）。トップページと同じ表記。
function minCoursePrice(teacher: Teacher): string | null {
  const prices = teacher.courses
    .map((c) => parseInt(c.price.replace(/[^0-9]/g, ""), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (prices.length === 0) return null;
  return `${Math.min(...prices).toLocaleString()}円〜`;
}

const SearchResults: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const rawKeyword = searchParams.get("keyword") || "";
  const keyword = rawKeyword.toLowerCase();
  const category = searchParams.get("category") || "";

  const filteredTeachers = teachers.filter((teacher) => {
    const name = teacher.name?.toLowerCase() || "";
    const profile = teacher.profile?.toLowerCase() || "";
    const matchKeyword = keyword
      ? name.includes(keyword) || profile.includes(keyword)
      : true;
    const matchCategory = category ? teacher.genres.includes(category) : true;
    return matchKeyword && matchCategory;
  });

  const conditions = [
    category && `ジャンル：${category}`,
    rawKeyword && `キーワード：${rawKeyword}`,
  ]
    .filter(Boolean)
    .join(" / ");

  return (
    <main className="about-section fade-in-up">
      <h2 className="centered-heading-with-border">
        <span>該当する講師一覧</span>
      </h2>

      {conditions && (
        <p style={{ textAlign: "center", color: "#8a8270", marginTop: "-0.5rem" }}>
          {conditions}（{filteredTeachers.length}名）
        </p>
      )}

      {filteredTeachers.length > 0 ? (
        <div className="teacher-card-grid">
          {filteredTeachers.map((teacher) => {
            const price = minCoursePrice(teacher);
            return (
              <Link
                key={teacher.id}
                to={`/teachers/${teacher.id}`}
                className="tcard"
              >
                {teacher.photo && (
                  <img
                    src={teacher.photo}
                    alt={`${teacher.name}の写真`}
                    className="tcard-photo"
                    loading="lazy"
                  />
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
                      <span className="tcard-price">レッスン {price}</span>
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
          条件に合う講師が見つかりませんでした。検索条件を変更してお試しください。
        </p>
      )}
    </main>
  );
};

export default SearchResults;
