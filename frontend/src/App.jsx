import { useState, useEffect } from 'react'
import { useTelegram } from './hooks/useTelegram'
import HomeScreen from './tabs/HomeScreen'
import QuizTab    from './tabs/QuizTab'
import ScoreTab   from './tabs/ScoreTab'
import WordsTab   from './tabs/WordsTab'
import KanaTab    from './tabs/KanaTab'

// Tabs shown only in the quiz path
const QUIZ_TABS = [
  { id: 'quiz',  label: 'Quiz',  labelJp: '練習', icon: '🃏' },
  { id: 'score', label: 'Score', labelJp: '成績', icon: '📊' },
  { id: 'words', label: 'Words', labelJp: '語彙', icon: null, jpIcon: '本' },
]

function getInitialTheme() {
  try {
    const saved = localStorage.getItem('nihongo-theme')
    if (saved) return saved
  } catch {}
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function App() {
  const { userId, ready } = useTelegram()
  const [path,  setPath]  = useState(null)   // null | 'letters' | 'quiz'
  const [tab,   setTab]   = useState('quiz') // active tab inside quiz path
  const [theme, setTheme] = useState(getInitialTheme)

  // Sync theme to <html data-theme>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('nihongo-theme', theme) } catch {}
  }, [theme])

  function toggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }

  function goHome() {
    setPath(null)
    setTab('quiz') // reset quiz tab for next visit
  }

  if (!ready) return (
    <div className="loading-screen">
      <span className="loading-kanji">語</span>
      <span className="loading-text">NIHONGO</span>
    </div>
  )

  return (
    <div className="app-shell">

      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-top">

          {/* Left side: back button (paths) or title (home) */}
          {path ? (
            <button
              onClick={goHome}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                color: 'var(--t2)', fontFamily: 'var(--mono)',
                fontSize: 12, letterSpacing: '0.06em',
                padding: '4px 0', WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ fontSize: 16 }}>←</span>
              <span>Home</span>
            </button>
          ) : (
            <div>
              <div className="app-title-jp">日本語</div>
              <div className="app-title-en">nihongo vocabulary</div>
            </div>
          )}

          {/* Right side: theme toggle + seal */}
          <div className="header-actions">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div className="header-seal" />
          </div>
        </div>

        {/* Tab bar — only shown inside the quiz path */}
        {path === 'quiz' && (
          <nav className="tab-bar">
            {QUIZ_TABS.map(t => (
              <button
                key={t.id}
                className={`tab-btn ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <span className="tab-icon">
                  {t.jpIcon
                    ? <span style={{ fontFamily: 'var(--serif-jp)', fontSize: 16 }}>{t.jpIcon}</span>
                    : t.icon
                  }
                </span>
                <span className="tab-label">{t.label}</span>
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* ── Content ── */}
      <main className="tab-content">

        {/* Home screen */}
        {path === null && (
          <HomeScreen onChoose={setPath} />
        )}

        {/* Letters path — KanaTab only */}
        {path === 'letters' && (
          <KanaTab />
        )}

        {/* Quiz path — three tabs */}
        {path === 'quiz' && tab === 'quiz'  && <QuizTab  userId={userId} />}
        {path === 'quiz' && tab === 'score' && <ScoreTab userId={userId} />}
        {path === 'quiz' && tab === 'words' && <WordsTab />}

      </main>
    </div>
  )
}