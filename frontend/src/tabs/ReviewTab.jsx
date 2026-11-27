import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import { Example, LevelTag, plural, wordSize } from '../levels'

// Again / Hard / Good / Easy. `nextDays` mirrors the server's schedule so each
// button can say roughly when the word comes back.
const GRADES = [
  { g: 0, label: 'Again', cls: 'again' },
  { g: 1, label: 'Hard',  cls: '' },
  { g: 2, label: 'Good',  cls: 'good' },
  { g: 3, label: 'Easy',  cls: '' },
]

function nextDays(interval, g) {
  const ivl = interval || 0
  if (g === 0) return 'today'
  let d
  if (ivl < 1) d = g === 3 ? 4 : 1
  else if (g === 1) d = Math.max(ivl * 1.2, ivl + 1)
  else if (g === 2) d = Math.max(ivl * 2.5, ivl + 1)
  else d = Math.max(ivl * 3.25, ivl + 2)
  d = Math.round(d)
  return d === 1 ? 'tomorrow' : d < 30 ? `${d} days` : d < 365 ? `${Math.round(d / 30)} mo` : `${Math.round(d / 365)} yr`
}

export default function ReviewTab({ onDone }) {
  const [queue,   setQueue]   = useState([])
  const [shown,   setShown]   = useState(false)
  const [turning, setTurning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [session, setSession] = useState({ done: 0, again: 0, total: 0 })
  const [busy,    setBusy]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const d = await api.reviewQueue(30)
      setQueue(d.items)
      setSession(s => ({ ...s, total: s.done + d.items.length }))
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const item = queue[0]
  const w = item?.word

  function reveal() {
    if (shown || !w) return
    setTurning(true)
    setShown(true)
    setTimeout(() => setTurning(false), 340)
  }

  async function grade(g) {
    if (!item || busy) return
    setBusy(true)
    try {
      await api.grade(w.id, g)
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(g === 0 ? 'medium' : 'light')
      setSession(s => ({ done: s.done + 1, again: s.again + (g === 0 ? 1 : 0), total: s.total + (g === 0 ? 1 : 0) }))
      setShown(false)
      setQueue(q => {
        const rest = q.slice(1)
        // "Again": see it once more a few cards later
        if (g === 0) rest.splice(Math.min(rest.length, 4), 0, { ...item, is_new: false, interval: 0 })
        return rest
      })
    } catch (e) { alert(e.message) }
    finally { setBusy(false) }
  }

  // Keyboard: space shows the answer, 1–4 grade (handy in Telegram Desktop)
  useEffect(() => {
    function onKey(e) {
      if (!w) return
      if (!shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal() }
      else if (shown && ['1', '2', '3', '4'].includes(e.key)) grade(Number(e.key) - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Ran out: ask the server whether anything else is due
  useEffect(() => {
    if (!loading && queue.length === 0 && session.done > 0) load()
  }, [queue.length])

  if (loading && !w) return <div className="empty">Loading your cards…</div>
  if (error) return (
    <div className="screen">
      <div className="empty">Couldn't load your cards: {error}</div>
      <button className="btn-plain" onClick={load}>Try again</button>
    </div>
  )

  if (!w) return (
    <div className="screen">
      <div className="empty">
        <span className="jp">お疲れさまでした</span>
        {session.done
          ? `That's everything for today: ${plural(session.done, 'answer')}${session.again ? `, ${session.again} to look at again` : ''}.`
          : 'Nothing is due right now.'}
        <br />New words arrive tomorrow. For more today, raise "New words per day" in Settings or take a quiz.
      </div>
      <button className="btn" onClick={onDone}>Back to home</button>
    </div>
  )

  const pct = session.total ? (session.done / session.total) * 100 : 0
  return (
    <div className="screen">
      <div className="progress" aria-hidden><div style={{ width: `${pct}%` }} /></div>
      <div className="counter">
        <span>{item.is_new ? 'New word' : 'Review'}</span>
        <span>{queue.length} left</span>
      </div>

      <div className={`tango ${turning ? 'turn' : ''}`} onClick={reveal}
        role={shown ? undefined : 'button'} aria-label={shown ? undefined : 'Show the answer'}
        style={{ cursor: shown ? 'default' : 'pointer' }}>
        <div className="tango-meta"><LevelTag level={w.level} /></div>
        <div className="tango-word" style={{ fontSize: wordSize(w.kanji) }}>{w.kanji}</div>

        {shown ? (
          <>
            {w.reading && <div className="tango-reading">{w.reading}</div>}
            <div className="tango-meaning">{w.english}</div>
            {w.hint && <div className="tango-hint">{w.hint}</div>}
            {w.example_jp && (
              <>
                <hr className="tango-rule" />
                <p className="example-jp"><Example text={w.example_jp} target={w.example_target} /></p>
                <p className="example-en">{w.example_en}</p>
              </>
            )}
          </>
        ) : (
          <p className="tango-prompt">Say the reading and meaning, then tap the card.</p>
        )}
      </div>

      {shown ? (
        <div className="grades">
          {GRADES.map(b => (
            <button key={b.g} className={`grade ${b.cls}`} onClick={() => grade(b.g)} disabled={busy}>
              {b.label}<small>{nextDays(item.interval, b.g)}</small>
            </button>
          ))}
        </div>
      ) : (
        <button className="btn" onClick={reveal}>Show answer</button>
      )}
    </div>
  )
}
