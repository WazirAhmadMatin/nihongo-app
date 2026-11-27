import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { LEVELS, LEVEL_LABEL, Example, LevelTag, Seg } from '../levels'

const PAGE_SIZE = 50
const FILTERS = [...LEVELS, 'MY']

function WordRow({ w, open, onToggle }) {
  const [inReviews, setInReviews] = useState(w.in_reviews)
  async function addToReviews(e) {
    e.stopPropagation()
    try { await api.addReview(w.id); setInReviews(true) } catch (err) { alert(err.message) }
  }
  return (
    <div className="row" onClick={onToggle} style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="jp" style={{ fontSize: 19, fontWeight: 600 }}>{w.kanji}</span>
          {w.reading && <span className="jp muted" style={{ fontSize: 14, marginLeft: 8 }}>{w.reading}</span>}
        </div>
        <div className="muted" style={{ fontSize: 14, textAlign: 'right', maxWidth: '45%',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: open ? 'normal' : 'nowrap' }}>
          {w.english}
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 10 }}>
          {w.hint && <p className="row-sub">{w.hint}</p>}
          {w.example_jp && (
            <>
              <p className="example-jp" style={{ fontSize: 16 }}><Example text={w.example_jp} target={w.example_target} /></p>
              <p className="example-en">{w.example_en}</p>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span className="row-sub"><LevelTag level={w.level} />{w.topic_en ? `  ${w.topic_ja ? `${w.topic_ja}（${w.topic_en}）` : w.topic_en}` : ''}</span>
            <button className="btn-text" onClick={addToReviews} disabled={inReviews}
              style={{ color: inReviews ? 'var(--hint)' : undefined }}>
              {inReviews ? 'In your reviews' : 'Add to reviews'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function WordsTab() {
  const [words,   setWords]   = useState([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [more,    setMore]    = useState(false)
  const [level,   setLevel]   = useState(null)
  const [topics,  setTopics]  = useState([])
  const [topic,   setTopic]   = useState(null)
  const [search,  setSearch]  = useState('')
  const [openId,  setOpenId]  = useState(null)
  const [error,   setError]   = useState(null)
  const debounce = useRef(null)
  const reqId    = useRef(0)

  useEffect(() => {
    setTopic(null); setTopics([])
    if (!level || level === 'MY') return
    api.topics(level).then(d => setTopics(d.topics)).catch(() => {})
  }, [level])

  async function load(offset = 0) {
    const id = ++reqId.current
    offset === 0 ? setLoading(true) : setMore(true)
    try {
      const data = await api.words({ level, topic, search, limit: PAGE_SIZE, offset })
      if (id !== reqId.current) return
      setWords(prev => offset === 0 ? data.words : [...prev, ...data.words])
      setTotal(data.total); setError(null)
    } catch (e) { if (id === reqId.current) setError(e.message) }
    finally { if (id === reqId.current) { setLoading(false); setMore(false) } }
  }

  useEffect(() => {
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => { setOpenId(null); load(0) }, 250)
  }, [level, topic, search])

  return (
    <div className="screen">
      <input className="search" type="search" placeholder="財布, さいふ, saifu or wallet"
        value={search} onChange={e => setSearch(e.target.value)} autoCorrect="off" spellCheck={false}
        aria-label="Search words" />

      <div style={{ marginTop: 12 }}>
        <Seg options={FILTERS} value={level} onChange={setLevel} label={l => LEVEL_LABEL[l]} />
      </div>

      {topics.length > 0 && (
        <div className="group" style={{ marginTop: 12 }}>
          <label className="row">
            <div className="row-main"><div className="row-title">Topic</div></div>
            <select value={topic ?? ''} onChange={e => setTopic(e.target.value === '' ? null : Number(e.target.value))}>
              <option value="">Any topic</option>
              {topics.map(t => <option key={t.topic_no} value={t.topic_no}>{t.topic_ja}（{t.topic_en}）</option>)}
            </select>
          </label>
        </div>
      )}

      <p className="group-title">{loading ? 'Loading…' : error ? `Couldn't load words: ${error}` : `${total.toLocaleString()} ${total === 1 ? 'word' : 'words'}. Tap one for its example.`}</p>

      {!loading && !error && words.length === 0 && (
        <div className="empty">
          {level === 'MY' ? 'No words of your own yet. Add them in Settings, or send /add to the bot.' : 'No word matches that. Try the reading in hiragana or the English meaning.'}
        </div>
      )}

      {words.length > 0 && (
        <div className="group">
          {words.map(w => (
            <WordRow key={w.id} w={w} open={openId === w.id} onToggle={() => setOpenId(openId === w.id ? null : w.id)} />
          ))}
        </div>
      )}

      {words.length < total && !loading && (
        <button className="btn-plain" style={{ marginTop: 12 }} onClick={() => load(words.length)} disabled={more}>
          {more ? 'Loading…' : `Show more (${(total - words.length).toLocaleString()} left)`}
        </button>
      )}
    </div>
  )
}
