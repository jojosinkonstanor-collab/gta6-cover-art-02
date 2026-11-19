// Vice City Cover Lab editor: wires the controls to the cover engine, reads
// photos from the user's machine (never uploaded), and exports the cover as a
// PNG. Every state change is pushed onto an undo stack (Ctrl+Z / Ctrl+Y).
// A `?shot=` query sets up a fixed scene for screenshots instead: ?shot=cover
// draws the cover alone, ?shot=editor shows the editor with photos loaded.

import { renderCover, panelRects, LAYOUTS, GRADES, LETTERING } from './cover.js';

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const pctx = preview.getContext('2d');
const query = new URLSearchParams(location.search);

const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

/** The cover state: layout, grade, lettering, words, and one slot per panel. */
const state = {
  layout: 'hero',
  grade: 'sunset',
  lettering: 'white',
  title: 'Vice City',
  subtitle: 'Sunset heist nights',
  badge: 'EST. 2026',
  panels: [],
};

const photos = []; // { img, name, url }
let selectedPhoto = 0;
let selectedPanel = 0;
let dirty = true;
let fullFrame = false; // ?shot=cover renders the canvas at full post size, no preview scale

/** Undo history: snapshots of the state, newest last. */
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 50;

function snapshot() {
  return JSON.parse(JSON.stringify(state));
}

function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
  syncHistoryButtons();
}

function restore(snap) {
  const keep = state.panels;
  void keep;
  Object.assign(state, JSON.parse(JSON.stringify(snap)));
  syncInputsFromState();
  requestDraw();
}

function syncHistoryButtons() {
  $('undoBtn').disabled = undoStack.length === 0;
  $('redoBtn').disabled = redoStack.length === 0;
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  syncHistoryButtons();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  syncHistoryButtons();
}

function panelCount() {
  return (LAYOUTS[state.layout] ?? LAYOUTS.hero).panels.length;
}

function resetPanels() {
  state.panels = Array.from({ length: panelCount() }, (_, i) => ({
    photo: photos.length ? (i % photos.length) : null,
    zoom: 1.15,
    ox: 0,
    oy: 0,
  }));
  selectedPanel = 0;
}

function currentSize() {
  return SIZES[$('sizeSelect').value] ?? SIZES['1920x1080'];
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load ' + url));
    img.src = url;
  });
}

async function addPhotoFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    pushHistory();
    photos.push({ img, name: file.name, url });
    selectedPhoto = photos.length - 1;
    if (!state.panels.length || state.panels.every((p) => p.photo == null)) resetPanels();
    renderThumbs();
    requestDraw();
  } catch (err) {
    $('status').textContent = 'That file could not be read as a photo.';
  }
}

async function loadSamplePhotos() {
  for (const name of ['boulevard', 'pier']) {
    if (photos.some((p) => p.name === name + '.jpg')) continue;
    try {
      const img = await loadImage('samples/' + name + '.jpg');
      photos.push({ img, name: name + '.jpg', url: 'samples/' + name + '.jpg' });
    } catch (err) { /* sample missing: keep going with what loaded */ }
  }
  if (photos.length && state.panels.every((p) => p.photo == null)) resetPanels();
  selectedPhoto = 0;
  renderThumbs();
  requestDraw();
}

function renderThumbs() {
  const box = $('thumbs');
  box.textContent = '';
  photos.forEach((p, i) => {
    const thumb = document.createElement('img');
    thumb.src = p.url;
    thumb.alt = p.name;
    thumb.title = p.name + ' — click, then click a panel to place it';
    thumb.setAttribute('aria-pressed', String(i === selectedPhoto));
    thumb.addEventListener('click', () => {
      selectedPhoto = i;
      renderThumbs();
      $('panelHint').textContent = 'Photo "' + p.name + '" picked — click a panel to place it here.';
    });
    box.appendChild(thumb);
  });
}

function buildChoices(boxId, entries, current, onPick) {
  const box = $(boxId);
  box.textContent = '';
  for (const [id, def] of Object.entries(entries)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = def.label;
    btn.setAttribute('aria-pressed', String(id === current));
    btn.addEventListener('click', () => {
      pushHistory();
      onPick(id);
      [...box.children].forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    });
    box.appendChild(btn);
  }
}

