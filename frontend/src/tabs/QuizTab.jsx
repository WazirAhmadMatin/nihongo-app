import { useState, useEffect } from 'react'
import { api } from '../api'

const LEVELS = [null, 'N5', 'N4', 'EXTRA']
const LABEL  = { null: 'All', N5: 'N5', N4: 'N4', EXTRA: 'Extra' }
const COUNTS = [
  { n: 5,  label: 'Quick',     sub: '~2 min' },
  { n: 10, label: 'Standard',  sub: '~5 min' },
  { n: 20, label: 'Deep dive', sub: '~10 min' },
]

const QUIZ_CSS = `
  @keyframes iconPop {
    0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
    70%  { transform: scale(1.3) rotate(4deg); }
    100% { transform: scale(1) rotate(0); opacity: 1; }
  }
  @keyframes streakBounce {
    0%   { transform: scale(1); }
    30%  { transform: scale(1.35) rotate(-4deg); }
    60%  { transform: scale(0.92) rotate(2deg); }
    100% { transform: scale(1); }
  }
  @keyframes flashPulse {
    0%   { opacity: 0; }
    15%  { opacity: 1; }
    100% { opacity: 0; }
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .quiz-card-enter { animation: slideUp 0.28s cubic-bezier(.22,1,.36,1) both; }
  .quiz-feedback-enter { animation: slideUp 0.2s cubic-bezier(.22,1,.36,1) both; }
`

function ChoiceBtn({ label, state, onClick, disabled }) {
  const S = {
    idle:    { border: '1.5px solid var(--card-border)', bg: 'var(--card-bg)',          color: 'var(--t2)',    icon: null },
    correct: { border: '1.5px solid var(--green)',       bg: 'var(--green-s)',           color: 'var(--green)', icon: '✓' },
    wrong:   { border: '1.5px solid var(--red)',         bg: 'var(--red-s)',             color: 'var(--red)',   icon: '✗' },
    reveal:  { border: '1.5px solid var(--green)',       bg: 'rgba(20,169,107,0.06)',    color: 'var(--green)', icon: '✓' },
  }[state] || { border: '1.5px solid var(--card-border)', bg: 'var(--card-bg)', color: 'var(--t2)', icon: null }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', padding: '13px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        border: S.border, borderRadius: 10, background: S.bg, color: S.color,
        fontSize: 15, fontFamily: 'var(--sans)',
        fontWeight: state === 'idle' ? 400 : 600,
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left', lineHeight: 1.4,
        transition: 'background 0.18s, border-color 0.18s, color 0.18s, transform 0.12s',
        transform: state !== 'idle' ? 'scale(1.01)' : 'scale(1)',
        outline: 'none', WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span>{label}</span>
      {S.icon && (
        <span style={{ fontSize: 18, flexShrink: 0, marginLeft: 8, animation: 'iconPop 0.25s cubic-bezier(.34,1.56,.64,1) both' }}>
          {S.icon}
        </span>
      )}
    </button>
  )
}

