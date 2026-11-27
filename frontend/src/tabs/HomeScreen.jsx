import { Row, plural } from '../levels'

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'こんばんは' : h < 11 ? 'おはよう' : h < 18 ? 'こんにちは' : 'こんばんは'
}

function daysUntil(iso) {
  if (!iso) return null
  const d = Math.round((new Date(iso + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000)
  return d >= 0 ? d : null
}

export default function HomeScreen({ me, error, onOpen }) {
  const name = me?.user?.first_name && me.user.first_name !== 'Dev' ? `、${me.user.first_name}` : ''
  const t = me?.today
  const todo = t ? t.due + t.new : 0
  const streak = me?.streak
  const exam = daysUntil(me?.user?.exam_date)

  let summary = 'Loading your day…'
  if (error) summary = error === 'Open this app from Telegram.' ? 'Open this app from the bot in Telegram to see your words.' : `Couldn't load your words: ${error}`
  else if (t) summary = todo
    ? [t.due && plural(t.due, 'review'), t.new && plural(t.new, 'new word')].filter(Boolean).join(' and ') + ' today.'
    : t.done ? `Done for today: ${plural(t.done, 'answer')}. New words come tomorrow.` : 'Nothing to review right now.'

  const extras = []
  if (streak?.current) extras.push(`${plural(streak.current, 'day')} in a row${streak.studied_today ? '' : ', study today to keep it'}`)
  if (exam != null) extras.push(exam === 0 ? 'JLPT is today. 頑張って!' : `JLPT in ${plural(exam, 'day')}`)

  return (
    <div className="screen">
      <h1 className="greeting">{greeting()}{name}</h1>
      <p className="lede">{summary}</p>

      <button className="btn" disabled={!todo} onClick={() => onOpen('review')}>
        {todo ? 'Start reviewing' : 'All caught up'}
      </button>
      {extras.length > 0 && <p className="note" style={{ textAlign: 'center' }}>{extras.join('. ')}.</p>}

      <h2 className="group-title">Practice</h2>
      <div className="group">
        <Row title="Quiz" sub="Meanings, readings and fill-in-the-blank" onClick={() => onOpen('quiz')} />
        <Row title="Word list" sub="All 9,205 words, by level and topic" onClick={() => onOpen('words')} />
      </div>

      <h2 className="group-title">You</h2>
      <div className="group">
        <Row title="Progress" sub="Streak, calendar and this week's ranking" onClick={() => onOpen('stats')} />
        <Row title="Settings" sub="Level, new words per day, reminders, my words" onClick={() => onOpen('settings')} />
      </div>
    </div>
  )
}
