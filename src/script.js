'use strict';
/* ICS106 LAB 02 — Smart Object Recognition
 * Loads Teachable Machine models (V1/V2), classifies uploaded images,
 * shows all class scores, warns on low confidence, and logs test results.
 */
const $ = (id) => document.getElementById(id);
const el = {
  urlV1: $('urlV1'), urlV2: $('urlV2'), loadV1: $('loadV1'), loadV2: $('loadV2'),
  modelInfo: $('modelInfo'), activeModel: $('activeModel'), headerTag: $('headerTag'),
  imageInput: $('imageInput'), preview: $('preview'), previewHint: $('previewHint'),
  classifyBtn: $('classifyBtn'), status: $('status'),
  topClass: $('topClass'), topConfidence: $('topConfidence'), predictions: $('predictions'),
  warning: $('warning'), threshold: $('threshold'), thresholdOut: $('thresholdOut'),
  actualClass: $('actualClass'), condition: $('condition'), recordBtn: $('recordBtn'),
  logBody: $('logBody'), summary: $('summary'), exportBtn: $('exportBtn'), clearBtn: $('clearBtn'),
  varActual: $('varActual'), varBtn: $('varBtn'), varLogBtn: $('varLogBtn'), seeMoreBtn: $('seeMoreBtn'),
  varStatus: $('varStatus'), varSummary: $('varSummary'), variantGrid: $('variantGrid')
};
const CARDS = { V1: el.urlV1.closest('.model-card'), V2: el.urlV2.closest('.model-card') };
const CONDITIONS = ['Upright', 'Rotated 90°', 'Rotated 180°', 'Low lighting', 'Complex background', 'Increased distance'];

let model = null;
let selectedImageReady = false;
let currentObjectUrl = null;
let loadedVersion = null;
let loadedUrl = null;
let selectedFileName = '';
let lastResult = null;          // { version, predicted, confidence }
let log = [];                   // test log entries
let lastRecorded = null;        // highlights the newest row
let variants = [];              // generated condition versions + predictions

/* ---------- helpers ---------- */
function setStatus(message, kind = '') {
  el.status.textContent = message;
  el.status.className = kind;
}
function updateButtons() {
  el.classifyBtn.disabled = !model || !selectedImageReady;
  el.recordBtn.disabled = !lastResult || el.actualClass.disabled;
  el.varBtn.disabled = !model || !selectedImageReady;
  el.varLogBtn.disabled = !variants.length || el.varActual.disabled || !el.varActual.value;
  el.seeMoreBtn.disabled = !variants.length;
}
function resetResults(message = 'No prediction for this image and model yet.') {
  clearVariants();
  el.topClass.textContent = 'No result yet';
  el.topClass.classList.add('empty');
  el.topConfidence.textContent = model ? 'Choose an image and click Classify image.' : 'Load a model, then classify an image.';
  el.warning.hidden = true;
  lastResult = null;
  el.predictions.replaceChildren();
  const p = document.createElement('p');
  p.className = 'fine'; p.textContent = message;
  el.predictions.append(p);
}
function pct(p) { return (p * 100).toFixed(1); }

/* ---------- FR-01 / FR-06 / FR-07 / FR-08: model loading ---------- */
function normalizeModelUrl(raw) {
  if (!raw || !raw.trim()) throw new Error('Enter a model URL first.');
  let url;
  try { url = new URL(raw.trim()); } catch { throw new Error('That is not a valid URL.'); }
  if (url.protocol !== 'https:') throw new Error('Use an HTTPS model URL.');
  if (url.hostname !== 'teachablemachine.withgoogle.com') throw new Error('Use a published Teachable Machine model URL.');
  if (!/^\/models\/[^/]+\/?$/.test(url.pathname)) throw new Error('Expected a URL ending in /models/MODEL_ID/');
  if (url.search || url.hash) throw new Error('Remove query parameters and # fragments.');
  return url.origin + url.pathname.replace(/\/?$/, '/');
}

