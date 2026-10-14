/* ==========================================================================
   0. GESTORE UNIVERSALE TAB (GARANTITO SENZA CONFLITTI)
   ========================================================================== */
function setupTabNavigation() {
  const tabGroups = ['#topLevelNav', '#hw1SubTabs', '#hw2SubTabs'];

  tabGroups.forEach(navSelector => {
    const nav = document.querySelector(navSelector);
    if (!nav) return;

    const buttons = nav.querySelectorAll('button[data-bs-toggle]');
    buttons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();

        // 1. Attiva/disattiva stato pulsanti
        buttons.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        // 2. Mostra/nasconde il relativo pannello
        const targetSelector = btn.getAttribute('data-bs-target');
        if (!targetSelector) return;
        const targetPane = document.querySelector(targetSelector);
        if (!targetPane || !targetPane.parentElement) return;

        // Disattiva solo i pannelli fratelli
        const siblings = targetPane.parentElement.children;
        for (let i = 0; i < siblings.length; i++) {
          if (siblings[i].classList.contains('tab-pane')) {
            siblings[i].classList.remove('show', 'active');
          }
        }
        targetPane.classList.add('show', 'active');

        // Se torniamo su HW1 ridisegniamo il canvas
        if (targetSelector === '#hw1-master-pane' || targetSelector === '#calc-pane') {
          setTimeout(() => {
            if (typeof updateUI === 'function') updateUI();
          }, 50);
        }
      });
    });
  });
}

/* ==========================================================================
   1. ARITMETICA TOY ECC (HOMEWORK 1): y² ≡ x³ + 7 (mod 17)
   ========================================================================== */
const P_MOD = 17;
const A_COEFF = 0;
const B_COEFF = 7;

function mod(n, m = P_MOD) {
  return ((n % m) + m) % m;
}

function modInverse(a, m = P_MOD) {
  a = mod(a, m);
  for (let x = 1; x < m; x++) {
    if ((a * x) % m === 1) return x;
  }
  return null;
}

function isPointOnCurve(pt) {
  if (!pt) return true;
  const [x, y] = pt;
  return mod(y * y) === mod(x * x * x + A_COEFF * x + B_COEFF);
}

function getAllCurvePoints() {
  const points = [];
  for (let x = 0; x < P_MOD; x++) {
    for (let y = 0; y < P_MOD; y++) {
      if (isPointOnCurve([x, y])) {
        points.push([x, y]);
      }
    }
  }
  return points;
}

function pointAdd(P, Q) {
  if (!P) return { R: Q, lambda: null, third: null, type: 'identity' };
  if (!Q) return { R: P, lambda: null, third: null, type: 'identity' };

  const [x1, y1] = P;
  const [x2, y2] = Q;

  if (x1 === x2 && mod(y1 + y2) === 0) {
    return { R: null, lambda: null, third: null, type: 'infinity' };
  }

  let num, den;
  const isDouble = (x1 === x2 && y1 === y2);

  if (isDouble) {
    num = mod(3 * x1 * x1 + A_COEFF);
    den = mod(2 * y1);
  } else {
    num = mod(y2 - y1);
    den = mod(x2 - x1);
  }

  const invDen = modInverse(den);
  if (invDen === null) {
    return { R: null, lambda: null, third: null, type: 'infinity' };
  }

  const lambda = mod(num * invDen);
  const x3 = mod(lambda * lambda - x1 - x2);
  const y3 = mod(lambda * (x1 - x3) - y1);
  const thirdPoint = [x3, mod(-y3)];

  return {
    R: [x3, y3],
    lambda: lambda,
    third: thirdPoint,
    type: isDouble ? 'double' : 'add',
    formula: isDouble 
      ? `λ = (3·${x1}² + 0)/(2·${y1}) = ${num}·${den}⁻¹ ≡ ${lambda} (mod 17)`
      : `λ = (${y2} - ${y1})/(${x2} - ${x1}) = ${num}·${den}⁻¹ ≡ ${lambda} (mod 17)`
  };
}

