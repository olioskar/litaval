(() => {
'use strict';
const COLORS = window.SEREFNI_COLORS || [];

/* ---------- colour-emotion knowledge (grounded in colour psychology research) ---------- */
const EMOTION = {
  'Red':         {temp:'warm', words:['energy','passion','boldness'], rooms:'social & dining spaces'},
  'Orange':      {temp:'warm', words:['warmth','sociable','playful'], rooms:'kitchens & social rooms'},
  'Amber':       {temp:'warm', words:['cosy','grounded','golden'],    rooms:'living rooms & hallways'},
  'Yellow':      {temp:'warm', words:['happy','uplifting','bright'],  rooms:'kitchens & creative spaces'},
  'Yellow-Green':{temp:'warm', words:['fresh','natural','lively'],    rooms:'kitchens & sunrooms'},
  'Green':       {temp:'cool', words:['balanced','restful','natural'],rooms:'bedrooms & wellness spaces'},
  'Teal':        {temp:'cool', words:['calm','refined','serene'],     rooms:'bathrooms & studies'},
  'Blue':        {temp:'cool', words:['calm','trust','focus'],        rooms:'bedrooms & offices'},
  'Violet':      {temp:'cool', words:['creative','luxurious','intimate'], rooms:'bedrooms & accent walls'},
  'White':       {temp:'neutral', words:['clean','airy','open'],      rooms:'any space, as a base'},
  'Warm Neutral':{temp:'warm', words:['soft','grounded','inviting'],  rooms:'any space, as a base'},
  'Cool Neutral':{temp:'cool', words:['quiet','modern','composed'],   rooms:'any space, as a base'},
};
const emo = c => EMOTION[c.family] || {temp:'neutral', words:[], rooms:'any space'};

/* ---------- harmony definitions: offsets in degrees from the base hue ---------- */
// `mono:true` => same hue, different lightness instead of hue offsets.
const HARMONIES = {
  2: [
    {id:'complementary', name:'Complementary', offsets:[180],
     desc:'Opposite hues — high contrast and energy.',
     why:'Hues sitting opposite on the colour wheel intensify each other, giving a vivid, confident contrast. Let one lead and the other accent.'},
    {id:'analogous2', name:'Analogous', offsets:[30], biDir:true,
     desc:'Neighbouring hues — calm and cohesive.',
     why:'Adjacent hues share underlying pigment, so they blend gently. The result feels harmonious and easy — the safest, most restful pairing.'},
    {id:'mono2', name:'Monochromatic', mono:true, steps:2,
     desc:'One hue, two depths — quiet and unified.',
     why:'A single hue at two lightness levels reads as effortlessly coordinated. Contrast comes from light vs. dark rather than from colour clash.'},
  ],
  3: [
    {id:'analogous3', name:'Analogous', offsets:[-30,30],
     desc:'Three neighbours — naturally harmonious.',
     why:'Three hues side by side on the wheel feel balanced and organic, like colours found together in nature. Keep one dominant for calm.'},
    {id:'triadic', name:'Triadic', offsets:[120,240],
     desc:'Evenly spaced — vibrant yet balanced.',
     why:'Three hues spaced evenly around the wheel stay lively without the harshness of pure opposites. Let one dominate and use the other two as accents.'},
    {id:'split', name:'Split-Complementary', offsets:[150,210],
     desc:'A hue plus two beside its opposite.',
     why:'You get the contrast of a complementary scheme, but the two split partners soften the clash — strong yet easier on the eye.'},
    {id:'mono3', name:'Monochromatic', mono:true, steps:3,
     desc:'One hue, three depths — serene.',
     why:'One hue stepped light → mid → dark gives the greatest sense of unity. Lean on the lightness range to keep it from feeling flat.'},
  ],
};

/* ---------- helpers ---------- */
const hueDist = (a,b) => {const d=Math.abs(a-b)%360; return d>180?360-d:d;};
const norm = h => ((h%360)+360)%360;
const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));
const titleish = c => /^\d+$/.test(c.name) ? `No. ${c.name}` : c.name;

