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
const matchesQuery = (c,q) => c.name.toLowerCase().includes(q)
  || (c.collection||'').toLowerCase().includes(q)
  || (c.aka||[]).some(a=>a.toLowerCase().includes(q));
const akaLine = c => (c.aka&&c.aka.length) ? c.aka.join(' · ') : '';
const escAttr = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;');
const tipFor = c => `${titleish(c)} · ${c.hex}${akaLine(c)?` · aka ${akaLine(c)}`:''}`;
const artic = w => /^[aeiou]/i.test(w) ? 'An' : 'A';   // a/an by the following word

/* hue closeness score for a slot. Normally "closest to the centre hue is best".
   For a bidirectional axis (idealOff set) the centre is the BASE hue, so score by how
   far the colour is from the ideal ±offset instead — best = nearest a true neighbour. */
const hueScore = (c, ax) => ax.idealOff != null
  ? Math.abs(hueDist(c.h, ax.centerHue) - ax.idealOff)
  : hueDist(c.h, ax.centerHue);

/* per-harmony hue tolerance (± degrees from the ideal target before the relationship degrades).
   `minBase` keeps analogous neighbours from collapsing into the base hue. */
const TOL = {
  complementary:{h:30}, analogous2:{h:18,minBase:18}, analogous3:{h:18,minBase:18},
  triadic:{h:28}, split:{h:22},
};

/* does a colour qualify for this slot's tolerance window? */
function qualifies(c, ax, base, others, currentHex){
  if (c.hex===base.hex && c.name===base.name) return false;
  if (c.hex!==currentHex && others.has(c.hex)) return false;
  if (ax.valueOnly){
    if (hueDist(c.h, ax.centerHue) > ax.hueLimit) return false;
    if (ax.dir && (c.l - base.l) * ax.dir <= 0) return false;   // tints/shades stay on their side
    return true;
  }
  if (c.neutral) return false;
  if (c.l<12 || c.l>90) return false;                       // hue stops reading at the extremes
  if (hueDist(c.h, ax.centerHue) > ax.hueLimit) return false;
  if (ax.minBase && hueDist(c.h, base.h) < ax.minBase) return false;
  return true;
}

/* best (textbook) qualifying colour — used as the default pick.
   For hue harmonies, hue distance to the ideal target dominates so the default lands as
   close to the textbook example as possible; lightness is only a fine tiebreak among hue-ties.
   For mono (valueOnly) the textbook pick is the target lightness, so lightness dominates. */
