'use strict';

const exampleAssociated = `X,F,Count
Aggiornato,Intrusione,8
Aggiornato,Bloccato,32
Non aggiornato,Intrusione,27
Non aggiornato,Bloccato,13`;

const exampleIndependent = `X,F,Count
Aggiornato,Intrusione,12
Aggiornato,Bloccato,28
Non aggiornato,Intrusione,12
Non aggiornato,Bloccato,28`;

function csvFields(line, separator) {
  const fields = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === separator && !quoted) {
      fields.push(value.trim());
      value = '';
    } else {
      value += ch;
    }
  }
  if (quoted) throw new Error('Ci sono virgolette non chiuse nel CSV.');
  fields.push(value.trim());
  return fields;
}

function countDelimiter(line, separator) {
  let quoted = false;
  let count = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      if (quoted && line[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (line[i] === separator && !quoted) count++;
  }
  return count;
}

function parseDataset(input) {
  const lines = input.replace(/^\uFEFF/, '').split(/\r?\n/).map(v => v.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error('Inserisci almeno alcune osservazioni.');
  if (lines.length > 40000) throw new Error('Massimo 40.000 righe. Usa la colonna Count per aggregare i dati.');
  const separator = [',', ';', '\t'].sort((a, b) => countDelimiter(lines[0], b) - countDelimiter(lines[0], a))[0];
  if (countDelimiter(lines[0], separator) === 0) throw new Error('Usa un CSV con due colonne X,F o tre colonne X,F,Count.');
  const first = csvFields(lines[0], separator);
  const header = first[0]?.toLowerCase() === 'x' && first[1]?.toLowerCase() === 'f' &&
    (first.length === 2 || (first.length === 3 && /^(count|n|freq|frequency)$/i.test(first[2])));
  const records = [];
  let total = 0;
  for (let i = header ? 1 : 0; i < lines.length; i++) {
    const values = csvFields(lines[i], separator);
    if (values.length !== 2 && values.length !== 3) throw new Error(`Riga ${i + 1}: servono 2 o 3 colonne.`);
    const [x, f] = values;
    if (!x || !f) throw new Error(`Riga ${i + 1}: X e F non possono essere vuoti.`);
    if (x.length > 90 || f.length > 90) throw new Error(`Riga ${i + 1}: nome di categoria troppo lungo.`);
    const count = values.length === 3 ? Number(values[2]) : 1;
    if (!Number.isSafeInteger(count) || count < 1) throw new Error(`Riga ${i + 1}: Count deve essere un intero positivo.`);
    total += count;
    if (!Number.isSafeInteger(total) || total > 100000000) throw new Error('Il totale supera il limite di 100 milioni di osservazioni.');
    records.push({x, f, count});
  }
  if (!records.length) throw new Error('Non ci sono osservazioni dopo l’intestazione.');
  return records;
}

function logGamma(z) {
  const p = [0.99999999999980993,676.5203681218851,-1259.1392167224028,
    771.32342877765313,-176.61502916214059,12.507343278686905,
    -0.13857109526572012,9.984369578019572e-6,1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let sum = p[0];
  for (let i = 1; i < p.length; i++) sum += p[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

function gammaUpperRegularized(a, x) {
  if (!(a > 0) || x < 0) throw new Error('Argomenti gamma non validi.');
  if (x === 0) return 1;
  const eps = 1e-14;
  const tiny = 1e-300;
  const logTerm = a * Math.log(x) - x - logGamma(a);
  if (x < a + 1) {
    let term = 1 / a;
    let sum = term;
    for (let k = 1; k <= 2000; k++) {
      term *= x / (a + k);
      sum += term;
      if (Math.abs(term) <= Math.abs(sum) * eps) break;
    }
    return Math.min(1, Math.max(0, 1 - sum * Math.exp(logTerm)));
  }
  let b = x + 1 - a;
  if (Math.abs(b) < tiny) b = tiny;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 2000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < eps) break;
  }
  return Math.min(1, Math.max(0, Math.exp(logTerm) * h));
}

function chiSquareSurvival(chi2, degrees) {
  return gammaUpperRegularized(degrees / 2, chi2 / 2);
}

function analyze(records) {
  const xs = [...new Set(records.map(row => row.x))];
  const fs = [...new Set(records.map(row => row.f))];
  if (xs.length < 2 || fs.length < 2) throw new Error('Servono almeno due categorie diverse sia per X sia per F.');
  if (xs.length > 25 || fs.length > 25) throw new Error('Troppi valori distinti: massimo 25 categorie per variabile.');
  const ix = new Map(xs.map((v, i) => [v, i]));
  const jf = new Map(fs.map((v, i) => [v, i]));
  const observed = xs.map(() => fs.map(() => 0));
  for (const row of records) observed[ix.get(row.x)][jf.get(row.f)] += row.count;
  const rowTotals = observed.map(row => row.reduce((a, b) => a + b, 0));
  const colTotals = fs.map((_, j) => observed.reduce((sum, row) => sum + row[j], 0));
  const n = rowTotals.reduce((a, b) => a + b, 0);
  const expected = observed.map((row, i) => row.map((_, j) => rowTotals[i] * colTotals[j] / n));
  const contributions = observed.map((row, i) => row.map((value, j) => (value - expected[i][j]) ** 2 / expected[i][j]));
  const chi2 = contributions.flat().reduce((a, b) => a + b, 0);
  const df = (xs.length - 1) * (fs.length - 1);
  const pValue = chiSquareSurvival(chi2, df);
  const smallExpected = expected.flat().filter(v => v < 5).length;
  const underOne = expected.flat().filter(v => v < 1).length;
  const cramerV = Math.sqrt(chi2 / (n * Math.min(xs.length - 1, fs.length - 1)));
  return {xs,fs,observed,rowTotals,colTotals,n,expected,contributions,chi2,df,pValue,smallExpected,underOne,cramerV};
}

const byId = id => document.getElementById(id);
const format = (n, digits = 3) => Number(n).toLocaleString('it-IT', {maximumFractionDigits:digits, minimumFractionDigits: digits});
const countFormat = n => Number(n).toLocaleString('it-IT');
const pct = v => `${format(v * 100, 1)}%`;

function pFormat(p) {
  if (p < 1e-12) return p === 0 ? '< 10⁻³⁰⁰' : p.toExponential(3);
  if (p < 0.0001) return p.toExponential(3);
  return format(p, 6);
}

function td(text, small) {
  const cell = document.createElement('td');
  cell.textContent = String(text);
  if (small !== undefined) {
    const sub = document.createElement('small');
    sub.textContent = small;
    cell.append(sub);
  }
  return cell;
}

function th(text, scope) {
  const cell = document.createElement('th');
  cell.textContent = String(text);
  if (scope) cell.setAttribute('scope', scope);
  return cell;
}

function tableHead(table, values) {
  const head = table.createTHead();
  const tr = head.insertRow();
  values.forEach(value => tr.append(th(value,'col')));
}

function renderObserved(a) {
  const table = document.createElement('table');
  table.className = 'data-table';
  tableHead(table, ['X \\ F', ...a.fs, 'Totale X']);
  const body = table.createTBody();
  a.xs.forEach((name, i) => {
    const tr = body.insertRow();
    tr.append(th(name, 'row'));
    a.fs.forEach((_, j) => tr.append(td(countFormat(a.observed[i][j]), pct(a.observed[i][j] / a.n))));
    tr.append(td(countFormat(a.rowTotals[i]), pct(a.rowTotals[i] / a.n)));
  });
  const foot = table.createTFoot();
  const tr = foot.insertRow();
  tr.append(th('Totale F', 'row'));
  a.fs.forEach((_, j) => tr.append(td(countFormat(a.colTotals[j]), pct(a.colTotals[j] / a.n))));
  tr.append(td(countFormat(a.n), '100,0%'));
  byId('observedTable').replaceChildren(table);
}

function renderMatrix(container, a, matrix, valueFn) {
  const table = document.createElement('table');
  table.className = 'data-table';
  tableHead(table, ['X \\ F', ...a.fs]);
  const body = table.createTBody();
  a.xs.forEach((name, i) => {
    const tr = body.insertRow();
    tr.append(th(name, 'row'));
    a.fs.forEach((_, j) => tr.append(td(valueFn(matrix[i][j], i, j))));
  });
  byId(container).replaceChildren(table);
}

function drawChart(a) {
  const canvas = byId('comparisonChart');
  const ctx = canvas.getContext('2d');
  const width = canvas.width, height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const pairs = [];
  for (let i = 0; i < a.xs.length; i++) {
    for (let j = 0; j < a.fs.length; j++) {
      pairs.push({label:`${a.xs[i]} / ${a.fs[j]}`,observed:a.observed[i][j],expected:a.expected[i][j]});
    }
  }
  const selected = pairs.slice(0, 12);
  const left = 52, right = width - 16, top = 15, bottom = height - 82;
  const max = Math.max(1, ...selected.map(p => Math.max(p.observed, p.expected))) * 1.08;
  ctx.strokeStyle = '#e0e5eb';
  ctx.fillStyle = '#586673';
  ctx.font = '12px Arial';
  ctx.textAlign = 'right';
  for (let k = 0; k <= 4; k++) {
    const y = bottom - (bottom - top) * k / 4;
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    ctx.fillText(format(max * k / 4, 0), left - 9, y + 4);
  }
  const space = (right - left) / selected.length;
  const barWidth = Math.min(23, space * 0.28);
  selected.forEach((entry, i) => {
    const center = left + space * (i + 0.5);
    const h1 = (bottom - top) * entry.observed / max;
    const h2 = (bottom - top) * entry.expected / max;
    ctx.fillStyle = '#225d9c';
    ctx.fillRect(center - barWidth - 2, bottom - h1, barWidth, h1);
    ctx.fillStyle = '#d69a69';
    ctx.fillRect(center + 2, bottom - h2, barWidth, h2);
    ctx.save();
    ctx.translate(center + 8, bottom + 11);
    ctx.rotate(-Math.PI / 4);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#5c6773';
    ctx.font = '11px Arial';
    const name = entry.label.length > 25 ? entry.label.slice(0, 23) + '…' : entry.label;
    ctx.fillText(name, 0, 0);
    ctx.restore();
  });
  byId('chartNote').textContent = pairs.length > 12
    ? `Il grafico mostra solo le prime 12 coppie su ${pairs.length}; tutte sono incluse nel test e nelle tabelle.`
    : 'Le barre mostrano i conteggi assoluti per ogni coppia di categorie.';
}

function renderConclusion(a, alpha) {
  const significant = a.pValue < alpha;
  const result = byId('interpretation');
  const title = document.createElement('strong');
  title.textContent = significant ? 'Rifiutiamo H₀ di indipendenza.' : 'Non rifiutiamo H₀ di indipendenza.';
  const description = document.createElement('p');
  description.style.margin = '7px 0 0';
  description.textContent = significant
    ? `Il p-value (${pFormat(a.pValue)}) è inferiore ad α = ${format(alpha, 2)}. I dati mostrano evidenza statistica di associazione tra X e F. Questo non dimostra una relazione causale.`
    : `Il p-value (${pFormat(a.pValue)}) è maggiore o uguale ad α = ${format(alpha, 2)}. I dati non forniscono sufficiente evidenza contro l'indipendenza, ma non provano che X e F siano indipendenti nella popolazione.`;
  const effect = document.createElement('p');
  effect.style.margin = '6px 0 0';
  effect.textContent = `V di Cramér = ${format(a.cramerV, 3)} (misura descrittiva dell'intensità dell'associazione nel campione; da 0 a 1).`;
  result.replaceChildren(title,description,effect);
  const assumptions = byId('assumptions');
  const totalCells = a.xs.length * a.fs.length;
  if (a.underOne > 0 || a.smallExpected / totalCells > 0.20) {
    assumptions.textContent = `Attenzione: ${a.smallExpected} celle su ${totalCells} hanno frequenza attesa inferiore a 5; ${a.underOne} celle sono sotto 1. L'approssimazione χ² può essere poco affidabile: considera più dati, categorie aggregate in modo giustificato o un test esatto/permutazionale.`;
  } else if (a.smallExpected > 0) {
    assumptions.textContent = `${a.smallExpected} celle su ${totalCells} hanno frequenze attese inferiori a 5 (nessuna sotto 1). La comune regola orientativa del 20% è rispettata, ma l'accuratezza resta dipendente dal campione. Le osservazioni devono essere indipendenti.`;
  } else {
    assumptions.textContent = `Tutte le ${totalCells} celle hanno frequenze attese almeno pari a 5. La condizione pratica sui conteggi è rispettata; resta necessario che le osservazioni siano indipendenti.`;
  }
}

function calculate() {
  const error = byId('error');
  error.hidden = true;
  try {
    const data = analyze(parseDataset(byId('dataInput').value));
    byId('results').hidden = false;
    byId('totalCount').textContent = countFormat(data.n);
    byId('chiValue').textContent = format(data.chi2, 4);
    byId('degrees').textContent = countFormat(data.df);
    byId('pValue').textContent = pFormat(data.pValue);
    renderObserved(data);
    renderMatrix('rowConditionals', data, data.observed, (value, i) => pct(value / data.rowTotals[i]));
    renderMatrix('columnConditionals', data, data.observed, (value, _, j) => pct(value / data.colTotals[j]));
    renderMatrix('expectedTable', data, data.expected, value => format(value, 3));
    renderMatrix('contributionTable', data, data.contributions, value => format(value, 4));
    drawChart(data);
    renderConclusion(data, Number(byId('alpha').value));
  } catch (err) {
    byId('results').hidden = true;
    error.textContent = err.message || String(err);
    error.hidden = false;
  }
}

function init() {
  byId('dataInput').value = exampleAssociated;
  byId('calculate').addEventListener('click', calculate);
  byId('alpha').addEventListener('change', calculate);
  byId('associatedExample').addEventListener('click', () => {byId('dataInput').value = exampleAssociated; calculate();});
  byId('independentExample').addEventListener('click', () => {byId('dataInput').value = exampleIndependent; calculate();});
  calculate();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}

if (typeof module !== 'undefined' && module.exports) module.exports = {parseDataset, analyze, chiSquareSurvival};
