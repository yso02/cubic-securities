import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Client } from "@stomp/stompjs";
import {
  getDomesticRanking, getOverseasRanking,
  getDomesticMarketNews, getOverseasMarketNews,
  getWatchlist, addWatchlist, removeWatchlist,
  getExchangeRate, isDomestic, fmt, fmtPrice,
  fmtChange, isUp, getLogoUrl, getExchangeCode,
  NGROK_URL, DOMESTIC_STOCKS, OVERSEAS_STOCKS,
} from "../api/stockApi";
import "./MarketPage.css";

const fmtVolume = (val) => {
  if (!val) return "-";
  const num = Number(val);
  if (isNaN(num)) return "-";
  if (num >= 1_000_000_000_000) return (num / 1_000_000_000_000).toFixed(1) + "조";
  if (num >= 100_000_000) return Math.round(num / 100_000_000) + "억";
  return fmt(Math.round(num));
};

const ICON_COLORS = {
  삼성전자:"#1428A0", SK하이닉스:"#EA002C", 현대차:"#002C5F",
  LG화학:"#A50034", 카카오:"#FAE100", NAVER:"#76B900",
  셀트리온:"#00A6A0", POSCO홀딩스:"#004B87", 기아:"#05141F",
  삼성SDI:"#034EA2", LG에너지솔루션:"#A50034", 신한지주:"#0046FF",
  Apple:"#555", NVIDIA:"#76B900", Tesla:"#CC0000",
  Microsoft:"#00A4EF", Amazon:"#FF9900", Alphabet:"#4285F4", Meta:"#1877F2",
};

