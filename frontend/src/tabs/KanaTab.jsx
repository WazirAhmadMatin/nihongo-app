import { useState, useEffect, useCallback, useRef } from 'react'
import { HIRAGANA, KATAKANA, BASIC_KANJI } from '../data/kanaData'

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
  @keyframes k-pop   { 0%{opacity:0;transform:scale(.8) translateY(8px)} 60%{transform:scale(1.04)} 100%{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes k-up    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes k-in    { from{opacity:0;transform:scale(.92)} to{opacity:1;transform:scale(1)} }
  @keyframes k-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 60%{transform:translateX(7px)} }
  @keyframes k-badge { 0%{transform:scale(0) rotate(-20deg);opacity:0} 70%{transform:scale(1.2) rotate(4deg)} 100%{transform:scale(1) rotate(0);opacity:1} }
  @keyframes k-prog  { from{width:0} }
  @keyframes k-glow  { 0%,100%{opacity:.7} 50%{opacity:1} }
  @keyframes k-tooltip { from{opacity:0;transform:translate(-50%,-50%) scale(.94)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }

  .k-pop  { animation: k-pop  .32s cubic-bezier(.22,1,.36,1) both }
  .k-up   { animation: k-up   .28s cubic-bezier(.22,1,.36,1) both }
  .k-in   { animation: k-in   .22s cubic-bezier(.22,1,.36,1) both }
  .k-shake{ animation: k-shake .35s ease both }
  .k-badge{ animation: k-badge .5s cubic-bezier(.34,1.56,.64,1) both }
  .k-tooltip { animation: k-tooltip .18s cubic-bezier(.22,1,.36,1) both }

  .k-card {
    border-radius: 16px;
    transition: transform .16s cubic-bezier(.22,1,.36,1), box-shadow .2s, background .2s, border-color .2s;
    position: relative; overflow: hidden;
    -webkit-tap-highlight-color: transparent;
  }
  .k-card::before {
    content:''; position:absolute; inset:0;
    background: linear-gradient(135deg, rgba(255,255,255,.07) 0%, transparent 55%);
    pointer-events:none; border-radius:inherit;
  }
  .k-card:active { transform: scale(.97) !important; }

  .k-btn {
    border-radius: 12px; cursor:pointer; outline:none;
    -webkit-tap-highlight-color:transparent;
    transition: transform .14s cubic-bezier(.22,1,.36,1), background .18s, border-color .18s, color .18s, box-shadow .18s;
    font-weight:500; position:relative; overflow:hidden;
  }
  .k-btn:hover:not(:disabled) { transform: translateY(-2px); }
  .k-btn:active:not(:disabled) { transform: scale(.96); }

  .k-prog-fill { animation: k-prog .45s cubic-bezier(.22,1,.36,1) both; }

  .k-lesson-row {
    display:flex; align-items:center; gap:12px;
    padding: 13px 14px; border-radius:14px; cursor:pointer;
    border: 1.5px solid; transition: all .2s;
    -webkit-tap-highlight-color:transparent;
  }
  .k-lesson-row:active { transform: scale(.98); }

  .k-choice {
    width:100%; border-radius:12px; cursor:pointer; outline:none;
    -webkit-tap-highlight-color:transparent; position:relative; overflow:hidden;
    transition: transform .12s cubic-bezier(.22,1,.36,1), background .15s, border-color .15s, color .15s;
    display:flex; align-items:center; justify-content:center; gap:8px;
  }
  .k-choice:hover:not(:disabled) { transform: translateY(-2px) scale(1.01); }
  .k-choice:active:not(:disabled) { transform: scale(.95); }
  .k-choice::before {
    content:''; position:absolute; inset:0;
    background: linear-gradient(135deg, rgba(255,255,255,.05) 0%, transparent 50%);
    pointer-events:none;
  }

  .ring-svg circle { transition: stroke-dashoffset .5s cubic-bezier(.22,1,.36,1); }

  /* Phase stepper — proper grid alignment */
  .k-stepper {
    display: grid;
    align-items: start;
    gap: 0;
  }
  .k-stepper-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    position: relative;
  }
  /* connecting line rendered as a pseudo on each cell except the first */
  .k-stepper-cell + .k-stepper-cell::before {
    content: '';
    position: absolute;
    top: 13px;
    right: 50%;
    left: -50%;
    height: 2px;
    border-radius: 99px;
    transition: background .4s;
  }
`

// ─── Mnemonics ────────────────────────────────────────────────────────────────
const MNE = {
  'あ':'An "A" doing yoga with arms wide open',
  'い':'Two reeds standing side by side in water',
  'う':'Lips pursed into a small O — like whistling',
  'え':'An antenna reaching up to catch signals',
  'お':'An exclamation mark — "Oh!"',
  'か':'A kite soaring in the wind',
  'き':'An old brass key',
  'く':'A bird beak snapping shut',
  'け':'A keg propped up on a stand',
  'こ':'Two parallel rails — a corner of a room',
  'さ':'A fish hook dangling in the sea',
  'し':'A fishing hook curling to the right',
  'す':'A suit hanging on a rack',
  'せ':'A crooked wooden seat',
  'そ':'A tilted Z — "so"',
  'た':'A table balancing on one leg',
  'ち':'A cheerful chicken head looking left',
  'つ':'A tsunami wave beginning to curl',
  'て':'A tent peg driven into the ground',
  'と':'A big toe poking upward',
  'な':'A nail hammered deep into wood',
  'に':'Two fingers — "ni" means two',
  'ぬ':'Noodles twirling in a bowl',
  'ね':'A cat curled up asleep',
  'の':'An O drawn in one flowing stroke',
  'は':'A happy laughing face',
  'ひ':'A crooked smile spread wide',
  'ふ':'Mount Fuji seen from directly above',
  'へ':'A mountain silhouette on the horizon',
  'ほ':'A house complete with chimney',
  'ま':'A big wide mammal eye staring',
  'み':'A missile spiraling upward',
  'む':'A mooing cow\'s face straight-on',
  'め':'Me looking in a mirror',
  'も':'More squiggles = more of something',
  'や':'A yawning mouth stretched wide open',
  'ゆ':'A yule log crackling in the fire',
  'よ':'A yoke resting across an ox\'s shoulders',
  'ら':'A rake swinging through fallen leaves',
  'り':'A river flowing gently downward',
  'る':'A ruler looping back on itself',
  'れ':'A reed bending gracefully in the wind',
  'ろ':'A rope coiling and curling up',
  'わ':'Wavy water on a still surface',
  'を':'A worm pushing forward through soil',
  'ん':'The side profile of a nose',
}

// ─── Lesson builder ───────────────────────────────────────────────────────────
function buildLessons(data, script) {
  if (!data || data.length === 0) return []

  if (script === 'kanji') {
    const groups = {}
    data.forEach(item => {
      const g = item.group || 'Other'
      if (!groups[g]) groups[g] = []
      groups[g].push(item)
    })
    return Object.entries(groups).map(([g, items], i) => ({
      id: i, title: g, titleJp: g, chars: items,
    }))
  }

  const rowDefs = [
    { label:'Vowels',   titleJp:'母音',   filter: r => ['a','i','u','e','o'].includes(r) },
    { label:'K — か行', titleJp:'か行',   filter: r => r.startsWith('k') },
    { label:'S — さ行', titleJp:'さ行',   filter: r => ['sa','si','su','se','so','shi'].includes(r) },
    { label:'T — た行', titleJp:'た行',   filter: r => ['ta','ti','tu','te','to','chi','tsu'].includes(r) },
    { label:'N — な行', titleJp:'な行',   filter: r => ['na','ni','nu','ne','no'].includes(r) },
    { label:'H — は行', titleJp:'は行',   filter: r => ['ha','hi','hu','he','ho','fu'].includes(r) },
    { label:'M — ま行', titleJp:'ま行',   filter: r => r.startsWith('m') },
    { label:'Y — や行', titleJp:'や行',   filter: r => r.startsWith('y') },
    { label:'R — ら行', titleJp:'ら行',   filter: r => r.startsWith('r') },
    { label:'W + N',    titleJp:'わ行+ん', filter: r => r.startsWith('w') || r === 'n' },
  ]

  const lessons = []
  const used = new Set()

  rowDefs.forEach((rd, i) => {
    const chars = data.filter(item => {
      const r = (item.romaji || '').toLowerCase().trim()
      return rd.filter(r) && !used.has(item.char)
    })
    if (chars.length > 0) {
      chars.forEach(c => used.add(c.char))
      lessons.push({ id: i, title: rd.label, titleJp: rd.titleJp, chars })
    }
  })

  const leftover = data.filter(item => !used.has(item.char))
  if (leftover.length > 0)
    lessons.push({ id: lessons.length, title: 'Special', titleJp: '特別', chars: leftover })

  return lessons
}

// ─── Mastery store ────────────────────────────────────────────────────────────
const masteryStore = {}
const lessonStars  = {}

function getM(char)          { return masteryStore[char] ?? 0 }
function bumpM(char, ok)     { masteryStore[char] = Math.max(0, Math.min(3, (masteryStore[char]??0) + (ok?1:-1))) }
function lKey(sc, id)        { return `${sc}-${id}` }
function getStars(sc, id)    { return lessonStars[lKey(sc,id)] ?? 0 }
function saveStars(sc, id, s){ const k=lKey(sc,id); if((lessonStars[k]??0)<s) lessonStars[k]=s }

function shuffle(arr) {
  const a=[...arr]
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a
}
function makeChoices(correct, pool, key, n=4) {
  const others = shuffle(pool.filter(x=>x.char!==correct.char)).slice(0,n-1).map(x=>x[key])
  return shuffle([correct[key],...others])
}

// ─── Progress Ring ────────────────────────────────────────────────────────────
function Ring({ pct, size=40, sw=4, color='#7C9EF8', label }) {
  const r=(size-sw)/2, c=2*Math.PI*r
  return (
    <div style={{position:'relative',width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} className="ring-svg"
        style={{transform:'rotate(-90deg)',position:'absolute',inset:0}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={sw}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c-(pct/100)*c}/>
      </svg>
      {label && (
        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span style={{fontSize:9,color,fontFamily:'var(--mono)',fontWeight:700}}>{label}</span>
        </div>
      )}
    </div>
  )
}

// ─── Script / phase config ────────────────────────────────────────────────────
const SCRIPTS = [
  {id:'hiragana',label:'Hiragana',labelJp:'ひらがな',data:HIRAGANA,   accent:'#7C9EF8'},
  {id:'katakana',label:'Katakana',labelJp:'カタカナ',data:KATAKANA,   accent:'#F87C9E'},
  {id:'kanji',   label:'Kanji',   labelJp:'漢字',    data:BASIC_KANJI,accent:'#F8C47C'},
]

const PHASES = [
  {id:'study', label:'Study',     icon:'👁', color:'#7C9EF8'},
  {id:'recog', label:'Recognize', icon:'⚡', color:'#C97BF8'},
  {id:'recall',label:'Recall',    icon:'🎯', color:'#F87C9E'},
  {id:'check', label:'Mastery',   icon:'⭐', color:'#F8C47C'},
]

// ─── STUDY PHASE ──────────────────────────────────────────────────────────────
function StudyPhase({ chars, script, accent, onComplete }) {
  const [idx,      setIdx]      = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [key,      setKey]      = useState(0)
  const item = chars[idx]
  const pct  = Math.round(((idx+1)/chars.length)*100)

  function next() {
    if (idx+1 >= chars.length) { onComplete(chars.length, chars.length); return }
    setIdx(i=>i+1); setRevealed(false); setKey(k=>k+1)
  }

  return (
    <div className="k-up" style={{display:'flex',flexDirection:'column',gap:0}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:18}}>👁</span>
          <div>
            <div style={{fontSize:13,color:'var(--paper)',fontWeight:600,fontFamily:'var(--sans)'}}>Study Mode</div>
            <div style={{fontSize:10,color:'var(--ink-5)',fontFamily:'var(--mono)'}}>Learn each character deeply</div>
          </div>
        </div>
        <Ring pct={pct} color={accent} size={38} sw={3} label={`${idx+1}/${chars.length}`}/>
      </div>

      <div style={{height:3,background:'rgba(255,255,255,.07)',borderRadius:99,marginBottom:18,overflow:'hidden'}}>
        <div className="k-prog-fill" style={{height:'100%',width:`${pct}%`,background:accent,borderRadius:99}}/>
      </div>

      <div key={key} className="k-card k-pop" style={{
        background:'rgba(255,255,255,.04)',
        border:`1.5px solid ${accent}44`,
        padding:'32px 20px',
        textAlign:'center',
        marginBottom:14,
        boxShadow:`0 8px 40px ${accent}18`,
      }}>
        <div style={{
          fontFamily:'var(--serif-jp)',
          fontSize:96, lineHeight:1,
          color:'var(--paper)', marginBottom:14,
          filter:`drop-shadow(0 0 28px ${accent}55)`,
        }}>
          {item?.char}
        </div>
        <div style={{fontFamily:'var(--mono)',fontSize:24,color:accent,letterSpacing:'0.10em',fontWeight:700}}>
          {item?.romaji}
        </div>

        {revealed && (
          <div className="k-in" style={{borderTop:'1px solid rgba(255,255,255,.08)',paddingTop:16,marginTop:16,display:'flex',flexDirection:'column',gap:8}}>
            {MNE[item?.char] && (
              <div style={{background:'rgba(255,255,255,.04)',borderRadius:10,padding:'11px 14px',textAlign:'left'}}>
                <div style={{fontSize:9,color:'var(--ink-5)',fontFamily:'var(--mono)',letterSpacing:'.12em',textTransform:'uppercase',marginBottom:5}}>Memory Hook</div>
                <div style={{fontSize:13,color:'rgba(255,255,255,.85)',fontFamily:'var(--sans)',lineHeight:1.55}}>💡 {MNE[item.char]}</div>
              </div>
            )}
            {script === 'kanji' && item?.english && (
              <div style={{background:'rgba(255,255,255,.04)',borderRadius:10,padding:'11px 14px',textAlign:'left'}}>
                <div style={{fontSize:9,color:'var(--ink-5)',fontFamily:'var(--mono)',letterSpacing:'.12em',textTransform:'uppercase',marginBottom:5}}>Meaning</div>
                <div style={{fontSize:14,color:'var(--paper)',fontFamily:'var(--sans)',fontWeight:500}}>{item.english}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {!revealed ? (
        <button className="k-btn" onClick={()=>setRevealed(true)} style={{
          width:'100%',padding:'14px',fontSize:14,
          background:`${accent}20`,border:`1.5px solid ${accent}55`,
          color:accent,fontFamily:'var(--sans)',
        }}>Reveal memory hook →</button>
      ) : (
        <div style={{display:'flex',gap:8}}>
          <button className="k-btn" onClick={()=>{setRevealed(false);setKey(k=>k+1)}} style={{
            flex:1,padding:'13px',fontSize:13,
            background:'rgba(192,57,43,.10)',border:'1.5px solid rgba(192,57,43,.28)',
            color:'var(--vermilion-l)',fontFamily:'var(--sans)',
          }}>Study again</button>
          <button className="k-btn" onClick={next} style={{
            flex:2,padding:'13px',fontSize:14,
            background:accent,border:'none',
            color:'#000',fontFamily:'var(--sans)',fontWeight:700,
          }}>Got it! →</button>
        </div>
      )}

      <div style={{display:'flex',justifyContent:'center',gap:5,marginTop:16}}>
        {chars.map((_,i)=>(
          <div key={i} style={{
            width:i===idx?16:6,height:6,borderRadius:99,
            background:i<=idx?accent:'rgba(255,255,255,.12)',
            opacity:i<=idx?1:0.4,
            transition:'all .3s cubic-bezier(.22,1,.36,1)',
          }}/>
        ))}
      </div>
    </div>
  )
}

// ─── QUIZ PHASE ───────────────────────────────────────────────────────────────
function QuizPhase({ chars, allChars, mode, phaseInfo, onComplete }) {
  const buildQueue = () => {
    if (mode === 'check') {
      const out = []
      chars.forEach(c => {
        const w = Math.max(1, 3 - getM(c.char))
        for (let i=0;i<w;i++) out.push({...c, qMode: i%2===0?'recog':'recall'})
      })
      return shuffle(out).slice(0, Math.min(chars.length*2, 18))
    }
    return shuffle([...chars]).map(c=>({...c, qMode:mode}))
  }

  const [queue]    = useState(buildQueue)
  const [idx,      setIdx]      = useState(0)
  const [selected, setSelected] = useState(null)
  const [correct,  setCorrect]  = useState(null)
  const [score,    setScore]    = useState(0)
  const [key,      setKey]      = useState(0)
  const [shaking,  setShaking]  = useState(false)
  const [choices,  setChoices]  = useState([])

  const cur     = queue[idx]
  const isRecog = cur?.qMode === 'recog'

  useEffect(()=>{
    if (!cur) return
    const lessonOthers = chars.filter(x => x.char !== cur.char)
    const globalOthers = allChars.filter(x => x.char !== cur.char && !lessonOthers.find(l=>l.char===x.char))
    const fromLesson = shuffle(lessonOthers).slice(0, 2)
    const fromGlobal = shuffle(globalOthers).slice(0, 2)
    const distractors = [...fromLesson, ...fromGlobal].slice(0, 3)
    const pool = [cur, ...distractors]
    setChoices(isRecog ? makeChoices(cur, pool, 'romaji') : makeChoices(cur, pool, 'char'))
  }, [idx, cur?.char, isRecog])

  function handleChoice(choice) {
    if (selected !== null) return
    const ans = isRecog ? cur.romaji : cur.char
    setSelected(choice)
    setCorrect(ans)
    const ok = choice === ans
    bumpM(cur.char, ok)
    const newScore = score + (ok?1:0)
    if (!ok) { setShaking(true); setTimeout(()=>setShaking(false),400) }
    setTimeout(()=>{
      const next = idx+1
      if (next >= queue.length) { onComplete(newScore, queue.length) }
      else { setIdx(next); setSelected(null); setCorrect(null); setKey(k=>k+1) }
    }, ok ? 850 : 1200)
  }

  if (!cur || choices.length===0) return null

  const pct = Math.round((idx/queue.length)*100)
  const prompt = isRecog ? cur.char : cur.romaji
  const choicesAreChars = !isRecog

  return (
    <div className="k-up">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontSize:14}}>{phaseInfo.icon}</span>
          <span style={{fontSize:12,color:'var(--paper)',fontWeight:600,fontFamily:'var(--sans)'}}>{phaseInfo.label}</span>
          <span style={{fontSize:10,color:'var(--ink-5)',fontFamily:'var(--mono)'}}>
            — {isRecog ? 'char → reading' : 'reading → char'}
          </span>
        </div>
        <span style={{fontSize:11,color:'var(--jade)',fontFamily:'var(--mono)',fontWeight:600}}>
          {score}/{idx}✓
        </span>
      </div>

      <div style={{height:3,background:'rgba(255,255,255,.07)',borderRadius:99,marginBottom:10,overflow:'hidden'}}>
        <div className="k-prog-fill" style={{height:'100%',width:`${pct}%`,background:`linear-gradient(90deg,${phaseInfo.color}88,${phaseInfo.color})`,borderRadius:99}}/>
      </div>

      <div key={key} className={`k-card k-pop ${shaking?'k-shake':''}`} style={{
        padding:'14px 16px', textAlign:'center', marginBottom:8, minHeight:110,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        border: selected===null ? '1.5px solid rgba(255,255,255,.08)'
          : selected===correct ? '1.5px solid var(--jade)'
          : '1.5px solid var(--vermilion)',
        background: selected===null ? 'rgba(255,255,255,.04)'
          : selected===correct ? 'rgba(74,163,97,.07)'
          : 'rgba(192,57,43,.06)',
        transition:'border-color .2s, background .2s',
      }}>
        <div style={{
          fontFamily: isRecog?'var(--serif-jp)':'var(--mono)',
          fontSize: isRecog?60:24, color:'var(--paper)', lineHeight:1,
          letterSpacing: isRecog?0:'0.06em',
        }}>
          {prompt}
        </div>
        {selected !== null && (
          <div className="k-in" style={{marginTop:6,fontSize:11,fontFamily:'var(--sans)',color:selected===correct?'var(--jade)':'var(--vermilion-l)'}}>
            {selected===correct ? '✓ Correct!' : `✗ ${correct}`}
            {selected!==correct && MNE[cur.char] && (
              <div style={{fontSize:9,color:'rgba(255,255,255,.38)',marginTop:3,lineHeight:1.4}}>
                💡 {MNE[cur.char]}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{fontSize:9,color:'var(--ink-5)',letterSpacing:'.10em',textTransform:'uppercase',marginBottom:7,fontFamily:'var(--mono)',textAlign:'center'}}>
        {isRecog?'Choose the reading':'Choose the character'}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gridTemplateRows:'1fr 1fr',gap:6}}>
        {choices.map(choice => {
          const st = selected===null?'idle':choice===correct&&choice===selected?'correct':choice===selected?'wrong':choice===correct?'reveal':'idle'
          const S = {
            idle:    {background:'rgba(255,255,255,.06)',border:'1.5px solid rgba(255,255,255,.12)',color:'var(--paper)'},
            correct: {background:'rgba(74,163,97,.18)',  border:'1.5px solid var(--jade)',          color:'var(--jade)'},
            wrong:   {background:'rgba(192,57,43,.16)',  border:'1.5px solid var(--vermilion)',      color:'var(--vermilion-l)'},
            reveal:  {background:'rgba(74,163,97,.10)',  border:'1.5px solid var(--jade)',           color:'var(--jade)'},
          }[st]
          const isCharChoice = /[\u3040-\u9fff]/.test(choice)
          return (
            <button key={choice} className="k-choice"
              onClick={()=>handleChoice(choice)}
              disabled={selected!==null}
              style={{
                padding:'0', height:72,
                fontSize: isCharChoice ? 32 : choice.length > 4 ? 13 : 16,
                fontFamily: isCharChoice ? 'var(--serif-jp)' : 'var(--sans)',
                fontWeight:st==='idle'?400:700,
                cursor:selected!==null?'default':'pointer',
                flexDirection:'column', gap:2, ...S,
              }}>
              <span>{choice}</span>
              {(st==='correct'||st==='reveal')&&<span style={{fontSize:11,marginTop:2}}>✓</span>}
              {st==='wrong'&&<span style={{fontSize:11,marginTop:2}}>✗</span>}
            </button>
          )
        })}
      </div>

      <div style={{display:'flex',justifyContent:'center',gap:4,marginTop:10,flexWrap:'wrap'}}>
        {queue.map((_,i)=>(
          <div key={i} style={{
            width:i===idx?14:5,height:5,borderRadius:99,
            background:i<idx?phaseInfo.color:i===idx?phaseInfo.color:'rgba(255,255,255,.12)',
            opacity:i<=idx?1:0.35,
            transition:'all .25s cubic-bezier(.22,1,.36,1)',
          }}/>
        ))}
      </div>
    </div>
  )
}

// ─── LESSON COMPLETE ──────────────────────────────────────────────────────────
function LessonComplete({ phaseId, score, total, stars, accent, isLastPhase, onNext, onBack }) {
  const pct = total ? Math.round(score/total*100) : 100
  return (
    <div className="k-up" style={{textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
      <div style={{display:'flex',gap:10,marginTop:8}}>
        {[1,2,3].map(i=>(
          <div key={i} className={stars>=i?'k-badge':''} style={{
            fontSize:36, opacity:stars>=i?1:0.18,
            filter:stars>=i?`drop-shadow(0 0 12px ${accent}cc)`:'none',
            animationDelay:`${i*.12}s`,
          }}>⭐</div>
        ))}
      </div>

      <div>
        <div style={{fontFamily:'var(--serif-jp)',fontSize:28,color:'var(--paper)',marginBottom:4}}>
          {pct>=90?'完璧！':pct>=70?'よくできた！':'がんばれ！'}
        </div>
        <div style={{fontSize:13,color:'var(--ink-5)',fontFamily:'var(--sans)'}}>
          {pct>=90?'Perfect! Outstanding work!':pct>=70?'Great job! Moving on.':'Keep at it — you\'re improving!'}
        </div>
      </div>

      <div style={{
        display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,width:'100%',
        background:'rgba(255,255,255,.03)',borderRadius:14,padding:14,
        border:'1px solid rgba(255,255,255,.07)',
      }}>
        <div>
          <div style={{fontSize:28,fontWeight:700,color:'var(--jade)',fontFamily:'var(--sans)'}}>{score}</div>
          <div style={{fontSize:10,color:'var(--ink-5)',fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.08em'}}>Correct</div>
        </div>
        <div>
          <div style={{fontSize:28,fontWeight:700,color:accent,fontFamily:'var(--sans)'}}>{pct}%</div>
          <div style={{fontSize:10,color:'var(--ink-5)',fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:'.08em'}}>Accuracy</div>
        </div>
      </div>

      {!isLastPhase && (
        <button className="k-btn" onClick={onNext} style={{
          width:'100%',padding:'15px',fontSize:14,
          background:accent,border:'none',color:'#000',fontFamily:'var(--sans)',fontWeight:700,
        }}>Next Phase →</button>
      )}
      <button className="k-btn" onClick={onBack} style={{
        width:'100%',padding:'13px',fontSize:13,
        background:'transparent',border:'1.5px solid rgba(255,255,255,.12)',
        color:'var(--ink-5)',fontFamily:'var(--sans)',
      }}>← Back to Lessons</button>
    </div>
  )
}

// ─── LESSON RUNNER ────────────────────────────────────────────────────────────
function LessonRunner({ lesson, script, allChars, accent, onBack }) {
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [status,   setStatus]   = useState('active')
  const [score,    setScore]    = useState(0)
  const [total,    setTotal]    = useState(0)
  const [stars,    setStars]    = useState(0)
  const [key,      setKey]      = useState(0)

  const phase = PHASES[phaseIdx]

  function handlePhaseComplete(sc, tot) {
    const pct = tot ? sc/tot*100 : 100
    const earned = pct>=90?3:pct>=70?2:1
    setScore(sc??0); setTotal(tot??lesson.chars.length)
    setStars(earned); saveStars(script, lesson.id, earned)
    setStatus('done')
  }

  function nextPhase() {
    const next = phaseIdx+1
    if (next >= PHASES.length) { onBack(); return }
    setPhaseIdx(next); setStatus('active'); setKey(k=>k+1)
  }

  return (
    <div>
      {/* ── Phase stepper — CSS grid for reliable alignment ── */}
      <div style={{display:'flex',alignItems:'flex-start',gap:0,marginBottom:6}}>
        <button onClick={onBack} style={{
          background:'none',border:'none',color:'var(--ink-5)',fontFamily:'var(--mono)',
          fontSize:12,cursor:'pointer',padding:'6px 14px 0 0',letterSpacing:'.06em',flexShrink:0,
        }}>←</button>

        <div style={{
          flex:1,
          display:'grid',
          gridTemplateColumns:`repeat(${PHASES.length}, 1fr)`,
          alignItems:'start',
          position:'relative',
        }}>
          {/* Connecting lines — drawn as absolute divs behind circles */}
          {PHASES.filter((_,i) => i > 0).map((_,i) => {
            const lineIdx = i + 1
            return (
              <div key={`line-${lineIdx}`} style={{
                position:'absolute',
                top: 13,
                left: `calc(${i / PHASES.length * 100}% + 50% / ${PHASES.length})`,
                width: `calc(100% / ${PHASES.length})`,
                height: 2,
                borderRadius: 99,
                background: lineIdx <= phaseIdx ? PHASES[i].color : 'rgba(255,255,255,.07)',
                transition: 'background .4s',
                zIndex: 0,
              }} />
            )
          })}

          {PHASES.map((p,i) => {
            const done = i < phaseIdx
            const cur  = i === phaseIdx
            return (
              <div key={p.id} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,position:'relative',zIndex:1}}>
                <div style={{
                  width:26, height:26, borderRadius:'50%',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background: done ? p.color : cur ? `${p.color}25` : 'rgba(255,255,255,.06)',
                  border: cur ? `2px solid ${p.color}` : done ? 'none' : '2px solid rgba(255,255,255,.10)',
                  fontSize: done ? 11 : 15,
                  boxShadow: cur ? `0 0 14px ${p.color}55` : 'none',
                  transition: 'all .3s',
                }}>
                  {done ? '✓' : p.icon}
                </div>
                <span style={{fontSize:8,color:cur?p.color:'var(--ink-5)',fontFamily:'var(--mono)',letterSpacing:'.06em',textTransform:'uppercase'}}>
                  {p.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Lesson label */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,marginTop:4}}>
        <span style={{fontFamily:'var(--serif-jp)',fontSize:17,color:'var(--paper)'}}>{lesson.titleJp}</span>
        <span style={{fontSize:11,color:'var(--ink-5)',fontFamily:'var(--mono)'}}>{lesson.title}</span>
        <span style={{
          fontSize:10,color:accent,fontFamily:'var(--mono)',marginLeft:'auto',
          background:`${accent}18`,borderRadius:6,padding:'2px 8px',border:`1px solid ${accent}44`,
        }}>{lesson.chars.length} chars</span>
      </div>

      {status==='active' && (
        <div key={key}>
          {phase.id==='study'  && <StudyPhase chars={lesson.chars} script={script} accent={phase.color} onComplete={handlePhaseComplete}/>}
          {phase.id==='recog'  && <QuizPhase  chars={lesson.chars} allChars={allChars} mode="recog"  phaseInfo={phase} onComplete={handlePhaseComplete}/>}
          {phase.id==='recall' && <QuizPhase  chars={lesson.chars} allChars={allChars} mode="recall" phaseInfo={phase} onComplete={handlePhaseComplete}/>}
          {phase.id==='check'  && <QuizPhase  chars={lesson.chars} allChars={allChars} mode="check"  phaseInfo={phase} onComplete={handlePhaseComplete}/>}
        </div>
      )}

      {status==='done' && (
        <LessonComplete
          phaseId={phase.id} score={score} total={total} stars={stars} accent={accent}
          isLastPhase={phaseIdx===PHASES.length-1}
          onNext={nextPhase} onBack={onBack}
        />
      )}
    </div>
  )
}

// ─── LESSON LIST ──────────────────────────────────────────────────────────────
function LessonList({ lessons, script, accent, onSelect }) {
  const allChars       = lessons.flatMap(l=>l.chars)
  const mastered       = allChars.filter(c=>getM(c.char)>=3).length
  const totalPct       = allChars.length ? Math.round(mastered/allChars.length*100) : 0
  const lessonsStarted = lessons.filter(l=>getStars(script,l.id)>0).length

  function isUnlocked(i) { return i===0 || getStars(script,lessons[i-1].id)>=1 }

  return (
    <div className="k-up">
      {/* Overall banner */}
      <div style={{
        display:'flex',alignItems:'center',gap:12,padding:'12px 14px',
        background:'rgba(255,255,255,.04)',borderRadius:14,
        border:'1px solid rgba(255,255,255,.08)',marginBottom:18,
      }}>
        <Ring pct={totalPct} color={accent} size={48} sw={4} label={`${totalPct}%`}/>
        <div style={{flex:1}}>
          <div style={{fontSize:13,color:'var(--paper)',fontWeight:600,fontFamily:'var(--sans)'}}>
            {mastered} / {allChars.length} mastered
          </div>
          <div style={{fontSize:10,color:'var(--ink-5)',fontFamily:'var(--mono)',marginTop:2}}>
            {lessonsStarted} / {lessons.length} lessons started
          </div>
          <div style={{height:3,background:'rgba(255,255,255,.07)',borderRadius:99,marginTop:6,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${totalPct}%`,background:accent,borderRadius:99,transition:'width .6s'}}/>
          </div>
        </div>
      </div>

      {/* Lesson rows — stars only, no redundant phase dots */}
      <div style={{display:'flex',flexDirection:'column',gap:7}}>
        {lessons.map((lesson,i) => {
          const unlocked = isUnlocked(i)
          const stars    = getStars(script, lesson.id)
          const started  = stars > 0
          const previewChars = lesson.chars.slice(0,7).map(c=>c.char).join(' ')

          return (
            <div key={lesson.id} className="k-lesson-row"
              onClick={()=>unlocked&&onSelect(lesson)}
              style={{
                borderColor: started?`${accent}55`:unlocked?'rgba(255,255,255,.09)':'rgba(255,255,255,.04)',
                background:  started?`${accent}0B`:'rgba(255,255,255,.025)',
                opacity: unlocked?1:0.45,
                cursor: unlocked?'pointer':'default',
              }}>

              {/* Number */}
              <div style={{
                width:32,height:32,borderRadius:10,flexShrink:0,
                display:'flex',alignItems:'center',justifyContent:'center',
                background:started?`${accent}30`:'rgba(255,255,255,.07)',
                border:`1.5px solid ${started?accent+'55':'rgba(255,255,255,.1)'}`,
                fontFamily:'var(--mono)',fontSize:12,
                color:started?accent:'var(--ink-5)',fontWeight:700,
              }}>
                {!unlocked?'🔒':i+1}
              </div>

              {/* Text */}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:'var(--paper)',fontWeight:500,fontFamily:'var(--sans)'}}>
                  {lesson.title}
                </div>
                <div style={{
                  fontSize:11,color:'var(--ink-5)',fontFamily:'var(--serif-jp)',
                  marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
                }}>
                  {previewChars}{lesson.chars.length>7?' …':''}
                </div>
              </div>

              {/* Stars only — phase dots removed (redundant) */}
              <div style={{display:'flex',gap:2,flexShrink:0,alignItems:'center'}}>
                {[1,2,3].map(s=>(
                  <span key={s} style={{
                    fontSize:13,
                    opacity: stars>=s ? 1 : 0.15,
                    filter:  stars>=s ? `drop-shadow(0 0 5px ${accent})` : 'none',
                    transition:'all .3s',
                  }}>⭐</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── REFERENCE CHART — with tap tooltip ──────────────────────────────────────
function RefChart({ data, script, accent }) {
  const isKanji = script === 'kanji'
  const [tooltip, setTooltip] = useState(null) // { char, romaji, english, mne }
  const groups = {}
  data.forEach(item=>{ const g=item.group||'Other'; if(!groups[g])groups[g]=[]; groups[g].push(item) })

  function openTooltip(item) {
    setTooltip({ char: item.char, romaji: item.romaji, english: item.english, mne: MNE[item.char] })
  }

  return (
    <div style={{paddingBottom:12,position:'relative'}}>
      {Object.entries(groups).map(([g,items])=>(
        <div key={g} style={{marginBottom:18}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
            <span style={{fontSize:10,fontFamily:'var(--mono)',color:'var(--ink-5)',letterSpacing:'.12em',textTransform:'uppercase'}}>{g}</span>
            <div style={{flex:1,height:1,background:'rgba(255,255,255,.06)'}}/>
            <span style={{fontSize:9,color:'var(--ink-5)',fontFamily:'var(--mono)'}}>
              {items.filter(i=>getM(i.char)>=3).length}/{items.length}
            </span>
          </div>
          <div style={{
            display:'grid',
            gridTemplateColumns: isKanji?'repeat(auto-fill,minmax(66px,1fr))':'repeat(auto-fill,minmax(52px,1fr))',
            gap:5,
          }}>
            {items.map(item=>{
              const m  = getM(item.char)
              const bg = ['rgba(255,255,255,.03)','rgba(124,158,248,.09)','rgba(74,220,130,.11)','rgba(248,196,124,.14)'][m]
              const br = ['rgba(255,255,255,.07)','rgba(124,158,248,.28)','rgba(74,220,130,.32)','rgba(248,196,124,.44)'][m]
              return (
                <div key={item.char}
                  onClick={()=>openTooltip(item)}
                  style={{
                    background:bg, border:`1px solid ${br}`, borderRadius:10,
                    padding:'7px 4px', textAlign:'center', transition:'all .2s',
                    cursor:'pointer', WebkitTapHighlightColor:'transparent',
                  }}>
                  <div style={{fontFamily:'var(--serif-jp)',fontSize:isKanji?19:17,color:'var(--paper)',lineHeight:1}}>{item.char}</div>
                  <div style={{fontFamily:'var(--mono)',fontSize:9,color:'var(--ink-5)',marginTop:3,letterSpacing:'.04em'}}>{item.romaji}</div>
                  {isKanji && m>=1 && <div style={{fontSize:7,color:'rgba(255,255,255,.38)',fontFamily:'var(--sans)',marginTop:2,lineHeight:1.2}}>{item.english?.split('/')[0]}</div>}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Tooltip overlay */}
      {tooltip && (
        <>
          {/* Backdrop */}
          <div
            onClick={()=>setTooltip(null)}
            style={{position:'fixed',inset:0,zIndex:40,background:'rgba(0,0,0,0.45)'}}
          />
          {/* Card */}
          <div className="k-tooltip" style={{
            position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
            zIndex:50, width:'min(320px,90vw)',
            background:'var(--card-bg,#1a1a2e)', borderRadius:16,
            border:`1.5px solid ${accent}55`,
            boxShadow:`0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,.04)`,
            padding:'20px 20px 16px',
          }}>
            <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:12}}>
              <div style={{
                fontFamily:'var(--serif-jp)',fontSize:56,lineHeight:1,
                color:'var(--paper)',filter:`drop-shadow(0 0 20px ${accent}66)`,
              }}>{tooltip.char}</div>
              <div>
                <div style={{fontFamily:'var(--mono)',fontSize:20,color:accent,fontWeight:700,letterSpacing:'.08em'}}>
                  {tooltip.romaji}
                </div>
                {tooltip.english && (
                  <div style={{fontSize:13,color:'var(--t2)',fontFamily:'var(--sans)',marginTop:2}}>{tooltip.english}</div>
                )}
              </div>
            </div>
            {tooltip.mne && (
              <div style={{
                background:'rgba(255,255,255,.04)',borderRadius:10,
                padding:'10px 12px',fontSize:13,
                color:'rgba(255,255,255,.8)',fontFamily:'var(--sans)',lineHeight:1.55,
              }}>
                💡 {tooltip.mne}
              </div>
            )}
            <button
              onClick={()=>setTooltip(null)}
              style={{
                marginTop:12,width:'100%',padding:'10px',
                background:'transparent',border:'1px solid rgba(255,255,255,.1)',
                borderRadius:8,color:'var(--t3)',fontFamily:'var(--sans)',
                fontSize:12,cursor:'pointer',
              }}
            >Close</button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function KanaTab() {
  const [script, setScript] = useState('hiragana')
  const [view,   setView]   = useState('lessons')  // 'lessons'|'lesson'|'chart'
  const [lesson, setLesson] = useState(null)
  const [tick,   setTick]   = useState(0)

  const sInfo   = SCRIPTS.find(s=>s.id===script)
  const accent  = sInfo?.accent || '#7C9EF8'
  const lessons = buildLessons(sInfo?.data||[], script)

  function handleBack() {
    setView('lessons'); setLesson(null); setTick(t=>t+1)
  }

  return (
    <div className="fade-up">
      <style>{CSS}</style>

      {/* Script pills */}
      <div style={{display:'flex',gap:6,marginBottom:14}}>
        {SCRIPTS.map(s=>(
          <button key={s.id} className="k-btn"
            onClick={()=>{ setScript(s.id); setView('lessons'); setLesson(null) }}
            style={{
              flex: s.id === 'kanji' ? 1.2 : 1,
              padding:'9px 6px',fontFamily:'var(--sans)',
              background:script===s.id?`${s.accent}22`:'rgba(255,255,255,.04)',
              border:`1.5px solid ${script===s.id?s.accent+'77':'rgba(255,255,255,.08)'}`,
              color:script===s.id?s.accent:'var(--ink-5)',
            }}>
            <div style={{fontFamily:'var(--serif-jp)',fontSize:14,marginBottom:1}}>{s.labelJp}</div>
            <div style={{fontSize:10}}>{s.label}</div>
          </button>
        ))}
      </div>

      {/* Tab bar */}
      {view !== 'lesson' && (
        <div style={{display:'flex',gap:4,marginBottom:16,background:'rgba(255,255,255,.04)',borderRadius:10,padding:3}}>
          {[{id:'lessons',label:'🎓 Lessons'},{id:'chart',label:'📋 Chart'}].map(t=>(
            <button key={t.id} className="k-btn"
              onClick={()=>setView(t.id)}
              style={{
                flex:1,padding:'8px',fontSize:12,fontFamily:'var(--sans)',
                background:view===t.id?`${accent}28`:'transparent',
                border:view===t.id?`1.5px solid ${accent}55`:'1.5px solid transparent',
                color:view===t.id?accent:'var(--ink-5)',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {view==='lessons' && (
        <LessonList key={`lessons-${script}-${tick}`} lessons={lessons} script={script} accent={accent}
          onSelect={l=>{setLesson(l);setView('lesson')}}/>
      )}
      {view==='lesson' && lesson && (
        <LessonRunner lesson={lesson} script={script} allChars={sInfo?.data||[]} accent={accent} onBack={handleBack}/>
      )}
      {view==='chart' && (
        <RefChart key={`chart-${script}-${tick}`} data={sInfo?.data||[]} script={script} accent={accent}/>
      )}
    </div>
  )
}