/* signed shortest angle from b to a, in (-180,180]; positive = a is "ahead" of b on the wheel */
const signedDelta = (a,b) => ((a-b+540)%360)-180;

/* hue closeness score for a slot. Normally "closest to the centre hue is best".
   For a bidirectional axis (idealOff set) the centre is the BASE hue, so score by how
   far the colour is from the ideal ±offset instead — best = nearest a true neighbour. */
const hueScore = (c, ax) => ax.idealOff != null
  ? Math.abs(hueDist(c.h, ax.centerHue) - ax.idealOff)
  : hueDist(c.h, ax.centerHue);

/* per-harmony hue tolerance (± degrees from the ideal target before the relationship degrades).
   `minBase` keeps analogous neighbours from collapsing into the base hue. */
const TOL = {
  complementary:{h:20}, analogous2:{h:12,minBase:18}, analogous3:{h:12,minBase:18},
  triadic:{h:18}, split:{h:15},
};

/* does a colour qualify for this slot's tolerance window? */
function qualifies(c, ax, base, others, currentHex){
  if (c.hex===base.hex && c.name===base.name) return false;
  if (c.hex!==currentHex && others.has(c.hex)) return false;
  if (ax.valueOnly) return hueDist(c.h, ax.centerHue) <= ax.hueLimit;
  if (c.neutral) return false;
  if (c.l<12 || c.l>90) return false;                       // hue stops reading at the extremes
  if (hueDist(c.h, ax.centerHue) > ax.hueLimit) return false;
  if (ax.minBase && hueDist(c.h, base.h) < ax.minBase) return false;
  return true;
}

/* best (closest to centre) qualifying colour — used as the default pick */
function pickBest(base, ax, used){
  let best=null, bs=1e9;
  for (const c of COLORS){
    if (!qualifies(c, ax, base, used, null)) continue;
    const sc=(ax.valueOnly?Math.abs(c.s-base.s)*0.1:hueScore(c,ax)) + Math.abs(c.l-ax.centerL)*0.3;
    if (sc<bs){bs=sc; best=c;}
  }
  return best;
}

/* build the palette for current base + harmony */
function buildPalette(base, harmony){
  const slots = [{role:'Base', color:base}];
  const used = new Set([base.hex]);
  if (harmony.mono){
    // shade targets are a relative step from the base lightness (not a fixed extreme),
    // clamped to a readable range so the contrast scales with how light/dark the base is
    const STEP=30, clampL=v=>clamp(v,18,86);
    const defs = harmony.steps===2
      ? [[clampL(base.l>50 ? base.l-STEP : base.l+STEP), 'Shade']]
      : [[clampL(base.l+STEP),'Lighter'], [clampL(base.l-STEP),'Deeper']];
    for (const [t,role] of defs){
      const ax={valueOnly:true, centerHue:base.h, hueLimit:15, centerL:t, Vval:30, rowMax:3, colMax:2, satBin:14};
      const pick=pickBest(base, ax, used) || pickBestByL(base, ax, used);
      if (pick){ used.add(pick.hex); slots.push({role, color:pick, axis:ax}); }
    }
  } else if (harmony.biDir){
    // analogous on BOTH sides: centre the axis on the base hue so the matrix fans out to
    // the -off and +off neighbours symmetrically (centre columns stay empty via minBase).
    const off=harmony.offsets[0], binW=12, colMax=4;
    // dead-zone just past half a column so ONLY the centre column (the base hue) stays empty
    const ax={valueOnly:false, biDir:true, idealOff:off, centerHue:base.h, centerL:base.l,
              binW, hueLimit:(colMax+0.5)*binW, minBase:binW/2+1,
              Vval:30, rowMax:2, colMax};
    const pick=pickBest(base, ax, used);
    if (pick){ used.add(pick.hex); slots.push({role:roleName(off), color:pick, axis:ax}); }
  } else {
    const tol = TOL[harmony.id] || {h:18};
    const colMax=3, binW=tol.h/2;
    harmony.offsets.forEach(off=>{
      const ax={valueOnly:false, centerHue:norm(base.h+off), centerL:base.l,
                binW, hueLimit:(colMax+0.5)*binW, minBase:tol.minBase||0,
                Vval:30, rowMax:2, colMax};
      const pick=pickBest(base, ax, used);
      if (pick){ used.add(pick.hex); slots.push({role:roleName(off), color:pick, axis:ax}); }
    });
  }
  return slots;
}
/* mono fallback: closest lightness within the hue window (qualifies() valueOnly path already
   covers it, but guard against an empty window) */
