'use strict';
/* ICS106 Lab 10 — Smart Object Recognition
 * Both models (V1 and V2) can stay loaded at the same time.
 * One "Classify" or "Test all conditions" click runs every loaded model on the SAME input,
 * so V1 and V2 are always compared on identical images.
 */
const $ = (id) => document.getElementById(id);
const el = {
  urlV1: $('urlV1'), urlV2: $('urlV2'), loadV1: $('loadV1'), loadV2: $('loadV2'),
  modelInfo: $('modelInfo'), activeModel: $('activeModel'), headerTag: $('headerTag'),
  imageInput: $('imageInput'), preview: $('preview'), previewHint: $('previewHint'),
  classifyBtn: $('classifyBtn'), status: $('status'),
  topClass: $('topClass'), topConfidence: $('topConfidence'), predictions: $('predictions'),
  compare: $('compare'), warning: $('warning'), threshold: $('threshold'), thresholdOut: $('thresholdOut'),
  actualClass: $('actualClass'), condition: $('condition'), recordBtn: $('recordBtn'),
  logBody: $('logBody'), summary: $('summary'),
  exportBtn: $('exportBtn'), exportV1Btn: $('exportV1Btn'), exportV2Btn: $('exportV2Btn'), clearBtn: $('clearBtn'),
  varActual: $('varActual'), varBtn: $('varBtn'), varLogBtn: $('varLogBtn'), seeMoreBtn: $('seeMoreBtn'),
  varStatus: $('varStatus'), varSummary: $('varSummary'), variantGrid: $('variantGrid'),
  cam: $('cam'), camBtn: $('camBtn'), camStatus: $('camStatus'), camTop: $('camTop'), camScores: $('camScores'), camWarning: $('camWarning')
};
const VERSIONS = ['V1', 'V2'];
const INPUTS = { V1: el.urlV1, V2: el.urlV2 };
const CARDS = { V1: el.urlV1.closest('.model-card'), V2: el.urlV2.closest('.model-card') };
const CONDITIONS = ['Upright', 'Rotated 90°', 'Rotated 180°', 'Low lighting', 'Complex background', 'Increased distance'];

const models = { V1: null, V2: null };   // { model, url, labels }
let active = null;                       // 'V1' | 'V2'
let selectedImageReady = false;
let currentObjectUrl = null;
let selectedFileName = '';
let lastPreds = {};                      // { V1: sortedPredictions, V2: sortedPredictions } for the current image
let log = [];                            // one row per test image, with V1 and V2 results
let lastKey = null;                      // row to flash after recording
let variants = [];                       // generated condition versions + predictions

/* ---------- helpers ---------- */
const loaded = () => VERSIONS.filter((v) => models[v]);
const pct = (p) => (p * 100).toFixed(1);
const sortPreds = (raw) => [...raw].sort((a, b) => b.probability - a.probability);
function setStatus(message, kind = '') { el.status.textContent = message; el.status.className = kind; }
function updateButtons() {
  const any = loaded().length > 0;
  el.classifyBtn.disabled = !any || !selectedImageReady;
  el.recordBtn.disabled = !Object.keys(lastPreds).length || el.actualClass.disabled;
  el.varBtn.disabled = !any || !selectedImageReady;
  el.varLogBtn.disabled = !variants.length || el.varActual.disabled || !el.varActual.value;
  el.seeMoreBtn.disabled = !variants.length;
}
function resetResults(message = 'No prediction for this image yet.') {
  clearVariants();
  lastPreds = {};
  el.topClass.textContent = 'No result yet';
  el.topClass.classList.add('empty');
  el.topConfidence.textContent = loaded().length ? 'Choose an image and click Classify image.' : 'Load a model, then classify an image.';
  el.warning.hidden = true;
  el.compare.textContent = '';
  el.predictions.replaceChildren();
  const p = document.createElement('p'); p.className = 'fine'; p.textContent = message;
  el.predictions.append(p);
  updateButtons();
}

