import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import GeidaiConnect from "./GeidaiConnectUi";
import Login from "./Login";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import OperatorInfo from "./pages/OperatorInfo";
import Footer from "./components/Footer";
import ReviewSubmissionPage from "./pages/ReviewSubmissionPage";
import SearchResults from "./components/SearchResults";
import Contact from "./pages/Contact";
import Terms from "./pages/Terms";
import ReservationForm from "./pages/ReservationForm";

function App() {
  return (
    <div className="app-container">
      <BrowserRouter>
        <Header />

        <div className="main-content">
          <Routes>
            <Route path="/" element={<GeidaiConnect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/about" element={<OperatorInfo />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/mypage/review" element={<ReviewSubmissionPage />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/reserve" element={<ReservationForm />} />
          </Routes>
        </div>

        <Footer />
      </BrowserRouter>
    </div>
  );
}

export default App;
