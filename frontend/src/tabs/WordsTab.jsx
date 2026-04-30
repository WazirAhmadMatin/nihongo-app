import { useState, useEffect, useRef } from 'react'
import { api } from '../api'

const LEVELS = [null, 'N5', 'N4', 'EXTRA']
const LABEL  = { null: 'All', N5: 'N5', N4: 'N4', EXTRA: 'Extra' }
const PAGE_SIZE = 50

const BADGE_COLORS = {
  N5:    { bg: 'rgba(124,158,248,0.15)', border: 'rgba(124,158,248,0.35)', color: '#7C9EF8' },
  N4:    { bg: 'rgba(248,124,158,0.15)', border: 'rgba(248,124,158,0.35)', color: '#F87C9E' },
  EXTRA: { bg: 'rgba(248,196,124,0.15)', border: 'rgba(248,196,124,0.35)', color: '#F8C47C' },
}

// Deterministic pastel color from a string
function tileColor(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffff
  const hue = h % 360
  return `hsl(${hue},40%,28%)`
}

function KanjiFallback({ kanji }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
      background: tileColor(kanji),
      border: '1px solid rgba(255,255,255,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--serif-jp, serif)', fontSize: 18, color: 'rgba(255,255,255,0.85)',
      lineHeight: 1,
    }}>
      {kanji?.[0] ?? '?'}
    </div>
  )
}

function LevelBadge({ level }) {
  if (!level) return null
  const c = BADGE_COLORS[level] || { bg: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.15)', color: 'var(--t3)' }
  return (
    <span style={{
      flexShrink: 0,
      fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)',
      padding: '2px 7px', borderRadius: 6,
      background: c.bg, border: `1px solid ${c.border}`, color: c.color,
      letterSpacing: '0.04em',
    }}>
      {level}
    </span>
  )
}

export default function WordsTab() {
  const [words,    setWords]    = useState([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [level,    setLevel]    = useState(null)
  const [search,   setSearch]   = useState('')
  const [page,     setPage]     = useState(1)
  const [allWords, setAllWords] = useState([])
  const debounce = useRef(null)

  async function load(lvl, q) {
    setLoading(true)
    try {
      const data = await api.words(lvl, q, 200)
      setAllWords(data.words)
      setTotal(data.total)
      setPage(1)
      setWords(data.words.slice(0, PAGE_SIZE))
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => {
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => load(level, search), 250)
  }, [level, search])

  function loadMore() {
    const next = page + 1
    setWords(allWords.slice(0, next * PAGE_SIZE))
    setPage(next)
  }

  const hasMore = words.length < allWords.length

  return (
    <>
      <div className="words-controls">
        {/* Search */}
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            placeholder="Search kanji, romaji, or English…"
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
        <div className="pill-group" style={{ marginBottom: 12 }}>
          {LEVELS.map(l => (
            <button
              key={String(l)}
              className={`pill ${level === l ? 'active' : ''}`}
              onClick={() => setLevel(l)}
            >
              {LABEL[l]}
            </button>
          ))}
        </div>
      </div>

      <div className="words-count">
        {loading ? 'Loading…' : `${total.toLocaleString()} word${total !== 1 ? 's' : ''}`}
      </div>

      {!loading && words.length === 0 && (
        <div className="empty-state">
          <span className="empty-kanji">無</span>
          <span className="empty-text">No words match your search.</span>
        </div>
      )}

      <div className="words-list fade-up">
        {words.map((w, i) => (
          <div className="word-item" key={`${w.kanji}-${i}`} style={{ alignItems: 'center' }}>

            

            {/* Badge — left of kanji column so it doesn't get cut off */}
            <LevelBadge level={w.level} />

            {/* Kanji + romaji */}
            <div className="word-kanji-col" style={{ flex: 1, minWidth: 0 }}>
              <span className="word-kanji">{w.kanji}</span>
              <span className="word-romaji">{w.romaji}</span>
            </div>

            {/* English — truncated so it never pushes badge off screen */}
            <span className="word-english" style={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              maxWidth: '38%', flexShrink: 0, textAlign: 'right',
            }}>
              {w.english}
            </span>
          </div>
        ))}
      </div>

      {/* Load more */}
      {hasMore && !loading && (
        <button
          className="btn-ghost"
          style={{ width: '100%', marginTop: 12, fontSize: 13 }}
          onClick={loadMore}
        >
          Load more ({allWords.length - words.length} remaining)
        </button>
      )}
    </>
  )
}