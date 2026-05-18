const GRID = 16;
const CELL = 30;
const CANVAS_PX = GRID * CELL;
const CAT_SCALE = 3;

const COLORS = [
  '#1a1a2e', '#000000', '#4b4b4b', '#8c8c8c',
  '#c8c8c8', '#ffffff', '#ff8c42', '#ffb366',
  '#8b4513', '#d2691e', '#ffc0cb', '#ff69b4',
  '#90ee90', '#4169e1', '#ffd700', '#f5deb3',
];

let frames = [createEmptyFrame()];
let currentFrame = 0;
let currentColor = COLORS[0];
let currentTool = 'pen';
let isDrawing = false;
let onionSkin = false;
let previewPlaying = false;
let previewInterval = null;
let previewFrame = 0;
let fps = 8;
let cats = [];
let floorAnimId = null;
let lastFloorTime = 0;

const editorCanvas = document.getElementById('editor-canvas');
const editorCtx = editorCanvas.getContext('2d');
const previewCanvas = document.getElementById('preview-canvas');
const previewCtx = previewCanvas.getContext('2d');
const floorCanvas = document.getElementById('floor-canvas');
const floorCtx = floorCanvas.getContext('2d');
const frameStrip = document.getElementById('frame-strip');
const frameIndicator = document.getElementById('frame-indicator');
const colorPalette = document.getElementById('color-palette');
const colorPreview = document.getElementById('current-color-preview');
const coordsDisplay = document.getElementById('canvas-coords');
const catCountEl = document.getElementById('cat-count');
const fpsSlider = document.getElementById('fps-slider');
const fpsValue = document.getElementById('fps-value');
const fullscreenBtn = document.getElementById('fullscreen-btn');

function createEmptyFrame() {
  return Array.from({ length: GRID }, () => Array(GRID).fill(null));
}

function cloneFrame(f) {
  return f.map(row => [...row]);
}

function cellFromEvent(e) {
  const rect = editorCanvas.getBoundingClientRect();
  const scaleX = CANVAS_PX / rect.width;
  const scaleY = CANVAS_PX / rect.height;
  const x = Math.floor((e.clientX - rect.left) * scaleX / CELL);
  const y = Math.floor((e.clientY - rect.top) * scaleY / CELL);
  if (x < 0 || x >= GRID || y < 0 || y >= GRID) return null;
  return { x, y };
}

function renderEditor() {
  editorCtx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);

  if (onionSkin && currentFrame > 0) {
    drawFrameOnCtx(editorCtx, frames[currentFrame - 1], CELL, 0.25);
  }

  drawFrameOnCtx(editorCtx, frames[currentFrame], CELL, 1);

  editorCtx.strokeStyle = 'rgba(255,255,255,0.08)';
  editorCtx.lineWidth = 0.5;
  for (let i = 0; i <= GRID; i++) {
    editorCtx.beginPath();
    editorCtx.moveTo(i * CELL, 0);
    editorCtx.lineTo(i * CELL, CANVAS_PX);
    editorCtx.stroke();
    editorCtx.beginPath();
    editorCtx.moveTo(0, i * CELL);
    editorCtx.lineTo(CANVAS_PX, i * CELL);
    editorCtx.stroke();
  }
}

