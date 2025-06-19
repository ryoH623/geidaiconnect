import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Header.css";

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("");

  const navigate = useNavigate();

  const handleReset = () => {
    setKeyword("");
    setCategory("");
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (keyword) params.append("keyword", keyword);
    if (category) params.append("category", category);
    navigate(`/search?${params.toString()}`);
    setSearchOpen(false);
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
            <Link to="/history">履歴情報</Link>
            <Link to="/profile">会員情報</Link>
            <hr />
            <Link to="/faq">よくあるご質問</Link>
            <Link to="/logout">ログアウト</Link>
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

      {/* 中央：ロゴ（リンク付き） */}
      <div className="center">
        <Link to="/" className="logo-link">
          <img
            src="/geidai-logo.png"
            alt="Geidai Connect ロゴ"
            className="logo-image"
          />
        </Link>
      </div>
    </header>
  );
}