async function loadModelFor(version) {
  const input = version === 'V1' ? el.urlV1 : el.urlV2;
  el.loadV1.disabled = el.loadV2.disabled = true;
  el.classifyBtn.disabled = true;
  setStatus(`Loading ${version}...`);
  try {
    if (typeof tmImage === 'undefined') throw new Error('Teachable Machine library unavailable. Check internet access.');
    const url = normalizeModelUrl(input.value);
    const next = await tmImage.load(url + 'model.json', url + 'metadata.json');
    // Only replace the active model once the new one loaded successfully.
    model = next; loadedUrl = url; loadedVersion = version;
    localStorage.setItem('ics106_url_' + version, url);
    const labels = model.getClassLabels();
    el.actualClass.replaceChildren(...labels.map((l) => new Option(l, l)));
    el.actualClass.disabled = false;
    el.varActual.replaceChildren(...labels.map((l) => new Option(l, l)));
    el.varActual.disabled = false;
    showActiveModel();
    resetResults();
    setStatus(`${version} loaded successfully.${selectedImageReady ? ' Click Classify image.' : ''}`, 'success');
  } catch (err) {
    const keep = model ? ` ${loadedVersion} is still active.` : '';
    setStatus(`${version} failed to load: ${friendlyLoadError(err)}${keep}`, 'error');
  } finally {
    el.loadV1.disabled = el.loadV2.disabled = false;
    updateButtons();
  }
}
function friendlyLoadError(err) {
  const m = err.message || String(err);
  if (/fetch|network|Failed to|404|load/i.test(m) && !/Enter|valid URL|HTTPS|Expected|Use a|Remove/.test(m)) {
    return 'could not download model files. Check the URL is published and you are online.';
  }
  return m;
}
function showActiveModel() {
  const label = `${loadedVersion} (${model.getTotalClasses()} classes)`;
  el.activeModel.textContent = label;
  el.headerTag.textContent = `Active: ${loadedVersion}`; el.headerTag.classList.add('live');
  el.modelInfo.textContent = `Active: ${label} — ${loadedUrl}`;
  Object.entries(CARDS).forEach(([v, c]) => c.classList.toggle('active', v === loadedVersion));
}

/* ---------- FR-02: image upload ---------- */
function handleImageSelection() {
  selectedImageReady = false; selectedFileName = '';
  updateButtons(); resetResults();
  if (currentObjectUrl) { URL.revokeObjectURL(currentObjectUrl); currentObjectUrl = null; }
  const file = el.imageInput.files && el.imageInput.files[0];
  if (!file) { el.preview.hidden = true; el.previewHint.hidden = false; setStatus('Choose an image.'); return; }
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    el.imageInput.value = ''; el.preview.hidden = true; el.previewHint.hidden = false;
    setStatus('Unsupported file. Use JPEG, PNG, or WebP.', 'error'); return;
  }
  if (file.size > 8 * 1024 * 1024) {
    el.imageInput.value = ''; setStatus('Image must be 8 MB or less.', 'error'); return;
  }
  selectedFileName = file.name;
  currentObjectUrl = URL.createObjectURL(file);
  el.preview.onload = () => {
    selectedImageReady = true; el.preview.hidden = false; el.previewHint.hidden = true;
    updateButtons();
    setStatus(model ? 'Image ready. Click Classify image.' : 'Image ready. Load a model in step 1 to enable classifying.');
  };
  el.preview.onerror = () => { selectedImageReady = false; updateButtons(); setStatus('Could not read this image.', 'error'); };
  el.preview.src = currentObjectUrl;
}

/* ---------- FR-03/04/05/10: classification and display ---------- */
async function classifySelectedImage() {
  if (!model) { setStatus('Load a model before classifying.', 'error'); return; }
  if (!selectedImageReady) { setStatus('Choose an image and wait for the preview.', 'error'); return; }
  el.classifyBtn.disabled = true;
  setStatus('Classifying...');
  try {
    const raw = await model.predict(el.preview);
    const predictions = [...raw].sort((a, b) => b.probability - a.probability);
    renderResults(predictions);
    setStatus(`Classified with ${loadedVersion}.`, 'success');
  } catch (err) {
    setStatus(`Classification failed: ${err.message}`, 'error');
  } finally {
    updateButtons();
  }
}

function renderResults(predictions) {
  const top = predictions[0];
  el.topClass.textContent = top.className;
  el.topClass.classList.remove('empty');
  el.topConfidence.textContent = `${pct(top.probability)}% confidence`;
  lastResult = { version: loadedVersion, predicted: top.className, confidence: top.probability * 100 };

  el.predictions.replaceChildren();
  predictions.forEach((p, i) => {
    const row = document.createElement('div'); row.className = 'prediction-row';
    const head = document.createElement('div'); head.className = 'prediction-head';
    const name = document.createElement('span'); name.textContent = p.className + (i === 0 ? ' (highest)' : '');
    if (i === 0) name.style.fontWeight = '700';
    const score = document.createElement('span'); score.textContent = `${pct(p.probability)}%`;
    head.append(name, score);
    const track = document.createElement('div'); track.className = 'track';
    const fill = document.createElement('div'); fill.className = 'fill';
    fill.style.width = `${(p.probability * 100).toFixed(1)}%`;
    if (i === 0) {
      fill.classList.add('top');
      const mark = document.createElement('span'); mark.className = 'mark';
      mark.style.left = `${el.threshold.value}%`; mark.title = 'Uncertainty threshold';
      track.append(fill, mark);
    } else track.append(fill);
    row.append(head, track);
    el.predictions.append(row);
  });

  // FR-10: uncertainty warning (low top score OR top two classes too close)
  const limit = Number(el.threshold.value);
  const margin = predictions.length > 1 ? (predictions[0].probability - predictions[1].probability) * 100 : 100;
  const reasons = [];
  if (top.probability * 100 < limit) reasons.push(`top score is below ${limit}%`);
  if (margin < 15) reasons.push(`top two classes are only ${margin.toFixed(1)} points apart`);
  el.warning.hidden = reasons.length === 0;
  if (reasons.length) el.warning.textContent = `Uncertain prediction: ${reasons.join(' and ')}. Treat this result with caution.`;
}