function pickBestByL(base, ax, used){
  let best=null,bd=1e9;
  for(const c of COLORS){
    if(hueDist(c.h, ax.centerHue) > ax.hueLimit || used.has(c.hex) || (c.hex===base.hex&&c.name===base.name)) continue;
    const d=Math.abs(c.l-ax.centerL); if(d<bd){bd=d;best=c;}
  }
  return best;
}

/* bin every qualifying colour into a (col,row) cell; keep the best representative per cell */
function buildMatrix(s, i){
  const ax=s.axis, base=state.base;
  const others=new Set(state.palette.filter((_,k)=>k!==i).map(x=>x.color.hex));
  const cells=new Map();
  const rowBin=ax.Vval/ax.rowMax;
  for (const c of COLORS){
    if (!qualifies(c, ax, base, others, s.color.hex)) continue;
    let col=0;
    if (ax.valueOnly){
      col=clamp(Math.round((c.s-base.s)/ax.satBin), -ax.colMax, ax.colMax);
    } else {
      const dh=signedDelta(c.h, ax.centerHue);
      col=clamp(Math.round(dh/ax.binW), -ax.colMax, ax.colMax);
    }
    const dl=c.l-ax.centerL;
    const row=clamp(Math.round(dl/rowBin), -ax.rowMax, ax.rowMax);
    const key=col+','+row;
    const score=(ax.valueOnly?Math.abs(c.s-base.s)*0.1:hueScore(c,ax)) + Math.abs(dl)*0.3;
    const ex=cells.get(key);
    if (!ex || score<ex.score) cells.set(key, {c, score});
  }
  return cells;
}
function renderMatrix(s, i){
  const ax=s.axis, cells=buildMatrix(s, i);
  const cols=[]; for(let x=-ax.colMax;x<=ax.colMax;x++) cols.push(x);
  const rows=[]; for(let y=ax.rowMax;y>=-ax.rowMax;y--) rows.push(y);
  let h=`<div class="alt-matrix${ax.valueOnly?' value-only':''}" style="grid-template-columns:repeat(${cols.length},34px)">`;
  for (const y of rows) for (const x of cols){
    const cell=cells.get(x+','+y);
    if (cell){
      const c=cell.c;
      const sel=(c.hex===s.color.hex && c.name===s.color.name)?' is-sel':'';
      const ctr=(x===0 && y===0)?' is-center':'';
      h+=`<button class="alt-sw${sel}${ctr}" data-slot="${i}" data-hex="${c.hex}" data-an="${encodeURIComponent(c.name)}"
            style="background-color:${c.hex}" title="${titleish(c)} · ${c.hex}"></button>`;
    } else h+=`<span class="alt-empty"></span>`;
  }
  return h+`</div>`;
}
function roleName(off){
  const a=norm(off);
  if (a===180) return 'Complement';
  if (a===30||a===330) return 'Neighbour';
  if (a===150||a===210) return 'Split partner';
  if (a===120||a===240) return 'Triad partner';
  return 'Partner';
}

/* ---------- state ---------- */
const state = {count:2, harmony:HARMONIES[2][0], base:null, filterFamily:'All', muted:false, search:'',
               palette:[], ratios:[]};

