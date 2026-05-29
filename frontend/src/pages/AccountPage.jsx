// src/pages/AccountPage.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Client } from "@stomp/stompjs";
import {
  getMyInfo, getBalance, getHoldings, getOrders, getProfit,
  getDomesticPrice, getOverseasPrice, getExchangeRate,
  exchangeKrwToUsd, exchangeUsdToKrw,
  isDomestic, fmt, fmtPrice, getExchangeCode, NGROK_URL,
} from "../api/stockApi";
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
            {/* 총 자산 */}
            <div className="total-asset-area">
              <div className="total-asset-top">
              <span className="total-asset-label">
                {user?.name}님의 총 자산
                {wsConnected && <span className="ws-badge-acc">● LIVE</span>}
              </span>
              <div className="total-asset-value">{fmt(Math.round(totalAsset))}원</div>
              </div>
              <div className="total-asset-value-row">
                <span className="total-asset-value-num">{fmt(Math.round(totalAsset))}원</span>
                <button className="ex-inline-btn" onClick={() => { setShowExchange(v => !v); setExAmount(""); setExMsg(null); }}>환전</button>
              </div>
              <div className={`total-asset-pl ${totalPL >= 0 ? "up" : "dn"}`}>
                {totalPL >= 0 ? "+" : ""}{fmt(Math.round(totalPL))}원 ({totalPLRate}%)
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
            </div>

            {/* 자산 항목 */}
            <div className="asset-list">
              <div className="asset-list-title">자산 구성</div>

              {/* 원화 — 클릭 시 환전 */}
              <div className="asset-list-row">
                <div className="asset-list-left">
                  <span className="asset-flag">🇰🇷</span>
                  <div>
                    <span className="asset-list-name">원화</span>
                    <span className="asset-list-sub">주문 가능 금액</span>
                  </div>
                </div>
                <div className="asset-list-right">
                  <span className="asset-list-amount">{fmt(Math.round(balance))}원</span>
                </div>
              </div>

              {/* 달러 — 클릭 시 환전 */}
              <div className="asset-list-row">
                <div className="asset-list-left">
                  <span className="asset-flag">🇺🇸</span>
                  <div>
                    <span className="asset-list-name">달러</span>
                    <span className="asset-list-sub">${dollarBalance.toFixed(2)} · {fmt(Math.round(dollarBalance * exRate))}원</span>
                  </div>
                </div>
                <div className="asset-list-right">
                  <span className="asset-list-amount">${dollarBalance.toFixed(2)}</span>
                </div>
              </div>

              {/* 총 투자 금액 */}
              {holdings.length > 0 && (() => {
                const domHoldings = holdings.filter(h => isDomestic(h.market));
                const ovsHoldings = holdings.filter(h => !isDomestic(h.market));
                const domEval = domHoldings.reduce((s, h) => s + getEval(h), 0);
                const domBuy = domHoldings.reduce((s, h) => s + getBuy(h), 0);
                const domPL = domEval - domBuy;
                const domPLRate = domBuy > 0 ? ((domPL / domBuy) * 100).toFixed(2) : "0.00";
                const ovsEval = ovsHoldings.reduce((s, h) => s + getEval(h), 0);
                const ovsBuy = ovsHoldings.reduce((s, h) => s + getBuy(h), 0);
                const ovsPL = ovsEval - ovsBuy;
                const ovsPLRate = ovsBuy > 0 ? ((ovsPL / ovsBuy) * 100).toFixed(2) : "0.00";
                return (
                  <>
                    {/* 총 투자 금액 헤더 */}
                    <div className="asset-list-row invest-total-row">
                      <div className="asset-list-left">
                        <div>
                          <span className="asset-list-name">총 투자 금액</span>
                          <span className="asset-list-sub">보유 종목 기준</span>
                        </div>
                      </div>
                      <div className="asset-list-right invest-total-right">
                        <span className="asset-list-amount">{fmt(Math.round(totalEval))}원</span>
                        <span className={`asset-invest-pl ${totalPL >= 0 ? "up" : "dn"}`}>
                          {totalPL >= 0 ? "+" : ""}{fmt(Math.round(totalPL))}원 ({totalPLRate}%)
                        </span>
                      </div>
                    </div>
                    {/* 국내주식 서브 */}
                    {domHoldings.length > 0 && (
                      <div className="asset-list-row asset-sub-row">
                        <div className="asset-list-left">
                          <span className="asset-flag-sm">🇰🇷</span>
                          <div>
                            <span className="asset-list-name-sm">국내주식</span>
                            <span className="asset-list-sub">{domHoldings.length}종목</span>
                          </div>
                        </div>
                        <div className="asset-list-right invest-total-right">
                          <span className="asset-list-amount-sm">{fmt(Math.round(domEval))}원</span>
                          <span className={`asset-invest-pl-sm ${domPL >= 0 ? "up" : "dn"}`}>
                            {domPL >= 0 ? "+" : ""}{fmt(Math.round(domPL))}원 ({domPLRate}%)
                          </span>
                        </div>
                      </div>
                    )}
                    {/* 해외주식 서브 */}
                    {ovsHoldings.length > 0 && (
                      <div className="asset-list-row asset-sub-row">
                        <div className="asset-list-left">
                          <span className="asset-flag-sm">🌐</span>
                          <div>
                            <span className="asset-list-name-sm">해외주식</span>
                            <span className="asset-list-sub">{ovsHoldings.length}종목</span>
                          </div>
                        </div>
                        <div className="asset-list-right invest-total-right">
                          <span className="asset-list-amount-sm">${ovsEval.toFixed(2)}</span>
                          <span className={`asset-invest-pl-sm ${ovsPL >= 0 ? "up" : "dn"}`}>
                            {ovsPL >= 0 ? "+" : ""}${ovsPL.toFixed(2)} ({ovsPLRate}%)
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* 보유 종목 */}
            <div className="acc-section">
              <div className="acc-section-title">보유 종목 ({holdings.length})</div>
              <div className="acc-table">
                {loading ? (
                  <div className="acc-empty"><div className="loading-spinner" /></div>
                ) : !holdings.length ? (
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
                    {holdings.map(h => {
                      const pl = getPL(h); const up = pl >= 0;
                      return (
                        <div key={h.id} className="acc-table-row holdings-grid clickable" onClick={() => handleStockClick(h)}>
                          <span className="acc-name"><strong>{h.name}</strong><small>{h.symbol} · {h.market}</small></span>
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