function drawFrameOnCtx(ctx, frame, cellSize, alpha) {
  ctx.globalAlpha = alpha;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (frame[y][x]) {
        ctx.fillStyle = frame[y][x];
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function applyTool(cell) {
  if (!cell) return;
  const frame = frames[currentFrame];
  if (currentTool === 'pen') {
    frame[cell.y][cell.x] = currentColor;
  } else if (currentTool === 'eraser') {
    frame[cell.y][cell.x] = null;
  } else if (currentTool === 'fill') {
    floodFill(frame, cell.x, cell.y, currentColor);
  }
  renderEditor();
  updateFrameStrip();
}

function floodFill(frame, sx, sy, newColor) {
  const target = frame[sy][sx];
  if (target === newColor) return;
  const stack = [[sx, sy]];
  const visited = new Set();
  while (stack.length) {
    const [x, y] = stack.pop();
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    if (x < 0 || x >= GRID || y < 0 || y >= GRID) continue;
    if (frame[y][x] !== target) continue;
    visited.add(key);
    frame[y][x] = newColor;
    stack.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
  }
}

editorCanvas.addEventListener('mousedown', (e) => {
  e.preventDefault();
  isDrawing = true;
  applyTool(cellFromEvent(e));
});

editorCanvas.addEventListener('mousemove', (e) => {
  const cell = cellFromEvent(e);
  if (cell) coordsDisplay.textContent = `${cell.x}, ${cell.y}`;
  else coordsDisplay.textContent = '—';
  if (isDrawing && currentTool !== 'fill') applyTool(cell);
});

editorCanvas.addEventListener('mouseup', () => { isDrawing = false; });
editorCanvas.addEventListener('mouseleave', () => { isDrawing = false; coordsDisplay.textContent = '—'; });

editorCanvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  isDrawing = true;
  const touch = e.touches[0];
  applyTool(cellFromEvent(touch));
}, { passive: false });

editorCanvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!isDrawing) return;
  const touch = e.touches[0];
  if (currentTool !== 'fill') applyTool(cellFromEvent(touch));
}, { passive: false });

editorCanvas.addEventListener('touchend', () => { isDrawing = false; });

fullscreenBtn.addEventListener('click', () => {
  const editorSection = document.getElementById('editor-section');
  if (!document.fullscreenElement) {
    if (editorSection.requestFullscreen) {
      editorSection.requestFullscreen();
    } else if (editorSection.webkitRequestFullscreen) { /* Safari */
      editorSection.webkitRequestFullscreen();
    } else if (editorSection.msRequestFullscreen) { /* IE11 */
      editorSection.msRequestFullscreen();
    }
    fullscreenBtn.textContent = '🔳 Zamknij z całego ekranu';
    editorSection.classList.add('is-fullscreen');
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) { /* Safari */
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { /* IE11 */
      document.msExitFullscreen();
    }
    fullscreenBtn.textContent = '🔲 Na cały ekran';
    editorSection.classList.remove('is-fullscreen');
  }
});

document.addEventListener('fullscreenchange', () => {
  const editorSection = document.getElementById('editor-section');
  if (!document.fullscreenElement) {
    fullscreenBtn.textContent = '🔲 Na cały ekran';
    editorSection.classList.remove('is-fullscreen');
  }
});

function setupPalette() {
  const tSwatch = document.createElement('div');
  tSwatch.className = 'color-swatch transparent-swatch';
  tSwatch.title = 'Transparent (eraser)';
  tSwatch.addEventListener('click', () => {
    currentTool = 'eraser';
    setActiveTool('eraser-tool');
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    tSwatch.classList.add('active');
    colorPreview.style.background = 'repeating-conic-gradient(#666 0% 25%, #999 0% 50%) 50% / 12px 12px';
  });
  colorPalette.appendChild(tSwatch);

  COLORS.forEach((c, i) => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    if (i === 0) swatch.classList.add('active');
    swatch.style.background = c;
    swatch.title = c;
    swatch.addEventListener('click', () => {
      currentColor = c;
      if (currentTool === 'eraser') { currentTool = 'pen'; setActiveTool('pen-tool'); }
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      colorPreview.style.background = c;
    });
    colorPalette.appendChild(swatch);
  });

  colorPreview.style.background = currentColor;
}

function setActiveTool(btnId) {
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(btnId).classList.add('active');
}

document.getElementById('pen-tool').addEventListener('click', () => { currentTool = 'pen'; setActiveTool('pen-tool'); });
document.getElementById('eraser-tool').addEventListener('click', () => { currentTool = 'eraser'; setActiveTool('eraser-tool'); });
document.getElementById('fill-tool').addEventListener('click', () => { currentTool = 'fill'; setActiveTool('fill-tool'); });