function calculateSequence(G, k, method = 'naive') {
  const steps = [];
  if (method === 'naive') {
    let current = G;
    steps.push({
      stepNumber: 1,
      desc: `1G = G = (${G[0]}, ${G[1]})`,
      P: null,
      Q: G,
      result: G,
      opDetails: null
    });

    for (let i = 2; i <= k; i++) {
      const op = pointAdd(current, G);
      steps.push({
        stepNumber: i,
        desc: `${i}G = ${i - 1}G + G`,
        P: current,
        Q: G,
        result: op.R,
        opDetails: op
      });
      current = op.R;
      if (!current) break;
    }
  } else {
    const bits = k.toString(2);
    let current = null;
    let stepCount = 1;

    for (let idx = 0; idx < bits.length; idx++) {
      const bit = bits[idx];
      if (current !== null) {
        const dbl = pointAdd(current, current);
        steps.push({
          stepNumber: stepCount++,
          desc: `Bit ${bit}: Raddoppio`,
          P: current,
          Q: current,
          result: dbl.R,
          opDetails: dbl
        });
        current = dbl.R;
      }
      if (bit === '1') {
        if (current === null) {
          current = G;
          steps.push({
            stepNumber: stepCount++,
            desc: `Bit 1: Inizializza con G`,
            P: null,
            Q: G,
            result: G,
            opDetails: null
          });
        } else {
          const add = pointAdd(current, G);
          steps.push({
            stepNumber: stepCount++,
            desc: `Bit 1: Somma G`,
            P: current,
            Q: G,
            result: add.R,
            opDetails: add
          });
          current = add.R;
        }
      }
    }
  }
  return steps;
}

// Canvas & Visualizzazione HW1
const allPoints = getAllCurvePoints();
let currentSteps = [];
let animIndex = 0;
let playInterval = null;

