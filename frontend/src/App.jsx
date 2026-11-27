import { useState, useEffect, useCallback } from 'react'
import { useTelegram } from './hooks/useTelegram'
import { api } from './api'
import HomeScreen  from './tabs/HomeScreen'
import QuizTab     from './tabs/QuizTab'
import WordsTab    from './tabs/WordsTab'
import ReviewTab   from './tabs/ReviewTab'
import StatsTab    from './tabs/StatsTab'
import SettingsTab from './tabs/SettingsTab'

const TITLES = { review: 'Review', quiz: 'Quiz', words: 'Word list', stats: 'Progress', settings: 'Settings' }

// Bot buttons open the app at #review / #stats; Telegram can also pass start_param
function initialPath() {
  const p = (window.location.hash || '').slice(1) || window.Telegram?.WebApp?.initDataUnsafe?.start_param || ''
  return TITLES[p] ? p : null
}

export default function App() {
  const { tg, ready } = useTelegram()
  const inTelegram = !!tg?.initData
  const [path,   setPath]   = useState(initialPath)
  const [me,     setMe]     = useState(null)
  const [missed, setMissed] = useState(false)
  const [error,  setError]  = useState(null)

  const loadMe = useCallback(() => {
    api.me().then(d => { setMe(d); setError(null) }).catch(e => setError(e.message))
  }, [])
  useEffect(() => { loadMe() }, [loadMe])

  const goHome = useCallback(() => {
    setPath(null); setMissed(false)
    loadMe()
    if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search)
    window.scrollTo(0, 0)
  }, [loadMe])

  const open = p => { setPath(p); window.scrollTo(0, 0) }

  // Telegram's own back button
  useEffect(() => {
    const bb = tg?.BackButton
    if (!bb) return
    if (path) { bb.show(); bb.onClick(goHome) } else bb.hide()
    return () => bb.offClick?.(goHome)
  }, [path, tg, goHome])

  if (!ready) return <div className="loading jp">読み込み中…</div>

  return (
    <div className="app">
      {path && (
        <header className="topbar">
          {/* Inside Telegram, its native back button is used instead */}
          {inTelegram ? <span /> : <button className="back" onClick={goHome}>‹ Home</button>}
          <div className="topbar-title">{TITLES[path]}</div>
          <span />
        </header>
      )}

      <main>
        {path === null       && <HomeScreen me={me} error={error} onOpen={open} />}
        {path === 'review'   && <ReviewTab onDone={goHome} />}
        {path === 'quiz'     && <QuizTab key={missed ? 'missed' : 'all'} defaultLevel={me?.user?.level || 'N4'} presetMissed={missed} />}
        {path === 'words'    && <WordsTab />}
        {path === 'stats'    && <StatsTab onQuizMissed={() => { setMissed(true); open('quiz') }} />}
        {path === 'settings' && <SettingsTab onSaved={loadMe} />}
      </main>
    </div>
  )
}
