import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import LeftSidebar from "./components/LeftSidebar";
import TopBar from "./components/TopBar";
import MainDashboard from "./pages/MainDashboard";
import MarketPage from "./pages/MarketPage";
import LoginPage from "./pages/LoginPage";
import AccountPage from "./pages/AccountPage";
import AiPage from "./pages/AiPage";
import StockDetailPage from "./pages/StockDetailPage";
import NewsPage from "./pages/NewsPage";
import { getMyInfo, logout as apiLogout } from "./api/stockApi";
import QuizModal from "./components/QuizModal";
import "./App.css";

function AppLayout({ user, onLogout, onQuizOpen, quizOpen, setQuizOpen, handleLogin }) {
  const location = useLocation();
  const isLogin = location.pathname === "/login";

  return (
    <div className="app-layout">
      {!isLogin && <LeftSidebar user={user} onLogout={onLogout} />}
      <div className={`app-main${isLogin ? " app-main--full" : ""}`}>
        {!isLogin && <TopBar user={user} />}
        <div className="app-content">
          <Routes>
            <Route path="/" element={<MainDashboard user={user} />} />
            <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />} />
            <Route path="/ai" element={<AiPage user={user} />} />
            <Route path="/stock/:symbol" element={<StockDetailPage user={user} />} />
            <Route path="/market" element={<MarketPage user={user} />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/account" element={user ? <AccountPage user={user} /> : <Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
      {!isLogin && <Sidebar user={user} onQuizOpen={onQuizOpen} />}
      {quizOpen && <QuizModal onClose={() => setQuizOpen(false)} />}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [quizOpen, setQuizOpen] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("cubic_token");
    if (!token) { setChecking(false); return; }
    (async () => {
      try {
        const me = await getMyInfo();
        setUser(me);
        sessionStorage.setItem("cubic_user", JSON.stringify(me));
      } catch {
        try {
          const saved = sessionStorage.getItem("cubic_user");
          if (saved) setUser(JSON.parse(saved));
        } catch {}
      } finally { setChecking(false); }
    })();
  }, []);

  const handleLogin = (userInfo) => {
    setUser(userInfo);
    sessionStorage.setItem("cubic_user", JSON.stringify(userInfo));
  };

  const handleLogout = () => { apiLogout(); setUser(null); };

  if (checking) return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>불러오는 중...</div>;

  return (
    <BrowserRouter>
      <AppLayout
        user={user}
        onLogout={handleLogout}
        onQuizOpen={() => setQuizOpen(true)}
        quizOpen={quizOpen}
        setQuizOpen={setQuizOpen}
        handleLogin={handleLogin}
      />
    </BrowserRouter>
  );
}
