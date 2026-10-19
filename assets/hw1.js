'use strict';

const PRIME = 17;
const POINTS = [];
for (let x = 0; x < PRIME; x++) {
  for (let y = 0; y < PRIME; y++) {
    if ((y * y - x * x * x - 7) % PRIME === 0) POINTS.push([x, y]);
  }
}

const mod = n => ((n % PRIME) + PRIME) % PRIME;
const same = (a, b) => a === null ? b === null : b !== null && a[0] === b[0] && a[1] === b[1];
const fmt = p => p === null ? 'O (∞)' : `(${p[0]}, ${p[1]})`;

function inverse(n) {
  const v = mod(n);
  for (let i = 1; i < PRIME; i++) if (mod(i * v) === 1) return i;
  throw new Error(`Non esiste l'inverso di ${v}.`);
}

function add(a, b) {
  if (a === null || b === null) return {result: a ?? b, slope: null, kind: 'identity', formula: 'P + O = P'};
  const [x1, y1] = a;
  const [x2, y2] = b;
  if (x1 === x2 && mod(y1 + y2) === 0) {
    return {result: null, slope: null, kind: 'infinity', formula: 'P + (−P) = O'};
  }
  const doubling = same(a, b);
  const numerator = mod(doubling ? 3 * x1 * x1 : y2 - y1);
  const denominator = mod(doubling ? 2 * y1 : x2 - x1);
  const inv = inverse(denominator);
  const slope = mod(numerator * inv);
  const x3 = mod(slope * slope - x1 - x2);
  const y3 = mod(slope * (x1 - x3) - y1);
  return {
    result: [x3, y3],
    slope,
    kind: doubling ? 'doubling' : 'addition',
    reflected: [x3, mod(-y3)],
    formula: `λ = ${numerator} × ${denominator}⁻¹ = ${numerator} × ${inv} ≡ ${slope} (mod 17); R = (${x3}, ${y3})`
  };
}

function scalar(point, k) {
  let result = null;
  let base = point;
  while (k > 0) {
    if (k % 2 === 1) result = add(result, base).result;
    base = add(base, base).result;
    k = Math.floor(k / 2);
  }
  return result;
}

function orderOf(point) {
  let current = null;
  for (let n = 1; n <= POINTS.length + 1; n++) {
    current = add(current, point).result;
    if (current === null) return n;
  }
  throw new Error('Ordine del punto non individuato.');
}

function sequence(point, k, method) {
  const steps = [];
  if (method === 'naive') {
    let current = null;
    for (let i = 1; i <= k; i++) {
      const prev = current;
      const operation = add(current, point);
      current = operation.result;
      steps.push({label: `${i}G = ${i - 1}G + G`, left: prev, right: point, result: current, operation});
    }
  } else {
    let current = null;
    const bits = k.toString(2);
    for (const bit of bits) {
      if (steps.length === 0 && current === null && bit === '1') {
        const operation = add(null, point);
        current = operation.result;
        steps.push({label: 'Bit 1: inizializza R ← G', left: null, right: point, result: current, operation});
        continue;
      }
      const prev = current;
      const doubling = add(current, current);
      current = doubling.result;
      steps.push({label: `Bit ${bit}: raddoppia R`, left: prev, right: prev, result: current, operation: doubling});
      if (bit === '1') {
        const before = current;
        const operation = add(current, point);
        current = operation.result;
        steps.push({label: 'Bit 1: R ← R + G', left: before, right: point, result: current, operation});
      }
    }
  }
  return steps;
}

const els = {};
let steps = [];
let frame = 0;
let ticker = null;
const allById = ids => ids.forEach(id => els[id] = document.getElementById(id));

function halt() {
  if (ticker !== null) clearInterval(ticker);
  ticker = null;
  els.btnPlay.textContent = 'Play';
}

function locationOnGrid(point, canvas) {
  const left = 38;
  const step = (canvas.width - 2 * left) / (PRIME - 1);
  return [left + point[0] * step, canvas.height - left - point[1] * step];
}

function dot(ctx, p, color, radius, label) {
  if (p === null) return;
  const [x,y] = locationOnGrid(p, ctx.canvas);
  ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
  if (label) {
    ctx.fillStyle = '#19233a';ctx.font = 'bold 13px sans-serif';
    ctx.fillText(label, x+7, y-8);
  }
}

