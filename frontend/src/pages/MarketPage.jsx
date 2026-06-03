import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Client } from "@stomp/stompjs";
import {
  getDomesticRanking, getOverseasRanking,
  getDomesticMarketNews, getOverseasMarketNews,
  getWatchlist, addWatchlist, removeWatchlist,
  getExchangeRate, isDomestic, fmt, fmtChange, isUp,
<<<<<<< HEAD
  getLogoUrl, getExchangeCode, NGROK_URL,
  buyStock, sellStock, getBalance, getHoldings,
=======
  getLogoUrl, getExchangeCode, NGROK_URL, getCubicBatch,
>>>>>>> cbaa4cf27a63f42e1989d59059cfbee76597ad6a
} from "../api/stockApi";
import StockChart from "../components/StockChart";
import OrderBook from "../components/OrderBook";
import { getDomesticPrice, getOverseasPrice, fmtPrice, fmtChange as fmtCh, isUp as isUpCheck } from "../api/stockApi";
import Twemoji from "../components/Twemoji";
import "./MarketPage.css";

const ICON_COLORS = {
  삼성전자:"#1428A0", SK하이닉스:"#EA002C", 현대차:"#002C5F",
  LG화학:"#A50034", 카카오:"#FAE100", NAVER:"#76B900",
  Apple:"#555", NVIDIA:"#76B900", Tesla:"#CC0000",
  Microsoft:"#00A4EF", Amazon:"#FF9900", Alphabet:"#4285F4", Meta:"#1877F2",
};

function Sparkline({ changePercent, width = 80, height = 32, color }) {
  const up = isUp(changePercent);
  const c = color || (up ? "#22c55e" : "#ef4444");
  const pct = Math.min(Math.abs(Number(changePercent) || 0), 10) / 10;

  const points = up
    ? [
        [0, height * 0.7],
        [width * 0.15, height * 0.65],
        [width * 0.3, height * 0.75],
        [width * 0.45, height * 0.55],
        [width * 0.6, height * 0.45],
        [width * 0.75, height * (0.4 - pct * 0.2)],
        [width, height * (0.2 - pct * 0.1)],
      ]
    : [
        [0, height * 0.3],
        [width * 0.15, height * 0.35],
        [width * 0.3, height * 0.25],
        [width * 0.45, height * 0.45],
        [width * 0.6, height * 0.55],
        [width * 0.75, height * (0.6 + pct * 0.2)],
        [width, height * (0.75 + pct * 0.1)],
      ];

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const fill = [...points, [width, height], [0, height]].map((p, i) =>
    i === 0 ? `M${p[0].toFixed(1)},${p[1].toFixed(1)}` : `L${p[0].toFixed(1)},${p[1].toFixed(1)}`
  ).join(" ") + " Z";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`sg-${up?'up':'dn'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={c} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#sg-${up?'up':'dn'})`}/>
      <path d={d} fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SparklineCard({ changePercent, width = 100, height = 40 }) {
  return <Sparkline changePercent={changePercent} width={width} height={height} />;
}

function CubicSignalBar({ score }) {
  if (score === null || score === undefined) {
    return <span className="market-signal-dash">-</span>;
  }
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
        <div className="cubic-signal-buy" style={{ width: `${buyPct}%` }}/>
      </div>
    </div>
  );
}

const fmtVolume = (val) => {
  if (!val) return "-";
  const num = Number(val);
  if (isNaN(num)) return "-";
  if (num >= 1_000_000_000_000) return (num / 1_000_000_000_000).toFixed(1) + "조";
  if (num >= 100_000_000) return Math.round(num / 100_000_000) + "억";
  return fmt(Math.round(num));
};