/* ---------- render: harmony chips with mini wheels ---------- */
function wheelSVG(harmony){
  const r=20, cx=22, cy=22; let dots='';
  const angles = harmony.mono ? [0] : [0, ...harmony.offsets];
  // ring
  let ring=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ddd9cf" stroke-width="3"/>`;
  angles.forEach((off,i)=>{
    const a=(norm((state.base?state.base.h:0)+off)-90)*Math.PI/180;
    const x=cx+r*Math.cos(a), y=cy+r*Math.sin(a);
    const fill = state.base ? `hsl(${norm(state.base.h+off)},55%,55%)` : '#bbb';
    dots+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i===0?5:4}" fill="${fill}" stroke="#fff" stroke-width="1.5"/>`;
  });
  return `<svg class="wheel" width="44" height="44" viewBox="0 0 44 44">${ring}${dots}</svg>`;
}
function renderHarmonies(){
  const grid=document.getElementById('harmonyGrid');
  grid.innerHTML = HARMONIES[state.count].map(h=>`
    <button class="harmony-card ${h.id===state.harmony.id?'is-active':''}" data-id="${h.id}">
      ${wheelSVG(h)}
      <span class="h-text"><span class="h-name">${h.name}</span><span class="h-desc">${h.desc}</span></span>
    </button>`).join('');
  grid.querySelectorAll('.harmony-card').forEach(b=>b.onclick=()=>{
    state.harmony = HARMONIES[state.count].find(x=>x.id===b.dataset.id);
    renderHarmonies(); recompute();
  });
}

/* ---------- render: family chips ---------- */
const FAMILY_ORDER=['All','Red','Orange','Amber','Yellow','Yellow-Green','Green','Teal','Blue','Violet','White','Warm Neutral','Cool Neutral'];
function familySwatchColor(f){
  const m={Red:'#b4413a',Orange:'#c8693a',Amber:'#c79a4a',Yellow:'#d8c24a',
    'Yellow-Green':'#9aae4f',Green:'#5b8a52',Teal:'#4e9088',Blue:'#4a6f99',
    Violet:'#7a5e92','White':'#f0eee6','Warm Neutral':'#cabfa9','Cool Neutral':'#b6bab7'};
  return m[f]||'#ccc';
}
function renderFamilyChips(){
  const wrap=document.getElementById('familyChips');
  wrap.innerHTML=FAMILY_ORDER.map(f=>`
    <button class="fchip ${state.filterFamily===f?'is-active':''}" data-f="${f}">
      ${f==='All'?'':`<span class="dot" style="background:${familySwatchColor(f)}"></span>`}${f}
    </button>`).join('');
  wrap.querySelectorAll('.fchip').forEach(b=>b.onclick=()=>{state.filterFamily=b.dataset.f; renderFamilyChips(); renderGrid();});
}

/* ---------- render: swatch grid ---------- */
function filteredColors(){
  const q=state.search.trim().toLowerCase();
  return COLORS.filter(c=>{
    if(state.filterFamily!=='All' && c.family!==state.filterFamily) return false;
    if(state.muted && !c.muted) return false;
    if(q && !c.name.toLowerCase().includes(q) && !(c.collection||'').toLowerCase().includes(q)) return false;
    return true;
  });
}
function renderGrid(){
  const grid=document.getElementById('swatchGrid');
  const list=filteredColors();
  document.getElementById('gridCount').textContent=`${list.length} shown`;
  grid.innerHTML=list.map(c=>{
    return `<button class="swatch ${state.base&&state.base.hex===c.hex&&state.base.name===c.name?'is-base':''}"
      style="background-color:${c.hex}" data-hex="${c.hex}" data-name="${encodeURIComponent(c.name)}" title="">
      <span class="tip">${titleish(c)} · ${c.hex}</span></button>`;
  }).join('')
    + (list.length===0?`<div class="empty-hint">No colours match. Try clearing filters.</div>`:'');
  grid.querySelectorAll('.swatch').forEach(b=>b.onclick=()=>{
    const nm=decodeURIComponent(b.dataset.name);
    state.base=COLORS.find(c=>c.hex===b.dataset.hex && c.name===nm);
    renderGrid(); renderHarmonies(); recompute();
    document.getElementById('resultPanel').scrollIntoView({behavior:'smooth',block:'start'});
  });
}

