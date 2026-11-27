// Results screen, with "same again" and "change settings" (reset) actions.
export default function QuizEnd({ summary, onAgain, onReset }) {
  const s = summary
  return (
    <div className="quiz-complete fade-up">
      <div className="complete-seal" />
      <div className="complete-title">Quiz Complete</div>
      <div className="complete-sub">お疲れ様でした — Well done</div>
      <div className="result-grid">
        <div className="result-card">
          <span className="result-value" style={{ color: 'var(--green)' }}>{s.correct}</span>
          <span className="result-label">Correct</span>
        </div>
        <div className="result-card">
          <span className="result-value">{s.total}</span>
          <span className="result-label">Total</span>
        </div>
        <div className="result-card">
          <span className="result-value" style={{ color: s.pct >= 70 ? 'var(--gold-l)' : 'var(--red)' }}>{s.pct}%</span>
          <span className="result-label">Score</span>
        </div>
      </div>
      <div style={{ fontSize: 13, textAlign: 'center', marginBottom: 20, fontFamily: 'var(--sans)',
        color: s.pct >= 80 ? 'var(--green)' : s.pct >= 60 ? 'var(--gold-l)' : 'var(--t3)' }}>
        {s.pct >= 80 ? '🎉 Excellent work! Keep it up!' : s.pct >= 60 ? '💪 Good effort, keep practicing!' : '📚 More practice will get you there!'}
      </div>
      <button className="btn-primary" onClick={onAgain} style={{ marginBottom: 10 }}>もう一度 — Same again</button>
      <button className="btn-ghost" style={{ width: '100%' }} onClick={onReset}>Change settings</button>
    </div>
  )
}