/* ---------- Test log ---------- */
function recordResult() {
  if (!lastResult) return;
  const actual = el.actualClass.value;
  const entry = {
    image: selectedFileName || '(unnamed)',
    condition: el.condition.value,
    version: lastResult.version,
    actual,
    predicted: lastResult.predicted,
    confidence: Number(lastResult.confidence.toFixed(1)),
    correct: lastResult.predicted === actual
  };
  log = log.filter((e) => !(e.image === entry.image && e.version === entry.version));
  log.push(entry);
  lastRecorded = entry; persistLog(); renderLog(); lastRecorded = null;
  setStatus(`Recorded ${entry.image} (${entry.version}): ${entry.correct ? 'correct' : 'incorrect'}.`, 'success');
}
function persistLog() { try { localStorage.setItem('ics106_log', JSON.stringify(log)); } catch { /* storage unavailable */ } }

function renderLog() {
  el.logBody.replaceChildren();
  log.forEach((e) => {
    const tr = document.createElement('tr');
    if (e === lastRecorded) tr.className = 'fresh';
    [e.image, e.condition, e.version, e.actual, e.predicted, `${e.confidence}%`].forEach((v) => {
      const td = document.createElement('td'); td.textContent = v; tr.append(td);
    });
    const r = document.createElement('td'); r.textContent = e.correct ? 'Correct' : 'Wrong';
    r.className = e.correct ? 'ok' : 'bad'; tr.append(r);
    el.logBody.append(tr);
  });
  if (!log.length) {
    const tr = document.createElement('tr'); const td = document.createElement('td');
    td.colSpan = 7; td.className = 'empty-row'; td.textContent = 'No results recorded yet.';
    tr.append(td); el.logBody.append(tr);
  }
  renderSummary();
}

function renderSummary() {
  el.summary.replaceChildren();
  if (!log.length) return;
  const done = (v) => new Set(log.filter((e) => e.version === v).map((e) => e.image)).size;
  const count = document.createElement('p'); count.className = 'count';
  count.textContent = `Images logged: V1 ${done('V1')} / 36 · V2 ${done('V2')} / 36`;
  el.summary.append(count);
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  ['Condition', 'V1 correct', 'V2 correct'].forEach((h) => { const th = document.createElement('th'); th.textContent = h; head.append(th); });
  const body = table.createTBody();
  const cell = (cond, v) => {
    const rows = log.filter((e) => e.version === v && (cond === null || e.condition === cond));
    return rows.length ? `${rows.filter((e) => e.correct).length} / ${rows.length}` : '—';
  };
  [...CONDITIONS, null].forEach((cond) => {
    const tr = body.insertRow();
    [cond === null ? 'Overall' : cond, cell(cond, 'V1'), cell(cond, 'V2')].forEach((v) => { tr.insertCell().textContent = v; });
  });
  el.summary.append(table);
}

