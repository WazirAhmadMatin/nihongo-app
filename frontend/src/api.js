const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Network error' }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

const get  = (path)        => req('GET',  path)
const post = (path, body)  => req('POST', path, body)

export const api = {
  words: ({ level, topic, search, limit = 50, offset = 0 } = {}) => {
    const p = new URLSearchParams()
    if (level)          p.set('level',  level)
    if (topic != null)  p.set('topic',  topic)
    if (search)         p.set('search', search)
    p.set('limit',  limit)
    p.set('offset', offset)
    return get(`/words?${p}`)
  },
  word:       (id)         => get(`/words/${encodeURIComponent(id)}`),
  levels:     ()           => get('/levels'),
  topics:     (level)      => get(`/topics?level=${level}`),
  score:      (uid)        => get(`/score/${uid}`),
  quizStart:  (uid, level, total, topic = null) =>
                post('/quiz/start', { user_id: uid, level, total, topic }),
  quizAnswer: (uid, answer) => post('/quiz/answer', { user_id: uid, answer }),
  quizStop:   (uid)         => post('/quiz/stop',   { user_id: uid }),
  reset:      (uid)         => post('/reset',       { user_id: uid }),
}
