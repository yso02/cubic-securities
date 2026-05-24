// src/components/Sidebar.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getWatchlist, removeWatchlist,
  isDomestic, fmt, fmtPrice, fmtChange, isUp, getLogoUrl,
} from "../api/stockApi";
import "./Sidebar.css";

function SunIcon(){return<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;}
function MoonIcon(){return<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;}

export default function Sidebar({ user }) {
  const navigate = useNavigate();
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

  // 최근 본 종목
  const [recentStocks, setRecentStocks] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("cubic_recent") || "[]"); } catch { return []; }
  });
  useEffect(() => {
    const handler = () => { try { setRecentStocks(JSON.parse(sessionStorage.getItem("cubic_recent") || "[]")); } catch {} };
    window.addEventListener("cubic_recent_update", handler);
    const interval = setInterval(handler, 2000);
    return () => { window.removeEventListener("cubic_recent_update", handler); clearInterval(interval); };
  }, []);

  // 다크모드
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("cubic_dark", dark);
  }, [dark]);

  const togglePanel = (id) => setOpenPanel(prev => prev === id ? null : id);

  const handleStockClick = (stock) => {
    sessionStorage.setItem("cubic_detail_stock", JSON.stringify(stock));
    try {
      const recent = JSON.parse(sessionStorage.getItem("cubic_recent") || "[]");
      const updated = [stock, ...recent.filter(s => s.symbol !== stock.symbol)].slice(0, 10);
      sessionStorage.setItem("cubic_recent", JSON.stringify(updated));
      window.dispatchEvent(new Event("cubic_recent_update"));
    } catch {}
    navigate(`/stock/${stock.symbol}`);
    setOpenPanel(null);
  };

  return (
    <div className="sidebar">
      {/* 슬라이드 패널 */}
      <div className={`slide-panel ${openPanel ? "open" : ""}`}>
        {openPanel === "watchlist" && (
          <Panel title="관심종목" sub={`${watchlist.length}개`}>
            {!watchlist.length ? <Empty icon="♡" title="관심 종목이 없어요" desc={"종목 옆 ☆ 버튼을 눌러\n관심종목을 추가해 보세요."} /> :
            <div className="sb-list">{watchlist.map(s => (
              <div key={s.symbol} className="sb-item" onClick={() => handleStockClick(s)}>
                <div className="sb-item-left"><Logo symbol={s.symbol} name={s.name} market={s.market} /><div><strong>{s.name}</strong><small>{s.symbol}</small></div></div>
                <button onClick={e => handleRemoveWatch(s, e)} className="sb-remove">★</button>
              </div>
            ))}</div>}
          </Panel>
        )}
        {openPanel === "recent" && (
          <Panel title="최근 본 종목" sub={`${recentStocks.length}개`}>
            {!recentStocks.length ? <Empty icon="🕐" title="최근 본 종목이 없어요" desc={"종목을 클릭하면\n여기에 기록됩니다."} /> :
            <div className="sb-list">{recentStocks.map(s => (
              <div key={s.symbol} className="sb-item" onClick={() => handleStockClick(s)}>
                <div className="sb-item-left"><Logo symbol={s.symbol} name={s.name} market={s.market} /><div><strong>{s.name}</strong><small>{s.symbol} · {s.market}</small></div></div>
                <span className={isUp(s.changePercent) ? "up" : "dn"}>{s.changePercent ? fmtChange(s.changePercent) : ""}</span>
              </div>
            ))}</div>}
          </Panel>
        )}
        {openPanel === "realtime" && (
          <Panel title="실시간 체결" sub="주요 종목">
            <Empty icon="⚡" title="실시간 체결 내역" desc={"장 시간 중에\n실시간 체결 데이터가 표시됩니다."} />
          </Panel>
        )}
      </div>

      {/* 아이콘 열 (항상 보임) */}
      <div className="sb-icons">
        <button className="sb-toggle" onClick={() => setOpenPanel(prev => prev ? null : "watchlist")} title={openPanel ? "닫기" : "열기"}>
          {openPanel ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>}
        </button>

        <button className={`sb-btn ${openPanel==="watchlist"?"active":""}`} onClick={()=>togglePanel("watchlist")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span>관심</span>
        </button>
        <button className={`sb-btn ${openPanel==="recent"?"active":""}`} onClick={()=>togglePanel("recent")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>최근본</span>
        </button>
        <button className={`sb-btn ${openPanel==="realtime"?"active":""}`} onClick={()=>togglePanel("realtime")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <span>실시간</span>
        </button>

        <div className="sb-spacer" />
        <button className="sb-btn" onClick={() => setDark(v => !v)} title={dark ? "라이트 모드" : "다크 모드"}>
          {dark ? <SunIcon /> : <MoonIcon />}
          <span>{dark ? "라이트" : "다크"}</span>
        </button>
      </div>
    </div>
  );
}

function Logo({ symbol, name, market }) {
  const url = getLogoUrl(symbol, market);
  if (url) return <img src={url} className="sb-logo" alt="" onError={e=>{e.target.style.display='none';}} />;
  return <div className="sb-logo-fb">{name?.substring(0,2)}</div>;
}
function Panel({ title, sub, children }) {
  return <div className="sb-panel"><div className="sb-panel-hd"><span className="sb-panel-title">{title}</span>{sub&&<span className="sb-panel-sub">{sub}</span>}</div>{children}</div>;
}
function Empty({ icon, title, desc }) {
  return <div className="sb-empty"><span className="sb-empty-ico">{icon}</span><p className="sb-empty-t">{title}</p><p className="sb-empty-d">{desc}</p></div>;
}
