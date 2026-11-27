import { useState, useEffect } from 'react'
import { api } from '../api'
import { plural } from '../levels'

const WEEKS = 18

// Study calendar: one square per day, last WEEKS weeks, Monday first
function Calendar({ days, today }) {
  const counts = Object.fromEntries(days.map(d => [d.day, d.reviews]))
  const end = new Date(today + 'T00:00:00')
  const first = new Date(end)
  first.setDate(end.getDate() - ((end.getDay() + 6) % 7) - (WEEKS - 1) * 7)
  const shade = n => n == null ? 'transparent'
    : n === 0 ? undefined
    : `color-mix(in srgb, var(--ok) ${n < 10 ? 35 : n < 30 ? 60 : n < 60 ? 80 : 100}%, transparent)`
  const cols = []
  for (let c = 0; c < WEEKS; c++) {
    const col = []
    for (let r = 0; r < 7; r++) {
      const d = new Date(first); d.setDate(first.getDate() + c * 7 + r)
      const key = d.toLocaleDateString('en-CA')
      const n = d > end ? null : (counts[key] || 0)
      col.push(<i key={key} title={n != null ? `${key}: ${n}` : undefined} style={{ background: shade(n) }} />)
    }
    cols.push(<div key={c}>{col}</div>)
  }
  return <div className="cal" aria-label="Study calendar">{cols}</div>
}

export default function StatsTab({ onQuizMissed }) {
  const [s,   setS]   = useState(null)
  const [lb,  setLb]  = useState(null)
  const [err, setErr] = useState(null)

  async function load() {
    try {
      const [a, b] = await Promise.all([api.stats(), api.leaderboard()])
      setS(a); setLb(b)
    } catch (e) { setErr(e.message) }
  }
  useEffect(() => { load() }, [])

  async function doReset() {
    if (!confirm("Delete all your progress: reviews, streak and stats? This can't be undone.")) return
    await api.reset()
    load()
  }

  if (err) return <div className="empty">Couldn't load your progress: {err}</div>
  if (!s)  return <div className="empty">Loading…</div>

  const exam = s.exam_days_left
  return (
    <div className="screen">
      <div className="group figures" style={{ marginTop: 8 }}>
        <div className="figure"><b>{s.streak.current}</b><span>day streak</span></div>
        <div className="figure"><b>{s.streak.best}</b><span>best streak</span></div>
        <div className="figure"><b>{s.total_reviews}</b><span>answers</span></div>
        <div className="figure"><b>{s.accuracy}%</b><span>correct</span></div>
      </div>
      {exam != null && exam >= 0 && (
        <p className="note">{exam === 0 ? 'Your JLPT is today. 頑張って!' : `Your JLPT is in ${plural(exam, 'day')} (${s.exam_date}).`}</p>
      )}

      <h2 className="group-title">Last {WEEKS} weeks</h2>
      <div className="group">
        <Calendar days={s.heatmap} today={s.today} />
        <p className="note" style={{ textAlign: 'center', margin: '0 0 12px' }}>Each square is a day. Darker means more answers.</p>
      </div>

      <h2 className="group-title">Words by level</h2>
      <div className="group">
        {s.levels.map(lv => (
          <div className="row" key={lv.level} style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="lv" style={{ '--lv': `var(--${lv.level})`, fontSize: 15 }}>{lv.level}</span>
              <span className="row-sub">{lv.mastered} known, {lv.learning} learning, of {lv.total.toLocaleString()}</span>
            </div>
            <div className="bar">
              <span style={{ width: `${(lv.mastered / lv.total) * 100}%`, background: `var(--${lv.level})` }} />
              <span style={{ width: `${(lv.learning / lv.total) * 100}%`, background: `color-mix(in srgb, var(--${lv.level}) 35%, transparent)` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="note">A word counts as known once its next review is three weeks or more away.</p>

      {s.most_missed.length > 0 && (
        <>
          <h2 className="group-title">Words you miss most</h2>
          <div className="group">
            {s.most_missed.map(w => (
              <div className="row" key={w.id}>
                <span className="jp" style={{ fontSize: 20, fontWeight: 600, minWidth: 64 }}>{w.kanji}</span>
                <div className="row-main">
                  <div className="row-sub" style={{ marginTop: 0 }}>{w.reading ? `${w.reading}: ` : ''}{w.english}</div>
                </div>
                <span className="row-value">{w.count}×</span>
              </div>
            ))}
            <button className="row" onClick={onQuizMissed}>
              <div className="row-main"><div className="row-title" style={{ color: 'var(--link)' }}>Quiz me on these</div></div>
            </button>
          </div>
        </>
      )}

      <h2 className="group-title">This week</h2>
      <div className="group">
        {lb?.board.length ? lb.board.map(e => (
          <div className="row" key={e.rank}>
            <span className="muted" style={{ width: 22 }}>{e.rank}</span>
            <div className="row-main"><div className="row-title" style={{ fontWeight: e.me ? 600 : 400 }}>{e.name}{e.me ? ' (you)' : ''}</div></div>
            <span className="row-value">{plural(e.week, 'answer')}</span>
          </div>
        )) : <div className="row"><div className="row-main row-sub">Nobody has joined the ranking yet.</div></div>}
      </div>
      {lb?.me && !lb.me.public && <p className="note">You're hidden from the ranking. Add a display name in Settings to join.</p>}

      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <button className="btn-text btn-danger" onClick={doReset}>Reset my progress</button>
      </div>
    </div>
  )
}
