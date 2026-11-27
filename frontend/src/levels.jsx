// Shared level constants and small display helpers.

export const LEVELS = [null, 'N5', 'N4', 'N3', 'N2', 'N1']
export const LEVEL_LABEL = { null: 'All', N5: 'N5', N4: 'N4', N3: 'N3', N2: 'N2', N1: 'N1', MY: 'Mine' }

export function LevelTag({ level }) {
  if (!level) return null
  return <span className="lv" style={{ '--lv': `var(--${level})` }}>{level === 'MY' ? 'My word' : level}</span>
}

// Example sentence with the target word marked.
export function Example({ text, target }) {
  if (!text) return null
  const i = target ? text.indexOf(target) : -1
  if (i < 0) return <>{text}</>
  return <>{text.slice(0, i)}<mark>{target}</mark>{text.slice(i + target.length)}</>
}

// Segmented control
export function Seg({ options, value, onChange, label = o => o }) {
  return (
    <div className="seg" role="group">
      {options.map(o => (
        <button key={String(o)} aria-pressed={value === o} onClick={() => onChange(o)}>{label(o)}</button>
      ))}
    </div>
  )
}

// One row of a grouped list
export function Row({ title, sub, value, onClick, children, chevron = !!onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag className="row" onClick={onClick}>
      <div className="row-main">
        <div className="row-title">{title}</div>
        {sub && <div className="row-sub">{sub}</div>}
      </div>
      {value != null && <div className="row-value">{value}</div>}
      {children}
      {chevron && <span className="chev" aria-hidden>›</span>}
    </Tag>
  )
}

// Big card word: shrink long words so they stay on one or two lines
export function wordSize(text = '') {
  const n = [...text].length
  return n <= 3 ? 64 : n <= 4 ? 56 : n <= 5 ? 48 : n <= 6 ? 42 : n <= 8 ? 34 : 28
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
