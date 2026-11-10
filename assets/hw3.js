'use strict';

const SECP = Object.freeze({
  p: 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2Fn,
  n: 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n,
  G: {
    x: 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798n,
    y: 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8n
  }
});

const enFrequency = [8.167,1.492,2.782,4.253,12.702,2.228,2.015,6.094,6.966,0.153,0.772,4.025,2.406,6.749,7.507,1.929,0.095,5.987,6.327,9.056,2.758,0.978,2.360,0.150,1.974,0.074];
const $ = id => document.getElementById(id);
const modP = a => ((a % SECP.p) + SECP.p) % SECP.p;
const zero = () => ({x:0n,y:1n,z:0n});
const toJac = p => ({x:p.x,y:p.y,z:1n});
const isZero = p => p.z === 0n;
const modPow = (a, exp) => {
  let r = 1n;
  a = modP(a);
  while(exp > 0n) {
    if ((exp & 1n) === 1n) r = modP(r * a);
    a = modP(a * a);
    exp >>= 1n;
  }
  return r;
};

function doubleJ(q) {
  if (isZero(q) || q.y === 0n) return zero();
  const A = modP(q.x * q.x);
  const B = modP(q.y * q.y);
  const C = modP(B * B);
  const D = modP(2n * (modP((q.x + B) ** 2n) - A - C));
  const E = modP(3n * A);
  const F = modP(E * E);
  return {
    x: modP(F - 2n * D),
    y: modP(E * (D - modP(F - 2n * D)) - 8n * C),
    z: modP(2n * q.y * q.z)
  };
}

function addJ(p, q) {
  if (isZero(p)) return q;
  if (isZero(q)) return p;
  const z1s = modP(p.z * p.z);
  const z2s = modP(q.z * q.z);
  const u1 = modP(p.x * z2s);
  const u2 = modP(q.x * z1s);
  const s1 = modP(p.y * q.z * z2s);
  const s2 = modP(q.y * p.z * z1s);
  const h = modP(u2 - u1);
  const r = modP(s2 - s1);
  if (h === 0n) return r === 0n ? doubleJ(p) : zero();
  const hh = modP(h * h);
  const hhh = modP(hh * h);
  const v = modP(u1 * hh);
  const x3 = modP(r * r - hhh - 2n * v);
  const y3 = modP(r * (v - x3) - s1 * hhh);
  return {x:x3, y:y3, z:modP(h * p.z * q.z)};
}

function mulJ(point, scalar) {
  if (scalar <= 0n || scalar >= SECP.n) throw new Error('Scalare ECC non valido');
  let result = zero();
  for (const bit of scalar.toString(2)) {
    result = doubleJ(result);
    if (bit === '1') result = addJ(result, toJac(point));
  }
  return result;
}

function toAffine(q) {
  if (isZero(q)) throw new Error('Punto all’infinito');
  const zInv = modPow(q.z, SECP.p - 2n);
  const z2 = modP(zInv * zInv);
  return {x:modP(q.x * z2), y:modP(q.y * z2 * zInv)};
}

function matchesJacAffine(q, point) {
  if (isZero(q)) return false;
  const z2 = modP(q.z * q.z);
  return q.x === modP(point.x * z2) && q.y === modP(point.y * z2 * q.z);
}

function randomScalar() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const value = BigInt('0x' + bytesHex(raw));
  return (value % (SECP.n - 1n)) + 1n;
}

const hex32 = n => n.toString(16).padStart(64,'0');
const hexPoint = pt => '04' + hex32(pt.x) + hex32(pt.y);
const bytesHex = bytes => [...bytes].map(x => x.toString(16).padStart(2,'0')).join('');
const hexBytes = text => new Uint8Array(text.match(/.{2}/g).map(h => parseInt(h,16)));
const textBytes = text => new TextEncoder().encode(text);

