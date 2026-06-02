import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getWatchlist, addWatchlist, removeWatchlist,
  getMyInfo, getHoldings,
  isDomestic, fmt, fmtChange, isUp,
  getLogoUrl, searchStocks,
} from "../api/stockApi";
import "./MainDashboard.css";

const ICON_COLORS = {
  삼성전자:"#1428A0",SK하이닉스:"#EA002C",현대차:"#002C5F",
  LG화학:"#A50034",카카오:"#FAE100",NAVER:"#76B900",
  셀트리온:"#00A6A0",POSCO홀딩스:"#004B87",기아:"#05141F",
  삼성SDI:"#034EA2",LG에너지솔루션:"#A50034",신한지주:"#0046FF",
  Apple:"#555",NVIDIA:"#76B900",Tesla:"#CC0000",
  Microsoft:"#00A4EF",Amazon:"#FF9900",Alphabet:"#4285F4",Meta:"#1877F2",
};

const TrendLine = () => (
  <svg width="60" height="24" viewBox="0 0 60 24">
    <polyline points="0,18 15,14 30,16 45,8 60,10" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

export default function MainDashboard({ user }) {
  const navigate = useNavigate();

  // 관심종목
  const [watchlist, setWatchlist] = useState([]);

  // 포트폴리오
  const [holdings, setHoldings] = useState([]);
  const [myBalance, setMyBalance] = useState(0);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  // 확장 패널
  const [expandPanel, setExpandPanel] = useState(null);

  // 검색
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [showSearchDrop, setShowSearchDrop] = useState(false);
  const searchRef = useRef(null);
  const searchTimer = useRef(null);

  useEffect(() => {
    if (user) { loadWatchlist(); loadPortfolio(); }
  }, [user]);

  const loadWatchlist = async () => {
    try { setWatchlist(await getWatchlist() || []); } catch {}
  };

  const loadPortfolio = async () => {
    setPortfolioLoading(true);
    try {
      const [me, h] = await Promise.allSettled([getMyInfo(), getHoldings()]);
      if (me.status === "fulfilled") setMyBalance(me.value.balance || 0);
      if (h.status === "fulfilled") setHoldings(h.value || []);
    } finally { setPortfolioLoading(false); }
  };

  const isWatched = (symbol) => watchlist.some(w => w.symbol === symbol);
  const toggleWatch = async (stock, e) => {
    if (e) e.stopPropagation();
    if (!user) { alert("로그인 후 이용해 주세요."); navigate("/login"); return; }
    try {
      if (isWatched(stock.symbol)) await removeWatchlist(stock.symbol);
      else await addWatchlist(stock.symbol, stock.name, stock.market);
      await loadWatchlist();
    } catch {}
  };

  const handleSearch = (q) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults(null); setShowSearchDrop(false); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await searchStocks(q);
        setSearchResults(res?.slice(0, 8) || []);
        setShowSearchDrop(true);
      } catch { setSearchResults([]); }
    }, 300);
  };

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearchDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectStock = (stock) => {
    sessionStorage.setItem("cubic_detail_stock", JSON.stringify(stock));
    navigate(`/stock/${stock.symbol}`);
  };

  const getBg = (name) => ICON_COLORS[name] || "#64748b";

  const totalEval = holdings.reduce((s, h) => s + h.avgPrice * h.quantity, 0);
  const totalBuy = holdings.reduce((s, h) => s + h.avgPrice * h.quantity, 0);
  const totalPL = totalEval - totalBuy;
  const totalPLRate = totalBuy > 0 ? ((totalPL / totalBuy) * 100).toFixed(2) : "0.00";

  const TABLE_HEADER = (
    <div className="section-table-header">
      <span>종목</span>
      <span>가격</span>
      <span>등락률</span>
      <span>거래대금</span>
      <span>Trends</span>
      <span>매수/매도</span>
    </div>
  );

  const renderPortfolioRow = (h, onClickExtra) => (
    <div key={h.id} className="section-row" onClick={() => { handleSelectStock(h); onClickExtra?.(); }}>
      <div className="section-stock-info">
        {(() => {
          const logo = getLogoUrl(h.symbol, h.market);
          return logo
            ? <img src={logo} className="section-logo" alt="" onError={e=>{e.target.style.display="none";}}/>
            : <div className="section-logo-fb" style={{background:getBg(h.name)}}>{h.name?.substring(0,2)}</div>;
        })()}
        <div>
          <div className="section-name">{h.name}</div>
          <div className="section-code">{h.market}</div>
        </div>
      </div>
      <span className="section-val">{fmt(Math.round(h.avgPrice))}{isDomestic(h.market) ? "원" : "$"}</span>
      <span className="section-val" style={{color:"#94a3b8"}}>-</span>
      <span className="section-val">{fmt(Math.round(h.avgPrice * h.quantity))}{isDomestic(h.market) ? "원" : "$"}</span>
      <span className="section-val section-trends"><TrendLine /></span>
      <span className="section-val">
        <span className="section-signal pending">구현예정</span>
      </span>
    </div>
  );

  const renderWatchlistRow = (s, onClickExtra) => (
    <div key={s.symbol} className="section-row" onClick={() => { handleSelectStock(s); onClickExtra?.(); }}>
      <div className="section-stock-info">
        {(() => {
          const logo = getLogoUrl(s.symbol, s.market);
          return logo
            ? <img src={logo} className="section-logo" alt="" onError={e=>{e.target.style.display="none";}}/>
            : <div className="section-logo-fb" style={{background:getBg(s.name)}}>{s.name?.substring(0,2)}</div>;
        })()}
        <div>
          <div className="section-name">{s.name}</div>
          <div className="section-code">{s.symbol}</div>
        </div>
      </div>
      <span className="section-val">-</span>
      <span className={`section-val ${isUp(s.changePercent) ? "up" : "dn"}`}>
        {s.changePercent ? fmtChange(s.changePercent) : "-"}
      </span>
      <span className="section-val" style={{color:"#94a3b8"}}>-</span>
      <span className="section-val section-trends"><TrendLine /></span>
      <span className="section-val">
        <span className="section-signal pending">구현예정</span>
      </span>
    </div>
  );

  return (
    <div className="dash-page">

      {/* 환영 헤더 */}
      <div className="dash-welcome">
        <div className="dash-welcome-left">
          <p className="dash-welcome-sub">돌아오셨군요</p>
          <h1 className="dash-welcome-name">{user?.name || "게스트"}님 👋</h1>
        </div>
        <div className="dash-welcome-right">
          <div className="dash-search-wrap" ref={searchRef}>
            <div className="dash-search-box">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                type="text"
                placeholder="종목명 / 코드 검색"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                onFocus={() => { if (searchResults?.length) setShowSearchDrop(true); }}
              />
              {searchQuery && <button onClick={() => { setSearchQuery(""); setSearchResults(null); setShowSearchDrop(false); }}>✕</button>}
            </div>
            {showSearchDrop && searchResults?.length > 0 && (
              <div className="dash-search-dropdown">
                {searchResults.map(s => {
                  const logo = getLogoUrl(s.symbol, s.market);
                  return (
                    <div key={s.symbol} className="dash-search-result" onClick={() => { handleSelectStock(s); setSearchQuery(""); setSearchResults(null); setShowSearchDrop(false); }}>
                      {logo
                        ? <img src={logo} className="dsr-logo" alt="" onError={e=>{e.target.style.display="none";}}/>
                        : <div className="dsr-fallback">{s.name?.substring(0,2)}</div>}
                      <div className="dsr-info">
                        <span className="dsr-name">{s.name}</span>
                        <span className="dsr-code">{s.symbol} · {s.market}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <button className="dash-ai-btn" onClick={() => navigate("/ai")}>
            <span className="dash-ai-icon">✦</span>
            AI 어시스턴트
          </button>
        </div>
      </div>

      {/* 메인 그리드 */}
      <div className="dash-grid">

        {/* 포트폴리오 퍼포먼스 카드 */}
        <div className="dash-perf-card">
          <div className="perf-header">
            <span className="perf-title">포트폴리오 퍼포먼스</span>
          </div>
          <div className="perf-body">
            <div className="perf-left">
              {user ? (
                <>
                  <p className="perf-sub">오늘 투자 평가금액</p>
                  <div className="perf-total">{fmt(Math.round(totalEval))}원</div>
                  <div className="perf-gain">
                    <span className={totalPL >= 0 ? "up" : "dn"}>
                      {totalPL >= 0 ? "▲" : "▼"} {fmt(Math.round(Math.abs(totalPL)))}원 ({totalPLRate}%)
                    </span>
                  </div>
                  <div className="perf-meta">
                    <div className="perf-meta-item">
                      <span className="perf-meta-label">오늘의 수익</span>
                      <span className="perf-meta-value" style={{color:"#94a3b8"}}>구현 예정</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="perf-login-hint">
                  <p>로그인하면 포트폴리오를 확인할 수 있어요</p>
                  <button onClick={() => navigate("/login")}>로그인</button>
                </div>
              )}
            </div>
            <div className="perf-right">
              <div className="perf-chart-placeholder">
                <span>차트 구현 예정</span>
              </div>
            </div>
          </div>
        </div>

        {/* 포트폴리오 + 관심종목 2컬럼 */}
        <div className="dash-bottom-grid">

          {/* 포트폴리오 테이블 */}
          <div className="dash-section-card">
            <div className="section-header">
              <span className="section-title">내 포트폴리오</span>
              <button className="section-expand-btn" onClick={() => setExpandPanel("portfolio")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
              </button>
            </div>
            {TABLE_HEADER}
            {!user ? (
              <div className="section-empty">로그인이 필요해요</div>
            ) : portfolioLoading ? (
              <div className="section-empty"><div className="loading-spinner-sm"/></div>
            ) : holdings.length === 0 ? (
              <div className="section-empty">보유 종목이 없어요</div>
            ) : (
              <div className="section-list">
                {holdings.slice(0, 5).map(h => renderPortfolioRow(h))}
              </div>
            )}
          </div>

          {/* 관심종목 테이블 */}
          <div className="dash-section-card">
            <div className="section-header">
              <span className="section-title">관심종목</span>
              <button className="section-expand-btn" onClick={() => setExpandPanel("watchlist")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
              </button>
            </div>
            {TABLE_HEADER}
            {!user ? (
              <div className="section-empty">로그인이 필요해요</div>
            ) : watchlist.length === 0 ? (
              <div className="section-empty">관심 종목이 없어요</div>
            ) : (
              <div className="section-list">
                {watchlist.slice(0, 5).map(s => renderWatchlistRow(s))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 확장 오버레이 */}
      {expandPanel && (
        <div className="expand-overlay" onClick={() => setExpandPanel(null)}>
          <div className="expand-modal" onClick={e => e.stopPropagation()}>
            <div className="expand-header">
              <span className="expand-title">
                {expandPanel === "portfolio" ? "내 포트폴리오" : "관심종목"}
              </span>
              <button className="expand-close" onClick={() => setExpandPanel(null)}>✕</button>
            </div>
            <div className="expand-content">
              {TABLE_HEADER}
              {expandPanel === "portfolio" ? (
                holdings.length === 0 ? (
                  <div className="section-empty">보유 종목이 없어요</div>
                ) : (
                  <div className="section-list">
                    {holdings.map(h => renderPortfolioRow(h, () => setExpandPanel(null)))}
                  </div>
                )
              ) : (
                watchlist.length === 0 ? (
                  <div className="section-empty">관심 종목이 없어요</div>
                ) : (
                  <div className="section-list">
                    {watchlist.map(s => renderWatchlistRow(s, () => setExpandPanel(null)))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* 푸터 */}
      <div className="dash-footer">
        <p>여기서 제공하는 투자 정보는 고객의 투자 판단을 위한 단순 참고용일 뿐,<br/>투자 제안 및 권유, 종목 추천을 위해 작성된 것이 아닙니다.</p>
      </div>
    </div>
  );
}
