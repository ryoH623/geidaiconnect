import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faUser } from '@fortawesome/free-solid-svg-icons';
import { useState } from "react";
import "./Header.css";
import { Link, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("");
  const navigate = useNavigate();

  const { user, role } = useAuth();

  const handleReset = () => {
    setKeyword("");
    setCategory("");
  };

  const handleSearch = () => {
    alert(`検索: キーワード=${keyword}, カテゴリ=${category}`);
  };

  const handleProfileClick = () => {
    navigate("/mypage");
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMenuOpen(false);
      navigate("/");
    } catch (err) {
      console.error("ログアウトに失敗しました:", err);
      alert("ログアウトに失敗しました。");
    }
  };

  return (
    <header className="header">
      {/* 左：ハンバーガー + 検索 */}
      <div className="left">
        <button className="menu-icon" onClick={() => {
          setMenuOpen(true);
          onMenuClick?.();
        }}>
          &#9776;
        </button>

        {menuOpen && (
          <div className="menu-dropdown">
            <button className="close-icon" onClick={() => setMenuOpen(false)}>✕</button>
            <hr />
            {user && (
              <>
                <Link to="/history" onClick={() => setMenuOpen(false)}>履歴情報</Link>
                <Link to="/profile" onClick={() => setMenuOpen(false)}>会員情報</Link>
                <hr />
              </>
            )}
            <Link to="/faq" onClick={() => setMenuOpen(false)}>よくあるご質問</Link>

            {/* ✅ ログイン中かつ講師の場合のみ表示 */}
            {user && role === "teacher" && (
              <>
                <Link to="/schedule-form" onClick={() => setMenuOpen(false)}>スケジュール登録</Link>
                <Link to="/schedule-list" onClick={() => setMenuOpen(false)}>スケジュール一覧</Link>
              </>
            )}

            {user ? (
              <button type="button" className="menu-logout-button" onClick={handleLogout}>
                ログアウト
              </button>
            ) : (
              <Link to="/login" onClick={() => setMenuOpen(false)}>ログイン</Link>
            )}
            <hr />
          </div>
        )}

        <button className="search-icon" onClick={() => setSearchOpen(!searchOpen)}>
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </button>

        {searchOpen && (
          <div className="search-dropdown">
            <button className="close-icon" onClick={() => setSearchOpen(false)}>✕</button>
            <div className="search-form">
              <input
                type="text"
                placeholder="キーワード"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">カテゴリを選択</option>
                <option value="ピアノ">ピアノ</option>
                <option value="声楽">声楽</option>
                <option value="ヴァイオリン">ヴァイオリン</option>
                <option value="チェロ">チェロ</option>
                <option value="フルート">フルート</option>
                <option value="クラリネット">クラリネット</option>
                <option value="絵画">絵画</option>
                <option value="日本画">日本画</option>
                <option value="油絵">油絵</option>
              </select>
              <button onClick={handleReset}>リセット</button>
              <button onClick={handleSearch}>絞り込み</button>
            </div>
          </div>
        )}
      </div>

      {/* 中央：ロゴ */}
      <div className="center">
        <Link to="/" className="logo-link">
          <img
            src="/geidai-logo.png"
            alt="Geidai Connect ロゴ"
            className="logo-image"
          />
        </Link>
      </div>

      {/* 右：マイページアイコン */}
      <div className="right">
        <button className="profile-icon" onClick={handleProfileClick}>
          <FontAwesomeIcon icon={faUser} />
        </button>
      </div>
    </header>
  );
}
