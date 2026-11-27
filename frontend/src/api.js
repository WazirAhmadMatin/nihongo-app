export const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Telegram signs initData; the backend verifies it to know who you are.
function authHeaders() {
  const initData = window.Telegram?.WebApp?.initData
  if (initData) return { 'X-Telegram-Init-Data': initData }
  const dev = import.meta.env.VITE_DEV_USER
  return dev ? { 'X-Dev-User': dev } : {}
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Network error' }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

const get  = (path)       => req('GET',    path)
const post = (path, body) => req('POST',   path, body)
const put  = (path, body) => req('PUT',    path, body)
const del  = (path)       => req('DELETE', path)

export const api = {
  // words
  words: ({ level, topic, search, limit = 50, offset = 0 } = {}) => {
    const p = new URLSearchParams()
    if (level)          p.set('level',  level)
    if (topic != null)  p.set('topic',  topic)
    if (search)         p.set('search', search)
    p.set('limit',  limit)
    p.set('offset', offset)
    return get(`/words?${p}`)
  },
  word:        (id)    => get(`/words/${encodeURIComponent(id)}`),
  levels:      ()      => get('/levels'),
  topics:      (level) => get(`/topics?level=${level}`),

  // me
  me:          ()       => get('/me'),
  saveSettings:(values) => put('/me/settings', values),

  // spaced repetition
  reviewQueue: (limit = 30)        => get(`/review/queue?limit=${limit}`),
  grade:       (word_id, grade)    => post('/review/grade', { word_id, grade }),
  addReview:   (word_id)           => post('/review/add',   { word_id }),

  // personal words
  myWords:     ()                        => get('/mywords'),
  addMyWord:   (word, reading, meaning)  => post('/mywords', { word, reading, meaning }),
  delMyWord:   (id)                      => del(`/mywords/${encodeURIComponent(id)}`),

  // quiz
  quizStart:  ({ level, topic = null, total = 10, mode = 'meaning', missed_only = false }) =>
                post('/quiz/start', { level, topic, total, mode, missed_only }),
  quizAnswer: (answer) => post('/quiz/answer', { answer }),
  quizStop:   ()       => post('/quiz/stop'),

  // stats
  stats:       () => get('/stats'),
  leaderboard: () => get('/leaderboard'),
  reset:       () => post('/reset'),
}
