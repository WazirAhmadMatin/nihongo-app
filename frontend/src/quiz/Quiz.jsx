// Quiz flow:  QuizSetup → QuizQuestion × N → QuizEnd
// (component structure based on caike/React-QuizComponent)
import { useState } from 'react'
import { api } from '../api'
import QuizSetup, { MODES } from './QuizSetup'
import QuizQuestion from './QuizQuestion'
import QuizEnd from './QuizEnd'

export default function Quiz({ defaultLevel = 'N4', presetMissed = false }) {
  const [settings, setSettings] = useState({
    mode: 'meaning', level: defaultLevel, topic: null, missed: presetMissed, count: 10, retry: false,
  })
  const [phase,    setPhase]    = useState('setup')        // setup | question | end
  const [question, setQuestion] = useState(null)
  const [progress, setProgress] = useState({ done: 0, total: 0, correct: 0 })
  const [summary,  setSummary]  = useState(null)
  const [loading,  setLoading]  = useState(false)

  async function start() {
    setLoading(true)
    try {
      const { mode, level, topic, missed, count } = settings
      const q = await api.quizStart({ level, topic: missed ? null : topic, total: count, mode, missed_only: missed })
      setQuestion(q); setSummary(null)
      setProgress({ done: 0, total: q.quiz_total, correct: 0 })
      setPhase('question')
    } catch (e) { alert(e.message) }
    finally { setLoading(false) }
  }

  async function answer(choice) {
    const r = await api.quizAnswer(choice)
    setProgress({ done: r.quiz_done, total: r.quiz_total, correct: r.quiz_correct })
    return r
  }

  function next(r) {
    if (r.finished) { setSummary(r.summary); setPhase('end') }
    else { setQuestion(r.next_card); window.scrollTo(0, 0) }
  }

  async function stop() {
    await api.quizStop().catch(() => {})
    setPhase('setup')
  }

  if (phase === 'setup') return <QuizSetup settings={settings} onChange={setSettings} onStart={start} loading={loading} />
  if (phase === 'end')   return <QuizEnd summary={summary} onAgain={start} onReset={() => setPhase('setup')} />

  const mode = MODES.find(m => m.id === question.mode)
  return (
    <div className="screen">
      <div className="progress" aria-hidden><div style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
      <div className="counter">
        <span>{mode?.label}</span>
        <span>{question.card_number} of {progress.total}</span>
      </div>

      <QuizQuestion key={question.card_number} question={question} onAnswer={answer} onNext={next} retry={settings.retry} />

      <div style={{ marginTop: 28, textAlign: 'center' }}>
        <button className="btn-text btn-danger" onClick={stop}>End quiz</button>
      </div>
    </div>
  )
}
