import { useState, useEffect, useRef } from 'react'
import { Example, LevelBadge } from '../levels'
import QuizQuestionButton from './QuizQuestionButton'

const JP_CHOICES = new Set(['reverse', 'reading', 'cloze'])
const INSTRUCTION = {
  meaning: 'Choose the English meaning',
  reverse: 'Choose the Japanese word',
  reading: 'Choose the reading',
  cloze:   'Choose the missing word',
}

// What the card asks, per quiz type. `w` (the full word) arrives with the answer.
function Prompt({ q, w }) {
  switch (q.mode) {
    case 'reverse':
      return (
        <div style={{ textAlign: 'center', padding: '14px 0 6px' }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--t1)', fontFamily: 'var(--sans)', lineHeight: 1.35 }}>{q.english}</div>
          {q.hint && <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 4 }}>({q.hint})</div>}
          {w && <Reveal w={w} />}
        </div>
      )
    case 'reading':
      return (
        <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
          <span className="kanji-main" style={{ fontSize: 'clamp(44px,12vw,64px)', display: 'block', lineHeight: 1.15 }}>{q.kanji}</span>
          {w && <div className="quiz-feedback-enter" style={{ fontSize: 14, color: 'var(--t2)', marginTop: 6 }}>{w.english}</div>}
        </div>
      )
    case 'cloze':
      return (
        <div style={{ padding: '14px 2px 4px' }}>
          <p style={{ fontFamily: 'var(--serif-jp)', fontSize: 20, lineHeight: 1.8, color: 'var(--t1)', textAlign: 'center' }}>
            {w ? <Example text={w.example_jp} target={w.example_target} /> : q.sentence}
          </p>
          <p className="example-en" style={{ textAlign: 'center', marginTop: 6 }}>{q.example_en}</p>
          {w && (
            <div className="quiz-feedback-enter" style={{ textAlign: 'center', fontSize: 13, color: 'var(--t2)', marginTop: 6 }}>
              {w.kanji}{w.reading ? `【${w.reading}】` : ''} — {w.english}
            </div>
          )}
        </div>
      )
    default: // meaning
      return (
        <>
          <div className="kanji-display" style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <span className="kanji-main" style={{ fontSize: 'clamp(44px,12vw,64px)', display: 'block', lineHeight: 1.1 }}>{q.kanji}</span>
            {q.reading && <span style={{ fontFamily: 'var(--serif-jp)', fontSize: 16, color: 'var(--t2)', display: 'block', marginTop: 6 }}>{q.reading}</span>}
            <span className="kanji-romaji" style={{ opacity: 0.5, fontSize: 13, display: 'block', marginTop: 2 }}>{q.romaji}</span>
          </div>
          {q.example_jp && (
            <>
              <div className="card-divider" />
              <div className="example-block">
                <p className="example-jp"><Example text={q.example_jp} target={q.example_target} /></p>
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

/**
 * One question.
 *  - onAnswer(choice) → Promise<result>: sends the FIRST answer to the server (that's what counts)
 *  - onNext(result): called when it's time to move on
 *  - retry: "try again until correct" — a wrong pick is crossed out and you choose again
 */
export default function QuizQuestion({ question, onAnswer, onNext, retry }) {
  const [result,  setResult]  = useState(null)     // server result of the first answer
  const [tried,   setTried]   = useState([])       // wrong picks (retry mode)
  const [picked,  setPicked]  = useState(null)     // last pick
  const [solved,  setSolved]  = useState(false)    // done with this question
  const [busy,    setBusy]    = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])   // stopped mid-question: don't move on

  async function handleClick(choice) {
    if (solved || busy || tried.includes(choice)) return
    setPicked(choice)

    // First pick: ask the server
    let r = result
    if (!r) {
      setBusy(true)
      try { r = await onAnswer(choice) } catch { setPicked(null); setBusy(false); return }
      setResult(r)
      setBusy(false)
    }

    const isRight = choice === r.answer
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(isRight ? 'success' : 'error')

    if (isRight || !retry) {
      setSolved(true)
      timer.current = setTimeout(() => onNext(r), isRight && !tried.length ? 1400 : 2800)
    } else {
      setTried(t => [...t, choice])          // "Sorry, that's not right" — try again
    }
  }

  function stateOf(choice) {
    if (tried.includes(choice)) return choice === picked && !solved ? 'wrong' : 'tried'
    if (!solved) return 'idle'
    if (choice === result.answer) return choice === picked ? 'correct' : 'reveal'
    if (choice === picked) return 'wrong'
    return 'idle'
  }

  const firstCorrect = result?.correct
  const flash = solved ? (picked === result.answer ? 'correct' : 'wrong') : (tried.length ? 'wrong' : null)

  return (
    <>
      <div className="flash-card quiz-card-enter" style={{
        position: 'relative', overflow: 'hidden',
        borderColor: flash === 'correct' ? 'var(--green)' : flash === 'wrong' ? 'var(--red)' : 'var(--card-border)',
        background: flash === 'correct' ? 'rgba(20,169,107,0.08)' : flash === 'wrong' ? 'rgba(232,64,64,0.06)' : undefined,
        transition: 'background 0.2s, border-color 0.2s',
      }}>
        <div className="card-level-row">
          <LevelBadge level={question.level} />
          <span className="pos-tag">{[question.pos, question.topic_en].filter(Boolean).join(' · ')}</span>
        </div>
        <div className="card-body">
          <Prompt q={question} w={solved ? result.word : null} />
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10, marginTop: 4, fontFamily: 'var(--mono)' }}>
        {INSTRUCTION[question.mode]}
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {question.choices.map(c => (
          <li key={c}>
            <QuizQuestionButton text={c} state={stateOf(c)} jp={JP_CHOICES.has(question.mode)}
              onClick={handleClick} disabled={solved || busy || tried.includes(c)} />
          </li>
        ))}
      </ul>

      {/* Retry mode: wrong pick, keep going */}
      {!solved && tried.length > 0 && (
        <p className="quiz-feedback-enter" style={{ marginTop: 12, fontSize: 13, color: 'var(--red)', fontFamily: 'var(--sans)', textAlign: 'center' }}>
          Sorry, that's not right. Try again!
        </p>
      )}

      {/* Result */}
      {solved && (
        <div className="quiz-feedback-enter" style={{
          marginTop: 14, padding: '10px 14px', borderRadius: 10,
          background: firstCorrect ? 'var(--green-s)' : 'var(--red-s)',
          border: `1px solid ${firstCorrect ? 'rgba(20,169,107,0.3)' : 'rgba(232,64,64,0.3)'}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: firstCorrect ? 'var(--green)' : 'var(--red)' }}>
            {firstCorrect ? '✓' : '✗'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: firstCorrect ? 'var(--green)' : 'var(--red)' }}>
              {firstCorrect ? 'Correct!' : tried.length && picked === result.answer
                ? `Got it on try ${tried.length + 1} (counts as a miss)`
                : `Answer: ${result.answer}`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--mono)', marginTop: 1 }}>
              {result.word.kanji}
              {result.word.reading ? ` · ${result.word.reading}` : ''}
              {result.word.romaji ? ` · ${result.word.romaji}` : ''}
              {result.word.hint ? `  —  ${result.word.hint}` : ''}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
