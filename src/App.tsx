import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import GeidaiConnect from "./GeidaiConnectUi";
import Login from "./Login";
import Register from "./pages/Register"; // ✅ 新規登録ページのインポート
import PrivacyPolicy from "./pages/PrivacyPolicy";
import OperatorInfo from "./pages/OperatorInfo";
import Footer from "./components/Footer";
import ReviewSubmissionPage from "./pages/ReviewSubmissionPage";
import SearchResults from "./components/SearchResults";
import Contact from "./pages/Contact";
import Terms from "./pages/Terms";
import ReservationForm from "./pages/ReservationForm";
import Faq from "./pages/Faq"; // 追加：FAQページのインポート
import ScheduleForm from "./pages/teachers/ScheduleForm"; // 🔹 講師専用フォーム
import ScheduleList from "./pages/teachers/ScheduleList"; // 🔹 講師用スケジュール一覧 ← 追加
import RequireTeacher from "./components/RequireTeacher"; // 🔐 講師専用ルート保護

function App() {
  return (
    <div className="app-container">
      <BrowserRouter>
        <Header />

        <div className="main-content">
          <Routes>
            <Route path="/" element={<GeidaiConnect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} /> {/* ✅ 新規登録ルート追加 */}
            <Route path="/about" element={<OperatorInfo />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/mypage/review" element={<ReviewSubmissionPage />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/reserve" element={<ReservationForm />} />
            <Route path="/faq" element={<Faq />} />

            {/* 🔐 講師専用ルート */}
            <Route
              path="/schedule-form"
              element={
                <RequireTeacher>
                  <ScheduleForm />
                </RequireTeacher>
              }
            />

            <Route
              path="/schedule-list"
              element={
                <RequireTeacher>
                  <ScheduleList />
                </RequireTeacher>
              }
            />
          </Routes>
        </div>

        <Footer />
      </BrowserRouter>
    </div>
  );
}

export default App;
