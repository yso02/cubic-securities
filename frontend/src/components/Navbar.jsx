// src/components/Navbar.jsx
import { useNavigate, useLocation } from "react-router-dom";
import "./Navbar.css";

export default function Navbar({ isLoggedIn, onLogout, user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = [
    { label: "홈", path: "/" },
    { label: "AI 분석", path: "/ai" },
    { label: "내 계좌", path: "/account" },
  ];
  const initial = user?.name ? user.name[0].toUpperCase() : "";

  return (
    <header className="topnav">
      <div className="topnav-left">
        <div className="logo" onClick={() => navigate("/")}>CUBIC 증권</div>
        <nav className="nav-links">
          {navItems.map(item => (
            <span key={item.path} className={`nav-link ${location.pathname === item.path ? "active" : ""}`}
              onClick={() => navigate(item.path)}>{item.label}</span>
          ))}
        </nav>
      </div>
      <div className="topnav-right">
        <div className="search-box" onClick={() => document.querySelector(".search-box input")?.focus()}>
          <i className="search-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </i>
          <span>종목명 또는 코드</span>
        </div>
        {isLoggedIn ? (
          <div className="user-area">
            <div className="user-avatar" onClick={() => navigate("/account")}>{initial}</div>
            <span className="user-name">{user?.name}</span>
            <button className="logout-btn" onClick={onLogout}>로그아웃</button>
          </div>
        ) : (
          <div className="auth-btns">
            <button className="signup-btn" onClick={() => navigate("/login")}>회원가입</button>
            <button className="login-btn" onClick={() => navigate("/login")}>로그인</button>
          </div>
        )}
      </div>
    </header>
  );
}
