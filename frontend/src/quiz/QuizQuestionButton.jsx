// One answer option, shown as a list row.
// state: idle | correct | wrong | reveal | tried (wrong earlier, in "try again" mode)
const MARK = { correct: '✓', reveal: '✓', wrong: '✕', tried: '✕' }

export default function QuizQuestionButton({ text, state = 'idle', onClick, disabled, jp }) {
  return (
    <button className={`row choice ${jp ? 'jp-choice' : ''}`} data-state={state}
      onClick={() => onClick(text)} disabled={disabled}>
      <span className="row-main">{text}</span>
      {MARK[state] && <span className="mark" aria-label={state === 'tried' || state === 'wrong' ? 'wrong' : 'correct'}>{MARK[state]}</span>}
    </button>
  )
}