export default function MarketPage({ user }) {
  const navigate = useNavigate();
  const [market, setMarket] = useState("domestic");
  const [sortType, setSortType] = useState("VOLUME");
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exRate, setExRate] = useState({ rate: 1380 });
  const [domesticNews, setDomesticNews] = useState(null);
  const [overseasNews, setOverseasNews] = useState(null);
  const [newsLoading, setNewsLoading] = useState(true);
  const [watchlist, setWatchlist] = useState([]);
  const wsClientRef = useRef(null);
  const wsSubsRef = useRef(new Map());
  const stocksRef = useRef([]);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => { fetchStocks(); }, [market, sortType]);

  useEffect(() => {
    (async () => { try { setExRate(await getExchangeRate()); } catch {} })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [domestic, overseas] = await Promise.allSettled([
          getDomesticMarketNews(), getOverseasMarketNews()
        ]);
        if (domestic.status === "fulfilled") setDomesticNews(domestic.value);
        if (overseas.status === "fulfilled") setOverseasNews(overseas.value);
      } finally { setNewsLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (user) loadWatchlist();
  }, [user]);

  const loadWatchlist = async () => {
    try { setWatchlist(await getWatchlist() || []); } catch {}
  };

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

  useEffect(() => {
    const wsUrl = NGROK_URL.replace("https://","wss://").replace("http://","ws://") + "/ws/websocket";
    const client = new Client({
      brokerURL: wsUrl, reconnectDelay: 5000,
      connectHeaders: { "ngrok-skip-browser-warning": "true" },
      onConnect: () => { setWsConnected(true); subscribeStocks(client); },
      onDisconnect: () => setWsConnected(false),
    });
    client.activate();
    wsClientRef.current = client;
    return () => { client.deactivate(); };
  }, []);

  const subscribeStocks = useCallback((client) => {
    const cl = client || wsClientRef.current;
    if (!cl?.connected || !stocksRef.current.length) return;
    wsSubsRef.current.forEach(sub => { try { sub.unsubscribe(); } catch {} });
    wsSubsRef.current.clear();
    stocksRef.current.forEach(stock => {
      const dom = isDomestic(stock.market);
      const key = `${dom?"d":"o"}-${stock.symbol}`;
      try {
        if (dom) {
          cl.publish({ destination: "/app/subscribe/domestic/price", body: stock.symbol });
          const sub = cl.subscribe(`/topic/domestic/${stock.symbol}`, msg => {
            try {
              const data = JSON.parse(msg.body);
              setStocks(prev => prev.map(s => s.symbol === data.symbol ? {...s,...data} : s));
            } catch {}
          });
          wsSubsRef.current.set(key, sub);
        } else {
          const exc = stock.exchange || getExchangeCode(stock.market);
          cl.publish({ destination: "/app/subscribe/overseas", body: `${stock.symbol},${exc}` });
          const sub = cl.subscribe(`/topic/overseas/${stock.symbol}`, msg => {
            try {
              const data = JSON.parse(msg.body);
              setStocks(prev => prev.map(s => s.symbol === data.symbol ? {...s,...data} : s));
            } catch {}
          });
          wsSubsRef.current.set(key, sub);
        }
      } catch {}
    });
  }, []);

  useEffect(() => {
    stocksRef.current = stocks;
    if (wsConnected) subscribeStocks();
  }, [stocks, wsConnected]);

  const fetchStocks = async () => {
    setLoading(true);
    try {
      const data = market === "domestic"
        ? await getDomesticRanking(sortType)
        : await getOverseasRanking(sortType);
      setStocks(data || []);
    } catch { setStocks([]); }
    finally { setLoading(false); }
  };

  const handleSelectStock = (stock) => {
    sessionStorage.setItem("cubic_detail_stock", JSON.stringify(stock));
    navigate(`/stock/${stock.symbol}`);
  };

  const getBg = (name) => ICON_COLORS[name] || "#64748b";
  const currentNews = market === "domestic" ? domesticNews : overseasNews;
  const weatherMap = {
    SUNNY: { emoji: "☀️", label: "상승장", color: "#ef4444" },
    CLOUDY: { emoji: "⛅", label: "혼조세", color: "#f59e0b" },
    RAINY: { emoji: "🌧️", label: "하락장", color: "#3b82f6" },
    STORM: { emoji: "⛈️", label: "급락", color: "#7c3aed" },
  };
  const weather = currentNews?.weather ? weatherMap[currentNews.weather] : null;

  return (
    <div className="market-page">
      <div className="market-header">
        <h1 className="market-title">시장</h1>
      </div>

      <div className="market-body">
        {/* 종목 랭킹 */}
        <div className="market-ranking-card">
          <div className="market-tab-row">
            <div className={`market-tab ${market==="domestic"?"active":""}`} onClick={()=>setMarket("domestic")}>
              <span className="market-flag">🇰🇷</span>
              <span className="market-tab-label">국내주식</span>
            </div>
            <div className={`market-tab ${market==="overseas"?"active":""}`} onClick={()=>setMarket("overseas")}>
              <span className="market-flag">🇺🇸</span>
              <span className="market-tab-label">해외주식</span>
            </div>
          </div>
          <div className="sub-tab-row">
            <div className="segment-control">
              {[["VOLUME","거래대금"],["MARKET_CAP","시가총액"],["RISE","급상승"],["FALL","급하락"]].map(([key,label])=>(
                <div key={key} className={`sub-tab ${sortType===key?"active":""}`} onClick={()=>setSortType(key)}>{label}</div>
              ))}
            </div>
          </div>
          <div className="list-header">
            <span>순위</span>
            <span style={{textAlign:"left"}}>종목</span>
            <span>현재가</span>
            <span>등락률</span>
            <span>거래대금</span>
          </div>
          <div className="stock-list">
            {loading ? (
              <div className="list-empty"><div className="loading-spinner"/></div>
            ) : stocks.map((s, i) => (
              <div key={s.symbol} className="stock-row" onClick={() => handleSelectStock(s)}>
                <div className="rank">{i+1}</div>
                <div className="stock-info">
                  <button className={`star-btn ${isWatched(s.symbol)?"on":""}`} onClick={e=>toggleWatch(s,e)}>
                    {isWatched(s.symbol)?"★":"☆"}
                  </button>
                  {(() => {
                    const logo = getLogoUrl(s.symbol, s.market);
                    return logo
                      ? <img src={logo} className="stock-icon-img" alt="" onError={e=>{e.target.style.display="none";if(e.target.nextSibling)e.target.nextSibling.style.display="flex";}}/>
                      : null;
                  })()}
                  <div className="stock-icon" style={{background:getBg(s.name),display:getLogoUrl(s.symbol,s.market)?"none":"flex"}}>
                    {s.name?.substring(0,2)}
                  </div>
                  <div>
                    <div className="stock-name">{s.name}</div>
                    <div className="stock-code">{s.symbol} · {s.market}</div>
                  </div>
                </div>
                <div className="price">
                  {s.price ? isDomestic(s.market)
                    ? `${fmt(Math.round(Number(s.price)))}원`
                    : `${fmt(Math.round(Number(s.price)*exRate.rate))}원`
                  : "-"}
                </div>
                <div className={`change ${isUp(s.changePercent)?"up":"dn"}`}>
                  {s.changePercent ? fmtChange(s.changePercent) : "-"}
                </div>
                <div className="volume">{fmtVolume(s.volume)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 뉴스 */}
        <div className="market-news-card">
          <div className="news-header">
            <span className="news-title">
              {market === "domestic" ? "🇰🇷 국내 시장 뉴스" : "🇺🇸 해외 시장 뉴스"}
            </span>
            {currentNews && <span className="news-updated">{currentNews.updatedAt} 기준</span>}
          </div>
          {weather && (
            <div className="news-weather" style={{borderColor:weather.color+"40",background:weather.color+"0a"}}>
              <span className="weather-emoji">{weather.emoji}</span>
              <div className="weather-info">
                <span className="weather-label" style={{color:weather.color}}>{weather.label}</span>
                <span className="weather-desc">현재 시장 상황</span>
              </div>
            </div>
          )}
          {newsLoading ? (
            <div className="news-placeholder">
              <div className="news-skeleton"><div className="sk-line long"/><div className="sk-line short"/></div>
              <div className="news-skeleton"><div className="sk-line long"/><div className="sk-line short"/></div>
            </div>
          ) : currentNews ? (
            <div className="news-content">
              <div className="news-headlines">
                {currentNews.headlines?.map((h,i) => (
                  <div key={i} className="news-headline-item">
                    <span className="news-dot">•</span><span>{h}</span>
                  </div>
                ))}
              </div>
              {currentNews.positive && (
                <div className="news-sector positive">
                  <div className="sector-label up">📈 {currentNews.positive.sector}</div>
                  {currentNews.positive.reason && <p className="sector-reason">{currentNews.positive.reason}</p>}
                  <div className="sector-stocks">
                    {currentNews.positive.stocks?.map((s,i) => (
                      <div key={i} className="sector-stock-row up">
                        <div className="sector-stock-name">
                          <span className="sector-stock-symbol">{s.symbol}</span>
                          {s.name && <span className="sector-stock-fullname">{s.name}</span>}
                        </div>
                        <strong className="sector-stock-change">{s.changePercent}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {currentNews.negative && (
                <div className="news-sector negative">
                  <div className="sector-label dn">📉 {currentNews.negative.sector}</div>
                  {currentNews.negative.reason && <p className="sector-reason">{currentNews.negative.reason}</p>}
                  <div className="sector-stocks">
                    {currentNews.negative.stocks?.map((s,i) => (
                      <div key={i} className="sector-stock-row dn">
                        <div className="sector-stock-name">
                          <span className="sector-stock-symbol">{s.symbol}</span>
                          {s.name && <span className="sector-stock-fullname">{s.name}</span>}
                        </div>
                        <strong className="sector-stock-change">{s.changePercent}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {currentNews.summary && (
                <div className="news-summary">
                  <span className="summary-label">💬 AI 요약</span>
                  <p>{currentNews.summary}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="dash-footer">
        <p>여기서 제공하는 투자 정보는 고객의 투자 판단을 위한 단순 참고용일 뿐,<br/>투자 제안 및 권유, 종목 추천을 위해 작성된 것이 아닙니다.</p>
      </div>
    </div>
  );
}