function updateFrameStrip() {
  frameIndicator.textContent = `${currentFrame + 1} / ${frames.length}`;
  frameStrip.innerHTML = '';
  frames.forEach((f, i) => {
    const thumb = document.createElement('canvas');
    thumb.width = 48;
    thumb.height = 48;
    thumb.className = 'frame-thumb' + (i === currentFrame ? ' active' : '');
    const tc = thumb.getContext('2d');
    drawFrameOnCtx(tc, f, 3, 1);
    thumb.addEventListener('click', () => { currentFrame = i; renderEditor(); updateFrameStrip(); });
    frameStrip.appendChild(thumb);
  });
  const active = frameStrip.querySelector('.active');
  if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

document.getElementById('prev-frame').addEventListener('click', () => {
  if (currentFrame > 0) { currentFrame--; renderEditor(); updateFrameStrip(); }
});
document.getElementById('next-frame').addEventListener('click', () => {
  if (currentFrame < frames.length - 1) { currentFrame++; renderEditor(); updateFrameStrip(); }
});
document.getElementById('add-frame').addEventListener('click', () => {
  frames.splice(currentFrame + 1, 0, createEmptyFrame());
  currentFrame++;
  renderEditor(); updateFrameStrip();
});
document.getElementById('copy-frame').addEventListener('click', () => {
  frames.splice(currentFrame + 1, 0, cloneFrame(frames[currentFrame]));
  currentFrame++;
  renderEditor(); updateFrameStrip();
});
document.getElementById('delete-frame').addEventListener('click', () => {
  if (frames.length <= 1) { frames[0] = createEmptyFrame(); currentFrame = 0; }
  else { frames.splice(currentFrame, 1); if (currentFrame >= frames.length) currentFrame = frames.length - 1; }
  renderEditor(); updateFrameStrip();
});

document.getElementById('onion-skin').addEventListener('change', (e) => {
  onionSkin = e.target.checked;
  renderEditor();
});

function renderPreview(frameData) {
  previewCtx.clearRect(0, 0, 128, 128);
  drawFrameOnCtx(previewCtx, frameData, 8, 1);
}

function startPreview() {
  if (previewPlaying) return;
  if (frames.length < 2) { renderPreview(frames[0]); return; }
  previewPlaying = true;
  previewFrame = 0;
  document.getElementById('play-preview').textContent = '⏸ stój';
  previewInterval = setInterval(() => {
    renderPreview(frames[previewFrame]);
    previewFrame = (previewFrame + 1) % frames.length;
  }, 1000 / fps);
}

function stopPreview() {
  previewPlaying = false;
  clearInterval(previewInterval);
  document.getElementById('play-preview').textContent = '▶ lecimy';
  renderPreview(frames[currentFrame]);
}

document.getElementById('play-preview').addEventListener('click', () => {
  if (previewPlaying) stopPreview(); else startPreview();
});

fpsSlider.addEventListener('input', (e) => {
  fps = parseInt(e.target.value);
  fpsValue.textContent = fps;
  if (previewPlaying) { stopPreview(); startPreview(); }
});

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  switch (e.key.toLowerCase()) {
    case 'p': currentTool = 'pen'; setActiveTool('pen-tool'); break;
    case 'e': currentTool = 'eraser'; setActiveTool('eraser-tool'); break;
    case 'f': currentTool = 'fill'; setActiveTool('fill-tool'); break;
    case 'arrowleft': if (currentFrame > 0) { currentFrame--; renderEditor(); updateFrameStrip(); } break;
    case 'arrowright': if (currentFrame < frames.length - 1) { currentFrame++; renderEditor(); updateFrameStrip(); } break;
  }
});

function createFloorCat(catFrames) {
  const fw = floorCanvas.width;
  const groundY = floorCanvas.height * 0.65;
  const baseY = groundY + Math.random() * 6;
  return {
    frames: catFrames,
    x: Math.random() * (fw - GRID * CAT_SCALE),
    baseY: baseY,
    y: baseY - GRID * CAT_SCALE,
    scaleMod: 1.0,
    vx: 0,
    direction: Math.random() < 0.5 ? -1 : 1,
    state: 'idle',
    stateTimer: 1 + Math.random() * 2,
    animFrame: 0,
    animTimer: 0,
    speed: 25 + Math.random() * 40,
  };
}