const canvas = document.getElementById('eccCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;

function mapCoords(val, size) {
  const padding = 30;
  const step = (size - 2 * padding) / (P_MOD - 1);
  return padding + val * step;
}

function drawGridAndPoints() {
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  ctx.strokeStyle = '#e9ecef';
  ctx.lineWidth = 1;
  for (let i = 0; i < P_MOD; i++) {
    const x = mapCoords(i, w);
    const y = mapCoords(i, h);
    ctx.beginPath();
    ctx.moveTo(x, mapCoords(0, h));
    ctx.lineTo(x, mapCoords(16, h));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(mapCoords(0, w), y);
    ctx.lineTo(mapCoords(16, w), y);
    ctx.stroke();

    ctx.fillStyle = '#adb5bd';
    ctx.font = '10px monospace';
    ctx.fillText(i, x - 3, h - 10);
    ctx.fillText(16 - i, 10, y + 4);
  }

  allPoints.forEach(([px, py]) => {
    const cx = mapCoords(px, w);
    const cy = mapCoords(16 - py, h);
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#6c757d';
    ctx.fill();
  });
}

function renderFrame(step) {
  drawGridAndPoints();
  if (!step || !ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  if (step.opDetails && step.opDetails.lambda !== null) {
    const l = step.opDetails.lambda;
    const [x1, y1] = step.P;

    ctx.strokeStyle = '#ffc107';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < P_MOD; x++) {
      const y = mod(l * (x - x1) + y1);
      const cx = mapCoords(x, w);
      const cy = mapCoords(16 - y, h);
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffc107';
      ctx.fill();
    }

    if (step.opDetails.third && step.result) {
      const tx = mapCoords(step.opDetails.third[0], w);
      const ty = mapCoords(16 - step.opDetails.third[1], h);
      const rx = mapCoords(step.result[0], w);
      const ry = mapCoords(16 - step.result[1], h);

      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#dc3545';
      ctx.moveTo(tx, ty);
      ctx.lineTo(rx, ry);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(tx, ty, 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#dc3545';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  if (step.P) {
    ctx.beginPath();
    ctx.arc(mapCoords(step.P[0], w), mapCoords(16 - step.P[1], h), 7, 0, Math.PI * 2);
    ctx.fillStyle = '#0d6efd';
    ctx.fill();
  }
  if (step.Q) {
    ctx.beginPath();
    ctx.arc(mapCoords(step.Q[0], w), mapCoords(16 - step.Q[1], h), 6, 0, Math.PI * 2);
    ctx.fillStyle = '#fd7e14';
    ctx.fill();
  }
  if (step.result) {
    ctx.beginPath();
    ctx.arc(mapCoords(step.result[0], w), mapCoords(16 - step.result[1], h), 8, 0, Math.PI * 2);
    ctx.fillStyle = '#198754';
    ctx.fill();
  }
}

function updateUI() {
  if (currentSteps.length === 0) return;
  const current = currentSteps[animIndex];
  renderFrame(current);

  const descEl = document.getElementById('stepDescription');
  if (descEl) {
    descEl.innerHTML = 
      `Passo ${animIndex + 1}/${currentSteps.length}: <strong>${current.desc}</strong> → Risultato: <code>${current.result ? `(${current.result[0]}, ${current.result[1]})` : 'O (Infinito)'}</code>`;
  }

  const items = document.querySelectorAll('#logList .list-group-item');
  items.forEach((item, i) => {
    item.classList.toggle('active', i === animIndex);
  });
}

function runComputation() {
  clearInterval(playInterval);
  document.getElementById('btnPlay').textContent = '▶ Play Animazione';

  const gCoords = document.getElementById('selectG').value.split(',').map(Number);
  const k = parseInt(document.getElementById('inputK').value) || 1;
  const method = document.getElementById('selectMethod').value;

  currentSteps = calculateSequence(gCoords, k, method);
  animIndex = 0;

  const finalPoint = currentSteps[currentSteps.length - 1].result;
  document.getElementById('pubKeyResult').textContent = finalPoint 
    ? `Q = (${finalPoint[0]}, ${finalPoint[1]})` 
    : 'O (Punto all\'infinito)';
  document.getElementById('calcInfoBadge').textContent = `Passi: ${currentSteps.length}`;

  const logList = document.getElementById('logList');
  logList.innerHTML = '';
  currentSteps.forEach((s, idx) => {
    const item = document.createElement('a');
    item.href = '#';
    item.className = 'list-group-item list-group-item-action py-2';
    item.innerHTML = `<div class="d-flex justify-content-between">
      <span><strong>#${s.stepNumber}</strong> ${s.desc}</span>
      <span class="text-primary">${s.result ? `(${s.result[0]},${s.result[1]})` : 'O'}</span>
    </div>
    ${s.opDetails && s.opDetails.formula ? `<div class="text-muted" style="font-size: 11px;">${s.opDetails.formula}</div>` : ''}`;
    
    item.addEventListener('click', (e) => {
      e.preventDefault();
      clearInterval(playInterval);
      document.getElementById('btnPlay').textContent = '▶ Play Animazione';
      animIndex = idx;
      updateUI();
    });
    logList.appendChild(item);
  });

  updateUI();
}

function initSelectG() {
  const select = document.getElementById('selectG');
  if (!select) return;
  select.innerHTML = '';
  allPoints.forEach(([x, y]) => {
    const opt = document.createElement('option');
    opt.value = `${x},${y}`;
    opt.textContent = `(${x}, ${y})`;
    if (x === 1 && y === 5) opt.selected = true;
    select.appendChild(opt);
  });
}

function runStatisticalAnalysis() {
  const G = [1, 5];
  const maxK = 17;
  const samples = [];

  for (let k = 1; k <= maxK; k++) {
    const Q = calculateSequence(G, k, 'naive').pop().result;
    if (Q) samples.push({ k, x: Q[0], y: Q[1] });
  }

  const countX = new Array(P_MOD).fill(0);
  const countY = new Array(P_MOD).fill(0);
  samples.forEach(s => {
    countX[s.x]++;
    countY[s.y]++;
  });

  let htmlCoords = '<div class="row"><div class="col-6"><strong>Coord X:</strong><br>';
  countX.forEach((c, val) => {
    if (c > 0) htmlCoords += `val ${val} → ${c} volte<br>`;
  });
  htmlCoords += '</div><div class="col-6"><strong>Coord Y:</strong><br>';
  countY.forEach((c, val) => {
    if (c > 0) htmlCoords += `val ${val} → ${c} volte<br>`;
  });
  htmlCoords += '</div></div>';
  const el = document.getElementById('statCoords');
  if (el) el.innerHTML = htmlCoords;

  const n = samples.length;
  const meanK = samples.reduce((acc, s) => acc + s.k, 0) / n;
  const meanX = samples.reduce((acc, s) => acc + s.x, 0) / n;
  let num = 0, denK = 0, denX = 0;
  samples.forEach(s => {
    num += (s.k - meanK) * (s.x - meanX);
    denK += (s.k - meanK) ** 2;
    denX += (s.x - meanX) ** 2;
  });
  const corr = num / Math.sqrt(denK * denX);

  let totalBitDiffECC = 0, totalBitDiffHash = 0, testCount = 0;
  for (let k = 1; k <= 8; k++) {
    const kFlipped = k ^ 1;
    if (kFlipped === 0 || kFlipped > 17) continue;

    const Q1 = calculateSequence(G, k, 'naive').pop().result;
    const Q2 = calculateSequence(G, kFlipped, 'naive').pop().result;

    if (Q1 && Q2) {
      const xDiff = (Q1[0] ^ Q2[0]).toString(2).split('1').length - 1;
      totalBitDiffECC += xDiff;

      const h1 = mod((k * 2654435761) ^ (k >> 3));
      const h2 = mod((kFlipped * 2654435761) ^ (kFlipped >> 3));
      const hDiff = (h1 ^ h2).toString(2).split('1').length - 1;
      totalBitDiffHash += hDiff;
      testCount++;
    }
  }

  const avgDiffECC = (totalBitDiffECC / testCount).toFixed(2);
  const avgDiffHash = (totalBitDiffHash / testCount).toFixed(2);

  const elM = document.getElementById('statMetrics');
  if (elM) {
    elM.innerHTML = `
      <li>• <strong>Punti generati:</strong> 8 punti (+ punto all'infinito)</li>
      <li>• <strong>Correlazione Pearson (k vs x):</strong> <code>${corr.toFixed(4)}</code> (nessun trend lineare)</li>
      <li>• <strong>Test Valanga (flip 1 bit in k):</strong>
        <ul>
          <li>Media bit cambiati in x(Q): <strong>${avgDiffECC} / 5</strong> bit</li>
          <li>Media bit cambiati in Hash: <strong>${avgDiffHash} / 5</strong> bit</li>
        </ul>
      </li>
    `;
  }
}

/* ==========================================================================
   2. HOMEWORK 2: WALLET SEED TO ETHEREUM ADDRESS
   ========================================================================== */
function hasEthers() {
  return typeof window.ethers !== 'undefined';
}

function runHW2Pipeline() {
  const errBox = document.getElementById('hw2ErrorAlert');
  errBox.classList.add('d-none');
  errBox.textContent = '';

  if (!hasEthers()) {
    errBox.textContent = 'Libreria ethers.js non caricata. Verifica la connessione a Internet.';
    errBox.classList.remove('d-none');
    return;
  }

  try {
    const ethers = window.ethers;
    const phrase = document.getElementById('hw2Mnemonic').value.trim();
    const passphrase = document.getElementById('hw2Passphrase').value;
    const path = document.getElementById('hw2Path').value.trim() || "m/44'/60'/0'/0/0";

    if (!phrase) {
      throw new Error('Inserisci una frase mnemonica valida (12 o 24 parole).');
    }

    const mnemonicObj = ethers.Mnemonic.fromPhrase(phrase);
    
    // Passo 1: Entropia
    document.getElementById('hw2OutStep1').innerHTML = `
      <div><strong>Frase:</strong> ${phrase}</div>
      <div class="mt-1"><strong>Entropia Hex:</strong> ${mnemonicObj.entropy}</div>
    `;

    // Passo 2: Seed a 512 bit
    const seed = mnemonicObj.computeSeed(passphrase);
    document.getElementById('hw2OutStep2').innerHTML = `
      <div><strong>Seed (512 bit / 64 byte):</strong></div>
      <div class="text-primary mt-1">${seed}</div>
      <div class="text-muted mt-1 small">Salt: "mnemonic${passphrase}" · Iterazioni: 2048</div>
    `;

    // Passo 3: Derivazione BIP-32 / BIP-44
    const rootNode = ethers.HDNodeWallet.fromSeed(seed);
    const childWallet = rootNode.derivePath(path);
    document.getElementById('hw2OutCurrentPath').textContent = path;
    document.getElementById('hw2OutStep3').innerHTML = `
      <div><strong>Percorso:</strong> ${path}</div>
      <div><strong>Chiave Privata (256 bit):</strong> <span class="text-danger fw-bold">${childWallet.privateKey}</span></div>
      <div><strong>Chain Code:</strong> ${childWallet.chainCode}</div>
    `;

    // Passo 4: Chiave Pubblica non compressa secp256k1 (64 byte)
    const uncompressedPub = ethers.SigningKey.computePublicKey(childWallet.privateKey, false);
    const rawPub64 = '0x' + uncompressedPub.slice(4); // rimuove il prefisso 0x04
    document.getElementById('hw2OutStep4').innerHTML = `
      <div><strong>Chiave Pubblica Completa (65 byte con prefisso 0x04):</strong> ${uncompressedPub}</div>
      <div class="mt-1"><strong>Coppia di coordinate (x || y) per Ethereum (64 byte):</strong></div>
      <div class="text-info-emphasis mt-1">${rawPub64}</div>
    `;

    // Passo 5: Hash Keccak-256 (ultimi 20 byte)
    const keccakPub = ethers.keccak256(rawPub64);
    const rawAddress = '0x' + keccakPub.slice(-40);
    document.getElementById('hw2OutStep5').innerHTML = `
      <div><strong>Keccak-256 della Chiave Pubblica:</strong> ${keccakPub}</div>
      <div class="mt-1"><strong>Ultimi 20 byte (Raw Address):</strong> <span class="fw-bold">${rawAddress.toLowerCase()}</span></div>
    `;

    // Passo 6: EIP-55 Checksum
    const checksummedAddress = ethers.getAddress(rawAddress);
    document.getElementById('hw2OutStep6').textContent = checksummedAddress;
    document.getElementById('hw2AddrInput').value = checksummedAddress;

    // Primi 5 account derivati
    const tableBody = document.getElementById('hw2ManyAccountsTable');
    tableBody.innerHTML = '';
    const basePath = path.replace(/\/\d+$/, '');
    for (let i = 0; i < 5; i++) {
      const accPath = `${basePath}/${i}`;
      const accWallet = rootNode.derivePath(accPath);
      const row = document.createElement('tr');
      row.innerHTML = `<td>#${i}</td><td>${accPath}</td><td class="text-success">${accWallet.address}</td>`;
      tableBody.appendChild(row);
    }

  } catch (err) {
    errBox.textContent = err.message || err;
    errBox.classList.remove('d-none');
  }
}

function generateRandomMnemonic(wordCount = 12) {
  if (!hasEthers()) return;
  try {
    const ethers = window.ethers;
    const entropyLength = wordCount === 24 ? 32 : 16;
    const entropy = ethers.randomBytes(entropyLength);
    const mnemonic = ethers.Mnemonic.fromEntropy(entropy);
    document.getElementById('hw2Mnemonic').value = mnemonic.phrase;
    runHW2Pipeline();
  } catch (err) {
    console.error(err);
  }
}

function validateEIP55() {
  const addr = document.getElementById('hw2AddrInput').value.trim();
  const statusEl = document.getElementById('hw2AddrValidationStatus');
  if (!addr) {
    statusEl.innerHTML = '';
    return;
  }
  if (!hasEthers()) {
    statusEl.innerHTML = `<div class="alert alert-warning py-2 small mb-0">Ethers.js non caricato.</div>`;
    return;
  }

  try {
    const ethers = window.ethers;
    if (!ethers.isAddress(addr)) {
      statusEl.innerHTML = `<div class="alert alert-danger py-2 small mb-0">❌ Formato indirizzo non valido (lunghezza errata o caratteri non esadecimali).</div>`;
      return;
    }

    const clean = addr.toLowerCase();
    const expected = ethers.getAddress(clean);

    if (addr === addr.toLowerCase() || addr === addr.toUpperCase()) {
      statusEl.innerHTML = `<div class="alert alert-warning py-2 small mb-0">⚠️ Indirizzo valido ma privo di checksum (tutto minuscolo/maiuscolo). EIP-55 atteso: <code class="mono fw-bold">${expected}</code></div>`;
    } else if (addr === expected) {
      statusEl.innerHTML = `<div class="alert alert-success py-2 small mb-0">✅ Checksum EIP-55 <strong>VALIDO</strong>. Indirizzo integro.</div>`;
    } else {
      statusEl.innerHTML = `<div class="alert alert-danger py-2 small mb-0">❌ Checksum EIP-55 <strong>NON VALIDO</strong>! Rilevato errore di digitazione.<br>Indirizzo corretto atteso: <code class="mono fw-bold">${expected}</code></div>`;
    }
  } catch (e) {
    statusEl.innerHTML = `<div class="alert alert-danger py-2 small mb-0">Errore: ${e.message}</div>`;
  }
}

function introduceTypo() {
  const addr = document.getElementById('hw2AddrInput').value.trim();
  if (addr.length !== 42) return;

  const pos = 2 + Math.floor(Math.random() * 40);
  const chars = '0123456789abcdefABCDEF';
  let newChar = chars[Math.floor(Math.random() * chars.length)];
  while (newChar === addr[pos]) {
    newChar = chars[Math.floor(Math.random() * chars.length)];
  }

  const brokenAddr = addr.substring(0, pos) + newChar + addr.substring(pos + 1);
  document.getElementById('hw2AddrInput').value = brokenAddr;
  validateEIP55();
}

function updateHashComparison() {
  const input = document.getElementById('hw2HashTestInput').value;
  const isHex = document.getElementById('hw2HashIsHex').checked;

  try {
    let data;
    if (isHex && hasEthers()) {
      const cleanHex = input.startsWith('0x') ? input : '0x' + input;
      data = window.ethers.getBytes(cleanHex);
    } else {
      data = new TextEncoder().encode(input);
    }

    const hKeccak = window.keccak256 ? window.keccak256(data) : 'N/A';
    const hSha3 = window.sha3_256 ? window.sha3_256(data) : 'N/A';
    const hSha256 = hasEthers() ? window.ethers.sha256(data).slice(2) : 'N/A';
    const hSha512 = hasEthers() ? window.ethers.sha512(data).slice(2) : 'N/A';

    document.getElementById('outH_keccak').textContent = hKeccak;
    document.getElementById('outH_sha3').textContent = hSha3;
    document.getElementById('outH_sha256').textContent = hSha256;
    document.getElementById('outH_sha512').textContent = hSha512;
  } catch (err) {
    document.getElementById('outH_keccak').textContent = 'Errore input';
    document.getElementById('outH_sha3').textContent = '-';
    document.getElementById('outH_sha256').textContent = '-';
    document.getElementById('outH_sha512').textContent = '-';
  }
}

function runHW2StatisticalBenchmark() {
  if (!hasEthers()) return;
  const ethers = window.ethers;
  const trials = parseInt(document.getElementById('hw2StatTrials').value) || 500;
  const avalancheBins = new Array(257).fill(0);
  const bitCounts = new Array(256).fill(0);
  let totalFlipped = 0;

  for (let i = 0; i < trials; i++) {
    const msg = ethers.randomBytes(32);
    const h1 = ethers.getBytes(ethers.keccak256(msg));

    const bitPos = Math.floor(Math.random() * 256);
    const msg2 = new Uint8Array(msg);
    msg2[Math.floor(bitPos / 8)] ^= (1 << (bitPos % 8));

    const h2 = ethers.getBytes(ethers.keccak256(msg2));

    let diff = 0;
    for (let b = 0; b < 32; b++) {
      let xor = h1[b] ^ h2[b];
      while (xor > 0) {
        if (xor & 1) diff++;
        xor >>= 1;
      }
    }

    avalancheBins[diff]++;
    totalFlipped += diff;

    for (let bitIdx = 0; bitIdx < 256; bitIdx++) {
      if ((h1[Math.floor(bitIdx / 8)] >> (bitIdx % 8)) & 1) {
        bitCounts[bitIdx]++;
      }
    }
  }

  const avgDiff = (totalFlipped / trials).toFixed(2);
  const summaryEl = document.getElementById('hw2StatSummary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      Campioni analizzati: <strong>${trials}</strong>. Media bit mutati: <strong>${avgDiff} / 256</strong> (~${((avgDiff / 256) * 100).toFixed(1)}%).
      Conferma dell'effetto valanga ideale del 50%.
    `;
  }

  const cvAv = document.getElementById('hw2CvAvalanche');
  if (cvAv) {
    const cAv = cvAv.getContext('2d');
    cAv.clearRect(0, 0, cvAv.width, cvAv.height);
    cAv.fillStyle = '#0d6efd';

    const maxVal = Math.max(...avalancheBins, 1);
    for (let i = 80; i <= 176; i++) {
      const x = ((i - 80) / 96) * cvAv.width;
      const barH = (avalancheBins[i] / maxVal) * (cvAv.height - 20);
      cAv.fillRect(x, cvAv.height - barH, cvAv.width / 96 - 1, barH);
    }
  }

  const cvBits = document.getElementById('hw2CvBits');
  if (cvBits) {
    const cBits = cvBits.getContext('2d');
    cBits.clearRect(0, 0, cvBits.width, cvBits.height);

    cBits.strokeStyle = '#dc3545';
    cBits.setLineDash([4, 4]);
    cBits.beginPath();
    cBits.moveTo(0, cvBits.height / 2);
    cBits.lineTo(cvBits.width, cvBits.height / 2);
    cBits.stroke();
    cBits.setLineDash([]);

    cBits.fillStyle = '#198754';
    for (let b = 0; b < 256; b++) {
      const x = (b / 256) * cvBits.width;
      const pct = bitCounts[b] / trials;
      const y = cvBits.height - (pct * cvBits.height);
      cBits.fillRect(x, y - 1, 2, 3);
    }
  }
}

/* ==========================================================================
   3. INIZIALIZZAZIONE GENERALE ALL'AVVIO
   ========================================================================== */
window.addEventListener('DOMContentLoaded', () => {
  // Attiva la navigazione a schede universale
  setupTabNavigation();

  // HW1 Init
  initSelectG();
  drawGridAndPoints();
  runComputation();
  runStatisticalAnalysis();

  // HW1 Event Listeners
  document.getElementById('btnCompute').addEventListener('click', runComputation);
  document.getElementById('btnNext').addEventListener('click', () => {
    if (animIndex < currentSteps.length - 1) { animIndex++; updateUI(); }
  });
  document.getElementById('btnPrev').addEventListener('click', () => {
    if (animIndex > 0) { animIndex--; updateUI(); }
  });
  document.getElementById('btnReset').addEventListener('click', () => {
    animIndex = 0; updateUI();
  });
  document.getElementById('btnPlay').addEventListener('click', function () {
    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
      this.textContent = '▶ Play Animazione';
    } else {
      this.textContent = '⏸ Pausa';
      playInterval = setInterval(() => {
        if (animIndex < currentSteps.length - 1) {
          animIndex++;
          updateUI();
        } else {
          clearInterval(playInterval);
          playInterval = null;
          document.getElementById('btnPlay').textContent = '▶ Play Animazione';
        }
      }, 1200);
    }
  });

  // HW2 Event Listeners
  document.getElementById('hw2BtnDerive').addEventListener('click', runHW2Pipeline);
  document.getElementById('hw2BtnGen12').addEventListener('click', () => generateRandomMnemonic(12));
  document.getElementById('hw2BtnGen24').addEventListener('click', () => generateRandomMnemonic(24));
  document.getElementById('hw2BtnVecTest').addEventListener('click', () => {
    document.getElementById('hw2Mnemonic').value = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    document.getElementById('hw2Passphrase').value = "";
    document.getElementById('hw2Path').value = "m/44'/60'/0'/0/0";
    runHW2Pipeline();
  });

  document.getElementById('hw2BtnCheckAddr').addEventListener('click', validateEIP55);
  document.getElementById('hw2BtnAddTypo').addEventListener('click', introduceTypo);
  document.getElementById('hw2HashTestInput').addEventListener('input', updateHashComparison);
  document.getElementById('hw2HashIsHex').addEventListener('change', updateHashComparison);
  document.getElementById('hw2BtnRunStats').addEventListener('click', runHW2StatisticalBenchmark);

  // Esecuzione di default all'avvio
  if (hasEthers()) {
    generateRandomMnemonic(12);
    updateHashComparison();
    runHW2StatisticalBenchmark();
  }
});