import { useState, useEffect } from 'react'
import { api } from '../api'
import { LEVELS } from '../levels'

export default function SettingsTab({ onSaved }) {
  const [u,      setU]      = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [words,  setWords]  = useState([])
  const [form,   setForm]   = useState({ word: '', reading: '', meaning: '' })
  const [err,    setErr]    = useState(null)

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

  async function delWord(w) {
    if (!confirm(`Delete ${w.kanji}?`)) return
    await api.delMyWord(w.id)
    setWords(ws => ws.filter(x => x.id !== w.id))
  }

  if (err) return <div className="empty">Couldn't load your settings: {err}</div>
  if (!u)  return <div className="empty">Loading…</div>

  return (
    <div className="screen">
      <h2 className="group-title">Study</h2>
      <div className="group">
        <label className="row">
          <div className="row-main"><div className="row-title">My level</div><div className="row-sub">New words come from this level</div></div>
          <select value={u.level} onChange={e => set('level', e.target.value)}>
            {LEVELS.filter(Boolean).map(l => <option key={l}>{l}</option>)}
          </select>
        </label>
        <label className="row">
          <div className="row-main"><div className="row-title">New words per day</div></div>
          <select value={u.new_per_day} onChange={e => set('new_per_day', e.target.value)}>
            {[0, 5, 10, 15, 20, 30, 50].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="row">
          <div className="row-main"><div className="row-title">JLPT date</div></div>
          <input type="date" value={u.exam_date || ''} onChange={e => set('exam_date', e.target.value)} />
        </label>
      </div>

      <h2 className="group-title">Messages from the bot</h2>
      <div className="group">
        <label className="row">
          <div className="row-main"><div className="row-title">Send messages</div></div>
          <input type="checkbox" checked={!!u.notify} onChange={e => set('notify', e.target.checked)}
            style={{ width: 22, height: 22, accentColor: 'var(--accent)' }} />
        </label>
        <label className="row">
          <div className="row-main"><div className="row-title">Word of the day</div></div>
          <input type="time" value={u.word_time} onChange={e => set('word_time', e.target.value)} />
        </label>
        <label className="row">
          <div className="row-main"><div className="row-title">Review reminder</div><div className="row-sub">Only sent when reviews are waiting</div></div>
          <input type="time" value={u.reminder_time} onChange={e => set('reminder_time', e.target.value)} />
        </label>
      </div>

      <h2 className="group-title">Weekly ranking</h2>
      <div className="group">
        <label className="row">
          <div className="row-main"><div className="row-title">Display name</div></div>
          <input type="text" maxLength={24} placeholder="Hidden" value={u.public_name || ''}
            onChange={e => set('public_name', e.target.value)} />
        </label>
      </div>
      <p className="note">Leave it empty to stay out of the ranking.</p>

      <div style={{ marginTop: 20 }}>
        <button className="btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : saved ? 'Saved' : 'Save settings'}</button>
      </div>

      <h2 className="group-title" style={{ marginTop: 32 }}>My words</h2>
      <form onSubmit={addWord} className="group">
        <label className="row"><div className="row-main"><div className="row-title">Word</div></div>
          <input type="text" placeholder="猫舌" value={form.word} required className="jp"
            onChange={e => setForm(f => ({ ...f, word: e.target.value }))} /></label>
        <label className="row"><div className="row-main"><div className="row-title">Reading</div></div>
          <input type="text" placeholder="ねこじた" value={form.reading} className="jp"
            onChange={e => setForm(f => ({ ...f, reading: e.target.value }))} /></label>
        <label className="row"><div className="row-main"><div className="row-title">Meaning</div></div>
          <input type="text" placeholder="can't handle hot food" value={form.meaning} required
            onChange={e => setForm(f => ({ ...f, meaning: e.target.value }))} /></label>
        <button className="row" type="submit"><div className="row-main"><div className="row-title" style={{ color: 'var(--link)' }}>Add word</div></div></button>
      </form>
      <p className="note">Words from class, work or anime. They go straight into your reviews.</p>

      {words.length > 0 && (
        <div className="group" style={{ marginTop: 12 }}>
          {words.map(w => (
            <div className="row" key={w.id}>
              <span className="jp" style={{ fontSize: 19, fontWeight: 600 }}>{w.kanji}</span>
              <div className="row-main"><div className="row-sub" style={{ marginTop: 0 }}>{w.reading ? `${w.reading}: ` : ''}{w.english}</div></div>
              <button className="btn-text btn-danger" onClick={() => delWord(w)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
