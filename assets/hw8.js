"use strict";

const $ = id => document.getElementById(id);
const fmt = (v,d=4) => Number(v).toLocaleString("it-IT",{maximumFractionDigits:d,minimumFractionDigits:d});
const fmtParam = v => Number(v).toLocaleString("it-IT",{maximumFractionDigits:4});

function randomBernoulli(p) {
  return Math.random() < p ? 1 : 0;
}

function plotTwoSeries(id, points, horizontal, orangeValue) {
  const canvas = $(id), ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  const l=55, r=w-18, top=18, bottom=h-38;
  const xs = points.map(p=>p.x);
  const ys = points.map(p=>p.y);
  let yMin = Math.min(...ys, horizontal);
  let yMax = Math.max(...ys, horizontal);
  if (yMax === yMin) { yMin -= 1; yMax += 1; }
  yMin = Math.max(0, yMin - (yMax-yMin)*0.08);
  yMax = Math.min(1, yMax + (yMax-yMin)*0.08);
  if (yMin === yMax) yMin = 0;
  const xp=x=>l+(x-Math.min(...xs))/(Math.max(...xs)-Math.min(...xs))*(r-l);
  const yp=y=>bottom-(y-yMin)/(yMax-yMin)*(bottom-top);
  ctx.strokeStyle="#dde3e8"; ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const y=top+(bottom-top)*i/4;ctx.beginPath();ctx.moveTo(l,y);ctx.lineTo(r,y);ctx.stroke();}
  ctx.fillStyle="#697480";ctx.font="12px Arial";ctx.textAlign="right";
  for(let i=0;i<=4;i++){const y=bottom-(bottom-top)*i/4;ctx.fillText(fmt(yMin+(yMax-yMin)*i/4,2),l-7,y+4);}
  ctx.strokeStyle="#ce8951";ctx.lineWidth=2;ctx.setLineDash([7,5]);
  ctx.beginPath();ctx.moveTo(l,yp(horizontal));ctx.lineTo(r,yp(horizontal));ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle="#225d9c";ctx.lineWidth=2;ctx.beginPath();
  points.forEach((p,i)=>i?ctx.lineTo(xp(p.x),yp(p.y)):ctx.moveTo(xp(p.x),yp(p.y)));
  ctx.stroke();
  ctx.textAlign="center";ctx.fillStyle="#697480";
  for(let i=0;i<=5;i++){const x=Math.min(...xs)+(Math.max(...xs)-Math.min(...xs))*i/5;ctx.fillText(String(Math.round(x)),xp(x),bottom+22);}
}

function drawHistogram(id, values) {
  const canvas=$(id),ctx=canvas.getContext("2d");
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  const bins=24, lo=-4, hi=4, step=(hi-lo)/bins;
  const counts=Array(bins).fill(0);
  values.forEach(v=>{const k=Math.max(0,Math.min(bins-1,Math.floor((v-lo)/step)));counts[k]++;});
  const l=55,r=w-18,top=18,bottom=h-38;
  const maxCount=Math.max(...counts)*1.15;
  ctx.strokeStyle="#dde3e8";ctx.lineWidth=1;
  for(let i=0;i<=4;i++){const y=top+(bottom-top)*i/4;ctx.beginPath();ctx.moveTo(l,y);ctx.lineTo(r,y);ctx.stroke();}
  const bw=(r-l)/bins;
  ctx.fillStyle="#225d9c";
  counts.forEach((c,i)=>{const bh=c/maxCount*(bottom-top);ctx.fillRect(l+i*bw,bottom-bh,bw-1,bh);});
  ctx.strokeStyle="#ce8951";ctx.lineWidth=2;ctx.beginPath();
  for(let i=0;i<=200;i++){const x=lo+(hi-lo)*i/200,y=Math.exp(-x*x/2)/Math.sqrt(2*Math.PI);const xp=l+(x-lo)/(hi-lo)*(r-l);const yp=bottom-y/(0.42)*(bottom-top);i?ctx.lineTo(xp,yp):ctx.moveTo(xp,yp);}
  ctx.stroke();
  ctx.fillStyle="#697480";ctx.font="12px Arial";ctx.textAlign="center";
  for(let i=-4;i<=4;i++)ctx.fillText(String(i),l+(i-lo)/(hi-lo)*(r-l),bottom+22);
}

