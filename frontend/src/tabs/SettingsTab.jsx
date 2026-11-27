import { useState, useEffect } from 'react'
import { api } from '../api'
import { LEVELS, selectStyle } from '../levels'

const inputStyle = { ...selectStyle, fontFamily: 'var(--sans)' }

function Row({ label, sub, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--card-border)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: 'var(--t1)', fontFamily: 'var(--sans)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ width: 150, flexShrink: 0 }}>{children}</div>
    </div>
  )
}

export default function SettingsTab({ onSaved }) {
  const [u,       setU]       = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [words,   setWords]   = useState([])
  const [form,    setForm]    = useState({ word: '', reading: '', meaning: '' })
  const [err,     setErr]     = useState(null)

  useEffect(() => {
    api.me().then(d => setU(d.user)).catch(e => setErr(e.message))
    api.myWords().then(d => setWords(d.words)).catch(() => {})
  }, [])

  const set = (k, v) => { setU(p => ({ ...p, [k]: v })); setSaved(false) }

  async function save() {
    setSaving(true)
    try {
      const { level, new_per_day, word_time, reminder_time, notify, public_name, exam_date } = u
      await api.saveSettings({ level, new_per_day: Number(new_per_day), word_time, reminder_time,
                               notify: !!notify, public_name: public_name || null, exam_date: exam_date || null })
      setSaved(true)
      onSaved?.()
    } catch (e) { alert(e.message) }
    finally { setSaving(false) }
  }

  async function addWord(e) {
    e.preventDefault()
    try {
      const w = await api.addMyWord(form.word, form.reading, form.meaning)
      setWords(ws => [...ws, w])
      setForm({ word: '', reading: '', meaning: '' })
    } catch (e) { alert(e.message) }
  }

  async function delWord(id) {
    if (!confirm('Delete this word?')) return
    await api.delMyWord(id)
    setWords(ws => ws.filter(w => w.id !== id))
  }

  if (err) return <div className="empty-state"><span className="empty-kanji">？</span><span className="empty-text">{err}</span></div>
  if (!u)  return <div className="empty-state"><span className="empty-kanji">設</span><span className="empty-text">Loading…</span></div>

  return (
    <div className="section-pad fade-up">
      <div className="section-title">Study</div>
      <Row label="My level" sub="New words come from this level">
        <select style={selectStyle} value={u.level} onChange={e => set('level', e.target.value)}>
          {LEVELS.filter(Boolean).map(l => <option key={l}>{l}</option>)}
        </select>
      </Row>
      <Row label="New words per day" sub="Reviews of older words are on top of this">
        <select style={selectStyle} value={u.new_per_day} onChange={e => set('new_per_day', e.target.value)}>
          {[0, 5, 10, 15, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </Row>
      <Row label="Exam date" sub="Shows a countdown">
        <input type="date" style={inputStyle} value={u.exam_date || ''} onChange={e => set('exam_date', e.target.value)} />
      </Row>

      <div className="section-title" style={{ marginTop: 22 }}>Bot messages</div>
      <Row label="Notifications" sub="Word of the day and reminders">
        <select style={selectStyle} value={u.notify ? '1' : '0'} onChange={e => set('notify', e.target.value === '1')}>
          <option value="1">On</option>
          <option value="0">Off</option>
        </select>
      </Row>
      <Row label="Word of the day" sub="A new word in the chat">
        <input type="time" style={inputStyle} value={u.word_time} onChange={e => set('word_time', e.target.value)} />
      </Row>
      <Row label="Review reminder" sub="Only if reviews are waiting">
        <input type="time" style={inputStyle} value={u.reminder_time} onChange={e => set('reminder_time', e.target.value)} />
      </Row>

      <div className="section-title" style={{ marginTop: 22 }}>Leaderboard</div>
      <Row label="Display name" sub="Leave empty to stay hidden">
        <input style={inputStyle} maxLength={24} placeholder="hidden" value={u.public_name || ''}
          onChange={e => set('public_name', e.target.value)} />
      </Row>

      <button className="btn-primary" style={{ marginTop: 18 }} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save settings'}
      </button>

      {/* Personal words */}
      <div className="section-title" style={{ marginTop: 30 }}>★ My words ({words.length})</div>
      <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10 }}>
        Words from class, work or anime. They go straight into your reviews. (You can also send /add to the bot.)
      </div>
      <form onSubmit={addWord} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <input style={inputStyle} placeholder="Word (猫舌)" value={form.word} required
          onChange={e => setForm(f => ({ ...f, word: e.target.value }))} />
        <input style={inputStyle} placeholder="Reading (ねこじた)" value={form.reading}
          onChange={e => setForm(f => ({ ...f, reading: e.target.value }))} />
        <input style={{ ...inputStyle, gridColumn: 'span 2' }} placeholder="Meaning" value={form.meaning} required
          onChange={e => setForm(f => ({ ...f, meaning: e.target.value }))} />
        <button className="btn-ghost" type="submit" style={{ gridColumn: 'span 2' }}>＋ Add word</button>
      </form>
      {words.map(w => (
        <div key={w.id} className="word-item">
          <div className="word-kanji-col" style={{ flex: 1 }}>
            <span className="word-kanji">{w.kanji}</span>
            {w.reading && <span className="word-romaji">{w.reading}</span>}
          </div>
          <span className="word-english" style={{ textAlign: 'right' }}>{w.english}</span>
          <button onClick={() => delWord(w.id)} aria-label="Delete"
            style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
      ))}
    </div>
  )
}