function syncInputsFromState() {
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('badgeInput').value = state.badge;
  const panel = state.panels[selectedPanel];
  $('zoomInput').value = String(panel ? panel.zoom : 1.15);
  for (const [boxId, entries] of [['layoutChoices', LAYOUTS], ['gradeChoices', GRADES], ['letteringChoices', LETTERING]]) {
    const box = $(boxId);
    const current = { layoutChoices: state.layout, gradeChoices: state.grade, letteringChoices: state.lettering }[boxId];
    [...box.children].forEach((b, i) => b.setAttribute('aria-pressed', String(Object.keys(entries)[i] === current)));
  }
}

function drawPreview() {
  const [w, h] = currentSize();
  if (fullFrame) {
    renderCover(pctx, preview.width, preview.height, state, photos.map((p) => p.img), { highlight: selectedPanel });
    dirty = false;
    return;
  }
  const scale = Math.min(1, 960 / w, 540 / h);
  const cw = Math.round(w * scale), ch = Math.round(h * scale);
  if (preview.width !== cw || preview.height !== ch) {
    preview.width = cw;
    preview.height = ch;
  }
  renderCover(pctx, cw, ch, state, photos.map((p) => p.img), { highlight: selectedPanel });
  dirty = false;
}

function requestDraw() {
  if (dirty) return;
  dirty = true;
  requestAnimationFrame(drawPreview);
}

/** Preview canvas point -> cover pixel, for panel hit-testing. */
function previewPoint(evt) {
  const r = preview.getBoundingClientRect();
  return {
    x: ((evt.clientX - r.left) / r.width) * preview.width,
    y: ((evt.clientY - r.top) / r.height) * preview.height,
  };
}

function hitPanel(pt) {
  const rects = panelRects(state.layout, preview.width, preview.height);
  for (let i = rects.length - 1; i >= 0; i -= 1) {
    const r = rects[i];
    if (pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h) return i;
  }
  return -1;
}

function bindPreview() {
  let drag = null;
  preview.addEventListener('pointerdown', (evt) => {
    const pt = previewPoint(evt);
    const hit = hitPanel(pt);
    if (hit < 0) return;
    selectedPanel = hit;
    // Clicking with a photo picked places that photo in the panel.
    const panel = state.panels[hit];
    if (panel && photos[selectedPhoto] && panel.photo !== selectedPhoto) {
      pushHistory();
      panel.photo = selectedPhoto;
      $('panelHint').textContent = 'Panel ' + (hit + 1) + ' now shows "' + photos[selectedPhoto].name + '".';
    }
    $('zoomInput').value = String(panel ? panel.zoom : 1.15);
    drag = { panel: hit, x: pt.x, y: pt.y, moved: false };
    preview.setPointerCapture(evt.pointerId);
    requestDraw();
  });
  preview.addEventListener('pointermove', (evt) => {
    if (!drag) return;
    const pt = previewPoint(evt);
    const panel = state.panels[drag.panel];
    if (!panel || panel.photo == null) return;
    if (!drag.moved) pushHistory();
    const rects = panelRects(state.layout, preview.width, preview.height);
    const r = rects[drag.panel];
    panel.ox = Math.max(-0.45, Math.min(0.45, panel.ox + (pt.x - drag.x) / r.w));
    panel.oy = Math.max(-0.45, Math.min(0.45, panel.oy + (pt.y - drag.y) / r.h));
    drag.x = pt.x;
    drag.y = pt.y;
    drag.moved = true;
    requestDraw();
  });
  preview.addEventListener('pointerup', () => { drag = null; });
  preview.addEventListener('wheel', (evt) => {
    evt.preventDefault();
    const pt = previewPoint(evt);
    const hit = hitPanel(pt);
    if (hit < 0) return;
    const panel = state.panels[hit];
    if (!panel) return;
    selectedPanel = hit;
    panel.zoom = Math.max(1, Math.min(2.5, panel.zoom * (evt.deltaY < 0 ? 1.08 : 0.93)));
    $('zoomInput').value = String(panel.zoom);
    requestDraw();
  }, { passive: false });
}

