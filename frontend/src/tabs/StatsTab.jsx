import { useState, useEffect } from 'react'
import { api } from '../api'
import { LEVEL_COLORS } from '../levels'

const WEEKS = 18

// GitHub-style calendar of the last WEEKS weeks
function Heatmap({ days, today }) {
  const counts = Object.fromEntries(days.map(d => [d.day, d.reviews]))
  const end = new Date(today + 'T00:00:00')
  // first column starts on a Monday, WEEKS columns ending with this week
  const first = new Date(end)
  first.setDate(end.getDate() - ((end.getDay() + 6) % 7) - (WEEKS - 1) * 7)
  const cols = []
  for (let c = 0; c < WEEKS; c++) {
    const col = []
    for (let r = 0; r < 7; r++) {
      const d = new Date(first)
      d.setDate(first.getDate() + c * 7 + r)
      const key = d.toLocaleDateString('en-CA')
      col.push({ key, n: d > end ? null : (counts[key] || 0) })
    }
    cols.push(col)
  }
  const shade = n => n === null ? 'transparent'
    : n === 0 ? 'var(--card-border)'
    : n < 10 ? 'rgba(20,169,107,0.30)'
    : n < 30 ? 'rgba(20,169,107,0.55)'
    : n < 60 ? 'rgba(20,169,107,0.80)' : 'var(--green)'
  return (
    <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
      {cols.map((col, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {col.map(cell => (
            <div key={cell.key} title={cell.n != null ? `${cell.key}: ${cell.n}` : ''}
              style={{ width: 13, height: 13, borderRadius: 3, background: shade(cell.n) }} />
          ))}
        </div>
      ))}
    </div>
  )
}

function Section({ title, children, right }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="section-title" style={{ marginBottom: 10 }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  )
}

export default function StatsTab({ onQuizMissed }) {
  const [s,  setS]  = useState(null)
  const [lb, setLb] = useState(null)
  const [err, setErr] = useState(null)

  async function load() {
    try {
      const [a, b] = await Promise.all([api.stats(), api.leaderboard()])
      setS(a); setLb(b)
    } catch (e) { setErr(e.message) }
  }
  useEffect(() => { load() }, [])

  async function doReset() {
    if (!confirm('Delete all your progress (reviews, streak, stats)? This cannot be undone.')) return
    await api.reset()
    load()
  }

  if (err) return <div className="empty-state"><span className="empty-kanji">？</span><span className="empty-text">{err}</span></div>
  if (!s) return <div className="empty-state"><span className="empty-kanji">統</span><span className="empty-text">Loading…</span></div>

  const exam = s.exam_days_left
  return (
    <div className="section-pad fade-up">
      {/* Top cards */}
      <div className="stats-grid" style={{ marginBottom: 22 }}>
        <div className="stat-card">
          <span className="stat-icon">🔥</span>
          <span className="stat-value" style={{ color: 'var(--gold-l)' }}>{s.streak.current}</span>
          <span className="stat-label">Day streak</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⚡</span>
          <span className="stat-value">{s.streak.best}</span>
          <span className="stat-label">Best streak</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">✅</span>
          <span className="stat-value">{s.total_reviews}</span>
          <span className="stat-label">Answers</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🎯</span>
          <span className="stat-value" style={{ color: s.accuracy >= 80 ? 'var(--green)' : 'var(--t1)' }}>{s.accuracy}%</span>
          <span className="stat-label">Accuracy</span>
        </div>
      </div>

      {exam != null && exam >= 0 && (
        <div style={{
          marginBottom: 22, padding: '14px 16px', borderRadius: 14, textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(79,110,247,0.12), rgba(212,104,156,0.10))',
          border: '1px solid rgba(79,110,247,0.25)',
        }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--t3)', letterSpacing: '0.1em' }}>JLPT · {s.exam_date}</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--t1)', fontFamily: 'var(--display)' }}>
            {exam === 0 ? 'Today! 頑張って！' : `${exam} day${exam === 1 ? '' : 's'} to go`}
          </div>
        </div>
      )}

      <Section title="Study calendar">
        <Heatmap days={s.heatmap} today={s.today} />
        <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--t3)', marginTop: 6, fontFamily: 'var(--mono)' }}>
          last {WEEKS} weeks · darker = more answers
        </div>
      </Section>

      <Section title="Progress by level">
        {s.levels.map(lv => {
          const c = LEVEL_COLORS[lv.level]
          const m = (lv.mastered / lv.total) * 100
          const l = (lv.learning / lv.total) * 100
          return (
            <div key={lv.level} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, fontFamily: 'var(--mono)' }}>
                <span style={{ color: c.color, fontWeight: 700 }}>{lv.level}</span>
                <span style={{ color: 'var(--t3)' }}>
                  {lv.mastered} mastered · {lv.learning} learning · {lv.total}
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 99, background: 'var(--card-border)', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${m}%`, background: c.color }} />
                <div style={{ width: `${l}%`, background: c.color, opacity: 0.35 }} />
              </div>
            </div>
          )
        })}
        <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>
          mastered = next review 3+ weeks away
        </div>
      </Section>

      {s.most_missed.length > 0 && (
        <Section title="Needs practice"
          right={<button className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={onQuizMissed}>Quiz these →</button>}>
          <div className="wrong-list">
            {s.most_missed.map(w => (
              <div className="wrong-item" key={w.id}>
                <span className="wrong-kanji">{w.kanji}</span>
                <div className="wrong-info">
                  <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 2 }}>
                    {w.reading ? `${w.reading} — ` : ''}{w.english}
                  </div>
                  <div className="wrong-count">{w.count}× wrong · {w.level}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="🏆 This week">
        {lb?.board.length ? (
          <div>
            {lb.board.map(e => (
              <div key={e.rank} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', marginBottom: 6,
                borderRadius: 10, border: '1px solid var(--card-border)',
                background: e.me ? 'rgba(79,110,247,0.10)' : 'var(--card-bg)',
              }}>
                <span style={{ width: 26, fontSize: 16 }}>{['🥇', '🥈', '🥉'][e.rank - 1] || `${e.rank}.`}</span>
                <span style={{ flex: 1, fontWeight: e.me ? 700 : 500, color: 'var(--t1)', fontSize: 14 }}>{e.name}{e.me ? ' (you)' : ''}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--t2)' }}>{e.week} · 🔥{e.streak}</span>
              </div>
            ))}
          </div>
        ) : null}
        {lb?.me && !lb.me.public && (
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>
            You're not on the leaderboard. Choose a display name in ⚙️ Settings to join.
          </div>
        )}
      </Section>

      <button className="btn-ghost" style={{ width: '100%', fontSize: 12, color: 'var(--red)' }} onClick={doReset}>
        Reset all progress
      </button>
    </div>
  )
}
