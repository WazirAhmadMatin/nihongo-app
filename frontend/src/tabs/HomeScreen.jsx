const HOME_CSS = `
  @keyframes hs-rise {
    from { opacity: 0; transform: translateY(22px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes hs-glow {
    0%, 100% { opacity: 0.5; }
    50%       { opacity: 1; }
  }
  @keyframes hs-float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-6px); }
  }
  @keyframes hs-shimmer {
    from { background-position: -200% center; }
    to   { background-position:  200% center; }
  }
  @keyframes hs-particle {
    0%   { transform: translateY(0) scale(1);   opacity: 0.7; }
    100% { transform: translateY(-40px) scale(0); opacity: 0; }
  }

  .hs-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 0 32px;
    min-height: 100%;
  }

  .hs-eyebrow {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--t3);
    margin-bottom: 6px;
    animation: hs-rise 0.4s 0.05s cubic-bezier(.22,1,.36,1) both;
  }

  .hs-title {
    font-family: var(--serif-jp, serif);
    font-size: clamp(28px, 8vw, 38px);
    color: var(--t1);
    text-align: center;
    line-height: 1.1;
    margin-bottom: 4px;
    animation: hs-rise 0.4s 0.10s cubic-bezier(.22,1,.36,1) both;
  }

  .hs-sub {
    font-family: var(--sans);
    font-size: 12px;
    color: var(--t3);
    text-align: center;
    margin-bottom: 28px;
    animation: hs-rise 0.4s 0.15s cubic-bezier(.22,1,.36,1) both;
  }

  .hs-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    width: 100%;
    animation: hs-rise 0.45s 0.2s cubic-bezier(.22,1,.36,1) both;
  }

  .hs-card {
    position: relative;
    border-radius: 20px;
    padding: 22px 14px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    cursor: pointer;
    overflow: hidden;
    border: 1.5px solid;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.16s cubic-bezier(.22,1,.36,1),
                box-shadow 0.2s,
                border-color 0.2s;
    user-select: none;
  }
  .hs-card:active {
    transform: scale(0.96) !important;
  }

  /* Shimmer sweep on hover */
  .hs-card::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      105deg,
      transparent 30%,
      rgba(255,255,255,0.07) 50%,
      transparent 70%
    );
    background-size: 200% 100%;
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
  }
  .hs-card:hover::after {
    opacity: 1;
    animation: hs-shimmer 0.7s linear;
  }

  /* Noise texture overlay */
  .hs-card::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    pointer-events: none;
    opacity: 0.6;
  }

  .hs-card-icon {
    font-size: 44px;
    line-height: 1;
    margin-bottom: 12px;
    animation: hs-float 3.5s ease-in-out infinite;
    filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));
    position: relative;
    z-index: 1;
  }

  .hs-card-class {
    font-family: var(--serif-jp, serif);
    font-size: 20px;
    line-height: 1;
    margin-bottom: 3px;
    position: relative;
    z-index: 1;
  }

  .hs-card-name {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin-bottom: 14px;
    position: relative;
    z-index: 1;
  }

  .hs-divider {
    width: 100%;
    height: 1px;
    margin-bottom: 14px;
    position: relative;
    z-index: 1;
  }

  .hs-card-title {
    font-family: var(--sans);
    font-size: 14px;
    font-weight: 700;
    text-align: center;
    margin-bottom: 5px;
    line-height: 1.2;
    position: relative;
    z-index: 1;
  }

  .hs-card-desc {
    font-family: var(--sans);
    font-size: 10px;
    text-align: center;
    line-height: 1.5;
    opacity: 0.65;
    margin-bottom: 16px;
    position: relative;
    z-index: 1;
  }

  .hs-tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px;
    position: relative;
    z-index: 1;
  }

  .hs-tag {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 3px 8px;
    border-radius: 6px;
    border: 1px solid;
  }

  .hs-cta {
    margin-top: 14px;
    width: calc(100% - 0px);
    padding: 10px 0;
    border-radius: 10px;
    border: none;
    font-family: var(--sans);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    letter-spacing: 0.04em;
    position: relative;
    z-index: 1;
    -webkit-tap-highlight-color: transparent;
    transition: opacity 0.15s, transform 0.12s;
  }
  .hs-cta:active { transform: scale(0.97); opacity: 0.85; }

  .hs-footer {
    margin-top: 28px;
    text-align: center;
    animation: hs-rise 0.4s 0.35s cubic-bezier(.22,1,.36,1) both;
  }
  .hs-footer-text {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--t3);
    letter-spacing: 0.1em;
  }
  .hs-dots {
    display: flex;
    justify-content: center;
    gap: 5px;
    margin-top: 10px;
  }
  .hs-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--t3);
    opacity: 0.3;
    animation: hs-glow 2.4s ease-in-out infinite;
  }
  .hs-dot:nth-child(2) { animation-delay: 0.4s; }
  .hs-dot:nth-child(3) { animation-delay: 0.8s; }
`