function bindControls() {
  $('photoInput').addEventListener('change', async (evt) => {
    for (const file of evt.target.files) await addPhotoFile(file);
    evt.target.value = '';
  });

  const wrap = $('previewWrap');
  wrap.addEventListener('dragover', (evt) => {
    evt.preventDefault();
    wrap.classList.add('dragging');
  });
  wrap.addEventListener('dragleave', () => wrap.classList.remove('dragging'));
  wrap.addEventListener('drop', async (evt) => {
    evt.preventDefault();
    wrap.classList.remove('dragging');
    for (const file of evt.dataTransfer.files) {
      if (file.type.startsWith('image/')) await addPhotoFile(file);
    }
  });

  $('loadSamples').addEventListener('click', loadSamplePhotos);

  buildChoices('layoutChoices', LAYOUTS, state.layout, (id) => {
    const old = state.panels;
    state.layout = id;
    const next = Array.from({ length: panelCount() }, (_, i) => old[i] ?? { photo: null, zoom: 1.15, ox: 0, oy: 0 });
    state.panels = next;
    selectedPanel = 0;
    requestDraw();
  });
  buildChoices('gradeChoices', GRADES, state.grade, (id) => {
    state.grade = id;
    requestDraw();
  });
  buildChoices('letteringChoices', LETTERING, state.lettering, (id) => {
    state.lettering = id;
    requestDraw();
  });

  let captionTimer = null;
  const onCaption = () => {
    // One history entry per typing pause, not per keystroke.
    if (!captionTimer) pushHistory();
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => { captionTimer = null; }, 800);
    state.title = $('titleInput').value;
    state.subtitle = $('subtitleInput').value;
    state.badge = $('badgeInput').value;
    requestDraw();
  };
  $('titleInput').addEventListener('input', onCaption);
  $('subtitleInput').addEventListener('input', onCaption);
  $('badgeInput').addEventListener('input', onCaption);
  $('sizeSelect').addEventListener('change', requestDraw);
  $('zoomInput').addEventListener('input', (evt) => {
    const panel = state.panels[selectedPanel];
    if (!panel) return;
    panel.zoom = Number(evt.target.value);
    requestDraw();
  });
  $('fillAll').addEventListener('click', () => {
    if (!photos[selectedPhoto]) return;
    pushHistory();
    state.panels.forEach((p) => { p.photo = selectedPhoto; });
    requestDraw();
  });
  $('shuffleBtn').addEventListener('click', () => {
    if (!photos.length) return;
    pushHistory();
    // Rotate which photo each panel shows, and nudge the crops.
    state.panels.forEach((p, i) => {
      p.photo = (i + 1) % photos.length;
      p.ox = ((i * 37) % 21 - 10) / 100;
      p.oy = ((i * 53) % 17 - 8) / 100;
    });
    requestDraw();
  });
  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  document.addEventListener('keydown', (evt) => {
    if ((evt.ctrlKey || evt.metaKey) && !evt.shiftKey && evt.key.toLowerCase() === 'z') {
      evt.preventDefault();
      undo();
    } else if ((evt.ctrlKey || evt.metaKey) && (evt.key.toLowerCase() === 'y' || (evt.shiftKey && evt.key.toLowerCase() === 'z'))) {
      evt.preventDefault();
      redo();
    }
  });

  $('exportBtn').addEventListener('click', () => exportCover(currentSize()));
  $('exportAllBtn').addEventListener('click', exportAllSizes);
}

/** File-safe slug of the title, for the exported file name. */
function slugOf(text) {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'vice-city-cover';
}

/** Renders the cover at W x H and downloads it as a PNG. */
export function exportCover([w, h]) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  renderCover(canvas.getContext('2d'), w, h, state, photos.map((p) => p.img));
  canvas.toBlob((blob) => {
    if (!blob) {
      $('status').textContent = 'Export failed — try another photo.';
      return;
    }
    const name = slugOf(state.title) + '-' + w + 'x' + h + '.png';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    $('status').textContent = 'Saved ' + name;
  }, 'image/png');
}

/** Exports the cover at all three post sizes, one PNG each. */
export function exportAllSizes() {
  const names = Object.keys(SIZES);
  names.forEach((key, i) => {
    setTimeout(() => exportCover(SIZES[key]), i * 350);
  });
  $('status').textContent = 'Exporting all three sizes…';
}

