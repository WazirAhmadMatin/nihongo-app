import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { LEVELS, LEVEL_LABEL, Example, LevelBadge } from '../levels'

const PAGE_SIZE = 50
const FILTERS = [...LEVELS, 'MY']

function WordRow({ w, open, onToggle }) {
  const [inReviews, setInReviews] = useState(w.in_reviews)
  async function addToReviews(e) {
    e.stopPropagation()
    try { await api.addReview(w.id); setInReviews(true) } catch (err) { alert(err.message) }
  }
  return (
    <div className="word-item" onClick={onToggle}
      style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'pointer', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <LevelBadge level={w.level} />

        <div className="word-kanji-col" style={{ flex: 1, minWidth: 0 }}>
          <span className="word-kanji">{w.kanji}</span>
          <span className="word-romaji">
            {[w.reading, w.romaji].filter(Boolean).join(' · ')}
          </span>
        </div>

        <span className="word-english" style={{
          overflow: 'hidden', textOverflow: open ? 'clip' : 'ellipsis',
          whiteSpace: open ? 'normal' : 'nowrap',
          maxWidth: '42%', flexShrink: 0, textAlign: 'right',
        }}>
          {w.english}
          {w.hint && <span style={{ display: 'block', fontSize: 11, color: 'var(--t3)' }}>({w.hint})</span>}
        </span>
      </div>

      {open && (
        <div className="fade-up" style={{ marginTop: 10, paddingLeft: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1, fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--t3)', letterSpacing: '0.06em' }}>
              {[w.pos, w.topic_en && (w.topic_ja ? `${w.topic_ja} · ${w.topic_en}` : w.topic_en)].filter(Boolean).join('  ·  ')}
            </div>
            <button className="btn-ghost" onClick={addToReviews} disabled={inReviews}
              style={{ fontSize: 11, padding: '4px 10px', opacity: inReviews ? 0.6 : 1 }}>
              {inReviews ? '✓ In reviews' : '＋ Review'}
            </button>
          </div>
          {w.example_jp ? (
            <div className="example-block" style={{ padding: 0 }}>
              <p className="example-jp"><Example text={w.example_jp} target={w.example_target} /></p>
              <p className="example-en">{w.example_en}</p>
            </div>
          ) : (
            !w.custom && <div style={{ fontSize: 11, color: 'var(--t3)' }}>No example sentence yet.</div>
          )}
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
  const debounce = useRef(null)
  const reqId    = useRef(0)

  // Topics for the chosen level
  useEffect(() => {
    setTopic(null)
    setTopics([])
    if (!level || level === 'MY') return
    api.topics(level).then(d => setTopics(d.topics)).catch(() => {})
  }, [level])

  async function load(offset = 0) {
    const id = ++reqId.current
    offset === 0 ? setLoading(true) : setMore(true)
    try {
      const data = await api.words({ level, topic, search, limit: PAGE_SIZE, offset })
      if (id !== reqId.current) return        // a newer request replaced this one
      setWords(prev => offset === 0 ? data.words : [...prev, ...data.words])
      setTotal(data.total)
    } catch {}
    finally {
      if (id === reqId.current) { setLoading(false); setMore(false) }
    }
  }

  useEffect(() => {
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => { setOpenId(null); load(0) }, 250)
  }, [level, topic, search])

  const hasMore = words.length < total

  return (
    <>
      <div className="words-controls">
        {/* Search */}
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Search word, reading, romaji, or English…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoCorrect="off"
            spellCheck={false}
          />
          {search.length > 0 && (
            <button
              onClick={() => setSearch('')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--t3)', fontSize: 16, padding: '0 8px',
                lineHeight: 1, WebkitTapHighlightColor: 'transparent',
              }}
            >×</button>
          )}
        </div>

        {/* Level filter */}
        <div className="pill-group" style={{ marginBottom: 10 }}>
          {FILTERS.map(l => (
            <button
              key={String(l)}
              className={`pill ${level === l ? 'active' : ''}`}
              onClick={() => setLevel(l)}
            >
              {LEVEL_LABEL[l]}
            </button>
          ))}
        </div>

        {/* Topic filter */}
        {topics.length > 0 && (
          <select
            className="search-input"
            value={topic ?? ''}
            onChange={e => setTopic(e.target.value === '' ? null : Number(e.target.value))}
            style={{ width: '100%', marginBottom: 12, padding: '9px 12px', borderRadius: 10,
                     border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--t1)' }}
          >
            <option value="">All topics</option>
            {topics.map(t => (
              <option key={t.topic_no} value={t.topic_no}>
                {t.topic_no}. {t.topic_ja} — {t.topic_en} ({t.count})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="words-count">
        {loading ? 'Loading…' : `${total.toLocaleString()} word${total !== 1 ? 's' : ''} · tap a word for details`}
      </div>

      {!loading && words.length === 0 && (
        <div className="empty-state">
          <span className="empty-kanji">無</span>
          <span className="empty-text">{level === 'MY' ? 'No personal words yet. Add them in ⚙️ Settings or with /add in the bot.' : 'No words match your search.'}</span>
        </div>
      )}

      <div className="words-list fade-up">
        {words.map(w => (
          <WordRow key={w.id} w={w} open={openId === w.id}
            onToggle={() => setOpenId(openId === w.id ? null : w.id)} />
        ))}
      </div>

      {hasMore && !loading && (
        <button
          className="btn-ghost"
          style={{ width: '100%', marginTop: 12, fontSize: 13 }}
          onClick={() => load(words.length)}
          disabled={more}
        >
          {more ? 'Loading…' : `Load more (${(total - words.length).toLocaleString()} remaining)`}
        </button>
      )}
    </>
  )
}
