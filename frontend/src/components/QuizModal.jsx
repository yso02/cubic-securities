import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { getTodayQuiz, submitQuiz } from "../api/stockApi";
import "./QuizModal.css";

export default function QuizModal({ onClose }) {
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getTodayQuiz();
        setQuiz(data);
      } catch (e) {
        setError("퀴즈를 불러올 수 없어요.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      const res = await submitQuiz(quiz.id, selected);
      setResult(res);
    } catch {
      setError("제출에 실패했어요. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const options = quiz?.type === "OX" ? ["O", "X"] : (quiz?.options || []);

  return createPortal(
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
      }}
    >
      <div className={`quiz-modal ${result ? "result-mode" : ""}`}>

        {/* 로딩 */}
        {loading && (
          <div className="quiz-loading">
            <div className="loading-spinner" />
          </div>
        )}

        {/* 에러 */}
        {error && !loading && (
          <div className="quiz-error">
            <p>{error}</p>
            <button className="quiz-close-btn" onClick={onClose}>닫기</button>
          </div>
        )}

        {/* 퀴즈 화면 */}
        {quiz && !result && !loading && (
          <>
            <div className="quiz-header">
              <span className="quiz-badge">오늘의 퀴즈</span>
              <button className="quiz-x" onClick={onClose}>✕</button>
            </div>
            <p className="quiz-question">{quiz.question}</p>
            <div className="quiz-options">
              {options.map((opt, i) => (
                <button
                  key={i}
                  className={`quiz-opt ${selected === opt ? "selected" : ""} ${quiz.type === "OX" ? "ox" : ""}`}
                  onClick={() => setSelected(opt)}
                >
                  {quiz.type !== "OX" && <span className="quiz-opt-num">{i + 1}</span>}
                  {opt}
                </button>
              ))}
            </div>
            {quiz.alreadySolved ? (
              <p className="quiz-already">오늘은 이미 풀었어요. 내일 다시 도전해 보세요!</p>
            ) : (
              <button
                className={`quiz-submit ${!selected ? "disabled" : ""}`}
                onClick={handleSubmit}
                disabled={!selected || submitting}
              >
                {submitting ? "제출 중..." : "제출하기"}
              </button>
            )}
          </>
        )}

        {/* 결과 화면 */}
        {result && (
          <div className={`quiz-result ${result.isCorrect ? "correct" : "wrong"}`}>
            <div className="quiz-header">
              <span className={`quiz-badge ${result.isCorrect ? "correct" : "wrong"}`}>
                {result.isCorrect ? "정답" : "오답"}
              </span>
              <button className="quiz-x" onClick={onClose}>✕</button>
            </div>

            {result.isCorrect ? (
              <>
                <p className="result-title">🏆 축하합니다!</p>
                <p className="result-sub">랜덤 주식 1주가 계좌에 추가됐어요</p>
                <div className="quiz-answer-box">
                  정답: <span>{result.answer}</span>
                </div>
                {result.rewardSymbol && (
                  <div className="reward-row">
                    <div className="reward-left">
                      <div className="reward-icon">
                        {result.rewardName?.substring(0, 2)}
                      </div>
                      <div>
                        <p className="reward-name">{result.rewardName}</p>
                        <p className="reward-code">{result.rewardSymbol} · {result.rewardMarket}</p>
                      </div>
                    </div>
                    <div className="reward-qty">+1주</div>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="result-title">아쉬워요!</p>
                <div className="quiz-answer-box">
                  정답: <span>{result.answer}</span>
                </div>
                {result.explanation && (
                  <p className="quiz-explanation">{result.explanation}</p>
                )}
              </>
            )}

            <button className="quiz-close-btn" onClick={onClose}>확인</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