/* ---------- recompute palette + dependent UI ---------- */
function recompute(){
  if(!state.base){return;}
  state.palette=buildPalette(state.base, state.harmony);
  state.ratios=evenRatios(state.palette.length);
  renderResult(); renderWhy(); renderRatio();
  document.getElementById('resultPanel').hidden=false;
  document.getElementById('whySection').hidden=false;
  document.getElementById('ratioSection').hidden=false;
}

/* ---------- render: palette tray ---------- */
function renderResult(){
  const tray=document.getElementById('paletteTray');
  tray.innerHTML=state.palette.map((s,i)=>{
    const c=s.color, e=emo(c);
    const tags=[e.temp, ...(e.words||[]).slice(0,2), c.muted?'muted':null].filter(Boolean)
      .map(t=>`<span class="tag">${t}</span>`).join('');
    // alternatives, arranged as a tolerance matrix: centre = best match,
    // columns shift hue ←→, rows shift value (lighter ↑ / darker ↓)
    const altBlock = s.axis ? `
      <div class="alts">
        <span class="alts-label">${s.axis.valueOnly
          ? 'Centre = best · lighter ↑ / darker ↓ · muted ← / vivid → · tap to swap'
          : s.axis.biDir
          ? 'Your base hue sits centre · analogous neighbours either side ←→ · value ↑ / ↓ · tap to swap'
          : 'Centre = best match · hue ←→ · value (lighter ↑ / darker ↓) · tap to swap'}</span>
        ${renderMatrix(s, i)}
      </div>` : '';
    const wide = (i===0 || state.palette.length===2) ? ' wide' : '';
    return `<div class="slot${wide}">
      <div class="slot-main">
        <span class="chip-big" style="background-color:${c.hex}"></span>
        <div class="meta">
          <div class="role">${s.role}</div>
          <div class="nm">${titleish(c)}</div>
          <div class="sub">${c.hex} · ${c.family}${c.collection?` · ${c.collection}`:''}</div>
          <div class="tags">${tags}</div>
        </div>
        <div class="acts">
          <button data-copy="${c.hex}">Copy hex</button>
          <a href="https://serefni.is/litir/" target="_blank" rel="noopener">Find on Sérefni</a>
        </div>
      </div>
      ${altBlock}
    </div>`;
  }).join('');
  tray.querySelectorAll('.alt-sw').forEach(b=>b.onclick=()=>
    selectAlt(+b.dataset.slot, b.dataset.hex, decodeURIComponent(b.dataset.an)));
  tray.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{
    try{ await navigator.clipboard.writeText(b.dataset.copy); }catch(e){}
    const t=b.textContent; b.textContent='Copied ✓'; setTimeout(()=>{b.textContent=t;},1200);
  });
}
function selectAlt(i, hex, name){
  const s=state.palette[i]; if(!s.axis) return;
  const pick=COLORS.find(c=>c.hex===hex && c.name===name);
  if(pick){ s.color=pick; renderResult(); renderWhy(); renderRatio(); }
}

