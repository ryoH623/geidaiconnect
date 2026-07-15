// src/components/ScrollToTop.tsx
// ルート（パス）が変わるたびにページ先頭へスクロールする。
// React Router は遷移時に自動で先頭へ戻らないため、前ページのスクロール位置を
// 引き継いで遷移先の途中・下部に着地してしまうのを防ぐ。
// ※ 同一ページ内アンカー（#hash）への遷移では先頭に戻さない。
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ScrollToTop: React.FC = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) return; // ページ内アンカー指定時はそのアンカー位置を優先
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
