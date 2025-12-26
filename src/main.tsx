// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./contexts/AuthContext"; // 追加：AuthProvider のインポート

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <AuthProvider> {/* 追加：アプリ全体を AuthProvider でラップ */}
      <App />
    </AuthProvider>
  </React.StrictMode>
);
 