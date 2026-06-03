import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Client } from "@stomp/stompjs";
import {
  getWatchlist, addWatchlist, removeWatchlist,
  getMyInfo, getHoldings, getExchangeRate, getPortfolioChart,
  buyStock, sellStock, getBalance,
  isDomestic, fmt, fmtChange, isUp,
  getLogoUrl, searchStocks, getExchangeCode, NGROK_URL,
} from "../api/stockApi";
import StockChart from "../components/StockChart";
import OrderBook from "../components/OrderBook";
import TradeModal from "../components/TradeModal"; // MarketPage 모달에서 사용 중이므로 유지
import AiChatDrawer from "../components/AiChatDrawer";
import { getDomesticPrice, getOverseasPrice, fmtPrice, fmtChange as fmtCh, isUp as isUpCheck } from "../api/stockApi";
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

  // 종목 모달
  const [stockModal, setStockModal] = useState(null);
  const [modalStock, setModalStock] = useState(null);
  const [tradeModal, setTradeModal] = useState(null);
  const modalWsRef = useRef(null);

  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);

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

  useEffect(() => {
    if (!user) return;
    (async () => {
      setChartLoading(true);
      try {
        const data = await getPortfolioChart(30);
        setChartData(data.data || []);
      } catch (e) {
        console.error("차트 데이터 로드 실패:", e);
      } finally {
        setChartLoading(false);
      }
    })();
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

  const handleSelectStock = async (stock) => {
    sessionStorage.setItem("cubic_detail_stock", JSON.stringify(stock));
    // 최근 본 종목 저장
    try {
      const recent = JSON.parse(sessionStorage.getItem("cubic_recent") || "[]");
      const updated = [stock, ...recent.filter(s => s.symbol !== stock.symbol)].slice(0, 10);
      sessionStorage.setItem("cubic_recent", JSON.stringify(updated));
      window.dispatchEvent(new Event("cubic_recent_update"));
    } catch {}

    // 모달 열기 - 최신 가격 조회
    try {
      const dom = isDomestic(stock.market);
      const priceData = dom
        ? await getDomesticPrice(stock.symbol)
        : await getOverseasPrice(stock.symbol, stock.exchange || getExchangeCode(stock.market));
      setModalStock({ ...stock, ...priceData });
    } catch {
      setModalStock(stock);
    }
    setStockModal(stock.symbol);

    // 모달 WebSocket
    if (modalWsRef.current) modalWsRef.current.deactivate();
    const wsURL = NGROK_URL.replace("https://", "wss://").replace("http://", "ws://") + "/ws/websocket";
    const client = new Client({
      brokerURL: wsURL,
      connectHeaders: { "ngrok-skip-browser-warning": "true" },
      reconnectDelay: 5000,
      onConnect: () => {
        const dom = isDomestic(stock.market);
        if (dom) {
          client.publish({ destination: "/app/subscribe/domestic/price", body: stock.symbol });
          client.subscribe(`/topic/domestic/${stock.symbol}`, msg => {
            try {
              const d = JSON.parse(msg.body);
              setModalStock(prev => prev ? { ...prev, ...d } : prev);
            } catch {}
          });
        } else {
          const exc = stock.exchange || getExchangeCode(stock.market);
          client.publish({ destination: "/app/subscribe/overseas", body: `${stock.symbol},${exc}` });
          client.subscribe(`/topic/overseas/${stock.symbol}`, msg => {
            try {
              const d = JSON.parse(msg.body);
              setModalStock(prev => prev ? { ...prev, ...d } : prev);
            } catch {}
          });
        }
      },
    });
    client.activate();
    modalWsRef.current = client;
  };

  const closeStockModal = () => {
    setStockModal(null);
    setModalStock(null);
    setTradeModal(null);
    if (modalWsRef.current) { modalWsRef.current.deactivate(); modalWsRef.current = null; }
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
          <button className="dash-ai-btn" onClick={() => setAiDrawerOpen(true)}>
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
                {chartLoading ? (
                  <div className="perf-chart-loading">
                    <div className="loading-spinner-sm"/>
                  </div>
                ) : chartData.length > 0 ? (
                  <>
                    {(() => {
                      const CHART_POINTS = 10;
                      const generateFixedDateRange = () => {
                        const dates = [];
                        const today = new Date();
                        const startDate = chartData.length > 0
                          ? new Date(chartData[0].date)
                          : new Date(today);
                        for (let i = 0; i < CHART_POINTS; i++) {
                          const d = new Date(startDate);
                          d.setDate(startDate.getDate() + i);
                          const yyyy = d.getFullYear();
                          const mm = String(d.getMonth() + 1).padStart(2, "0");
                          const dd = String(d.getDate()).padStart(2, "0");
                          dates.push(`${yyyy}-${mm}-${dd}`);
                        }
                        return dates;
                      };
                      const dateRange = generateFixedDateRange();
                      const chartDataMap = Object.fromEntries(chartData.map(d => [d.date, d.value]));
                      const paddedChartData = dateRange.map(date => ({
                        date,
                        value: chartDataMap[date] ?? null,
                      }));
                      const lastDataIndex = paddedChartData.reduce((last, d, i) =>
                        d.value !== null ? i : last, -1);
                      return (
                        <ResponsiveContainer width="100%" height={260}>
                          <AreaChart data={paddedChartData} margin={{top: 10, right: 24, left: 60, bottom: 0}}>
                            <defs>
                              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0d9488" stopOpacity={0.15}/>
                                <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="var(--c-border)"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 11, fill: "var(--c-text-muted)" }}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(v) => v?.slice(5) || ""}
                              interval={0}
                              minTickGap={30}
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: "var(--c-text-muted)" }}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(v) => {
                                if (v >= 100_000_000) return (v / 100_000_000).toFixed(0) + "억";
                                if (v >= 10_000) return (v / 10_000).toFixed(0) + "만";
                                return fmt(v);
                              }}
                              width={56}
                              domain={([dataMin, dataMax]) => {
                                const margin = (dataMax - dataMin) * 0.3;
                                return [Math.floor(dataMin - margin), Math.ceil(dataMax + margin)];
                              }}
                            />
                            <Tooltip
                              contentStyle={{
                                background: "var(--c-surface)",
                                border: "1px solid var(--c-border)",
                                borderRadius: "10px",
                                fontSize: "12px",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                              }}
                              formatter={(value) => value != null ? [`${fmt(Math.round(value))}원`, "평가금액"] : ["-", "평가금액"]}
                              labelFormatter={(label) => label}
                            />
                            <Area
                              type="monotone"
                              dataKey="value"
                              stroke="#0d9488"
                              strokeWidth={2}
                              fill="url(#chartGradient)"
                              connectNulls={false}
                              dot={(props) => {
                                const { cx, cy, index } = props;
                                if (index !== lastDataIndex) return null;
                                return (
                                  <g key={`dot-${index}`}>
                                    <circle cx={cx} cy={cy} r={10} fill="#0d9488" opacity={0}>
                                      <animate attributeName="r" from="6" to="14" dur="1.5s" repeatCount="indefinite"/>
                                      <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite"/>
                                    </circle>
                                    <circle cx={cx} cy={cy} r={5} fill="#0d9488"/>
                                  </g>
                                );
                              }}
                              activeDot={{ r: 5, fill: "#0d9488", strokeWidth: 0 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </>
                ) : (
                  <div className="perf-chart-placeholder">
                    <span>차트 데이터가 없어요</span>
                  </div>
                )}
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

      {/* 종목 상세 모달 */}
      {stockModal && modalStock && (
        <div className="stock-modal-overlay" onClick={closeStockModal}>
          <div className="stock-modal" onClick={e => e.stopPropagation()}>

            {/* 헤더 */}
            <div className="stock-modal-header">
              <div className="stock-modal-left">
                {(() => {
                  const logo = getLogoUrl(modalStock.symbol, modalStock.market);
                  return logo
                    ? <img src={logo} className="stock-modal-logo" alt="" onError={e=>{e.target.style.display="none";}}/>
                    : <div className="stock-modal-logo-fb">{modalStock.name?.substring(0,2)}</div>;
                })()}
                <div>
                  <div className="stock-modal-name">{modalStock.name}</div>
                  <div className="stock-modal-code">{modalStock.symbol} · {modalStock.market}</div>
                </div>
              </div>
              <div className="stock-modal-right">
                <button
                  className="sma-watch"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!user) { alert("로그인 후 이용해 주세요."); return; }
                    try {
                      if (isWatched(modalStock.symbol)) await removeWatchlist(modalStock.symbol);
                      else await addWatchlist(modalStock.symbol, modalStock.name, modalStock.market);
                      await loadWatchlist();
                    } catch {}
                  }}
                >
                  {isWatched(modalStock.symbol) ? "★" : "☆"}
                </button>
                <button className="sma-detail" onClick={() => { closeStockModal(); navigate(`/stock/${modalStock.symbol}`); }}>
                  상세보기
                </button>
                <button className="sma-close" onClick={closeStockModal}>✕</button>
              </div>
            </div>

            {/* 메인 그리드 */}
            <div className="stock-modal-grid">

              {/* 좌측: 현재가 + 차트 + 호가 */}
              <div className="stock-modal-left-col">
                <div className="stock-modal-price-row">
                  <span className="stock-modal-price">{fmtPrice(modalStock.price, modalStock.market)}</span>
                  <span className={`stock-modal-change ${isUpCheck(modalStock.changePercent) ? "up" : "dn"}`}>
                    {isUpCheck(modalStock.changePercent) ? "▲" : "▼"} {fmtCh(modalStock.changePercent)}
                  </span>
                </div>
                <div className="stock-modal-chart">
                  <StockChart stock={modalStock} fullscreen={false} onToggleFullscreen={() => {}}/>
                </div>
                <div className="stock-modal-ob">
                  <OrderBook stock={modalStock}/>
                </div>
              </div>

              {/* 우측: 매수/매도 주문창 */}
              <div className="stock-modal-right-col">
                <div className="stock-modal-trade">
                  <div className="smt-tabs">
                    <button
                      className={`smt-tab buy ${tradeModal === "buy" || !tradeModal ? "active" : ""}`}
                      onClick={() => setTradeModal("buy")}
                    >매수</button>
                    <button
                      className={`smt-tab sell ${tradeModal === "sell" ? "active" : ""}`}
                      onClick={() => setTradeModal("sell")}
                    >매도</button>
                  </div>
                  {user ? (
                    <TradeModalInline
                      stock={modalStock}
                      mode={tradeModal || "buy"}
                      onSuccess={() => { loadPortfolio(); window.dispatchEvent(new Event("cubic_trade_complete")); }}
                    />
                  ) : (
                    <div className="smt-login-hint">
                      <p>로그인 후 거래할 수 있어요</p>
                      <button onClick={() => { closeStockModal(); navigate("/login"); }}>로그인</button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      <AiChatDrawer open={aiDrawerOpen} onClose={() => setAiDrawerOpen(false)} user={user} />

      {/* 푸터 */}
      <div className="dash-footer">
        <p>여기서 제공하는 투자 정보는 고객의 투자 판단을 위한 단순 참고용일 뿐,<br/>투자 제안 및 권유, 종목 추천을 위해 작성된 것이 아닙니다.</p>
      </div>
    </div>
  );
}

function TradeModalInline({ stock, mode, onSuccess }) {
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");
  const [balance, setBalance] = useState(0);
  const [holding, setHolding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (stock?.price) setPrice(String(stock.price).replace(/[+]/g, ""));
    setQuantity(1); setMessage(null);
    fetchData();
  }, [stock?.symbol, mode]);

  const fetchData = async () => {
    try {
      const [bal, holdings] = await Promise.all([getBalance(), getHoldings()]);
      setBalance(bal);
      setHolding(holdings.find(x => x.symbol === stock.symbol) || null);
    } catch {}
  };

  const numPrice = Number(price) || 0;
  const numQty = Number(quantity) || 0;
  const total = numPrice * numQty;
  const dom = isDomestic(stock?.market);
  const unit = dom ? "원" : "$";
  const currentAvgPrice = holding?.avgPrice || 0;
  const currentQty = holding?.quantity || 0;
  const newTotalQty = currentQty + numQty;
  const expectedAvgPrice = newTotalQty > 0 ? ((currentAvgPrice * currentQty) + total) / newTotalQty : numPrice;
  const sellRevenue = total;
  const sellCost = currentAvgPrice * numQty;
  const expectedProfit = sellRevenue - sellCost;
  const expectedProfitRate = sellCost > 0 ? ((expectedProfit / sellCost) * 100).toFixed(2) : "0.00";
  const canBuy = total > 0 && total <= balance && numQty > 0;
  const canSell = holding && numQty <= holding.quantity && numQty > 0 && numPrice > 0;

  const handleSubmit = async () => {
    setLoading(true); setMessage(null);
    try {
      const payload = { symbol: stock.symbol, name: stock.name, market: stock.market, type: mode === "buy" ? "BUY" : "SELL", quantity: numQty, price: numPrice };
      if (mode === "buy") await buyStock(payload);
      else await sellStock(payload);
      setMessage({ type: "success", text: mode === "buy" ? "매수 완료!" : "매도 완료!" });
      await fetchData();
      onSuccess?.();
    } catch (e) {
      setMessage({ type: "error", text: typeof e.response?.data === "string" ? e.response.data : "주문 실패" });
    } finally { setLoading(false); }
  };

  return (
    <div className="smt-body">
      <div className="smt-info-row"><span>현재가</span><strong>{fmtPrice(stock.price, stock.market)}</strong></div>
      {mode === "buy"
        ? <div className="smt-info-row"><span>주문 가능</span><strong>{fmt(Math.round(balance))}{unit}</strong></div>
        : <div className="smt-info-row"><span>보유 수량</span><strong>{holding ? `${fmt(holding.quantity)}주` : "0주"}</strong></div>
      }
      {holding && mode === "buy" && (
        <div className="smt-info-row dim"><span>현재 보유</span><strong>{fmt(currentQty)}주 (평단 {fmtPrice(currentAvgPrice, stock.market)})</strong></div>
      )}
      <div className="smt-input-group">
        <label>가격</label>
        <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="가격 입력"/>
      </div>
      <div className="smt-input-group">
        <label>수량</label>
        <div className="smt-qty-row">
          <button onClick={() => setQuantity(q => Math.max(1, Number(q)-1))}>−</button>
          <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value)||0)}/>
          <button onClick={() => setQuantity(q => Number(q)+1)}>+</button>
        </div>
        {mode === "sell" && holding && (
          <div className="smt-qty-shortcuts">
            {[25,50,75,100].map(pct => (
              <button key={pct} onClick={() => setQuantity(Math.floor(holding.quantity*pct/100))}>{pct}%</button>
            ))}
          </div>
        )}
      </div>
      <div className="smt-total"><span>총 {mode==="buy"?"매수":"매도"} 금액</span><strong>{fmt(Math.round(total))}{unit}</strong></div>
      {mode === "buy" && numQty > 0 && numPrice > 0 && (
        <div className="smt-estimate">
          <div className="smt-est-row"><span>예상 평단가</span><strong>{dom?`${fmt(Math.round(expectedAvgPrice))}원`:`$${expectedAvgPrice.toFixed(2)}`}</strong></div>
          <div className="smt-est-row"><span>구매 후 총 보유</span><strong>{fmt(newTotalQty)}주</strong></div>
        </div>
      )}
      {mode === "sell" && holding && numQty > 0 && numPrice > 0 && (
        <div className="smt-estimate">
          <div className={`smt-est-row highlight ${expectedProfit>=0?"profit":"loss"}`}>
            <span>예상 수익</span>
            <strong>{expectedProfit>=0?"+":""}{fmt(Math.round(expectedProfit))}{unit} ({expectedProfitRate}%)</strong>
          </div>
        </div>
      )}
      {message && <div className={`smt-message ${message.type}`}>{message.text}</div>}
      <button
        className={`smt-submit ${mode}`}
        onClick={handleSubmit}
        disabled={loading || (mode==="buy" ? !canBuy : !canSell)}
      >
        {loading ? "처리 중..." : mode==="buy" ? "매수하기" : "매도하기"}
      </button>
    </div>
  );
}
