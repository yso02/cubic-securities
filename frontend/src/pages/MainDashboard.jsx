// src/pages/MainDashboard.jsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Client } from "@stomp/stompjs";
import {
  searchStocks, getDomesticPrice, getOverseasPrice,
  getDomesticRanking, getOverseasRanking, getMarketIndices, getMarketNews,
  getExchangeRate as fetchRate,
  getExchangeCode, isDomestic, fmt, fmtPrice, fmtChange, isUp,
  getWatchlist, addWatchlist, removeWatchlist,
  DOMESTIC_STOCKS, OVERSEAS_STOCKS, NGROK_URL, getLogoUrl,
} from "../api/stockApi";
import "./MainDashboard.css";

const ICON_COLORS = {
  "삼성전자":"#1428A0","SK하이닉스":"#EA002C","현대차":"#002C5F","LG화학":"#A50034",
  "카카오":"#FAE100","NAVER":"#76B900","셀트리온":"#00A6A0","POSCO홀딩스":"#004B87",
  "기아":"#05141F","삼성SDI":"#034EA2","LG에너지솔루션":"#A50034","신한지주":"#0046FF",
  "Apple":"#555","NVIDIA":"#76B900","Tesla":"#CC0000","Microsoft":"#00A4EF",
  "Amazon":"#FF9900","Alphabet":"#4285F4","Meta":"#1877F2",
};
const ICON_TEXT = {"카카오":"#3C1E1E"};