/* ---------- FR-01 / FR-06 / FR-07 / FR-08: model loading ---------- */
function normalizeModelUrl(raw) {
  const s = (raw || '').trim();
  if (!s) throw new Error('Enter a model URL first.');
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {          // local folder, e.g. models/v1/
    if (/^[\w\-./ ]+$/.test(s) && !s.includes('..')) return s.replace(/\/?$/, '/');
    throw new Error('Enter a Teachable Machine link or a local folder such as models/v1/.');
  }
  let url;
  try { url = new URL(s); } catch { throw new Error('That is not a valid URL.'); }
  if (url.protocol !== 'https:') throw new Error('Use an HTTPS model URL.');
  if (url.hostname !== 'teachablemachine.withgoogle.com') throw new Error('Use a published Teachable Machine model URL.');
  if (!/^\/models\/[^/]+\/?$/.test(url.pathname)) throw new Error('Expected a URL ending in /models/MODEL_ID/');
  if (url.search || url.hash) throw new Error('Remove query parameters and # fragments.');
  return url.origin + url.pathname.replace(/\/?$/, '/');
}
function friendlyLoadError(err) {
  const m = err.message || String(err);
  if (/Enter|valid URL|HTTPS|Expected|Use a|Remove|library/.test(m)) return m;
  return 'could not download model files. Check the URL is published and you are online (local folders need a web server, not file://).';
}
async function loadModelFor(version) {
  el.loadV1.disabled = el.loadV2.disabled = true;
  setStatus(`Loading ${version}...`);
  try {
    if (typeof tmImage === 'undefined') throw new Error('Teachable Machine library unavailable. Check internet access.');
    const url = normalizeModelUrl(INPUTS[version].value);
    const model = await tmImage.load(url + 'model.json', url + 'metadata.json');
    // Only replace this slot once the new model loaded successfully. The other slot is untouched.
    models[version] = { model, url, labels: model.getClassLabels() };
    try { localStorage.setItem('ics106_url_' + version, url); } catch { /* ignore */ }
    active = version;
    fillClassSelects(models[version].labels);
    showActiveModel();
    resetResults();
    const other = VERSIONS.find((v) => v !== version);
    let msg = `${version} loaded and active.`;
    if (models[other] && models[other].labels.join('|') !== models[version].labels.join('|')) {
      msg += ` Warning: ${version} and ${other} have different class names or order. Results cannot be compared correctly.`;
      setStatus(msg, 'error');
    } else {
      if (selectedImageReady) msg += ' Click Classify image.';
      setStatus(msg, 'success');
    }
  } catch (err) {
    const keep = active ? ` ${active} is still active.` : '';
    setStatus(`${version} failed to load: ${friendlyLoadError(err)}${keep}`, 'error');
  } finally {
    el.loadV1.disabled = el.loadV2.disabled = false;
    updateButtons();
  }
}
function fillClassSelects(labels) {
  [el.actualClass, el.varActual].forEach((sel) => {
    const prev = sel.value;
    sel.replaceChildren(...labels.map((l) => new Option(l, l)));
    if (labels.includes(prev)) sel.value = prev;
    sel.disabled = false;
  });
}
function showActiveModel() {
  const l = loaded();
  const m = models[active];
  el.activeModel.textContent = `${active} (${m.labels.length} classes)`;
  el.headerTag.textContent = l.length > 1 ? `Active: ${active} · both loaded` : `Active: ${active}`;
  el.headerTag.classList.add('live');
  el.modelInfo.textContent = l.map((v) => `${v}: ${models[v].labels.length} classes — ${models[v].url}`).join('  |  ')
    + (l.length > 1 ? '  (click a loaded card to switch the active model)' : '  (load the other version to compare)');
  VERSIONS.forEach((v) => {
    CARDS[v].classList.toggle('loaded', !!models[v]);
    CARDS[v].classList.toggle('active', v === active);
  });
}
function setActive(version) {
  if (!models[version] || version === active) return;
  active = version;
  fillClassSelects(models[version].labels);
  showActiveModel();
  if (lastPreds[active]) renderResults(lastPreds[active], active);
  if (variants.length) renderVariants();
  if (camRunning) setCamStatus(`Webcam running with ${active}.`);
}
VERSIONS.forEach((v) => CARDS[v].addEventListener('click', (e) => {
  if (e.target.closest('input,button,label')) return;
  setActive(v);
}));

