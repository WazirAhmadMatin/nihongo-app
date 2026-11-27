import { useState, useEffect } from 'react'
import { api } from '../api'
import { LEVELS, LEVEL_LABEL as LABEL, Example, LevelBadge, SpeakButton, speak, selectStyle } from '../levels'

const COUNTS = [
  { n: 5,  label: 'Quick',     sub: '~2 min' },
  { n: 10, label: 'Standard',  sub: '~5 min' },
  { n: 20, label: 'Deep dive', sub: '~10 min' },
]

export const MODES = [
  { id: 'meaning',   icon: '🈯', label: 'Meaning',   desc: 'See the word, pick the English' },
  { id: 'reverse',   icon: '🔁', label: 'Reverse',   desc: 'See the English, pick the word' },
  { id: 'reading',   icon: '🔤', label: 'Reading',   desc: 'See kanji, pick the hiragana (like the JLPT)' },
  { id: 'cloze',     icon: '✏️', label: 'Fill in',   desc: 'Complete the sentence (N4)' },
  { id: 'listening', icon: '🎧', label: 'Listening', desc: 'Hear the word, pick the meaning' },
]
const JP_CHOICES = new Set(['reverse', 'reading', 'cloze'])

const QUIZ_CSS = `
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
`

function ChoiceBtn({ label, state, onClick, disabled, jp }) {
  const S = {
    idle:    { border: '1.5px solid var(--card-border)', bg: 'var(--card-bg)',       color: 'var(--t2)',    icon: null },
    correct: { border: '1.5px solid var(--green)',       bg: 'var(--green-s)',        color: 'var(--green)', icon: '✓' },
    wrong:   { border: '1.5px solid var(--red)',         bg: 'var(--red-s)',          color: 'var(--red)',   icon: '✗' },
    reveal:  { border: '1.5px solid var(--green)',       bg: 'rgba(20,169,107,0.06)', color: 'var(--green)', icon: '✓' },
  }[state]

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', padding: jp ? '12px 16px' : '13px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        border: S.border, borderRadius: 10, background: S.bg, color: S.color,
        fontSize: jp ? 19 : 15, fontFamily: jp ? 'var(--serif-jp)' : 'var(--sans)',
        fontWeight: state === 'idle' ? 400 : 600,
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left', lineHeight: 1.4,
        transition: 'background 0.18s, border-color 0.18s, color 0.18s, transform 0.12s',
        transform: state !== 'idle' ? 'scale(1.01)' : 'scale(1)',
        WebkitTapHighlightColor: 'transparent',
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

// The question part of the card, per mode
function Prompt({ card, result }) {
  const w = result?.word
  switch (card.mode) {
    case 'reverse':
      return (
        <div style={{ textAlign: 'center', padding: '14px 0 6px' }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--t1)', fontFamily: 'var(--sans)', lineHeight: 1.35 }}>
            {card.english}
          </div>
          {card.hint && <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>({card.hint})</div>}
          {w && <Reveal w={w} />}
        </div>
      )
    case 'reading':
      return (
        <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
          <span className="kanji-main" style={{ fontSize: 'clamp(44px,12vw,64px)', display: 'block', lineHeight: 1.15 }}>{card.kanji}</span>
          {w && <div className="quiz-feedback-enter" style={{ fontSize: 14, color: 'var(--t2)', marginTop: 6 }}>{w.english}</div>}
        </div>
      )
    case 'cloze':
      return (
        <div style={{ padding: '14px 2px 4px' }}>
          <p style={{ fontFamily: 'var(--serif-jp)', fontSize: 20, lineHeight: 1.8, color: 'var(--t1)', textAlign: 'center' }}>
            {w ? <Example text={w.example_jp} target={w.example_target} /> : card.sentence}
          </p>
          <p className="example-en" style={{ textAlign: 'center', marginTop: 6 }}>{card.example_en}</p>
          {w && <div className="quiz-feedback-enter" style={{ textAlign: 'center', fontSize: 13, color: 'var(--t2)', marginTop: 6 }}>
            {w.kanji}{w.reading ? `【${w.reading}】` : ''} — {w.english}</div>}
        </div>
      )
    case 'listening':
      return (
        <div style={{ textAlign: 'center', padding: '14px 0 6px' }}>
          <SpeakButton text={card.speak} audioUrl={card.audio_url} size={72} title="Play again" />
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8, fontFamily: 'var(--mono)' }}>TAP TO HEAR AGAIN</div>
          {w && <Reveal w={w} />}
        </div>
      )
    default: // meaning
      return (
        <>
          <div className="kanji-display" style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <span className="kanji-main" style={{ fontSize: 'clamp(44px,12vw,64px)', display: 'block', lineHeight: 1.1 }}>
              {card.kanji}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 }}>
              {card.reading && <span style={{ fontFamily: 'var(--serif-jp)', fontSize: 16, color: 'var(--t2)' }}>{card.reading}</span>}
              <SpeakButton text={card.reading || card.kanji} size={26} />
            </div>
            <span className="kanji-romaji" style={{ opacity: 0.5, fontSize: 13, display: 'block', marginTop: 2 }}>{card.romaji}</span>
          </div>
          {card.example_jp && (
            <>
              <div className="card-divider" />
              <div className="example-block">
                <p className="example-jp"><Example text={card.example_jp} target={card.example_target} /></p>
                {/* Translation only after answering, so it can't give the answer away */}
                {w?.example_en && <p className="example-en quiz-feedback-enter">{w.example_en}</p>}
              </div>
            </>
          )}
        </>
      )
  }
}