export default function QuizTab({ userId }) {
  const [phase,      setPhase]      = useState('setup')
  const [level,      setLevel]      = useState('N5')
  const [count,      setCount]      = useState(10)
  const [card,       setCard]       = useState(null)
  const [choices,    setChoices]    = useState([])
  const [selected,   setSelected]   = useState(null)
  const [result,     setResult]     = useState(null)
  const [progress,   setProgress]   = useState({ done: 0, total: 0, correct: 0 })
  const [summary,    setSummary]    = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [cardKey,    setCardKey]    = useState(0)
  const [flashState, setFlashState] = useState(null)
  const [streakAnim, setStreakAnim] = useState(false)

  useEffect(() => {
    if (!result || selected === null) return
    const t = setTimeout(() => {
      setFlashState(null)
      if (result.finished) { setSummary(result.summary); setPhase('complete') }
      else if (result.next_card) {
        setCard(result.next_card); setChoices(result.next_card.choices || [])
        setSelected(null); setResult(null); setCardKey(k => k + 1)
      }
    }, 1400)
    return () => clearTimeout(t)
  }, [result, selected])

  async function startQuiz() {
    setLoading(true)
    try {
      const data = await api.quizStart(userId, level, count)
      setCard(data); setChoices(data.choices || [])
      setProgress({ done: 0, total: data.quiz_total, correct: 0 })
      setSelected(null); setResult(null); setSummary(null)
      setFlashState(null); setCardKey(k => k + 1); setPhase('quiz')
    } catch (e) { alert(e.message) }
    finally { setLoading(false) }
  }

  async function handleChoice(choice) {
    if (selected !== null || loading) return
    setSelected(choice)
    try {
      const data = await api.quizAnswer(userId, choice)
      setResult(data)
      setFlashState(data.correct ? 'correct' : 'wrong')
      setProgress({ done: data.quiz_done, total: data.quiz_total, correct: data.quiz_correct })
      if (data.streak > 1) { setStreakAnim(true); setTimeout(() => setStreakAnim(false), 800) }
    } catch (e) { alert(e.message); setSelected(null) }
  }

  async function stopQuiz() {
    await api.quizStop(userId)
    setPhase('setup'); setCard(null); setChoices([])
    setSelected(null); setResult(null); setFlashState(null)
  }

  function restartSetup() {
    setPhase('setup'); setCard(null); setChoices([])
    setSelected(null); setResult(null); setSummary(null); setFlashState(null)
  }

  function choiceState(choice) {
    if (selected === null || !result) return 'idle'
    if (choice === selected && result.correct)  return 'correct'
    if (choice === selected && !result.correct) return 'wrong'
    if (choice !== selected && choice === result.answer) return 'reveal'
    return 'idle'
  }

  // ── Setup ──
  if (phase === 'setup') return (
    <div className="quiz-setup fade-up">
      <style>{QUIZ_CSS}</style>
      <div className="setup-section">
        <div className="setup-label">Level</div>
        <div className="pill-group">
          {LEVELS.map(l => (
            <button key={String(l)} className={`pill ${level === l ? 'active' : ''}`} onClick={() => setLevel(l)}>
              {LABEL[l]}
            </button>
          ))}
        </div>
      </div>

      <div className="setup-section">
        <div className="setup-label">Number of cards</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
          {COUNTS.map(({ n, label, sub }) => (
            <div key={n} onClick={() => setCount(n)} style={{
              padding: '14px 10px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
              border: `1.5px solid ${count === n ? 'var(--accent,#7C9EF8)' : 'var(--card-border)'}`,
              background: count === n ? 'rgba(124,158,248,0.10)' : 'var(--card-bg)',
              transition: 'all 0.18s', WebkitTapHighlightColor: 'transparent',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--mono)', lineHeight: 1, color: count === n ? 'var(--accent,#7C9EF8)' : 'var(--t1)' }}>{n}</div>
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, fontFamily: 'var(--sans)', color: count === n ? 'var(--accent,#7C9EF8)' : 'var(--t2)' }}>{label}</div>
              <div style={{ fontSize: 10, marginTop: 2, fontFamily: 'var(--mono)', color: 'var(--t3)' }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>

      <button className="btn-primary" onClick={startQuiz} disabled={loading}>
        {loading ? '読み込み中…' : '始める — Start'}
      </button>
    </div>
  )

  // ── Complete ──
  if (phase === 'complete') {
    const s = summary || { correct: progress.correct, total: progress.total, pct: Math.round(progress.correct / progress.total * 100) }
    return (
      <div className="quiz-complete fade-up">
        <style>{QUIZ_CSS}</style>
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
          {s.pct >= 80 ? '🎉 Excellent work! Keep it up!' : s.pct >= 60 ? '💪 Good effort — keep practicing!' : '📚 More practice will get you there!'}
        </div>
        <button className="btn-primary" onClick={restartSetup}>もう一度 — Try again</button>
      </div>
    )
  }

  // ── Active quiz ──
  const pct = progress.total ? (progress.done / progress.total) * 100 : 0

  return (
    <div className="quiz-active">
      <style>{QUIZ_CSS}</style>

      {/* Progress row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="progress-fraction">
          <span style={{ fontWeight: 700 }}>{progress.done + 1}</span>
          <span style={{ color: 'var(--t3)', fontSize: 13 }}> / {progress.total}</span>
        </span>
        {result?.streak > 1 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 20,
            background: 'rgba(248,196,124,0.15)', border: '1px solid rgba(248,196,124,0.35)',
            color: 'var(--gold-l)', fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)',
            animation: streakAnim ? 'streakBounce 0.5s cubic-bezier(.34,1.56,.64,1) both' : 'none',
          }}>
            🔥 {result.streak} streak
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.07)', marginBottom: 18, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 99,
          background: 'linear-gradient(90deg, var(--accent,#7C9EF8), var(--green))',
          boxShadow: '0 0 8px rgba(124,158,248,0.5)',
          transition: 'width 0.4s cubic-bezier(.22,1,.36,1)',
        }} />
      </div>

      {/* Flash card */}
      <div className="flash-card quiz-card-enter" key={cardKey} style={{
        position: 'relative', overflow: 'hidden',
        borderColor: flashState === 'correct' ? 'var(--green)' : flashState === 'wrong' ? 'var(--red)' : 'var(--card-border)',
        background: flashState === 'correct' ? 'rgba(20,169,107,0.08)' : flashState === 'wrong' ? 'rgba(232,64,64,0.08)' : undefined,
        transition: 'background 0.2s, border-color 0.2s',
      }}>
        {/* Full-card overlay flash */}
        {flashState && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 1,
            background: flashState === 'correct' ? 'rgba(20,169,107,0.15)' : 'rgba(232,64,64,0.15)',
            animation: 'flashPulse 1.4s ease-out forwards',
          }} />
        )}
        {/* Result icon */}
        {flashState && (
          <div style={{
            position: 'absolute', top: 12, right: 14, zIndex: 2, fontSize: 22, fontWeight: 900,
            color: flashState === 'correct' ? 'var(--green)' : 'var(--red)',
            animation: 'iconPop 0.3s cubic-bezier(.34,1.56,.64,1) both',
          }}>
            {flashState === 'correct' ? '✓' : '✗'}
          </div>
        )}

        <div className="card-level-row">
          <span className="level-tag">{card?.level ?? '—'}</span>
          <span className="pos-tag">{card?.pos ?? ''}</span>
        </div>

        <div className="kanji-display" style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <span className="kanji-main" style={{ fontSize: 'clamp(44px,12vw,64px)', display: 'block', lineHeight: 1.1 }}>
            {card?.kanji ?? ''}
          </span>
          <span className="kanji-romaji" style={{ opacity: 0.5, fontSize: 14, display: 'block', marginTop: 4 }}>
            {card?.romaji ?? ''}
          </span>
        </div>

        {(card?.example_jp || card?.example_en) && (
          <>
            <div className="card-divider" />
            <div className="example-block">
              {card.example_jp && <p className="example-jp">{card.example_jp}</p>}
              {card.example_en && <p className="example-en">{card.example_en}</p>}
            </div>
          </>
        )}
      </div>

      <div style={{ fontSize: 11, color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10, marginTop: 4, fontFamily: 'var(--mono)' }}>
        Choose the English meaning
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {choices.map(choice => (
          <ChoiceBtn key={choice} label={choice} state={choiceState(choice)}
            onClick={() => handleChoice(choice)} disabled={selected !== null} />
        ))}
      </div>

      {/* Compact feedback strip */}
      {result && selected !== null && (
        <div className="quiz-feedback-enter" style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 10,
          background: result.correct ? 'var(--green-s)' : 'var(--red-s)',
          border: `1px solid ${result.correct ? 'rgba(20,169,107,0.3)' : 'rgba(232,64,64,0.3)'}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: result.correct ? 'var(--green)' : 'var(--red)' }}>
            {result.correct ? '✓' : '✗'}
          </span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: result.correct ? 'var(--green)' : 'var(--red)' }}>
              {result.correct ? 'Correct!' : `Incorrect — ${result.answer}`}
            </div>
            {result.romaji && (
              <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)', marginTop: 1 }}>{result.romaji}</div>
            )}
          </div>
        </div>
      )}

      <button className="btn-stop" style={{ marginTop: 20 }} onClick={stopQuiz}>⏹ Stop quiz</button>
    </div>
  )
}