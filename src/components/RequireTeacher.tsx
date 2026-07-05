// src/components/RequireTeacher.tsx
import React, { JSX } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface RequireTeacherProps {
  children: JSX.Element;
}

const RequireTeacher: React.FC<RequireTeacherProps> = ({ children }) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  console.log("RequireTeacher", { user, role, loading });
  if (loading) {
    return <div>読み込み中...</div>; // ローディング表示
  }

  if (!user || role !== "teacher") {
    // ユーザーが未ログイン or ロールが講師以外ならトップページへリダイレクト
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
};

export default RequireTeacher;