function csvCell(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
function exportCsv() {
  if (!log.length) { setStatus('Nothing to export yet.', 'error'); return; }
  const images = [...new Set(log.map((e) => e.image))];
  const header = ['Test_ID', 'Condition', 'Actual_Class', 'Image_Filename', 'V1_Predicted_Class', 'V1_Confidence_Percent',
    'V1_Correct_YN', 'V2_Predicted_Class', 'V2_Confidence_Percent', 'V2_Correct_YN'];
  const rows = images.map((img, i) => {
    const v1 = log.find((e) => e.image === img && e.version === 'V1');
    const v2 = log.find((e) => e.image === img && e.version === 'V2');
    const base = v1 || v2;
    return [`T${String(i + 1).padStart(2, '0')}`, base.condition, base.actual, img,
      v1?.predicted, v1?.confidence, v1 ? (v1.correct ? 'Y' : 'N') : '',
      v2?.predicted, v2?.confidence, v2 ? (v2.correct ? 'Y' : 'N') : ''];
  });
  const csv = '\ufeff' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'test-results.csv'; a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- events and startup ---------- */
el.loadV1.addEventListener('click', () => loadModelFor('V1'));
el.loadV2.addEventListener('click', () => loadModelFor('V2'));
el.imageInput.addEventListener('change', handleImageSelection);
el.classifyBtn.addEventListener('click', classifySelectedImage);
el.recordBtn.addEventListener('click', recordResult);
el.exportBtn.addEventListener('click', exportCsv);
el.clearBtn.addEventListener('click', () => {
  if (log.length && !confirm('Clear all recorded results?')) return;
  log = []; persistLog(); renderLog();
});
el.threshold.addEventListener('input', () => { el.thresholdOut.textContent = el.threshold.value; });

try {
  el.urlV1.value = localStorage.getItem('ics106_url_V1') || '';
  el.urlV2.value = localStorage.getItem('ics106_url_V2') || '';
  log = JSON.parse(localStorage.getItem('ics106_log') || '[]');
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
  menu.addEventListener('mousedown', (e) => e.preventDefault()); // keep focus on the button
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


/* ---------- Condition check: six generated versions of one image ---------- */
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
  if (!model) { el.varStatus.textContent = 'Load a model first.'; return; }
  if (!selectedImageReady) { el.varStatus.textContent = 'Choose an image first.'; return; }
  el.varBtn.disabled = true; el.varStatus.textContent = 'Generating and classifying six versions...';
  try {
    const base = squareBase(); const out = [];
    for (const v of VARIANTS) {
      const canvas = makeVariant(v.key, base);
      const preds = [...(await model.predict(canvas))].sort((a, b) => b.probability - a.probability);
      out.push({ ...v, canvas, preds, version: loadedVersion });
    }
    variants = out; renderVariants();
    el.varStatus.textContent = `Done with ${loadedVersion}.`;
  } catch (err) {
    el.varStatus.textContent = `Could not classify the versions: ${err.message}`;
  } finally { updateButtons(); }
}
function renderVariants() {
  el.variantGrid.replaceChildren();
  const actual = el.varActual.value; let right = 0;
  variants.forEach((v) => {
    const top = v.preds[0];
    const card = document.createElement('article'); card.className = 'vcard';
    v.canvas.className = 'vimg'; v.canvas.setAttribute('role', 'img'); v.canvas.setAttribute('aria-label', `${v.label} version of the test image`);
    const name = document.createElement('h3'); name.textContent = v.label;
    const pred = document.createElement('p'); pred.className = 'vpred'; pred.textContent = `${top.className} · ${pct(top.probability)}%`;
    card.append(v.canvas, name, pred);
    if (actual) {
      const ok = top.className === actual; if (ok) right++;
      const r = document.createElement('span'); r.className = ok ? 'vres ok' : 'vres bad'; r.textContent = ok ? 'Correct' : 'Wrong';
      card.append(r);
    }
    const d = document.createElement('div'); d.className = 'vd';
    const how = document.createElement('p'); how.className = 'fine'; how.textContent = v.how;
    const list = document.createElement('ul'); list.className = 'vscores';
    v.preds.forEach((p) => { const li = document.createElement('li'); li.textContent = `${p.className}: ${pct(p.probability)}%`; list.append(li); });
    const dl = document.createElement('button'); dl.type = 'button'; dl.className = 'secondary small'; dl.textContent = 'Download image';
    dl.addEventListener('click', () => downloadVariant(v));
    d.append(how, list, dl); card.append(d); el.variantGrid.append(card);
  });
  el.varSummary.textContent = !variants.length ? '' : actual
    ? `${variants[0].version}: ${right} / ${variants.length} correct for “${actual}”`
    : `${variants[0].version}: choose the actual class to see which versions are correct.`;
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
  variants.forEach((v) => {
    const top = v.preds[0];
    const entry = { image: `${base} [${v.key}]`, condition: v.label, version: v.version, actual,
      predicted: top.className, confidence: Number((top.probability * 100).toFixed(1)), correct: top.className === actual };
    log = log.filter((e) => !(e.image === entry.image && e.version === entry.version));
    log.push(entry);
  });
  persistLog(); renderLog();
  el.varStatus.textContent = `Added ${variants.length} results to the test log.`;
}
el.varBtn.addEventListener('click', runVariants);
el.varLogBtn.addEventListener('click', addVariantsToLog);
el.varActual.addEventListener('change', () => { if (variants.length) renderVariants(); else updateButtons(); });
el.seeMoreBtn.addEventListener('click', () => {
  const open = el.variantGrid.classList.toggle('expanded');
  el.seeMoreBtn.textContent = open ? 'See less' : 'See more';
  el.seeMoreBtn.setAttribute('aria-expanded', String(open));
});