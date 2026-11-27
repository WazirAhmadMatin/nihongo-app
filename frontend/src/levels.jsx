// Shared JLPT level constants and small display helpers.

export const LEVELS = [null, 'N5', 'N4', 'N3', 'N2', 'N1']
export const LEVEL_LABEL = { null: 'All', N5: 'N5', N4: 'N4', N3: 'N3', N2: 'N2', N1: 'N1' }

export const LEVEL_COLORS = {
  N5: { bg: 'rgba(124,158,248,0.15)', border: 'rgba(124,158,248,0.35)', color: '#7C9EF8' },
  N4: { bg: 'rgba(248,124,158,0.15)', border: 'rgba(248,124,158,0.35)', color: '#F87C9E' },
  N3: { bg: 'rgba(20,169,107,0.15)',  border: 'rgba(20,169,107,0.35)',  color: '#14A96B' },
  N2: { bg: 'rgba(248,196,124,0.15)', border: 'rgba(248,196,124,0.35)', color: '#E0A24E' },
  N1: { bg: 'rgba(176,124,248,0.15)', border: 'rgba(176,124,248,0.35)', color: '#A47CF8' },
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
        background: 'rgba(248,196,124,0.22)', color: 'inherit',
        borderRadius: 4, padding: '0 2px',
      }}>{target}</mark>
      {text.slice(i + target.length)}
    </>
  )
}