/* ---------- FR-02 / FR-08: image upload ---------- */
function handleImageSelection() {
  selectedImageReady = false; selectedFileName = '';
  if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
  resetResults();
  const file = el.imageInput.files && el.imageInput.files[0];
  const clear = () => { el.imageInput.value = ''; el.preview.hidden = true; el.previewHint.hidden = false; };
  if (!file) { clear(); setStatus('Choose an image.'); return; }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { clear(); setStatus('Unsupported file. Use JPEG, PNG, or WebP.', 'error'); return; }
  if (file.size > 8 * 1024 * 1024) { clear(); setStatus('Image must be 8 MB or less.', 'error'); return; }
  selectedFileName = file.name;
  currentObjectUrl = URL.createObjectURL(file);
  el.preview.onload = () => {
    selectedImageReady = true; el.preview.hidden = false; el.previewHint.hidden = true;
    updateButtons();
    setStatus(loaded().length ? 'Image ready. Click Classify image.' : 'Image ready. Load a model in step 1 to enable classifying.');
  };
  el.preview.onerror = () => { selectedImageReady = false; clear(); updateButtons(); setStatus('Could not read this image. It may be corrupted.', 'error'); };
  el.preview.src = currentObjectUrl;
}

/* ---------- FR-03/04/05/10: classification and display ---------- */
async function classifySelectedImage() {
  if (!loaded().length) { setStatus('Load a model before classifying.', 'error'); return; }
  if (!selectedImageReady) { setStatus('Choose an image and wait for the preview.', 'error'); return; }
  el.classifyBtn.disabled = true; setStatus('Classifying...');
  try {
    const next = {};
    for (const v of loaded()) next[v] = sortPreds(await models[v].model.predict(el.preview));
    lastPreds = next;
    renderResults(lastPreds[active], active);
    setStatus(`Classified with ${loaded().join(' and ')}.`, 'success');
  } catch (err) {
    setStatus(`Classification failed: ${err.message}`, 'error');
  } finally { updateButtons(); }
}
function renderResults(predictions, version) {
  const top = predictions[0];
  el.topClass.textContent = top.className; el.topClass.classList.remove('empty');
  el.topConfidence.textContent = `${pct(top.probability)}% confidence (${version})`;
  el.compare.textContent = Object.keys(lastPreds).length > 1
    ? VERSIONS.filter((v) => lastPreds[v]).map((v) => `${v}: ${lastPreds[v][0].className} ${pct(lastPreds[v][0].probability)}%`).join('  ·  ')
    : '';
  el.predictions.replaceChildren();
  predictions.forEach((p, i) => {
    const row = document.createElement('div'); row.className = 'prediction-row';
    const head = document.createElement('div'); head.className = 'prediction-head';
    const name = document.createElement('span'); name.textContent = p.className + (i === 0 ? ' (highest)' : '');
    if (i === 0) name.style.fontWeight = '700';
    const score = document.createElement('span'); score.textContent = `${pct(p.probability)}%`;
    head.append(name, score);
    const track = document.createElement('div'); track.className = 'track';
    const fill = document.createElement('div'); fill.className = 'fill'; fill.style.width = `${pct(p.probability)}%`;
    track.append(fill);
    if (i === 0) {
      fill.classList.add('top');
      const mark = document.createElement('span'); mark.className = 'mark';
      mark.style.left = `${el.threshold.value}%`; mark.title = 'Uncertainty threshold';
      track.append(mark);
    }
    row.append(head, track); el.predictions.append(row);
  });
  const reasons = uncertaintyReasons(predictions);
  el.warning.hidden = reasons.length === 0;
  if (reasons.length) el.warning.textContent = `Uncertain prediction: ${reasons.join(' and ')}. Treat this result with caution.`;
}
function uncertaintyReasons(preds) {
  const limit = Number(el.threshold.value);
  const margin = preds.length > 1 ? (preds[0].probability - preds[1].probability) * 100 : 100;
  const r = [];
  if (preds[0].probability * 100 < limit) r.push(`top score is below ${limit}%`);
  if (margin < 15) r.push(`top two classes are only ${margin.toFixed(1)} points apart`);
  return r;
}

