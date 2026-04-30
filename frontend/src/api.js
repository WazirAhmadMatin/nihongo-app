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
  words:      (level, search, limit) => {
    const p = new URLSearchParams()
    if (level)  p.set('level',  level)
    if (search) p.set('search', search)
    if (limit)  p.set('limit',  limit)
    return get(`/words?${p}`)
  },
  levels:     ()           => get('/levels'),
  score:      (uid)        => get(`/score/${uid}`),
  quizStart:  (uid, level, total) => post('/quiz/start',  { user_id: uid, level, total }),
  quizAnswer: (uid, answer)       => post('/quiz/answer', { user_id: uid, answer }),
  quizHint:   (uid)               => post('/quiz/hint',   { user_id: uid }),
  quizStop:   (uid)               => post('/quiz/stop',   { user_id: uid }),
  reset:      (uid)               => post('/reset',       { user_id: uid }),
}