function paint() {
  const ctx = els.eccCanvas.getContext('2d');
  const {width:w,height:h} = ctx.canvas;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#fbfdff';ctx.fillRect(0,0,w,h);
  ctx.lineWidth=1;ctx.strokeStyle='#e6edf5';ctx.font='10px ui-monospace, monospace';ctx.fillStyle='#8591a4';
  for (let i = 0; i < PRIME; i++) {
    const [x, yTop] = locationOnGrid([i, PRIME-1],ctx.canvas);
    const [, yBottom] = locationOnGrid([i,0],ctx.canvas);
    ctx.beginPath();ctx.moveTo(x,38);ctx.lineTo(x,h-38);ctx.stroke();
    ctx.beginPath();ctx.moveTo(38,yBottom-i*(h-76)/(PRIME-1));ctx.lineTo(w-38,yBottom-i*(h-76)/(PRIME-1));ctx.stroke();
    ctx.fillText(String(i),x-(i>=10?6:3),h-17);
    ctx.fillText(String(i),12,yBottom-i*(h-76)/(PRIME-1)+4);
  }
  for (const p of POINTS) dot(ctx,p,'#9baec7',3.7,'');
  const s=steps[frame];
  if (!s) return;
  if (s.operation.slope !== null && s.left !== null) {
    const {slope} = s.operation;
    for (let x=0;x<PRIME;x++) dot(ctx,[x,mod(slope*(x-s.left[0])+s.left[1])],'#f0bb56',2.1,'');
  }
  if (s.operation.reflected && s.result) dot(ctx,s.operation.reflected,'#e5a6a3',5,'−R');
  if (s.left) dot(ctx,s.left,'#496ce8',7,'P');
  if (s.right) dot(ctx,s.right,'#f59e4b',5.5,'G');
  dot(ctx,s.result,'#059b82',8.5,'R');
  if (!s.result) {
    ctx.font='bold 14px sans-serif';ctx.fillStyle='#167e70';
    ctx.fillText('Risultato: O (punto all’infinito)',46,24);
  }
}

function displayFrame() {
  const s = steps[frame];
  if (!s) return;
  paint();
  els.stepDescription.textContent=`Passo ${frame + 1}/${steps.length} · ${s.label} · Risultato: ${fmt(s.result)}`;
  [...els.logList.children].forEach((item,index)=> {
    item.classList.toggle('active', index === frame);
    if (index === frame && ticker !== null) item.scrollIntoView({block:'nearest'});
  });
  els.btnPrev.disabled=frame===0;
  els.btnNext.disabled=frame===steps.length-1;
}

function recalculate() {
  halt();
  const [x,y]=els.selectG.value.split(',').map(Number);
  const k=Number(els.inputK.value);
  if (!Number.isSafeInteger(k) || k<1 || k>500) {
    els.inputK.setCustomValidity('Inserisci un numero intero tra 1 e 500.');
    els.inputK.reportValidity();
    return;
  }
  els.inputK.setCustomValidity('');
  const G=[x,y];
  steps=sequence(G,k,els.selectMethod.value);
  frame=0;
  const result=steps.at(-1).result;
  const n=orderOf(G);
  if (!same(result,scalar(G,k))) throw new Error('I due algoritmi non coincidono.');
  els.pubKeyResult.textContent=result ? `Q = ${fmt(result)}` : 'Q = O (non valida come chiave pubblica)';
  els.calcInfoBadge.textContent=`${steps.length} passaggi`;
  els.hw1OrderNote.textContent=`Ordine di G: ${n} · k mod ord(G) = ${k % n} · ${result === null ? 'Lo scalare scelto produce O: scegli un altro k per una chiave valida.' : 'Moltiplicazione eseguita correttamente.'}`;
  els.logList.replaceChildren();
  steps.forEach((s,i)=> {
    const el=document.createElement('button');
    el.className='list-group-item list-group-item-action text-start';
    el.type='button';
    const title=document.createElement('div');
    title.className='d-flex justify-content-between flex-wrap gap-2';
    const label=document.createElement('strong');label.textContent=`#${i+1} ${s.label}`;
    const val=document.createElement('span');val.className='text-primary';val.textContent=fmt(s.result);
    title.append(label,val);
    const formula=document.createElement('div');formula.className='text-muted';formula.style.fontSize='11px';formula.textContent=s.operation.formula;
    el.append(title,formula);
    el.addEventListener('click',()=>{halt();frame=i;displayFrame();});
    els.logList.append(el);
  });
  displayFrame();
}

function pearson(samples, getter) {
  if (samples.length<2) return null;
  const x=samples.map(p=>p.k),y=samples.map(getter);
  const mx=x.reduce((a,b)=>a+b,0)/x.length,my=y.reduce((a,b)=>a+b,0)/y.length;
  let top=0,sx=0,sy=0;
  for(let i=0;i<x.length;i++) {top+=(x[i]-mx)*(y[i]-my);sx+=(x[i]-mx)**2;sy+=(y[i]-my)**2;}
  return sx && sy ? top/Math.sqrt(sx*sy) : null;
}

function bitcount(x) {
  let n=0;
  while(x){n+=x&1;x>>=1;}
  return n;
}

