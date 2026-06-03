// src/pages/AccountPage.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Client } from "@stomp/stompjs";
import {
  getMyInfo, getBalance, getHoldings, getOrders, getProfit,
  getDomesticPrice, getOverseasPrice, getExchangeRate,
  exchangeKrwToUsd, exchangeUsdToKrw, addWatchlist, removeWatchlist, getWatchlist,
  buyStock, sellStock,
  isDomestic, fmt, fmtPrice, getExchangeCode, getLogoUrl, NGROK_URL,
} from "../api/stockApi";
import Twemoji from "../components/Twemoji";
import StockChart from "../components/StockChart";
import OrderBook from "../components/OrderBook";
import "./AccountPage.css";

const TABS = [
  { key: "assets",   label: "자산" },
  { key: "orders",   label: "주문내역" },
  { key: "profit",   label: "수익분석" },
];

export default function AccountPage({ user, setUser }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("assets");

  // URL 쿼리 파라미터로 탭 전환
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["assets", "orders", "profit"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);
  const [showExchange, setShowExchange] = useState(false);
  const [exchangeMode, setExchangeMode] = useState("krw"); // krw | usd

  const [balance, setBalance] = useState(0);
  const [dollarBalance, setDollarBalance] = useState(0);
  const [holdings, setHoldings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [profit, setProfit] = useState({ totalProfit: 0, profitList: [] });
  const [profitPeriod, setProfitPeriod] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [exRate, setExRate] = useState(1380);
  const [currentPrices, setCurrentPrices] = useState({});
  const [wsConnected, setWsConnected] = useState(false);
  const clientRef = useRef(null);
  const subsRef = useRef(new Map());

  // 보유종목 필터
  const [holdingFilter, setHoldingFilter] = useState("all");
  const [holdingSearch, setHoldingSearch] = useState("");

  // 종목 모달
  const [stockModal, setStockModal] = useState(null);
  const [modalStock, setModalStock] = useState(null);
  const [tradeModal, setTradeModal] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const modalWsRef = useRef(null);

  // 환전
  const [exAmount, setExAmount] = useState("");
  const [exLoading, setExLoading] = useState(false);
  const [exMsg, setExMsg] = useState(null);

  useEffect(() => {
    fetchAll();
    const handler = () => fetchAll();
    window.addEventListener("cubic_trade_complete", handler);
    return () => window.removeEventListener("cubic_trade_complete", handler);
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [me, h, o, rate] = await Promise.allSettled([
        getMyInfo(), getHoldings(), getOrders(), getExchangeRate(),
      ]);
      if (me.status === "fulfilled") {
        setBalance(me.value.balance || 0);
        setDollarBalance(me.value.dollarBalance || 0);
        if (setUser) setUser(me.value);
      }
      if (h.status === "fulfilled") setHoldings(h.value || []);
      if (o.status === "fulfilled") setOrders(o.value || []);
      if (rate.status === "fulfilled") setExRate(rate.value.rate);
    } catch (e) { console.error("계좌 로드 실패:", e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => { try { const p = await getProfit(profitPeriod); setProfit(p); } catch {} })();
  }, [profitPeriod]);

  // 초기 현재가
  useEffect(() => {
    if (!holdings.length) return;
    (async () => {
      const prices = {};
      await Promise.allSettled(holdings.map(async h => {
        try {
          const d = isDomestic(h.market)
            ? await getDomesticPrice(h.symbol)
            : await getOverseasPrice(h.symbol, getExchangeCode(h.market));
          prices[h.symbol] = { price: parseFloat(d.price), change: d.change, changePercent: d.changePercent };
        } catch {}
      }));
      setCurrentPrices(prev => ({ ...prev, ...prices }));
    })();
  }, [holdings]);

  // WebSocket
  useEffect(() => {
    if (!holdings.length) return;
    const client = new Client({
      brokerURL: NGROK_URL.replace("https://","wss://").replace("http://","ws://") + "/ws/websocket",
      connectHeaders: { "ngrok-skip-browser-warning": "true" },
      reconnectDelay: 5000,
      onConnect: () => {
        setWsConnected(true);
        holdings.forEach(h => {
          const dom = isDomestic(h.market);
          const key = `${dom?"d":"o"}-${h.symbol}`;
          if (subsRef.current.has(key)) return;
          try {
            if (dom) {
              client.publish({ destination: "/app/subscribe/domestic/price", body: h.symbol });
              const sub = client.subscribe(`/topic/domestic/${h.symbol}`, msg => {
                const d = JSON.parse(msg.body);
                setCurrentPrices(prev => ({ ...prev, [h.symbol]: { price: parseFloat(d.price), change: d.change, changePercent: d.changePercent } }));
              });
              subsRef.current.set(key, sub);
            } else {
              const exc = getExchangeCode(h.market);
              client.publish({ destination: "/app/subscribe/overseas", body: `${h.symbol},${exc}` });
              const sub = client.subscribe(`/topic/overseas/${h.symbol}`, msg => {
                const d = JSON.parse(msg.body);
                setCurrentPrices(prev => ({ ...prev, [h.symbol]: { price: parseFloat(d.price), change: d.change, changePercent: d.changePercent } }));
              });
              subsRef.current.set(key, sub);
            }
          } catch {}
        });
      },
      onDisconnect: () => setWsConnected(false),
    });
    client.activate(); clientRef.current = client;
    return () => {
      subsRef.current.forEach(s => { try { s.unsubscribe(); } catch {} });
      subsRef.current.clear();
      client.deactivate();
    };
  }, [holdings.map(h => h.symbol).join(",")]);

  // 환전
  const handleExchange = async () => {
    if (!exAmount || Number(exAmount) <= 0) return;
    setExLoading(true); setExMsg(null);
    try {
      const res = exchangeMode === "krw"
        ? await exchangeKrwToUsd(Number(exAmount))
        : await exchangeUsdToKrw(Number(exAmount));
      setBalance(res.balance);
      setDollarBalance(res.dollarBalance);
      setExMsg({ type: "success", text: exchangeView === "krw"
        ? `$${res.exchanged.toFixed(2)} 환전 완료`
        : `${fmt(Math.round(res.exchanged))}원 환전 완료` });
      setExAmount("");
    } catch (e) {
      setExMsg({ type: "error", text: typeof e.response?.data === "string" ? e.response.data : "환전 실패" });
    } finally { setExLoading(false); }
  };

  const preview = exchangeMode === "krw"
    ? (Number(exAmount) > 0 ? `≈ $${(Number(exAmount) / exRate).toFixed(2)}` : "")
    : (Number(exAmount) > 0 ? `≈ ${fmt(Math.round(Number(exAmount) * exRate))}원` : "");

  const loadWatchlist = async () => {
    try { setWatchlist(await getWatchlist() || []); } catch {}
  };

  useEffect(() => { loadWatchlist(); }, []);

  const isWatched = (symbol) => watchlist.some(w => w.symbol === symbol);

  const handleSelectStock = async (h) => {
    const stock = {
      symbol: h.symbol, name: h.name, market: h.market, exchange: h.exchange,
      price: currentPrices[h.symbol]?.price || h.avgPrice,
    };
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
    setStockModal(null); setModalStock(null); setTradeModal(null);
    if (modalWsRef.current) { modalWsRef.current.deactivate(); modalWsRef.current = null; }
  };

  const getPrice = h => currentPrices[h.symbol]?.price || h.avgPrice;
  const getEval = h => getPrice(h) * h.quantity;
  const getBuy = h => h.avgPrice * h.quantity;
  const getPL = h => getEval(h) - getBuy(h);
  const getPLRate = h => { const b = getBuy(h); return b > 0 ? ((getPL(h) / b) * 100).toFixed(2) : "0.00"; };
  const totalBuy = holdings.reduce((s, h) => s + getBuy(h), 0);
  const totalEval = holdings.reduce((s, h) => s + getEval(h), 0);
  const totalPL = totalEval - totalBuy;
  const totalPLRate = totalBuy > 0 ? ((totalPL / totalBuy) * 100).toFixed(2) : "0.00";
  const totalAsset = Number(balance) + totalEval + (dollarBalance * exRate);



  return (
    <div className="account-page">
      {/* 메인 콘텐츠 */}
      <div className="account-main">

        {/* ── 자산 탭 ── */}
        {activeTab === "assets" && (
          <div className="acc-content">
            {/* 상단 3카드 */}
            <div className="asset-summary-cards">
              <div className="asset-sum-card">
                <span className="asset-sum-flag"><Twemoji emoji="🇰🇷" size={32} /></span>
                <div>
                  <span className="asset-sum-label">원화</span>
                  <span className="asset-sum-value">{fmt(Math.round(balance))}원</span>
                  <span className="asset-sum-sub">주문 가능 금액</span>
                </div>
              </div>
              <div className="asset-sum-card">
                <span className="asset-sum-flag"><Twemoji emoji="🇺🇸" size={32} /></span>
                <div>
                  <span className="asset-sum-label">달러</span>
                  <span className="asset-sum-value">${dollarBalance.toFixed(2)}</span>
                  <span className="asset-sum-sub">{fmt(Math.round(dollarBalance * exRate))}원</span>
                </div>
              </div>
              <div className="asset-sum-card primary">
                <div className="asset-sum-card-top">
                  <div>
                    <span className="asset-sum-label">
                      총 자산 {wsConnected && <span className="ws-badge-acc">● LIVE</span>}
                    </span>
                    <span className="asset-sum-value">{fmt(Math.round(totalAsset))}원</span>
                    <span className={`asset-sum-pl ${totalPL >= 0 ? "up" : "dn"}`}>
                      {totalPL >= 0 ? "+" : ""}{fmt(Math.round(totalPL))}원 ({totalPLRate}%)
                    </span>
                  </div>
                  <button className="ex-inline-btn" onClick={() => { setShowExchange(true); setExAmount(""); setExMsg(null); }}>환전</button>
                </div>
              </div>
            </div>

            {/* 환전 모달 */}
            {showExchange && (
              <div className="ls-modal-overlay" onClick={() => { setShowExchange(false); setExAmount(""); setExMsg(null); }}>
                <div className="ls-modal" onClick={e => e.stopPropagation()} style={{width: 360}}>
                  <div className="ls-modal-title">환전</div>
                  <div className="ls-modal-tabs">
                    <button className={`ls-modal-tab ${exchangeMode === "krw" ? "active" : ""}`} onClick={() => { setExchangeMode("krw"); setExAmount(""); setExMsg(null); }}>달러 사기</button>
                    <button className={`ls-modal-tab ${exchangeMode === "usd" ? "active" : ""}`} onClick={() => { setExchangeMode("usd"); setExAmount(""); setExMsg(null); }}>달러 팔기</button>
                  </div>
                  <div className="ex-inline-balances" style={{marginBottom: 16}}>
                    <span>🇰🇷 {fmt(Math.round(balance))}원</span>
                    <span className="ex-inline-arrow">⇄</span>
                    <span>🇺🇸 ${dollarBalance.toFixed(2)}</span>
                    <span className="ex-rate-badge">1 USD = {fmt(Math.round(exRate))}원</span>
                  </div>
                  <div className="ls-modal-input-wrap">
                    <span className="ls-modal-label">{exchangeMode === "krw" ? "원화 입력" : "달러 입력"}</span>
                    <div className="ex-input-wrap" style={{border: "1px solid var(--c-border)", borderRadius: 10, padding: "4px 14px"}}>
                      <input type="number" value={exAmount} onChange={e => { setExAmount(e.target.value); setExMsg(null); }} placeholder={exchangeMode === "krw" ? "원화 입력" : "달러 입력"} autoFocus style={{border:"none",background:"none",outline:"none",fontSize:16,fontWeight:700,color:"var(--c-text)",fontFamily:"inherit",width:"100%",padding:"10px 0"}}/>
                      <span className="ex-input-unit">{exchangeMode === "krw" ? "원" : "$"}</span>
                    </div>
                  </div>
                  {preview && <div className="ex-preview-text">{preview}</div>}
                  {exMsg && <div className={`ex-result-msg ${exMsg.type}`} style={{marginBottom: 12}}>{exMsg.text}</div>}
                  <div className="ls-modal-btns">
                    <button className="ls-modal-cancel" onClick={() => { setShowExchange(false); setExAmount(""); setExMsg(null); }}>취소</button>
                    <button className="ls-modal-confirm" onClick={handleExchange} disabled={exLoading || !exAmount || Number(exAmount) <= 0}>
                      {exLoading ? "처리 중..." : exchangeMode === "krw" ? "달러 사기" : "달러 팔기"}
                    </button>
                  </div>
                </div>
              </div>
            )}


            {/* 보유 종목 */}
            <div className="acc-section">
              <div className="acc-section-header">
                <div className="holdings-header-left">
                  <span className="acc-section-title">보유 종목 ({holdings.length})</span>
                  <div className="holdings-filter-tabs">
                    {[["all","전체"],["domestic","국내"],["overseas","해외"]].map(([key,label]) => (
                      <button key={key} className={`holdings-filter-tab ${holdingFilter===key?"active":""}`} onClick={() => setHoldingFilter(key)}>{label}</button>
                    ))}
                  </div>
                </div>
                <div className="holdings-search-wrap">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input
                    type="text"
                    placeholder="종목 검색..."
                    value={holdingSearch}
                    onChange={e => setHoldingSearch(e.target.value)}
                  />
                  {holdingSearch && <button onClick={() => setHoldingSearch("")}>✕</button>}
                </div>
              </div>
              <div className="acc-table">
                {loading ? (
                  <div className="acc-empty"><div className="loading-spinner" /></div>
                ) : !holdings.filter(h => (holdingFilter === "all" ? true : holdingFilter === "domestic" ? isDomestic(h.market) : !isDomestic(h.market)) && (!holdingSearch || h.name?.includes(holdingSearch) || h.symbol?.toLowerCase().includes(holdingSearch.toLowerCase()))).length ? (
                  <div className="acc-empty">
                    <span className="acc-empty-ico">📭</span>
                    <p>보유 종목이 없어요</p>
                    <small>홈에서 종목을 매수해 보세요</small>
                  </div>
                ) : (
                  <>
                    <div className="acc-table-head holdings-grid">
                      <span>종목</span><span>현재가</span><span>수량</span>
                      <span>평균매수가</span><span>평가금액</span><span>수익률</span>
                    </div>
                    {holdings.filter(h => (holdingFilter === "all" ? true : holdingFilter === "domestic" ? isDomestic(h.market) : !isDomestic(h.market)) && (!holdingSearch || h.name?.includes(holdingSearch) || h.symbol?.toLowerCase().includes(holdingSearch.toLowerCase()))).map(h => {
                      const pl = getPL(h); const up = pl >= 0;
                      return (
                        <div key={h.id} className="acc-table-row holdings-grid clickable" onClick={() => handleSelectStock(h)}>
                          <span className="acc-name">
                            {(() => {
                              const logo = getLogoUrl(h.symbol, h.market);
                              return logo
                                ? <img src={logo} className="acc-stock-logo" alt="" onError={e => { e.target.style.display="none"; }} />
                                : <div className="acc-stock-logo-fb">{h.name?.substring(0,2)}</div>;
                            })()}
                            <span className="acc-name-info"><strong>{h.name}</strong><small>{h.symbol}</small></span>
                          </span>
                          <span className="acc-num"><span className={`live-price ${currentPrices[h.symbol] ? "live" : ""}`}>{fmtPrice(getPrice(h), h.market)}</span></span>
                          <span className="acc-num">{fmt(h.quantity)}주</span>
                          <span className="acc-num">{fmtPrice(h.avgPrice, h.market)}</span>
                          <span className="acc-num strong">{fmt(Math.round(getEval(h)))}{isDomestic(h.market) ? "원" : "$"}</span>
                          <span className={`acc-num profit-cell ${up ? "up" : "down"}`}>
                            {up ? "+" : ""}{fmt(Math.round(pl))}{isDomestic(h.market) ? "원" : "$"}
                            <small>({getPLRate(h)}%)</small>
                          </span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 주문내역 탭 ── */}
        {activeTab === "orders" && (
          <div className="acc-content">
            <div className="acc-section">
              <div className="acc-section-title">주문 내역 ({orders.length})</div>
              <div className="acc-table">
                {!orders.length ? (
                  <div className="acc-empty"><span className="acc-empty-ico">📜</span><p>주문 내역이 없어요</p></div>
                ) : (
                  <>
                    <div className="acc-table-head orders-grid">
                      <span>종목</span><span>구분</span><span>수량</span><span>체결가</span><span>주문 시간</span>
                    </div>
                    {orders.slice(0, 50).map(o => (
                      <div key={o.id} className="acc-table-row orders-grid">
                        <span className="acc-name"><strong>{o.name}</strong><small>{o.symbol}</small></span>
                        <span><span className={`order-type ${o.type === "BUY" ? "buy" : "sell"}`}>{o.type === "BUY" ? "매수" : "매도"}</span></span>
                        <span className="acc-num">{fmt(o.quantity)}주</span>
                        <span className="acc-num">{fmt(o.price)}원</span>
                        <span className="acc-num small">{new Date(o.createdAt).toLocaleString("ko-KR")}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── 수익분석 탭 ── */}
        {activeTab === "profit" && (
          <div className="acc-content">
            <div className="acc-section">
              <div className="acc-section-title">실현 손익</div>
              <div className="acc-table">
                <div className="profit-period-tabs">
                  {["DAY","WEEK","MONTH","YEAR","ALL"].map(p => (
                    <button key={p} className={`period-chip ${profitPeriod === p ? "active" : ""}`} onClick={() => setProfitPeriod(p)}>
                      {{ DAY:"오늘", WEEK:"1주", MONTH:"1개월", YEAR:"1년", ALL:"전체" }[p]}
                    </button>
                  ))}
                </div>
                <div className="profit-total">
                  <span>실현 손익</span>
                  <strong className={profit.totalProfit >= 0 ? "up" : "down"}>
                    {profit.totalProfit >= 0 ? "+" : ""}{fmt(Math.round(profit.totalProfit))}원
                  </strong>
                </div>
                {profit.profitList?.length > 0 ? profit.profitList.map((p, i) => (
                  <div key={i} className="acc-table-row orders-grid">
                    <span className="acc-name"><strong>{p.name || p.symbol}</strong><small>{p.symbol}</small></span>
                    <span><span className="order-type sell">매도</span></span>
                    <span className="acc-num">{fmt(p.quantity)}주</span>
                    <span className={`acc-num ${p.profit >= 0 ? "up" : "down"}`}>
                      {p.profit >= 0 ? "+" : ""}{fmt(Math.round(p.profit))}원
                    </span>
                    <span className="acc-num small">{p.createdAt ? new Date(p.createdAt).toLocaleString("ko-KR") : ""}</span>
                  </div>
                )) : (
                  <div className="acc-empty"><span className="acc-empty-ico">📊</span><p>해당 기간 실현 손익이 없어요</p></div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 종목 상세 모달 */}
      {stockModal && modalStock && (
        <div className="stock-modal-overlay" onClick={closeStockModal}>
          <div className="stock-modal" onClick={e => e.stopPropagation()}>
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
                  <TradeModalInline
                    stock={modalStock}
                    mode={tradeModal || "buy"}
                    onSuccess={() => { fetchAll(); window.dispatchEvent(new Event("cubic_trade_complete")); }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
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