/* ---------- render: WHY panel ---------- */
function renderWhy(){
  const p=document.getElementById('whyPanel');
  const temps=state.palette.map(s=>emo(s.color).temp);
  const warm=temps.filter(t=>t==='warm').length, cool=temps.filter(t=>t==='cool').length, neu=temps.filter(t=>t==='neutral').length;
  const tot=temps.length||1;
  const moodWords=[...new Set(state.palette.flatMap(s=>emo(s.color).words))].slice(0,5);
  const balanceNote = warm&&cool ? 'This palette balances warm and cool tones, which keeps it from feeling one-note.'
    : warm ? 'An all-warm palette — cosy and energising; ground it with a neutral if it feels intense.'
    : cool ? 'An all-cool palette — calm and composed; add a warm accent if you want more life.'
    : 'A neutral-led palette — quiet and flexible; bring in one saturated accent for focus.';
  p.innerHTML=`
    <div class="why-cell">
      <p>${state.harmony.why}</p>
      <div class="balance">
        <i style="width:${warm/tot*100}%;background:#d08a4e"></i>
        <i style="width:${neu/tot*100}%;background:#c9c3b3"></i>
        <i style="width:${cool/tot*100}%;background:#5a86a8"></i>
      </div>
      <div class="balance-label"><span>${warm} warm</span><span>${neu} neutral</span><span>${cool} cool</span></div>
      <p style="margin:12px 0 0">${balanceNote}</p>
    </div>
    <div class="why-cell">
      <p><strong>Mood:</strong> ${moodWords.join(' · ')||'soft, understated'}.</p>
      <p style="margin-bottom:0"><strong>Often suits:</strong> ${[...new Set(state.palette.map(s=>emo(s.color).rooms))].slice(0,2).join('; ')}.</p>
    </div>`;
}

/* ---------- ratio band with draggable dividers ---------- */
function evenRatios(n){return Array(n).fill(1/n);}
function setPreset(p){
  const n=state.palette.length; if(!n) return;
  if(p==='even') state.ratios=evenRatios(n);
  else if(p==='603010') state.ratios = n===2?[0.65,0.35] : n===3?[0.6,0.3,0.1] : evenRatios(n);
  else if(p==='7030') state.ratios = n===2?[0.7,0.3] : n===3?[0.7,0.2,0.1] : evenRatios(n);
  renderRatio();
}
function renderRatio(){
  const band=document.getElementById('ratioBand');
  const n=state.palette.length; if(!n){band.innerHTML='';return;}
  if(state.ratios.length!==n) state.ratios=evenRatios(n);
  band.innerHTML = state.palette.map((s,i)=>{
    const c=s.color, dark=c.l<55;
    const pct=Math.round(state.ratios[i]*100);
    return `<div class="rseg" data-i="${i}" style="flex:${state.ratios[i]} 0 0;background-color:${c.hex}">
      <div class="rlabel" style="color:${dark?'#fff':'#1c1b19'};background:${dark?'rgba(0,0,0,.28)':'rgba(255,255,255,.4)'}">
        <span class="pct">${pct}%</span><span class="rn">${titleish(c)}</span>
      </div>
    </div>`;
  }).join('');
}

/* ---------- wire up + init ---------- */
function init(){
  document.getElementById('colorCount').textContent=COLORS.length.toLocaleString();
  // count toggle
  document.querySelectorAll('#countToggle .seg-btn').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('#countToggle .seg-btn').forEach(x=>{x.classList.remove('is-active');x.setAttribute('aria-selected','false');});
    b.classList.add('is-active'); b.setAttribute('aria-selected','true');
    state.count=+b.dataset.count; state.harmony=HARMONIES[state.count][0];
    renderHarmonies(); recompute();
  });
  document.getElementById('search').oninput=e=>{state.search=e.target.value; renderGrid();};
  document.getElementById('mutedOnly').onchange=e=>{state.muted=e.target.checked; renderGrid();};
  document.querySelectorAll('.ratio-presets button').forEach(b=>b.onclick=()=>setPreset(b.dataset.preset));

  renderHarmonies(); renderFamilyChips(); renderGrid();

  // sensible default base so the tool isn't empty: a mid Blue
  const def = COLORS.filter(c=>c.family==='Blue'&&!c.neutral).sort((a,b)=>Math.abs(a.l-50)-Math.abs(b.l-50))[0]
            || COLORS.find(c=>!c.neutral);
  if(def){state.base=def; renderGrid(); renderHarmonies(); recompute();}
}
document.addEventListener('DOMContentLoaded', init);
})();