function drawBars(canvas,frequencies,color) {
  const ctx=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
  const max=Math.max(1,...frequencies);
  const left=27,right=10,top=18,bottom=28;
  const cw=(w-left-right)/PRIME;
  ctx.strokeStyle='#d9e2ef';ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left,h-bottom);ctx.lineTo(w-right,h-bottom);ctx.stroke();
  ctx.font='10px sans-serif';ctx.textAlign='center';
  for(let i=0;i<PRIME;i++) {
    const barh=(frequencies[i]/max)*(h-bottom-top-9);
    ctx.fillStyle=color;ctx.fillRect(left+i*cw+3,h-bottom-barh,Math.max(2,cw-6),barh);
    ctx.fillStyle='#8190a7';ctx.fillText(String(i),left+(i+.5)*cw,h-11);
    if(frequencies[i]){ctx.fillStyle='#32435d';ctx.fillText(String(frequencies[i]),left+(i+.5)*cw,h-bottom-barh-5);}
  }
}

function statistics() {
  const G=els.selectG.value.split(',').map(Number);
  const n=orderOf(G);
  const samples=[];
  for(let k=1;k<n;k++){
    const p=scalar(G,k);
    if (p !== null) samples.push({k,x:p[0],y:p[1]});
  }
  const fx=Array(PRIME).fill(0),fy=Array(PRIME).fill(0);
  const bx=Array(5).fill(0),by=Array(5).fill(0);
  samples.forEach(s=>{
    fx[s.x]++;fy[s.y]++;
    for(let i=0;i<5;i++){bx[i]+=(s.x>>i)&1;by[i]+=(s.y>>i)&1;}
  });
  drawBars(els.histX,fx,'#5477eb');
  drawBars(els.histY,fy,'#18a18c');
  els.statCoords.textContent=`G = ${fmt(G)} · ordine = ${n} · ${samples.length} punti finiti distinti + 1 punto O · ${new Set(samples.map(p=>p.x)).size} valori x diversi · ${new Set(samples.map(p=>p.y)).size} valori y diversi.`;
  const coX=pearson(samples,s=>s.x),coY=pearson(samples,s=>s.y);
  let flipped=0,pairs=0;
  for(let k=1;k<n;k++){
    const j=k^1;
    if(j<1||j>=n)continue;
    const a=scalar(G,k),b=scalar(G,j);
    flipped+=bitcount(a[0]^b[0])+bitcount(a[1]^b[1]);pairs++;
  }
  const formatCorr=n=>n===null?'non definita':n.toFixed(3);
  const mean=arr=>arr.map((count,i)=>`${i}: ${(100*count/samples.length).toFixed(0)}%`).join(' · ');
  els.statMetrics.replaceChildren();
  const entries=[
    ['Correlazione Pearson k / x(Q)',formatCorr(coX)],
    ['Correlazione Pearson k / y(Q)',formatCorr(coY)],
    ['Bit a 1 nelle coordinate x (bit 0…4)',mean(bx)],
    ['Bit a 1 nelle coordinate y (bit 0…4)',mean(by)],
    ['Bit cambiati, invertendo il bit 0 dello scalare',pairs?`${(flipped/pairs).toFixed(2)} su 10 bit (x‖y), ${pairs} coppie valide`:'non valutabile per questo sottogruppo']
  ];
  for(const [name,value] of entries){
    const div=document.createElement('div');
    const strong=document.createElement('strong');strong.textContent=name+': ';
    const span=document.createElement('span');span.textContent=value;
    div.append(strong,span);els.statMetrics.append(div);
  }
  const nte=document.createElement('p');nte.className='small text-muted mt-3 mb-0';nte.textContent='Sono statistiche descrittive su un sottogruppo minuscolo: correlazioni e bilanciamento dei bit non misurano la sicurezza di secp256k1. Il punto O è escluso dalle analisi delle coordinate.';
  els.statMetrics.append(nte);
}

function init() {
  allById(['selectG','inputK','selectMethod','btnCompute','pubKeyResult','calcInfoBadge','hw1OrderNote','eccCanvas','btnPrev','btnNext','btnPlay','btnReset','stepDescription','logList','statCoords','statMetrics','histX','histY']);
  POINTS.forEach(p=> {
    const option=document.createElement('option');option.value=p.join(',');option.textContent=fmt(p);
    if(p[0]===1&&p[1]===5) option.selected=true;
    els.selectG.append(option);
  });
  els.btnCompute.addEventListener('click',recalculate);
  els.inputK.addEventListener('keydown',ev=>{if(ev.key==='Enter')recalculate();});
  els.selectG.addEventListener('change',()=>{recalculate();statistics();});
  els.selectMethod.addEventListener('change',recalculate);
  els.btnPrev.addEventListener('click',()=>{halt();frame=Math.max(0,frame-1);displayFrame();});
  els.btnNext.addEventListener('click',()=>{halt();frame=Math.min(steps.length-1,frame+1);displayFrame();});
  els.btnReset.addEventListener('click',()=>{halt();frame=0;displayFrame();});
  els.btnPlay.addEventListener('click',()=>{
    if (ticker!==null){halt();return;}
    if(frame===steps.length-1)frame=0;
    els.btnPlay.textContent='Pausa';displayFrame();
    ticker=setInterval(()=>{if(frame<steps.length-1){frame++;displayFrame();}else halt();},950);
  });
  recalculate();
  statistics();
}

document.addEventListener('DOMContentLoaded',init);
