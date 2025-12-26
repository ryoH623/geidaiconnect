import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { teachers } from "./data/teachers";
import { subjects } from "./data/subjects";
import ReviewList from "./components/ReviewList";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { tagIconMap } from "./utils/tagIconMap";
import { useAuth } from "./hooks/useAuth";
import "./index.css";

const GeidaiConnectUi: React.FC = () => {
  const [selectedPrefecture, setSelectedPrefecture] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [selectedCourse, setSelectedCourse] = useState("");

  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const prefectureOptions = Array.from(
    new Set(teachers.map((t) => t.prefecture))
  ).sort();

  const cityOptions = selectedPrefecture
    ? Array.from(
        new Set(
          teachers
            .filter((t) => t.prefecture === selectedPrefecture)
            .map((t) => t.city)
        )
      ).sort()
    : [];

  const showTeachers = selectedPrefecture && selectedCity;

  const filteredTeachers = teachers.filter(
    (teacher) =>
      teacher.prefecture === selectedPrefecture &&
      teacher.city === selectedCity &&
      (!selectedSubject || teacher.genres.includes(selectedSubject))
  );

  const handleReserveClick = () => {
  if (!user) {
    // 👇 ログインしていない場合、リダイレクト先を一時保存
    sessionStorage.setItem(
      "redirectAfterLogin",
      `/reserve?teacher=${encodeURIComponent(selectedTeacher.name)}&course=${encodeURIComponent(selectedCourse)}`
    );
    navigate("/login");
  } else {
    navigate(
      `/reserve?teacher=${encodeURIComponent(selectedTeacher.name)}&course=${encodeURIComponent(
        selectedCourse
      )}`
    );
  }
};

  return (
    <div>
      <div className="about-section enhanced">
        <h2>GeidaiConnect（ゲイダイ・コネクト）とは？</h2>
        <p className="catch-copy">藝大卒がつなぐ、芸術の架け橋</p>
        <p>
          GeidaiConnectは、東京藝術大学（藝大）を卒業した優れた芸術家たちと、
          音楽や美術を本格的に学びたい方、または演奏・展示を依頼したい方をつなぐ、
          アートと音楽の総合マッチングサービスです。
        </p>
        <p>
          「習いたい」「依頼したい」「つながりたい」——
          GeidaiConnectは、藝大卒のプロフェッショナルが、
          あなたと芸術の世界をつなぐ架け橋となります。
        </p>
      </div>

      <section className="features-section">
        <h3>GeidaiConnectの主な特徴</h3>
        <ul>
          <li>藝大卒の講師による高品質なレッスン</li>
          <li>ジャンルや地域から簡単に講師を検索</li>
          <li>レビュー機能で安心して選べる</li>
          <li>演奏・展示などの依頼マッチングにも対応</li>
          <li>オンラインレッスン対応（講師により）</li>
          <li>子どもから大人まで、幅広いニーズに対応</li>
        </ul>
      </section>

      <section className="search-section fade-in-up">
        <h3>講師を検索する</h3>
        <p>レッスンを受けたい「地域」と「ジャンル」を選ぶと、該当する講師が表示されます。</p>

        <div className="selectors">
          <select
            value={selectedPrefecture}
            onChange={(e) => {
              setSelectedPrefecture(e.target.value);
              setSelectedCity("");
              setSelectedTeacher(null);
            }}
          >
            <option value="">都道府県を選択</option>
            {prefectureOptions.map((pref) => (
              <option key={pref} value={pref}>
                {pref}
              </option>
            ))}
          </select>

          {selectedPrefecture && (
            <select
              value={selectedCity}
              onChange={(e) => {
                setSelectedCity(e.target.value);
                setSelectedTeacher(null);
              }}
            >
              <option value="">市区町村を選択</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          )}

          {selectedCity && (
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                setSelectedTeacher(null);
              }}
            >
              <option value="">ジャンルを選択（任意）</option>
              {subjects.map((subject: string) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          )}
        </div>

        {showTeachers && filteredTeachers.length > 0 && (
          <div className="teacher-list">
            <h3>該当する講師一覧</h3>
            {filteredTeachers.map((teacher) => (
              <button
                key={teacher.name}
                className="teacher-button"
                onClick={() => setSelectedTeacher(teacher)}
              >
                {teacher.name}（{teacher.genres.join("、")}）
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedTeacher && (
        <div className="teacher-profile">
          <div className="teacher-header">
            <div className="teacher-info">
              <div className="teacher-name-row">
                <h2 className="teacher-name">{selectedTeacher.name}</h2>
                <span className="teacher-kana">{selectedTeacher.furigana}</span>
                <div className="teacher-tags">
                  {selectedTeacher.tags?.map((tag: string, index: number) => (
                    <span key={index} className="tag">
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
              </div>
              <p className="teacher-genre">{selectedTeacher.genres.join("、")}</p>
            </div>
            {selectedTeacher.photo && (
              <img
                src={selectedTeacher.photo}
                alt={`${selectedTeacher.name}の写真`}
                className="teacher-image"
              />
            )}
          </div>

          <p className="profile">
            {selectedTeacher.profile.split("\n").map((line: string, i: number) => (
              <span key={i}>
                {line}
                <br />
              </span>
            ))}
          </p>

          {selectedTeacher.courses.length > 0 && (
            <div className="course-table">
              <h4>レッスンコース</h4>
              <form>
                <table>
                  <thead>
                    <tr>
                      <th>選択</th>
                      <th>コース名</th>
                      <th>料金</th>
                      <th>備考</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTeacher.courses.map((c: any, i: number) => (
                      <tr key={i}>
                        <td>
                          <input
                            type="radio"
                            name="course"
                            value={c.title}
                            checked={selectedCourse === c.title}
                            onChange={(e) => setSelectedCourse(e.target.value)}
                          />
                        </td>
                        <td>
                          {c.title}
                          {c.type === "自宅" && c.locationDisplay && (
                            <div style={{ fontSize: "0.8rem", color: "#555" }}>
                              <FontAwesomeIcon icon="location-dot" style={{ marginRight: "0.3rem" }} />
                              {c.locationDisplay}
                            </div>
                          )}
                        </td>
                        <td>{c.price}</td>
                        <td>{c.note || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </form>
            </div>
          )}

          {selectedCourse && (
            <div style={{ marginTop: "1rem" }}>
              <button onClick={handleReserveClick} className="reserve-button">
                このコースで予約する
              </button>
            </div>
          )}

          <div className="review-button-wrapper">
            <button
              onClick={() => navigate(`/mypage/review?teacher=${selectedTeacher.name}`)}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#b89f6b",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              この講師にレビューを書く
            </button>
          </div>

          <ReviewList teacherId={selectedTeacher.name} />
        </div>
      )}
    </div>
  );
};

export default GeidaiConnectUi;
