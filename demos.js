/* Animated exercise demos: inline SVG stick figures, no external assets.
   DEMOS[id] = { pose(p) -> {segs, head, dbs, props, glow}, seq: [[targetP, seconds, label], ...] }
   p=0 is the start position; seq walks p between 0 and 1 with the real tempo. */
(function(){
const L=(a,b,p)=>[a[0]+(b[0]-a[0])*p,a[1]+(b[1]-a[1])*p], A=(a,b)=>[a[0]+b[0],a[1]+b[1]];
const bench=[{x:38,y:96,w:120,h:8},{x:50,y:104,w:6,h:37},{x:140,y:104,w:6,h:37}];
const D={
  'goblet-squat':{ seq:[[1,3,'Lower · 3 sec'],[1,.5,'Pause'],[0,1.5,'Stand up'],[0,.8,'']],
    pose:p=>{const sh=L([100,40],[92,62],p),hip=L([100,88],[78,106],p),knee=L([102,113],[116,110],p),an=[100,140],hand=A(sh,[16,6]);
      return {head:A(sh,[4,-18]),segs:[[sh,hip],[hip,knee,1],[knee,an,1],[an,[114,140]],[sh,A(sh,[10,18])],[A(sh,[10,18]),hand]],dbs:[[hand,1]],glow:[L(hip,knee,.4)]};}},
  'bench-press':{ seq:[[1,3,'Lower · 3 sec'],[1,.3,''],[0,1.5,'Press up'],[0,.8,'']],
    pose:p=>{const s=[62,88],hip=[122,90],el=L([66,50],[84,98],p),h=L([64,20],[68,64],p);
      return {props:bench,head:[44,86],segs:[[s,hip],[hip,[144,78]],[[144,78],[150,141]],[s,el,1],[el,h,1]],dbs:[[h,0]],glow:[[70,82]]};}},
  'one-arm-row':{ seq:[[1,1.5,'Pull to hip'],[1,.6,'Squeeze'],[0,2.5,'Lower · slow'],[0,.5,'']],
    pose:p=>{const s=[60,66],hip=[122,62],el=L([64,96],[96,48],p),h=L([66,122],[90,76],p);
      return {props:[{x:24,y:92,w:120,h:8},{x:34,y:100,w:6,h:41},{x:128,y:100,w:6,h:41}],head:[44,62],
        segs:[[s,hip,1],[hip,[124,90]],[[124,90],[142,90]],[hip,[150,112]],[[150,112],[152,141]],[s,[56,90]],[s,el,1],[el,h,1]],dbs:[[h,1]],glow:[[86,62]]};}},
  'rdl':{ seq:[[1,3,'Hinge back · 3 sec'],[1,.3,''],[0,1.5,'Squeeze up'],[0,.8,'']],
    pose:p=>{const hip=L([100,88],[84,86],p),sh=L([100,40],[130,62],p),knee=L([102,113],[106,113],p),an=[100,140],h=A(sh,[0,40]);
      return {head:L([100,22],[146,54],p),segs:[[sh,hip,1],[hip,knee,1],[knee,an],[an,[114,140]],[sh,h]],dbs:[[h,1]],glow:[L(hip,knee,.5)]};}},
  'seated-press':{ seq:[[1,1.5,'Press up'],[1,.4,''],[0,2.5,'Lower · slow'],[0,.6,'']],
    pose:p=>{const hip=[96,104],sh=[96,58],el=L([80,70],[86,36],p),h=L([82,48],[90,8],p);
      return {props:[{x:70,y:106,w:52,h:8},{x:70,y:50,w:8,h:58},{x:78,y:114,w:6,h:27},{x:110,y:114,w:6,h:27}],head:[98,40],
        segs:[[sh,hip],[hip,[128,104]],[[128,104],[130,141]],[sh,el,1],[el,h,1]],dbs:[[h,0]],glow:[[92,60]]};}},
  'glute-bridge':{ seq:[[1,1.5,'Drive hips up'],[1,1,'Squeeze · 1 sec'],[0,2,'Lower slowly'],[0,.6,'']],
    pose:p=>{const sh=[52,134],hip=L([98,136],[102,106],p),knee=[132,104],an=[142,140];
      return {props:[{x:14,y:141,w:172,h:0}],head:[36,130],segs:[[sh,hip,1],[hip,knee,1],[knee,an],[an,[154,140]],[sh,A(hip,[-8,-4])]],dbs:[[A(hip,[0,-9]),1]],glow:[A(hip,[4,0])]};}},
  'dead-bug':{ seq:[[1,2,'Reach out · slow'],[1,.5,''],[0,2,'Return'],[0,.5,'']],
    pose:p=>{const sh=[62,128],hip=[112,128],h1=L([64,92],[26,122],p),k2=L([114,100],[138,118],p),a2=L([138,100],[168,124],p);
      return {head:[46,126],segs:[[sh,hip],[sh,[62,92]],[hip,[112,100]],[[112,100],[136,100]],[sh,h1,1],[hip,k2,1],[k2,a2,1]],dbs:[],glow:[[88,124]]};}},
  'reverse-lunge':{ seq:[[1,2.5,'Step back, lower'],[1,.4,''],[0,1.5,'Step up'],[0,.6,'']],
    pose:p=>{const sh=L([100,40],[98,58],p),hip=L([100,88],[98,106],p),fk=L([102,113],[122,110],p),bk=L([102,113],[86,134],p),bf=L([100,140],[66,140],p),h=A(sh,[2,38]);
      return {head:A(sh,[0,-18]),segs:[[sh,hip],[hip,fk,1],[fk,[120,140],1],[hip,bk],[bk,bf],[sh,h]],dbs:[[h,1]],glow:[L(hip,fk,.5)]};}},
  'calf-raise':{ seq:[[1,1,'Rise'],[1,.6,'Pause'],[0,2,'Lower · 2 sec'],[0,.4,'']],
    pose:p=>{const u=-12*p,sh=[100,40+u],hip=[100,88+u],knee=[101,113+u],an=[100+4*p,138+u],h=A(sh,[2,40]);
      return {props:[{x:160,y:10,w:8,h:131}],head:A(sh,[0,-18]),segs:[[sh,hip],[hip,knee],[knee,an,1],[an,[114,140],1],[sh,h]],dbs:[[h,1]],glow:[L(knee,an,.4)]};}},
  'biceps-curl':{ seq:[[1,1.5,'Curl up'],[1,.4,''],[0,2.5,'Lower · slow'],[0,.5,'']],
    pose:p=>{const sh=[100,40],el=[102,66],h=[el[0]+26*Math.sin(p*2.4),el[1]+26*Math.cos(p*2.4)];
      return {head:[100,22],segs:[[sh,[100,88]],[[100,88],[102,113]],[[102,113],[100,140]],[[100,140],[114,140]],[sh,el,1],[el,h,1]],dbs:[[h,1]],glow:[L(sh,el,.6)]};}},
  'overhead-triceps':{ seq:[[1,2.5,'Lower behind head'],[1,.3,''],[0,1.5,'Extend up'],[0,.6,'']],
    pose:p=>{const sh=[100,40],el=[106,10],h=L([104,-16],[84,22],p);
      return {head:[100,22],segs:[[sh,[100,88]],[[100,88],[102,113]],[[102,113],[100,140]],[[100,140],[114,140]],[sh,el],[el,h,1]],dbs:[[h,0]],glow:[L(sh,el,.6)]};}},
  'incline-fly':{ seq:[[1,3,'Open wide · 3 sec'],[1,.3,''],[0,1.5,'Hug together'],[0,.6,'']],
    pose:p=>{const s=[70,76],hip=[124,96],el=L([70,32],[48,62],p),h=L([72,14],[30,58],p);
      return {props:[{x:44,y:66,w:90,h:8,r:1},{x:100,y:90,w:6,h:51}],head:[54,66],segs:[[s,hip],[hip,[146,92]],[[146,92],[150,141]],[s,el,1],[el,h,1]],dbs:[[h,0]],glow:[[78,70]]};}},
  'push-up':{ seq:[[1,2.5,'Lower · slow'],[1,.3,''],[0,1.5,'Push up'],[0,.6,'']],
    pose:p=>{const sh=L([60,90],[60,112],p),an=[160,138],h=[60,140],el=L([62,116],[78,128],p);
      return {head:A(sh,[-16,-6]),segs:[[sh,L(sh,an,.45)],[L(sh,an,.45),an],[sh,el,1],[el,h,1]],dbs:[],glow:[A(sh,[6,4])]};}},
  'generic':{ seq:[[1,1.5,''],[0,1.5,'']],
    pose:p=>{const sh=[100,40],hl=L([94,86],[70,12],p),hr=L([106,86],[130,12],p);
      return {head:[100,22],segs:[[sh,[100,88]],[[100,88],[92,140]],[[100,88],[108,140]],[sh,hl],[sh,hr]],dbs:[[hl,0],[hr,0]],glow:[]};}}
};
const ALIAS={'squat':'goblet-squat','db-bench-press':'bench-press','bench':'bench-press','row':'one-arm-row','dumbbell-row':'one-arm-row','romanian-deadlift':'rdl','shoulder-press':'seated-press','ohp':'seated-press','hip-bridge':'glute-bridge','glute-bridges':'glute-bridge','deadbug':'dead-bug','lunge':'reverse-lunge','curl':'biceps-curl','triceps':'overhead-triceps','triceps-extension':'overhead-triceps','fly':'incline-fly'};
function find(id){ id=String(id||'').toLowerCase(); if(D[id]) return D[id]; if(ALIAS[id]) return D[ALIAS[id]];
  for(const k of Object.keys(D)) if(id.includes(k)) return D[k]; for(const k of Object.keys(ALIAS)) if(id.includes(k)) return D[ALIAS[k]]; return D.generic; }
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
function at(seq,t){ const total=seq.reduce((s,x)=>s+x[1],0); t%=total; let prev=seq[seq.length-1][0];
  for(const [to,dur,lab] of seq){ if(t<dur) return {p:prev+(to-prev)*ease(t/dur),label:lab}; t-=dur; prev=to; } return {p:prev,label:''}; }
const NS='http://www.w3.org/2000/svg';
function draw(svg,pose,col){
  const parts=['<line x1="8" y1="141" x2="192" y2="141" stroke="#cfc8e8" stroke-width="2"/>'];
  (pose.props||[]).forEach(r=>{ if(r.h>0) parts.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="3" fill="#b9b3d1"/>`); });
  (pose.glow||[]).forEach(g=>parts.push(`<circle cx="${g[0]}" cy="${g[1]}" r="15" fill="${col}" opacity=".22"/>`));
  pose.segs.forEach(s=>{ const [a,b,hot]=s; if(hot) parts.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${col}" stroke-width="13" stroke-linecap="round" opacity=".28"/>`);
    parts.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${hot?col:'#1d1b2e'}" stroke-width="${hot?7:6}" stroke-linecap="round"/>`); });
  parts.push(`<circle cx="${pose.head[0]}" cy="${pose.head[1]}" r="10" fill="#1d1b2e"/>`);
  (pose.dbs||[]).forEach(([d,vert])=>parts.push(vert?
    `<g transform="translate(${d[0]},${d[1]})"><rect x="-2" y="-10" width="4" height="20" rx="2" fill="#f0a500"/><rect x="-7" y="-13" width="14" height="6" rx="2" fill="#f0a500"/><rect x="-7" y="7" width="14" height="6" rx="2" fill="#f0a500"/></g>`:
    `<g transform="translate(${d[0]},${d[1]})"><rect x="-10" y="-2" width="20" height="4" rx="2" fill="#f0a500"/><rect x="-13" y="-7" width="6" height="14" rx="2" fill="#f0a500"/><rect x="7" y="-7" width="6" height="14" rx="2" fill="#f0a500"/></g>`));
  svg.innerHTML=parts.join('');
}
const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
let playing = localStorage.getItem('wk.demoPlay') ? localStorage.getItem('wk.demoPlay')==='1' : !reduce;
const live=new Set(); let t0=performance.now(), raf=0;
const io='IntersectionObserver' in window ? new IntersectionObserver(es=>es.forEach(e=>e.isIntersecting?live.add(e.target):live.delete(e.target)),{rootMargin:'100px'}) : null;
function frame(now){ const t=(now-t0)/1000; live.forEach(el=>paintOne(el,t)); raf=playing?requestAnimationFrame(frame):0; }
function paintOne(el,t){ const d=find(el.dataset.demo), r=at(d.seq,t); draw(el.querySelector('svg'),d.pose(r.p),el.dataset.col||'#5b3df5'); el.querySelector('.dlab').textContent = playing ? (r.label||'\u00a0') : 'Paused · tap ▶ to play'; }
function syncBtns(){ document.querySelectorAll('.dplay').forEach(b=>{ b.textContent=playing?'❚❚ Pause':'▶ Play'; b.setAttribute('aria-pressed',String(playing)); }); }
window.Demos={
  html:(id,col)=>`<div class="demo" data-demo="${id}" data-col="${col||''}"><svg viewBox="0 -20 200 165" role="img" aria-label="Animated demo of the movement"></svg><div class="dbar"><span class="dlab">&nbsp;</span><button class="dplay" type="button">❚❚ Pause</button></div></div>`,
  mount(root){ root.querySelectorAll('.demo').forEach(el=>{ if(io) io.observe(el); else live.add(el); paintOne(el, playing?(performance.now()-t0)/1000:0.9); }); syncBtns(); if(playing&&!raf) raf=requestAnimationFrame(frame); },
  toggle(){ playing=!playing; localStorage.setItem('wk.demoPlay',playing?'1':'0'); syncBtns(); if(playing){ if(!raf) raf=requestAnimationFrame(frame);} else document.querySelectorAll('.demo').forEach(el=>{ el.querySelector('.dlab').textContent='Paused · tap ▶ to play'; }); },
  ids:Object.keys(D)
};
document.addEventListener('click',e=>{ if(e.target.closest('.dplay')||e.target.closest('.demo svg')) window.Demos.toggle(); });
})();
