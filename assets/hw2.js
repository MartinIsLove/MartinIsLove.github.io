'use strict';

const field = id => document.getElementById(id);
const text = (id, value) => {field(id).textContent = String(value);};
let secretsVisible = false;
let statsRunning = false;
const referencePhrase = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

function requireEthers() {
  if (!window.ethers || !window.ethers.Mnemonic || !window.ethers.HDNodeWallet) {
    throw new Error('La libreria ethers.js non è disponibile. È necessaria una connessione Internet per caricare le dipendenze CDN.');
  }
  return window.ethers;
}

function validPath(path) {
  if (!/^m(?:\/(?:0|[1-9]\d*)'?){1,10}$/.test(path)) return false;
  return path.slice(2).split('/').every(p => Number(p.replace("'",'')) < 2147483648);
}

function kv(id, pairs) {
  const parent=field(id);
  parent.replaceChildren();
  for (const [name,value,secret] of pairs) {
    const line=document.createElement('div');
    const title=document.createElement('strong');title.textContent=name+': ';
    const content=document.createElement('span');content.textContent=value;
    if (secret && !secretsVisible) content.classList.add('secret-blur');
    if (secret) content.dataset.secret='true';
    line.append(title,content);
    parent.append(line);
  }
}

function clearPipeline() {
  for(const id of ['hw2OutStep1','hw2OutStep2','hw2OutStep3','hw2OutStep4','hw2OutStep5','hw2OutStep6']) text(id,'—');
  field('hw2ManyAccountsTable').replaceChildren();
}

function showError(message) {
  const el=field('hw2ErrorAlert');
  el.textContent=message;
  el.classList.remove('d-none');
}

function hideError() {
  field('hw2ErrorAlert').classList.add('d-none');
  field('hw2ErrorAlert').textContent='';
}

function runPipeline() {
  clearPipeline();hideError();
  try {
    const eth=requireEthers();
    const phrase=field('hw2Mnemonic').value.trim().toLowerCase().replace(/\s+/g,' ');
    const passphrase=field('hw2Passphrase').value;
    const path=field('hw2Path').value.trim();
    if(!eth.Mnemonic.isValidMnemonic(phrase)) throw new Error('Frase BIP-39 non valida: verifica parole, lunghezza e checksum. Il dizionario della demo è inglese.');
    if(!validPath(path)) throw new Error('Percorso non valido. Esempio: m/44\'/60\'/0\'/0/0. Gli indici devono essere inferiori a 2³¹.');
    if(path.split('/').at(-1).endsWith("'")) throw new Error('Per visualizzare più indirizzi, l’ultimo indice del path deve essere non hardened.');
    const mnemonic=eth.Mnemonic.fromPhrase(phrase,passphrase);
    const seed=mnemonic.computeSeed();
    const entropy=mnemonic.entropy;
    const entropySize=(entropy.length-2)*4;
    const checksumSize=entropySize/32;
    const hashFirst=Number.parseInt(eth.sha256(entropy).slice(2,4),16);
    const checksum=hashFirst.toString(2).padStart(8,'0').slice(0,checksumSize);
    const root=eth.HDNodeWallet.fromSeed(seed);
    const wallet=root.derivePath(path);
    const fullPub=eth.SigningKey.computePublicKey(wallet.privateKey,false);
    const rawPub='0x'+fullPub.slice(4);
    const keccak=eth.keccak256(rawPub);
    const rawAddress='0x'+keccak.slice(-40).toLowerCase();
    const checksumAddr=eth.getAddress(rawAddress);
    if(checksumAddr !== wallet.address) throw new Error('Il confronto indipendente dell’indirizzo Ethereum non coincide.');
    kv('hw2OutStep1',[
      ['Parole',String(phrase.split(' ').length)],
      ['Entropia',`${entropySize} bit · ${entropy}` ,true],
      ['Checksum BIP-39',`${checksumSize} bit · ${checksum}`]
    ]);
    kv('hw2OutStep2',[
      ['Seed',`${seed} (512 bit)`,true],
      ['Funzione','PBKDF2-HMAC-SHA512 · 2048 iterazioni · salt = "mnemonic" + passphrase (NFKD)']
    ]);
    text('hw2OutCurrentPath',path);
    kv('hw2OutStep3',[
      ['Path',wallet.path || path],
      ['Master chain code',root.chainCode,true],
      ['Chiave privata (256 bit)',wallet.privateKey,true],
      ['Chain code del nodo',wallet.chainCode,true]
    ]);
    kv('hw2OutStep4',[
      ['Chiave pubblica non compressa (65 byte)',fullPub],
      ['Coordinate x ‖ y (64 byte)',rawPub]
    ]);
    kv('hw2OutStep5',[
      ['Keccak-256 della chiave pubblica',keccak],
      ['Ultimi 20 byte',rawAddress]
    ]);
    text('hw2OutStep6',checksumAddr);
    field('hw2AddrInput').value=checksumAddr;
    field('hw2AddrValidationStatus').replaceChildren();
    const prefix=path.slice(0,path.lastIndexOf('/'));
    const tbody=field('hw2ManyAccountsTable');
    for(let i=0;i<5;i++){
      const derivedPath=`${prefix}/${i}`;
      const item=root.derivePath(derivedPath);
      const tr=document.createElement('tr');
      for(const s of [String(i),derivedPath,item.address]){
        const td=document.createElement('td');td.textContent=s;tr.append(td);
      }
      tbody.append(tr);
    }
  } catch(error){
    clearPipeline();showError(error instanceof Error ? error.message : String(error));
  }
}

function createMnemonic(count) {
  hideError();
  try {
    const eth=requireEthers();
    const entropy=eth.randomBytes(count===24?32:16);
    field('hw2Mnemonic').value=eth.Mnemonic.fromEntropy(entropy).phrase;
    field('hw2Passphrase').value='';
    runPipeline();
  } catch(error){showError(error.message || String(error));}
}

function testVector() {
  field('hw2Mnemonic').value=referencePhrase;
  field('hw2Passphrase').value='';
  field('hw2Path').value="m/44'/60'/0'/0/0";
  runPipeline();
}

function status(kind,message) {
  const block=document.createElement('div');
  block.className=`alert alert-${kind} py-2 small mb-0`;
  block.textContent=message;
  field('hw2AddrValidationStatus').replaceChildren(block);
}

function checkAddress() {
  let eth;
  try{eth=requireEthers();}catch(e){status('warning',e.message);return;}
  const original=field('hw2AddrInput').value.trim();
  if(!/^0x[0-9a-fA-F]{40}$/.test(original)) {
    status('danger','Formato non valido: occorrono 0x e 40 caratteri esadecimali.');return;
  }
  const expected=eth.getAddress(original.toLowerCase());
  const body=original.slice(2);
  if(body===body.toLowerCase()||body===body.toUpperCase()) {
    status('warning',`Indirizzo formalmente valido, ma senza verifica EIP-55 (tutto minuscolo/maiuscolo). Capitalizzazione corrispondente: ${expected}`);
  } else if(original===expected){
    status('success','Checksum EIP-55 valido: la capitalizzazione corrisponde a questo indirizzo.');
  } else {
    status('danger',`Checksum EIP-55 non valido: è presente almeno una discrepanza. Capitalizzazione ricalcolata sugli stessi 20 byte: ${expected}. Questa NON è una correzione dell’indirizzo originale.`);
  }
}

function randomInt(max){
  const data=new Uint32Array(1);
  crypto.getRandomValues(data);
  return data[0]%max;
}

function typo() {
  const eth=window.ethers;
  let original=field('hw2AddrInput').value.trim();
  if(!eth||!/^0x[0-9a-fA-F]{40}$/.test(original)){
    status('warning','Inserisci prima un indirizzo valido o esegui la pipeline.');return;
  }
  original=eth.getAddress(original.toLowerCase());
  const chars='0123456789abcdef';
  for(let attempt=0;attempt<200;attempt++){
    const pos=2+randomInt(40);
    const replacement=chars[randomInt(chars.length)];
    if(replacement===original[pos].toLowerCase())continue;
    const damaged=original.slice(0,pos)+replacement+original.slice(pos+1);
    if(damaged!==eth.getAddress(damaged.toLowerCase())){
      field('hw2AddrInput').value=damaged;
      checkAddress();return;
    }
  }
  status('warning','Impossibile creare un refuso rilevabile: riprova.');
}

function toBytes() {
  const value=field('hw2HashTestInput').value;
  if(!field('hw2HashIsHex').checked) return new TextEncoder().encode(value);
  const clean=value.startsWith('0x')?value.slice(2):value;
  if(clean.length%2!==0 || !/^[\da-fA-F]*$/.test(clean))throw new Error('Input HEX non valido: occorrono coppie complete di caratteri esadecimali.');
  return window.ethers.getBytes('0x'+clean);
}

function comparison() {
  try{
    const eth=requireEthers();
    const bytes=toBytes();
    text('outH_keccak',eth.keccak256(bytes));
    text('outH_sha256',eth.sha256(bytes));
    text('outH_sha512',eth.sha512(bytes));
    text('outH_sha3',window.sha3_256?'0x'+window.sha3_256(bytes):'Libreria SHA3-256 non disponibile');
  }catch(error){
    for(const id of ['outH_keccak','outH_sha256','outH_sha512','outH_sha3'])text(id,'—');
    text('outH_keccak',error.message || String(error));
  }
}

function popcount(n){
  let count=0;
  while(n){n&=n-1;count++;}
  return count;
}

function paintHistogram(canvas,buckets,trials){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  c.clearRect(0,0,w,h);
  c.fillStyle='#fff';c.fillRect(0,0,w,h);
  const left=34,bottom=27,top=20,right=10;
  const max=Math.max(1,...buckets);
  const cell=(w-left-right)/buckets.length;
  c.font='10px sans-serif';c.fillStyle='#8190a7';c.textAlign='center';
  c.strokeStyle='#dbe3ee';c.beginPath();c.moveTo(left,top);c.lineTo(left,h-bottom);c.lineTo(w-right,h-bottom);c.stroke();
  buckets.forEach((n,i)=>{
    const bh=(n/max)*(h-bottom-top-10);
    c.fillStyle='#5675e9';c.fillRect(left+i*cell+1,h-bottom-bh,Math.max(2,cell-2),bh);
    if(i%4===0){c.fillStyle='#8290a5';c.fillText(String(i*8),left+(i+.5)*cell,h-9);}
  });
  c.fillStyle='#67758a';c.textAlign='left';c.fillText('Cambiamenti su 256 bit',60,12);
}

function paintBits(canvas,counts,trials){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  c.clearRect(0,0,w,h);
  c.fillStyle='#fff';c.fillRect(0,0,w,h);
  const left=32,right=10,top=18,bottom=28;
  const mid=top+(h-bottom-top)/2;
  c.strokeStyle='#e7ebf2';
  for(let level=0;level<=4;level++){
    const y=top+level*(h-bottom-top)/4;
    c.beginPath();c.moveTo(left,y);c.lineTo(w-right,y);c.stroke();
  }
  c.strokeStyle='#d17c7c';c.setLineDash([5,4]);c.beginPath();c.moveTo(left,mid);c.lineTo(w-right,mid);c.stroke();c.setLineDash([]);
  c.fillStyle='#148c7c';
  const step=(w-left-right)/256;
  for(let i=0;i<256;i++){
    const p=counts[i]/trials;
    const y=top+(1-p)*(h-bottom-top);
    c.fillRect(left+i*step, y, Math.max(1.1,step*.75), Math.max(2,Math.abs(y-mid)/16));
  }
  c.fillStyle='#7b899b';c.font='10px sans-serif';c.textAlign='left';
  c.fillText('100%',2,top+3);c.fillText('50%',7,mid+3);c.fillText('0%',12,h-bottom+3);
  c.fillText('0',left,h-9);c.fillText('bit 255',w-46,h-9);
}

async function stats() {
  if(statsRunning)return;
  statsRunning=true;
  const button=field('hw2BtnRunStats');
  button.disabled=true;button.textContent='Analisi in corso…';
  try{
    const eth=requireEthers();
    const trials=Number(field('hw2StatTrials').value);
    if(!Number.isInteger(trials)||trials<50||trials>1500)throw new Error('Seleziona da 50 a 1500 campioni interi.');
    const histogram=Array(33).fill(0);
    const bits=Array(256).fill(0);
    let total=0,sumSquares=0;
    for(let i=0;i<trials;i++){
      const msg=eth.randomBytes(32);
      const h1=eth.getBytes(eth.keccak256(msg));
      const flip=randomInt(256);
      const changed=new Uint8Array(msg);
      changed[Math.floor(flip/8)]^=(1<<(flip%8));
      const h2=eth.getBytes(eth.keccak256(changed));
      let diff=0;
      for(let j=0;j<32;j++){
        diff+=popcount(h1[j]^h2[j]);
        for(let b=0;b<8;b++)bits[j*8+b]+=(h1[j]>>b)&1;
      }
      histogram[Math.min(32,Math.floor(diff/8))]++;
      total+=diff;sumSquares+=diff*diff;
      if(i%100===99)await new Promise(resolve=>setTimeout(resolve,0));
    }
    const avg=total/trials;
    const sd=Math.sqrt(Math.max(0,sumSquares/trials-avg*avg));
    const allOnes=bits.reduce((a,b)=>a+b,0);
    text('hw2StatSummary',`${trials} campioni · media bit cambiati = ${avg.toFixed(2)}/256 (${(avg/256*100).toFixed(2)}%) · deviazione standard = ${sd.toFixed(2)} · bit a 1 complessivi = ${(100*allOnes/(trials*256)).toFixed(2)}%. Valore atteso ideale per la media: 128 bit; il test non dimostra la sicurezza crittografica.`);
    paintHistogram(field('hw2CvAvalanche'),histogram,trials);
    paintBits(field('hw2CvBits'),bits,trials);
  }catch(error){text('hw2StatSummary',error.message || String(error));}
  finally{statsRunning=false;button.disabled=false;button.textContent='Esegui Test';}
}

function toggleSecrets(){
  secretsVisible=!secretsVisible;
  for(const el of document.querySelectorAll('[data-secret="true"]'))el.classList.toggle('secret-blur',!secretsVisible);
  const btn=field('hw2ToggleSecrets');
  btn.setAttribute('aria-pressed',String(secretsVisible));
  btn.textContent=secretsVisible?'Nascondi i valori riservati':'Mostra i valori riservati';
}

function init() {
  field('hw2BtnDerive').addEventListener('click',runPipeline);
  field('hw2BtnGen12').addEventListener('click',()=>createMnemonic(12));
  field('hw2BtnGen24').addEventListener('click',()=>createMnemonic(24));
  field('hw2BtnVecTest').addEventListener('click',testVector);
  field('hw2ToggleSecrets').addEventListener('click',toggleSecrets);
  field('hw2BtnCheckAddr').addEventListener('click',checkAddress);
  field('hw2BtnAddTypo').addEventListener('click',typo);
  field('hw2HashTestInput').addEventListener('input',comparison);
  field('hw2HashIsHex').addEventListener('change',comparison);
  field('hw2BtnRunStats').addEventListener('click',stats);
  field('hw2Mnemonic').value=referencePhrase;
  runPipeline();
  comparison();
}

document.addEventListener('DOMContentLoaded',init);