async function derivedKey(shared, ephemeral, mode) {
  const material = await crypto.subtle.importKey('raw', hexBytes(hex32(shared.x)), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({
    name:'HKDF', hash:'SHA-256', salt:hexBytes(hexPoint(ephemeral)),
    info:textBytes('ecc-caesar-homework-ecdh-aes-gcm-v1')
  },material,{name:'AES-GCM',length:256},false,[mode]);
}

function getSecret() {
  const k = Number($('eccPrivate').value);
  if (!Number.isInteger(k) || k < 1 || k > 2000) throw new Error('La chiave privata deve essere un intero tra 1 e 2000.');
  return BigInt(k);
}

let eccPackage = null;
let eccPublic = null;

function setStatus(id, text, state='info') {
  const el = $(id);
  el.textContent = text;
  el.className = 'small-note mt-2 ' + (state === 'error' ? 'text-danger' : state === 'success' ? 'text-success' : '');
}

function ensureCrypto() {
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto?.subtle) throw new Error('Il browser non rende disponibile Web Crypto. Apri il sito su localhost o HTTPS.');
}

async function eccEncrypt() {
  try {
    ensureCrypto();
    const k = getSecret();
    const message = $('eccPlain').value;
    if (!message) throw new Error('Scrivi un messaggio prima di cifrarlo.');
    $('eccEncrypt').disabled = true;
    const publicKey = toAffine(mulJ(SECP.G,k));
    const r = randomScalar();
    const ephemeral = toAffine(mulJ(SECP.G,r));
    const shared = toAffine(mulJ(publicKey,r));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await derivedKey(shared,ephemeral,'encrypt');
    const ct = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,textBytes(message)));
    eccPackage = {ephemeral,iv,ciphertext:ct};
    eccPublic = publicKey;
    $('eccPublic').textContent = '04' + hex32(publicKey.x) + hex32(publicKey.y);
    $('eccEphemeral').textContent = '04' + hex32(ephemeral.x) + hex32(ephemeral.y);
    $('eccCiphertext').textContent = bytesHex(ct);
    $('eccIv').textContent = bytesHex(iv);
    $('eccDecrypted').textContent = '—';
    $('eccRecovered').textContent = '—';
    $('eccAttackInfo').textContent = '—';
    $('eccPrivateDecrypt').value = k.toString();
    setStatus('eccStatus','Messaggio cifrato. Premi Decifra per verificarlo.','success');
    setStatus('eccAttackStatus','');
  } catch(err) {
    setStatus('eccStatus',err.message,'error');
  } finally {
    $('eccEncrypt').disabled = false;
  }
}

async function eccDecryptWith(k) {
  if (!eccPackage) throw new Error('Prima cifra un messaggio.');
  const shared = toAffine(mulJ(eccPackage.ephemeral,BigInt(k)));
  const aesKey = await derivedKey(shared,eccPackage.ephemeral,'decrypt');
  const plain = await crypto.subtle.decrypt({name:'AES-GCM',iv:eccPackage.iv},aesKey,eccPackage.ciphertext);
  return new TextDecoder('utf-8',{fatal:true}).decode(plain);
}

async function eccDecrypt() {
  try {
    ensureCrypto();
    const k=Number($('eccPrivateDecrypt').value);
    if (!Number.isInteger(k) || k < 1 || k > 2000) throw new Error('Inserisci una chiave privata tra 1 e 2000.');
    $('eccDecrypted').textContent = await eccDecryptWith(k);
    setStatus('eccStatus','Decifratura riuscita con la chiave privata corretta.','success');
  } catch(err) {
    $('eccDecrypted').textContent = '—';
    setStatus('eccStatus','Decifratura non riuscita: chiave errata oppure dati modificati.','error');
  }
}

