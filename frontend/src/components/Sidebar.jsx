// src/components/Sidebar.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Client } from "@stomp/stompjs";
import {
  getWatchlist, removeWatchlist, getMyInfo, getHoldings,
  isDomestic, fmt, fmtPrice, fmtChange, isUp, getLogoUrl,
  NGROK_URL, getExchangeCode,
} from "../api/stockApi";
import "./Sidebar.css";
import QuizModal from "./QuizModal";

function SunIcon(){return<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>;}
function MoonIcon(){return<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;}

const REALTIME_DOMESTIC = [
  { symbol: "005930", name: "삼성전자" },
  { symbol: "000660", name: "SK하이닉스" },
  { symbol: "035420", name: "NAVER" },
  { symbol: "005380", name: "현대차" },
  { symbol: "051910", name: "LG화학" },
];
const REALTIME_OVERSEAS = [
  { symbol: "AAPL", name: "Apple", exchange: "NAS" },
  { symbol: "NVDA", name: "NVIDIA", exchange: "NAS" },
  { symbol: "TSLA", name: "Tesla", exchange: "NAS" },
  { symbol: "MSFT", name: "Microsoft", exchange: "NAS" },
  { symbol: "AMZN", name: "Amazon", exchange: "NAS" },
];

const isDomesticMarketOpen = () => {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const day = kst.getDay();
  if (day === 0 || day === 6) return false;
  const mins = kst.getHours() * 60 + kst.getMinutes();
  return mins >= 540 && mins < 930;
};
const isOverseasMarketOpen = () => {
  const kst = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const day = kst.getDay();
  const mins = kst.getHours() * 60 + kst.getMinutes();
  if (day === 6) return false;
  if (day === 0 && mins < 1350) return false;
  return mins >= 1350 || mins < 300;
};

