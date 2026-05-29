// src/components/OrderBook.jsx
import { useState, useEffect, useRef } from "react";
import { Client } from "@stomp/stompjs";
import SockJS from 'sockjs-client';
import {
  getDomesticOrderbook,
  isDomestic,
  getExchangeCode,
  fmt,
  fmtPrice,
  NGROK_URL,
} from "../api/stockApi";
import "./OrderBook.css";

export default function OrderBook({ stock }) {
  const [orderbook, setOrderbook] = useState(null);
  const [trades, setTrades] = useState([]);
  const [activeTab, setActiveTab] = useState("orderbook");
  const [loading, setLoading] = useState(false);
  const clientRef = useRef(null);
  const subsRef = useRef([]);

  if (!stock) return null;

  const domestic = isDomestic(stock.market);
  const exchange = getExchangeCode(stock.market); // NAS / NYS / AMS

  // REST로 초기 호가 로드 (국내만)
  useEffect(() => {
    setLoading(true);
    setOrderbook(null);
    setTrades([]);

    if (!domestic) {
      setLoading(false); // 해외는 REST 없이 WebSocket만 대기
      return;
    }

    (async () => {
      try {
        const data = await getDomesticOrderbook(stock.symbol);
        setOrderbook(data);
      } catch (e) {
        console.warn("호가 로드 실패:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [stock.symbol]);

  // WebSocket 실시간 호가 + 체결
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(`${NGROK_URL}/ws`),
      connectHeaders: { "ngrok-skip-browser-warning": "true" },
      reconnectDelay: 5000,
      onConnect: () => {
        if (domestic) {
          // 국내: /app/subscribe/domestic → 호가+체결 자동 구독
          client.publish({
            destination: "/app/subscribe/domestic",
            body: stock.symbol,
          });

          const obSub = client.subscribe(
            `/topic/orderbook/${stock.symbol}`,
            (msg) => {
              try { setOrderbook(JSON.parse(msg.body)); } catch {}
            }
          );
          const ttSub = client.subscribe(
            `/topic/tradetick/${stock.symbol}`,
            (msg) => {
              try {
                const tick = JSON.parse(msg.body);
                setTrades((prev) => [tick, ...prev].slice(0, 30));
              } catch {}
            }
          );
          subsRef.current.push(obSub, ttSub);
        } else {
          // 해외: 가격 구독 (체결도 함께 수신됨)
          client.publish({
            destination: "/app/subscribe/overseas",
            body: `${stock.symbol},${exchange}`,
          });
          // 해외: 호가 별도 구독
          client.publish({
            destination: "/app/subscribe/overseas/orderbook",
            body: `${stock.symbol},${exchange}`,
          });

          const obSub = client.subscribe(
            `/topic/orderbook/${stock.symbol}`,
            (msg) => {
              try { setOrderbook(JSON.parse(msg.body)); } catch {}
            }
          );
          // 해외 체결: /topic/tradetick/overseas/{symbol}
          const ttSub = client.subscribe(
            `/topic/tradetick/overseas/${stock.symbol}`,
            (msg) => {
              try {
                const tick = JSON.parse(msg.body);
                setTrades((prev) => [tick, ...prev].slice(0, 30));
              } catch {}
            }
          );
          subsRef.current.push(obSub, ttSub);
        }
      },
    });

    client.activate();
    clientRef.current = client;

    return () => {
      subsRef.current.forEach((s) => { try { s.unsubscribe(); } catch {} });
      subsRef.current = [];
      try {
        if (client.connected) {
          if (domestic) {
            client.publish({ destination: "/app/unsubscribe/domestic", body: stock.symbol });
          } else {
            client.publish({ destination: "/app/unsubscribe/overseas", body: `${stock.symbol},${exchange}` });
            client.publish({ destination: "/app/unsubscribe/overseas/orderbook", body: `${stock.symbol},${exchange}` });
          }
          client.deactivate();
        } else {
          client.deactivate();
        }
      } catch {
        client.deactivate();
      }
    };
  }, [stock.symbol]);

  const maxQty = orderbook
    ? Math.max(
        ...((orderbook.asks || []).map((a) => Number(a.quantity) || 0)),
        ...((orderbook.bids || []).map((b) => Number(b.quantity) || 0)),
        1
      )
    : 1;

  // 가격 포맷: 국내는 fmt(정수), 해외는 소수점
  const formatPrice = (price) =>
    domestic ? fmt(price) : `$${Number(price).toFixed(2)}`;

  return (
    <div className="orderbook-wrap">
      <div className="ob-tabs">
        <button
          className={`ob-tab ${activeTab === "orderbook" ? "active" : ""}`}
          onClick={() => setActiveTab("orderbook")}
        >
          호가
        </button>
        <button
          className={`ob-tab ${activeTab === "trades" ? "active" : ""}`}
          onClick={() => setActiveTab("trades")}
        >
          체결
        </button>
      </div>

      {activeTab === "orderbook" && (
        <div className="ob-body">
          {!domestic && (!orderbook || (orderbook.asks?.length === 0 && orderbook.bids?.length === 0)) && (
            <div className="ob-overseas-notice">
              미국 정규장(한국 22:30~05:00, 서머타임 기준)에만 실시간 데이터가 수신돼요
            </div>
          )}
          {loading || (domestic && !orderbook) ? (
            <div className="ob-loading">호가 로딩 중...</div>
          ) : !orderbook || (orderbook.asks?.length === 0 && orderbook.bids?.length === 0) ? (
            <div className="ob-loading">
              {domestic ? "호가 로딩 중..." : "정규장 시간에 실시간 호가가 표시돼요"}
            </div>
          ) : (
            <>
              {/* 매도호가 — 역순 */}
              <div className="ob-section asks">
                {[...(orderbook.asks || [])].sort((a, b) => Number(b.price) - Number(a.price)).map((a, i) => (
                  <div key={`ask-${i}`} className="ob-row ask">
                    <div className="ob-bar-wrap">
                      <div
                        className="ob-bar ask-bar"
                        style={{ width: `${(Number(a.quantity) / maxQty) * 100}%` }}
                      />
                    </div>
                    <span className="ob-qty">{fmt(a.quantity)}</span>
                    <span className="ob-price ask-price">{formatPrice(a.price)}</span>
                  </div>
                ))}
              </div>

              {/* 현재가 */}
              <div className="ob-current">
                <span className="ob-current-price">
                  {fmtPrice(stock.price, stock.market)}
                </span>
                <span className="ob-current-label">현재가</span>
              </div>

              {/* 매수호가 */}
              <div className="ob-section bids">
                {(orderbook.bids || []).map((b, i) => (
                  <div key={`bid-${i}`} className="ob-row bid">
                    <span className="ob-price bid-price">{formatPrice(b.price)}</span>
                    <span className="ob-qty">{fmt(b.quantity)}</span>
                    <div className="ob-bar-wrap">
                      <div
                        className="ob-bar bid-bar"
                        style={{ width: `${(Number(b.quantity) / maxQty) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* 총 잔량 */}
              <div className="ob-total">
                <span className="ask-total">매도 {fmt(orderbook.totalAskQty)}</span>
                <span className="bid-total">매수 {fmt(orderbook.totalBidQty)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "trades" && (
        <div className="ob-trades">
          <div className="ob-trades-head">
            <span>체결가</span>
            <span>체결량</span>
          </div>
          {!domestic && trades.length === 0 ? (
            <div className="ob-loading" style={{ fontSize: "12px", padding: "12px 8px" }}>
              정규장 시간에 실시간 체결 데이터가 표시돼요
            </div>
          ) : trades.length === 0 ? (
            <div className="ob-loading">체결 대기 중...</div>
          ) : (
            trades.map((t, i) => (
              <div key={i} className="ob-trade-row">
                <span className="ob-trade-price">{formatPrice(t.price)}</span>
                <span className={`ob-trade-vol ${t.side === "BUY" ? "buy" : "sell"}`}>
                  {fmt(t.quantity)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