/* ---------- Test log: one row per image, V1 and V2 side by side ---------- */
function upsert(image, condition, actual, resultsByVersion) {
  const key = `${image}|${actual}`;
  let e = log.find((x) => x.key === key);
  if (!e) { e = { key, image, condition, actual, V1: null, V2: null }; log.push(e); }
  e.condition = condition;
  VERSIONS.forEach((v) => {
    const top = resultsByVersion[v] && resultsByVersion[v][0];
    if (top) e[v] = { predicted: top.className, confidence: Number((top.probability * 100).toFixed(1)), correct: top.className === actual };
  });
  return e;
}
function recordResult() {
  if (!Object.keys(lastPreds).length) return;
  const actual = el.actualClass.value;
  if (!actual) { setStatus('Choose the actual class first.', 'error'); return; }
  if (!el.condition.value) { setStatus('Choose the test condition first.', 'error'); return; }
  const e = upsert(selectedFileName || '(unnamed)', el.condition.value, actual, lastPreds);
  lastKey = e.key; persistLog(); renderLog(); lastKey = null;
  const parts = VERSIONS.filter((v) => e[v]).map((v) => `${v} ${e[v].correct ? 'correct' : 'wrong'}`);
  setStatus(`Recorded ${e.image}: ${parts.join(', ')}.`, 'success');
}
function persistLog() { try { localStorage.setItem('ics106_log2', JSON.stringify(log)); } catch { /* storage unavailable */ } }
function change(e) {
  if (!e.V1 || !e.V2) return '—';
  if (!e.V1.correct && e.V2.correct) return 'Improved';
  if (e.V1.correct && !e.V2.correct) return 'Regressed';
  return e.V1.correct ? 'Same (correct)' : 'Same (wrong)';
}
function renderLog() {
  el.logBody.replaceChildren();
  log.forEach((e, idx) => {
    const tr = document.createElement('tr'); if (e.key === lastKey) tr.className = 'fresh';
    const main = document.createElement('td'); main.className = 'cell-main';
    const nm = document.createElement('strong'); nm.textContent = `T${String(idx + 1).padStart(2, '0')} · ${e.image}`;
    const cd = document.createElement('span'); cd.textContent = e.condition;
    main.append(nm, cd); tr.append(main);
    const act = document.createElement('td'); act.dataset.label = 'Actual'; act.textContent = e.actual; tr.append(act);
    VERSIONS.forEach((v) => {
      const td = document.createElement('td'); td.dataset.label = v;
      if (e[v]) { td.textContent = `${e[v].predicted} · ${e[v].confidence}%`; td.className = e[v].correct ? 'ok' : 'bad'; }
      else td.textContent = '—';
      tr.append(td);
    });
    const ch = document.createElement('td'); ch.dataset.label = 'Change'; ch.textContent = change(e);
    if (e.V1 && e.V2) ch.className = change(e) === 'Improved' ? 'ok' : change(e) === 'Regressed' ? 'bad' : '';
    tr.append(ch);
    const rm = document.createElement('td');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'icon-btn'; b.textContent = '✕';
    b.setAttribute('aria-label', `Remove ${e.image}`);
    b.addEventListener('click', () => { log = log.filter((x) => x !== e); persistLog(); renderLog(); });
    rm.append(b); tr.append(rm);
    el.logBody.append(tr);
  });
  if (!log.length) {
    const tr = document.createElement('tr'); const td = document.createElement('td');
    td.colSpan = 6; td.className = 'empty-row'; td.textContent = 'No results recorded yet.';
    tr.append(td); el.logBody.append(tr);
  }
  renderSummary();
}
function renderSummary() {
  el.summary.replaceChildren();
  if (!log.length) return;
  const count = document.createElement('p'); count.className = 'count';
  count.textContent = `Images logged: V1 ${log.filter((e) => e.V1).length} / 36 · V2 ${log.filter((e) => e.V2).length} / 36`;
  el.summary.append(count);
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  ['Condition', 'V1', 'V2'].forEach((h) => { const th = document.createElement('th'); th.textContent = h; head.append(th); });
  const body = table.createTBody();
  const cell = (cond, v) => {
    const rows = log.filter((e) => e[v] && (cond === null || e.condition === cond));
    return rows.length ? `${rows.filter((e) => e[v].correct).length} / ${rows.length}` : '—';
  };
  [...CONDITIONS, null].forEach((cond) => {
    const tr = body.insertRow();
    [cond === null ? 'Overall' : cond, cell(cond, 'V1'), cell(cond, 'V2')].forEach((v) => { tr.insertCell().textContent = v; });
  });
  el.summary.append(table);
}