async function attackECC() {
  try {
    ensureCrypto();
    if (!eccPackage || !eccPublic) throw new Error('Prima cifra un messaggio.');
    const limit=Number($('eccAttackLimit').value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 2000) throw new Error('Il limite di ricerca deve essere tra 1 e 2000.');
    $('eccAttack').disabled=true;
    const start=performance.now();
    let test = zero();
    let found = null;
    for (let trial=1;trial<=limit;trial++) {
      test=addJ(test,toJac(SECP.G));
      if(matchesJacAffine(test,eccPublic)) {found=trial;break;}
    }
    const elapsed=(performance.now()-start).toFixed(1);
    if (found === null) {
      $('eccRecovered').textContent='Nessuna chiave nell’intervallo testato';
      $('eccAttackInfo').textContent=`${limit} chiavi controllate in ${elapsed} ms`;
      setStatus('eccAttackStatus','La chiave potrebbe essere fuori dall’intervallo scelto.');
      return;
    }
    $('eccRecovered').textContent=String(found);
    $('eccAttackInfo').textContent=`${found} tentativi · ${elapsed} ms · confrontando dG con la chiave pubblica`;
    const recovered=await eccDecryptWith(found);
    $('eccDecrypted').textContent=recovered;
    setStatus('eccAttackStatus','Chiave recuperata e messaggio decifrato: ' + recovered,'success');
  } catch(err) {
    setStatus('eccAttackStatus',err.message,'error');
  } finally {
    $('eccAttack').disabled=false;
  }
}

function rotateCaesar(text, key) {
  return text.replace(/[A-Za-z]/g,char=>{
    const start=char.charCodeAt(0) >= 97 ? 97 : 65;
    return String.fromCharCode(start+(char.charCodeAt(0)-start+key%26+26)%26);
  });
}

function countLetters(text) {
  const counts=Array(26).fill(0);
  for(const char of text.toUpperCase()) {
    const c=char.charCodeAt(0)-65;
    if(c>=0 && c<26) counts[c]++;
  }
  return counts;
}

function chiSquare(text) {
  const counts=countLetters(text);
  const total=counts.reduce((a,b)=>a+b,0);
  if (!total) return Infinity;
  return counts.reduce((score,actual,i)=>{
    const expected=total*enFrequency[i]/100;
    return score+(actual-expected)**2/expected;
  },0);
}

function candidateKeys(cipher) {
  return Array.from({length:26},(_,k)=>({
    key:k,decoded:rotateCaesar(cipher,-k),score:chiSquare(rotateCaesar(cipher,-k))
  })).sort((a,b)=>a.score-b.score);
}

function caesarEncrypt() {
  const plain=$('caesarPlain').value;
  const key=Number($('caesarKey').value);
  if (!Number.isInteger(key) || key < 0 || key > 25) {
    setStatus('caesarStatus','La chiave deve essere un intero tra 0 e 25.','error');
    return;
  }
  $('caesarCipher').value=rotateCaesar(plain,key);
  $('caesarDecoded').value=rotateCaesar($('caesarCipher').value,-key);
  setStatus('caesarStatus',`Chiave ${key}: cifratura e decifratura completate.`,'success');
  attackCaesar();
}

function caesarDecrypt() {
  const key=Number($('caesarKey').value);
  if (!Number.isInteger(key) || key < 0 || key > 25) return;
  $('caesarDecoded').value=rotateCaesar($('caesarCipher').value,-key);
}

function attackCaesar() {
  const cipher=$('caesarCipher').value;
  if (!countLetters(cipher).some(Boolean)) {
    $('caesarBest').textContent='Inserisci un testo cifrato con delle lettere.';
    $('caesarRank').replaceChildren();
    return;
  }
  const ranked=candidateKeys(cipher);
  $('caesarBest').textContent=`Chiave stimata: ${ranked[0].key} · χ² = ${ranked[0].score.toFixed(2)}\n\n${ranked[0].decoded}`;
  const tbody=$('caesarRank');
  tbody.replaceChildren();
  ranked.slice(0,8).forEach((c,i)=>{
    const tr=document.createElement('tr');
    [String(i+1),String(c.key),c.score.toFixed(2),c.decoded.slice(0,110).replace(/\s+/g,' ')].forEach(v=>{
      const td=document.createElement('td');td.textContent=v;tr.append(td);
    });
    tbody.append(tr);
  });
  renderFrequencyChart(ranked[0].decoded);
}

