import { useState, useEffect } from 'react'
import { api } from '../api'

export default function ScoreTab({ userId }) {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [resetting, setResetting] = useState(false)
  const [showReset, setShowReset] = useState(false)

  async function load() {
    setLoading(true)
    try { const d = await api.score(userId); setData(d) }
    catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [userId])

  async function doReset() {
    if (!confirm('Reset all progress? This cannot be undone.')) return
    setResetting(true)
    await api.reset(userId)
    await load()
    setResetting(false)
    setShowReset(false)
  }

  if (loading) return (
    <div className="empty-state">
      <span className="empty-kanji">統</span>
      <span className="empty-text">Loading…</span>
    </div>
  )

  if (!data) return (
    <div className="empty-state">
      <span className="empty-kanji">？</span>
      <span className="empty-text">Could not load score.</span>
    </div>
  )

  const pct      = data.pct ?? 0
  const maxWrong = data.wrong_words?.[0]?.count ?? 1

  const accuracy_color =
    pct >= 80 ? 'var(--green)' :
    pct >= 60 ? 'var(--gold-l)' :
    'var(--red)'

  const motivational =
    pct >= 80 ? '🎉 Excellent work! Keep it up!' :
    pct >= 60 ? '💪 Good effort — keep practicing!' :
    data.total === 0 ? null :
    '📚 More practice will get you there!'

  return (
    <div className="score-section fade-up">

      {/* Big accuracy */}
      <div className="section-title">Overall accuracy</div>
      <div className="score-header">
        <span className="score-big" style={{ color: accuracy_color }}>{pct}%</span>
        <span className="score-pct-label">correct</span>
      </div>
      <div className="score-fraction">{data.score} correct of {data.total} answered</div>

      {/* Motivational line */}
      {motivational && (
        <div style={{
          fontSize: 13, textAlign: 'center', marginBottom: 4,
          color: pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--gold-l)' : 'var(--t3)',
          fontFamily: 'var(--sans)',
        }}>
          {motivational}
        </div>
      )}

      {/* Stats grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon">🎯</span>
          <span className="stat-value" style={{ color: 'var(--green)' }}>{data.score}</span>
          <span className="stat-label">Correct</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📖</span>
          <span className="stat-value">{data.total}</span>
          <span className="stat-label">Answered</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">🔥</span>
          <span className="stat-value" style={{ color: 'var(--gold-l)' }}>{data.streak}</span>
          <span className="stat-label">Streak</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⚡</span>
          <span className="stat-value" style={{ color: 'var(--gold-l)' }}>{data.best_streak}</span>
          <span className="stat-label">Best streak</span>
        </div>
      </div>

      {/* Wrong words */}
      {data.wrong_words?.length > 0 ? (
        <>
          <div className="section-title" style={{ marginBottom: 12 }}>Needs practice</div>
          <div className="wrong-list" style={{ marginBottom: 24 }}>
            {data.wrong_words.map(w => (
              <div className="wrong-item" key={w.kanji}>
                <span className="wrong-kanji">{w.kanji}</span>
                <div className="wrong-info">
                  <div className="wrong-count">{w.count}× wrong</div>
                  <div className="wrong-bar-wrap">
                    <div className="wrong-bar" style={{ width: `${Math.round((w.count / maxWrong) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : data.total > 0 ? (
        <div style={{
          padding: '16px 14px', borderRadius: 12, marginBottom: 20,
          background: 'rgba(20,169,107,0.07)', border: '1px solid rgba(20,169,107,0.2)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>🌟</div>
          <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, fontFamily: 'var(--sans)' }}>
            Nothing to practice!
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2, fontFamily: 'var(--sans)' }}>
            You got everything right — impressive!
          </div>
        </div>
      ) : null}

      {data.total === 0 && (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          <span className="empty-kanji">始</span>
          <span className="empty-text">No data yet — take a quiz to see your stats!</span>
        </div>
      )}

      {/* Reset — tucked behind a toggle */}
      <div style={{ marginTop: 8 }}>
        {!showReset ? (
          <button
            className="btn-ghost"
            style={{ width: '100%', fontSize: 12, color: 'var(--t3)', borderColor: 'rgba(255,255,255,0.08)' }}
            onClick={() => setShowReset(true)}
          >
            ⚙ Danger zone
          </button>
        ) : (
          <div style={{
            padding: '14px', borderRadius: 12,
            border: '1px solid rgba(232,64,64,0.25)',
            background: 'rgba(232,64,64,0.05)',
          }}>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10, fontFamily: 'var(--sans)' }}>
              This will permanently delete all your quiz history and scores.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-ghost"
                style={{ flex: 1, fontSize: 13 }}
                onClick={() => setShowReset(false)}
              >
                Cancel
              </button>
              <button
                className="btn-ghost"
                style={{ flex: 1, fontSize: 13, color: 'var(--red)', borderColor: 'rgba(232,64,64,0.35)' }}
                onClick={doReset}
                disabled={resetting}
              >
                {resetting ? '…' : '🔄 Reset'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}