export default function HomeScreen({ onChoose }) {
  return (
    <div className="hs-wrap">
      <style>{HOME_CSS}</style>

      <div className="hs-eyebrow">あなたの道を選んでください</div>
      <div className="hs-title">Choose Your Path</div>
      <div className="hs-sub">Which journey calls to you today?</div>

      <div className="hs-cards">

        {/* ── Scholar card ── */}
        <div
          className="hs-card"
          onClick={() => onChoose('letters')}
          style={{
            background: 'linear-gradient(155deg, rgba(124,158,248,0.13) 0%, rgba(124,158,248,0.04) 100%)',
            borderColor: 'rgba(124,158,248,0.35)',
            boxShadow: '0 8px 32px rgba(124,158,248,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <div className="hs-card-icon" style={{ animationDelay: '0s' }}>📜</div>

          <div className="hs-card-class" style={{ color: '#7C9EF8' }}>学者</div>
          <div className="hs-card-name" style={{ color: 'rgba(124,158,248,0.7)' }}>Scholar</div>

          <div className="hs-divider" style={{ background: 'rgba(124,158,248,0.2)' }} />

          <div className="hs-card-title" style={{ color: 'var(--t1)' }}>
            Learn the<br/>Letters
          </div>
          <div className="hs-card-desc" style={{ color: 'var(--t2)' }}>
            Master the building blocks of Japanese writing
          </div>

          <div className="hs-tags">
            {['ひらがな', 'カタカナ', '漢字'].map(t => (
              <span key={t} className="hs-tag" style={{
                background: 'rgba(124,158,248,0.12)',
                borderColor: 'rgba(124,158,248,0.3)',
                color: '#7C9EF8',
              }}>{t}</span>
            ))}
          </div>

          <button className="hs-cta" style={{
            background: 'rgba(124,158,248,0.18)',
            color: '#7C9EF8',
            border: '1px solid rgba(124,158,248,0.35)',
          }}>
            Begin →
          </button>
        </div>

        {/* ── Challenger card ── */}
        <div
          className="hs-card"
          onClick={() => onChoose('quiz')}
          style={{
            background: 'linear-gradient(155deg, rgba(248,196,124,0.13) 0%, rgba(248,124,158,0.06) 100%)',
            borderColor: 'rgba(248,196,124,0.35)',
            boxShadow: '0 8px 32px rgba(248,196,124,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
            animationDelay: '0.05s',
          }}
        >
          <div className="hs-card-icon" style={{ animationDelay: '0.4s' }}>⚔️</div>

          <div className="hs-card-class" style={{ color: '#F8C47C' }}>挑戦者</div>
          <div className="hs-card-name" style={{ color: 'rgba(248,196,124,0.7)' }}>Challenger</div>

          <div className="hs-divider" style={{ background: 'rgba(248,196,124,0.2)' }} />

          <div className="hs-card-title" style={{ color: 'var(--t1)' }}>
            Vocabulary<br/>Quiz
          </div>
          <div className="hs-card-desc" style={{ color: 'var(--t2)' }}>
            Test your knowledge under pressure
          </div>

          <div className="hs-tags">
            {['N5', 'N4', 'Extra'].map(t => (
              <span key={t} className="hs-tag" style={{
                background: 'rgba(248,196,124,0.12)',
                borderColor: 'rgba(248,196,124,0.3)',
                color: '#F8C47C',
              }}>{t}</span>
            ))}
          </div>

          <button className="hs-cta" style={{
            background: 'rgba(248,196,124,0.18)',
            color: '#F8C47C',
            border: '1px solid rgba(248,196,124,0.35)',
          }}>
            Begin →
          </button>
        </div>

      </div>

      <div className="hs-footer">
        <div className="hs-footer-text">日本語 · NIHONGO</div>
        <div className="hs-dots">
          <div className="hs-dot" />
          <div className="hs-dot" />
          <div className="hs-dot" />
        </div>
      </div>
    </div>
  )
}
