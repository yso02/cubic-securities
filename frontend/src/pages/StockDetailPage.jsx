import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Client } from "@stomp/stompjs";
import {
  getDomesticPrice, getOverseasPrice,
  getExchangeCode, isDomestic, fmt, fmtPrice, fmtChange, isUp,
  getLogoUrl, NGROK_URL, getStockInfo, getInvestorTrend,
  getWatchlist, addWatchlist, removeWatchlist,
  buyStock, sellStock, getBalance, getHoldings,
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
  const [stockInfo, setStockInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [investorTrend, setInvestorTrend] = useState(null);
  const [activeBottomTab, setActiveBottomTab] = useState("orderbook");
  const [isWatched, setIsWatched] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("cubic_detail_stock");
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.symbol === symbol) { setStock(s); setLoading(false); }
      } catch {}
    }
    fetchPrice();
    try {
      const info = saved ? JSON.parse(saved) : { symbol, name: symbol, market: "KOSPI" };
      const recent = JSON.parse(sessionStorage.getItem("cubic_recent") || "[]");
      const updated = [info, ...recent.filter(s => s.symbol !== symbol)].slice(0, 10);
      sessionStorage.setItem("cubic_recent", JSON.stringify(updated));
      window.dispatchEvent(new Event("cubic_recent_update"));
    } catch {}
  }, [symbol]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const list = await getWatchlist();
        setIsWatched((list || []).some(w => w.symbol === symbol));
      } catch {}
    })();
  }, [user, symbol]);

  useEffect(() => {
    if (!stock) return;
    setInfoLoading(true);
    getStockInfo(stock.symbol, stock.market)
      .then(data => setStockInfo(data))
      .catch(() => {})
      .finally(() => setInfoLoading(false));

    if (isDomestic(stock.market)) {
      getInvestorTrend(stock.symbol, stock.market)
        .then(data => setInvestorTrend(data))
        .catch(() => {});
    }
  }, [stock?.symbol]);

  const fetchPrice = async () => {
    setLoading(true);
    try {
      const saved = sessionStorage.getItem("cubic_detail_stock");
      const info = saved ? JSON.parse(saved) : { symbol, name: symbol, market: "KOSPI" };
      const dom = isDomestic(info.market);
      const price = dom
        ? await getDomesticPrice(symbol)
        : await getOverseasPrice(symbol, info.exchange || getExchangeCode(info.market));
      setStock({ ...info, ...price });
    } catch {
      if (!stock) setStock({ symbol, name: symbol, market: "KOSPI", price: 0 });
    } finally { setLoading(false); }
  };

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
    return () => { client.deactivate(); };
  }, [stock?.symbol]);

  useEffect(() => {
    if (stock?.name && stock?.price)
      document.title = `${fmtPrice(stock.price, stock.market)} ${fmtChange(stock.changePercent)} | ${stock.name}`;
    return () => { document.title = "CUBIC 증권"; };
  }, [stock?.price, stock?.changePercent]);

  const toggleWatch = async () => {
    if (!user) { alert("로그인 후 이용해 주세요."); navigate("/login"); return; }
    try {
      if (isWatched) await removeWatchlist(symbol);
      else await addWatchlist(symbol, stock.name, stock.market);
      setIsWatched(v => !v);
    } catch {}
  };

  if (loading && !stock) return (
    <div className="sdp-page">
      <div className="sdp-loading"><div className="loading-spinner"/></div>
    </div>
  );

  const logoUrl = stock ? getLogoUrl(stock.symbol, stock.market) : null;

  return (
    <div className="sdp-page">
      {chartFullscreen && stock && (
        <StockChart stock={stock} fullscreen={true} onToggleFullscreen={() => setChartFullscreen(false)}/>
      )}

      {stock && (
        <div className="sdp-inner">

          {/* 상단 헤더 */}
          <div className="sdp-header">
            <div className="sdp-header-left">
              <button className="sdp-back" onClick={() => navigate(-1)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
              </button>
              {logoUrl
                ? <img src={logoUrl} alt={stock.name} className="sdp-logo" onError={e=>{e.target.style.display="none";}}/>
                : <div className="sdp-logo-fb">{stock.name?.substring(0,2)}</div>
              }
              <div>
                <h1 className="sdp-name">{stock.name}</h1>
                <span className="sdp-sub">{stock.symbol} · {stock.market}</span>
              </div>
            </div>
            <div className="sdp-header-right">
              <button
                className={`sdp-watch-btn ${isWatched ? "on" : ""}`}
                onClick={toggleWatch}
                title={isWatched ? "관심종목 해제" : "관심종목 추가"}
              >
                {isWatched ? "★" : "☆"}
              </button>
            </div>
          </div>

          {/* 메인 그리드 */}
          <div className="sdp-grid">

            {/* 좌측: 현재가 + 차트 + 하단탭 */}
            <div className="sdp-left">
              <div className="sdp-price-row">
                <span className="sdp-price">{fmtPrice(stock.price, stock.market)}</span>
                <span className={`sdp-change ${isUp(stock.changePercent) ? "up" : "dn"}`}>
                  {isUp(stock.changePercent) ? "▲" : "▼"}{" "}
                  {stock.change ? fmt(Math.abs(Number(String(stock.change).replace(/[+]/g, "")))) : ""}
                  {" "}({stock.changePercent ? fmtChange(stock.changePercent) : "-"})
                </span>
              </div>

              <div className="sdp-chart-wrap">
                <StockChart stock={stock} fullscreen={false} onToggleFullscreen={() => setChartFullscreen(true)}/>
              </div>

              <div className="sdp-bottom-tabs">
                <button
                  className={`sdp-bottom-tab ${activeBottomTab==="orderbook"?"active":""}`}
                  onClick={() => setActiveBottomTab("orderbook")}
                >호가</button>
                <button
                  className={`sdp-bottom-tab ${activeBottomTab==="analysis"?"active":""}`}
                  onClick={() => setActiveBottomTab("analysis")}
                >AI 분석</button>
              </div>

              <div className="sdp-bottom-content">
                {activeBottomTab === "orderbook" && (
                  <OrderBook stock={stock}/>
                )}
                {activeBottomTab === "analysis" && (
                  <div className="sdp-analysis">
                    {stockInfo && (
                      <div className="sdp-metrics">
                        <div className="sdp-metric">
                          <span className="sdp-metric-label">시가총액</span>
                          <span className="sdp-metric-value">{stockInfo.marketCap || "-"}</span>
                        </div>
                        <div className="sdp-metric">
                          <span className="sdp-metric-label">시총 순위</span>
                          <span className="sdp-metric-value">{stockInfo.marketCapRank || "-"}</span>
                        </div>
                        <div className="sdp-metric">
                          <span className="sdp-metric-label">PER</span>
                          <span className="sdp-metric-value">{stockInfo.per ? `${stockInfo.per}배` : "-"}</span>
                        </div>
                        <div className="sdp-metric">
                          <span className="sdp-metric-label">PBR</span>
                          <span className="sdp-metric-value">{stockInfo.pbr ? `${stockInfo.pbr}배` : "-"}</span>
                        </div>
                      </div>
                    )}

                    <div className="sdp-ai-section">
                      <div className="sdp-ai-header">
                        <span className="sdp-ai-badge">✦ AI 분석</span>
                        <span className="sdp-ai-sub">투자 참고용 정보입니다</span>
                      </div>
                      {infoLoading ? (
                        <div className="sdp-ai-loading"><div className="loading-spinner-sm"/>분석 중...</div>
                      ) : stockInfo?.aiAnalysis ? (
                        <div className="sdp-ai-content">
                          {stockInfo.aiAnalysis.split("\n").filter(s => s.trim()).map((line, i) => (
                            <p key={i}>{line}</p>
                          ))}
                        </div>
                      ) : (
                        <div className="sdp-ai-pending">API 연동 예정</div>
                      )}
                    </div>

                    {isDomestic(stock.market) && investorTrend && investorTrend.length > 0 && (
                      <div className="sdp-trend-section">
                        <div className="sdp-section-title">투자자별 매매동향</div>
                        <div className="info-trend-table">
                          <div className="info-trend-header">
                            <span>날짜</span>
                            <span>종가</span>
                            <span>개인</span>
                            <span>외국인</span>
                            <span>기관</span>
                          </div>
                          {[...investorTrend].reverse().map((d, i) => (
                            <div key={i} className="info-trend-row">
                              <span>{d.date.slice(0,4)+"."+d.date.slice(4,6)+"."+d.date.slice(6,8)}</span>
                              <span>{Number(d.closePrice).toLocaleString()}원</span>
                              <span className={Number(d.personalNet) >= 0 ? "up" : "dn"}>
                                {Number(d.personalNet) >= 0 ? "+" : ""}{Number(d.personalNet).toLocaleString()}
                              </span>
                              <span className={Number(d.foreignNet) >= 0 ? "up" : "dn"}>
                                {Number(d.foreignNet) >= 0 ? "+" : ""}{Number(d.foreignNet).toLocaleString()}
                              </span>
                              <span className={Number(d.institutionNet) >= 0 ? "up" : "dn"}>
                                {Number(d.institutionNet) >= 0 ? "+" : ""}{Number(d.institutionNet).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 우측: 인라인 주문창 */}
            <div className="sdp-right">
              <div className="sdp-trade-panel">
                <div className="sdp-trade-tabs">
                  <button
                    className={`sdp-trade-tab buy ${tradeMode==="buy"?"active":""}`}
                    onClick={() => setTradeMode("buy")}
                  >매수</button>
                  <button
                    className={`sdp-trade-tab sell ${tradeMode==="sell"?"active":""}`}
                    onClick={() => setTradeMode("sell")}
                  >매도</button>
                </div>
                <TradeInline
                  stock={stock}
                  mode={tradeMode}
                  user={user}
                  onSuccess={() => { fetchPrice(); window.dispatchEvent(new Event("cubic_trade_complete")); }}
                  onLoginRequired={() => navigate("/login")}
                />
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// 인라인 주문창
function TradeInline({ stock, mode, user, onSuccess, onLoginRequired }) {
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState("");
  const [balance, setBalance] = useState(0);
  const [holding, setHolding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (stock?.price) setPrice(String(stock.price).replace(/[+]/g, ""));
    setQuantity(1);
    setMessage(null);
    fetchUserData();
  }, [stock?.symbol, mode]);

  const fetchUserData = async () => {
    if (!user) return;
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
  const newTotalCost = (currentAvgPrice * currentQty) + total;
  const newTotalQty = currentQty + numQty;
  const expectedAvgPrice = newTotalQty > 0 ? newTotalCost / newTotalQty : numPrice;
  const sellRevenue = total;
  const sellCost = currentAvgPrice * numQty;
  const expectedProfit = sellRevenue - sellCost;
  const expectedProfitRate = sellCost > 0 ? ((expectedProfit / sellCost) * 100).toFixed(2) : "0.00";
  const remainQty = currentQty - numQty;

  const canBuy = total > 0 && total <= balance && numQty > 0;
  const canSell = holding && numQty <= holding.quantity && numQty > 0 && numPrice > 0;

  const handleSubmit = async () => {
    if (!user) { onLoginRequired?.(); return; }
    setLoading(true); setMessage(null);
    try {
      const payload = {
        symbol: stock.symbol, name: stock.name, market: stock.market,
        type: mode === "buy" ? "BUY" : "SELL",
        quantity: numQty, price: numPrice,
      };
      if (mode === "buy") await buyStock(payload);
      else await sellStock(payload);
      setMessage({ type: "success", text: mode === "buy" ? "매수 완료!" : "매도 완료!" });
      await fetchUserData();
      onSuccess?.();
    } catch (e) {
      const msg = typeof e.response?.data === "string" ? e.response.data : "주문 실패";
      setMessage({ type: "error", text: msg });
    } finally { setLoading(false); }
  };

  return (
    <div className="trade-inline">
      {!user && (
        <div className="ti-login-hint">
          <p>로그인 후 거래할 수 있어요</p>
          <button onClick={onLoginRequired}>로그인</button>
        </div>
      )}

      <div className="ti-info-row">
        <span>현재가</span>
        <strong>{fmtPrice(stock.price, stock.market)}</strong>
      </div>

      {mode === "buy" ? (
        <div className="ti-info-row">
          <span>주문 가능</span>
          <strong>{fmt(Math.round(balance))}{unit}</strong>
        </div>
      ) : (
        <div className="ti-info-row">
          <span>보유 수량</span>
          <strong>{holding ? `${fmt(holding.quantity)}주` : "0주"}</strong>
        </div>
      )}

      {holding && mode === "buy" && (
        <div className="ti-info-row dim">
          <span>현재 보유</span>
          <strong>{fmt(currentQty)}주 (평단 {fmtPrice(currentAvgPrice, stock.market)})</strong>
        </div>
      )}
      {holding && mode === "sell" && (
        <div className="ti-info-row dim">
          <span>평균 매수가</span>
          <strong>{fmtPrice(currentAvgPrice, stock.market)}</strong>
        </div>
      )}

      <div className="ti-input-group">
        <label>가격</label>
        <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="가격 입력"/>
      </div>

      <div className="ti-input-group">
        <label>수량</label>
        <div className="ti-qty-row">
          <button onClick={() => setQuantity(q => Math.max(1, Number(q)-1))}>−</button>
          <input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value)||0)}/>
          <button onClick={() => setQuantity(q => Number(q)+1)}>+</button>
        </div>
        {mode === "sell" && holding && (
          <div className="ti-qty-shortcuts">
            {[25,50,75,100].map(pct => (
              <button key={pct} onClick={() => setQuantity(Math.floor(holding.quantity*pct/100))}>{pct}%</button>
            ))}
          </div>
        )}
      </div>

      <div className="ti-total">
        <span>총 {mode === "buy" ? "매수" : "매도"} 금액</span>
        <strong>{fmt(Math.round(total))}{unit}</strong>
      </div>

      {mode === "buy" && numQty > 0 && numPrice > 0 && (
        <div className="ti-estimate">
          <div className="ti-est-row">
            <span>예상 평단가</span>
            <strong>{dom ? `${fmt(Math.round(expectedAvgPrice))}원` : `$${expectedAvgPrice.toFixed(2)}`}</strong>
          </div>
          <div className="ti-est-row">
            <span>구매 후 총 보유</span>
            <strong>{fmt(newTotalQty)}주</strong>
          </div>
        </div>
      )}

      {mode === "sell" && holding && numQty > 0 && numPrice > 0 && (
        <div className="ti-estimate">
          <div className={`ti-est-row highlight ${expectedProfit >= 0 ? "profit" : "loss"}`}>
            <span>예상 수익</span>
            <strong>
              {expectedProfit >= 0 ? "+" : ""}{fmt(Math.round(expectedProfit))}{unit}
              <small> ({expectedProfitRate}%)</small>
            </strong>
          </div>
          {remainQty > 0 && (
            <div className="ti-est-row">
              <span>매도 후 잔여</span>
              <strong>{fmt(remainQty)}주</strong>
            </div>
          )}
        </div>
      )}

      {message && <div className={`ti-message ${message.type}`}>{message.text}</div>}

      <button
        className={`ti-submit ${mode}`}
        onClick={handleSubmit}
        disabled={loading || !user || (mode==="buy" ? !canBuy : !canSell)}
      >
        {loading ? "처리 중..." : mode==="buy" ? "매수하기" : "매도하기"}
      </button>
    </div>
  );
}
