// Shared JLPT level constants and small display helpers.

export const LEVELS = [null, 'N5', 'N4', 'N3', 'N2', 'N1']
export const LEVEL_LABEL = { null: 'All', N5: 'N5', N4: 'N4', N3: 'N3', N2: 'N2', N1: 'N1', MY: 'Mine' }

export const LEVEL_COLORS = {
  N5: { bg: 'rgba(124,158,248,0.15)', border: 'rgba(124,158,248,0.35)', color: '#7C9EF8' },
  N4: { bg: 'rgba(248,124,158,0.15)', border: 'rgba(248,124,158,0.35)', color: '#F87C9E' },
  N3: { bg: 'rgba(20,169,107,0.15)',  border: 'rgba(20,169,107,0.35)',  color: '#14A96B' },
  N2: { bg: 'rgba(248,196,124,0.15)', border: 'rgba(248,196,124,0.35)', color: '#E0A24E' },
  N1: { bg: 'rgba(176,124,248,0.15)', border: 'rgba(176,124,248,0.35)', color: '#A47CF8' },
  MY: { bg: 'rgba(15,168,136,0.15)',  border: 'rgba(15,168,136,0.35)',  color: '#0FA888' },
}

export function LevelBadge({ level }) {
  if (!level) return null
  const c = LEVEL_COLORS[level] || { bg: 'rgba(255,255,255,0.07)', border: 'rgba(255,255,255,0.15)', color: 'var(--t3)' }
  return (
    <span style={{
      flexShrink: 0, fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)',
      padding: '2px 7px', borderRadius: 6, letterSpacing: '0.04em',
      background: c.bg, border: `1px solid ${c.border}`, color: c.color,
    }}>
      {level === 'MY' ? '★' : level}
    </span>
  )
}

// Example sentence with the target word highlighted.
export function Example({ text, target }) {
  if (!text) return null
  const i = target ? text.indexOf(target) : -1
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark style={{
        background: 'rgba(248,196,124,0.25)', color: 'inherit',
        borderRadius: 4, padding: '0 2px',
      }}>{target}</mark>
      {text.slice(i + target.length)}
    </>
  )
}

export const selectStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 14,
  border: '1px solid var(--card-border)', background: 'var(--card-bg)', color: 'var(--t1)',
}