/** Fixed scenes for screenshots. */
async function runShot() {
  const shot = query.get('shot');
  const size = query.get('size');
  if (size && SIZES[size]) $('sizeSelect').value = size;
  if (query.get('layout') && LAYOUTS[query.get('layout')]) state.layout = query.get('layout');
  if (query.get('grade') && GRADES[query.get('grade')]) state.grade = query.get('grade');
  if (query.get('lettering') && LETTERING[query.get('lettering')]) state.lettering = query.get('lettering');
  if (query.get('title') != null) { state.title = query.get('title'); $('titleInput').value = state.title; }
  if (query.get('subtitle') != null) { state.subtitle = query.get('subtitle'); $('subtitleInput').value = state.subtitle; }
  if (query.get('badge') != null) { state.badge = query.get('badge'); $('badgeInput').value = state.badge; }

  await loadSamplePhotos();
  resetPanels();
  // Spread the two samples across the panels, framing the faces: the sample
  // photos keep their subjects near the top of the frame, so wide panels get
  // a positive vertical offset to pull the faces into view.
  const crops = {
    hero: [
      { photo: 0, zoom: 1.05, ox: 0, oy: 0.19 },
      { photo: 1, zoom: 1.0, ox: 0, oy: 0.35 },
      { photo: 0, zoom: 1.0, ox: 0, oy: 0.45 },
    ],
    grid: [
      { photo: 0, zoom: 1.05, ox: 0, oy: 0.18 },
      { photo: 1, zoom: 1.0, ox: 0, oy: 0.05 },
      { photo: 0, zoom: 1.1, ox: 0, oy: 0.15 },
      { photo: 1, zoom: 1.0, ox: 0, oy: 0.08 },
    ],
    nine: [
      { photo: 0, zoom: 1.15, ox: 0, oy: 0.12 },
      { photo: 1, zoom: 1.05, ox: 0, oy: 0.05 },
      { photo: 0, zoom: 1.1, ox: 0, oy: 0.1 },
      { photo: 1, zoom: 1.1, ox: 0, oy: 0.08 },
      { photo: 0, zoom: 1.05, ox: 0, oy: 0.2 },
      { photo: 1, zoom: 1.05, ox: 0, oy: 0.1 },
      { photo: 0, zoom: 1.1, ox: 0, oy: 0.15 },
      { photo: 1, zoom: 1.0, ox: 0, oy: 0.12 },
      { photo: 0, zoom: 1.15, ox: 0, oy: 0.08 },
    ],
    strip: [
      { photo: 0, zoom: 1.05, ox: 0, oy: 0.02 },
      { photo: 1, zoom: 1.05, ox: 0, oy: 0.05 },
      { photo: 0, zoom: 1.05, ox: 0, oy: 0.02 },
    ],
    tilt: [
      { photo: 0, zoom: 1.1, ox: 0, oy: 0.12 },
      { photo: 1, zoom: 1.05, ox: 0, oy: 0.1 },
      { photo: 0, zoom: 1.15, ox: 0, oy: 0.1 },
    ],
    fullbleed: [{ photo: 0, zoom: 1.0, ox: 0, oy: 0.1 }],
  }[state.layout] ?? null;
  state.panels.forEach((p, i) => {
    const crop = crops ? crops[i] : null;
    p.photo = crop ? crop.photo % photos.length : i % photos.length;
    p.zoom = crop ? crop.zoom : 1.15 + (i % 3) * 0.12;
    p.ox = crop ? crop.ox : (i % 2 === 0 ? -0.06 : 0.06);
    p.oy = crop ? crop.oy : (i % 3 === 0 ? -0.05 : 0.04);
  });

  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    // Full-frame cover at the requested post size, with no editor selection outline.
    const [w, h] = currentSize();
    fullFrame = true;
    selectedPanel = -1;
    preview.width = w;
    preview.height = h;
    preview.style.width = '100vw';
    preview.style.height = '100vh';
  }
  syncInputsFromState();
  await document.fonts.ready;
  drawPreview();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

resetPanels();
bindControls();
bindPreview();
syncHistoryButtons();

if (query.get('shot')) {
  runShot();
} else {
  document.fonts.ready.then(requestDraw);
  drawPreview();
}
