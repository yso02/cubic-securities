// src/pages/StockDetailPage.jsx
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Client } from "@stomp/stompjs";
import {
  getDomesticPrice, getOverseasPrice, getExchangeRate,
  getExchangeCode, isDomestic, fmt, fmtPrice, fmtChange, isUp,
  getLogoUrl, NGROK_URL, getStockInfo, getInvestorTrend,
  buyStock, sellStock, getBalance, getHoldings,
  addWatchlist, removeWatchlist, getWatchlist,
} from "../api/stockApi";
import StockChart from "../components/StockChart";
import OrderBook from "../components/OrderBook";
import "./StockDetailPage.css";

export default function StockDetailPage({ user }) {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tradeMode, setTradeMode] = useState("buy");
  const [chartFullscreen, setChartFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState("chart");
  const [stockInfo, setStockInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [investorTrend, setInvestorTrend] = useState(null);
  const [trendLoading, setTrendLoading] = useState(false);
  const [exRate, setExRate] = useState(1380);
  const [watchlist, setWatchlist] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("cubic_detail_stock");
    if (saved) { try { const s = JSON.parse(saved); if (s.symbol === symbol) { setStock(s); setLoading(false); } } catch {} }
    fetchPrice();
    getExchangeRate().then(r => setExRate(r?.rate || r || 1380)).catch(() => {});
    loadWatchlist();
    try {
      const info = saved ? JSON.parse(saved) : { symbol, name: symbol, market: "KOSPI" };
      const recent = JSON.parse(sessionStorage.getItem("cubic_recent") || "[]");
      const updated = [info, ...recent.filter(s => s.symbol !== symbol)].slice(0, 10);
      sessionStorage.setItem("cubic_recent", JSON.stringify(updated));
      window.dispatchEvent(new Event("cubic_recent_update"));
    } catch {}
  }, [symbol]);

  const loadWatchlist = async () => {
    try { setWatchlist(await getWatchlist() || []); } catch {}
  };
  const isWatched = () => watchlist.some(w => w.symbol === symbol);

  const fetchPrice = async () => {
    setLoading(true);
    try {
      const saved = sessionStorage.getItem("cubic_detail_stock");
      let info = saved ? JSON.parse(saved) : { symbol, name: symbol, market: "KOSPI" };
      const dom = isDomestic(info.market);
      const price = dom
        ? await getDomesticPrice(symbol)
        : await getOverseasPrice(symbol, info.exchange || getExchangeCode(info.market));
      setStock({ ...info, ...price });
    } catch (e) {
      if (!stock) setStock({ symbol, name: symbol, market: "KOSPI", price: 0 });
    } finally { setLoading(false); }
  };

  // WebSocket
  useEffect(() => {
    if (!stock) return;
    const wsUrl = NGROK_URL.replace("https://", "wss://").replace("http://", "ws://") + "/ws/websocket";
    const client = new Client({
      brokerURL: wsUrl, reconnectDelay: 5000,
      connectHeaders: { "ngrok-skip-browser-warning": "true" },
      onConnect: () => {
        const dom = isDomestic(stock.market);
        if (dom) {
          client.publish({ destination: "/app/subscribe/domestic", body: stock.symbol });
          client.subscribe(`/topic/domestic/${stock.symbol}`, msg => {
            try { setStock(prev => prev ? { ...prev, ...JSON.parse(msg.body) } : prev); } catch {}
          });
        } else {
          const exc = stock.exchange || getExchangeCode(stock.market);
          client.publish({ destination: "/app/subscribe/overseas", body: `${stock.symbol},${exc}` });
          client.subscribe(`/topic/overseas/${stock.symbol}`, msg => {
            try { setStock(prev => prev ? { ...prev, ...JSON.parse(msg.body) } : prev); } catch {}
          });
        }
      },
    });
    client.activate(); wsRef.current = client;
    return () => {
      if (client.connected) {
        if (isDomestic(stock.market)) client.publish({ destination: "/app/unsubscribe/domestic", body: stock.symbol });
        else { const exc = stock.exchange || getExchangeCode(stock.market); client.publish({ destination: "/app/unsubscribe/overseas", body: `${stock.symbol},${exc}` }); }
      }
      client.deactivate();
    };
  }, [stock?.symbol]);

  useEffect(() => {
    if (stock?.name && stock?.price)
      document.title = `${fmtPrice(stock.price, stock.market)} ${fmtChange(stock.changePercent)} | ${stock.name}`;
    return () => { document.title = "CUBIC 증권"; };
  }, [stock?.price, stock?.changePercent]);

  if (loading && !stock) return (
    <div className="detail-page"><div className="detail-loading"><div className="loading-spinner" /></div></div>
  );

  const logoUrl = stock ? getLogoUrl(stock.symbol, stock.market) : null;
  const dom = stock ? isDomestic(stock.market) : true;

  return (
    <div className="detail-page">
      {chartFullscreen && stock && (
        <StockChart stock={stock} fullscreen={true} onToggleFullscreen={() => setChartFullscreen(false)} />
      )}

      {stock && (
        <>
          {/* ── 헤더 ── */}
          <div className="detail-header">
            <div className="detail-header-inner">
              <button className="back-btn" onClick={() => navigate(-1)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
              </button>

              {/* 로고 + 이름 + 가격 */}
              <div className="detail-stock-info">
                <div className="detail-stock-title">
                  {logoUrl
                    ? <img src={logoUrl} alt={stock.name} className="detail-logo" onError={e => { e.target.style.display='none'; if (e.target.nextSibling) e.target.nextSibling.style.display='flex'; }} />
                    : null}
                  <div className="detail-logo-fallback" style={{ display: logoUrl ? 'none' : 'flex' }}>{stock.name?.substring(0,2)}</div>
                  <div>
                    <h1 className="detail-h1">{stock.name}</h1>
                    <span className="detail-sub">{stock.symbol} · {stock.market}</span>
                  </div>
                </div>
                {/* 가격: 해외는 원화(대)+달러(소) */}
                <div className="detail-price-row">
                  {dom ? (
                    <>
                      <span className="detail-big-price">{fmt(Math.round(stock.price))}원</span>
                      <span className={`detail-big-change ${isUp(stock.changePercent) ? "up" : "dn"}`}>
                        {isUp(stock.changePercent) ? "▲" : "▼"}{" "}
                        {stock.change ? fmt(Math.abs(Number(String(stock.change).replace(/[+]/g, "")))) : ""}
                        {" "}({stock.changePercent ? fmtChange(stock.changePercent) : "-"})
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="detail-big-price">{fmt(Math.round(Number(stock.price) * exRate))}원</span>
                      <span className="detail-big-usd">${Number(stock.price).toFixed(2)}</span>
                      <span className={`detail-big-change ${isUp(stock.changePercent) ? "up" : "dn"}`}>
                        {isUp(stock.changePercent) ? "▲" : "▼"}{" "}({stock.changePercent ? fmtChange(stock.changePercent) : "-"})
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* 관심종목 버튼 */}
              {user && (
                <button className="detail-watch-btn" onClick={async () => {
                  try {
                    if (isWatched()) await removeWatchlist(symbol);
                    else await addWatchlist(symbol, stock.name, stock.market);
                    await loadWatchlist();
                  } catch {}
                }}>
                  {isWatched() ? "★" : "☆"}
                </button>
              )}
            </div>

            {/* 탭 */}
            <div className="detail-tabs">
              <button className={`detail-tab ${activeTab === "chart" ? "active" : ""}`} onClick={() => setActiveTab("chart")}>차트·호가</button>
              <button
                className={`detail-tab ${activeTab === "info" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("info");
                  if (!stockInfo && !infoLoading) {
                    setInfoLoading(true);
                    getStockInfo(symbol, stock.market)
                      .then(data => setStockInfo(data))
                      .catch(() => {})
                      .finally(() => setInfoLoading(false));
                  }
                  if (isDomestic(stock.market) && !investorTrend && !trendLoading) {
                    setTrendLoading(true);
                    getInvestorTrend(symbol, stock.market)
                      .then(data => setInvestorTrend(data))
                      .catch(() => {})
                      .finally(() => setTrendLoading(false));
                  }
                }}
              >종목정보</button>
            </div>
          </div>

          {/* ── 탭 콘텐츠 ── */}
          <div className="detail-content">
            {activeTab === "chart" && (
              <div className="detail-main-grid">
                {/* 좌측: 차트 + 호가 + AI */}
                <div className="detail-left-col">
                  <div className="detail-chart-area">
                    <StockChart stock={stock} fullscreen={false} onToggleFullscreen={() => setChartFullscreen(true)} />
                  </div>
                  <div className="detail-bottom-row">
                    <div className="detail-ob-area"><OrderBook stock={stock} /></div>
                    <div className="detail-ai-area">
                      <div className="detail-ai-header"><span className="detail-ai-title">✦ AI 분석</span></div>
                      <div className="detail-ai-body"><span className="detail-ai-pending">구현 예정</span></div>
                    </div>
                  </div>
                </div>

                {/* 우측: 매수/매도 폼 */}
                <div className="detail-right-col">
                  <div className="detail-trade-panel">
                    <div className="smt-tabs">
                      <button className={`smt-tab buy ${tradeMode === "buy" ? "active" : ""}`} onClick={() => setTradeMode("buy")}>매수</button>
                      <button className={`smt-tab sell ${tradeMode === "sell" ? "active" : ""}`} onClick={() => setTradeMode("sell")}>매도</button>
                    </div>
                    {user ? (
                      <TradePanel stock={stock} mode={tradeMode} exRate={exRate} onSuccess={() => { fetchPrice(); window.dispatchEvent(new Event("cubic_trade_complete")); }} />
                    ) : (
                      <div className="smt-login-hint">
                        <p>로그인 후 거래할 수 있어요</p>
                        <button onClick={() => navigate("/login")}>로그인</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "info" && (
              <div className="detail-info-wrap">
                {infoLoading ? (
                  <div className="detail-info-loading"><div className="loading-spinner" /><p>분석 중...</p></div>
                ) : stockInfo ? (
                  <>
                    <div className="info-metrics">
                      <div className="info-metric-card"><span className="info-metric-label">시가총액</span><span className="info-metric-value">{stockInfo.marketCap}</span></div>
                      <div className="info-metric-card"><span className="info-metric-label">시총 순위</span><span className="info-metric-value">{stockInfo.marketCapRank}</span></div>
                      <div className="info-metric-card"><span className="info-metric-label">PER</span><span className="info-metric-value">{stockInfo.per ? `${stockInfo.per}배` : "-"}</span></div>
                      <div className="info-metric-card"><span className="info-metric-label">PBR</span><span className="info-metric-value">{stockInfo.pbr ? `${stockInfo.pbr}배` : "-"}</span></div>
                    </div>
                    <div className="info-ai-section">
                      <div className="info-ai-header"><span className="info-ai-badge">AI 분석</span><span className="info-ai-sub">투자 참고용 정보입니다</span></div>
                      <div className="info-ai-content">
                        {stockInfo.aiAnalysis?.split("\n").filter(s => s.trim()).map((line, i) => (
                          <p key={i} className="info-ai-line">{line}</p>
                        ))}
                      </div>
                    </div>
                    {isDomestic(stock.market) && (
                      <div className="info-investor-section">
                        <div className="info-section-title"><span>투자자별 매매동향</span><span className="info-section-sub">최근 10거래일 순매수 (단위: 주)</span></div>
                        {trendLoading ? <div className="detail-info-loading"><div className="loading-spinner" /></div>
                        : investorTrend?.length > 0 ? (
                          <>
                            <div className="info-bar-chart">
                              {investorTrend.map((d, i) => {
                                const maxVal = Math.max(...investorTrend.flatMap(x => [Math.abs(Number(x.personalNet)), Math.abs(Number(x.foreignNet)), Math.abs(Number(x.institutionNet))]));
                                const pct = (val) => Math.abs(val) / maxVal * 45;
                                const date = d.date.slice(4,6)+"/"+d.date.slice(6,8);
                                const p=Number(d.personalNet), f=Number(d.foreignNet), g=Number(d.institutionNet);
                                return (
                                  <div key={i} className="ibc-row">
                                    <span className="ibc-date">{date}</span>
                                    <div className="ibc-bars">
                                      {[["개인",p],["외국인",f],["기관",g]].map(([label,val]) => (
                                        <div key={label} className="ibc-bar-group">
                                          <span className="ibc-label">{label}</span>
                                          <div className="ibc-bar-wrap">
                                            <div className="ibc-bar-neg" style={{width: val<0?pct(val)+"%":"0"}}/>
                                            <div className="ibc-center"/>
                                            <div className="ibc-bar-pos" style={{width: val>0?pct(val)+"%":"0"}}/>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="info-trend-table">
                              <div className="info-trend-header"><span>날짜</span><span>종가</span><span>개인</span><span>외국인</span><span>기관</span></div>
                              {[...investorTrend].reverse().map((d, i) => (
                                <div key={i} className="info-trend-row">
                                  <span>{d.date.slice(0,4)+"."+d.date.slice(4,6)+"."+d.date.slice(6,8)}</span>
                                  <span>{Number(d.closePrice).toLocaleString()}원</span>
                                  <span className={Number(d.personalNet)>=0?"up":"dn"}>{Number(d.personalNet)>=0?"+":""}{Number(d.personalNet).toLocaleString()}</span>
                                  <span className={Number(d.foreignNet)>=0?"up":"dn"}>{Number(d.foreignNet)>=0?"+":""}{Number(d.foreignNet).toLocaleString()}</span>
                                  <span className={Number(d.institutionNet)>=0?"up":"dn"}>{Number(d.institutionNet)>=0?"+":""}{Number(d.institutionNet).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : null}
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TradePanel({ stock, mode, onSuccess, exRate = 1380 }) {
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
