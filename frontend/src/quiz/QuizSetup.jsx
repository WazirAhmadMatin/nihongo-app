import { useState, useEffect } from 'react'
import { api } from '../api'
import { LEVELS, LEVEL_LABEL, Seg } from '../levels'

export const MODES = [
  { id: 'meaning', label: 'Meaning', desc: 'See the word, choose the English' },
  { id: 'reverse', label: 'Reverse', desc: 'See the English, choose the word' },
  { id: 'reading', label: 'Reading', desc: 'See the kanji, choose the hiragana, like the JLPT' },
  { id: 'cloze',   label: 'Fill in the blank', desc: 'Choose the missing word in a sentence (N4 only for now)' },
]

function Check({ on }) {
  return <span aria-hidden style={{ color: 'var(--accent)', fontWeight: 700, width: 18 }}>{on ? '✓' : ''}</span>
}

export default function QuizSetup({ settings, onChange, onStart, loading }) {
  const { mode, level, topic, missed, count, retry } = settings
  const set = (k, v) => onChange({ ...settings, [k]: v })
  const [topics, setTopics] = useState([])

  useEffect(() => {
    setTopics([])
    if (!level) return
    api.topics(level).then(d => setTopics(d.topics)).catch(() => {})
  }, [level])

  return (
    <div className="screen">
      <h2 className="group-title">Type</h2>
      <div className="group">
        {MODES.map(m => (
          <button key={m.id} className="row" onClick={() => set('mode', m.id)} aria-pressed={mode === m.id}>
            <div className="row-main">
              <div className="row-title">{m.label}</div>
              <div className="row-sub">{m.desc}</div>
            </div>
            <Check on={mode === m.id} />
          </button>
        ))}
      </div>

      <h2 className="group-title">Level</h2>
      <Seg options={LEVELS} value={level} label={l => LEVEL_LABEL[l]}
        onChange={l => onChange({ ...settings, level: l, topic: null })} />

      <h2 className="group-title">Words</h2>
      <div className="group">
        <button className="row" onClick={() => set('missed', false)}>
          <div className="row-main"><div className="row-title">All words</div></div><Check on={!missed} />
        </button>
        <button className="row" onClick={() => set('missed', true)}>
          <div className="row-main">
            <div className="row-title">Only words I've missed</div>
          </div><Check on={missed} />
        </button>
        {topics.length > 0 && !missed && (
          <label className="row">
            <div className="row-main"><div className="row-title">Topic</div></div>
            <select value={topic ?? ''} onChange={e => set('topic', e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">Any topic</option>
              {topics.map(t => <option key={t.topic_no} value={t.topic_no}>{t.topic_ja}（{t.topic_en}）</option>)}
            </select>
          </label>
        )}
      </div>

      <h2 className="group-title">Questions</h2>
      <Seg options={[5, 10, 20]} value={count} onChange={n => set('count', n)} />

      <h2 className="group-title">When I answer wrong</h2>
      <div className="group">
        <button className="row" onClick={() => set('retry', false)}>
          <div className="row-main"><div className="row-title">Show me the answer</div></div><Check on={!retry} />
        </button>
        <button className="row" onClick={() => set('retry', true)}>
          <div className="row-main">
            <div className="row-title">Let me try again</div>
            <div className="row-sub">Only your first answer counts toward your score</div>
          </div><Check on={retry} />
        </button>
      </div>

      <div style={{ marginTop: 24 }}>
        <button className="btn" onClick={onStart} disabled={loading}>{loading ? 'Starting…' : 'Start quiz'}</button>
      </div>
    </div>
  )
}
