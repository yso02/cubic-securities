import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { aiChat } from "../api/stockApi";
import "./AiChatDrawer.css";

export default function AiChatDrawer({ open, onClose, user }) {
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

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

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); }
  };

  if (!open) return null;

  return (
    <div className="ai-drawer">
      {/* 헤더 */}
      <div className="ai-drawer-header">
        <div className="ai-drawer-title">
          <span className="ai-drawer-icon">✦</span>
          <span>AI 어시스턴트</span>
        </div>
        <button className="ai-drawer-close" onClick={onClose}>✕</button>
      </div>

      {/* 채팅 영역 */}
      <div className="ai-drawer-chat">
        {!chatHistory.length && (
          <div className="ai-drawer-welcome">
            <span className="ai-drawer-welcome-icon">✦</span>
            <p>안녕하세요! 무엇이든 물어보세요.</p>
            <div className="ai-drawer-suggestions">
              {["삼성전자 전망 어때?", "반도체 섹터 분석해줘", "지금 매수하기 좋은 종목은?"].map(q => (
                <button key={q} onClick={() => setChatInput(q)}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {chatHistory.map((msg, i) => (
          <div key={i} className={`ai-drawer-msg ${msg.role}`}>
            {msg.role === "assistant" && <span className="ai-drawer-avatar">✦</span>}
            <div className="ai-drawer-bubble">
              {msg.role === "assistant"
                ? <div className="ai-drawer-md"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                : <div>{msg.content}</div>
              }
            </div>
          </div>
        ))}
        {loading && (
          <div className="ai-drawer-msg assistant">
            <span className="ai-drawer-avatar">✦</span>
            <div className="ai-drawer-bubble">
              <div className="ai-typing"><span/><span/><span/></div>
            </div>
          </div>
        )}
        <div ref={chatEndRef}/>
      </div>

      {/* 입력 영역 */}
      <div className="ai-drawer-input">
        {!user && (
          <div className="ai-drawer-login-hint">로그인 후 이용할 수 있어요</div>
        )}
        <div className="ai-drawer-input-row">
          <textarea
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지 입력... (Enter로 전송)"
            rows={1}
            disabled={loading || !user}
          />
          <button
            className="ai-drawer-send"
            onClick={handleSendChat}
            disabled={loading || !chatInput.trim() || !user}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