export default function Sidebar({ user }) {
  const navigate = useNavigate();
  const [openPanel, setOpenPanel] = useState(null);
  const [dark, setDark] = useState(() => localStorage.getItem("cubic_dark") === "true");
  const [quizOpen, setQuizOpen] = useState(false);

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

  // 내 투자
  const [myBalance, setMyBalance] = useState(0);
  const [myDollar, setMyDollar] = useState(0);
  const [holdings, setHoldings] = useState([]);
  const [holdingPrices, setHoldingPrices] = useState({});
  const [myLoading, setMyLoading] = useState(false);
  const holdingSubsRef = useRef([]);

  const loadMyInvest = async () => {
    if (!user) return;
    setMyLoading(true);
    try {
      const [me, h] = await Promise.allSettled([getMyInfo(), getHoldings()]);
      if (me.status === "fulfilled") {
        setMyBalance(me.value.balance || 0);
        setMyDollar(me.value.dollarBalance || 0);
      }
      if (h.status === "fulfilled") setHoldings(h.value || []);
    } catch {}
    finally { setMyLoading(false); }
  };

  // 내투자 패널 열릴 때 로드
  useEffect(() => {
    if (openPanel === "myinvest") loadMyInvest();
  }, [openPanel, user]);

  // 실시간 체결 (먼저 선언)
  const [trades, setTrades] = useState([]);
  const [rtConnected, setRtConnected] = useState(false);
  const rtClientRef = useRef(null);
  const rtSubsRef = useRef([]);

  // 보유종목 WebSocket 실시간 가격 — 기존 rtClient 재활용
  useEffect(() => {
    if (!holdings.length || !rtClientRef.current?.connected) return;
    const client = rtClientRef.current;

    holdingSubsRef.current.forEach(s => { try { s.unsubscribe(); } catch {} });
    holdingSubsRef.current = [];

    holdings.forEach(h => {
      const dom = isDomestic(h.market);
      try {
        if (dom) {
          client.publish({ destination: "/app/subscribe/domestic/price", body: h.symbol });
          const sub = client.subscribe(`/topic/domestic/${h.symbol}`, msg => {
            try {
              const d = JSON.parse(msg.body);
              setHoldingPrices(prev => ({ ...prev, [h.symbol]: parseFloat(d.price) }));
            } catch {}
          });
          holdingSubsRef.current.push(sub);
        } else {
          const exc = h.exchange || getExchangeCode(h.market);
          client.publish({ destination: "/app/subscribe/overseas", body: `${h.symbol},${exc}` });
          const sub = client.subscribe(`/topic/overseas/${h.symbol}`, msg => {
            try {
              const d = JSON.parse(msg.body);
              setHoldingPrices(prev => ({ ...prev, [h.symbol]: parseFloat(d.price) }));
            } catch {}
          });
          holdingSubsRef.current.push(sub);
        }
      } catch {}
    });
    return () => {
      holdingSubsRef.current.forEach(s => { try { s.unsubscribe(); } catch {} });
      holdingSubsRef.current = [];
    };
  }, [holdings, rtConnected]);

  useEffect(() => {
    const wsURL = NGROK_URL.replace("https://", "wss://").replace("http://", "ws://") + "/ws/websocket";
    const client = new Client({
      brokerURL: wsURL,
      connectHeaders: { "ngrok-skip-browser-warning": "true" },
      reconnectDelay: 8000,
      onConnect: () => {
        setRtConnected(true);
        REALTIME_DOMESTIC.forEach(({ symbol, name }) => {
          client.publish({ destination: "/app/subscribe/domestic", body: symbol });
          const sub = client.subscribe(`/topic/tradetick/${symbol}`, msg => {
            try {
              const tick = JSON.parse(msg.body);
              setTrades(prev => [{ ...tick, symbol, name, domestic: true, ts: Date.now() }, ...prev].slice(0, 50));
            } catch {}
          });
          rtSubsRef.current.push(sub);
        });
        REALTIME_OVERSEAS.forEach(({ symbol, name, exchange }) => {
          client.publish({ destination: "/app/subscribe/overseas", body: `${symbol},${exchange}` });
          const sub = client.subscribe(`/topic/tradetick/overseas/${symbol}`, msg => {
            try {
              const tick = JSON.parse(msg.body);
              setTrades(prev => [{ ...tick, symbol, name, domestic: false, ts: Date.now() }, ...prev].slice(0, 50));
            } catch {}
          });
          rtSubsRef.current.push(sub);
        });
      },
      onDisconnect: () => setRtConnected(false),
    });
    client.activate();
    rtClientRef.current = client;
    return () => {
      rtSubsRef.current.forEach(s => { try { s.unsubscribe(); } catch {} });
      rtSubsRef.current = [];
      client.deactivate();
    };
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

  const domOpen = isDomesticMarketOpen();
  const overseasOpen = isOverseasMarketOpen();

  // 내투자 계산
  const getPrice = (h) => holdingPrices[h.symbol] || h.avgPrice;
  const totalEval = holdings.reduce((s, h) => s + getPrice(h) * h.quantity, 0);
  const totalBuy = holdings.reduce((s, h) => s + h.avgPrice * h.quantity, 0);
  const totalPL = totalEval - totalBuy;
  const totalPLRate = totalBuy > 0 ? ((totalPL / totalBuy) * 100).toFixed(2) : "0.00";

  return (
    <div className="sidebar">
      <div className={`slide-panel ${openPanel ? "open" : ""}`}>

        {/* ── 내 투자 패널 ── */}
        {openPanel === "myinvest" && (
          <Panel title="내 투자" sub={rtConnected ? "● LIVE" : ""}>
            {!user ? (
              <Empty icon="👤" title="로그인이 필요해요" desc={"로그인하면 내 투자 현황을\n확인할 수 있어요."} />
            ) : myLoading ? (
              <div className="sb-empty"><div className="loading-spinner-sm" /></div>
            ) : (
              <>
                {/* 잔고 */}
                <div className="my-balances">
                  <div className="my-bal-item">
                    <span className="my-bal-flag">🇰🇷</span>
                    <div>
                      <span className="my-bal-label">원화</span>
                      <strong className="my-bal-amount">{fmt(Math.round(myBalance))}원</strong>
                    </div>
                  </div>
                  <div className="my-bal-divider" />
                  <div className="my-bal-item">
                    <span className="my-bal-flag">🇺🇸</span>
                    <div>
                      <span className="my-bal-label">달러</span>
                      <strong className="my-bal-amount">${myDollar.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>

                {/* 내 투자 요약 */}
                {holdings.length > 0 && (
                  <div className="my-invest-summary">
                    <span className="my-invest-label">내 투자</span>
                    <div className="my-invest-value">{fmt(Math.round(totalEval))}원</div>
                    <div className={`my-invest-pl ${totalPL >= 0 ? "up" : "dn"}`}>
                      {totalPL >= 0 ? "+" : ""}{fmt(Math.round(totalPL))}원 ({totalPLRate}%)
                    </div>
                  </div>
                )}

                {/* 보유 종목 */}
                {!holdings.length ? (
                  <Empty icon="📭" title="보유 종목이 없어요" desc={"종목을 매수하면\n여기에 표시돼요."} />
                ) : (
                  <div className="sb-list">
                    {holdings.map(h => {
                      const price = getPrice(h);
                      const pl = (price - h.avgPrice) * h.quantity;
                      const up = pl >= 0;
                      return (
                        <div key={h.id} className="sb-item" onClick={() => handleStockClick(h)}>
                          <div className="sb-item-left">
                            <Logo symbol={h.symbol} name={h.name} market={h.market} />
                            <div>
                              <strong>{h.name}</strong>
                              <small>{h.quantity}주</small>
                            </div>
                          </div>
                          <div className="my-holding-right">
                            <span className="my-holding-eval">
                              {fmt(Math.round(price * h.quantity))}{isDomestic(h.market) ? "원" : "$"}
                            </span>
                            <span className={`my-holding-pl ${up ? "up" : "dn"}`}>
                              {up ? "+" : ""}{fmt(Math.round(pl))}{isDomestic(h.market) ? "원" : "$"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </Panel>
        )}

        {/* ── 관심종목 ── */}
        {openPanel === "watchlist" && (
          <Panel title="관심종목" sub={`${watchlist.length}개`}>
            {!watchlist.length
              ? <Empty icon="♡" title="관심 종목이 없어요" desc={"종목 옆 ☆ 버튼을 눌러\n관심종목을 추가해 보세요."} />
              : <div className="sb-list">{watchlist.map(s => (
                <div key={s.symbol} className="sb-item" onClick={() => handleStockClick(s)}>
                  <div className="sb-item-left"><Logo symbol={s.symbol} name={s.name} market={s.market} /><div><strong>{s.name}</strong><small>{s.symbol}</small></div></div>
                  <button onClick={e => handleRemoveWatch(s, e)} className="sb-remove">★</button>
                </div>
              ))}</div>}
          </Panel>
        )}

        {/* ── 최근 본 종목 ── */}
        {openPanel === "recent" && (
          <Panel title="최근 본 종목" sub={`${recentStocks.length}개`}>
            {!recentStocks.length
              ? <Empty icon="🕐" title="최근 본 종목이 없어요" desc={"종목을 클릭하면\n여기에 기록됩니다."} />
              : <div className="sb-list">{recentStocks.map(s => (
                <div key={s.symbol} className="sb-item" onClick={() => handleStockClick(s)}>
                  <div className="sb-item-left"><Logo symbol={s.symbol} name={s.name} market={s.market} /><div><strong>{s.name}</strong><small>{s.symbol} · {s.market}</small></div></div>
                  <span className={isUp(s.changePercent) ? "up" : "dn"}>{s.changePercent ? fmtChange(s.changePercent) : ""}</span>
                </div>
              ))}</div>}
          </Panel>
        )}

        {/* ── 실시간 체결 ── */}
        {openPanel === "realtime" && (
          <Panel title="실시간 체결" sub={rtConnected ? "● LIVE" : "연결 중..."}>
            <div className="rt-market-status">
              <span className={`rt-market-badge ${domOpen ? "open" : "closed"}`}>국내 {domOpen ? "장중" : "장외"}</span>
              <span className={`rt-market-badge ${overseasOpen ? "open" : "closed"}`}>미국 {overseasOpen ? "장중" : "장외"}</span>
            </div>
            {!domOpen && !overseasOpen ? (
              <Empty icon="⚡" title="장외 시간이에요" desc={"국내 09:00~15:30\n미국 22:30~05:00 (서머타임)"} />
            ) : trades.length === 0 ? (
              <Empty icon="⚡" title="체결 대기 중..." desc={"잠시 후 실시간 체결\n데이터가 표시돼요."} />
            ) : (
              <div className="rt-list">
                <div className="rt-head"><span>종목</span><span>체결가</span><span>수량</span></div>
                {trades.map((t, i) => (
                  <div key={i} className="rt-row">
                    <span className="rt-name">{t.name}</span>
                    <span className="rt-price">{t.domestic ? fmt(t.price) : `$${Number(t.price).toFixed(2)}`}</span>
                    <span className={`rt-qty ${t.side === "BUY" ? "buy" : "sell"}`}>{fmt(t.quantity)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        )}
      </div>

      {/* 아이콘 열 */}
      <div className="sb-icons">
        <button className="sb-toggle" onClick={() => setOpenPanel(prev => prev ? null : "myinvest")} title={openPanel ? "닫기" : "열기"}>
          {openPanel
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>}
        </button>

        {/* 내 투자 */}
        <button className={`sb-btn ${openPanel==="myinvest"?"active":""}`} onClick={()=>togglePanel("myinvest")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          <span>내투자</span>
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
          {rtConnected && trades.length > 0 && <span className="rt-dot" />}
        </button>

        <div className="sb-spacer" />
        <button className={`sb-btn ${quizOpen ? "active" : ""}`} onClick={() => setQuizOpen(v => !v)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>퀴즈</span>
        </button>
        <button className="sb-btn" onClick={() => setDark(v => !v)}>
          {dark ? <SunIcon /> : <MoonIcon />}
          <span>{dark ? "라이트" : "다크"}</span>
        </button>
      </div>
      {quizOpen && <QuizModal onClose={() => setQuizOpen(false)} />}
    </div>
  );
}

function Logo({ symbol, name, market }) {
  const url = getLogoUrl(symbol, market);
  if (url) return <img src={url} className="sb-logo" alt="" onError={e=>{e.target.style.display='none';}} />;
  return <div className="sb-logo-fb">{name?.substring(0,2)}</div>;
}
function Panel({ title, sub, children }) {
  return (
    <div className="sb-panel">
      <div className="sb-panel-hd">
        <span className="sb-panel-title">{title}</span>
        {sub && <span className="sb-panel-sub">{sub}</span>}
      </div>
      {children}
    </div>
  );
}
function Empty({ icon, title, desc }) {
  return (
    <div className="sb-empty">
      <span className="sb-empty-ico">{icon}</span>
      <p className="sb-empty-t">{title}</p>
      <p className="sb-empty-d">{desc}</p>
    </div>
  );
}