function updateCat(cat, dt) {
  cat.stateTimer -= dt;

  if (cat.stateTimer <= 0) {
    if (cat.state === 'idle') {
      cat.state = 'walking';
      cat.direction = Math.random() < 0.5 ? -1 : 1;
      cat.stateTimer = 2 + Math.random() * 4;
    } else {
      cat.state = 'idle';
      cat.stateTimer = 1.5 + Math.random() * 3;
    }
  }

  if (cat.state === 'walking') {
    cat.x += cat.direction * cat.speed * dt;
    const s = CAT_SCALE * (cat.scaleMod || 1.0);
    const maxX = floorCanvas.width - GRID * s;
    if (cat.x < 10) { cat.x = 10; cat.direction = 1; }
    if (cat.x > maxX - 10) { cat.x = maxX - 10; cat.direction = -1; }
    cat.animTimer += dt;
    if (cat.animTimer > 1 / fps) {
      cat.animTimer = 0;
      cat.animFrame = (cat.animFrame + 1) % cat.frames.length;
    }
  } else {
    cat.animFrame = 0;
  }
}

function renderFloorCat(ctx, cat) {
  const frame = cat.frames[cat.animFrame];
  const s = CAT_SCALE * (cat.scaleMod || 1.0);
  if (cat.baseY) cat.y = cat.baseY - GRID * s;

  ctx.save();
  if (cat.direction === -1) {
    ctx.translate(cat.x + GRID * s, cat.y);
    ctx.scale(-1, 1);
    ctx.translate(0, 0);
  } else {
    ctx.translate(cat.x, cat.y);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(GRID * s / 2, GRID * s - 1, GRID * s * 0.4, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (frame[y][x]) {
        ctx.fillStyle = frame[y][x];
        const px = Math.floor(x * s);
        const py = Math.floor(y * s);
        const pw = Math.ceil((x + 1) * s) - px;
        const ph = Math.ceil((y + 1) * s) - py;
        ctx.fillRect(px, py, pw, ph);
      }
    }
  }
  ctx.restore();
}

const clouds = Array.from({ length: 6 }, () => ({
  x: Math.random(),
  y: 0.08 + Math.random() * 0.3,
  w: 60 + Math.random() * 80,
  h: 22 + Math.random() * 18,
  speed: 0.003 + Math.random() * 0.006,
}));

const daisies = Array.from({ length: 18 }, () => ({
  x: Math.random(),
  yOff: 0.05 + Math.random() * 0.6,
  color: ['#ff69b4', '#ff85c0', '#ffadd2', '#fff', '#ffd700', '#ffb3d9'][Math.floor(Math.random() * 6)],
  size: 2.5 + Math.random() * 2.5,
  petalCount: 5 + Math.floor(Math.random() * 3),
}));

const butterflies = Array.from({ length: 4 }, () => ({
  x: Math.random(),
  y: 0.35 + Math.random() * 0.3,
  color: ['#ff85c0', '#a78bfa', '#67e8f9', '#ffb3d9'][Math.floor(Math.random() * 4)],
  phase: Math.random() * Math.PI * 2,
  speedX: 0.01 + Math.random() * 0.02,
  speedY: 0.4 + Math.random() * 0.6,
  amplitude: 0.02 + Math.random() * 0.03,
}));

