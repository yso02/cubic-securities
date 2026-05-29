// src/pages/StockDetailPage.jsx
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Client } from "@stomp/stompjs";
import {
  getDomesticPrice, getOverseasPrice,
  getExchangeCode, isDomestic, fmt, fmtPrice, fmtChange, isUp,
  getLogoUrl, NGROK_URL,
} from "../api/stockApi";
import StockChart from "../components/StockChart";
import OrderBook from "../components/OrderBook";
import TradeModal from "../components/TradeModal";
import "./StockDetailPage.css";

export default function StockDetailPage({ user }) {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tradeModal, setTradeModal] = useState(null);
  const [chartFullscreen, setChartFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState("chart"); // chart | info
  const wsRef = useRef(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("cubic_detail_stock");
    if (saved) { try { const s = JSON.parse(saved); if (s.symbol === symbol) { setStock(s); setLoading(false); } } catch {} }
    fetchPrice();
    try {
      const info = saved ? JSON.parse(saved) : { symbol, name: symbol, market: "KOSPI" };
      const recent = JSON.parse(sessionStorage.getItem("cubic_recent") || "[]");
      const updated = [info, ...recent.filter(s => s.symbol !== symbol)].slice(0, 10);
      sessionStorage.setItem("cubic_recent", JSON.stringify(updated));
      window.dispatchEvent(new Event("cubic_recent_update"));
    } catch {}
  }, [symbol]);

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
          client.publish({ destination: "/app/subscribe/domestic/price", body: stock.symbol });
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
    return () => { if (client) client.deactivate(); };
  }, [stock?.symbol]);

  // 탭 타이틀
  useEffect(() => {
    if (stock?.name && stock?.price)
      document.title = `${fmtPrice(stock.price, stock.market)} ${fmtChange(stock.changePercent)} | ${stock.name}`;
    return () => { document.title = "CUBIC 증권"; };
  }, [stock?.price, stock?.changePercent]);

  const handleTrade = (mode) => {
    if (!user) { alert("로그인 후 이용해 주세요."); navigate("/login"); return; }
    setTradeModal(mode);
  };

  if (loading && !stock) return (
    <div className="detail-page">
      <div className="detail-loading"><div className="loading-spinner" /></div>
    </div>
  );

  const logoUrl = stock ? getLogoUrl(stock.symbol, stock.market) : null;

  return (
    <div className="detail-page">
      {/* 전체화면 차트 */}
      {chartFullscreen && stock && (
        <StockChart stock={stock} fullscreen={true} onToggleFullscreen={() => setChartFullscreen(false)} />
      )}

      {/* 헤더 */}
      {stock && (
        <div className="detail-header">
          <div className="detail-header-inner">
            <button className="back-btn" onClick={() => navigate("/")}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
            </button>

            {/* 종목 정보 */}
            <div className="detail-stock-info">
              <div className="detail-stock-title">
                {logoUrl
                  ? <img src={logoUrl} alt={stock.name} className="detail-logo" onError={e => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }} />
                  : null}
                <div className="detail-logo-fallback" style={{ display: logoUrl ? 'none' : 'flex' }}>
                  {stock.name?.substring(0, 2)}
                </div>
                <div>
                  <h1 className="detail-h1">{stock.name}</h1>
                  <span className="detail-sub">{stock.symbol} · {stock.market}</span>
                </div>
              </div>
              <div className="detail-price-row">
                <span className="detail-big-price">{fmtPrice(stock.price, stock.market)}</span>
                <span className={`detail-big-change ${isUp(stock.changePercent) ? "up" : "dn"}`}>
                  {isUp(stock.changePercent) ? "▲" : "▼"}{" "}
                  {stock.change ? fmt(Math.abs(Number(String(stock.change).replace(/[+]/g, "")))) : ""}
                  {" "}({stock.changePercent ? fmtChange(stock.changePercent) : "-"})
                </span>
              </div>
            </div>

            {/* 매수/매도 버튼 */}
            <div className="detail-trade-btns">
              <button className="da-buy" onClick={() => handleTrade("buy")}>매수</button>
              <button className="da-sell" onClick={() => handleTrade("sell")}>매도</button>
            </div>
          </div>

          {/* 탭 */}
          <div className="detail-tabs">
            <button
              className={`detail-tab ${activeTab === "chart" ? "active" : ""}`}
              onClick={() => setActiveTab("chart")}
            >
              차트·호가
            </button>
            <button
              className={`detail-tab ${activeTab === "info" ? "active" : ""}`}
              onClick={() => setActiveTab("info")}
            >
              종목정보
            </button>
          </div>
        </div>
      )}

      {/* 탭 콘텐츠 */}
      {stock && (
        <div className="detail-content">
          {activeTab === "chart" && (
            <div className="detail-body">
              <div className="detail-chart-col">
                <StockChart stock={stock} fullscreen={false} onToggleFullscreen={() => setChartFullscreen(true)} />
              </div>
              <div className="detail-ob-col">
                <OrderBook stock={stock} />
              </div>
            </div>
          )}

          {activeTab === "info" && (
            <div className="detail-info-empty">
              <p>종목정보 준비 중입니다</p>
            </div>
          )}
        </div>
      )}

      {tradeModal && stock && (
        <TradeModal stock={stock} initialMode={tradeModal} onClose={() => setTradeModal(null)} onSuccess={() => { fetchPrice(); window.dispatchEvent(new Event("cubic_trade_complete")); }} />
      )}
    </div>
  );
}
