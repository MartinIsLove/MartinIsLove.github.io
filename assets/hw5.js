const $ = id => document.getElementById(id);
const fmt = (x, digits=4) => Number.isFinite(x) ? x.toFixed(digits) : '–';
function selectExercise(num) {
  $('exercise1').hidden = num !== 1;
  $('exercise2').hidden = num !== 2;
  $('choose1').setAttribute('aria-pressed', String(num === 1));
  $('choose2').setAttribute('aria-pressed', String(num === 2));
  if (num === 2 && !simulationDone) runSimulation();
  if (num === 2 && simulationDone) renderPlots();
}
$('choose1').onclick = () => selectExercise(1);
$('choose2').onclick = () => selectExercise(2);
function recurrence(values) {
  let count = 0, mean = 0, M2 = 0;
  const rows=[];
  for (const x of values) {
    count++;
    const delta = x - mean;
    mean += delta / count;
    M2 += delta * (x - mean);
    rows.push({count, x, delta, mean, M2, sample:count>1?M2/(count-1):null});
  }
  return rows;
}
let rows1=[], step1=0;
function updateExercise1() {
  const row=rows1[step1-1];
  $('count1').textContent=row?String(row.count):'0';
  $('mean1').textContent=row?fmt(row.mean):'–';
  $('m21').textContent=row?fmt(row.M2):'–';
  $('var1').textContent=row && row.sample!==null?fmt(row.sample):'n ≥ 2';
  $('status1').textContent=`Passo ${step1} di ${rows1.length}`;
  Array.from($('stepTable').children).forEach((tr,i)=>tr.classList.toggle('active',i===step1-1));
  $('previous1').disabled=step1===0;
  $('next1').disabled=step1>=rows1.length;
  const last=rows1.at(-1);
  $('final1').textContent=last ? `Risultato finale: media = ${fmt(last.mean,5)}, SS = ${fmt(last.M2,5)}, varianza campionaria s² = ${last.sample===null?'non definita':fmt(last.sample,5)}. La varianza con divisore n è ${fmt(last.M2/last.count,5)}.` : '';
}
function compute1() {
  const text=$('sequence').value.trim();
  const parts=text.split(/[;,\s]+/).filter(Boolean);
  if (!parts.length || parts.length>1000) { $('status1').textContent='Inserisci da 1 a 1000 valori.';return; }
  const values=parts.map(Number);
  if (values.some(x=>!Number.isFinite(x))) { $('status1').textContent='La sequenza contiene un valore non numerico.';return; }
  rows1=recurrence(values);
  $('stepTable').replaceChildren();
  for(const r of rows1) {
    const tr=document.createElement('tr');
    [r.count,r.x,fmt(r.delta),fmt(r.mean),fmt(r.M2),r.sample===null?'–':fmt(r.sample)].forEach(v=>{const td=document.createElement('td');td.textContent=String(v);tr.appendChild(td)});
    tr.addEventListener('click',()=>{step1=r.count;updateExercise1()});
    $('stepTable').appendChild(tr);
  }
  step1=rows1.length;
  updateExercise1();
}
$('calculate1').onclick=compute1;
$('previous1').onclick=()=>{step1=Math.max(0,step1-1);updateExercise1()};
$('next1').onclick=()=>{step1=Math.min(rows1.length,step1+1);updateExercise1()};
const weights=[1,2,3,4,5,6,5,4,3,2,1], probs=weights.map(w=>w/36);
const MU=5, VAR=35/6, M4=161/2;
function rng(seed) {
  let a=seed>>>0;
  return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296};
}
function sampleScore(random) {
  const r=random()*36;
  let sum=0;
  for(let i=0;i<11;i++){sum+=weights[i];if(r<sum)return i;}
  return 10;
}
function descriptive(values) {
  const n=values.length;
  const mean=values.reduce((a,b)=>a+b,0)/n;
  const v=values.reduce((a,b)=>a+(b-mean)**2,0)/n;
  return {mean,var:v};
}
function theoreticalVarianceOfVariance(n) {
  return (M4 - ((n-3)/(n-1))*VAR*VAR)/n;
}
function drawCanvas(id) {
  const canvas=$(id), ctx=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h);
  ctx.font='12px Arial';ctx.lineWidth=1;
  return {ctx,w,h};
}
function axes(ctx,w,h, ymin,ymax,xmin,xmax,{xLabel='n',yLabel='Varianza'}={}) {
  const left=53,right=16,top=20,bottom=38;
  const px=x=>left+(x-xmin)/(xmax-xmin||1)*(w-left-right);
  const py=y=>h-bottom-(y-ymin)/(ymax-ymin||1)*(h-top-bottom);
  ctx.strokeStyle='#d8dee5';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left,h-bottom);ctx.lineTo(w-right,h-bottom);ctx.stroke();
  ctx.fillStyle='#5e6874';ctx.textAlign='right';
  for(let i=0;i<=4;i++){const y=ymin+(ymax-ymin)*i/4;const yy=py(y);ctx.strokeStyle='#edf0f4';ctx.beginPath();ctx.moveTo(left,yy);ctx.lineTo(w-right,yy);ctx.stroke();ctx.fillText(Math.abs(y)<10?fmt(y,2):fmt(y,1),left-7,yy+4)}
  ctx.textAlign='center';
  for(let i=0;i<=4;i++){const x=xmin+(xmax-xmin)*i/4;ctx.fillText(Number.isInteger(x)?String(x):fmt(x,1),px(x),h-bottom+17)}
  ctx.textAlign='left';ctx.fillText(xLabel,w-right-5,h-5);ctx.fillText(yLabel,8,12);
  return {px,py,left,right,top,bottom};
}
function drawPMF() {
  const {ctx,w,h}=drawCanvas('pmfChart');
  const {px,py}=axes(ctx,w,h,0,0.20,-0.5,10.5,{xLabel:'Punteggio',yLabel:'P(X = x)'});
  ctx.fillStyle='#769bbb';
  for(let x=0;x<=10;x++){const bar=22;const mid=px(x);ctx.fillRect(mid-bar/2,py(probs[x]),bar,py(0)-py(probs[x]));}
}
function histogram(id, values, ref) {
  const {ctx,w,h}=drawCanvas(id);
  if(!values.length)return;
  let min=Math.min(...values), max=Math.max(...values);
  min=Math.min(min,ref);max=Math.max(max,ref);
  const span=max-min||1;min-=0.12*span;max+=0.12*span;
  const bins=20,counts=Array(bins).fill(0);
  for(const x of values){const i=Math.max(0,Math.min(bins-1,Math.floor((x-min)/(max-min)*bins)));counts[i]++;}
  const maxC=Math.max(...counts,1);
  const {px,py}=axes(ctx,w,h,0,maxC*1.18,min,max,{xLabel:'Valore',yLabel:'Frequenza'});
  ctx.fillStyle='#779dbb';
  for(let i=0;i<bins;i++){const start=min+(max-min)*i/bins;const end=min+(max-min)*(i+1)/bins;const bW=px(end)-px(start)-1;ctx.fillRect(px(start)+1,py(counts[i]),Math.max(bW,1),py(0)-py(counts[i]));}
  ctx.strokeStyle='#ad683f';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(px(ref),py(0));ctx.lineTo(px(ref),py(maxC*1.18));ctx.stroke();ctx.setLineDash([]);
}
let latestSimulation=null,simulationDone=false;
function checkpoints(n) {
  return [...new Set([2,5,10,20,50,100,200,500,1000,n].filter(x=>x<=n))].sort((a,b)=>a-b);
}
function simulate(n,m,seed) {
  const random=rng(seed), points=checkpoints(n), pointSet=new Set(points), snapshots=new Map(points.map(k=>[k,{means:[],vars:[]}])) , finalMeans=[],finalVars=[],traces=[];
  const traceStride=Math.max(1,Math.ceil(n/100));
  for(let hacker=0;hacker<m;hacker++) {
    let mean=0,M2=0,trace=[];
    for(let k=1;k<=n;k++) {
      const x=sampleScore(random);
      const delta=x-mean;
      mean+=delta/k;
      M2+=delta*(x-mean);
      if(hacker<5 && (k===1 || k%traceStride===0 || k===n))trace.push({n:k,mean});
      if(pointSet.has(k)){
        const s=snapshots.get(k);
        s.means.push(mean);
        s.vars.push(M2/(k-1));
      }
    }
    finalMeans.push(mean);finalVars.push(M2/(n-1));
    if(hacker<5)traces.push(trace);
  }
  const table=points.map(k=>{
    const s=snapshots.get(k),ms=descriptive(s.means),vs=descriptive(s.vars);
    return {n:k,meanOfMeans:ms.mean,meanOfVars:vs.mean,varianceOfMeans:ms.var,varianceOfVars:vs.var,theoryMeanVar:VAR/k,theoryVarianceVar:theoreticalVarianceOfVariance(k)};
  });
  return {n,m,seed,table,traces,finalMeans,finalVars,means:descriptive(finalMeans),variances:descriptive(finalVars)};
}
function plotCurves(id,rows,series, xmin,xmax){
  const {ctx,w,h}=drawCanvas(id);
  const maxVal=Math.max(...rows.flatMap(r=>series.map(s=>r[s.key])))*1.15;
  const {px,py}=axes(ctx,w,h,0,Math.max(maxVal,0.001),xmin,xmax,{xLabel:'n sistemi',yLabel:'Varianza'});
  for(const {key,color,dashed} of series){
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash(dashed?[5,5]:[]);
    ctx.beginPath();rows.forEach((r,i)=>i===0?ctx.moveTo(px(r.n),py(r[key])):ctx.lineTo(px(r.n),py(r[key])));ctx.stroke();ctx.setLineDash([]);
  }
}
function drawConvergence() {
  const s=latestSimulation;if(!s)return;
  plotCurves('convergence2',s.table,[{key:'varianceOfMeans',color:'#306a9c'},{key:'theoryMeanVar',color:'#8a97a5',dashed:true}],2,Math.max(3,s.n));
  plotCurves('convergenceVar2',s.table,[{key:'varianceOfVars',color:'#bd7a48'},{key:'theoryVarianceVar',color:'#8a97a5',dashed:true}],2,Math.max(3,s.n));
}
function drawTraces(){
  const s=latestSimulation;if(!s)return;
  const {ctx,w,h}=drawCanvas('trajectory2');
  const all=s.traces.flat().map(r=>r.mean);
  const ymin=Math.min(MU,...all),ymax=Math.max(MU,...all),span=Math.max(0.2,ymax-ymin);
  const {px,py}=axes(ctx,w,h,ymin-0.1*span,ymax+0.1*span,1,Math.max(2,s.n),{xLabel:'n sistemi',yLabel:'Media'});
  ctx.strokeStyle='#747e89';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(px(1),py(MU));ctx.lineTo(px(s.n),py(MU));ctx.stroke();ctx.setLineDash([]);
  const colors=['#2e6da5','#bd7a48','#3a8a6d','#8e71aa','#b27a86'];
  s.traces.forEach((trace,index)=>{ctx.strokeStyle=colors[index%colors.length];ctx.lineWidth=1.5;ctx.beginPath();trace.forEach((p,i)=>i===0?ctx.moveTo(px(p.n),py(p.mean)):ctx.lineTo(px(p.n),py(p.mean)));ctx.stroke();});
}
function renderPlots(){if(!latestSimulation)return;drawPMF();drawTraces();histogram('meanHist2',latestSimulation.finalMeans,MU);histogram('varHist2',latestSimulation.finalVars,VAR);drawConvergence();}
function renderSimulation(s) {
  $('avgMean2').textContent=fmt(s.means.mean);
  $('avgVar2').textContent=fmt(s.variances.mean);
  $('spreadMean2').textContent=fmt(s.means.var,5);
  $('spreadVar2').textContent=fmt(s.variances.var,5);
  $('spreadMeanTheory2').textContent='Teoria: '+fmt(VAR/s.n,5);
  $('spreadVarTheory2').textContent='Teoria: '+fmt(theoreticalVarianceOfVariance(s.n),5);
  $('comparisonTable2').replaceChildren();
  for(const r of s.table){
    const tr=document.createElement('tr');
    [r.n,fmt(r.meanOfMeans),fmt(r.meanOfVars),fmt(r.varianceOfMeans,5),fmt(r.theoryMeanVar,5),fmt(r.varianceOfVars,5)].forEach(value=>{const td=document.createElement('td');td.textContent=String(value);tr.appendChild(td);});$('comparisonTable2').appendChild(tr);
  }
  const p=$('interpretation2');p.replaceChildren();
  const lines=[
    `Con ${s.n} sistemi e ${s.m} hacker, la media delle medie è ${fmt(s.means.mean)}, da confrontare con μ = 5. La media delle varianze è ${fmt(s.variances.mean)}, da confrontare con σ² = ${fmt(VAR)}.`,
    `La variabilità delle medie tra hacker è ${fmt(s.means.var,5)} (teoria σ²/n = ${fmt(VAR/s.n,5)}). All'aumentare di n si riduce. Anche la variabilità della varianza campionaria diminuisce, ma la sua velocità dipende dalla distribuzione.`,
    'Usare il divisore n − 1 rende la varianza campionaria non distorta: E[s²] = σ². Le medie delle stime su molti hacker tendono ai corrispondenti valori teorici al crescere di m.',
    'Aumentare m migliora la precisione delle medie aggregate, ma non rende meno variabile la stima di ogni singolo hacker a n fisso.'
  ];for(const line of lines){const para=document.createElement('p');para.textContent=line;p.appendChild(para)}
  $('status2').textContent=`Simulati ${s.m} hacker × ${s.n} sistemi = ${s.m*s.n} punteggi; seme ${s.seed}.`;
  renderPlots();
}
function runSimulation(){
  const n=Number($('n2').value),m=Number($('m2').value),seed=Number($('seed2').value);
  if(!Number.isInteger(n)||n<2||n>1500||!Number.isInteger(m)||m<2||m>1000||!Number.isSafeInteger(seed)||seed<1||seed>4294967295){$('status2').textContent='Controlla i parametri: 2 ≤ n ≤ 1500, 2 ≤ m ≤ 1000, seme intero positivo.';return;}
  try{latestSimulation=simulate(n,m,seed);simulationDone=true;renderSimulation(latestSimulation)}catch(e){$('status2').textContent='Errore: '+e.message}
}
$('simulate2').onclick=runSimulation;
$('seedNew2').onclick=()=>{$('seed2').value=String(1+Math.floor(Math.random()*4294967294));runSimulation()};
$('smallN2').onclick=()=>{$('n2').value='10';runSimulation()};
$('largeN2').onclick=()=>{$('n2').value='1000';runSimulation()};
compute1();drawPMF();
