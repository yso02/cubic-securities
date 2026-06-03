import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { getMyInfo, getHoldings, fmt, isDomestic } from "../api/stockApi";
import api from "../api/stockApi";
import "./LeftSidebar.css";

export default function LeftSidebar({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [totalAsset, setTotalAsset] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalTab, setModalTab] = useState("deposit");
  const [modalAmount, setModalAmount] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

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
    { label: "시장", path: "/market", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  ];

  const aiSubMenus = [
    { label: "AI 채팅",    desc: "종목이나 투자에 대해 질문하세요", icon: "💬", path: "/ai?tab=chat" },
    { label: "종목 분석",  desc: "보유 종목별 상세 분석",            icon: "📊", path: "/ai?tab=holdings" },
    { label: "포트폴리오", desc: "전체 포트폴리오 분석",             icon: "📈", path: "/ai?tab=portfolio" },
    { label: "추천",       desc: "섹터/종목 추천",                   icon: "🎯", path: "/ai?tab=recommend" },
  ];

  const isActive = (path, label) => {
    if (label === "대시보드") return location.pathname === "/";
    return location.pathname === path;
  };

  const refreshAsset = async () => {
    try {
      const [me, holdings] = await Promise.allSettled([getMyInfo(), getHoldings()]);
      const balance = me.status === "fulfilled" ? me.value.balance || 0 : 0;
      const holdingVal = holdings.status === "fulfilled"
        ? holdings.value.reduce((s, h) => s + h.avgPrice * h.quantity, 0) : 0;
      setTotalAsset(balance + holdingVal);
    } catch {}
  };

  const handleConfirm = async () => {
    const amount = Number(modalAmount.replace(/,/g, ""));
    if (!amount || amount <= 0) { alert("금액을 입력해주세요."); return; }
    setModalLoading(true);
    try {
      if (modalTab === "deposit") {
        await api.post("/api/trade/deposit", { amount });
        alert(`${fmt(amount)}원이 입금되었습니다.`);
      } else {
        await api.post("/api/trade/withdraw", { amount });
        alert(`${fmt(amount)}원이 출금되었습니다.`);
      }
      setShowModal(false);
      setModalAmount("");
      await refreshAsset();
    } catch {
      alert("처리 중 오류가 발생했습니다.");
    } finally { setModalLoading(false); }
  };

  return (
    <div className={`left-sidebar ${collapsed ? "collapsed" : ""}`} style={{position:"relative"}}>
      {/* 로고 */}
      <div className="ls-logo">
        <div className="ls-logo-icon" onClick={() => setCollapsed(v => !v)} style={{cursor:"pointer"}}>
          <img src="/cube-icon.svg" width="28" height="28" alt="CUBIC" />
        </div>
        <span className="ls-logo-text" onClick={() => navigate("/")}>CUBIC 증권</span>
      </div>
      <button className="ls-close-btn" onClick={() => setCollapsed(true)}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>

      {/* 총 자산 */}
      <div className="ls-asset">
        <div className="ls-asset-collapsed-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
            <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
          </svg>
        </div>
        <div className="ls-asset-content">
          <div className="ls-asset-header">
            <span className="ls-asset-label">총 자산</span>
            {user && (
              <button className="ls-asset-plus" onClick={() => setShowModal(true)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            )}
          </div>
          <span className="ls-asset-value">
            {totalAsset !== null ? `${fmt(Math.round(totalAsset))}원` : "-"}
          </span>
        </div>
      </div>

      {/* 스크롤 가능한 메뉴 영역 */}
      <div className="ls-menu-scroll">

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
            <span className="ls-menu-text">{m.label}</span>
            <span className="ls-tooltip">{m.label}</span>
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
            <span className="ls-menu-text">{m.label}</span>
            <span className="ls-tooltip">{m.label}</span>
          </button>
        ))}
      </div>

      {/* AI 메뉴 */}
      <div className="ls-section">
        <span className="ls-section-label">AI</span>

        {/* 부모 버튼 */}
        <button
          className={`ls-ai-parent ${location.pathname === "/ai" ? "active" : ""}`}
          onClick={() => setAiOpen(v => !v)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2a10 10 0 1 0 10 10H12z"/>
            <path d="M12 12V2"/>
            <path d="M12 12l7-7"/>
          </svg>
          <span className="ls-ai-parent-text">AI 큐빅</span>
          <svg className={`ls-ai-chevron ${aiOpen ? "open" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
          <span className="ls-tooltip">AI 큐빅</span>
        </button>

        {/* 서브 메뉴 */}
        <div className={`ls-ai-submenu ${aiOpen ? "open" : ""}`}>
          {aiSubMenus.map(m => (
            <button
              key={m.tab}
              className="ls-ai-sub-item"
              onClick={() => navigate(m.path)}
            >
              <span className="ls-ai-sub-icon">{m.icon}</span>
              <span className="ls-ai-sub-info">
                <span className="ls-ai-sub-label">{m.label}</span>
                <span className="ls-ai-sub-desc">{m.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      </div>{/* ls-menu-scroll 끝 */}

      {/* 하단 프로필 */}
      <div className="ls-bottom">
        {user ? (
          <div className="ls-profile-wrap">
            <div className="ls-profile" onClick={() => navigate("/account")}>
              <div className="ls-avatar">{user.name?.[0]?.toUpperCase()}</div>
              <div className="ls-profile-info">
                <span className="ls-profile-name">{user.name}</span>
                <span className="ls-profile-email">{user.email}</span>
              </div>
            </div>
            <button className="ls-logout-btn" onClick={onLogout} title="로그아웃">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
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

      {showModal && (
        <div className="ls-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="ls-modal" onClick={e => e.stopPropagation()}>
            <div className="ls-modal-title">잔고 관리</div>
            <div className="ls-modal-tabs">
              <button className={`ls-modal-tab ${modalTab==="deposit"?"active":""}`} onClick={() => setModalTab("deposit")}>입금</button>
              <button className={`ls-modal-tab ${modalTab==="withdraw"?"active":""}`} onClick={() => setModalTab("withdraw")}>출금</button>
            </div>
            <div className="ls-modal-input-wrap">
              <span className="ls-modal-label">{modalTab === "deposit" ? "입금" : "출금"}할 금액 (원)</span>
              <input
                className="ls-modal-input"
                type="text"
                placeholder="예: 1,000,000"
                value={modalAmount}
                onChange={e => setModalAmount(e.target.value)}
              />
            </div>
            <div className="ls-modal-btns">
              <button className="ls-modal-cancel" onClick={() => { setShowModal(false); setModalAmount(""); }}>취소</button>
              <button className="ls-modal-confirm" onClick={handleConfirm} disabled={modalLoading}>
                {modalLoading ? "처리 중..." : modalTab === "deposit" ? "입금" : "출금"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
