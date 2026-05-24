// src/components/Sidebar.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getWatchlist, addWatchlist, removeWatchlist,
  isDomestic, fmt, fmtPrice, fmtChange, isUp, getLogoUrl,
} from "../api/stockApi";
import "./Sidebar.css";

function SunIcon(){return<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;}
function MoonIcon(){return<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;}

export default function Sidebar({ user }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("cubic_sb_collapsed") === "true");
  const [openPanel, setOpenPanel] = useState(null);
  const [dark, setDark] = useState(() => localStorage.getItem("cubic_dark") === "true");

  // 관심종목
  const [watchlist, setWatchlist] = useState([]);
  useEffect(() => { if (user) loadWatchlist(); }, [user]);
  const loadWatchlist = async () => { try { setWatchlist(await getWatchlist() || []); } catch {} };
  const handleRemoveWatch = async (s, e) => {
    e.stopPropagation();
    try { await removeWatchlist(s.symbol); await loadWatchlist(); } catch {}
  };

  // 최근 본 종목 (sessionStorage)
  const [recentStocks, setRecentStocks] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("cubic_recent") || "[]"); } catch { return []; }
  });

  // 다른 페이지에서 종목 클릭 시 recent 갱신 감지
  useEffect(() => {
    const handler = () => {
      try { setRecentStocks(JSON.parse(sessionStorage.getItem("cubic_recent") || "[]")); } catch {}
    };
    window.addEventListener("cubic_recent_update", handler);
    // 주기적 체크 (다른 컴포넌트에서 sessionStorage 변경 감지)
    const interval = setInterval(handler, 2000);
    return () => { window.removeEventListener("cubic_recent_update", handler); clearInterval(interval); };
  }, []);

  // 다크모드
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("cubic_dark", dark);
  }, [dark]);

  // 사이드바 접기
  useEffect(() => { localStorage.setItem("cubic_sb_collapsed", collapsed); }, [collapsed]);

  const togglePanel = (id) => {
    if (collapsed) { setCollapsed(false); setOpenPanel(id); return; }
    setOpenPanel(prev => prev === id ? null : id);
  };

  const handleStockClick = (stock) => {
    sessionStorage.setItem("cubic_detail_stock", JSON.stringify(stock));
    navigate(`/stock/${stock.symbol}`);
    setOpenPanel(null);
  };

  if (collapsed) {
    return (
      <div className="sidebar collapsed">
        <button className="sb-toggle" onClick={() => setCollapsed(false)} title="사이드바 열기">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className={`slide-panel ${openPanel ? "open" : ""}`}>
        {openPanel === "watchlist" && (
          <PanelShell title="관심종목" sub={`${watchlist.length}개`}>
            {!watchlist.length ? <EmptyMsg icon="♡" title="관심 종목이 없어요" desc={"종목 옆 ☆ 버튼을 눌러\n관심종목을 추가해 보세요."} /> :
            <div className="panel-list">{watchlist.map(s => (
              <div key={s.symbol} className="panel-item" onClick={() => handleStockClick(s)}>
                <div className="panel-item-left">
                  <LogoIcon symbol={s.symbol} name={s.name} market={s.market} />
                  <div><strong>{s.name}</strong><small>{s.symbol}</small></div>
                </div>
                <div className="panel-item-right">
                  <button onClick={e => handleRemoveWatch(s, e)} className="remove-btn">★</button>
                </div>
              </div>
            ))}</div>}
          </PanelShell>
        )}
        {openPanel === "recent" && (
          <PanelShell title="최근 본 종목" sub={`${recentStocks.length}개`}>
            {!recentStocks.length ? <EmptyMsg icon="🕐" title="최근 본 종목이 없어요" desc={"종목을 클릭하면\n여기에 기록됩니다."} /> :
            <div className="panel-list">{recentStocks.map(s => (
              <div key={s.symbol} className="panel-item" onClick={() => handleStockClick(s)}>
                <div className="panel-item-left">
                  <LogoIcon symbol={s.symbol} name={s.name} market={s.market} />
                  <div><strong>{s.name}</strong><small>{s.symbol} · {s.market}</small></div>
                </div>
                <span className={isUp(s.changePercent) ? "up" : "dn"}>{s.changePercent ? fmtChange(s.changePercent) : ""}</span>
              </div>
            ))}</div>}
          </PanelShell>
        )}
      </div>

      <div className="icon-col">
        <button className="sb-toggle" onClick={() => setCollapsed(true)} title="사이드바 접기">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        <button className={`sb-btn ${openPanel === "watchlist" ? "active" : ""}`} onClick={() => togglePanel("watchlist")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span>관심</span>
        </button>

        <button className={`sb-btn ${openPanel === "recent" ? "active" : ""}`} onClick={() => togglePanel("recent")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>최근본</span>
        </button>

        <div className="sb-spacer" />

        <button className="sb-btn dark-toggle" onClick={() => setDark(v => !v)} title={dark ? "라이트 모드" : "다크 모드"}>
          {dark ? <SunIcon /> : <MoonIcon />}
          <span>{dark ? "라이트" : "다크"}</span>
        </button>
      </div>
    </div>
  );
}

function LogoIcon({ symbol, name, market }) {
  const url = getLogoUrl(symbol, market);
  if (url) return <img src={url} className="panel-logo" alt="" onError={e => { e.target.style.display = 'none'; }} />;
  return <div className="panel-logo-fb">{name?.substring(0, 2)}</div>;
}

function PanelShell({ title, sub, children }) {
  return <div className="panel-shell"><div className="panel-hd"><span className="panel-title">{title}</span>{sub && <span className="panel-sub">{sub}</span>}</div><div className="panel-body">{children}</div></div>;
}

function EmptyMsg({ icon, title, desc }) {
  return <div className="panel-empty"><span className="panel-empty-ico">{icon}</span><p className="panel-empty-title">{title}</p><p className="panel-empty-desc">{desc}</p></div>;
}