function Reveal({ w }) {
  return (
    <div className="quiz-feedback-enter" style={{ marginTop: 10 }}>
      <div style={{ fontFamily: 'var(--serif-jp)', fontSize: 30, color: 'var(--t1)' }}>{w.kanji}</div>
      <div style={{ fontSize: 13, color: 'var(--t2)' }}>
        {[w.reading, w.romaji].filter(Boolean).join(' · ')}{w.english ? ` — ${w.english}` : ''}
      </div>
    </div>
  )
}

export default function QuizTab({ defaultLevel = 'N4', presetMissed = false }) {
  const [phase,      setPhase]      = useState('setup')
  const [level,      setLevel]      = useState(defaultLevel)
  const [mode,       setMode]       = useState('meaning')
  const [count,      setCount]      = useState(10)
  const [topics,     setTopics]     = useState([])
  const [topic,      setTopic]      = useState(null)
  const [missed,     setMissed]     = useState(presetMissed)
  const [card,       setCard]       = useState(null)
  const [selected,   setSelected]   = useState(null)
  const [result,     setResult]     = useState(null)
  const [progress,   setProgress]   = useState({ done: 0, total: 0, correct: 0 })
  const [summary,    setSummary]    = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [cardKey,    setCardKey]    = useState(0)
  const [streakAnim, setStreakAnim] = useState(false)

  useEffect(() => { setLevel(defaultLevel) }, [defaultLevel])

  // Topics for the chosen level
  useEffect(() => {
    setTopic(null); setTopics([])
    if (!level) return
    api.topics(level).then(d => setTopics(d.topics)).catch(() => {})
  }, [level])

  // Listening: play the word when the card appears
  useEffect(() => {
    if (phase === 'quiz' && card?.mode === 'listening') speak(card.speak, card.audio_url)
  }, [cardKey])

  // Move to the next card after showing the result
  useEffect(() => {
    if (!result || selected === null) return
    const t = setTimeout(() => {
      if (result.finished) { setSummary(result.summary); setPhase('complete') }
      else if (result.next_card) {
        setCard(result.next_card)
        setSelected(null); setResult(null); setCardKey(k => k + 1)
      }
    }, result.correct ? 1600 : 3000)
    return () => clearTimeout(t)
  }, [result, selected])

  async function startQuiz() {
    setLoading(true)
    try {
      const data = await api.quizStart({ level, topic: missed ? null : topic, total: count, mode, missed_only: missed })
      setCard(data)
      setProgress({ done: 0, total: data.quiz_total, correct: 0 })
      setSelected(null); setResult(null); setSummary(null)
      setCardKey(k => k + 1); setPhase('quiz')
    } catch (e) { alert(e.message) }
    finally { setLoading(false) }
  }

  async function handleChoice(choice) {
    if (selected !== null) return
    setSelected(choice)
    try {
      const data = await api.quizAnswer(choice)
      setResult(data)
      setProgress({ done: data.quiz_done, total: data.quiz_total, correct: data.quiz_correct })
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(data.correct ? 'success' : 'error')
      if (data.streak > 1) { setStreakAnim(true); setTimeout(() => setStreakAnim(false), 800) }
      if (!data.correct || card.mode === 'reading') speak(data.word.speak, data.word.audio_url)
    } catch (e) { alert(e.message); setSelected(null) }
  }

  async function stopQuiz() {
    await api.quizStop().catch(() => {})
    restartSetup()
  }

  function restartSetup() {
    setPhase('setup'); setCard(null)
    setSelected(null); setResult(null); setSummary(null)
  }

  function choiceState(choice) {
    if (selected === null || !result) return 'idle'
    if (choice === selected && result.correct)  return 'correct'
    if (choice === selected && !result.correct) return 'wrong'
    if (choice === result.answer) return 'reveal'
    return 'idle'
  }

  // ── Setup ──
  if (phase === 'setup') return (
    <div className="quiz-setup fade-up">
      <style>{QUIZ_CSS}</style>

      <div className="setup-section">
        <div className="setup-label">Quiz type</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
          {MODES.map(m => (
            <div key={m.id} onClick={() => setMode(m.id)} style={{
              padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
              border: `1.5px solid ${mode === m.id ? 'var(--accent)' : 'var(--card-border)'}`,
              background: mode === m.id ? 'rgba(79,110,247,0.08)' : 'var(--card-bg)',
              gridColumn: m.id === 'listening' ? 'span 2' : undefined,
              WebkitTapHighlightColor: 'transparent',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: mode === m.id ? 'var(--accent)' : 'var(--t1)', fontFamily: 'var(--sans)' }}>
                {m.icon} {m.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2, lineHeight: 1.35 }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </div>

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
        <div className="setup-label">Words</div>
        <div className="pill-group" style={{ marginBottom: topics.length && !missed ? 10 : 0 }}>
          <button className={`pill ${!missed ? 'active' : ''}`} onClick={() => setMissed(false)}>All words</button>
          <button className={`pill ${missed ? 'active' : ''}`} onClick={() => setMissed(true)}>❌ Words I missed</button>
        </div>
        {topics.length > 0 && !missed && (
          <select value={topic ?? ''} style={selectStyle}
            onChange={e => setTopic(e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">All topics</option>
            {topics.map(t => (
              <option key={t.topic_no} value={t.topic_no}>
                {t.topic_no}. {t.topic_ja} — {t.topic_en} ({t.count})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="setup-section">
        <div className="setup-label">Number of cards</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
          {COUNTS.map(({ n, label, sub }) => (
            <div key={n} onClick={() => setCount(n)} style={{
              padding: '14px 10px', borderRadius: 12, cursor: 'pointer', textAlign: 'center',
              border: `1.5px solid ${count === n ? 'var(--accent)' : 'var(--card-border)'}`,
              background: count === n ? 'rgba(79,110,247,0.08)' : 'var(--card-bg)',
              transition: 'all 0.18s', WebkitTapHighlightColor: 'transparent',
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--mono)', lineHeight: 1, color: count === n ? 'var(--accent)' : 'var(--t1)' }}>{n}</div>
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, fontFamily: 'var(--sans)', color: count === n ? 'var(--accent)' : 'var(--t2)' }}>{label}</div>
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
        <button className="btn-primary" onClick={startQuiz} style={{ marginBottom: 10 }}>もう一度 — Same again</button>
        <button className="btn-ghost" style={{ width: '100%' }} onClick={restartSetup}>Change settings</button>
      </div>
    )
  }

  // ── Active quiz ──
  const pct = progress.total ? (progress.done / progress.total) * 100 : 0
  const flash = result ? (result.correct ? 'correct' : 'wrong') : null
  const modeInfo = MODES.find(m => m.id === card?.mode)
  const instruction = {
    meaning: 'Choose the English meaning', listening: 'Choose the meaning',
    reverse: 'Choose the Japanese word', reading: 'Choose the reading', cloze: 'Choose the missing word',
  }[card?.mode]

  return (
    <div className="quiz-active">
      <style>{QUIZ_CSS}</style>

      {/* Progress row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="progress-fraction">
          <span style={{ fontWeight: 700 }}>{Math.min(progress.done + (result ? 0 : 1), progress.total)}</span>
          <span style={{ color: 'var(--t3)', fontSize: 13 }}> / {progress.total}</span>
          <span style={{ color: 'var(--t3)', fontSize: 11, marginLeft: 8 }}>{modeInfo?.icon} {modeInfo?.label}</span>
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
      <div style={{ height: 8, borderRadius: 99, background: 'var(--card-border)', marginBottom: 18, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 99,
          background: 'linear-gradient(90deg, var(--accent), var(--green))',
          transition: 'width 0.4s cubic-bezier(.22,1,.36,1)',
        }} />
      </div>

      {/* Card */}
      <div className="flash-card quiz-card-enter" key={cardKey} style={{
        position: 'relative', overflow: 'hidden',
        borderColor: flash === 'correct' ? 'var(--green)' : flash === 'wrong' ? 'var(--red)' : 'var(--card-border)',
        background: flash === 'correct' ? 'rgba(20,169,107,0.08)' : flash === 'wrong' ? 'rgba(232,64,64,0.08)' : undefined,
        transition: 'background 0.2s, border-color 0.2s',
      }}>
        {flash && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none', zIndex: 1,
            background: flash === 'correct' ? 'rgba(20,169,107,0.15)' : 'rgba(232,64,64,0.15)',
            animation: 'flashPulse 1.4s ease-out forwards',
          }} />
        )}
        {flash && (
          <div style={{
            position: 'absolute', top: 12, right: 14, zIndex: 2, fontSize: 22, fontWeight: 900,
            color: flash === 'correct' ? 'var(--green)' : 'var(--red)',
            animation: 'iconPop 0.3s cubic-bezier(.34,1.56,.64,1) both',
          }}>
            {flash === 'correct' ? '✓' : '✗'}
          </div>
        )}

        <div className="card-level-row">
          <LevelBadge level={card?.level} />
          <span className="pos-tag">{[card?.pos, card?.topic_en].filter(Boolean).join(' · ')}</span>
        </div>

        {card && <div className="card-body"><Prompt card={card} result={result} /></div>}
      </div>

      <div style={{ fontSize: 11, color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10, marginTop: 4, fontFamily: 'var(--mono)' }}>
        {instruction}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {card?.choices.map(choice => (
          <ChoiceBtn key={choice} label={choice} state={choiceState(choice)} jp={JP_CHOICES.has(card.mode)}
            onClick={() => handleChoice(choice)} disabled={selected !== null} />
        ))}
      </div>

      {/* Feedback strip */}
      {result && (
        <div className="quiz-feedback-enter" style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 10,
          background: result.correct ? 'var(--green-s)' : 'var(--red-s)',
          border: `1px solid ${result.correct ? 'rgba(20,169,107,0.3)' : 'rgba(232,64,64,0.3)'}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: result.correct ? 'var(--green)' : 'var(--red)' }}>
            {result.correct ? '✓' : '✗'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: result.correct ? 'var(--green)' : 'var(--red)' }}>
              {result.correct ? 'Correct!' : `Answer: ${result.answer}`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)', marginTop: 1 }}>
              {result.word.kanji}
              {result.word.reading ? ` · ${result.word.reading}` : ''}
              {result.word.romaji ? ` · ${result.word.romaji}` : ''}
              {result.word.hint ? `  —  ${result.word.hint}` : ''}
            </div>
          </div>
          <SpeakButton text={result.word.speak} audioUrl={result.word.audio_url} size={28} />
        </div>
      )}

      <button className="btn-stop" style={{ marginTop: 20 }} onClick={stopQuiz}>⏹ Stop quiz</button>
    </div>
  )
}
