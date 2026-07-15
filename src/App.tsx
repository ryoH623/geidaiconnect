// src/App.tsx
// ※ Router（BrowserRouter）は main.tsx で全体を包んでいるため、ここでは Routes/Route のみ使用します。
import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import ScrollToTop from "./components/ScrollToTop";
import GeidaiConnect from "./GeidaiConnectUi";
import Login from "./Login";
import Register from "./pages/Register";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import OperatorInfo from "./pages/OperatorInfo";
import Footer from "./components/Footer";
import ReviewSubmissionPage from "./pages/ReviewSubmissionPage";
import SearchResults from "./components/SearchResults";
import TeacherDetail from "./pages/TeacherDetail";
import Contact from "./pages/Contact";
import RequestPage from "./pages/RequestPage";
import TeacherRecruit from "./pages/TeacherRecruit";
import Terms from "./pages/Terms";
import ReservationForm from "./pages/ReservationForm";
import Faq from "./pages/Faq";
import ScheduleForm from "./pages/teachers/ScheduleForm";
import ScheduleList from "./pages/teachers/ScheduleList";
import TeacherReservations from "./pages/teachers/TeacherReservations";
import RequireAdmin from "./components/RequireAdmin";
import AdminHome from "./pages/admin/AdminHome";
import AdminReservations from "./pages/admin/AdminReservations";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminReviews from "./pages/admin/AdminReviews";
import AdminContacts from "./pages/admin/AdminContacts";
import AdminRequests from "./pages/admin/AdminRequests";
import RequireTeacher from "./components/RequireTeacher";
import TestCheckoutPage from "./pages/TestCheckoutPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import PaymentCancelPage from "./pages/PaymentCancelPage";
import VerifyEmailNotice from "./pages/VerifyEmailNotice";
import MyPage from "./pages/MyPage";
import Profile from "./pages/Profile";
import StudentReservations from "./pages/student/StudentReservations";
import ProtectedRoute from "./ProtectedRoute";

function App() {
  return (
    <div className="app-container">
      <ScrollToTop />
      <Header />

      <div className="main-content">
        <Routes>
          {/* 公開ルート */}
          <Route path="/" element={<GeidaiConnect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/about" element={<OperatorInfo />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/mypage/review" element={<ReviewSubmissionPage />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/teachers/:id" element={<TeacherDetail />} />
          <Route path="/contact" element={<Contact />} />
          {/* 演奏・展示などの依頼フォーム（公開） */}
          <Route path="/request" element={<RequestPage />} />
          <Route path="/terms" element={<Terms />} />
          {/* 講師募集ページ（未ログインの応募者向け・公開） */}
          <Route path="/recruit" element={<TeacherRecruit />} />

          {/* 予約フォーム
              既存の /reserve を残しつつ、
              Stripe の cancel_url などで使う /reservation も受けられるようにする */}
          <Route path="/reserve" element={<ReservationForm />} />
          <Route path="/reservation" element={<ReservationForm />} />

          <Route path="/faq" element={<Faq />} />
          <Route path="/test-checkout" element={<TestCheckoutPage />} />
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/payment/cancel" element={<PaymentCancelPage />} />

          {/* 会員登録後のメール確認案内 */}
          <Route path="/verify-email" element={<VerifyEmailNotice />} />

          {/* 🔐 ログイン必須ルート */}
          <Route
            path="/mypage"
            element={
              <ProtectedRoute>
                <MyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <StudentReservations />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          {/* 🔐 講師専用ルート（ガード付き） */}
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
          <Route
            path="/teacher/reservations"
            element={
              <RequireTeacher>
                <TeacherReservations />
              </RequireTeacher>
            }
          />

          {/* 🔐 管理者専用ルート（ガード付き） */}
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminHome />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/reservations"
            element={
              <RequireAdmin>
                <AdminReservations />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/users"
            element={
              <RequireAdmin>
                <AdminUsers />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/reviews"
            element={
              <RequireAdmin>
                <AdminReviews />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/contacts"
            element={
              <RequireAdmin>
                <AdminContacts />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/requests"
            element={
              <RequireAdmin>
                <AdminRequests />
              </RequireAdmin>
            }
          />
        </Routes>
      </div>

      <Footer />
    </div>
  );
}

export default App;