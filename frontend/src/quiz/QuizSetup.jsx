import { useState, useEffect } from 'react'
import { api } from '../api'
import { LEVELS, LEVEL_LABEL, selectStyle } from '../levels'

export const MODES = [
  { id: 'meaning', icon: '🈯', label: 'Meaning', desc: 'See the word, pick the English' },
  { id: 'reverse', icon: '🔁', label: 'Reverse', desc: 'See the English, pick the word' },
  { id: 'reading', icon: '🔤', label: 'Reading', desc: 'See kanji, pick the hiragana (like the JLPT)' },
  { id: 'cloze',   icon: '✏️', label: 'Fill in', desc: 'Complete the sentence (N4)' },
]

const COUNTS = [
  { n: 5,  label: 'Quick',     sub: '~2 min' },
  { n: 10, label: 'Standard',  sub: '~5 min' },
  { n: 20, label: 'Deep dive', sub: '~10 min' },
]

const card = active => ({
  padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--card-border)'}`,
  background: active ? 'rgba(79,110,247,0.08)' : 'var(--card-bg)',
  transition: 'all 0.18s', WebkitTapHighlightColor: 'transparent',
})

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
    <div className="quiz-setup fade-up">
      <div className="setup-section">
        <div className="setup-label">Quiz type</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
          {MODES.map(m => (
            <div key={m.id} onClick={() => set('mode', m.id)} style={card(mode === m.id)}>
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
            <button key={String(l)} className={`pill ${level === l ? 'active' : ''}`}
              onClick={() => onChange({ ...settings, level: l, topic: null })}>
              {LEVEL_LABEL[l]}
            </button>
          ))}
        </div>
      </div>

      <div className="setup-section">
        <div className="setup-label">Words</div>
        <div className="pill-group" style={{ marginBottom: topics.length && !missed ? 10 : 0 }}>
          <button className={`pill ${!missed ? 'active' : ''}`} onClick={() => set('missed', false)}>All words</button>
          <button className={`pill ${missed ? 'active' : ''}`} onClick={() => set('missed', true)}>❌ Words I missed</button>
        </div>
        {topics.length > 0 && !missed && (
          <select value={topic ?? ''} style={selectStyle}
            onChange={e => set('topic', e.target.value === '' ? null : Number(e.target.value))}>
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
        <div className="setup-label">When I get one wrong</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
          <div onClick={() => set('retry', false)} style={card(!retry)}>
            <div style={{ fontSize: 13, fontWeight: 600, color: !retry ? 'var(--accent)' : 'var(--t1)' }}>Show the answer</div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>Test mode</div>
          </div>
          <div onClick={() => set('retry', true)} style={card(retry)}>
            <div style={{ fontSize: 13, fontWeight: 600, color: retry ? 'var(--accent)' : 'var(--t1)' }}>Let me try again</div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>Practice until right</div>
          </div>
        </div>
      </div>

      <div className="setup-section">
        <div className="setup-label">Number of cards</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 9 }}>
          {COUNTS.map(({ n, label, sub }) => (
            <div key={n} onClick={() => set('count', n)} style={{ ...card(count === n), padding: '14px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--mono)', lineHeight: 1, color: count === n ? 'var(--accent)' : 'var(--t1)' }}>{n}</div>
              <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, fontFamily: 'var(--sans)', color: count === n ? 'var(--accent)' : 'var(--t2)' }}>{label}</div>
              <div style={{ fontSize: 10, marginTop: 2, fontFamily: 'var(--mono)', color: 'var(--t3)' }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>

      <button className="btn-primary" onClick={onStart} disabled={loading}>
        {loading ? '読み込み中…' : '始める — Start'}
      </button>
    </div>
  )
}
