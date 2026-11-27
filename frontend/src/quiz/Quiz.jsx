// Quiz flow:  QuizSetup → QuizQuestion × N → QuizEnd
// (structure based on caike/React-QuizComponent: Quiz → QuizQuestion → QuizQuestionButton → QuizEnd)
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
  const [progress, setProgress] = useState({ done: 0, total: 0, correct: 0, streak: 0 })
  const [summary,  setSummary]  = useState(null)
  const [loading,  setLoading]  = useState(false)

  async function start() {
    setLoading(true)
    try {
      const { mode, level, topic, missed, count } = settings
      const q = await api.quizStart({ level, topic: missed ? null : topic, total: count, mode, missed_only: missed })
      setQuestion(q); setSummary(null)
      setProgress({ done: 0, total: q.quiz_total, correct: 0, streak: 0 })
      setPhase('question')
    } catch (e) { alert(e.message) }
    finally { setLoading(false) }
  }

  // First answer to the current question → server (scores it, returns the next card)
  async function answer(choice) {
    const r = await api.quizAnswer(choice)
    setProgress({ done: r.quiz_done, total: r.quiz_total, correct: r.quiz_correct, streak: r.streak })
    return r
  }

  // r = the result of this question's answer (has next_card, or summary at the end)
  function next(r) {
    if (r.finished) { setSummary(r.summary); setPhase('end') }
    else setQuestion(r.next_card)
  }

  async function stop() {
    await api.quizStop().catch(() => {})
    setPhase('setup')
  }

  if (phase === 'setup') {
    return <QuizSetup settings={settings} onChange={setSettings} onStart={start} loading={loading} />
  }
  if (phase === 'end') {
    return <QuizEnd summary={summary} onAgain={start} onReset={() => setPhase('setup')} />
  }

  const mode = MODES.find(m => m.id === question.mode)
  const pct = progress.total ? (progress.done / progress.total) * 100 : 0
  return (
    <div className="quiz-active">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="progress-fraction">
          <span style={{ fontWeight: 700 }}>{question.card_number}</span>
          <span style={{ color: 'var(--t3)', fontSize: 13 }}> / {progress.total}</span>
          <span style={{ color: 'var(--t3)', fontSize: 11, marginLeft: 8 }}>{mode?.icon} {mode?.label}</span>
        </span>
        {progress.streak > 1 && (
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)',
            background: 'rgba(248,196,124,0.15)', border: '1px solid rgba(248,196,124,0.35)', color: 'var(--gold-l)',
          }}>
            🔥 {progress.streak} streak
          </span>
        )}
      </div>

      <div style={{ height: 8, borderRadius: 99, background: 'var(--card-border)', marginBottom: 18, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 99,
          background: 'linear-gradient(90deg, var(--accent), var(--green))',
          transition: 'width 0.4s cubic-bezier(.22,1,.36,1)',
        }} />
      </div>

      <QuizQuestion key={question.card_number} question={question}
        onAnswer={answer} onNext={next} retry={settings.retry} />

      <button className="btn-stop" style={{ marginTop: 20 }} onClick={stop}>⏹ Stop quiz</button>
    </div>
  )
}
