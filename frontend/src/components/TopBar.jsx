import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { searchStocks, getLogoUrl, getMarketIndices, getExchangeRate, fmt, isUp } from "../api/stockApi";
import "./TopBar.css";

function SunIcon(){return<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;}
function MoonIcon(){return<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;}

export default function TopBar({ user }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("cubic_dark") === "true");
  const [indices, setIndices] = useState([]);
  const [exRate, setExRate] = useState(null);
  const searchRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const [idx, rate] = await Promise.allSettled([getMarketIndices(), getExchangeRate()]);
        if (idx.status === "fulfilled") setIndices(idx.value || []);
        if (rate.status === "fulfilled") setExRate(rate.value);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("cubic_dark", dark);
  }, [dark]);

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

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="topbar-wrapper">
      {/* 티커 바 */}
      <div className="ticker-bar">
        <div className="ticker-inner">
          {indices.map((idx, i) => (
            <div key={i} className="ticker-item">
              <span className="ticker-name">{idx.name}</span>
              <span className="ticker-value">{idx.price}</span>
              <span className={`ticker-change ${isUp(idx.changePercent) ? "up" : "dn"}`}>
                {idx.changePercent > 0 ? "▲" : "▼"} {Math.abs(idx.changePercent).toFixed(2)}%
              </span>
            </div>
          ))}
          {exRate && (
            <div className="ticker-item">
              <span className="ticker-name">달러환율</span>
              <span className="ticker-value">{fmt(Math.round(exRate.rate))}</span>
            </div>
          )}
        </div>
      </div>

      {/* 기존 TopBar */}
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-build">
            빌드 {new Date(__BUILD_TIME__).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul", month: "numeric", day: "numeric",
              hour: "numeric", minute: "numeric"
            })}
          </span>
        </div>

        <div className="topbar-center" ref={searchRef}>
          <div className="topbar-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              type="text"
              placeholder="종목명 / 코드 검색"
              value={query}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => { if (results.length) setShowDropdown(true); }}
            />
            {query && <button onClick={() => { setQuery(""); setResults([]); setShowDropdown(false); }}>✕</button>}
          </div>
          {showDropdown && results.length > 0 && (
            <div className="topbar-dropdown">
              {results.map(s => {
                const logo = getLogoUrl(s.symbol, s.market);
                return (
                  <div key={s.symbol} className="topbar-result" onClick={() => handleSelect(s)}>
                    {logo
                      ? <img src={logo} className="tr-logo" alt="" onError={e => { e.target.style.display = "none"; }} />
                      : <div className="tr-fallback">{s.name?.substring(0, 2)}</div>}
                    <div className="tr-info">
                      <span className="tr-name">{s.name}</span>
                      <span className="tr-code">{s.symbol} · {s.market}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="topbar-right">
          <button className="topbar-btn" onClick={() => navigate("/ai?tab=portfolio")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            AI 분석
          </button>
          <button className="topbar-icon-btn" onClick={() => setDark(v => !v)}>
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}
