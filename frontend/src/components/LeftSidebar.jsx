import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { getMyInfo, getHoldings, fmt } from "../api/stockApi";
import "./LeftSidebar.css";

export default function LeftSidebar({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [totalAsset, setTotalAsset] = useState(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [me, holdings] = await Promise.allSettled([getMyInfo(), getHoldings()]);
        const balance = me.status === "fulfilled" ? me.value.balance || 0 : 0;
        const holdingVal = holdings.status === "fulfilled"
          ? holdings.value.reduce((s, h) => s + h.avgPrice * h.quantity, 0)
          : 0;
        setTotalAsset(balance + holdingVal);
      } catch {}
    })();
  }, [user]);

  const mainMenus = [
    { label: "대시보드", path: "/", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
    { label: "포트폴리오", path: "/account", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
    { label: "관심종목", path: "/watchlist", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg> },
  ];

  const exploreMenus = [
    { label: "시장", path: "/", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  ];

  const isActive = (path, label) => {
    if (label === "대시보드" || label === "시장") return location.pathname === "/";
    return location.pathname === path;
  };

  return (
    <div className="left-sidebar">
      {/* 로고 */}
      <div className="ls-logo" onClick={() => navigate("/")}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="6" rx="1" fill="#14b8a6"/>
          <rect x="3" y="15" width="18" height="6" rx="1" fill="#14b8a6"/>
          <rect x="9" y="9" width="6" height="6" rx="1" fill="#0d9488"/>
        </svg>
        <span>CUBIC 증권</span>
      </div>

      {/* 총 자산 */}
      {user && (
        <div className="ls-asset">
          <span className="ls-asset-label">총 자산</span>
          <span className="ls-asset-value">
            {totalAsset !== null ? `${fmt(Math.round(totalAsset))}원` : "-"}
          </span>
        </div>
      )}

      {/* MAIN 메뉴 */}
      <div className="ls-section">
        <span className="ls-section-label">MAIN</span>
        {mainMenus.map(m => (
          <button
            key={m.label}
            className={`ls-menu-item ${isActive(m.path, m.label) ? "active" : ""}`}
            onClick={() => navigate(m.path)}
          >
            {m.icon}
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {/* 탐색 메뉴 */}
      <div className="ls-section">
        <span className="ls-section-label">탐색</span>
        {exploreMenus.map(m => (
          <button
            key={m.label}
            className={`ls-menu-item ${isActive(m.path, m.label) ? "active" : ""}`}
            onClick={() => navigate(m.path)}
          >
            {m.icon}
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {/* 하단 프로필 */}
      <div className="ls-bottom">
        {user ? (
          <div className="ls-profile" onClick={() => navigate("/account")}>
            <div className="ls-avatar">{user.name?.[0]?.toUpperCase()}</div>
            <div className="ls-profile-info">
              <span className="ls-profile-name">{user.name}</span>
              <span className="ls-profile-email">{user.email}</span>
            </div>
          </div>
        ) : (
          <button className="ls-login-btn" onClick={() => navigate("/login")}>
            로그인
          </button>
        )}
        <div className="ls-build">
          빌드 {new Date(__BUILD_TIME__).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul", month: "numeric", day: "numeric",
            hour: "numeric", minute: "numeric"
          })}
        </div>
      </div>
    </div>
  );
}
