import { useState, useEffect } from "react";
import { getDomesticMarketNews, getOverseasMarketNews, getLogoUrl, isDomestic } from "../api/stockApi";
import Twemoji from "../components/Twemoji";
import "./NewsPage.css";

function MarketReport({ title, flag, data, loading, error }) {
  if (loading) return (
    <div className="news-column">
      <div className="news-col-header">
        <Twemoji emoji={flag} size={20}/>
        <h2 className="news-col-title">{title}</h2>
      </div>
      <div className="news-col-body">
        {[...Array(4)].map((_, i) => <div key={i} className="news-skeleton-block"/>)}
      </div>
    </div>
  );

  if (error || !data) return (
    <div className="news-column">
      <div className="news-col-header">
        <Twemoji emoji={flag} size={20}/>
        <h2 className="news-col-title">{title}</h2>
        <span className="news-col-count">0건</span>
      </div>
      <div className="news-col-body">
        <div className="news-state"><span>😵</span><p>뉴스를 불러오지 못했어요</p></div>
      </div>
    </div>
  );

  return (
    <div className="news-column">
      <div className="news-col-header">
        <Twemoji emoji={flag} size={20}/>
        <h2 className="news-col-title">{title}</h2>
        <span className="news-updated">{data.updatedAt}</span>
      </div>
      <div className="news-col-body">

        {data.headlines?.length > 0 && (
          <div className="news-section">
            <div className="news-section-title">주요 헤드라인</div>
            <div className="news-headlines">
              {data.headlines.map((h, i) => (
                <div key={i} className="news-headline-item">
                  <span className="news-headline-dot">•</span>
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.positive && (
          <div className="news-section">
            <div className="news-section-title positive">↑ 강세 섹터</div>
            <div className="news-sector-card positive">
              <div className="news-sector-name">{data.positive.sector}</div>
              <div className="news-sector-reason">{data.positive.reason}</div>
              <div className="news-stocks">
                {data.positive.stocks?.map((s, i) => (
                  <div key={i} className="news-stock-item">
                    {(() => {
                      const logo = getLogoUrl(s.symbol, isDomestic(s.symbol) ? "KOSPI" : "NASDAQ");
                      return logo
                        ? <img src={logo} className="news-stock-logo" alt="" onError={e=>{e.target.style.display="none";}}/>
                        : <div className="news-stock-logo-fb">{s.name?.substring(0,2)}</div>;
                    })()}
                    <span className="news-stock-name">{s.name}</span>
                    <span className="news-stock-change positive">{s.changePercent}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {data.negative && (
          <div className="news-section">
            <div className="news-section-title negative">↓ 약세 섹터</div>
            <div className="news-sector-card negative">
              <div className="news-sector-name">{data.negative.sector}</div>
              <div className="news-sector-reason">{data.negative.reason}</div>
              <div className="news-stocks">
                {data.negative.stocks?.map((s, i) => (
                  <div key={i} className="news-stock-item">
                    {(() => {
                      const logo = getLogoUrl(s.symbol, isDomestic(s.symbol) ? "KOSPI" : "NASDAQ");
                      return logo
                        ? <img src={logo} className="news-stock-logo" alt="" onError={e=>{e.target.style.display="none";}}/>
                        : <div className="news-stock-logo-fb">{s.name?.substring(0,2)}</div>;
                    })()}
                    <span className="news-stock-name">{s.name}</span>
                    <span className="news-stock-change negative">{s.changePercent}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {data.summary && (
          <div className="news-section">
            <div className="news-section-title">종합 요약</div>
            <div className="news-summary">{data.summary}</div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function NewsPage() {
  const [krData, setKrData] = useState(null);
  const [usData, setUsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.allSettled([
      getDomesticMarketNews(),
      getOverseasMarketNews(),
    ]).then(([krRes, usRes]) => {
      if (krRes.status === "fulfilled") setKrData(krRes.value);
      if (usRes.status === "fulfilled") setUsData(usRes.value);
      if (krRes.status === "rejected" && usRes.status === "rejected") setError("뉴스를 불러오지 못했어요.");
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="news-page">
      <div className="news-header">
        <div className="news-header-left">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:"var(--c-primary)"}}>
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
            <path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>
          </svg>
          <h1 className="news-page-title">시장 뉴스</h1>
        </div>
        <button className="news-refresh-btn" onClick={load}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          새로고침
        </button>
      </div>

      <div className="news-content">
        <MarketReport title="한국 뉴스" flag="🇰🇷" data={krData} loading={loading} error={error} />
        <MarketReport title="미국 뉴스" flag="🇺🇸" data={usData} loading={loading} error={error} />
      </div>
    </div>
  );
}