export default function MarketPage({ user }) {
  const navigate = useNavigate();
  const [market, setMarket] = useState("domestic");
  const [sortType, setSortType] = useState("VOLUME");
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exRate, setExRate] = useState({ rate: 1380 });
  const [watchlist, setWatchlist] = useState([]);
  const wsClientRef = useRef(null);
  const wsSubsRef = useRef(new Map());
  const stocksRef = useRef([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [topStocks, setTopStocks] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [stockModal, setStockModal] = useState(null);
  const [modalStock, setModalStock] = useState(null);
  const [tradeModal, setTradeModal] = useState(null);
  const modalWsRef = useRef(null);
  const [cubicScores, setCubicScores] = useState({});

  useEffect(() => { fetchStocks(); }, [market, sortType]);
  useEffect(() => { fetchTopStocks(); }, [market]);
  useEffect(() => {
    (async () => { try { setExRate(await getExchangeRate()); } catch {} })();
  }, []);
  useEffect(() => { if (user) loadWatchlist(); }, [user]);

  const loadWatchlist = async () => {
    try { setWatchlist(await getWatchlist() || []); } catch {}
  };

  const fetchTopStocks = async () => {
    try {
      const data = market === "domestic"
        ? await getDomesticRanking("VOLUME")
        : await getOverseasRanking("VOLUME");
      setTopStocks((data || []).slice(0, 4));
    } catch {}
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

  useEffect(() => {
    const wsUrl = NGROK_URL.replace("https://","wss://").replace("http://","ws://") + "/ws/websocket";
    const client = new Client({
      brokerURL: wsUrl, reconnectDelay: 5000,
      connectHeaders: { "ngrok-skip-browser-warning": "true" },
      onConnect: () => { setWsConnected(true); subscribeStocks(client); },
      onDisconnect: () => setWsConnected(false),
    });
    client.activate();
    wsClientRef.current = client;
    return () => { client.deactivate(); };
  }, []);

  const subscribeStocks = useCallback((client) => {
    const cl = client || wsClientRef.current;
    if (!cl?.connected || !stocksRef.current.length) return;
    wsSubsRef.current.forEach(sub => { try { sub.unsubscribe(); } catch {} });
    wsSubsRef.current.clear();
    stocksRef.current.forEach(stock => {
      const dom = isDomestic(stock.market);
      const key = `${dom?"d":"o"}-${stock.symbol}`;
      try {
        if (dom) {
          cl.publish({ destination: "/app/subscribe/domestic/price", body: stock.symbol });
          const sub = cl.subscribe(`/topic/domestic/${stock.symbol}`, msg => {
            try {
              const data = JSON.parse(msg.body);
              setStocks(prev => prev.map(s => s.symbol === data.symbol ? {...s,...data} : s));
              setTopStocks(prev => prev.map(s => s.symbol === data.symbol ? {...s,...data} : s));
            } catch {}
          });
          wsSubsRef.current.set(key, sub);
        } else {
          const exc = stock.exchange || getExchangeCode(stock.market);
          cl.publish({ destination: "/app/subscribe/overseas", body: `${stock.symbol},${exc}` });
          const sub = cl.subscribe(`/topic/overseas/${stock.symbol}`, msg => {
            try {
              const data = JSON.parse(msg.body);
              setStocks(prev => prev.map(s => s.symbol === data.symbol ? {...s,...data} : s));
              setTopStocks(prev => prev.map(s => s.symbol === data.symbol ? {...s,...data} : s));
            } catch {}
          });
          wsSubsRef.current.set(key, sub);
        }
      } catch {}
    });
  }, []);

  useEffect(() => {
    stocksRef.current = stocks;
    if (wsConnected) subscribeStocks();
  }, [stocks, wsConnected]);

  const fetchCubicScores = async (stockList) => {
    if (!stockList?.length) return;
    try {
      const symbols = stockList.map(s => s.symbol);
      const result = await getCubicBatch(symbols);
      setCubicScores(result || {});
    } catch (e) {
      console.warn("Cubic batch 조회 실패:", e);
    }
  };

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const data = market === "domestic"
        ? await getDomesticRanking(sortType)
        : await getOverseasRanking(sortType);
      setStocks(data || []);
      fetchCubicScores(data || []);
    } catch { setStocks([]); }
    finally { setLoading(false); }
  };

  const handleSelectStock = async (stock) => {
    sessionStorage.setItem("cubic_detail_stock", JSON.stringify(stock));
    try {
      const recent = JSON.parse(sessionStorage.getItem("cubic_recent") || "[]");
      const updated = [stock, ...recent.filter(s => s.symbol !== stock.symbol)].slice(0, 10);
      sessionStorage.setItem("cubic_recent", JSON.stringify(updated));
      window.dispatchEvent(new Event("cubic_recent_update"));
    } catch {}

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
            try { const d = JSON.parse(msg.body); setModalStock(prev => prev ? { ...prev, ...d } : prev); } catch {}
          });
        } else {
          const exc = stock.exchange || getExchangeCode(stock.market);
          client.publish({ destination: "/app/subscribe/overseas", body: `${stock.symbol},${exc}` });
          client.subscribe(`/topic/overseas/${stock.symbol}`, msg => {
            try { const d = JSON.parse(msg.body); setModalStock(prev => prev ? { ...prev, ...d } : prev); } catch {}
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

  const filteredStocks = stocks.filter(s =>
    !searchQuery ||
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.symbol?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="market-page">
      <div className="market-header">
        <div className="market-header-left">
          <h1 className="market-title">주식 시장</h1>
          <p className="market-subtitle">실시간 시장 현황을 확인하세요</p>
        </div>
        <div className="market-header-right">
          <div className="market-search-box">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              type="text"
              placeholder="종목 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* TOP4 카드 */}
      <div className="market-top4">
        {topStocks.map(s => {
          const logo = getLogoUrl(s.symbol, s.market);
          const up = isUp(s.changePercent);
          const price = s.price
            ? isDomestic(s.market)
              ? `${fmt(Math.round(Number(s.price)))}원`
              : `$${Number(s.price).toFixed(2)}`
            : "-";
          return (
            <div key={s.symbol} className={`top4-card ${up?"up":"dn"}`} onClick={() => handleSelectStock(s)}>
              <div className="top4-card-header">
                <div className="top4-stock-info">
                  {logo
                    ? <img src={logo} className="top4-logo" alt="" onError={e=>{e.target.style.display="none";}}/>
                    : <div className="top4-logo-fb" style={{background:getBg(s.name)}}>{s.name?.substring(0,2)}</div>
                  }
                  <div className="top4-name-wrap">
                    <span className="top4-name">{s.name}</span>
                    <span className="top4-ticker">{s.symbol}</span>
                  </div>
                </div>
                <button
                  className={`top4-star ${isWatched(s.symbol)?"on":""}`}
                  onClick={e => toggleWatch(s, e)}
                >
                  {isWatched(s.symbol) ? "★" : "☆"}
                </button>
              </div>
              <div className="top4-price">{price}</div>
              <div className="top4-bottom">
                <div className={`top4-change ${up?"up":"dn"}`}>
                  {up ? "▲" : "▼"} {s.changePercent ? fmtChange(s.changePercent) : "-"}
                </div>
                <SparklineCard changePercent={s.changePercent} />
              </div>
            </div>
          );
        })}
      </div>

      {/* 시장 탭 */}
      <div className="market-tabs-wrap">
        <div className="market-main-tabs">
          <button
            className={`market-main-tab ${market==="domestic"?"active":""}`}
            onClick={() => setMarket("domestic")}
          >
            <Twemoji emoji="🇰🇷" />
            <span>국내주식</span>
          </button>
          <button
            className={`market-main-tab ${market==="overseas"?"active":""}`}
            onClick={() => setMarket("overseas")}
          >
            <Twemoji emoji="🇺🇸" />
            <span>미국주식</span>
          </button>
        </div>
        <div className="market-sort-tabs">
          {[["VOLUME","거래대금"],["MARKET_CAP","시가총액"],["RISE","급상승"],["FALL","급하락"]].map(([key,label]) => (
            <button
              key={key}
              className={`market-sort-tab ${sortType===key?"active":""}`}
              onClick={() => setSortType(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 종목 리스트 */}
      <div className="market-list-card">
        <div className="market-list-header">
          <span>종목</span>
          <span>그래프</span>
          <span>등락률</span>
          <span>현재가</span>
          <span>거래대금</span>
          <span>신호</span>
        </div>
        <div className="market-list-body">
          {loading ? (
            <div className="market-list-empty"><div className="loading-spinner"/></div>
          ) : filteredStocks.map((s) => {
            const up = isUp(s.changePercent);
            const price = s.price
              ? isDomestic(s.market)
                ? `${fmt(Math.round(Number(s.price)))}원`
                : `${fmt(Math.round(Number(s.price)*exRate.rate))}원`
              : "-";
            return (
              <div key={s.symbol} className="market-list-row" onClick={() => handleSelectStock(s)}>
                <div className="market-stock-info">
                  <button className={`market-star ${isWatched(s.symbol)?"on":""}`} onClick={e=>toggleWatch(s,e)}>
                    {isWatched(s.symbol)?"★":"☆"}
                  </button>
                  {getLogoUrl(s.symbol, s.market)
                    ? <img src={getLogoUrl(s.symbol, s.market)} className="market-logo" alt="" onError={e=>{e.target.style.display="none";}}/>
                    : <div className="market-logo-fb" style={{background:getBg(s.name)}}>{s.name?.substring(0,2)}</div>
                  }
                  <div className="market-name-wrap">
                    <span className="market-name">{s.name}</span>
                    <span className="market-ticker">{s.symbol}</span>
                  </div>
                </div>
                <div className="market-sparkline">
                  <Sparkline changePercent={s.changePercent} width={80} height={32}/>
                </div>
                <div className={`market-change ${up?"up":"dn"}`}>
                  {s.changePercent ? fmtChange(s.changePercent) : "-"}
                </div>
                <div className="market-price">{price}</div>
                <div className="market-volume">{fmtVolume(s.volume)}</div>
                <div className="market-signal">
                  <CubicSignalBar score={cubicScores[s.symbol]?.cubicScore ?? null} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
                <div><div className="stock-modal-name">{modalStock.name}</div></div>
              </div>
              <div className="stock-modal-right">
                <button className="sma-watch" onClick={async (e) => {
                  e.stopPropagation();
                  if (!user) { alert("로그인 후 이용해 주세요."); return; }
                  try {
                    if (isWatched(modalStock.symbol)) await removeWatchlist(modalStock.symbol);
                    else await addWatchlist(modalStock.symbol, modalStock.name, modalStock.market);
                    await loadWatchlist();
                  } catch {}
                }}>{isWatched(modalStock.symbol) ? "★" : "☆"}</button>
                <button className="sma-detail" onClick={() => { closeStockModal(); navigate(`/stock/${modalStock.symbol}`); }}>상세보기</button>
                <button className="sma-close" onClick={closeStockModal}>✕</button>
              </div>
            </div>

            {/* 메인 그리드 */}
            <div className="stock-modal-grid">
              <div className="stock-modal-left-col">
                <div className="sml-chart-box">
                  <div className="stock-modal-chart">
                    <StockChart stock={modalStock} fullscreen={false} onToggleFullscreen={() => {}}/>
                  </div>
                </div>
                <div className="sml-bottom-row">
                  <div className="sml-ob-col"><OrderBook stock={modalStock}/></div>
                  <div className="sml-ai-col">
                    <div className="sml-ai-header"><span className="sml-ai-title">✦ AI 분석</span></div>
                    <div className="sml-ai-body"><span className="sml-ai-pending">구현 예정</span></div>
                  </div>
                </div>
              </div>
              <div className="stock-modal-right-col">
                <div className="stock-modal-trade">
                  <div className="smt-tabs">
                    <button className={`smt-tab buy ${tradeModal === "buy" || !tradeModal ? "active" : ""}`} onClick={() => setTradeModal("buy")}>매수</button>
                    <button className={`smt-tab sell ${tradeModal === "sell" ? "active" : ""}`} onClick={() => setTradeModal("sell")}>매도</button>
                  </div>
                  {user ? (
                    <TradeModalInline
                      stock={modalStock}
                      mode={tradeModal || "buy"}
                      onSuccess={() => window.dispatchEvent(new Event("cubic_trade_complete"))}
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
