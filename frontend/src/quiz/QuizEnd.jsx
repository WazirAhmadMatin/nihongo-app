// Results, with "same again" and "change settings".
export default function QuizEnd({ summary, onAgain, onReset }) {
  const s = summary
  const verdict = s.pct >= 80 ? 'Very good.' : s.pct >= 60 ? 'Not bad. Keep going.' : 'These need more practice.'
  return (
    <div className="screen">
      <div className="empty">
        <span className="jp">{s.correct} / {s.total}</span>
        {verdict} Words you missed come up more often in the next quizzes.
      </div>
      <div className="stack">
        <button className="btn" onClick={onAgain}>Same quiz again</button>
        <button className="btn-plain" onClick={onReset}>Change settings</button>
      </div>
    </div>
  )
}