function runConvergence() {
  const p=Number($("convP").value),n=Number($("convN").value),reps=Number($("convReps").value);
  if(![p,n,reps].every(Number.isFinite)||p<=0||p>=1||!Number.isInteger(n)||n<20||n>2000||!Number.isInteger(reps)||reps<100||reps>5000)return;
  const sigma=Math.sqrt(p*(1-p));
  let sumSq=0,trajectory=[],total=0;
  for(let i=1;i<=n;i++){const x=randomBernoulli(p);total+=x;trajectory.push({x:i,y:total/i});}
  const standardized=[];
  for(let r=0;r<reps;r++){let s=0;for(let i=0;i<n;i++)s+=randomBernoulli(p);const mean=s/n;const z=(mean-p)/(sigma/Math.sqrt(n));standardized.push(z);sumSq+=(mean-p)*(mean-p);}
  plotTwoSeries("llnChart",trajectory,p,p);
  drawHistogram("cltChart",standardized);
  $("convMean").textContent=fmt(p,3);
  $("convFinal").textContent=fmt(trajectory.at(-1).y,4);
  $("convMse").textContent=fmt(p*(1-p)/n,6);
  $("convObserved").textContent=fmt(sumSq/reps,6);
  $("convInterpretation").textContent=`Per p=${fmt(p,2)}, la media finale è ${fmt(trajectory.at(-1).y,4)}. Il MSE teorico della media è σ²/n=${fmt(p*(1-p)/n,6)} e tende a zero: questa è convergenza in L². L'istogramma standardizzato mostra l'approssimazione normale prevista dal CLT.`;
}

function switchTab(which){
  const conv=which==="conv";
  $("tabConv").setAttribute("aria-selected",String(conv));
  $("tabBayes").setAttribute("aria-selected",String(!conv));
  $("convergence").hidden=!conv;
  $("bayesian").hidden=conv;
  if(conv)runConvergence();else runDisease();
}

function logGamma(z) {
  const p=[0.99999999999980993,676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.984369578019572e-6,1.5056327351493116e-7];
  if(z<0.5)return Math.log(Math.PI)-Math.log(Math.sin(Math.PI*z))-logGamma(1-z);
  z-=1;let x=p[0];for(let i=1;i<p.length;i++)x+=p[i]/(z+i);
  const t=z+7.5;return 0.5*Math.log(2*Math.PI)+(z+0.5)*Math.log(t)-t+Math.log(x);
}

function betaPdf(x,a,b){
  if(x<=0||x>=1)return 0;
  return Math.exp((a-1)*Math.log(x)+(b-1)*Math.log1p(-x)-logGamma(a)-logGamma(b)+logGamma(a+b));
}

function betaContinuedFraction(a,b,x){
  const maxIterations=200,epsilon=3e-14,fpmmin=1e-300;
  const qab=a+b,qap=a+1,qam=a-1;
  let c=1,d=1-qab*x/qap;
  if(Math.abs(d)<fpmmin)d=fpmmin;
  d=1/d;
  let h=d;
  for(let m=1;m<=maxIterations;m++){
    const m2=2*m;
    let aa=m*(b-m)*x/((qam+m2)*(a+m2));
    d=1+aa*d;if(Math.abs(d)<fpmmin)d=fpmmin;
    c=1+aa/c;if(Math.abs(c)<fpmmin)c=fpmmin;
    d=1/d;h*=d*c;
    aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));
    d=1+aa*d;if(Math.abs(d)<fpmmin)d=fpmmin;
    c=1+aa/c;if(Math.abs(c)<fpmmin)c=fpmmin;
    d=1/d;
    const delta=d*c;
    h*=delta;
    if(Math.abs(delta-1)<epsilon)break;
  }
  return h;
}

function betaCDF(a,b,x){
  if(x<=0)return 0;if(x>=1)return 1;
  const front=Math.exp(logGamma(a+b)-logGamma(a)-logGamma(b)+a*Math.log(x)+b*Math.log1p(-x));
  if(x<(a+1)/(a+b+2))return front*betaContinuedFraction(a,b,x)/a;
  return 1-front*betaContinuedFraction(b,a,1-x)/b;
}