function renderFrequencyChart(text) {
  const canvas=$('frequencyChart');
  const ctx=canvas.getContext('2d');
  const w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);
  const observed=countLetters(text);
  const n=observed.reduce((a,b)=>a+b,0);
  const percentages=observed.map(x=>n?100*x/n:0);
  const max=Math.max(...percentages,...enFrequency,1)*1.10;
  const left=23,right=12,top=18,bottom=34;
  const bw=(w-left-right)/26;
  ctx.strokeStyle='#d8dfe7';
  ctx.beginPath();ctx.moveTo(left,h-bottom);ctx.lineTo(w-right,h-bottom);ctx.stroke();
  for(let i=0;i<26;i++) {
    const px=left+i*bw;
    const refH=enFrequency[i]/max*(h-top-bottom);
    const obsH=percentages[i]/max*(h-top-bottom);
    ctx.fillStyle='#cbd5e1';ctx.fillRect(px+1,h-bottom-refH,bw*.37,refH);
    ctx.fillStyle='#2563a6';ctx.fillRect(px+bw*.49,h-bottom-obsH,bw*.36,obsH);
    ctx.fillStyle='#6b7280';ctx.font='11px Arial';ctx.fillText(String.fromCharCode(65+i),px+3,h-14);
  }
}

const longEnglishText = `The small town library opened early every morning, and the reading room quickly filled with people preparing for the day. Students worked through exercises, visitors read local newspapers, and a retired teacher helped children choose books. By the window, a young engineer often studied mathematics before leaving for work. She liked the quiet atmosphere because difficult problems seemed easier when there were fewer distractions. The librarian kept careful records of borrowed books and ordered new titles whenever the shelves became too crowded. Every Friday, the library organized a discussion about science, history, or life in the town.

During the summer the local school invited volunteers to build a garden behind the sports field. They planted vegetables, measured the rainfall, and compared how quickly different seeds began to grow. Each group recorded its observations in a notebook. Some days were unusually dry, so the children designed a simple irrigation system using collected rainwater. Their teacher explained why experiments need repeatable measurements rather than guesses. At the end of the project, the students presented the results to their families and shared the vegetables with a nearby community kitchen.

A small team of researchers wanted to understand how people travel across the city. Instead of relying on a single busy street, they counted vehicles at several intersections and interviewed passengers at different times of day. The results showed that short trips were common, but a reliable bus service could reduce the number of cars. The team checked its calculations, described the limitations of the sample, and published a report that residents could easily read. A good statistical argument, they concluded, depends on both suitable data and clear explanations.

On a rainy afternoon, three friends decided to repair an old bicycle rather than buy a new one. They cleaned the chain, replaced a worn cable, and adjusted the brakes. At first the gears made an unpleasant noise, but after several careful attempts the bicycle moved smoothly again. The repair was not expensive, and the friends learned how many small mechanical parts must work together. They were pleased that their practical solution saved material and extended the useful life of something that had almost been thrown away.

In the evening the neighborhood bakery prepared bread for the following morning. The baker mixed flour, water, yeast, and salt, then allowed the dough to rest in a cool room. He noticed that different temperatures changed how quickly the dough expanded. Over time he collected notes that helped him make consistent loaves. Customers cared most about the taste and the fresh smell, but the process also showed how observation, repetition, and simple measurement can improve an everyday task.

The university course introduced students to probability with familiar examples such as dice, cards, and the weather. Later the class considered more complicated questions about biased samples and uncertain predictions. The professor encouraged everyone to test assumptions and explain why an attractive pattern might still be the result of chance. Working in small groups, the students compared their methods and learned that two calculations can look similar while answering different questions. Their final reports included both successful results and experiments that had failed.

A traveler kept a journal during a long train journey through several regions. She described changing landscapes, conversations with strangers, and the practical details of each station. The notes were useful because they preserved ordinary observations that would otherwise have been forgotten. When she returned home, she organized the entries by date and wrote a short summary for friends. She also checked place names and distances to avoid reporting details that she remembered incorrectly. Her account became more reliable as she separated direct observations from later interpretations.

The city museum created a new exhibition about communication. Visitors could compare handwritten letters, printed newspapers, early radio equipment, and modern digital networks. Each invention solved a different problem, although many shared the goal of carrying information across distance. A guide explained that faster communication does not automatically guarantee accurate information. People still need ways to recognize errors, verify sources, and understand the context of a message before making important decisions.

An amateur astronomy club met on clear nights outside the city where the sky was darker. Its members used a telescope, star charts, and a notebook to record observations of the moon and nearby planets. Beginners sometimes mistook reflections for distant objects, so experienced members taught them to repeat an observation before drawing conclusions. Over several months, the club compared notes and improved its ability to locate faint objects. The meetings were enjoyable, but they also provided a practical lesson in patient and systematic measurement.

At the end of the year, several local organizations reviewed their projects. They compared budgets, volunteer hours, and the number of residents who had participated. The reports showed that successful activities depended not only on good ideas but also on regular communication and realistic planning. One group discovered that its initial survey had reached too few people to support a broad conclusion. Rather than hide the problem, it designed a better survey for the following year. The participants agreed that useful analysis should reveal uncertainty as clearly as it reports results.`;

