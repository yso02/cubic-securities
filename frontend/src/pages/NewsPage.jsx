// src/pages/NewsPage.jsx
import { useState, useEffect } from "react";
import { getDomesticMarketNews, getOverseasMarketNews } from "../api/stockApi";
import "./NewsPage.css";

function NewsCard({ item, type }) {
  const isKr = type === "kr";
  return (
    <a
      className="news-card"
      href={item.url || item.link || "#"}
      target="_blank"
      rel="noopener noreferrer"
    >
      {item.imageUrl && (
        <div className="news-card-img">
          <img src={item.imageUrl} alt="" onError={e => { e.target.parentNode.style.display = "none"; }} />
        </div>
      )}
      <div className="news-card-body">
        <div className="news-card-meta">
          <span className={`news-badge ${isKr ? "kr" : "us"}`}>{isKr ? "🇰🇷 한국" : "🇺🇸 미국"}</span>
          {item.source && <span className="news-source">{item.source}</span>}
          {item.publishedAt && (
            <span className="news-time">
              {new Date(item.publishedAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })}
            </span>
          )}
        </div>
        <p className="news-card-title">{item.title}</p>
        {item.summary && <p className="news-card-summary">{item.summary}</p>}
      </div>
    </a>
  );
}

function NewsColumn({ title, flag, news, loading, error, type }) {
  return (
    <div className="news-column">
      <div className="news-col-header">
        <span className="news-col-flag">{flag}</span>
        <h2 className="news-col-title">{title}</h2>
        <span className="news-col-count">{loading ? "…" : `${news.length}건`}</span>
      </div>
      <div className="news-col-body">
        {loading && (
          <div className="news-loading">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="news-skeleton">
                <div className="news-sk-meta" />
                <div className="news-sk-title" />
                <div className="news-sk-title short" />
              </div>
            ))}
          </div>
        )}
        {!loading && error && (
          <div className="news-error">
            <span>😵</span>
            <p>뉴스를 불러오지 못했어요</p>
            <span className="news-error-sub">{error}</span>
          </div>
        )}
        {!loading && !error && news.length === 0 && (
          <div className="news-empty">
            <span>📭</span>
            <p>뉴스가 없어요</p>
          </div>
        )}
        {!loading && !error && news.map((item, i) => (
          <NewsCard key={i} item={item} type={type} />
        ))}
      </div>
    </div>
  );
}

export default function NewsPage() {
  const [krNews, setKrNews] = useState([]);
  const [usNews, setUsNews] = useState([]);
  const [krLoading, setKrLoading] = useState(true);
  const [usLoading, setUsLoading] = useState(true);
  const [krError, setKrError] = useState(null);
  const [usError, setUsError] = useState(null);
  const [tab, setTab] = useState("all"); // all | kr | us

  const load = async () => {
    setKrLoading(true); setUsLoading(true);
    setKrError(null); setUsError(null);

    getDomesticMarketNews()
      .then(data => setKrNews(Array.isArray(data) ? data : []))
      .catch(e => setKrError(e.message || "오류"))
      .finally(() => setKrLoading(false));

    getOverseasMarketNews()
      .then(data => setUsNews(Array.isArray(data) ? data : []))
      .catch(e => setUsError(e.message || "오류"))
      .finally(() => setUsLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="news-page">
      {/* 헤더 */}
      <div className="news-header">
        <div className="news-header-left">
          <h1 className="news-page-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
              <path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>
            </svg>
            시장 뉴스
          </h1>
          <div className="news-tabs">
            {[{k:"all",l:"전체"},{k:"kr",l:"🇰🇷 한국"},{k:"us",l:"🇺🇸 미국"}].map(t => (
              <button key={t.k} className={`news-tab ${tab===t.k?"active":""}`} onClick={() => setTab(t.k)}>{t.l}</button>
            ))}
          </div>
        </div>
        <button className="news-refresh-btn" onClick={load}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          새로고침
        </button>
      </div>

      {/* 컨텐츠 */}
      <div className={`news-content ${tab !== "all" ? "single" : ""}`}>
        {(tab === "all" || tab === "kr") && (
          <NewsColumn title="한국 뉴스" flag="🇰🇷" news={krNews} loading={krLoading} error={krError} type="kr" />
        )}
        {(tab === "all" || tab === "us") && (
          <NewsColumn title="미국 뉴스" flag="🇺🇸" news={usNews} loading={usLoading} error={usError} type="us" />
        )}
      </div>
    </div>
  );
}
