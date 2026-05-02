// src/pages/AiPage.jsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { aiChat, aiAnalyzeHoldings, aiAnalyzePortfolio, aiRecommend } from "../api/stockApi";
import "./AiPage.css";

const TABS = [
  { id: "chat", label: "💬 AI 채팅", desc: "종목이나 투자에 대해 질문하세요" },
  { id: "holdings", label: "📊 종목 분석", desc: "보유 종목별 상세 분석" },
  { id: "portfolio", label: "📈 포트폴리오", desc: "전체 포트폴리오 분석" },
  { id: "recommend", label: "🎯 추천", desc: "섹터/종목 추천" },
];

export default function AiPage({ user }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("chat");
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory]);

  if (!user) {
    return (
      <div className="ai-page">
        <div className="ai-login-prompt">
          <span className="ai-prompt-icon">🤖</span>
          <h2>AI 분석을 이용하려면 로그인이 필요해요</h2>
          <p>로그인 후 AI 챗봇과 포트폴리오 분석을 이용할 수 있어요.</p>
          <button onClick={() => navigate("/login")}>로그인하기</button>
        </div>
      </div>
    );
  }

  const handleSendChat = async () => {
    if (!chatInput.trim() || loading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    const newHistory = [...chatHistory, { role: "user", content: userMsg }];
    setChatHistory(newHistory);
    setLoading(true);
    try {
      const apiHistory = newHistory.slice(0, -1).map(m => ({ role: m.role, content: m.content }));
      const res = await aiChat(userMsg, apiHistory);
      setChatHistory(prev => [...prev, { role: "assistant", content: res.message }]);
    } catch (e) {
      const msg = typeof e.response?.data === "string" ? e.response.data : "AI 응답 실패";
      setChatHistory(prev => [...prev, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } };

  const handleAnalysis = async (type) => {
    setActiveTab(type); setAnalysisResult(""); setLoading(true);
    try {
      let res;
      if (type === "holdings") res = await aiAnalyzeHoldings();
      else if (type === "portfolio") res = await aiAnalyzePortfolio();
      else if (type === "recommend") res = await aiRecommend();
      setAnalysisResult(res?.message || "분석 결과가 없습니다.");
    } catch (e) {
      setAnalysisResult(`⚠️ ${typeof e.response?.data === "string" ? e.response.data : "분석 실패"}`);
    } finally { setLoading(false); }
  };

  return (
    <div className="ai-page">
      <div className="ai-container">
        <div className="ai-sidebar">
          <div className="ai-sidebar-hd"><h2>✦ AI 큐빅</h2><p>AI 기반 투자 분석</p></div>
          {TABS.map(tab => (
            <button key={tab.id} className={`ai-side-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => tab.id === "chat" ? setActiveTab("chat") : handleAnalysis(tab.id)}>
              <span className="ai-side-label">{tab.label}</span>
              <span className="ai-side-desc">{tab.desc}</span>
            </button>
          ))}
        </div>

        <div className="ai-main">
          {activeTab === "chat" ? (
            <>
              <div className="ai-chat-area">
                {!chatHistory.length && (
                  <div className="ai-welcome">
                    <span className="ai-welcome-icon">✦</span>
                    <h3>안녕하세요! AI 큐빅이에요</h3>
                    <p>종목 분석, 시장 전망, 투자 전략 등 무엇이든 물어보세요.</p>
                    <div className="ai-suggestions">
                      {["삼성전자 전망 어때?", "반도체 섹터 분석해줘", "지금 매수하기 좋은 종목은?", "포트폴리오 리밸런싱 조언해줘"].map(q => (
                        <button key={q} onClick={() => setChatInput(q)}>{q}</button>
                      ))}
                    </div>
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`ai-msg ${msg.role}`}>
                    {msg.role === "assistant" && <span className="ai-msg-avatar">✦</span>}
                    <div className="ai-msg-bubble">
                      {msg.role === "assistant" ? (
                        <div className="ai-msg-md"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                      ) : (
                        <div className="ai-msg-content">{msg.content}</div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && activeTab === "chat" && (
                  <div className="ai-msg assistant"><span className="ai-msg-avatar">✦</span><div className="ai-msg-bubble"><div className="ai-typing"><span/><span/><span/></div></div></div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="ai-input-area">
                <textarea value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="메시지를 입력하세요... (Enter로 전송)" rows={1} disabled={loading}/>
                <button className="ai-send-btn" onClick={handleSendChat} disabled={loading || !chatInput.trim()}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
            </>
          ) : (
            <div className="ai-analysis-area">
              <div className="ai-analysis-header">
                <h3>{TABS.find(t => t.id === activeTab)?.label}</h3>
                <button className="ai-retry-btn" onClick={() => handleAnalysis(activeTab)} disabled={loading}>{loading ? "분석 중..." : "다시 분석"}</button>
              </div>
              {loading ? (
                <div className="ai-analysis-loading"><div className="loading-spinner"/><p>AI가 분석 중이에요... 잠시만 기다려주세요.</p></div>
              ) : (
                <div className="ai-analysis-result ai-msg-md"><ReactMarkdown>{analysisResult}</ReactMarkdown></div>
              )}
              <div className="ai-disclaimer">⚠️ 모든 AI 분석은 참고용이며, 최종 투자 결정은 본인의 판단으로 해주세요.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