function corpusWindows(text,length,count) {
  const letters=text.replace(/[^A-Za-z]/g,'').toUpperCase();
  if(letters.length<length) return [];
  const maxOffset=letters.length-length;
  return Array.from({length:count},(_,idx)=>letters.slice(Math.floor(maxOffset*(idx+.35)/(count+.7)),Math.floor(maxOffset*(idx+.35)/(count+.7))+length));
}

function runLengthExperiments() {
  const corpus=$('testCorpus').value;
  const n=corpus.replace(/[^A-Za-z]/g,'').length;
  const lengths=[20,50,100,250,500,1000];
  const tbody=$('testResults');
  tbody.replaceChildren();
  const trials=12;
  let used=0;
  for(const size of lengths) {
    const windows=corpusWindows(corpus,size,trials);
    if(windows.length===0) continue;
    let correct=0;
    for(let j=0;j<windows.length;j++) {
      const key=1+(j*7+size)%25;
      const ct=rotateCaesar(windows[j],key);
      const found=candidateKeys(ct)[0].key;
      if(found===key) correct++;
    }
    const tr=document.createElement('tr');
    [String(size),String(windows.length),String(correct),`${(100*correct/windows.length).toFixed(1)}%`].forEach(v=>{
      const td=document.createElement('td');td.textContent=v;tr.append(td);
    });
    tbody.append(tr);
    used++;
  }
  $('testExplanation').textContent=used ? `Corpus: ${n} lettere inglesi, 12 prove per lunghezza con chiavi diverse. Le percentuali sono risultati dell’esperimento sul corpus fornito e non probabilità universali.` : 'Il corpus è troppo corto: inserisci almeno 20 lettere.';
}

function initialize() {
  $('eccEncrypt').addEventListener('click',eccEncrypt);
  $('eccDecrypt').addEventListener('click',eccDecrypt);
  $('eccAttack').addEventListener('click',attackECC);
  $('caesarEncrypt').addEventListener('click',caesarEncrypt);
  $('caesarDecrypt').addEventListener('click',caesarDecrypt);
  $('caesarAttack').addEventListener('click',attackCaesar);
  $('caesarCipher').addEventListener('input',attackCaesar);
  $('testButton').addEventListener('click',runLengthExperiments);
  $('testCorpus').value=longEnglishText;
  caesarEncrypt();
  runLengthExperiments();
  setStatus('eccStatus','Pronto per cifrare il messaggio.');
}

document.addEventListener('DOMContentLoaded',initialize);
