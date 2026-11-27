import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import { Example, LevelBadge } from '../levels'

// Grade buttons. `days` mirrors the server's schedule so the button can show
// roughly when the word comes back.
const GRADES = [
  { g: 0, label: 'Again', jp: 'もう一度', color: 'var(--red)',    bg: 'var(--red-s)' },
  { g: 1, label: 'Hard',  jp: '難しい',   color: 'var(--gold-l)', bg: 'rgba(226,176,64,0.12)' },
  { g: 2, label: 'Good',  jp: '良い',     color: 'var(--green)',  bg: 'var(--green-s)' },
  { g: 3, label: 'Easy',  jp: '簡単',     color: 'var(--accent)', bg: 'rgba(79,110,247,0.12)' },
]

function nextDays(interval, g) {
  const ivl = interval || 0
  if (g === 0) return 'now'
  let d
  if (ivl < 1) d = g === 3 ? 4 : 1
  else if (g === 1) d = Math.max(ivl * 1.2, ivl + 1)
  else if (g === 2) d = Math.max(ivl * 2.5, ivl + 1)
  else d = Math.max(ivl * 3.25, ivl + 2)
  d = Math.round(d)
  return d < 30 ? `${d}d` : d < 365 ? `${Math.round(d / 30)}mo` : `${Math.round(d / 365)}y`
}

export default function ReviewTab({ onDone }) {
  const [queue,    setQueue]    = useState([])
  const [counts,   setCounts]   = useState({ due: 0, new: 0, done_today: 0 })
  const [shown,    setShown]    = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [session,  setSession]  = useState({ done: 0, again: 0 })
  const [busy,     setBusy]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const d = await api.reviewQueue(30)
      setQueue(d.items)
      setCounts({ due: d.due, new: d.new, done_today: d.done_today })
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const item = queue[0]
  const w = item?.word

  // Keyboard: space = show, 1-4 = grade (handy on desktop Telegram)
  useEffect(() => {
    function onKey(e) {
      if (!w) return
      if (!shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setShown(true) }
      else if (shown && ['1', '2', '3', '4'].includes(e.key)) grade(Number(e.key) - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function reveal() {
    setShown(true)
  }

  async function grade(g) {
    if (!item || busy) return
    setBusy(true)
    try {
      await api.grade(w.id, g)
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(g === 0 ? 'heavy' : 'light')
      setSession(s => ({ done: s.done + 1, again: s.again + (g === 0 ? 1 : 0) }))
      setShown(false)
      setQueue(q => {
        const rest = q.slice(1)
        // "Again": show it once more later in this session
        if (g === 0) rest.splice(Math.min(rest.length, 4), 0, { ...item, is_new: false, interval: 0 })
        return rest
      })
    } catch (e) { alert(e.message) }
    finally { setBusy(false) }
  }

  // Queue ran out: ask the server whether anything else is due
  useEffect(() => {
    if (!loading && queue.length === 0 && session.done > 0) load()
  }, [queue.length])

  if (loading && !w) return (
    <div className="empty-state"><span className="empty-kanji">復</span><span className="empty-text">Loading reviews…</span></div>
  )
  if (error) return (
    <div className="empty-state"><span className="empty-kanji">？</span><span className="empty-text">{error}</span>
      <button className="btn-ghost" onClick={load} style={{ marginTop: 12 }}>Try again</button></div>
  )

  if (!w) return (
    <div className="quiz-complete fade-up" style={{ textAlign: 'center' }}>
      <div className="complete-seal" />
      <div className="complete-title">{session.done ? 'All done for today!' : 'Nothing to review'}</div>
      <div className="complete-sub">お疲れ様でした</div>
      {session.done > 0 && (
        <div className="result-grid">
          <div className="result-card"><span className="result-value">{session.done}</span><span className="result-label">Answers</span></div>
          <div className="result-card"><span className="result-value" style={{ color: 'var(--red)' }}>{session.again}</span><span className="result-label">Again</span></div>
        </div>
      )}
      <div style={{ fontSize: 13, color: 'var(--t3)', margin: '8px 0 20px', fontFamily: 'var(--sans)', lineHeight: 1.6 }}>
        New words come back tomorrow. Want more?<br/>Raise "new words per day" in Settings, or take a quiz.
      </div>
      <button className="btn-primary" onClick={onDone}>Back home</button>
    </div>
  )

  const remaining = queue.length
  return (
    <div className="section-pad fade-up">
      {/* Counters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
                    fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--t3)' }}>
        <span>{item.is_new ? <b style={{ color: 'var(--accent)' }}>NEW WORD</b> : 'REVIEW'}</span>
        <span>{remaining} left · {session.done} done</span>
      </div>

      {/* Card */}
      <div className="flash-card quiz-card-enter" key={w.id + String(session.done)}
        onClick={() => !shown && reveal()} style={{ cursor: shown ? 'default' : 'pointer', minHeight: 240 }}>
        <div className="card-level-row">
          <LevelBadge level={w.level} />
          <span className="pos-tag">{[w.pos, w.topic_en].filter(Boolean).join(' · ')}</span>
        </div>

        <div className="card-body">
        <div className="kanji-display" style={{ textAlign: 'center', padding: '14px 0 6px' }}>
          <span className="kanji-main" style={{ fontSize: 'clamp(44px,12vw,64px)', display: 'block', lineHeight: 1.15 }}>
            {w.kanji}
          </span>
          {shown && (
            <div className="quiz-feedback-enter" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 }}>
              <span style={{ fontFamily: 'var(--serif-jp)', fontSize: 18, color: 'var(--t2)' }}>
                {w.reading || w.kanji}
              </span>
            </div>
          )}
          {shown && w.romaji && <span className="kanji-romaji" style={{ fontSize: 12, opacity: 0.6 }}>{w.romaji}</span>}
        </div>

        {shown ? (
          <div className="quiz-feedback-enter">
            <div style={{ textAlign: 'center', fontSize: 18, fontWeight: 600, color: 'var(--t1)', margin: '6px 0 2px', fontFamily: 'var(--sans)' }}>
              {w.english}
            </div>
            {w.hint && <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>({w.hint})</div>}
            {w.example_jp && (
              <>
                <div className="card-divider" />
                <div className="example-block">
                  <p className="example-jp"><Example text={w.example_jp} target={w.example_target} /></p>
                  <p className="example-en">{w.example_en}</p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--t3)', marginTop: 18, fontFamily: 'var(--mono)', letterSpacing: '0.08em' }}>
            Do you remember it? Tap to check
          </div>
        )}
        </div>
      </div>

      {/* Actions */}
      {!shown ? (
        <button className="btn-primary" style={{ marginTop: 16 }} onClick={reveal}>Show answer</button>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 16 }}>
          {GRADES.map(b => (
            <button key={b.g} onClick={() => grade(b.g)} disabled={busy}
              style={{
                padding: '10px 4px', borderRadius: 12, cursor: 'pointer',
                border: `1.5px solid ${b.color}`, background: b.bg, color: b.color,
                fontFamily: 'var(--sans)', WebkitTapHighlightColor: 'transparent',
              }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{b.label}</div>
              <div style={{ fontSize: 10, opacity: 0.8, fontFamily: 'var(--mono)', marginTop: 2 }}>
                {nextDays(item.interval, b.g)}
              </div>
            </button>
          ))}
        </div>
      )}
      <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--t3)', marginTop: 10, fontFamily: 'var(--mono)' }}>
        {counts.due} due · {counts.new} new today
      </div>
    </div>
  )
}
