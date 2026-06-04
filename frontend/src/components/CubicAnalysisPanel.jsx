import { useState, useEffect } from "react";
import { getCubicLatest, getCubicAnalyze } from "../api/stockApi";
import "./CubicAnalysisPanel.css";

const ACTION_LABEL = { BUY: "매수 권장", SELL: "매도 권장", HOLD: "관망 권장" };
const ACTION_COLOR = { BUY: "buy", SELL: "sell", HOLD: "hold" };
const REGIME_LABEL = { UP: "상승", DOWN: "하락", SIDEWAYS: "횡보", Side: "횡보", Up: "상승", Down: "하락" };
const RISK_LABEL = { HIGH: "높음", MEDIUM: "보통", LOW: "낮음", High: "높음", Mid: "보통", Low: "낮음" };
const MOMENTUM_LABEL = { STRONG: "강함", NORMAL: "보통", WEAK: "약함", Strong: "강함", Normal: "보통", Weak: "약함" };

export default function CubicAnalysisPanel({ stock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!stock?.symbol) return;
    setLoading(true);
    setData(null);
    setError(null);

    const load = async () => {
      try {
        let result = await getCubicLatest(stock.symbol);
        const isValid = result && typeof result === "object" && result.action;
        if (!isValid) {
          result = await getCubicAnalyze(stock.symbol, stock.market || "KOSPI");
        }
        // description이 null이면 실시간 분석 호출
        if (isValid && !result.description) {
          try {
            const fresh = await getCubicAnalyze(stock.symbol, stock.market || "KOSPI");
            if (fresh?.description) result = { ...result, description: fresh.description };
          } catch {}
        }
        setData(result);
      } catch (e) {
        setError("분석 데이터를 불러올 수 없어요.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [stock?.symbol]);

  if (loading) return (
    <div className="cap-loading">
      <div className="cap-loading-ring"/>
      <span>AI 분석 중...</span>
    </div>
  );

  if (error || !data) return (
    <div className="cap-empty">{error || "분석 데이터가 없어요."}</div>
  );

  const action = data.action || "HOLD";
  const score = data.cubic_score ?? data.cubicScore ?? 50;
  const desc = data.description || {};
  const cell = data.cell || {};
  const regime = cell.x || cell.regime || "-";
  const risk = cell.y || cell.risk || "-";
  const momentum = cell.z || cell.momentum || "-";
  const analyzedAt = data.date || (data.analyzedAt
    ? new Date(data.analyzedAt).toLocaleDateString("ko-KR")
    : "-");

  return (
    <div className="cap-wrap">
      <div className="cap-header">
        <span className={`cap-action-badge ${ACTION_COLOR[action]}`}>
          {ACTION_LABEL[action] || action}
        </span>
        <span className="cap-symbol">{stock.name} {stock.symbol}</span>
      </div>

      <div className="cap-score-wrap">
        <span className="cap-score-label">0</span>
        <div className="cap-score-track">
          <div className="cap-score-fill" style={{ width: `${score}%` }}/>
          <div className="cap-score-thumb" style={{ left: `${score}%` }}>
            <span className="cap-score-value">점수 {score}</span>
          </div>
        </div>
        <span className="cap-score-label">100</span>
      </div>

      {desc && (
        <div className="cap-desc-cards">
          {desc.regimeDesc && (
            <div className="cap-desc-card">
              <span className="cap-desc-icon">📈</span>
              <span>{desc.regimeDesc}</span>
            </div>
          )}
          {desc.riskDesc && (
            <div className="cap-desc-card">
              <span className="cap-desc-icon">⚠️</span>
              <span>{desc.riskDesc}</span>
            </div>
          )}
          {desc.momentumDesc && (
            <div className="cap-desc-card">
              <span className="cap-desc-icon">💫</span>
              <span>{desc.momentumDesc}</span>
            </div>
          )}
        </div>
      )}

      {desc.conclusion && (
        <div className={`cap-conclusion ${ACTION_COLOR[action]}`}>
          <strong>{desc.conclusion}</strong>
          {desc.detail && <p>{desc.detail}</p>}
        </div>
      )}

      <div className="cap-stats">
        <div className="cap-stat">
          <span className="cap-stat-label">시장</span>
          <span className="cap-stat-value">{REGIME_LABEL[regime] || regime}</span>
        </div>
        <div className="cap-stat">
          <span className="cap-stat-label">위험도</span>
          <span className="cap-stat-value">{RISK_LABEL[risk] || risk}</span>
        </div>
        <div className="cap-stat">
          <span className="cap-stat-label">힘</span>
          <span className="cap-stat-value">{MOMENTUM_LABEL[momentum] || momentum}</span>
        </div>
      </div>

      <div className="cap-date">기준일 {analyzedAt}</div>
    </div>
  );
}
