import { useState, useEffect, useRef } from 'react'
import { Example, LevelTag, wordSize } from '../levels'
import QuizQuestionButton from './QuizQuestionButton'

const JP_CHOICES = new Set(['reverse', 'reading', 'cloze'])
const ASK = {
  meaning: 'What does it mean?',
  reverse: 'Which word is it?',
  reading: 'How is it read?',
  cloze:   'Which word fills the blank?',
}

// The card's question, per quiz type. `w` (the full word) arrives with the answer.
function Prompt({ q, w }) {
  switch (q.mode) {
    case 'reverse':
      return (
        <>
          <div className="tango-meaning" style={{ fontSize: 22, marginTop: 22 }}>{q.english}</div>
          {q.hint && <div className="tango-hint">{q.hint}</div>}
          {w && <><div className="tango-word" style={{ fontSize: Math.min(40, wordSize(w.kanji)) }}>{w.kanji}</div>
            {w.reading && <div className="tango-reading">{w.reading}</div>}</>}
        </>
      )
    case 'reading':
      return (
        <>
          <div className="tango-word" style={{ fontSize: wordSize(q.kanji) }}>{q.kanji}</div>
          {w && <div className="tango-meaning">{w.english}</div>}
        </>
      )
    case 'cloze':
      return (
        <>
          <p className="example-jp" style={{ fontSize: 22, textAlign: 'center', marginTop: 20 }}>
            {w ? <Example text={w.example_jp} target={w.example_target} /> : q.sentence}
          </p>
          <p className="example-en" style={{ textAlign: 'center' }}>{q.example_en}</p>
          {w && <div className="tango-hint" style={{ marginTop: 8 }}>{w.kanji}{w.reading ? `（${w.reading}）` : ''}: {w.english}</div>}
        </>
      )
    default: // meaning
      return (
        <>
          <div className="tango-word" style={{ fontSize: wordSize(q.kanji) }}>{q.kanji}</div>
          {q.reading && <div className="tango-reading">{q.reading}</div>}
          {w && <div className="tango-meaning">{w.english}</div>}
          {q.example_jp && (
            <>
              <hr className="tango-rule" />
              <p className="example-jp"><Example text={q.example_jp} target={q.example_target} /></p>
              {/* Translation only after answering, so it can't give the answer away */}
              {w?.example_en && <p className="example-en">{w.example_en}</p>}
            </>
          )}
        </>
      )
  }
}

/**
 * One question.
 *  - onAnswer(choice) → Promise<result>: sends the FIRST answer to the server (that's what counts)
 *  - onNext(result): called when it's time to move on
 *  - retry: "let me try again": a wrong pick is crossed out and you choose again
 */
export default function QuizQuestion({ question, onAnswer, onNext, retry }) {
  const [result, setResult] = useState(null)
  const [tried,  setTried]  = useState([])
  const [picked, setPicked] = useState(null)
  const [solved, setSolved] = useState(false)
  const [busy,   setBusy]   = useState(false)
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])   // stopped mid-question: don't move on

  async function handleClick(choice) {
    if (solved || busy || tried.includes(choice)) return
    setPicked(choice)
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
      timer.current = setTimeout(() => onNext(r), isRight && !tried.length ? 1300 : 2800)
    } else {
      setTried(t => [...t, choice])
    }
  }

  function stateOf(choice) {
    if (tried.includes(choice)) return choice === picked && !solved ? 'wrong' : 'tried'
    if (!solved) return 'idle'
    if (choice === result.answer) return choice === picked ? 'correct' : 'reveal'
    if (choice === picked) return 'wrong'
    return 'idle'
  }

  let feedback = null
  if (!solved && tried.length) feedback = <><b className="no">Not that one.</b> Try again.</>
  else if (solved) {
    const w = result.word
    const detail = [w.reading, w.romaji].filter(Boolean).join(', ')
    feedback = result.correct
      ? <><b className="ok">Right.</b> {w.kanji}{detail ? ` (${detail})` : ''}</>
      : tried.length && picked === result.answer
        ? <><b className="no">Got it on try {tried.length + 1}.</b> It still counts as a miss.</>
        : <><b className="no">The answer is {result.answer}.</b> {w.kanji}{detail ? ` (${detail})` : ''}</>
  }

  return (
    <>
      <div className="tango">
        <div className="tango-meta"><span className="muted" style={{ fontSize: 12 }}>{question.topic_en}</span><LevelTag level={question.level} /></div>
        <Prompt q={question} w={solved ? result.word : null} />
      </div>

      <h2 className="group-title" style={{ marginTop: 0 }}>{ASK[question.mode]}</h2>
      <div className="group">
        {question.choices.map(c => (
          <QuizQuestionButton key={c} text={c} state={stateOf(c)} jp={JP_CHOICES.has(question.mode)}
            onClick={handleClick} disabled={solved || busy || tried.includes(c)} />
        ))}
      </div>
      {feedback && <p className="feedback" role="status">{feedback}</p>}
    </>
  )
}
