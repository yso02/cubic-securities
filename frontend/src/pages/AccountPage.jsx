// src/pages/AccountPage.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Client } from "@stomp/stompjs";
import {
  getMyInfo, getBalance, getHoldings, getOrders, getProfit,
  getDomesticPrice, getOverseasPrice, getExchangeRate,
  exchangeKrwToUsd, exchangeUsdToKrw,
  isDomestic, fmt, fmtPrice, getExchangeCode, getLogoUrl, NGROK_URL,
} from "../api/stockApi";
import Twemoji from "../components/Twemoji";
import "./AccountPage.css";

const TABS = [
  { key: "assets",   label: "자산" },
  { key: "orders",   label: "주문내역" },
  { key: "profit",   label: "수익분석" },
];

export default function AccountPage({ user, setUser }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("assets");
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

  const handleStockClick = (h) => {
    sessionStorage.setItem("cubic_detail_stock", JSON.stringify({
      symbol: h.symbol, name: h.name, market: h.market, exchange: h.exchange,
      price: currentPrices[h.symbol]?.price || h.avgPrice,
    }));
    navigate(`/stock/${h.symbol}`);
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
      {/* 좌측 사이드바 탭 */}
      <div className="account-sidebar">
        {TABS.map(t => (
          <button key={t.key} className={`acc-tab ${activeTab === t.key ? "active" : ""}`}
            onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

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
                  <button className="ex-inline-btn" onClick={() => { setShowExchange(v => !v); setExAmount(""); setExMsg(null); }}>환전</button>
                </div>
              </div>
            </div>

            {/* 환전 인라인 패널 */}
            {showExchange && (
              <div className="ex-inline-panel">
                <div className="ex-mode-tabs">
                  <button className={`ex-mode-tab ${exchangeMode === "krw" ? "active" : ""}`} onClick={() => { setExchangeMode("krw"); setExAmount(""); setExMsg(null); }}>달러 사기</button>
                  <button className={`ex-mode-tab ${exchangeMode === "usd" ? "active" : ""}`} onClick={() => { setExchangeMode("usd"); setExAmount(""); setExMsg(null); }}>달러 팔기</button>
                </div>
                <div className="ex-inline-balances">
                  <span>🇰🇷 {fmt(Math.round(balance))}원</span>
                  <span className="ex-inline-arrow">⇄</span>
                  <span>🇺🇸 ${dollarBalance.toFixed(2)}</span>
                  <span className="ex-rate-badge">1 USD = {fmt(Math.round(exRate))}원</span>
                </div>
                <div className="ex-input-wrap">
                  <input type="number" value={exAmount} onChange={e => { setExAmount(e.target.value); setExMsg(null); }} placeholder={exchangeMode === "krw" ? "원화 입력" : "달러 입력"} autoFocus />
                  <span className="ex-input-unit">{exchangeMode === "krw" ? "원" : "$"}</span>
                </div>
                {preview && <div className="ex-preview-text">{preview}</div>}
                <button className="ex-confirm-btn" onClick={handleExchange} disabled={exLoading || !exAmount || Number(exAmount) <= 0}>
                  {exLoading ? "처리 중..." : exchangeMode === "krw" ? "달러 사기" : "달러 팔기"}
                </button>
                {exMsg && <div className={`ex-result-msg ${exMsg.type}`}>{exMsg.text}</div>}
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
                        <div key={h.id} className="acc-table-row holdings-grid clickable" onClick={() => handleStockClick(h)}>
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
    </div>
  );
}
