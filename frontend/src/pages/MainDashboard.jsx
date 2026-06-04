import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Client } from "@stomp/stompjs";
import {
  getWatchlist, addWatchlist, removeWatchlist,
  getMyInfo, getHoldings, getExchangeRate, getPortfolioChart,
  buyStock, sellStock, getBalance,
  isDomestic, fmt, fmtChange, isUp,
  getLogoUrl, searchStocks, getExchangeCode, NGROK_URL, resetSubscriptions, getCubicBatch,
} from "../api/stockApi";
import StockChart from "../components/StockChart";
import OrderBook from "../components/OrderBook";
import CubicAnalysisPanel from "../components/CubicAnalysisPanel";
import TradeModal from "../components/TradeModal"; // MarketPage 모달에서 사용 중이므로 유지
import AiChatDrawer from "../components/AiChatDrawer";
import { getDomesticPrice, getOverseasPrice, fmtPrice, fmtChange as fmtCh, isUp as isUpCheck } from "../api/stockApi";
import api from "../api/stockApi";
import "./MainDashboard.css";

function CubicSignalBar({ score }) {
  if (score === null || score === undefined)
    return <span className="market-signal-dash">-</span>;
  const sellPct = 100 - score;
  const buyPct = score;
  return (
    <div className="cubic-signal-bar">
      <div className="cubic-signal-nums">
        <span style={{ color: "#e57373" }}>{sellPct}%</span>
        <span style={{ color: "#66bb6a" }}>{buyPct}%</span>
      </div>
      <div className="cubic-signal-track">
        <div className="cubic-signal-sell" style={{ width: `${sellPct}%` }}/>
        <div className="cubic-signal-buy"  style={{ width: `${buyPct}%` }}/>
      </div>
    </div>
  );
}

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
  const watchlistWsRef = useRef(null);
  const [watchlistPrices, setWatchlistPrices] = useState({});

  // 종목 모달
  const [stockModal, setStockModal] = useState(null);
  const [modalStock, setModalStock] = useState(null);
  const [tradeModal, setTradeModal] = useState(null);
  const modalWsRef = useRef(null);

  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositTab, setDepositTab] = useState("deposit");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositLoading, setDepositLoading] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);

  // 하루 중 최저/최고 평가금액 추적
  const [dayLow, setDayLow] = useState(null);
  const [dayHigh, setDayHigh] = useState(null);
  const dayDateRef = useRef(null); // "YYYY-MM-DD" 형식으로 오늘 날짜 저장

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [showSearchDrop, setShowSearchDrop] = useState(false);
  const searchRef = useRef(null);
  const searchTimer = useRef(null);
  const [holdingSort, setHoldingSort] = useState("eval_desc");
  const [showSortDrop, setShowSortDrop] = useState(false);
  const sortDropRef = useRef(null);
  const sortBtnRef = useRef(null);
  const [cubicScores, setCubicScores] = useState({});

  useEffect(() => {
    resetSubscriptions();
  }, []);

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
    try {
      const wl = await getWatchlist() || [];
      setWatchlist(wl);
      if (wl.length) {
        fetchWatchlistPrices(wl);
        fetchCubicScores(wl); // watchlist만 (portfolio는 loadPortfolio에서 따로 처리)
      }
    } catch {}
  };

  const fetchWatchlistPrices = async (wl) => {
    const prices = {};
    await Promise.allSettled(wl.map(async s => {
      try {
        const dom = isDomestic(s.market);
        const d = dom
          ? await getDomesticPrice(s.symbol)
          : await getOverseasPrice(s.symbol, s.exchange || getExchangeCode(s.market));
        prices[s.symbol] = {
          price: parseFloat(d.price) || 0,
          change: d.change,
          changePercent: d.changePercent,
          volume: d.acmlTrPbmn || d.tradingValue || d.volume || null,
        };
      } catch {}
    }));
    setWatchlistPrices(prev => ({ ...prev, ...prices }));
    connectWatchlistWS(wl);
  };

  const connectWatchlistWS = (wl) => {
    if (watchlistWsRef.current) watchlistWsRef.current.deactivate();
    if (!wl.length) return;
    const wsURL = NGROK_URL.replace("https://", "wss://").replace("http://", "ws://") + "/ws/websocket";
    const client = new Client({
      brokerURL: wsURL,
      connectHeaders: { "ngrok-skip-browser-warning": "true" },
      reconnectDelay: 8000,
      onConnect: () => {
        wl.forEach(s => {
          try {
            if (isDomestic(s.market)) {
              client.publish({ destination: "/app/subscribe/domestic/price", body: s.symbol });
              client.subscribe(`/topic/domestic/${s.symbol}`, msg => {
                try {
                  const d = JSON.parse(msg.body);
                  setWatchlistPrices(prev => ({ ...prev, [s.symbol]: {
                    ...prev[s.symbol],
                    price: parseFloat(d.price) || prev[s.symbol]?.price || 0,
                    change: d.change,
                    changePercent: d.changePercent,
                  }}));
                } catch {}
              });
            } else {
              const exc = s.exchange || getExchangeCode(s.market);
              client.publish({ destination: "/app/subscribe/overseas", body: `${s.symbol},${exc}` });
              client.subscribe(`/topic/overseas/${s.symbol}`, msg => {
                try {
                  const d = JSON.parse(msg.body);
                  setWatchlistPrices(prev => ({ ...prev, [s.symbol]: {
                    ...prev[s.symbol],
                    price: parseFloat(d.price) || prev[s.symbol]?.price || 0,
                    change: d.change,
                    changePercent: d.changePercent,
                  }}));
                } catch {}
              });
            }
          } catch {}
        });
      },
    });
    client.activate();
    watchlistWsRef.current = client;
  };

  useEffect(() => {
    const handler = (e) => {
      if (sortDropRef.current && !sortDropRef.current.contains(e.target)) setShowSortDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadPortfolio = async () => {
    setPortfolioLoading(true);
    try {
      const [me, h] = await Promise.allSettled([getMyInfo(), getHoldings()]);
      if (me.status === "fulfilled") setMyBalance(me.value.balance || 0);
      if (h.status === "fulfilled") {
        setHoldings(h.value || []);
        fetchCubicScores(h.value || []);
      }
    } finally { setPortfolioLoading(false); }
  };

  const fetchCubicScores = async (holdingList) => {
    if (!holdingList?.length) return;
    try {
      const symbols = holdingList.map(h => h.symbol);
      const result = await getCubicBatch(symbols);
      setCubicScores(prev => ({ ...prev, ...(result || {}) })); // 기존 값 유지하며 병합
    } catch (e) {
      console.warn("Cubic batch 조회 실패:", e);
    }
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
      // 먼저 백엔드 구독 해제 (deactivate 전에)
      holdings.forEach(h => {
        try {
          if (isDomestic(h.market)) {
            client.publish({ destination: "/app/unsubscribe/domestic/price", body: h.symbol });
          } else {
            const exc = h.exchange || getExchangeCode(h.market);
            client.publish({ destination: "/app/unsubscribe/overseas", body: `${h.symbol},${exc}` });
          }
        } catch {}
      });
      // 그 다음 프론트 구독 해제
      wsSubsRef.current.forEach(s => { try { s.unsubscribe(); } catch {} });
      wsSubsRef.current = [];
      client.deactivate();
    };
  }, [holdings.map(h => h.symbol).join(",")]);

  const handleDeposit = async () => {
    const amount = Number(String(depositAmount).replace(/,/g, ""));
    if (!amount || amount <= 0) { alert("금액을 입력해주세요."); return; }
    setDepositLoading(true);
    try {
      const endpoint = depositTab === "deposit" ? "/api/trade/deposit" : "/api/trade/withdraw";
      await api.post(endpoint, { amount });
      setShowDepositModal(false);
      setDepositAmount("");
      await loadPortfolio();
      window.dispatchEvent(new Event("cubic_trade_complete"));
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data || "처리 실패";
      alert(typeof msg === "string" ? msg : "처리 중 오류가 발생했습니다.");
    } finally { setDepositLoading(false); }
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

  // 포트폴리오 정렬
  const SORT_OPTIONS = [
    { key: "eval_desc", label: "평가금 높은 순" },
    { key: "eval_asc",  label: "평가금 낮은 순" },
    { key: "pl_desc",   label: "총 수익률 높은 순" },
    { key: "pl_asc",    label: "총 수익률 낮은 순" },
  ];
  const getHoldingEvalKrw = (h) => {
    const price = currentPrices[h.symbol] || h.avgPrice;
    return (isDomestic(h.market) ? price : price * exRate.rate) * h.quantity;
  };
  const getHoldingPLRateNum = (h) => {
    const evalKrw = getHoldingEvalKrw(h);
    const costKrw = (isDomestic(h.market) ? h.avgPrice : h.avgPrice * exRate.rate) * h.quantity;
    return costKrw > 0 ? (evalKrw - costKrw) / costKrw * 100 : 0;
  };
  const sortedHoldings = [...holdings].sort((a, b) => {
    if (holdingSort === "eval_desc") return getHoldingEvalKrw(b) - getHoldingEvalKrw(a);
    if (holdingSort === "eval_asc")  return getHoldingEvalKrw(a) - getHoldingEvalKrw(b);
    if (holdingSort === "pl_desc")   return getHoldingPLRateNum(b) - getHoldingPLRateNum(a);
    if (holdingSort === "pl_asc")    return getHoldingPLRateNum(a) - getHoldingPLRateNum(b);
    return 0;
  });

  // 하루 중 최저/최고 추적 - 날짜가 바뀌면 리셋, 값이 갱신될 때만 업데이트
  useEffect(() => {
    if (totalEval <= 0) return;
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    if (dayDateRef.current !== today) {
      // 새 날짜 → 오늘 기준 초기화
      dayDateRef.current = today;
      setDayLow(totalEval);
      setDayHigh(totalEval);
    } else {
      // 같은 날 → 최저/최고만 갱신
      setDayLow(prev => (prev === null || totalEval < prev) ? totalEval : prev);
      setDayHigh(prev => (prev === null || totalEval > prev) ? totalEval : prev);
    }
  }, [totalEval]);

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
          <CubicSignalBar score={cubicScores[h.symbol]?.cubicScore ?? null} />
        </span>
      </div>
    );
  };

  const renderWatchlistRow = (s, onClickExtra, expanded = true) => {
    const wp = watchlistPrices[s.symbol];
    const price = wp?.price || 0;
    const changePercent = wp?.changePercent ?? s.changePercent;
    const up = isUp(changePercent);
    const dom = isDomestic(s.market);
    const volume = wp?.volume;
    const fmtVol = (v) => {
      if (!v) return "-";
      const n = Number(v);
      if (isNaN(n) || n === 0) return "-";
      if (n >= 1_000_000_000_000) return (n / 1_000_000_000_000).toFixed(1) + "조";
      if (n >= 100_000_000) return Math.round(n / 100_000_000) + "억";
      return fmt(Math.round(n));
    };
    const sparkPoints = up ? "0,20 15,16 30,14 45,10 60,8" : "0,8 15,12 30,14 45,16 60,20";
    const sparkColor = up ? "#ef4444" : "#3b82f6";

    return (
      <div key={s.symbol} className={`watchlist-row ${expanded ? "expanded" : ""}`} onClick={() => { handleSelectStock(s); onClickExtra?.(); }}>
        <div className="section-stock-info">
          {(() => {
            const logo = getLogoUrl(s.symbol, s.market);
            return logo
              ? <img src={logo} className="section-logo" alt="" onError={e=>{e.target.style.display="none";}}/>
              : <div className="section-logo-fb" style={{background:getBg(s.name)}}>{s.name?.substring(0,2)}</div>;
          })()}
          <div><div className="section-name">{s.name}</div></div>
        </div>
        {/* 그래프 - 확대 시만 */}
        {expanded && (
          <span className="section-val section-trends">
            <svg width="60" height="24" viewBox="0 0 60 24">
              <polyline points={sparkPoints} fill="none" stroke={sparkColor} strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </span>
        )}
        {/* 등락률 */}
        <span className={`section-val ${up ? "up" : "dn"}`}>
          {changePercent != null ? fmtChange(changePercent) : "-"}
        </span>
        {/* 현재가 */}
        <span className="section-val">
          {price ? (dom ? `${fmt(Math.round(price))}원` : `$${price.toFixed(2)}`) : "-"}
        </span>
        {/* 거래대금 - 확대 시만 */}
        {expanded && <span className="section-val">{fmtVol(volume)}</span>}
        {/* 신호 */}
        <span className="section-val">
          <CubicSignalBar score={cubicScores[s.symbol]?.cubicScore ?? null} />
        </span>
      </div>
    );
  };

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
            {user && (
              <button
                className="perf-deposit-btn"
                onClick={() => setShowDepositModal(true)}
                style={{
                  display: "flex", alignItems: "center", gap: "5px",
                  padding: "6px 12px", borderRadius: "8px",
                  background: "var(--c-primary-muted)", border: "1px solid var(--c-primary-border)",
                  color: "var(--c-primary)", fontSize: "12px", fontWeight: "600",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                }}
                onMouseOver={e => e.currentTarget.style.background = "var(--c-primary)" || (e.currentTarget.style.color = "#fff")}
                onMouseOut={e => { e.currentTarget.style.background = "var(--c-primary-muted)"; e.currentTarget.style.color = "var(--c-primary)"; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                입금/출금
              </button>
            )}
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
                        <span className="perf-box-value">{dayLow !== null ? `${fmt(Math.round(dayLow))}원` : "-"}</span>
                      </div>
                      <div className="perf-box">
                        <span className="perf-box-label">최고 평가금액</span>
                        <span className="perf-box-value">{dayHigh !== null ? `${fmt(Math.round(dayHigh))}원` : "-"}</span>
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
                                if (!v && v !== 0) return "";
                                const abs = Math.abs(v);
                                if (abs >= 1_000_000_000_000) return (v / 1_000_000_000_000).toFixed(1) + "조";
                                if (abs >= 100_000_000) return (v / 100_000_000).toFixed(1).replace(/\.0$/, "") + "억";
                                if (abs >= 10_000_000) return (v / 10_000_000).toFixed(1).replace(/\.0$/, "") + "천만";
                                if (abs >= 10_000) return (v / 10_000).toFixed(0) + "만";
                                return fmt(Math.round(v));
                              }}
                              width={64}
                              tickCount={5}
                              domain={([dataMin, dataMax]) => {
                                if (dataMin === dataMax) return [dataMin * 0.95, dataMax * 1.05];
                                const range = dataMax - dataMin;
                                const margin = range * 0.15;
                                // 깔끔한 단위로 반올림
                                const unit = Math.pow(10, Math.floor(Math.log10(range)) - 1);
                                const low = Math.floor((dataMin - margin) / unit) * unit;
                                const high = Math.ceil((dataMax + margin) / unit) * unit;
                                return [low, high];
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
              <div style={{display:"flex", alignItems:"center", gap:6}}>
                {/* 정렬 드롭다운 */}
                <div ref={sortDropRef} style={{position:"relative"}}>
                  <button
                    ref={sortBtnRef}
                    className="holdings-sort-btn"
                    onClick={() => setShowSortDrop(v => !v)}
                  >
                    {SORT_OPTIONS.find(o => o.key === holdingSort)?.label}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {showSortDrop && (() => {
                    const rect = sortBtnRef.current?.getBoundingClientRect();
                    return (
                      <div
                        style={{
                          position: "fixed",
                          top: rect ? rect.bottom + 6 : 0,
                          right: rect ? window.innerWidth - rect.right : 0,
                          background: "#ffffff",
                          border: "1px solid var(--c-border)",
                          borderRadius: 10,
                          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                          zIndex: 9999,
                          overflow: "hidden",
                          minWidth: 150,
                        }}
                        className="holdings-sort-dropdown-fixed"
                      >
                        {SORT_OPTIONS.map(o => (
                          <button
                            key={o.key}
                            className={`holdings-sort-option ${holdingSort === o.key ? "active" : ""}`}
                            onClick={() => { setHoldingSort(o.key); setShowSortDrop(false); }}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <button className="section-expand-btn" onClick={() => setExpandPanel("portfolio")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                </button>
              </div>
            </div>
            <div className="section-table-header">
              <span>종목</span>
              <span style={{textAlign:"right"}}>현재가</span>
              <span style={{textAlign:"right"}}>보유</span>
              <span style={{textAlign:"right"}}>손익</span>
              <span style={{textAlign:"right"}}>평가금액</span>
              <span style={{textAlign:"right"}}>신호</span>
            </div>
            {!user ? (
              <div className="section-empty">로그인이 필요해요</div>
            ) : portfolioLoading ? (
              <div className="section-empty"><div className="loading-spinner-sm"/></div>
            ) : holdings.length === 0 ? (
              <div className="section-empty">보유 종목이 없어요</div>
            ) : (
              <div className="section-list">
                {sortedHoldings.map(h => renderPortfolioRow(h))}
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
              <span style={{textAlign:"right"}}>등락률</span>
              <span style={{textAlign:"right"}}>현재가</span>
              <span style={{textAlign:"right"}}>신호</span>
            </div>
            {!user ? (
              <div className="section-empty">로그인이 필요해요</div>
            ) : watchlist.length === 0 ? (
              <div className="section-empty">관심 종목이 없어요</div>
            ) : (
              <div className="section-list">
                {watchlist.map(s => renderWatchlistRow(s, null, false))}
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
                    <span style={{textAlign:"right"}}>신호</span>
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
                  <div className="watchlist-header expanded">
                    <span>종목</span>
                    <span>그래프</span>
                    <span style={{textAlign:"right"}}>등락률</span>
                    <span style={{textAlign:"right"}}>현재가</span>
                    <span style={{textAlign:"right"}}>거래대금</span>
                    <span style={{textAlign:"right"}}>신호</span>
                  </div>
                  {watchlist.length === 0 ? (
                    <div className="section-empty">관심 종목이 없어요</div>
                  ) : (
                    <div className="section-list">
                      {watchlist.map(s => renderWatchlistRow(s, () => setExpandPanel(null), true))}
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
                  <div className="stock-modal-sub">{modalStock.symbol} · {modalStock.market}</div>
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

              {/* 좌측: 차트박스 + 하단 2컬럼(호가|AI분석) */}
              <div className="stock-modal-left-col">
                {/* 차트 박스: 심볼+시장 + 주가 + 차트 */}
                <div className="sml-chart-box">
                  {modalStock.price && (
                    <div className="sml-price-bar">
                      <span className="smpb-krw">
                        {isDomestic(modalStock.market)
                          ? `${fmt(Math.round(Number(modalStock.price)))}원`
                          : `${fmt(Math.round(Number(modalStock.price) * (exRate?.rate || exRate || 1380)))}원`}
                      </span>
                      {!isDomestic(modalStock.market) && (
                        <span className="smpb-usd">${Number(modalStock.price).toFixed(2)}</span>
                      )}
                      {modalStock.changePercent != null && (
                        <span className={`smpb-change ${isUp(modalStock.changePercent) ? "up" : "dn"}`}>
                          {isUp(modalStock.changePercent) ? "▲" : "▼"} {fmtChange(modalStock.changePercent)}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="stock-modal-chart">
                    <StockChart stock={modalStock} fullscreen={false} onToggleFullscreen={() => {}} hidePrice={true}/>
                  </div>
                </div>

                {/* 하단 2컬럼: 호가 | AI분석 */}
                <div className="sml-bottom-row">
                  <div className="sml-ob-col">
                    <OrderBook stock={modalStock}/>
                  </div>
                  <div className="sml-ai-col">
                    <CubicAnalysisPanel stock={modalStock} />
                  </div>
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
                      exRate={exRate?.rate || exRate || 1380}
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

      {/* 입금/출금 모달 */}
      {showDepositModal && (
        <div className="ls-modal-overlay" onClick={() => { setShowDepositModal(false); setDepositAmount(""); }}>
          <div className="ls-modal" onClick={e => e.stopPropagation()}>
            <div className="ls-modal-title">잔고 관리</div>
            <div className="ls-modal-tabs">
              <button className={`ls-modal-tab ${depositTab==="deposit"?"active":""}`} onClick={() => setDepositTab("deposit")}>입금</button>
              <button className={`ls-modal-tab ${depositTab==="withdraw"?"active":""}`} onClick={() => setDepositTab("withdraw")}>출금</button>
            </div>
            <div className="ls-modal-input-wrap">
              <span className="ls-modal-label">{depositTab === "deposit" ? "입금" : "출금"}할 금액 (원)</span>
              <input
                className="ls-modal-input"
                type="text"
                placeholder="예: 1,000,000"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="ls-modal-btns">
              <button className="ls-modal-cancel" onClick={() => { setShowDepositModal(false); setDepositAmount(""); }}>취소</button>
              <button className="ls-modal-confirm" onClick={handleDeposit} disabled={depositLoading}>
                {depositLoading ? "처리 중..." : depositTab === "deposit" ? "입금" : "출금"}
              </button>
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

function TradeModalInline({ stock, mode, onSuccess, exRate = 1380 }) {
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

  const dom = isDomestic(stock?.market);
  const numPrice = Number(price) || 0;
  const numQty = Number(quantity) || 0;
  const krwPrice = dom ? numPrice : numPrice * exRate;
  const total = krwPrice * numQty;
  const currentAvgPrice = holding?.avgPrice || 0;
  const currentAvgPriceKrw = dom ? currentAvgPrice : currentAvgPrice * exRate;
  const currentQty = holding?.quantity || 0;
  const newTotalQty = currentQty + numQty;
  const expectedAvgPriceKrw = newTotalQty > 0 ? ((currentAvgPriceKrw * currentQty) + total) / newTotalQty : krwPrice;
  const sellRevenue = total;
  const sellCost = currentAvgPriceKrw * numQty;
  const expectedProfit = sellRevenue - sellCost;
  const expectedProfitRate = sellCost > 0 ? ((expectedProfit / sellCost) * 100).toFixed(2) : "0.00";
  const maxBuyQty = krwPrice > 0 ? Math.floor(balance / krwPrice) : 0;
  const maxSellQty = holding?.quantity || 0;
  const setQtyCapped = (v) => setQuantity(Math.max(0, Math.min(v, mode === "buy" ? maxBuyQty : maxSellQty)));
  const canBuy = numQty > 0 && total <= balance && krwPrice > 0;
  const canSell = holding && numQty > 0 && numQty <= maxSellQty && numPrice > 0;

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
      <div className="smt-info-row">
        <span>현재가</span>
        <div style={{textAlign:"right"}}>
          <strong>{fmt(Math.round(krwPrice))}원</strong>
          {!dom && <div style={{fontSize:11,color:"var(--c-text-muted)"}}>≈ ${numPrice.toFixed(2)}</div>}
        </div>
      </div>
      {mode === "buy"
        ? <div className="smt-info-row"><span>주문 가능</span><strong>{fmt(Math.round(balance))}원</strong></div>
        : <div className="smt-info-row"><span>보유 수량</span><strong>{holding ? `${fmt(holding.quantity)}주` : "0주"}</strong></div>
      }
      {holding && mode === "buy" && (
        <div className="smt-info-row dim"><span>현재 보유</span><strong>{fmt(currentQty)}주 (평단 {fmt(Math.round(currentAvgPriceKrw))}원)</strong></div>
      )}
      <div className="smt-input-group">
        <label>가격</label>
        <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="가격 입력"/>
      </div>
      <div className="smt-input-group">
        <label>수량 {mode === "buy" && maxBuyQty > 0 && <span style={{fontWeight:400,color:"var(--c-text-muted)"}}>최대 {fmt(maxBuyQty)}주</span>}</label>
        <div className="smt-qty-row">
          <button onClick={() => setQtyCapped(numQty - 1)}>−</button>
          <input type="number" value={quantity} onChange={e => setQtyCapped(Number(e.target.value)||0)} min={0} max={mode==="buy"?maxBuyQty:maxSellQty}/>
          <button onClick={() => setQtyCapped(numQty + 1)}>+</button>
        </div>
        {mode === "sell" && holding && (
          <div className="smt-qty-shortcuts">
            {[25,50,75,100].map(pct => (
              <button key={pct} onClick={() => setQtyCapped(Math.floor(holding.quantity*pct/100))}>{pct}%</button>
            ))}
          </div>
        )}
      </div>
      <div className="smt-total"><span>총 {mode==="buy"?"매수":"매도"} 금액</span><strong>{fmt(Math.round(total))}원</strong></div>
      {mode === "buy" && numQty > 0 && krwPrice > 0 && (
        <div className="smt-estimate">
          <div className="smt-est-row"><span>예상 평단가</span><strong>{fmt(Math.round(expectedAvgPriceKrw))}원</strong></div>
          <div className="smt-est-row"><span>구매 후 총 보유</span><strong>{fmt(newTotalQty)}주</strong></div>
        </div>
      )}
      {mode === "sell" && holding && numQty > 0 && krwPrice > 0 && (
        <div className="smt-estimate">
          <div className={`smt-est-row highlight ${expectedProfit>=0?"profit":"loss"}`}>
            <span>예상 수익</span>
            <strong>{expectedProfit>=0?"+":""}{fmt(Math.round(expectedProfit))}원 ({expectedProfitRate}%)</strong>
          </div>
        </div>
      )}
      {message && <div className={`smt-message ${message.type}`}>{message.text}</div>}
      <button className={`smt-submit ${mode}`} onClick={handleSubmit} disabled={loading || (mode==="buy" ? !canBuy : !canSell)}>
        {loading ? "처리 중..." : mode==="buy" ? "매수하기" : "매도하기"}
      </button>
    </div>
  );
}