function drawBeta(aPrior,bPrior,aPost,bPost){
  const canvas=$("betaChart"),ctx=canvas.getContext("2d");
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  const l=55,r=w-18,top=18,bottom=h-38;
  let yMax=0;
  for(let i=0;i<=300;i++){const x=i/300;yMax=Math.max(yMax,betaPdf(x,aPrior,bPrior),betaPdf(x,aPost,bPost));}
  yMax*=1.1;
  ctx.strokeStyle="#dde3e8";
  for(let i=0;i<=4;i++){const y=top+(bottom-top)*i/4;ctx.beginPath();ctx.moveTo(l,y);ctx.lineTo(r,y);ctx.stroke();}
  function series(a,b,color){
    ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();
    for(let i=0;i<=300;i++){const x=i/300,y=betaPdf(x,a,b),xp=l+x*(r-l),yp=bottom-y/yMax*(bottom-top);i?ctx.lineTo(xp,yp):ctx.moveTo(xp,yp);}
    ctx.stroke();
  }
  series(aPrior,bPrior,"#225d9c");series(aPost,bPost,"#ce8951");
  ctx.fillStyle="#697480";ctx.font="12px Arial";ctx.textAlign="center";
  for(let i=0;i<=10;i++)ctx.fillText(fmt(i/10,1),l+i/10*(r-l),bottom+22);
}

function runDisease(){
  const p=Number($("priorDisease").value),se=Number($("sensitivity").value),sp=Number($("specificity").value);
  if(![p,se,sp].every(v=>Number.isFinite(v)&&v>=0&&v<=1))return;
  const fp=1-sp,tp=se;
  const evidence=tp*p+fp*(1-p);
  const post=evidence===0?null:tp*p/evidence;
  $("diseasePrior").textContent=fmt(p*100,2)+"%";
  $("diseaseTp").textContent=fmt(tp*100,2)+"%";
  $("diseaseFp").textContent=fmt(fp*100,2)+"%";
  if(post===null){
    $("diseasePosterior").textContent="Non definita";
    $("diseaseText").textContent=`Con questi parametri P(+)=0, quindi il risultato positivo ha probabilità nulla. Di conseguenza P(M|+) non è definita, perché il teorema di Bayes richiede P(+)>0.`;
  }else{
    $("diseasePosterior").textContent=fmt(post*100,2)+"%";
    $("diseaseText").textContent=`Con prevalenza prior ${fmt(p*100,2)}%, il risultato positivo considera due componenti: P(+|M)=${fmt(tp*100,2)}% nei malati e P(+|sano)=${fmt(fp*100,2)}% nei sani. Applicando Bayes, la posterior è P(M|+)=${fmt(post*100,2)}%.`;
  }
}

function runBeta(){
  const a=Number($("priorA").value),b=Number($("priorB").value),x=Number($("successes").value),n=Number($("trials").value);
  if(!(a>0&&b>0&&Number.isInteger(x)&&Number.isInteger(n)&&x>=0&&x<=n&&n>=1)){
    $("betaText").textContent="Parametri non validi: inserisci a,b>0, n≥1 e interi x,n tali che 0≤x≤n.";
    return;
  }
  const ap=a+x,bp=b+n-x;
  const priorMean=a/(a+b),postMean=ap/(ap+bp);
  let modeLabel;
  if(ap>1&&bp>1)modeLabel=fmt((ap-1)/(ap+bp-2),4);
  else if(ap<1&&bp<1)modeLabel="0 e 1";
  else if(ap===1&&bp===1)modeLabel="qualsiasi valore";
  else if(ap<=1&&bp>1)modeLabel="0";
  else if(ap>1&&bp<=1)modeLabel="1";
  else if(ap<1&&bp===1)modeLabel="0";
  else if(ap===1&&bp<1)modeLabel="1";
  else modeLabel="—";
  const prob=1-betaCDF(ap,bp,.5);
  $("betaPriorMean").textContent=fmt(priorMean,4);
  $("betaPostMean").textContent=fmt(postMean,4);
  $("betaPostMode").textContent=modeLabel;
  $("betaProb").textContent=fmt(prob*100,2)+"%";
  drawBeta(a,b,ap,bp);
  $("betaText").textContent=`Prior Beta(${fmtParam(a)},${fmtParam(b)}), dati x=${x}, n=${n}. La posterior è Beta(${fmtParam(ap)},${fmtParam(bp)}). La media prior era ${fmt(priorMean,4)}, mentre quella posterior è ${fmt(postMean,4)}.`;
}

$("tabConv").addEventListener("click",()=>switchTab("conv"));
$("tabBayes").addEventListener("click",()=>switchTab("bayes"));
$("runConv").addEventListener("click",runConvergence);
$("runDisease").addEventListener("click",runDisease);
$("runBeta").addEventListener("click",runBeta);
runConvergence();runDisease();runBeta();
