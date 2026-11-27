import { useState, useEffect, useCallback } from 'react'
import { useTelegram } from './hooks/useTelegram'
import { api } from './api'
import HomeScreen  from './tabs/HomeScreen'
import QuizTab     from './tabs/QuizTab'
import WordsTab    from './tabs/WordsTab'
import KanaTab     from './tabs/KanaTab'
import ReviewTab   from './tabs/ReviewTab'
import StatsTab    from './tabs/StatsTab'
import SettingsTab from './tabs/SettingsTab'

// Tabs shown in the quiz path
const QUIZ_TABS = [
  { id: 'quiz',  label: 'Quiz',  icon: '🃏' },
  { id: 'words', label: 'Words', jpIcon: '本' },
  { id: 'stats', label: 'Stats', icon: '📊' },
]

const TITLES = { review: '復習 Review', stats: '成績 Stats', settings: '設定 Settings', letters: '文字 Letters' }
const PATHS = ['review', 'quiz', 'stats', 'settings', 'letters']

function getInitialTheme() {
  try {
    const saved = localStorage.getItem('nihongo-theme')
    if (saved) return saved
  } catch {}
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Bot buttons open the app at #review / #stats; Telegram can also pass start_param
function initialPath(tg) {
  const p = (window.location.hash || '').slice(1) || tg?.initDataUnsafe?.start_param || ''
  return PATHS.includes(p) ? p : null
}

export default function App() {
  const { tg, ready } = useTelegram()
  const start = initialPath(window.Telegram?.WebApp)
  const [path,   setPath]   = useState(start === 'stats' ? 'quiz' : start)
  const [tab,    setTab]    = useState(start === 'stats' ? 'stats' : 'quiz')
  const [theme,  setTheme]  = useState(getInitialTheme)
  const [me,     setMe]     = useState(null)
  const [missed, setMissed] = useState(false)

  const loadMe = useCallback(() => { api.me().then(setMe).catch(() => {}) }, [])
  useEffect(() => { loadMe() }, [loadMe])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('nihongo-theme', theme) } catch {}
  }, [theme])

  const goHome = useCallback(() => {
    setPath(null); setTab('quiz'); setMissed(false)
    loadMe()
    if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search)
  }, [loadMe])

  // Telegram's native back button
  useEffect(() => {
    const bb = tg?.BackButton
    if (!bb) return
    if (path) { bb.show(); bb.onClick(goHome) } else bb.hide()
    return () => bb.offClick?.(goHome)
  }, [path, tg, goHome])

  function choose(p) {
    if (p === 'stats') { setPath('quiz'); setTab('stats') }
    else setPath(p)
  }

  if (!ready) return (
    <div className="loading-screen">
      <span className="loading-kanji">語</span>
      <span className="loading-text">NIHONGO</span>
    </div>
  )

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-top">
          {path ? (
            <button onClick={goHome} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              color: 'var(--t2)', fontFamily: 'var(--mono)',
              fontSize: 12, letterSpacing: '0.06em',
              padding: '4px 0', WebkitTapHighlightColor: 'transparent',
            }}>
              <span style={{ fontSize: 16 }}>←</span>
              <span>{TITLES[path] || 'Home'}</span>
            </button>
          ) : (
            <div>
              <div className="app-title-jp">日本語</div>
              <div className="app-title-en">nihongo vocabulary</div>
            </div>
          )}

          <div className="header-actions">
            <button className="theme-toggle" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme" title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div className="header-seal" />
          </div>
        </div>

        {path === 'quiz' && (
          <nav className="tab-bar">
            {QUIZ_TABS.map(t => (
              <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                <span className="tab-icon">
                  {t.jpIcon ? <span style={{ fontFamily: 'var(--serif-jp)', fontSize: 16 }}>{t.jpIcon}</span> : t.icon}
                </span>
                <span className="tab-label">{t.label}</span>
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="tab-content">
        {path === null       && <HomeScreen onChoose={choose} me={me} />}
        {path === 'review'   && <ReviewTab onDone={goHome} />}
        {path === 'letters'  && <KanaTab />}
        {path === 'settings' && <SettingsTab onSaved={loadMe} />}
        {path === 'quiz' && tab === 'quiz'  && (
          <QuizTab key={missed ? 'missed' : 'all'} defaultLevel={me?.user?.level || 'N4'} presetMissed={missed} />
        )}
        {path === 'quiz' && tab === 'words' && <WordsTab />}
        {path === 'quiz' && tab === 'stats' && (
          <StatsTab onQuizMissed={() => { setMissed(true); setTab('quiz') }} />
        )}
      </main>
    </div>
  )
}
