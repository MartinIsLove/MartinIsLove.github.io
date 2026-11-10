const el = id => document.getElementById(id);
const palette = ['#235a94','#a75b42','#48775a','#7a6294','#b18a32','#4c8997','#9d547f','#717d3b','#4078aa','#a37051','#537c70','#8a6f9a'];
function rng(seed) {
  let state = seed >>> 0;
  return function () {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function stats(values) {
  const n = values.length;
  const mean = values.reduce((a,b) => a+b,0)/n;
  const variance = values.reduce((a,b) => a+(b-mean)*(b-mean),0)/n;
  return {mean,variance};
}
function number(value, maxDigits=4) { return Number(value).toLocaleString('it-IT',{maximumFractionDigits:maxDigits}); }
function pct(value) { return (100*value).toLocaleString('it-IT',{maximumFractionDigits:1})+'%'; }
function readConfiguration() {
  const model=el('model').value;
  const n=Number(el('nInput').value);
  const m=Number(el('mInput').value);
  const p=Number(el('pInput').value);
  const epsilon=Number(el('epsInput').value);
  const traceCount=Number(el('traceInput').value);
  const seed=Number(el('seedInput').value);
  if (![n,m,p,epsilon,traceCount,seed].every(Number.isFinite) || ![n,m,traceCount,seed].every(Number.isInteger) || n<10 || n>2500 || m<30 || m>1200 || p<0.05 || p>0.95 || epsilon<0.01 || epsilon>1 || traceCount<1 || traceCount>12 || seed<1 || seed>4294967295) {
    throw new Error('Controlla i valori: n da 10 a 2500, m da 30 a 1200, p da 0,05 a 0,95, ε da 0,01 a 1 e traiettorie da 1 a 12.');
  }
  return {model,n,m,p,epsilon,traceCount,seed,mu:model==='bernoulli'?p:0,sigma2:model==='bernoulli'?p*(1-p):1};
}
function checkpoints(n) {
  return [...new Set([10,20,50,100,200,500,1000,2000,n].filter(i=>i<=n))].sort((a,b)=>a-b);
}
function simulate(c) {
  const random=rng(c.seed), steps=checkpoints(c.n), partial=new Map(steps.map(t=>[t,[]]));
  const tracks=[],final=[];
  for(let a=0;a<c.m;a++) {
    let s=0;
    const track=a<c.traceCount?[0]:null;
    for(let t=1;t<=c.n;t++) {
      s+=c.model==='bernoulli'?(random()<c.p?1:0):(random()<.5?1:-1);
      if(track)track.push(s);
      if(partial.has(t))partial.get(t).push(s);
    }
    final.push(s);
    if(track) tracks.push(track);
  }
  const comparisons=steps.map(t=>{
    const sums=partial.get(t),avgs=sums.map(s=>s/t),norms=sums.map(s=>s/Math.sqrt(t));
    const count=avgs.filter(x=>Math.abs(x-c.mu)>c.epsilon).length;
    return {t, sums, avgs, norms, avgStat:stats(avgs), normStat:stats(norms), prob:count/c.m, count};
  });
  return {c,tracks,final,comparisons,current:comparisons[comparisons.length-1]};
}
function canvasSetup(id) {
  const canvas=el(id),ctx=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
  ctx.font='12px Arial';ctx.textBaseline='middle';
  return {ctx,w,h};
}
function axes(ctx,w,h,L,R,T,B,xLabel,yLabel) {
  ctx.strokeStyle='#cfd6dc';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(L,T);ctx.lineTo(L,h-B);ctx.lineTo(w-R,h-B);ctx.stroke();
  ctx.fillStyle='#5e6975';ctx.font='12px Arial';
  ctx.fillText(xLabel,w-R-35,h-12);ctx.save();ctx.translate(13,T+23);ctx.rotate(-Math.PI/2);ctx.fillText(yLabel,0,0);ctx.restore();
}
function drawTrajectories(sim) {
  const {c,tracks}=sim,{ctx,w,h}=canvasSetup('trajectories');
  const mode=el('trajectoryMode').value;
  const L=61,R=20,T=17,B=38,ww=w-L-R,hh=h-T-B;
  const first=mode==='total'?0:1;
  const valueAt=(s,t)=>mode==='total'?s:mode==='average'?s/t:s/Math.sqrt(t);
  const meanAt=t=>mode==='total'?t*c.mu:mode==='average'?c.mu:c.mu*Math.sqrt(t);
  const sigmaAt=t=>mode==='total'?Math.sqrt(t*c.sigma2):mode==='average'?Math.sqrt(c.sigma2/t):Math.sqrt(c.sigma2);
  let low=Infinity,high=-Infinity;
  for(const track of tracks)for(let t=first;t<track.length;t++){
    const v=valueAt(track[t],t);low=Math.min(low,v);high=Math.max(high,v);
  }
  const increment=Math.max(1,Math.floor(c.n/180));
  for(let t=first;t<=c.n;t+=increment){
    const s=2*sigmaAt(t),mu=meanAt(t);
    low=Math.min(low,mu-s);high=Math.max(high,mu+s);
  }
  if(high-low<.000001){high+=1;low-=1;}
  const margin=(high-low)*.07;low-=margin;high+=margin;
  const x=t=>L+(t/c.n)*ww,y=z=>T+(high-z)/(high-low)*hh;
  ctx.font='12px Arial';ctx.fillStyle='#5e6975';
  for(let i=0;i<=4;i++) {
    const yy=T+i*hh/4,v=high-(high-low)*i/4;
    ctx.strokeStyle='#eef1f3';ctx.beginPath();ctx.moveTo(L,yy);ctx.lineTo(w-R,yy);ctx.stroke();
    ctx.fillText(number(v,2),5,yy);
    const xx=L+i*ww/4;ctx.fillText(String(Math.round(i*c.n/4)),xx-10,h-B+15);
  }
  axes(ctx,w,h,L,R,T,B,'passo',mode==='total'?'S':mode==='average'?'S/t':'S/√t');
  const band=k=>{ctx.beginPath();for(let t=first;t<=c.n;t++){
    const value=meanAt(t)+k*2*sigmaAt(t);
    t>first?ctx.lineTo(x(t),y(value)):ctx.moveTo(x(t),y(value));
  }ctx.stroke();};
  ctx.strokeStyle='#d4d9dd';ctx.setLineDash([5,4]);ctx.lineWidth=1.2;band(-1);band(1);ctx.setLineDash([]);
  tracks.forEach((track,i)=>{
    ctx.strokeStyle=palette[i%palette.length];ctx.lineWidth=1.35;ctx.beginPath();
    for(let t=first;t<track.length;t++)t>first?ctx.lineTo(x(t),y(valueAt(track[t],t))):ctx.moveTo(x(t),y(valueAt(track[t],t)));
    ctx.stroke();
  });
  ctx.strokeStyle='#263645';ctx.lineWidth=2;ctx.setLineDash([7,4]);ctx.beginPath();for(let t=first;t<=c.n;t++){t>first?ctx.lineTo(x(t),y(meanAt(t))):ctx.moveTo(x(t),y(meanAt(t)));}ctx.stroke();ctx.setLineDash([]);
}

function normalPdf(x) {return Math.exp(-x*x/2)/Math.sqrt(2*Math.PI);}
function drawHistogram(id,values,expectedMean,expectedSigma,showNormal) {
  const {ctx,w,h}=canvasSetup(id),L=52,R=14,T=18,B=38,ww=w-L-R,hh=h-T-B;
  const minV=Math.min(...values),maxV=Math.max(...values);
  const span=Math.max(maxV-minV,expectedSigma*5,1e-5);
  const lo=Math.min(minV,expectedMean-expectedSigma*3)-span*.05;
  const hi=Math.max(maxV,expectedMean+expectedSigma*3)+span*.05;
  const bins=22,width=(hi-lo)/bins,counts=Array(bins).fill(0);
  values.forEach(v=>{const index=Math.max(0,Math.min(bins-1,Math.floor((v-lo)/width)));counts[index]++;});
  const density=counts.map(k=>k/(values.length*width));
  const ymax=Math.max(...density,showNormal?normalPdf(0):0)*1.15 || 1;
  const x=v=>L+(v-lo)/(hi-lo)*ww,y=z=>T+hh-z/ymax*hh;
  ctx.strokeStyle='#eef1f3';ctx.lineWidth=1;ctx.fillStyle='#687480';ctx.font='11px Arial';
  for(let i=0;i<=3;i++){
    const yy=T+i*hh/3;ctx.beginPath();ctx.moveTo(L,yy);ctx.lineTo(w-R,yy);ctx.stroke();
    ctx.fillText(number(ymax*(3-i)/3,2),3,yy);
    const tx=L+i*ww/3;ctx.fillText(number(lo+(hi-lo)*i/3,2),tx-13,h-B+15);
  }
  density.forEach((d,i)=>{
    const bx=L+i*ww/bins,bw=ww/bins-1;
    ctx.fillStyle='#7da3c6';ctx.fillRect(bx,y(d),Math.max(0,bw),Math.max(0,T+hh-y(d)));
  });
  if(showNormal){ctx.strokeStyle='#283f55';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<=220;i++){
    const vx=lo+(hi-lo)*i/220,vy=normalPdf(vx);i?ctx.lineTo(x(vx),y(vy)):ctx.moveTo(x(vx),y(vy));
  }ctx.stroke();}
  ctx.strokeStyle='#a34e43';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(x(expectedMean),T);ctx.lineTo(x(expectedMean),h-B);ctx.stroke();ctx.setLineDash([]);
  axes(ctx,w,h,L,R,T,B,'valore','densità');
}
function drawConvergence(sim) {
  const {c,comparisons}=sim,{ctx,w,h}=canvasSetup('llnChart');
  const L=52,R=22,T=20,B=40,ww=w-L-R,hh=h-T-B;
  const minN=comparisons[0].t,maxN=c.n;
  const x=t=>L+(Math.log(t)-Math.log(minN))/(Math.log(maxN)-Math.log(minN)||1)*ww;
  const y=v=>T+(1-v)*hh;
  ctx.fillStyle='#5e6975';ctx.font='12px Arial';
  for(let i=0;i<=4;i++){
    const v=i/4,yy=y(v);ctx.strokeStyle='#eef1f3';ctx.beginPath();ctx.moveTo(L,yy);ctx.lineTo(w-R,yy);ctx.stroke();ctx.fillText(pct(v),5,yy);
  }
  for(const d of comparisons){ctx.fillText(String(d.t),x(d.t)-String(d.t).length*3,h-B+15);}
  axes(ctx,w,h,L,R,T,B,'n (scala log.)','P');
  const curves=[{color:'#245b91',get:d=>d.prob},{color:'#a66a4b',get:d=>Math.min(1,c.sigma2/(d.t*c.epsilon*c.epsilon))}];
  curves.forEach((curve,j)=>{
    ctx.strokeStyle=curve.color;ctx.lineWidth=2;ctx.setLineDash(j?[6,4]:[]);ctx.beginPath();
    comparisons.forEach((d,i)=>i?ctx.lineTo(x(d.t),y(curve.get(d))):ctx.moveTo(x(d.t),y(curve.get(d))));ctx.stroke();ctx.setLineDash([]);
    if(!j)for(const d of comparisons){ctx.beginPath();ctx.arc(x(d.t),y(curve.get(d)),3.5,0,Math.PI*2);ctx.fillStyle=curve.color;ctx.fill();}
  });
  ctx.fillStyle='#245b91';ctx.fillRect(L+15,T+8,16,3);ctx.fillStyle='#414b55';ctx.fillText('Simulata',L+36,T+10);
  ctx.fillStyle='#a66a4b';ctx.fillRect(L+135,T+8,16,3);ctx.fillStyle='#414b55';ctx.fillText('Limite di Chebyshev',L+155,T+10);
}
function setRow(tbody,values) {
  const tr=document.createElement('tr');
  values.forEach(value=>{const td=document.createElement('td');td.textContent=String(value);tr.appendChild(td);});
  tbody.appendChild(tr);
}
function renderTables(sim) {
  const {c,comparisons,final}=sim;
  const tbody=el('checkpointTable');tbody.replaceChildren();
  comparisons.forEach(d=>setRow(tbody,[d.t,number(d.avgStat.mean),number(d.avgStat.variance,6),number(c.sigma2/d.t,6),number(d.normStat.variance,4),pct(d.prob)]));
  const mvals=[...new Set([25,50,100,250,500,1000,c.m].filter(v=>v<=c.m))].sort((a,b)=>a-b);
  const tbody2=el('attackerTable');tbody2.replaceChildren();
  let total=0,attIndex=0;
  mvals.forEach(m=>{
    while(attIndex<m)total+=final[attIndex++];
    setRow(tbody2,[m,number(total,0),number(total/(m*c.n),5),number(m*c.n*c.mu,2),number(Math.sqrt(m*c.n*c.sigma2),2)]);
  });
}
function render(sim) {
  const {c,final,current}=sim;
  el('resultMean').textContent=number(current.avgStat.mean,5);
  el('expectedMean').textContent='Teorica: '+number(c.mu,5);
  el('resultVarAvg').textContent=number(current.avgStat.variance,6);
  el('expectedVarAvg').textContent='Teorica: '+number(c.sigma2/c.n,6);
  el('resultVarNorm').textContent=number(current.normStat.variance,5);
  el('expectedVarNorm').textContent='Teorica: '+number(c.sigma2,5);
  el('resultProb').textContent=pct(current.prob);
  el('resultProbDetail').textContent=current.count+' attaccanti su '+c.m+' · ε='+number(c.epsilon);
  const ber=c.model==='bernoulli';
  el('modelTheory').textContent=ber
    ?`Bernoulli(p = ${number(c.p,2)}): E[X] = ${number(c.mu,3)}, Var(X) = ${number(c.sigma2,4)}. E[Sₙ] = np = ${number(c.n*c.p,2)}, Var(Sₙ) = np(1-p) = ${number(c.n*c.sigma2,3)}. Sₙ/n tende a p, ma Sₙ/√n ha media p√n, quindi NON converge a N(0,1).`
    :`Rademacher: E[X] = 0 e Var(X) = 1. E[Sₙ] = 0 e Var(Sₙ) = n. La media Sₙ/n tende a 0 e Sₙ/√n converge in distribuzione a N(0,1).`;
  el('distributionNote').textContent=ber
    ?'Bernoulli: il totale è binomiale, Sₙ ~ Bin(n,p). La media tende a p; il totale normalizzato ha varianza costante p(1-p), ma media p√n crescente. Per applicare il teorema del limite centrale occorre centrare e dividere per √(np(1-p)).'
    :'Rademacher: per n piccolo la distribuzione di Sₙ/√n è discreta. Aumentando n i suoi valori si distribuiscono approssimativamente secondo una normale standard, pur mantenendo media teorica 0 e varianza 1.';
  const interp=el('interpretation');interp.replaceChildren();
  const messages=ber?[
    `Con ${c.n} sistemi, ogni attaccante consegue in media circa np = ${number(c.n*c.p,2)} punti. Aumentando n il totale cresce linearmente, mentre la variabilità in valore assoluto cresce con √n.`,
    `La legge dei grandi numeri afferma che Sₙ/n si avvicina a p = ${number(c.p,2)}; Var(Sₙ/n) = p(1-p)/n diminuisce verso zero. Nell'esperimento ${current.count} attaccanti su ${c.m} sono oltre la tolleranza ε = ${number(c.epsilon)}.`,
    `Dividendo per √n, la varianza resta p(1-p) = ${number(c.sigma2,4)}, ma la media diventa p√n: il grafico non si concentra intorno a zero. Per ottenere una normale standard bisogna usare (Sₙ-np)/√(np(1-p)).`,
    `Con m attaccanti indipendenti il totale aggregato ha media mnp e varianza mnp(1-p), mentre la media globale A/(mn) ha varianza p(1-p)/(mn).`
  ]:[
    `Con ${c.n} sistemi, le variazioni positive e negative tendono a compensarsi: E[Sₙ] = 0, ma Var(Sₙ) = n e quindi l'ampiezza tipica delle fluttuazioni cresce come √n.`,
    `La legge dei grandi numeri dà Sₙ/n → 0 in probabilità, perché Var(Sₙ/n)=1/n. Nell'esperimento ${current.count} attaccanti su ${c.m} sono oltre la tolleranza ε = ${number(c.epsilon)}.`,
    `Il teorema del limite centrale afferma che Sₙ/√n converge in distribuzione a N(0,1): la varianza rimane 1 e la forma dell'istogramma tende a quella della normale sovrapposta.`,
    `Per m attaccanti indipendenti il totale aggregato ha media 0 e varianza mn. La media globale A/(mn) ha varianza 1/(mn), quindi aumentando m la stima aggregata diventa più stabile.`
  ];
  messages.forEach(message=>{const p=document.createElement('p');p.textContent=message;interp.appendChild(p);});
  drawTrajectories(sim);
  drawHistogram('histTotal',final,c.n*c.mu,Math.sqrt(c.n*c.sigma2),false);
  drawHistogram('histAverage',current.avgs,c.mu,Math.sqrt(c.sigma2/c.n),false);
  drawHistogram('histNormalized',current.norms,c.mu*Math.sqrt(c.n),Math.sqrt(c.sigma2),!ber);
  drawConvergence(sim);
  renderTables(sim);
  el('simulationStatus').textContent='Simulazione completata: '+number(c.m,0)+' attaccanti × '+number(c.n,0)+' sistemi = '+number(c.m*c.n,0)+' incrementi; seme '+c.seed+'.';
}
let latestSimulation = null;
function syncControls() {el('pInput').disabled=el('model').value==='rademacher';}
function run() {
  try {const c=readConfiguration();latestSimulation=simulate(c);render(latestSimulation);}
  catch(e) {el('simulationStatus').textContent=e.message;}
}
el('model').addEventListener('change',syncControls);
el('trajectoryMode').addEventListener('change',()=>{if(latestSimulation)drawTrajectories(latestSimulation);});
el('runBtn').addEventListener('click',run);
el('newSeedBtn').addEventListener('click',()=>{el('seedInput').value=String((Math.floor(Math.random()*4294967294)+1)>>>0);run();});
el('bernBtn').addEventListener('click',()=>{el('model').value='bernoulli';el('pInput').value='0.60';syncControls();run();});
el('radBtn').addEventListener('click',()=>{el('model').value='rademacher';syncControls();run();});
syncControls();run();
