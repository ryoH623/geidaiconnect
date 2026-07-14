// src/components/RequireAdmin.tsx
// 管理者（users/{uid}.role === "admin"）専用ページのガード
import React, { JSX } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface RequireAdminProps {
  children: JSX.Element;
}

const RequireAdmin: React.FC<RequireAdminProps> = ({ children }) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>読み込み中...</div>;
  }

  if (!user || role !== "admin") {
    // 未ログイン or 管理者以外はトップページへリダイレクト
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
};

export default RequireAdmin;