function drawCloud(ctx, cx, cy, cw, ch) {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, cw * 0.5, ch * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - cw * 0.3, cy + ch * 0.1, cw * 0.32, ch * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + cw * 0.3, cy + ch * 0.08, cw * 0.35, ch * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(cx - cw * 0.05, cy - ch * 0.15, cw * 0.35, ch * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawDaisy(ctx, x, y, size, petals, color) {
  ctx.strokeStyle = '#5cb85c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + size * 3);
  ctx.stroke();
  ctx.fillStyle = color;
  for (let i = 0; i < petals; i++) {
    const angle = (i / petals) * Math.PI * 2;
    const px = x + Math.cos(angle) * size * 1.2;
    const py = y + Math.sin(angle) * size * 1.2;
    ctx.beginPath();
    ctx.ellipse(px, py, size * 0.6, size * 0.35, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

function renderFloor(timestamp) {
  const dt = lastFloorTime ? (timestamp - lastFloorTime) / 1000 : 0.016;
  lastFloorTime = timestamp;

  const w = floorCanvas.width;
  const h = floorCanvas.height;
  const groundY = h * 0.65;
  const t = timestamp / 1000;

  const sky = floorCtx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, '#87ceeb');
  sky.addColorStop(0.4, '#b8e4f9');
  sky.addColorStop(0.75, '#e8d5f5');
  sky.addColorStop(1, '#ffd6e7');
  floorCtx.fillStyle = sky;
  floorCtx.fillRect(0, 0, w, groundY);

  const sunGrad = floorCtx.createRadialGradient(w * 0.15, h * 0.12, 8, w * 0.15, h * 0.12, 80);
  sunGrad.addColorStop(0, 'rgba(255,240,200,0.9)');
  sunGrad.addColorStop(0.3, 'rgba(255,230,180,0.4)');
  sunGrad.addColorStop(1, 'rgba(255,220,180,0)');
  floorCtx.fillStyle = sunGrad;
  floorCtx.fillRect(0, 0, w, groundY);
  floorCtx.fillStyle = '#fff5d4';
  floorCtx.shadowColor = '#ffe4a0';
  floorCtx.shadowBlur = 25;
  floorCtx.beginPath();
  floorCtx.arc(w * 0.15, h * 0.12, 16, 0, Math.PI * 2);
  floorCtx.fill();
  floorCtx.shadowBlur = 0;

  clouds.forEach(c => {
    c.x = (c.x + c.speed * dt) % 1.3;
    const cx = (c.x - 0.15) * w;
    const cy = c.y * h;
    drawCloud(floorCtx, cx, cy, c.w, c.h);
  });

  const ground = floorCtx.createLinearGradient(0, groundY, 0, h);
  ground.addColorStop(0, '#7ecf6a');
  ground.addColorStop(0.15, '#6abf55');
  ground.addColorStop(0.5, '#55a840');
  ground.addColorStop(1, '#4a9535');
  floorCtx.fillStyle = ground;
  floorCtx.fillRect(0, groundY, w, h - groundY);

  floorCtx.fillStyle = 'rgba(180,240,140,0.25)';
  floorCtx.fillRect(0, groundY, w, 4);

  floorCtx.strokeStyle = '#3d8a2a';
  floorCtx.lineWidth = 1.2;
  for (let i = 0; i < w; i += 7) {
    const gy = groundY + 1;
    const sway = Math.sin(t * 2 + i * 0.12) * 2;
    floorCtx.beginPath();
    floorCtx.moveTo(i, gy);
    floorCtx.lineTo(i + sway, gy - 5 - (i % 4));
    floorCtx.stroke();
  }

  daisies.forEach(d => {
    const dx = d.x * w;
    const dy = groundY + 6 + d.yOff * (h - groundY - 20);
    drawDaisy(floorCtx, dx, dy, d.size, d.petalCount, d.color);
  });

  butterflies.forEach(b => {
    b.x = (b.x + b.speedX * dt) % 1.1;
    const bx = (b.x - 0.05) * w;
    const by = b.y * h + Math.sin(t * b.speedY + b.phase) * b.amplitude * h;
    const wingFlap = Math.abs(Math.sin(t * 6 + b.phase));
    floorCtx.fillStyle = b.color;
    floorCtx.beginPath();
    floorCtx.ellipse(bx - 3, by, 3, 4 * wingFlap, -0.3, 0, Math.PI * 2);
    floorCtx.fill();
    floorCtx.beginPath();
    floorCtx.ellipse(bx + 3, by, 3, 4 * wingFlap, 0.3, 0, Math.PI * 2);
    floorCtx.fill();
    floorCtx.fillStyle = '#333';
    floorCtx.fillRect(bx - 0.5, by - 2, 1, 4);
  });

  cats.forEach(cat => {
    updateCat(cat, dt);
    renderFloorCat(floorCtx, cat);
  });

  floorAnimId = requestAnimationFrame(renderFloor);
}

function resizeFloor() {
  const container = document.getElementById('floor-container');
  const w = container.clientWidth;
  const h = 340;
  floorCanvas.width = w;
  floorCanvas.height = h;
}

document.getElementById('add-to-floor').addEventListener('click', () => {
  const hasPixels = frames.some(f => f.some(row => row.some(c => c !== null)));
  if (!hasPixels) { showToast('narysuj coś najpierw głupi 🎨'); return; }

  const catFrames = frames.map(f => cloneFrame(f));
  const cat = createFloorCat(catFrames);
  cats.push(cat);
  updateCatCount();
  saveCats();
  showToast('kiciowy poszedł na plac zabaw! 🐾');

  document.getElementById('floor-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

document.getElementById('clear-floor').addEventListener('click', () => {
  cats = [];
  updateCatCount();
  saveCats();
});

function updateCatCount() {
  const n = cats.length;
  catCountEl.textContent = n === 0 ? 'NIE MA KICIOWYCH JESZCZE!' :
    n === 1 ? '1 kiciowy się bawi' : `${n} kiciowych się bawi`;
}

let toastEl = null;
function showToast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function saveCats() {
  try {
    localStorage.setItem('kiciowe_cats', JSON.stringify(cats.map(c => ({
      frames: c.frames,
      speed: c.speed,
      scaleMod: c.scaleMod,
      baseY: c.baseY
    }))));
  } catch (e) { }
}

function loadCats() {
  try {
    const data = JSON.parse(localStorage.getItem('kiciowe_cats'));
    if (data && Array.isArray(data)) {
      data.forEach(d => {
        const cat = createFloorCat(d.frames);
        if (d.speed) cat.speed = d.speed;
        if (d.scaleMod) cat.scaleMod = d.scaleMod;
        if (d.baseY) cat.baseY = d.baseY;
        cats.push(cat);
      });
      updateCatCount();
    }
  } catch (e) { }
}

floorCanvas.addEventListener('click', (e) => {
  const rect = floorCanvas.getBoundingClientRect();
  const scaleX = floorCanvas.width / rect.width;
  const scaleY = floorCanvas.height / rect.height;

  const clickX = (e.clientX - rect.left) * scaleX;
  const clickY = (e.clientY - rect.top) * scaleY;

  for (let i = cats.length - 1; i >= 0; i--) {
    const cat = cats[i];
    const s = CAT_SCALE * (cat.scaleMod || 1.0);
    const catWidth = GRID * s;
    const catHeight = GRID * s;

    cat.baseY = cat.baseY || (cat.y + GRID * CAT_SCALE);
    const catY = cat.baseY - catHeight;

    if (clickX >= cat.x && clickX <= cat.x + catWidth &&
      clickY >= catY && clickY <= catY + catHeight) {

      if ((cat.scaleMod || 1.0) < 8.0) {
        cat.scaleMod = (cat.scaleMod || 1.0) * 1.2;
        showToast('dostał doline noteci !!!');
      } else {
        showToast('jemu już może starczy co??');
      }
      saveCats();
      break;
    }
  }
});

function init() {
  setupPalette();
  renderEditor();
  updateFrameStrip();
  renderPreview(frames[0]);
  resizeFloor();
  loadCats();
  lastFloorTime = 0;
  floorAnimId = requestAnimationFrame(renderFloor);
  window.addEventListener('resize', resizeFloor);
}

init();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.log('ServiceWorker registered:', reg.scope);
    }).catch(err => {
      console.log('ServiceWorker registration failed:', err);
    });
  });
}
