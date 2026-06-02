import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Client } from "@stomp/stompjs";
import {
  getWatchlist, addWatchlist, removeWatchlist,
  getMyInfo, getHoldings, getExchangeRate,
  isDomestic, fmt, fmtChange, isUp,
  getLogoUrl, searchStocks, getExchangeCode, NGROK_URL,
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

export default function MainDashboard({ user }) {
  const navigate = useNavigate();

  const [watchlist, setWatchlist] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [myBalance, setMyBalance] = useState(0);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [expandPanel, setExpandPanel] = useState(null);
  const [exRate, setExRate] = useState({ rate: 1380 });

  const [currentPrices, setCurrentPrices] = useState({});
  const wsClientRef = useRef(null);
  const wsSubsRef = useRef([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [showSearchDrop, setShowSearchDrop] = useState(false);
  const searchRef = useRef(null);
  const searchTimer = useRef(null);

  useEffect(() => {
    (async () => { try { setExRate(await getExchangeRate()); } catch {} })();
  }, []);

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

  // WebSocket 실시간 가격 구독
  useEffect(() => {
    if (!holdings.length) return;
    const wsURL = NGROK_URL.replace("https://", "wss://").replace("http://", "ws://") + "/ws/websocket";

    // 기존 클라이언트 정리
    if (wsClientRef.current) {
      wsSubsRef.current.forEach(s => { try { s.unsubscribe(); } catch {} });
      wsSubsRef.current = [];
      wsClientRef.current.deactivate();
    }

    const client = new Client({
      brokerURL: wsURL,
      connectHeaders: { "ngrok-skip-browser-warning": "true" },
      reconnectDelay: 8000,
      onConnect: () => {
        holdings.forEach(h => {
          const dom = isDomestic(h.market);
          try {
            if (dom) {
              client.publish({ destination: "/app/subscribe/domestic/price", body: h.symbol });
              const sub = client.subscribe(`/topic/domestic/${h.symbol}`, msg => {
                try {
                  const d = JSON.parse(msg.body);
                  setCurrentPrices(prev => ({ ...prev, [h.symbol]: parseFloat(d.price) }));
                } catch {}
              });
              wsSubsRef.current.push(sub);
            } else {
              const exc = h.exchange || getExchangeCode(h.market);
              client.publish({ destination: "/app/subscribe/overseas", body: `${h.symbol},${exc}` });
              const sub = client.subscribe(`/topic/overseas/${h.symbol}`, msg => {
                try {
                  const d = JSON.parse(msg.body);
                  setCurrentPrices(prev => ({ ...prev, [h.symbol]: parseFloat(d.price) }));
                } catch {}
              });
              wsSubsRef.current.push(sub);
            }
          } catch {}
        });
      },
    });
    client.activate();
    wsClientRef.current = client;

    return () => {
      wsSubsRef.current.forEach(s => { try { s.unsubscribe(); } catch {} });
      wsSubsRef.current = [];
      client.deactivate();
    };
  }, [holdings.map(h => h.symbol).join(",")]);

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

  const totalEval = holdings.reduce((s, h) => {
    const price = currentPrices[h.symbol] || h.avgPrice;
    const p = isDomestic(h.market) ? price : price * exRate.rate;
    return s + p * h.quantity;
  }, 0);
  const totalCost = holdings.reduce((s, h) => {
    const p = isDomestic(h.market) ? h.avgPrice : h.avgPrice * exRate.rate;
    return s + p * h.quantity;
  }, 0);
  const totalPL = totalEval - totalCost;
  const totalPLRate = totalCost > 0 ? ((totalPL / totalCost) * 100).toFixed(2) : "0.00";

  const renderPortfolioRow = (h, onClickExtra) => {
    const isKr = isDomestic(h.market);
    const currentPrice = currentPrices[h.symbol] || h.avgPrice;
    const priceKrw = isKr ? currentPrice : currentPrice * exRate.rate;
    const evalKrw = priceKrw * h.quantity;
    const costKrw = isKr ? h.avgPrice * h.quantity : h.avgPrice * exRate.rate * h.quantity;
    const pl = evalKrw - costKrw;
    const plRate = costKrw > 0 ? ((pl / costKrw) * 100).toFixed(2) : "0.00";
    const isProfit = pl >= 0;
    return (
      <div key={h.id} className="section-row" onClick={() => { handleSelectStock(h); onClickExtra?.(); }}>
        <div className="section-stock-info">
          {(() => {
            const logo = getLogoUrl(h.symbol, h.market);
            return logo
              ? <img src={logo} className="section-logo" alt="" onError={e=>{e.target.style.display="none";}}/>
              : <div className="section-logo-fb" style={{background:getBg(h.name)}}>{h.name?.substring(0,2)}</div>;
          })()}
          <div><div className="section-name">{h.name}</div></div>
        </div>
        <span className="section-val">{fmt(Math.round(priceKrw))}원</span>
        <span className="section-val">{h.quantity}주</span>
        <span className={`section-val ${isProfit ? "up" : "dn"}`}>
          <div>{isProfit ? "+" : ""}{fmt(Math.round(pl))}원</div>
          <div style={{fontSize:"11px"}}>{isProfit?"+":""}{plRate}%</div>
        </span>
        <span className="section-val">{fmt(Math.round(evalKrw))}원</span>
        <span className="section-val">
          <span className="section-signal pending">구현예정</span>
        </span>
      </div>
    );
  };

  const renderWatchlistRow = (s, onClickExtra) => (
    <div key={s.symbol} className="watchlist-row" onClick={() => { handleSelectStock(s); onClickExtra?.(); }}>
      <div className="section-stock-info">
        {(() => {
          const logo = getLogoUrl(s.symbol, s.market);
          return logo
            ? <img src={logo} className="section-logo" alt="" onError={e=>{e.target.style.display="none";}}/>
            : <div className="section-logo-fb" style={{background:getBg(s.name)}}>{s.name?.substring(0,2)}</div>;
        })()}
        <div><div className="section-name">{s.name}</div></div>
      </div>
      <span className="section-val">-</span>
      <span className={`section-val ${isUp(s.changePercent) ? "up" : "dn"}`}>
        {s.changePercent ? fmtChange(s.changePercent) : "-"}
      </span>
      <span className="section-val section-trends">
        <svg width="60" height="24" viewBox="0 0 60 24">
          <polyline points="0,18 15,14 30,16 45,8 60,10" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </span>
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
                  <p className="perf-status">
                    포트폴리오가 오늘{" "}
                    {totalPL >= 0
                      ? <span style={{color:"#22c55e",fontWeight:700}}>▲ {Math.abs(Number(totalPLRate))}% 상승</span>
                      : <span style={{color:"#ef4444",fontWeight:700}}>▼ {Math.abs(Number(totalPLRate))}% 하락</span>
                    }했습니다
                  </p>
                  <p className="perf-sub">오늘 투자 평가금액</p>
                  <div className="perf-total">{fmt(Math.round(totalEval))}원</div>

                  <div className="perf-bottom-boxes">
                    <div className="perf-box">
                      <span className="perf-box-label">오늘의 수익</span>
                      <span className="perf-box-value pending">구현 예정</span>
                    </div>
                    <div className="perf-boxes-row">
                      <div className="perf-box">
                        <span className="perf-box-label">최저 평가금액</span>
                        <span className="perf-box-value">{fmt(Math.round(totalEval * 0.98))}원</span>
                      </div>
                      <div className="perf-box">
                        <span className="perf-box-label">최고 평가금액</span>
                        <span className="perf-box-value">{fmt(Math.round(totalEval * 1.02))}원</span>
                      </div>
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
              <div className="perf-chart-area">
                <svg width="100%" height="140" viewBox="0 0 400 140" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="#22c55e" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,110 C30,105 50,90 80,85 C110,80 130,95 160,70 C190,45 210,55 240,40 C270,25 290,35 320,20 C350,8 370,15 400,10"
                    fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"
                  />
                  <path
                    d="M0,110 C30,105 50,90 80,85 C110,80 130,95 160,70 C190,45 210,55 240,40 C270,25 290,35 320,20 C350,8 370,15 400,10 L400,140 L0,140 Z"
                    fill="url(#chartGrad)"
                  />
                  <circle cx="400" cy="10" r="4" fill="#22c55e"/>
                  <rect x="340" y="0" width="58" height="20" rx="4" fill="#22c55e"/>
                  <text x="369" y="14" textAnchor="middle" fill="white" fontSize="10" fontWeight="600">
                    +{Math.abs(Number(totalPLRate))}%
                  </text>
                </svg>
                <div className="perf-chart-labels">
                  <span>09:00</span>
                  <span>11:00</span>
                  <span>13:00</span>
                  <span>15:00</span>
                  <span>현재</span>
                </div>
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
            <div className="section-table-header">
              <span>종목</span>
              <span style={{textAlign:"right"}}>현재가</span>
              <span style={{textAlign:"right"}}>보유</span>
              <span style={{textAlign:"right"}}>손익</span>
              <span style={{textAlign:"right"}}>평가금액</span>
              <span style={{textAlign:"right"}}>매수/매도</span>
            </div>
            {!user ? (
              <div className="section-empty">로그인이 필요해요</div>
            ) : portfolioLoading ? (
              <div className="section-empty"><div className="loading-spinner-sm"/></div>
            ) : holdings.length === 0 ? (
              <div className="section-empty">보유 종목이 없어요</div>
            ) : (
              <div className="section-list">
                {holdings.map(h => renderPortfolioRow(h))}
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
            <div className="watchlist-header">
              <span>종목</span>
              <span style={{textAlign:"right"}}>현재가</span>
              <span style={{textAlign:"right"}}>등락률</span>
              <span style={{textAlign:"right"}}>Trends</span>
              <span style={{textAlign:"right"}}>매수/매도</span>
            </div>
            {!user ? (
              <div className="section-empty">로그인이 필요해요</div>
            ) : watchlist.length === 0 ? (
              <div className="section-empty">관심 종목이 없어요</div>
            ) : (
              <div className="section-list">
                {watchlist.map(s => renderWatchlistRow(s))}
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
              {expandPanel === "portfolio" ? (
                <>
                  <div className="section-table-header">
                    <span>종목</span>
                    <span style={{textAlign:"right"}}>현재가</span>
                    <span style={{textAlign:"right"}}>보유</span>
                    <span style={{textAlign:"right"}}>손익</span>
                    <span style={{textAlign:"right"}}>평가금액</span>
                    <span style={{textAlign:"right"}}>매수/매도</span>
                  </div>
                  {holdings.length === 0 ? (
                    <div className="section-empty">보유 종목이 없어요</div>
                  ) : (
                    <div className="section-list">
                      {holdings.map(h => renderPortfolioRow(h, () => setExpandPanel(null)))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="watchlist-header">
                    <span>종목</span>
                    <span style={{textAlign:"right"}}>현재가</span>
                    <span style={{textAlign:"right"}}>등락률</span>
                    <span style={{textAlign:"right"}}>Trends</span>
                    <span style={{textAlign:"right"}}>매수/매도</span>
                  </div>
                  {watchlist.length === 0 ? (
                    <div className="section-empty">관심 종목이 없어요</div>
                  ) : (
                    <div className="section-list">
                      {watchlist.map(s => renderWatchlistRow(s, () => setExpandPanel(null)))}
                    </div>
                  )}
                </>
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
