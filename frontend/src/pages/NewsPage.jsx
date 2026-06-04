// src/pages/NewsPage.jsx
import { useState, useEffect } from "react";
import { getMarketNews } from "../api/stockApi";
import "./NewsPage.css";

function timeAgo(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "방금 전";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
  } catch { return ""; }
}

function NewsCard({ item }) {
  const url = item.url || item.link || item.newsUrl || "#";
  return (
    <a className="news-card" href={url} target="_blank" rel="noopener noreferrer">
      {item.imageUrl && (
        <div className="news-card-img">
          <img src={item.imageUrl} alt=""
               onError={e => { e.target.parentNode.style.display = "none"; }} />
        </div>
      )}
      <div className="news-card-body">
        <div className="news-card-meta">
          {item.source && <span className="news-source">{item.source}</span>}
          {item.publishedAt && <span className="news-time">{timeAgo(item.publishedAt)}</span>}
        </div>
        <p className="news-card-title">{item.title}</p>
        {item.summary && <p className="news-card-summary">{item.summary}</p>}
      </div>
    </a>
  );
}

function SkeletonCard() {
  return (
    <div className="news-card news-skeleton">
      <div className="news-card-body">
        <div className="news-sk-meta"/>
        <div className="news-sk-title"/>
        <div className="news-sk-title short"/>
      </div>
    </div>
  );
}

function NewsColumn({ title, flag, news, loading, error }) {
  return (
    <div className="news-column">
      <div className="news-col-header">
        <span className="news-col-flag">{flag}</span>
        <h2 className="news-col-title">{title}</h2>
        {!loading && <span className="news-col-count">{news.length}건</span>}
      </div>
      <div className="news-col-body">
        {loading && [...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
        {!loading && error && (
          <div className="news-state"><span>😵</span><p>뉴스를 불러오지 못했어요</p></div>
        )}
        {!loading && !error && news.length === 0 && (
          <div className="news-state"><span>📭</span><p>뉴스가 없어요</p></div>
        )}
        {!loading && !error && news.map((item, i) => <NewsCard key={i} item={item} />)}
      </div>
    </div>
  );
}

export default function NewsPage() {
  const [krNews, setKrNews] = useState([]);
  const [usNews, setUsNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getMarketNews()
      .then(data => {
        console.log("📰 뉴스 API 응답:", data);
        // 응답 구조에 따라 파싱
        let kr = [], us = [];
        if (data?.domestic) {
          kr = Array.isArray(data.domestic) ? data.domestic : [];
          us = Array.isArray(data.overseas) ? data.overseas : [];
        } else if (data?.kr) {
          kr = Array.isArray(data.kr) ? data.kr : [];
          us = Array.isArray(data.us) ? data.us : [];
        } else if (data?.korean) {
          kr = Array.isArray(data.korean) ? data.korean : [];
          us = Array.isArray(data.overseas || data.american || data.us) ? (data.overseas || data.american || data.us) : [];
        } else if (Array.isArray(data)) {
          // 단일 배열이면 country/type 필드로 구분
          kr = data.filter(n => n.country === "KR" || n.type === "domestic" || n.market === "KR");
          us = data.filter(n => n.country === "US" || n.type === "overseas" || n.market === "US");
          // 구분 안 되면 절반씩
          if (kr.length === 0 && us.length === 0) {
            const mid = Math.ceil(data.length / 2);
            kr = data.slice(0, mid);
            us = data.slice(mid);
          }
        }
        setKrNews(kr);
        setUsNews(us);
      })
      .catch(e => {
        console.error("뉴스 에러:", e);
        setError(e.message || "오류");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="news-page">
      <div className="news-header">
        <div className="news-header-left">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" style={{color:"var(--c-primary)"}}>
            <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/>
            <path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>
          </svg>
          <h1 className="news-page-title">시장 뉴스</h1>
        </div>
        <button className="news-refresh-btn" onClick={load}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          새로고침
        </button>
      </div>

      <div className="news-content">
        <NewsColumn title="한국 뉴스" flag="🇰🇷" news={krNews} loading={loading} error={error} />
        <NewsColumn title="미국 뉴스" flag="🇺🇸" news={usNews} loading={loading} error={error} />
      </div>
    </div>
  );
}
