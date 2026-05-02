// src/pages/AccountPage.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import {
  getMyInfo, getBalance, getHoldings, getOrders, getProfit,
  getDomesticPrice, getOverseasPrice, getExchangeRate,
  exchangeKrwToUsd, exchangeUsdToKrw,
  isDomestic, fmt, fmtPrice, getExchangeCode, NGROK_URL,
} from "../api/stockApi";
import "./AccountPage.css";

export default function AccountPage({ user, setUser }) {
  const navigate = useNavigate();
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
  const [exMode, setExMode] = useState(null);
  const [exAmount, setExAmount] = useState("");
  const [exLoading, setExLoading] = useState(false);
  const [exMsg, setExMsg] = useState(null);

  useEffect(() => { fetchAll(); }, []);

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
          const d = isDomestic(h.market) ? await getDomesticPrice(h.symbol) : await getOverseasPrice(h.symbol, getExchangeCode(h.market));
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
      webSocketFactory: () => new SockJS(`${NGROK_URL}/ws`),
      reconnectDelay: 5000,
      onConnect: () => {
        setWsConnected(true);
        holdings.forEach(h => {
          const dom = isDomestic(h.market);
          const key = `${dom?"d":"o"}-${h.symbol}`;
          if (subsRef.current.has(key)) return;
          try {
            if (dom) {
              client.publish({ destination: "/app/subscribe/domestic", body: h.symbol });
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
    return () => { subsRef.current.forEach(s => { try{s.unsubscribe();}catch{} }); subsRef.current.clear(); client.deactivate(); };
  }, [holdings.map(h => h.symbol).join(",")]);

  // 환전
  const handleExchange = async () => {
    if (!exAmount || Number(exAmount) <= 0) return;
    setExLoading(true); setExMsg(null);
    try {
      const res = exMode === "buy" ? await exchangeKrwToUsd(Number(exAmount)) : await exchangeUsdToKrw(Number(exAmount));
      setBalance(res.balance); setDollarBalance(res.dollarBalance);
      setExMsg({ type: "success", text: exMode === "buy" ? `$${res.exchanged.toFixed(2)} 환전 완료` : `${fmt(Math.round(res.exchanged))}원 환전 완료` });
      setExAmount("");
    } catch (e) {
      setExMsg({ type: "error", text: typeof e.response?.data === "string" ? e.response.data : "환전 실패" });
    } finally { setExLoading(false); }
  };

  const preview = exMode === "buy"
    ? (Number(exAmount) > 0 ? `≈ $${(Number(exAmount) / exRate).toFixed(2)}` : "")
    : (Number(exAmount) > 0 ? `≈ ${fmt(Math.round(Number(exAmount) * exRate))}원` : "");

  // 종목 클릭 → 홈에서 차트 보기
  const handleStockClick = (h) => {
    sessionStorage.setItem("cubic_selected_stock", JSON.stringify({ symbol: h.symbol, name: h.name, market: h.market, exchange: h.exchange, price: currentPrices[h.symbol]?.price || h.avgPrice, change: currentPrices[h.symbol]?.change, changePercent: currentPrices[h.symbol]?.changePercent }));
    navigate("/");
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
      <div className="account-container">
        <div className="account-header">
          <div><h1>내 계좌</h1><p>{user?.name}님의 모의 투자 현황 {wsConnected && <span className="ws-badge-acc">● LIVE</span>}</p></div>
          <button className="refresh-btn" onClick={fetchAll}>새로고침</button>
        </div>

        {/* 자산 카드 */}
        <div className="asset-summary">
          <div className="asset-card primary">
            <span className="asset-label">총 자산</span>
            <span className="asset-value">{fmt(Math.round(totalAsset))}원</span>
            <span className="asset-sub">예수금 + 달러 잔고 + 실시간 평가액</span>
          </div>
          <div className="asset-card">
            <span className="asset-label">원화 예수금</span>
            <span className="asset-value">{fmt(Math.round(balance))}원</span>
          </div>
          <div className="asset-card">
            <span className="asset-label">실시간 평가액</span>
            <span className="asset-value">{fmt(Math.round(totalEval))}원</span>
            <div className={`asset-profit ${totalPL >= 0 ? "up" : "down"}`}>
              {totalPL >= 0 ? "+" : ""}{fmt(Math.round(totalPL))}원 ({totalPLRate}%)
            </div>
          </div>
        </div>

        {/* 환전 — 토스 스타일 */}
        <div className="exchange-card">
          <div className="ex-header">
            <div className="ex-balances">
              <div className="ex-bal-item">
                <span className="ex-flag">🇰🇷</span>
                <div>
                  <span className="ex-currency">원화</span>
                  <strong className="ex-amount">{fmt(Math.round(balance))}원</strong>
                </div>
              </div>
              <div className="ex-arrow">⇄</div>
              <div className="ex-bal-item">
                <span className="ex-flag">🇺🇸</span>
                <div>
                  <span className="ex-currency">달러</span>
                  <strong className="ex-amount">${dollarBalance.toFixed(2)}</strong>
                </div>
              </div>
            </div>
            <div className="ex-rate-badge">1 USD = {fmt(Math.round(exRate))}원</div>
          </div>

          <div className="ex-actions">
            <button className={`ex-action-btn ${exMode==="buy"?"active buy":""}`} onClick={()=>setExMode(exMode==="buy"?null:"buy")}>
              <span className="ex-action-icon">💵</span>
              <span>달러 사기</span>
              <small>원화 → 달러</small>
            </button>
            <button className={`ex-action-btn ${exMode==="sell"?"active sell":""}`} onClick={()=>setExMode(exMode==="sell"?null:"sell")}>
              <span className="ex-action-icon">💴</span>
              <span>달러 팔기</span>
              <small>달러 → 원화</small>
            </button>
          </div>

          {exMode && (
            <div className="ex-form">
              <div className="ex-input-row">
                <input type="number" value={exAmount} onChange={e=>setExAmount(e.target.value)} placeholder={exMode==="buy"?"원화 금액 입력":"달러 금액 입력"}/>
                <span className="ex-unit">{exMode==="buy"?"원":"$"}</span>
              </div>
              {preview && <div className="ex-preview">{preview}</div>}
              <button className="ex-submit" onClick={handleExchange} disabled={exLoading || !exAmount || Number(exAmount)<=0}>
                {exLoading ? "처리 중..." : exMode==="buy" ? "달러 사기" : "달러 팔기"}
              </button>
              {exMsg && <div className={`ex-msg ${exMsg.type}`}>{exMsg.text}</div>}
            </div>
          )}
        </div>

        {/* 포트폴리오 */}
        {holdings.length > 0 && (
          <div className="portfolio-summary-bar">
            <span>총 매수금액: <strong>{fmt(Math.round(totalBuy))}원</strong></span>
            <span>총 평가금액: <strong>{fmt(Math.round(totalEval))}원</strong></span>
            <span className={totalPL >= 0 ? "up" : "down"}>수익: <strong>{totalPL >= 0 ? "+" : ""}{fmt(Math.round(totalPL))}원 ({totalPLRate}%)</strong></span>
          </div>
        )}

        {/* 보유 종목 */}
        <div className="acc-section-title">보유 종목 ({holdings.length})</div>
        <div className="acc-table">
          {loading ? <div className="acc-empty"><div className="loading-spinner"/></div>
          : !holdings.length ? <div className="acc-empty"><span className="acc-empty-ico">📭</span><p>보유 종목이 없어요</p><small>홈에서 종목을 매수해 보세요</small></div>
          : <>
            <div className="acc-table-head holdings-grid-v2"><span>종목</span><span>현재가</span><span>수량</span><span>평균매수가</span><span>평가금액</span><span>수익률</span></div>
            {holdings.map(h => {
              const pl = getPL(h); const up = pl >= 0;
              return (
                <div key={h.id} className="acc-table-row holdings-grid-v2 clickable" onClick={() => handleStockClick(h)}>
                  <span className="acc-name"><strong>{h.name}</strong><small>{h.symbol} · {h.market}</small></span>
                  <span className="acc-num"><span className={`live-price ${currentPrices[h.symbol]?"live":""}`}>{fmtPrice(getPrice(h),h.market)}</span></span>
                  <span className="acc-num">{fmt(h.quantity)}주</span>
                  <span className="acc-num">{fmtPrice(h.avgPrice,h.market)}</span>
                  <span className="acc-num strong">{fmt(Math.round(getEval(h)))}{isDomestic(h.market)?"원":"$"}</span>
                  <span className={`acc-num profit-cell ${up?"up":"down"}`}>{up?"+":""}{fmt(Math.round(pl))}{isDomestic(h.market)?"원":"$"}<small>({getPLRate(h)}%)</small></span>
                </div>
              );
            })}
          </>}
        </div>

        {/* 주문 내역 */}
        <div className="acc-section-title">주문 내역 ({orders.length})</div>
        <div className="acc-table">
          {!orders.length ? <div className="acc-empty"><span className="acc-empty-ico">📜</span><p>주문 내역이 없어요</p></div>
          : <>
            <div className="acc-table-head orders-grid"><span>종목</span><span>구분</span><span>수량</span><span>체결가</span><span>주문 시간</span></div>
            {orders.slice(0,20).map(o => (
              <div key={o.id} className="acc-table-row orders-grid">
                <span className="acc-name"><strong>{o.name}</strong><small>{o.symbol}</small></span>
                <span><span className={`order-type ${o.type==="BUY"?"buy":"sell"}`}>{o.type==="BUY"?"매수":"매도"}</span></span>
                <span className="acc-num">{fmt(o.quantity)}주</span>
                <span className="acc-num">{fmt(o.price)}원</span>
                <span className="acc-num small">{new Date(o.createdAt).toLocaleString("ko-KR")}</span>
              </div>
            ))}
          </>}
        </div>

        {/* 실현 손익 */}
        <div className="acc-section-title">실현 손익</div>
        <div className="acc-table">
          <div className="profit-period-tabs">
            {["DAY","WEEK","MONTH","YEAR","ALL"].map(p =>
              <button key={p} className={`period-chip ${profitPeriod===p?"active":""}`} onClick={()=>setProfitPeriod(p)}>
                {{DAY:"오늘",WEEK:"1주",MONTH:"1개월",YEAR:"1년",ALL:"전체"}[p]}
              </button>
            )}
          </div>
          <div className="profit-total">
            <span>실현 손익</span>
            <strong className={profit.totalProfit>=0?"up":"down"}>{profit.totalProfit>=0?"+":""}{fmt(Math.round(profit.totalProfit))}원</strong>
          </div>
          {profit.profitList?.length > 0 ? profit.profitList.map((p,i) => (
            <div key={i} className="acc-table-row orders-grid">
              <span className="acc-name"><strong>{p.name||p.symbol}</strong><small>{p.symbol}</small></span>
              <span><span className="order-type sell">매도</span></span>
              <span className="acc-num">{fmt(p.quantity)}주</span>
              <span className={`acc-num ${p.profit>=0?"up":"down"}`}>{p.profit>=0?"+":""}{fmt(Math.round(p.profit))}원</span>
              <span className="acc-num small">{p.createdAt?new Date(p.createdAt).toLocaleString("ko-KR"):""}</span>
            </div>
          )) : <div className="acc-empty"><span className="acc-empty-ico">📊</span><p>해당 기간 실현 손익이 없어요</p></div>}
        </div>
      </div>
    </div>
  );
}