function pickBest(base, ax, used){
  let best=null, bs=1e9;
  for (const c of COLORS){
    if (!qualifies(c, ax, base, used, null)) continue;
    const sc = ax.valueOnly
      ? Math.abs(c.l-ax.centerL) + Math.abs(c.s-base.s)*0.1
      : hueScore(c,ax) + Math.abs(c.l-ax.centerL)*0.02;
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
    // dir keeps each slot's tints/shades on its own side of the base lightness
    const defs = harmony.steps===2
      ? [[clampL(base.l>50 ? base.l-STEP : base.l+STEP), 'Shade', base.l>50?-1:1]]
      : [[clampL(base.l+STEP),'Lighter',1], [clampL(base.l-STEP),'Deeper',-1]];
    for (const [t,role,dir] of defs){
      const ax={valueOnly:true, dir, centerHue:base.h, hueLimit:12, centerL:t, Vval:30, rowMax:3, colMax:2, satBin:14};
      const pick=pickBest(base, ax, used) || pickBestByL(base, ax, used);
      if (pick){ used.add(pick.hex); slots.push({role, color:pick, best:pick, axis:ax}); }
    }
  } else if (harmony.biDir){
    // analogous on BOTH sides: centre the axis on the base hue so the matrix fans out to
    // the -off and +off neighbours symmetrically (centre columns stay empty via minBase).
    const off=harmony.offsets[0], binW=16, colMax=3;
    // dead-zone just past half a column so ONLY the centre column (the base hue) stays empty
    const ax={valueOnly:false, biDir:true, idealOff:off, centerHue:base.h, centerL:base.l,
              binW, hueLimit:(colMax+0.5)*binW, minBase:binW/2+1,
              Vval:30, rowMax:2, colMax};
    const pick=pickBest(base, ax, used);
    if (pick){ used.add(pick.hex); slots.push({role:roleName(off), color:pick, best:pick, axis:ax}); }
  } else {
    const tol = TOL[harmony.id] || {h:18};
    const colMax=2, binW=tol.h/2;
    harmony.offsets.forEach(off=>{
      const ax={valueOnly:false, centerHue:norm(base.h+off), centerL:base.l,
                binW, hueLimit:(colMax+0.5)*binW, minBase:tol.minBase||0,
                Vval:30, rowMax:2, colMax};
      const pick=pickBest(base, ax, used);
      if (pick){ used.add(pick.hex); slots.push({role:roleName(off), color:pick, best:pick, axis:ax}); }
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
    if(ax.dir && (c.l - base.l) * ax.dir <= 0) continue;
    const d=Math.abs(c.l-ax.centerL); if(d<bd){bd=d;best=c;}
  }
  return best;
}

/* every qualifying alternative for this slot, grouped by hue (closest-to-ideal group first)
   and ramped light→dark within each hue group, so the grid reads like a gradient.
   mono axes have ~constant hue, so they collapse to a pure lightness ramp. */
function buildAltList(s, i){
  const ax=s.axis, base=state.base;
  const others=new Set(state.palette.filter((_,k)=>k!==i).map(x=>x.color.hex));
  const list=[];
  for (const c of COLORS){
    if (!qualifies(c, ax, base, others, s.color.hex)) continue;
    list.push(c);
  }
  const binW=ax.binW||12;
  const hueBin=c=> ax.valueOnly ? 0 : Math.round(hueScore(c, ax)/binW);
  list.sort((a,b)=>{
    const ka=hueBin(a), kb=hueBin(b);
    if (ka!==kb) return ka-kb;     // closest-hue group leads
    return b.l - a.l;              // lightest → darkest within a hue group
  });
  return list;
}
function renderAltGrid(s, i){
  const list=buildAltList(s, i), cur=s.color, best=s.best;
  const cells=list.map(c=>{
    const sel=(c.hex===cur.hex && c.name===cur.name)?' is-sel':'';
    const isBest=(best && c.hex===best.hex && c.name===best.name)?' is-best':'';
    const tip=isBest ? `${tipFor(c)} · best match` : tipFor(c);
    return `<button class="swatch${sel}${isBest}" data-slot="${i}" data-hex="${c.hex}"
      data-name="${encodeURIComponent(c.name)}" data-tip="${escAttr(tip)}"
      style="background-color:${c.hex}"></button>`;
  }).join('');
  return `<div class="swatch-grid alt-grid">${cells||`<div class="empty-hint">No alternatives in range.</div>`}</div>`;
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
               palette:[], ratios:[], activeSlot:1, neutralFam:'All', analyze:[null,null,null]};

/* ---------- reverse analysis: classify an arbitrary 2–3 colour set ---------- */
// templates are hue offsets (deg) from a chosen base; the classifier tries each
// colour as base and the best partner assignment, then reports the smallest drift.
const SCHEME_TEMPLATES = {
  2: [
    {id:'mono', name:'Monochromatic', offsets:[0]},
    {id:'analogous', name:'Analogous', offsets:[30]},
    {id:'split', name:'Split-complementary', offsets:[150]},
    {id:'complementary', name:'Complementary', offsets:[180]},
    {id:'triadic', name:'Triadic', offsets:[120]},
  ],
  3: [
    {id:'mono', name:'Monochromatic', offsets:[0,0]},
    {id:'analogous', name:'Analogous', offsets:[-30,30]},
    {id:'triadic', name:'Triadic', offsets:[120,240]},
    {id:'split', name:'Split-complementary', offsets:[150,210]},
  ],
};
function classifyScheme(cols){
  const n=cols.length, tmpls=SCHEME_TEMPLATES[n];
  if(!tmpls) return null;
  let best=null;
  for(let b=0;b<n;b++){
    const others=cols.filter((_,k)=>k!==b);
    const actual=others.map(c=>norm(c.h-cols[b].h));
    const perms = n===3 ? [[0,1],[1,0]] : [[0]];
    for(const t of tmpls){
      for(const perm of perms){
        const drifts=t.offsets.map((o,k)=>hueDist(actual[perm[k]], norm(o)));
        const avg=drifts.reduce((a,d)=>a+d,0)/drifts.length, max=Math.max(...drifts);
        if(!best || avg<best.avg) best={scheme:t, baseIndex:b, perm, drifts, avg, max};
      }
    }
  }
  return best;
}
function driftTier(d){
  if(d<8)  return {label:'textbook',       note:'almost exactly the textbook relationship'};
  if(d<18) return {label:'close',          note:'a close, clearly recognisable match'};
  if(d<32) return {label:'loose',          note:'a loose interpretation of the rule'};
  return       {label:'unconventional', note:'only loosely related — an unconventional pairing'};
}
function analyzeColors(){ return state.analyze.filter(Boolean); }
function analyzeActive(){ return analyzeColors().length>=2; }
/* the colour set currently driving the preview band + why panel */
function previewColors(){
  return analyzeActive() ? analyzeColors() : state.palette.map(s=>s.color);
}

/* neutrals (White / Warm Neutral / Cool Neutral) — browsable any time to swap into a slot.
   Sorted by family group, then light → dark for a readable ramp. */
const NEUTRAL_FAMS=['All','White','Warm Neutral','Cool Neutral'];
const NEUTRALS = COLORS.filter(c=>c.neutral)
  .sort((a,b)=> (NEUTRAL_FAMS.indexOf(a.family)-NEUTRAL_FAMS.indexOf(b.family)) || (b.l-a.l));

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
    if(q && !matchesQuery(c,q)) return false;
    return true;
  });
}
function renderGrid(){
  const grid=document.getElementById('swatchGrid');
  const list=filteredColors();
  document.getElementById('gridCount').textContent=`${list.length} shown`;
  grid.innerHTML=list.map(c=>{
    return `<button class="swatch ${state.base&&state.base.hex===c.hex&&state.base.name===c.name?'is-base':''}"
      style="background-color:${c.hex}" data-hex="${c.hex}" data-name="${encodeURIComponent(c.name)}"
      data-tip="${escAttr(tipFor(c))}"></button>`;
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
  state.ratios=evenRatios(previewColors().length);
  renderResult(); renderWhy(); renderRatio(); renderNeutralPicker(); renderAnalyze();
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
    // alternatives that fit this slot's harmony rule, sorted best-first; tap to swap
    const altBlock = s.axis ? `
      <div class="alts">
        <span class="alts-label">${s.axis.valueOnly
          ? 'Tints & shades that fit — light to dark · tap to swap'
          : 'Alternatives that fit this harmony — grouped by hue · tap to swap'}</span>
        ${renderAltGrid(s, i)}
      </div>` : '';
    const wide = (i===0 || state.palette.length===2) ? ' wide' : '';
    return `<div class="slot${wide}">
      <div class="slot-main">
        <span class="chip-big" style="background-color:${c.hex}"></span>
        <div class="meta">
          <div class="role">${s.role}</div>
          <div class="nm">${titleish(c)}</div>
          <div class="sub">${c.hex} · ${c.family}${c.collection?` · ${c.collection}`:''}</div>
          ${akaLine(c)?`<div class="aka">also known as ${akaLine(c)}</div>`:''}
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
  tray.querySelectorAll('.alt-grid .swatch').forEach(b=>b.onclick=()=>
    selectAlt(+b.dataset.slot, b.dataset.hex, decodeURIComponent(b.dataset.name)));
  tray.querySelectorAll('[data-copy]').forEach(b=>b.onclick=async()=>{
    try{ await navigator.clipboard.writeText(b.dataset.copy); }catch(e){}
    const t=b.textContent; b.textContent='Copied ✓'; setTimeout(()=>{b.textContent=t;},1200);
  });
}
function selectAlt(i, hex, name){
  const s=state.palette[i]; if(!s.axis) return;
  const pick=COLORS.find(c=>c.hex===hex && c.name===name);
  if(pick){
    // keep each alt-grid from jumping to the top when the tray re-renders
    const tray=document.getElementById('paletteTray');
    const scrolls=[...tray.querySelectorAll('.alt-grid')].map(g=>g.scrollTop);
    s.color=pick; renderResult(); renderWhy(); renderRatio();
    [...tray.querySelectorAll('.alt-grid')].forEach((g,k)=>{ if(scrolls[k]!=null) g.scrollTop=scrolls[k]; });
    if(i===state.activeSlot) renderNeutralGrid();
  }
}

/* ---------- render: neutral picker (within Step 3) ---------- */
function renderNeutralPicker(){
  const wrap=document.getElementById('neutralPicker');
  if(!state.palette.length){ wrap.hidden=true; return; }
  wrap.hidden=false;
  if(state.activeSlot==null || state.activeSlot>=state.palette.length)
    state.activeSlot = state.palette.length>1 ? 1 : 0;
  renderNeutralTarget(); renderNeutralFams(); renderNeutralGrid();
}
function renderNeutralTarget(){
  const t=document.getElementById('neutralTarget');
  t.innerHTML=state.palette.map((s,i)=>
    `<button class="seg-btn ${i===state.activeSlot?'is-active':''}" data-slot="${i}"
       role="tab" aria-selected="${i===state.activeSlot}">${s.role}</button>`).join('');
  t.querySelectorAll('.seg-btn').forEach(b=>b.onclick=()=>{
    state.activeSlot=+b.dataset.slot; renderNeutralTarget(); renderNeutralGrid();
  });
}
function renderNeutralFams(){
  const f=document.getElementById('neutralFams');
  f.innerHTML=NEUTRAL_FAMS.map(fam=>
    `<button class="fchip ${state.neutralFam===fam?'is-active':''}" data-f="${fam}">
       ${fam==='All'?'':`<span class="dot" style="background:${familySwatchColor(fam)}"></span>`}${fam}
     </button>`).join('');
  f.querySelectorAll('.fchip').forEach(b=>b.onclick=()=>{
    state.neutralFam=b.dataset.f; renderNeutralFams(); renderNeutralGrid();
  });
}
function renderNeutralGrid(){
  const grid=document.getElementById('neutralGrid');
  const cur=state.palette[state.activeSlot] && state.palette[state.activeSlot].color;
  const list=NEUTRALS.filter(c=>state.neutralFam==='All' || c.family===state.neutralFam);
  grid.innerHTML=list.map(c=>{
    const sel=cur && cur.hex===c.hex && cur.name===c.name ? ' is-sel' : '';
    return `<button class="swatch${sel}" style="background-color:${c.hex}"
      data-hex="${c.hex}" data-name="${encodeURIComponent(c.name)}"
      data-tip="${escAttr(tipFor(c))}"></button>`;
  }).join('')
    + (list.length===0?`<div class="empty-hint">No neutrals in this group.</div>`:'');
  grid.querySelectorAll('.swatch').forEach(b=>b.onclick=()=>{
    const nm=decodeURIComponent(b.dataset.name);
    const pick=NEUTRALS.find(c=>c.hex===b.dataset.hex && c.name===nm);
    const s=state.palette[state.activeSlot];
    if(!pick || !s) return;
    s.color=pick;
    renderResult(); renderWhy(); renderRatio(); renderNeutralGrid();
  });
}

/* ---------- render: analyse-your-own-colours ---------- */
function renderAnalyze(){ renderAnalyzeSlots(); renderAnalyzeResult(); }

function renderAnalyzeSlots(){
  const wrap=document.getElementById('analyzeSlots');
  wrap.innerHTML=state.analyze.map((c,i)=> c
    ? `<div class="aslot" data-i="${i}">
         <button class="achip" data-i="${i}" title="Remove this colour">
           <span class="achip-sw" style="background:${c.hex}"></span>
           <span class="achip-meta"><span class="achip-nm">${titleish(c)}</span><span class="achip-hex">${c.hex} · ${c.family}</span></span>
           <span class="achip-x" aria-hidden="true">✕</span>
         </button>
       </div>`
    : `<div class="aslot" data-i="${i}">
         <input class="asearch" data-i="${i}" placeholder="${i<2?'Search a colour…':'Add a third (optional)…'}" autocomplete="off">
         <div class="aresults" data-i="${i}" hidden></div>
       </div>`).join('');
  wrap.querySelectorAll('.asearch').forEach(inp=>{
    inp.oninput=()=>showAnalyzeResults(+inp.dataset.i, inp.value);
    inp.onfocus =()=>showAnalyzeResults(+inp.dataset.i, inp.value);
    inp.onblur  =()=>setTimeout(()=>{const d=wrap.querySelector(`.aresults[data-i="${inp.dataset.i}"]`); if(d) d.hidden=true;},150);
  });
  wrap.querySelectorAll('.achip').forEach(b=>b.onclick=()=>{ state.analyze[+b.dataset.i]=null; afterAnalyzeChange(); });
}
function showAnalyzeResults(i, q){
  const d=document.querySelector(`.aresults[data-i="${i}"]`); if(!d) return;
  q=(q||'').trim().toLowerCase();
  if(!q){ d.hidden=true; d.innerHTML=''; return; }
  const chosen=new Set(analyzeColors().map(c=>c.hex+c.name));
  const top=COLORS.filter(c=>!chosen.has(c.hex+c.name) && matchesQuery(c,q)).slice(0,10);
  d.innerHTML = top.length ? top.map(c=>
    `<button class="ares" data-i="${i}" data-hex="${c.hex}" data-name="${encodeURIComponent(c.name)}">
       <span class="ares-sw" style="background:${c.hex}"></span>
       <span class="ares-nm">${titleish(c)}</span><span class="ares-hex">${c.hex}</span>
     </button>`).join('') : `<div class="ares-empty">No matches</div>`;
  d.hidden=false;
  d.querySelectorAll('.ares').forEach(b=>b.onmousedown=e=>{
    e.preventDefault();
    const nm=decodeURIComponent(b.dataset.name);
    state.analyze[+b.dataset.i]=COLORS.find(c=>c.hex===b.dataset.hex && c.name===nm)||null;
    afterAnalyzeChange();
  });
}
function analyzeWheelSVG(cl, cols){
  const size=132, r=50, cx=66, cy=66;
  const pt=(hue,rad)=>{const a=(norm(hue)-90)*Math.PI/180; return [cx+rad*Math.cos(a), cy+rad*Math.sin(a)];};
  let s=`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="awheel" aria-hidden="true">`;
  s+=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ddd9cf" stroke-width="2"/>`;
  const base=cols[cl.baseIndex];
  [base.h, ...cl.scheme.offsets.map(o=>norm(base.h+o))].forEach(h=>{
    const [x,y]=pt(h,r); s+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6.5" fill="none" stroke="#9a958a" stroke-width="1.5" stroke-dasharray="2 2"/>`;
  });
  cols.forEach((c,i)=>{const [x,y]=pt(c.h,r);
    s+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${i===cl.baseIndex?7:6}" fill="${c.hex}" stroke="#fff" stroke-width="2"/>`;});
  return s+`</svg>`;
}
function renderAnalyzeResult(){
  const box=document.getElementById('analyzeResult');
  const cols=analyzeColors();
  if(cols.length<2){ box.hidden=true; box.innerHTML=''; return; }
  const cl=classifyScheme(cols), tier=driftTier(cl.avg), base=cols[cl.baseIndex];
  const others=cols.filter((_,k)=>k!==cl.baseIndex);
  const nWord = cols.length===2?'two':'three';
  const verdict = cl.scheme.id==='mono'
    ? `they all sit within ${Math.round(cl.max)}° of a single hue — ${tier.note}.`
    : `${tier.note}, about ${Math.round(cl.avg)}° off the textbook ideal${cols.length===3?`, ${Math.round(cl.max)}° at most`:''}.`;
  const lines = [`<li><strong>${titleish(base)}</strong> — base hue ${Math.round(base.h)}°</li>`]
    .concat(cl.scheme.offsets.map((off,k)=>{
      const partner=others[cl.perm[k]], actual=norm(partner.h-base.h), drift=Math.round(hueDist(actual, norm(off)));
      const ideal = cl.scheme.id==='mono' ? 'same hue' : `ideal ${Math.round(norm(off))}°`;
      return `<li>${titleish(partner)} — ${Math.round(actual)}° from base (${ideal}, ${drift}° drift)</li>`;
    }));
  box.hidden=false;
  box.innerHTML=`
    <div class="ares-wheel">${analyzeWheelSVG(cl, cols)}</div>
    <div class="ares-text">
      <p class="ares-verdict">These ${nWord} read as <strong>${cl.scheme.name}</strong> — ${verdict}</p>
      <ul class="ares-lines">${lines.join('')}</ul>
      <p class="hint" style="margin:0">Driving the preview below. Clear a colour to return to your scheme.</p>
    </div>`;
}
function afterAnalyzeChange(){
  state.ratios=evenRatios(previewColors().length);
  renderAnalyze(); renderRatio(); renderWhy();
}

/* how far each generated partner landed from its textbook target — mirrors the
   analyser's drift readout, but measured against the harmony we deliberately built. */
function paletteTheory(){
  const slots=state.palette; if(slots.length<2) return null;
  const base=slots[0].color, partners=slots.slice(1);
  if(state.harmony.mono){
    const spread=Math.max(0,...partners.map(s=>hueDist(s.color.h, base.h)));
    const lines=partners.map(s=>
      `<li><strong>${titleish(s.color)}</strong> — ${s.role.toLowerCase()}, L ${Math.round(s.color.l)} vs base L ${Math.round(base.l)} · ${Math.round(hueDist(s.color.h,base.h))}° off the base hue</li>`);
    return {mono:true, avg:spread, max:spread, lines};
  }
  const drifts=[];
  const lines=[`<li><strong>${titleish(base)}</strong> — base hue ${Math.round(base.h)}°</li>`]
    .concat(partners.map(s=>{
      const ax=s.axis, actual=norm(s.color.h-base.h);
      let idealOff, drift;
      if(ax.idealOff!=null){                                   // biDir analogous: nearest neighbour side
        idealOff = actual<=180 ? ax.idealOff : norm(-ax.idealOff);
        drift = Math.abs(hueDist(s.color.h, base.h) - ax.idealOff);
      } else {
        idealOff = norm(ax.centerHue - base.h);
        drift = hueDist(s.color.h, ax.centerHue);
      }
      drifts.push(drift);
      return `<li><strong>${titleish(s.color)}</strong> — ${Math.round(actual)}° from base (ideal ${Math.round(idealOff)}°, ${Math.round(drift)}° drift)</li>`;
    }));
  const avg=drifts.reduce((a,d)=>a+d,0)/(drifts.length||1), max=Math.max(0,...drifts);
  return {mono:false, avg, max, lines};
}

/* ---------- render: WHY panel ---------- */
function renderWhy(){
  const p=document.getElementById('whyPanel');
  const cols=previewColors();
  const temps=cols.map(c=>emo(c).temp);
  const warm=temps.filter(t=>t==='warm').length, cool=temps.filter(t=>t==='cool').length, neu=temps.filter(t=>t==='neutral').length;
  const tot=temps.length||1;
  const moodWords=[...new Set(cols.flatMap(c=>emo(c).words))].slice(0,5);

  // deviation-from-theory readout — same shape as "Analyse your own colours"
  let verdict='', lines=[], blurb='';
  if(analyzeActive()){
    const ac=analyzeColors(), cl=classifyScheme(ac), tier=driftTier(cl.avg);
    const base=ac[cl.baseIndex], others=ac.filter((_,k)=>k!==cl.baseIndex);
    verdict = cl.scheme.id==='mono'
      ? `Your selection reads as <strong>${cl.scheme.name}</strong> — all within ${Math.round(cl.max)}° of one hue, ${tier.note}.`
      : `Your selection reads as <strong>${cl.scheme.name}</strong> — ${tier.note}, about ${Math.round(cl.avg)}° off the textbook ideal${ac.length===3?`, ${Math.round(cl.max)}° at most`:''}.`;
    lines=[`<li><strong>${titleish(base)}</strong> — base hue ${Math.round(base.h)}°</li>`]
      .concat(cl.scheme.offsets.map((off,k)=>{
        const partner=others[cl.perm[k]], actual=norm(partner.h-base.h), drift=Math.round(hueDist(actual, norm(off)));
        const ideal = cl.scheme.id==='mono' ? 'same hue' : `ideal ${Math.round(norm(off))}°`;
        return `<li><strong>${titleish(partner)}</strong> — ${Math.round(actual)}° from base (${ideal}, ${drift}° drift)</li>`;
      }));
  } else {
    const t=paletteTheory();
    if(t){
      const tier=driftTier(t.avg); lines=t.lines;
      verdict = t.mono
        ? `${artic(state.harmony.name)} <strong>${state.harmony.name}</strong> scheme — your tones sit within ${Math.round(t.max)}° of a single hue, ${tier.note}.`
        : `${artic(state.harmony.name)} <strong>${state.harmony.name}</strong> scheme — these picks land ${tier.note}, about ${Math.round(t.avg)}° off the textbook ideal${t.lines.length>2?`, ${Math.round(t.max)}° at most`:''}.`;
    }
    blurb=state.harmony.why;
  }

  const balanceNote = warm&&cool ? 'This palette balances warm and cool tones, which keeps it from feeling one-note.'
    : warm ? 'An all-warm palette — cosy and energising; ground it with a neutral if it feels intense.'
    : cool ? 'An all-cool palette — calm and composed; add a warm accent if you want more life.'
    : 'A neutral-led palette — quiet and flexible; bring in one saturated accent for focus.';
  p.innerHTML=`
    <div class="why-cell">
      ${verdict?`<p class="ares-verdict">${verdict}</p>`:''}
      ${lines.length?`<ul class="ares-lines">${lines.join('')}</ul>`:''}
      ${blurb?`<p>${blurb}</p>`:''}
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
      <p style="margin-bottom:0"><strong>Often suits:</strong> ${[...new Set(cols.map(c=>emo(c).rooms))].slice(0,2).join('; ')}.</p>
    </div>`;
}

/* ---------- ratio band with draggable dividers ---------- */
function evenRatios(n){return Array(n).fill(1/n);}
function setPreset(p){
  const n=previewColors().length; if(!n) return;
  if(p==='even') state.ratios=evenRatios(n);
  else if(p==='603010') state.ratios = n===2?[0.65,0.35] : n===3?[0.6,0.3,0.1] : evenRatios(n);
  else if(p==='7030') state.ratios = n===2?[0.7,0.3] : n===3?[0.7,0.2,0.1] : evenRatios(n);
  renderRatio();
}
function renderRatio(){
  const band=document.getElementById('ratioBand');
  const cols=previewColors(), n=cols.length; if(!n){band.innerHTML='';return;}
  if(state.ratios.length!==n) state.ratios=evenRatios(n);
  band.innerHTML = cols.map((c,i)=>{
    const dark=c.l<55;
    const pct=Math.round(state.ratios[i]*100);
    return `<div class="rseg" data-i="${i}" style="flex:${state.ratios[i]} 0 0;background-color:${c.hex}">
      <div class="rlabel" style="color:${dark?'#fff':'#1c1b19'};background:${dark?'rgba(0,0,0,.28)':'rgba(255,255,255,.4)'}">
        <span class="pct">${pct}%</span><span class="rn">${titleish(c)}</span>
      </div>
    </div>`;
  }).join('');
}

/* ---------- wire up + init ---------- */
/* ---------- shared floating tooltip (escapes scroll-container clipping) ---------- */
const floatTip = document.createElement('div');
floatTip.id='floatTip';
function positionTip(sw){
  const r=sw.getBoundingClientRect(), m=8;
  const tw=floatTip.offsetWidth, th=floatTip.offsetHeight;
  let left=Math.max(m, Math.min(r.left + r.width/2 - tw/2, innerWidth - tw - m));
  let top=r.top - th - 8;
  if(top < m) top=r.bottom + 8;            // flip below when no room above
  floatTip.style.left=left+'px'; floatTip.style.top=top+'px';
}
function bindGridTips(container){
  const show=e=>{ const sw=e.target.closest('.swatch[data-tip]'); if(!sw||!container.contains(sw)) return;
    floatTip.textContent=sw.dataset.tip; floatTip.classList.add('show'); positionTip(sw); };
  container.addEventListener('mouseover', show);
  container.addEventListener('mousemove', e=>{ const sw=e.target.closest('.swatch[data-tip]'); if(sw) positionTip(sw); });
  container.addEventListener('mouseout', e=>{
    const sw=e.target.closest('.swatch[data-tip]');
    const to=e.relatedTarget&&e.relatedTarget.closest?e.relatedTarget.closest('.swatch[data-tip]'):null;
    if(sw && to!==sw) floatTip.classList.remove('show');
  });
  container.addEventListener('scroll', ()=>floatTip.classList.remove('show'));
}

function init(){
  document.getElementById('colorCount').textContent=COLORS.length.toLocaleString();
  document.body.appendChild(floatTip);
  bindGridTips(document.getElementById('swatchGrid'));
  bindGridTips(document.getElementById('neutralGrid'));
  bindGridTips(document.getElementById('paletteTray'));
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

  renderHarmonies(); renderFamilyChips(); renderGrid(); renderAnalyze();

  // sensible default base so the tool isn't empty: a mid Blue
  const def = COLORS.filter(c=>c.family==='Blue'&&!c.neutral).sort((a,b)=>Math.abs(a.l-50)-Math.abs(b.l-50))[0]
            || COLORS.find(c=>!c.neutral);
  if(def){state.base=def; renderGrid(); renderHarmonies(); recompute();}
}
document.addEventListener('DOMContentLoaded', init);
})();