export default function MainDashboard({ user }) {
  const navigate = useNavigate();
  const [market, setMarket] = useState("domestic");
  const [sortType, setSortType] = useState("VOLUME");
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exRate, setExRate] = useState({ rate: 1380 });
  const [indices, setIndices] = useState([]);
  const [marketNews, setMarketNews] = useState(null);
  const [newsLoading, setNewsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const searchTimer = useRef(null);

  // 관심종목
  const [watchlist, setWatchlist] = useState([]);
  useEffect(() => { if (user) loadWatchlist(); }, [user]);
  const loadWatchlist = async () => { try { setWatchlist(await getWatchlist() || []); } catch {} };
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

  // ── WebSocket 실시간 가격 ──
  const [wsConnected, setWsConnected] = useState(false);
  const wsClientRef = useRef(null);
  const wsSubsRef = useRef(new Map());
  const stocksRef = useRef([]);

  // WebSocket 클라이언트 초기화 (최초 1회)
  useEffect(() => {
    const wsUrl = NGROK_URL.replace("https://", "wss://").replace("http://", "ws://") + "/ws/websocket";
    const client = new Client({
      brokerURL: wsUrl,
      reconnectDelay: 5000,
      connectHeaders: { "ngrok-skip-browser-warning": "true" },
      onConnect: () => {
        console.log("✅ 홈 WebSocket 연결 성공");
        setWsConnected(true);
        subscribeStocks(client);
      },
      onDisconnect: () => setWsConnected(false),
      onStompError: (frame) => console.error("STOMP 에러:", frame.headers?.message),
    });
    client.activate();
    wsClientRef.current = client;
    return () => {
      wsSubsRef.current.forEach(sub => { try { sub.unsubscribe(); } catch {} });
      wsSubsRef.current.clear();
      client.deactivate();
    };
  }, []);

  // stocks 변경 시 구독 업데이트
  const subscribeStocks = useCallback((client) => {
    const cl = client || wsClientRef.current;
    if (!cl?.connected || !stocksRef.current.length) return;

    wsSubsRef.current.forEach(sub => { try { sub.unsubscribe(); } catch {} });
    wsSubsRef.current.clear();

    stocksRef.current.forEach(stock => {
      const dom = isDomestic(stock.market);
      const key = `${dom ? "d" : "o"}-${stock.symbol}`;
      try {
        if (dom) {
          cl.publish({ destination: "/app/subscribe/domestic/price", body: stock.symbol });
          const sub = cl.subscribe(`/topic/domestic/${stock.symbol}`, msg => {
            try {
              const data = JSON.parse(msg.body);
              setStocks(prev => prev.map(s => s.symbol === data.symbol ? { ...s, ...data } : s));
            } catch {}
          });
          wsSubsRef.current.set(key, sub);
        } else {
          const exc = stock.exchange || getExchangeCode(stock.market);
          cl.publish({ destination: "/app/subscribe/overseas", body: `${stock.symbol},${exc}` });
          const sub = cl.subscribe(`/topic/overseas/${stock.symbol}`, msg => {
            try {
              const data = JSON.parse(msg.body);
              setStocks(prev => prev.map(s => s.symbol === data.symbol ? { ...s, ...data } : s));
            } catch {}
          });
          wsSubsRef.current.set(key, sub);
        }
      } catch (e) { console.warn(`구독 실패 [${stock.symbol}]:`, e); }
    });
  }, []);

  // stocks 변경 시 재구독
  useEffect(() => {
    stocksRef.current = stocks;
    if (wsConnected) subscribeStocks();
  }, [stocks, wsConnected]);

  // 데이터 로드
  useEffect(() => { fetchStocks(); }, [market, sortType]);
  useEffect(() => { (async () => { try { setExRate(await fetchRate()); } catch {} })(); }, []);
  useEffect(() => {
    (async () => {
      try {
        const data = await getMarketIndices();
        setIndices(data || []);
      } catch (e) {
        console.error("지수 로드 실패:", e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await getMarketNews();
        setMarketNews(data || null);
      } catch (e) {
        console.error("뉴스 로드 실패:", e);
      } finally {
        setNewsLoading(false);
      }
    })();
  }, []);

  const fetchStocks = async () => {
    setLoading(true); setError(null); setSearchResults(null);
    try {
      const data = market === "domestic"
        ? await getDomesticRanking(sortType)
        : await getOverseasRanking(sortType);
      setStocks(data || []);
      if (!data?.length) setError("데이터가 없습니다.");
    } catch (e) {
      console.error("순위 로드 실패:", e);
      try { await fetchFallback(); } catch { setError("서버에 연결할 수 없습니다."); }
    } finally { setLoading(false); }
  };

  const fetchFallback = async () => {
    const list = market === "domestic" ? DOMESTIC_STOCKS : OVERSEAS_STOCKS;
    const results = await Promise.allSettled(list.map(async s => {
      const p = isDomestic(s.market) ? await getDomesticPrice(s.symbol) : await getOverseasPrice(s.symbol, s.exchange || "NAS");
      return { ...s, ...p };
    }));
    setStocks(results.filter(r => r.status === "fulfilled").map(r => r.value));
  };

  // 검색
  const handleSearch = (q) => {
    setSearchQuery(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setSearchResults(null); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await searchStocks(q);
        setSearchResults(res?.slice(0, 15) || []);
      } catch { setSearchResults([]); }
    }, 300);
  };

  const handleSelectStock = (stock) => {
    sessionStorage.setItem("cubic_detail_stock", JSON.stringify(stock));
    // 최근 본 종목 저장
    try {
      const recent = JSON.parse(sessionStorage.getItem("cubic_recent") || "[]");
      const updated = [stock, ...recent.filter(s => s.symbol !== stock.symbol)].slice(0, 10);
      sessionStorage.setItem("cubic_recent", JSON.stringify(updated));
      window.dispatchEvent(new Event("cubic_recent_update"));
    } catch {}
    navigate(`/stock/${stock.symbol}`);
    setSearchResults(null); setSearchQuery("");
  };
  
  const getAbbr = (name) => name?.substring(0, 2) || "??";
  const getBg = (name) => ICON_COLORS[name] || "#64748b";
  const getTc = (name) => ICON_TEXT[name] || "#fff";

  const displayStocks = searchResults || stocks;
  const lastColHeader = sortType === "VOLUME" ? (market === "domestic" ? "거래대금" : "거래량") : "거래대금";

  return (
    <div className="dash-page">
      {/* 시장 지수 바 */}
      <div className="market-indices">
        <div className="market-indices-inner">
        {/* 달러 환율 카드 - 기존 유지 */}
        <div className="index-card">
          <div className="idx-label">달러 환율</div>
          <div className="idx-value">{fmt(Math.round(exRate.rate))}</div>
          <div className="idx-chart-placeholder">
            <svg viewBox="0 0 80 24">
              <polyline points="0,18 10,16 20,14 30,15 40,12 50,10 60,8 70,6 80,4" fill="none" stroke="#ef4444" strokeWidth="1.5"/>
            </svg>
          </div>
        </div>

        {/* 코스피 */}
        {(() => {
          const idx = indices.find(i => i.code === "KOSPI");
          const up = idx ? isUp(idx.changePercent) : true;
          return (
            <div className={`index-card ${!idx ? "disabled" : ""}`}>
              <div className="idx-label">코스피 {!idx && <span className="idx-pending">로딩중</span>}</div>
              <div className={`idx-value ${!idx ? "muted" : up ? "up" : "dn"}`}>
                {idx ? fmt(Math.round(Number(idx.price))) : "-"}
              </div>
              {idx && (
                <div className={`idx-change ${up ? "up" : "dn"}`}>
                  {fmtChange(idx.changePercent)}
                </div>
              )}
              <div className="idx-chart-placeholder">
                <svg viewBox="0 0 80 24">
                  <polyline points="0,4 10,6 20,10 30,8 40,12 50,16 60,14 70,18 80,20" fill="none" stroke={up ? "#ef4444" : "#3b82f6"} strokeWidth="1.5" opacity={idx ? "1" : "0.3"}/>
                </svg>
              </div>
            </div>
          );
        })()}

        {/* 코스닥 */}
        {(() => {
          const idx = indices.find(i => i.code === "KOSDAQ");
          const up = idx ? isUp(idx.changePercent) : true;
          return (
            <div className={`index-card ${!idx ? "disabled" : ""}`}>
              <div className="idx-label">코스닥 {!idx && <span className="idx-pending">로딩중</span>}</div>
              <div className={`idx-value ${!idx ? "muted" : up ? "up" : "dn"}`}>
                {idx ? fmt(Math.round(Number(idx.price))) : "-"}
              </div>
              {idx && (
                <div className={`idx-change ${up ? "up" : "dn"}`}>
                  {fmtChange(idx.changePercent)}
                </div>
              )}
              <div className="idx-chart-placeholder">
                <svg viewBox="0 0 80 24">
                  <polyline points="0,6 10,8 20,12 30,10 40,14 50,18 60,16 70,20 80,22" fill="none" stroke={up ? "#ef4444" : "#3b82f6"} strokeWidth="1.5" opacity={idx ? "1" : "0.3"}/>
                </svg>
              </div>
            </div>
          );
        })()}

        {/* 나스닥 */}
        {(() => {
          const idx = indices.find(i => i.code === "NASDAQ");
          const up = idx ? isUp(idx.changePercent) : true;
          return (
            <div className={`index-card ${!idx ? "disabled" : ""}`}>
              <div className="idx-label">나스닥 {!idx && <span className="idx-pending">로딩중</span>}</div>
              <div className={`idx-value ${!idx ? "muted" : up ? "up" : "dn"}`}>
                {idx ? fmt(Math.round(Number(idx.price))) : "-"}
              </div>
              {idx && (
                <div className={`idx-change ${up ? "up" : "dn"}`}>
                  {fmtChange(idx.changePercent)}
                </div>
              )}
              <div className="idx-chart-placeholder">
                <svg viewBox="0 0 80 24">
                  <polyline points="0,12 10,10 20,8 30,10 40,6 50,8 60,4 70,6 80,2" fill="none" stroke={up ? "#ef4444" : "#3b82f6"} strokeWidth="1.5" opacity={idx ? "1" : "0.3"}/>
                </svg>
              </div>
            </div>
          );
        })()}

        {/* S&P 500 */}
        {(() => {
          const idx = indices.find(i => i.code === "SP500");
          const up = idx ? isUp(idx.changePercent) : true;
          return (
            <div className={`index-card ${!idx ? "disabled" : ""}`}>
              <div className="idx-label">S&P 500 {!idx && <span className="idx-pending">로딩중</span>}</div>
              <div className={`idx-value ${!idx ? "muted" : up ? "up" : "dn"}`}>
                {idx ? fmt(Math.round(Number(idx.price))) : "-"}
              </div>
              {idx && (
                <div className={`idx-change ${up ? "up" : "dn"}`}>
                  {fmtChange(idx.changePercent)}
                </div>
              )}
              <div className="idx-chart-placeholder">
                <svg viewBox="0 0 80 24">
                  <polyline points="0,14 10,12 20,10 30,12 40,8 50,6 60,8 70,4 80,6" fill="none" stroke={up ? "#ef4444" : "#3b82f6"} strokeWidth="1.5" opacity={idx ? "1" : "0.3"}/>
                </svg>
              </div>
            </div>
          );
        })()}
        </div>
      </div>

      <div className="dash-body">
        {/* 좌측: 종목 리스트 */}
        <div className="dash-main">
          {/* 검색 (모바일용) */}
          <div className="mobile-search">
            <input type="text" placeholder="종목명 / 코드 검색" value={searchQuery} onChange={e => handleSearch(e.target.value)} />
          </div>

          <div className="dash-card">
            {/* 시장 탭 */}
            <div className="tab-row">
              <div className={`tab ${market === "domestic" ? "active" : ""}`} onClick={() => setMarket("domestic")}>국내주식</div>
              <div className={`tab ${market === "overseas" ? "active" : ""}`} onClick={() => setMarket("overseas")}>해외주식</div>
            </div>
            {/* 정렬 탭 */}
            <div className="sub-tab-row">
              {[["VOLUME","거래대금"],["RISE","급상승"],["FALL","급하락"]].map(([key, label]) => (
                <div key={key} className={`sub-tab ${sortType === key ? "active" : ""}`} onClick={() => setSortType(key)}>{label}</div>
              ))}
            </div>
            {/* 헤더 */}
            <div className="list-header">
              <span>순위</span><span style={{textAlign:"left"}}>종목</span><span>현재가</span><span>등락률</span><span>{lastColHeader}</span>
            </div>
            {/* 종목 리스트 */}
            <div className="stock-list">
              {loading ? (
                <div className="list-empty"><div className="loading-spinner" /><p>불러오는 중...</p></div>
              ) : error ? (
                <div className="list-empty"><p>{error}</p><button onClick={fetchStocks}>다시 시도</button></div>
              ) : displayStocks.length === 0 ? (
                <div className="list-empty"><p>종목이 없습니다</p></div>
              ) : displayStocks.map((s, i) => (
                <div key={s.symbol} className={`stock-row `} onClick={() => handleSelectStock(s)}>
                  <div className="rank">{i + 1}</div>
                  <div className="stock-info">
                    <button className={`star-btn ${isWatched(s.symbol) ? "on" : ""}`} onClick={e => toggleWatch(s, e)}>
                      {isWatched(s.symbol) ? "★" : "☆"}
                    </button>
                    {(() => {
                      const logoUrl = getLogoUrl(s.symbol, s.market);
                      return logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={s.name}
                          className="stock-icon-img"
                          onError={e => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null;
                    })()}
                    <div
                      className="stock-icon"
                      style={{
                        background: getBg(s.name),
                        color: getTc(s.name),
                        display: getLogoUrl(s.symbol, s.market) ? 'none' : 'flex'
                      }}
                    >
                      {getAbbr(s.name)}
                    </div>
                    <div>
                      <div className="stock-name">{s.name}</div>
                      <div className="stock-code">{s.symbol} · {s.market}</div>
                    </div>
                  </div>
                  <div className="price">{s.price ? fmtPrice(s.price, s.market) : "-"}</div>
                  <div className={`change ${isUp(s.changePercent) ? "up" : "dn"}`}>{s.changePercent ? fmtChange(s.changePercent) : "-"}</div>
                  <div className="volume">{s.volume ? fmt(s.volume) : "-"}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 우측: 뉴스 패널 */}
        <div className="dash-detail dash-default">
          <div className="news-section">
            <div className="news-header">
              <span className="news-title">오늘의 뉴스</span>
              {marketNews && <span className="news-updated">{marketNews.updatedAt} 기준</span>}
            </div>

            {newsLoading ? (
              <div className="news-placeholder">
                <div className="news-skeleton"><div className="sk-line long"/><div className="sk-line short"/></div>
                <div className="news-skeleton"><div className="sk-line long"/><div className="sk-line short"/></div>
                <div className="news-skeleton"><div className="sk-line long"/><div className="sk-line short"/></div>
                <div className="news-skeleton"><div className="sk-line long"/><div className="sk-line short"/></div>
              </div>
            ) : !marketNews ? (
              <div className="news-placeholder">
                <p className="news-hint">뉴스 데이터를 불러올 수 없습니다.<br/>잠시 후 다시 시도해주세요.</p>
              </div>
            ) : (
              <div className="news-content">
                {/* 주요 뉴스 헤드라인 */}
                <div className="news-headlines">
                  {marketNews.headlines?.map((h, i) => (
                    <div key={i} className="news-headline-item">
                      <span className="news-dot">•</span>
                      <span>{h}</span>
                    </div>
                  ))}
                </div>

                {/* 호재 섹터 */}
                {marketNews.positive && (
                  <div className="news-sector positive">
                    <div className="sector-label up">📈 {marketNews.positive.sector}</div>
                    <div className="sector-stocks">
                      {marketNews.positive.stocks?.map((s, i) => (
                        <span key={i} className="sector-stock up">
                          {s.symbol} <strong>{s.changePercent}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 악재 섹터 */}
                {marketNews.negative && (
                  <div className="news-sector negative">
                    <div className="sector-label dn">📉 {marketNews.negative.sector}</div>
                    <div className="sector-stocks">
                      {marketNews.negative.stocks?.map((s, i) => (
                        <span key={i} className="sector-stock dn">
                          {s.symbol} <strong>{s.changePercent}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI 한줄 요약 */}
                {marketNews.summary && (
                  <div className="news-summary">
                    <span className="summary-label">💬 AI 요약</span>
                    <p>{marketNews.summary}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 푸터 */}
      <div className="dash-footer">
        <p>여기서 제공하는 투자 정보는 고객의 투자 판단을 위한 단순 참고용일 뿐,<br/>투자 제안 및 권유, 종목 추천을 위해 작성된 것이 아닙니다.</p>
      </div>
    </div>
  );
}
