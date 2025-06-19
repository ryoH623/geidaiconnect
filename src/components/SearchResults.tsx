import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { teachers } from "../data/teachers";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { tagIconMap } from "../utils/tagIconMap";

const SearchResults: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const keyword = searchParams.get("keyword")?.toLowerCase() || "";
  const category = searchParams.get("category") || "";

  const [selectedTeacherIndex, setSelectedTeacherIndex] = useState<number | null>(null);
  const [filteredTeachers, setFilteredTeachers] = useState<typeof teachers>([]);

  useEffect(() => {
    const results = teachers.filter((teacher) => {
      const name = teacher.name?.toLowerCase() || "";
      const profile = teacher.profile?.toLowerCase() || "";
      const matchKeyword = keyword
        ? name.includes(keyword) || profile.includes(keyword)
        : true;
      const matchCategory = category
        ? teacher.genres.includes(category)
        : true;
      return matchKeyword && matchCategory;
    });
    setFilteredTeachers(results);
    setSelectedTeacherIndex(null);
  }, [keyword, category]);

  const handleSelectTeacher = (index: number) => {
    setSelectedTeacherIndex(index);
  };

  return (
    <div className="teacher-section">
      <h2 className="section-title">該当する講師一覧</h2>
      <div className="teacher-grid">
        {filteredTeachers.length > 0 ? (
          filteredTeachers.map((teacher, index) => (
            <button
              key={index}
              className="teacher-button"
              onClick={() => handleSelectTeacher(index)}
            >
              {teacher.name}（{teacher.genres.join("、")}）
            </button>
          ))
        ) : (
          <p>該当する講師が見つかりませんでした。</p>
        )}
      </div>

      {selectedTeacherIndex !== null && filteredTeachers[selectedTeacherIndex] && (
        <div className="teacher-card">
          <img
            src={filteredTeachers[selectedTeacherIndex].photo}
            alt={`${filteredTeachers[selectedTeacherIndex].name}の写真`}
            className="teacher-image"
          />
          <div className="teacher-info">
            <h3 className="teacher-name">{filteredTeachers[selectedTeacherIndex].name}</h3>
            <p className="teacher-furigana">（{filteredTeachers[selectedTeacherIndex].furigana}）</p>
            <p className="teacher-subject">ジャンル: {filteredTeachers[selectedTeacherIndex].genres.join("、")}</p>
            <p className="teacher-location">
              地域: {filteredTeachers[selectedTeacherIndex].prefecture} {filteredTeachers[selectedTeacherIndex].city}
            </p>
            <p className="teacher-profile">{filteredTeachers[selectedTeacherIndex].profile}</p>

            <div className="teacher-tags">
              {filteredTeachers[selectedTeacherIndex].tags?.map((tag: string, index: number) => (
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

            <div className="teacher-courses">
              {filteredTeachers[selectedTeacherIndex].courses.map((c, i) => (
                <div key={i} className="teacher-course">
                  <strong>{c.title}</strong>：{c.price}
                  {c.type === "自宅" && c.locationDisplay && (
                    <div style={{ fontSize: "0.85rem", color: "#555" }}>
                      <FontAwesomeIcon icon="location-dot" style={{ marginRight: "0.3rem" }} />
                      {c.locationDisplay}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              className="reserve-button"
              onClick={() =>
                navigate(
                  `/reserve?teacher=${encodeURIComponent(
                    filteredTeachers[selectedTeacherIndex].name
                  )}`
                )
              }
            >
              レッスンを予約する
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchResults;
