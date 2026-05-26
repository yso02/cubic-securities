// src/components/Navbar.jsx
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { searchStocks, isDomestic, fmtPrice, getLogoUrl } from "../api/stockApi";
import "./Navbar.css";

export default function Navbar({ isLoggedIn, onLogout, user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);
  const timerRef = useRef(null);

  const navItems = [
    { label: "홈", path: "/" },
    { label: "AI 분석", path: "/ai" },
    { label: "내 계좌", path: "/account" },
  ];
  const initial = user?.name ? user.name[0].toUpperCase() : "";

  // 검색
  const handleSearch = (q) => {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) { setResults([]); setShowDropdown(false); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await searchStocks(q);
        setResults(res?.slice(0, 8) || []);
        setShowDropdown(true);
      } catch { setResults([]); }
    }, 300);
  };

  const handleSelect = (stock) => {
    sessionStorage.setItem("cubic_detail_stock", JSON.stringify(stock));
    navigate(`/stock/${stock.symbol}`);
    setQuery(""); setResults([]); setShowDropdown(false);
  };

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="topnav">
      <div className="topnav-left">
        <div className="logo" onClick={() => navigate("/")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="6" rx="1" fill="#14b8a6"/><rect x="3" y="15" width="18" height="6" rx="1" fill="#14b8a6"/><rect x="9" y="9" width="6" height="6" rx="1" fill="#0d9488"/></svg>
          <span>CUBIC 증권</span>
        </div>
        <nav className="nav-links">
          {navItems.map(item => (
            <span key={item.path} className={`nav-link ${location.pathname === item.path ? "active" : ""}`}
              onClick={() => navigate(item.path)}>{item.label}</span>
          ))}
        </nav>
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', alignSelf: 'stretch' }}>
        <span style={{ fontSize: '11px', color: 'var(--c-text-muted)', opacity: 0.6 }}>
          빌드 {new Date(__BUILD_TIME__).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })}
        </span>
      </div>

      <div className="topnav-right">
        <div className="search-wrap" ref={searchRef}>
          <div className="search-box">
            <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input type="text" placeholder="종목명 / 코드 검색" value={query}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => { if (results.length) setShowDropdown(true); }} />
            {query && <button className="search-clear" onClick={() => { setQuery(""); setResults([]); setShowDropdown(false); }}>✕</button>}
          </div>
          {showDropdown && results.length > 0 && (
            <div className="search-dropdown">
              {results.map(s => {
                const logo = getLogoUrl(s.symbol, s.market);
                return (
                  <div key={s.symbol} className="search-result" onClick={() => handleSelect(s)}>
                    {logo ? <img src={logo} className="sr-logo" alt="" onError={e=>{e.target.style.display='none';}} /> : <div className="sr-fallback">{s.name?.substring(0,2)}</div>}
                    <div className="sr-info">
                      <span className="sr-name">{s.name}</span>
                      <span className="sr-code">{s.symbol} · {s.market}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isLoggedIn ? (
          <div className="user-area">
            <div className="user-avatar" onClick={() => navigate("/account")}>{initial}</div>
            <span className="user-name" onClick={() => navigate("/account")}>{user?.name}</span>
            <button className="logout-btn" onClick={onLogout}>로그아웃</button>
          </div>
        ) : (
          <div className="auth-btns">
            <button className="login-btn" onClick={() => navigate("/login")}>로그인</button>
          </div>
        )}
      </div>
    </header>
  );
}