/* ---------- CSV export (opens in Excel) ---------- */
function csvCell(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function downloadCsv(name, header, rows) {
  const csv = '\ufeff' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const yn = (r) => (r ? (r.correct ? 'Correct' : 'Wrong') : '');
function exportLog(which) {
  if (!log.length) { setStatus('Nothing to export yet.', 'error'); return; }
  const id = (i) => `T${String(i + 1).padStart(2, '0')}`;
  if (which === 'both') {
    downloadCsv('V1-V2-comparison.csv',
      ['Test_ID', 'Condition', 'Actual_Class', 'Image_Filename', 'V1_Predicted', 'V1_Confidence_%', 'V1_Result', 'V2_Predicted', 'V2_Confidence_%', 'V2_Result', 'Change'],
      log.map((e, i) => [id(i), e.condition, e.actual, e.image, e.V1?.predicted, e.V1?.confidence, yn(e.V1), e.V2?.predicted, e.V2?.confidence, yn(e.V2), change(e)]));
  } else {
    const rows = log.map((e, i) => [id(i), e]).filter(([, e]) => e[which]);
    if (!rows.length) { setStatus(`No ${which} results recorded yet.`, 'error'); return; }
    downloadCsv(`${which}-test-results.csv`,
      ['Test ID', 'Condition', 'Actual Class', 'Predicted Class', 'Confidence', 'Result', 'Image_Filename'],
      rows.map(([t, e]) => [t, e.condition, e.actual, e[which].predicted, `${e[which].confidence}%`, yn(e[which]), e.image]));
  }
}

/* ---------- Condition check: six generated versions of one image, run on every loaded model ---------- */
const VARIANTS = [
  { key: 'upright', label: 'Upright', how: 'Center-cropped to a square. No other change.' },
  { key: 'rot90', label: 'Rotated 90°', how: 'The square crop turned 90° clockwise.' },
  { key: 'rot180', label: 'Rotated 180°', how: 'The square crop turned upside down (180°).' },
  { key: 'dark', label: 'Low lighting', how: 'The square crop under a 62% black overlay to imitate dim light.' },
  { key: 'busy', label: 'Complex background', how: 'The image shrunk to 60% and placed on a colorful pattern. Simulated: the original background stays inside the frame.' },
  { key: 'far', label: 'Increased distance', how: 'The image shrunk to 35% and centered on a plain light background, as if farther from the camera.' }
];
const VSIZE = 448;
function squareBase() {
  const c = document.createElement('canvas'); c.width = c.height = VSIZE;
  const w = el.preview.naturalWidth, h = el.preview.naturalHeight, s = Math.min(w, h);
  c.getContext('2d').drawImage(el.preview, (w - s) / 2, (h - s) / 2, s, s, 0, 0, VSIZE, VSIZE);
  return c;
}
function drawPattern(x) {                       // seeded, so it is identical every run
  let a = 12345;
  const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  x.fillStyle = '#d9d4c7'; x.fillRect(0, 0, VSIZE, VSIZE);
  for (let i = 0; i < 140; i++) {
    x.fillStyle = `hsl(${Math.floor(rnd() * 360)} ${40 + rnd() * 40}% ${35 + rnd() * 40}%)`;
    const r = 10 + rnd() * 40; x.beginPath();
    if (rnd() < 0.5) x.arc(rnd() * VSIZE, rnd() * VSIZE, r, 0, 7); else x.rect(rnd() * VSIZE, rnd() * VSIZE, r * 1.6, r);
    x.fill();
  }
}
function makeVariant(key, base) {
  const c = document.createElement('canvas'); c.width = c.height = VSIZE;
  const x = c.getContext('2d');
  if (key === 'upright') x.drawImage(base, 0, 0);
  else if (key === 'rot90' || key === 'rot180') { x.translate(VSIZE / 2, VSIZE / 2); x.rotate(key === 'rot90' ? Math.PI / 2 : Math.PI); x.drawImage(base, -VSIZE / 2, -VSIZE / 2); }
  else if (key === 'dark') { x.drawImage(base, 0, 0); x.fillStyle = 'rgba(0,0,0,.62)'; x.fillRect(0, 0, VSIZE, VSIZE); }
  else if (key === 'busy') { drawPattern(x); const s = VSIZE * 0.6; x.drawImage(base, (VSIZE - s) / 2, (VSIZE - s) / 2, s, s); }
  else if (key === 'far') { x.fillStyle = '#e9e9ee'; x.fillRect(0, 0, VSIZE, VSIZE); const s = VSIZE * 0.35; x.drawImage(base, (VSIZE - s) / 2, (VSIZE - s) / 2, s, s); }
  return c;
}
function clearVariants() {
  variants = [];
  el.variantGrid.replaceChildren();
  el.varSummary.textContent = ''; el.varStatus.textContent = '';
  updateButtons();
}
async function runVariants() {
  if (!loaded().length) { el.varStatus.textContent = 'Load a model first.'; return; }
  if (!selectedImageReady) { el.varStatus.textContent = 'Choose an image first.'; return; }
  el.varBtn.disabled = true; el.varStatus.textContent = `Generating and classifying six versions with ${loaded().join(' and ')}...`;
  try {
    const base = squareBase(); const out = [];
    for (const v of VARIANTS) {
      const canvas = makeVariant(v.key, base);
      const preds = {};
      for (const ver of loaded()) preds[ver] = sortPreds(await models[ver].model.predict(canvas));
      out.push({ ...v, canvas, preds });
    }
    variants = out; renderVariants();
    el.varStatus.textContent = `Done with ${loaded().join(' and ')}.`;
  } catch (err) {
    el.varStatus.textContent = `Could not classify the versions: ${err.message}`;
  } finally { updateButtons(); }
}
function renderVariants() {
  el.variantGrid.replaceChildren();
  const actual = el.varActual.value; const right = { V1: 0, V2: 0 };
  variants.forEach((v) => {
    const card = document.createElement('article'); card.className = 'vcard';
    v.canvas.className = 'vimg'; v.canvas.setAttribute('role', 'img'); v.canvas.setAttribute('aria-label', `${v.label} version of the test image`);
    const name = document.createElement('h3'); name.textContent = v.label;
    card.append(v.canvas, name);
    Object.keys(v.preds).forEach((ver) => {
      const top = v.preds[ver][0];
      const pred = document.createElement('p'); pred.className = 'vpred'; pred.textContent = `${ver}: ${top.className} · ${pct(top.probability)}%`;
      card.append(pred);
      if (actual) {
        const ok = top.className === actual; if (ok) right[ver]++;
        const r = document.createElement('span'); r.className = ok ? 'vres ok' : 'vres bad'; r.textContent = ok ? 'Correct' : 'Wrong';
        card.append(r);
      }
    });
    const d = document.createElement('div'); d.className = 'vd';
    const how = document.createElement('p'); how.className = 'fine'; how.textContent = v.how;
    d.append(how);
    Object.keys(v.preds).forEach((ver) => {
      const h = document.createElement('p'); h.className = 'fine'; h.textContent = `${ver} scores`; h.style.fontWeight = '600';
      const list = document.createElement('ul'); list.className = 'vscores';
      v.preds[ver].forEach((p) => { const li = document.createElement('li'); li.textContent = `${p.className}: ${pct(p.probability)}%`; list.append(li); });
      d.append(h, list);
    });
    const dl = document.createElement('button'); dl.type = 'button'; dl.className = 'secondary small'; dl.textContent = 'Download image';
    dl.addEventListener('click', () => downloadVariant(v));
    d.append(dl); card.append(d); el.variantGrid.append(card);
  });
  const vers = variants.length ? Object.keys(variants[0].preds) : [];
  el.varSummary.textContent = !variants.length ? '' : actual
    ? vers.map((ver) => `${ver}: ${right[ver]} / ${variants.length}`).join(' · ') + ` correct for “${actual}”`
    : 'Choose the actual class to see which versions are correct.';
  updateButtons();
}
function downloadVariant(v) {
  const base = (selectedFileName || 'image').replace(/\.[^.]+$/, '');
  v.canvas.toBlob((blob) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${base}_${v.key}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
function addVariantsToLog() {
  const actual = el.varActual.value; if (!variants.length || !actual) return;
  const base = (selectedFileName || 'image').replace(/\.[^.]+$/, '');
  variants.forEach((v) => upsert(`${base} [${v.key}]`, v.label, actual, v.preds));
  persistLog(); renderLog();
  el.varStatus.textContent = `Added ${variants.length} results (${Object.keys(variants[0].preds).join(' and ')}) to the test log.`;
}

/* ---------- FR-09: webcam recognition (uses the active model) ---------- */
let camStream = null, camRunning = false, camBusy = false;
function setCamStatus(msg, kind = '') { el.camStatus.textContent = msg; el.camStatus.className = 'fine ' + kind; }
async function startCam() {
  if (!active) { setCamStatus('Load a model first.', 'error'); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setCamStatus('Webcam is not available here. Open the page over https or localhost.', 'error'); return; }
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    el.cam.srcObject = camStream; await el.cam.play();
    camRunning = true; el.camBtn.textContent = 'Stop webcam';
    setCamStatus(`Webcam running with ${active}.`, 'success');
    camLoop();
  } catch (err) {
    stopCam();
    setCamStatus(`Could not access the webcam: ${err.name === 'NotAllowedError' ? 'permission was denied' : err.message}`, 'error');
  }
}
function stopCam() {
  camRunning = false;
  if (camStream) camStream.getTracks().forEach((t) => t.stop());
  camStream = null; el.cam.srcObject = null; el.camBtn.textContent = 'Start webcam';
}
async function camLoop() {
  if (!camRunning) return;
  if (!camBusy && models[active] && el.cam.readyState >= 2) {
    camBusy = true;
    try {
      const preds = sortPreds(await models[active].model.predict(el.cam, true));   // true = mirrored, like Teachable Machine's webcam
      el.camTop.textContent = `${preds[0].className} · ${pct(preds[0].probability)}% (${active})`;
      el.camScores.textContent = preds.map((p) => `${p.className} ${pct(p.probability)}%`).join('  ·  ');
      const reasons = uncertaintyReasons(preds);
      el.camWarning.hidden = !reasons.length;
      if (reasons.length) el.camWarning.textContent = `Uncertain prediction: ${reasons.join(' and ')}.`;
    } catch (err) { setCamStatus(`Webcam classification failed: ${err.message}`, 'error'); }
    camBusy = false;
  }
  setTimeout(camLoop, 200);
}
el.camBtn.addEventListener('click', () => (camRunning ? (stopCam(), setCamStatus('Webcam stopped.')) : startCam()));

/* ---------- events and startup ---------- */
el.loadV1.addEventListener('click', () => loadModelFor('V1'));
el.loadV2.addEventListener('click', () => loadModelFor('V2'));
el.imageInput.addEventListener('change', handleImageSelection);
el.classifyBtn.addEventListener('click', classifySelectedImage);
el.recordBtn.addEventListener('click', recordResult);
el.exportBtn.addEventListener('click', () => exportLog('both'));
el.exportV1Btn.addEventListener('click', () => exportLog('V1'));
el.exportV2Btn.addEventListener('click', () => exportLog('V2'));
el.clearBtn.addEventListener('click', () => {
  if (log.length && !confirm('Clear all recorded results?')) return;
  log = []; persistLog(); renderLog();
});
el.threshold.addEventListener('input', () => {
  el.thresholdOut.textContent = el.threshold.value;
  if (lastPreds[active]) renderResults(lastPreds[active], active);   // keep warning and marker in sync
});
el.varBtn.addEventListener('click', runVariants);
el.varLogBtn.addEventListener('click', addVariantsToLog);
el.varActual.addEventListener('change', () => { if (variants.length) renderVariants(); else updateButtons(); });
el.seeMoreBtn.addEventListener('click', () => {
  const open = el.variantGrid.classList.toggle('expanded');
  el.seeMoreBtn.textContent = open ? 'See less' : 'See more';
  el.seeMoreBtn.setAttribute('aria-expanded', String(open));
});
window.addEventListener('beforeunload', stopCam);

try {
  el.urlV1.value = localStorage.getItem('ics106_url_V1') || '';
  el.urlV2.value = localStorage.getItem('ics106_url_V2') || '';
  log = JSON.parse(localStorage.getItem('ics106_log2') || '[]');
} catch { log = []; }
el.actualClass.append(new Option('Load a model first', ''));
el.varActual.append(new Option('Load a model first', ''));
resetResults();
renderLog();

/* ---------- Custom dropdowns (progressive enhancement of native selects) ---------- */
function enhanceSelect(sel) {
  const wrap = document.createElement('div'); wrap.className = 'dd';
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'dd-btn';
  btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
  const text = document.createElement('span');
  btn.append(text);
  btn.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>');
  const menu = document.createElement('ul'); menu.className = 'dd-menu'; menu.setAttribute('role', 'listbox'); menu.hidden = true;
  const lab = sel.closest('.field') && sel.closest('.field').querySelector('.lbl');
  if (lab) { lab.id = sel.id + 'Label'; btn.setAttribute('aria-labelledby', lab.id); }
  menu.addEventListener('mousedown', (e) => e.preventDefault());
  sel.before(wrap); wrap.append(btn, menu, sel); sel.classList.add('native-hidden');
  let focusIdx = 0;
  const render = () => {
    menu.replaceChildren();
    [...sel.options].forEach((o, i) => {
      const li = document.createElement('li'); li.setAttribute('role', 'option');
      li.textContent = o.text; li.setAttribute('aria-selected', String(i === sel.selectedIndex));
      li.addEventListener('mousedown', (e) => { e.preventDefault(); choose(i); });
      menu.append(li);
    });
    text.textContent = sel.options[sel.selectedIndex]?.text || '';
    btn.disabled = sel.disabled;
  };
  const setFocus = (i) => {
    focusIdx = Math.max(0, Math.min(sel.options.length - 1, i));
    [...menu.children].forEach((li, k) => li.classList.toggle('focus', k === focusIdx));
    menu.children[focusIdx]?.scrollIntoView({ block: 'nearest' });
  };
  const open = () => { if (btn.disabled) return; menu.hidden = false; wrap.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); setFocus(sel.selectedIndex); };
  const close = () => { menu.hidden = true; wrap.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
  const choose = (i) => { sel.selectedIndex = i; sel.dispatchEvent(new Event('change', { bubbles: true })); render(); close(); btn.focus(); };
  btn.addEventListener('click', () => (menu.hidden ? open() : close()));
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (menu.hidden) open(); else setFocus(focusIdx + (e.key === 'ArrowDown' ? 1 : -1)); }
    else if ((e.key === 'Enter' || e.key === ' ') && !menu.hidden) { e.preventDefault(); choose(focusIdx); }
    else if (e.key === 'Escape') close();
  });
  document.addEventListener('mousedown', (e) => { if (!wrap.contains(e.target)) close(); });
  btn.addEventListener('blur', close);
  new MutationObserver(render).observe(sel, { childList: true, attributes: true, attributeFilter: ['disabled'] });
  render();
}
[el.actualClass, el.condition, el.varActual].forEach(enhanceSelect);

/* Drag-over feedback on the upload area */
const dropzone = document.querySelector('.dropzone');
['dragenter', 'dragover'].forEach((t) => dropzone.addEventListener(t, () => dropzone.classList.add('drag')));
['dragleave', 'drop'].forEach((t) => dropzone.addEventListener(t, () => dropzone.classList.remove('drag')));