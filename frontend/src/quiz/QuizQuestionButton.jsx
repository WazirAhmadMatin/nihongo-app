// One answer option.
// state: idle | correct | wrong | reveal | tried (wrong earlier, in "try again" mode)
const STYLES = {
  idle:    { border: '1.5px solid var(--card-border)', bg: 'var(--card-bg)',       color: 'var(--t2)',    icon: null },
  correct: { border: '1.5px solid var(--green)',       bg: 'var(--green-s)',        color: 'var(--green)', icon: '✓' },
  wrong:   { border: '1.5px solid var(--red)',         bg: 'var(--red-s)',          color: 'var(--red)',   icon: '✗' },
  reveal:  { border: '1.5px solid var(--green)',       bg: 'rgba(20,169,107,0.06)', color: 'var(--green)', icon: '✓' },
  tried:   { border: '1.5px dashed var(--red)',        bg: 'transparent',           color: 'var(--t3)',    icon: '✗' },
}

export default function QuizQuestionButton({ text, state = 'idle', onClick, disabled, jp }) {
  const S = STYLES[state]
  return (
    <button
      onClick={() => onClick(text)}
      disabled={disabled}
      style={{
        width: '100%', padding: jp ? '12px 16px' : '13px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        border: S.border, borderRadius: 10, background: S.bg, color: S.color,
        fontSize: jp ? 19 : 15, fontFamily: jp ? 'var(--serif-jp)' : 'var(--sans)',
        fontWeight: state === 'idle' || state === 'tried' ? 400 : 600,
        textDecoration: state === 'tried' ? 'line-through' : 'none',
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left', lineHeight: 1.4,
        transition: 'background 0.18s, border-color 0.18s, color 0.18s, transform 0.12s',
        transform: state === 'correct' || state === 'wrong' ? 'scale(1.01)' : 'scale(1)',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span>{text}</span>
      {S.icon && (
        <span style={{ fontSize: 18, flexShrink: 0, marginLeft: 8, animation: 'iconPop 0.25s cubic-bezier(.34,1.56,.64,1) both' }}>
          {S.icon}
        </span>
      )}
    </button>
  )
}
