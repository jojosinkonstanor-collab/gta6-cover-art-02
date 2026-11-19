// Vice City Cover Lab — cover engine. Draws a multi-panel GTA-style poster cover
// onto any 2D canvas at any size. Pure canvas, no network, no Rockstar art: the
// sky, slatted sun, palms, skyline, panels and lettering are all drawn here.
// Fonts are Anton + Pacifico, vendored under app/fonts/ under the SIL Open Font
// License. Every random element comes from a seeded stream, so a cover renders
// identically every time.

/** Deterministic random stream, so a cover renders identically every time. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Panel layouts. Each panel is {x, y, w, h, rot} in fractions of the panels
 * region (the top ~72% of the cover; the rest is the title band).
 */
export const LAYOUTS = {
  hero: {
    label: 'Hero + two',
    panels: [
      { x: 0, y: 0, w: 0.585, h: 1, rot: 0 },
      { x: 0.6, y: 0, w: 0.4, h: 0.485, rot: 0 },
      { x: 0.6, y: 0.515, w: 0.4, h: 0.485, rot: 0 },
    ],
  },
  grid: {
    label: 'Four grid',
    panels: [
      { x: 0, y: 0, w: 0.4925, h: 0.485, rot: 0 },
      { x: 0.5075, y: 0, w: 0.4925, h: 0.485, rot: 0 },
      { x: 0, y: 0.515, w: 0.4925, h: 0.485, rot: 0 },
      { x: 0.5075, y: 0.515, w: 0.4925, h: 0.485, rot: 0 },
    ],
  },
  nine: {
    label: 'Nine panels',
    panels: [
      { x: 0, y: 0, w: 0.3233, h: 0.3233, rot: 0 },
      { x: 0.3383, y: 0, w: 0.3233, h: 0.3233, rot: 0 },
      { x: 0.6767, y: 0, w: 0.3233, h: 0.3233, rot: 0 },
      { x: 0, y: 0.3383, w: 0.3233, h: 0.3233, rot: 0 },
      { x: 0.3383, y: 0.3383, w: 0.3233, h: 0.3233, rot: 0 },
      { x: 0.6767, y: 0.3383, w: 0.3233, h: 0.3233, rot: 0 },
      { x: 0, y: 0.6767, w: 0.3233, h: 0.3233, rot: 0 },
      { x: 0.3383, y: 0.6767, w: 0.3233, h: 0.3233, rot: 0 },
      { x: 0.6767, y: 0.6767, w: 0.3233, h: 0.3233, rot: 0 },
    ],
  },
  strip: {
    label: 'Three strip',
    panels: [
      { x: 0, y: 0, w: 0.3233, h: 1, rot: 0 },
      { x: 0.3383, y: 0, w: 0.3233, h: 1, rot: 0 },
      { x: 0.6767, y: 0, w: 0.3233, h: 1, rot: 0 },
    ],
  },
  tilt: {
    label: 'Tilted snaps',
    panels: [
      { x: 0.02, y: 0.03, w: 0.56, h: 0.94, rot: -0.035 },
      { x: 0.62, y: 0.0, w: 0.36, h: 0.46, rot: 0.045 },
      { x: 0.6, y: 0.52, w: 0.38, h: 0.46, rot: -0.02 },
    ],
  },
  fullbleed: {
    label: 'Full bleed',
    panels: [{ x: 0, y: 0, w: 1, h: 1, rot: 0 }],
  },
};

/** Colour grades: sky ramp, sun, the photo filter and the overlay washes. */
export const GRADES = {
  sunset: {
    label: 'Vice Sunset',
    sky: ['#1d0b3d', '#7d1e6e', '#e8435f', '#ff7a1a', '#ffc53d'],
    sun: '#ffd76a',
    filter: 'saturate(1.25) contrast(1.08) sepia(0.15)',
    washTop: 'rgba(255, 122, 26, 0.22)',
    washBottom: 'rgba(178, 42, 122, 0.28)',
    accent: '#ff2e88',
    shadow: '#ff7a1a',
  },
  neon: {
    label: 'Neon Nights',
    sky: ['#070b2e', '#3b1470', '#a01e8f', '#ff2e88', '#19e3c2'],
    sun: '#ff5db1',
    filter: 'saturate(1.7) contrast(1.12) hue-rotate(-12deg)',
    washTop: 'rgba(255, 46, 136, 0.25)',
    washBottom: 'rgba(25, 227, 194, 0.22)',
    accent: '#19e3c2',
    shadow: '#ff2e88',
  },
  golden: {
    label: 'Golden Hour',
    sky: ['#2a1204', '#7a2f08', '#c25e12', '#ff9a2a', '#ffe08a'],
    sun: '#fff0b0',
    filter: 'sepia(0.35) saturate(1.35) contrast(1.06)',
    washTop: 'rgba(255, 190, 60, 0.20)',
    washBottom: 'rgba(140, 60, 10, 0.25)',
    accent: '#ffc53d',
    shadow: '#ff9a2a',
  },
  miami: {
    label: 'Miami Dawn',
    sky: ['#04182b', '#0e4d6e', '#1f8a8a', '#ff8a5c', '#ffd166'],
    sun: '#ffe9a8',
    filter: 'saturate(1.4) contrast(1.1) hue-rotate(8deg)',
    washTop: 'rgba(31, 138, 138, 0.22)',
    washBottom: 'rgba(255, 138, 92, 0.26)',
    accent: '#19e3c2',
    shadow: '#0e4d6e',
  },
  noir: {
    label: 'Midnight Mono',
    sky: ['#05050c', '#141428', '#2c2c4a', '#55557a', '#9a9ab8'],
    sun: '#e8e8f2',
    filter: 'grayscale(1) contrast(1.22) brightness(1.06)',
    washTop: 'rgba(120, 130, 200, 0.16)',
    washBottom: 'rgba(255, 46, 136, 0.12)',
    accent: '#e8e8f2',
    shadow: '#ff2e88',
  },
};

/** Title lettering styles: how the big title is filled and outlined. */
export const LETTERING = {
  white: { label: 'White block', fill: '#ffffff', outline: '#160a2e', gradient: false },
  sunset: { label: 'Sunset gradient', fill: null, outline: '#160a2e', gradient: true },
  neon: { label: 'Neon outline', fill: 'rgba(255,255,255,0.08)', outline: '#19e3c2', gradient: false },
};

/** Absolute panel rectangles (pixels) for a layout at W x H. */
export function panelRects(layoutId, W, H) {
  const layout = LAYOUTS[layoutId] ?? LAYOUTS.hero;
  const regionH = H * 0.72;
  const m = Math.max(6, W * 0.012);
  const rx = m, ry = m, rw = W - m * 2, rh = regionH - m * 2;
  return layout.panels.map((p) => ({
    x: rx + p.x * rw,
    y: ry + p.y * rh,
    w: p.w * rw,
    h: p.h * rh,
    rot: p.rot,
  }));
}

/** Draws one photo cover-fit into a panel rect, honouring zoom and pan offsets. */
export function drawPhotoIntoPanel(ctx, img, rect, zoom, ox, oy) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (!iw || !ih) return;
  const base = Math.max(rect.w / iw, rect.h / ih);
  const s = base * Math.max(1, zoom || 1);
  const dw = iw * s, dh = ih * s;
  let dx = rect.x + (rect.w - dw) / 2 + (ox || 0) * rect.w;
  let dy = rect.y + (rect.h - dh) / 2 + (oy || 0) * rect.h;
  dx = Math.min(rect.x, Math.max(rect.x + rect.w - dw, dx));
  dy = Math.min(rect.y, Math.max(rect.y + rect.h - dh, dy));
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/** A retro slatted sun: a glowing disc cut by horizontal bars toward its base. */
function drawSun(ctx, grade, cx, cy, r) {
  const glow = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 1.9);
  glow.addColorStop(0, grade.sun + 'cc');
  glow.addColorStop(1, grade.sun + '00');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  const disc = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  disc.addColorStop(0, '#fff7d6');
  disc.addColorStop(0.55, grade.sun);
  disc.addColorStop(1, grade.accent);
  ctx.fillStyle = disc;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  // Slats: bars of sky colour widening toward the bottom of the disc.
  const sky = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  grade.sky.forEach((c, i) => sky.addColorStop(i / (grade.sky.length - 1), c));
  ctx.fillStyle = sky;
  let y = cy + r * 0.05, gap = r * 0.045;
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, gap);
    y += gap * 2.4;
    gap *= 1.35;
  }
  ctx.restore();
}

/** A palm tree silhouette: a curved trunk with drooping fronds. */
function drawPalm(ctx, x, baseY, h, lean, rand) {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.rotate(lean);
  ctx.strokeStyle = 'rgba(10, 4, 22, 0.92)';
  ctx.fillStyle = 'rgba(10, 4, 22, 0.92)';
  ctx.lineWidth = Math.max(2, h * 0.03);
  ctx.lineCap = 'round';
  // Trunk, gently curved.
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(h * 0.06, -h * 0.5, h * 0.02, -h * 0.92);
  ctx.stroke();
  // Fronds fanning from the crown.
  const crownX = h * 0.02, crownY = -h * 0.92;
  const fronds = 7;
  for (let i = 0; i < fronds; i += 1) {
    const a = -Math.PI * (0.08 + (i / (fronds - 1)) * 0.84) + (rand() - 0.5) * 0.08;
    const len = h * (0.34 + rand() * 0.12);
    const tipX = crownX + Math.cos(a) * len;
    const tipY = crownY + Math.sin(a) * len * 0.55 + len * 0.28;
    ctx.beginPath();
    ctx.moveTo(crownX, crownY);
    ctx.quadraticCurveTo(
      crownX + Math.cos(a) * len * 0.55,
      crownY + Math.sin(a) * len * 0.45 - len * 0.08,
      tipX, tipY,
    );
    ctx.lineWidth = Math.max(1.5, h * 0.018);
    ctx.stroke();
  }
  // Coconuts.
  ctx.beginPath();
  ctx.arc(crownX - h * 0.02, crownY + h * 0.02, h * 0.025, 0, Math.PI * 2);
  ctx.arc(crownX + h * 0.025, crownY + h * 0.03, h * 0.022, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A dark skyline with lit windows and palms in front, deterministic per seed. */
function drawSkyline(ctx, W, H, baseY, rand) {
  const ground = H * 0.995;
  ctx.fillStyle = 'rgba(12, 5, 26, 0.9)';
  let x = -W * 0.01;
  while (x < W * 1.01) {
    const bw = W * (0.025 + rand() * 0.04);
    const bh = H * (0.04 + rand() * 0.07);
    ctx.fillRect(x, baseY - bh, bw, bh + (ground - baseY));
    if (bh > H * 0.08) {
      ctx.fillStyle = 'rgba(255, 197, 61, 0.7)';
      const cols = Math.max(1, Math.floor(bw / (W * 0.018)));
      for (let c = 0; c < cols; c += 1) {
        if (rand() < 0.35) {
          ctx.fillRect(x + W * 0.008 + c * W * 0.018, baseY - bh + H * 0.015 + rand() * bh * 0.55, W * 0.005, H * 0.01);
        }
      }
      ctx.fillStyle = 'rgba(12, 5, 26, 0.9)';
    }
    x += bw + W * 0.007;
  }
  // Palms along the front, a few tall, a few short.
  const palmCount = Math.max(3, Math.round(W / 260));
  for (let i = 0; i < palmCount; i += 1) {
    const px = W * (0.06 + (i + rand() * 0.7) / palmCount * 0.88);
    const ph = H * (0.09 + rand() * 0.08);
    drawPalm(ctx, px, ground, ph, (rand() - 0.5) * 0.14, rand);
  }
}

/** Halftone dots fading down the sky, deterministic per seed. */
function drawHalftone(ctx, W, H, rand) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  const step = Math.max(14, W * 0.016);
  for (let y = step; y < H * 0.5; y += step) {
    const fade = 1 - y / (H * 0.55);
    for (let x = step / 2; x < W; x += step) {
      const r = step * 0.16 * fade * (0.6 + rand() * 0.8);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Film grain: a seeded scatter of faint light and dark specks. */
function drawGrain(ctx, W, H, rand) {
  const n = Math.floor((W * H) / 900);
  for (let i = 0; i < n; i += 1) {
    const v = rand();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(rand() * W, rand() * H, 1.6, 1.6);
  }
}

function fitFont(ctx, text, fontFamily, startSize, maxWidth, weight) {
  let size = startSize;
  const set = () => { ctx.font = `${weight} ${size}px ${fontFamily}`; };
  set();
  while (size > 12 && ctx.measureText(text).width > maxWidth) {
    size -= Math.max(1, Math.floor(size * 0.04));
    set();
  }
  return size;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Renders the whole cover.
 * state: { layout, grade, lettering, title, subtitle, badge, panels: [{photo, zoom, ox, oy}] }
 * photos: array of HTMLImageElement (or null entries).
 * opts: { highlight } — panel index to outline for the editor.
 */
export function renderCover(ctx, W, H, state, photos, opts = {}) {
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const lettering = LETTERING[state.lettering] ?? LETTERING.white;
  const rand = seededRandom(20261119);
  const regionH = H * 0.72;

  // Sky.
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  grade.sky.forEach((c, i) => sky.addColorStop(i / (grade.sky.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  drawSun(ctx, grade, W * 0.76, H * 0.3, Math.min(W, H) * 0.21);
  drawHalftone(ctx, W, H, rand);

  // Panels.
  const rects = panelRects(state.layout, W, H);
  const frame = Math.max(4, W * 0.007);
  rects.forEach((rect, i) => {
    const panel = (state.panels && state.panels[i]) || {};
    const img = panel.photo != null ? photos[panel.photo] : null;
    ctx.save();
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
      ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
    }
    // White poster frame.
    ctx.fillStyle = '#fdf8f2';
    ctx.fillRect(rect.x - frame, rect.y - frame, rect.w + frame * 2, rect.h + frame * 2);
    if (img) {
      ctx.filter = grade.filter;
      drawPhotoIntoPanel(ctx, img, rect, panel.zoom ?? 1.15, panel.ox ?? 0, panel.oy ?? 0);
      ctx.filter = 'none';
      // Grade washes over the photo.
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();
      const wash = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
      wash.addColorStop(0, grade.washTop);
      wash.addColorStop(1, grade.washBottom);
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = wash;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    } else {
      const empty = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
      empty.addColorStop(0, '#2a1745');
      empty.addColorStop(1, '#120a24');
      ctx.fillStyle = empty;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      fitFont(ctx, 'ADD PHOTO', 'Anton, sans-serif', Math.min(rect.w * 0.16, rect.h * 0.12), rect.w * 0.8, '');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ADD PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    }
    // Inner edge + soft shadow under the frame.
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = Math.max(1.5, W * 0.0015);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    if (opts.highlight === i) {
      ctx.strokeStyle = '#ffc53d';
      ctx.lineWidth = Math.max(3, W * 0.004);
      ctx.setLineDash([W * 0.02, W * 0.01]);
      ctx.strokeRect(rect.x - frame * 2, rect.y - frame * 2, rect.w + frame * 4, rect.h + frame * 4);
      ctx.setLineDash([]);
    }
    ctx.restore();
  });

  // Skyline and palms behind the title band, grounded near the bottom edge.
  drawSkyline(ctx, W, H, H * 0.98, rand);

  // Title band: badge, title, subtitle — stacked so nothing is ever clipped.
  const bandY = regionH;
  const bandH = H - bandY;
  const cx = W / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  const badge = (state.badge || '').trim().toUpperCase();
  if (badge) {
    const bs = Math.max(12, H * 0.02);
    ctx.font = `${bs}px Anton, sans-serif`;
    const bw = ctx.measureText(badge).width + bs * 1.6;
    const bx = cx - bw / 2;
    const by = bandY + bandH * 0.07;
    ctx.save();
    ctx.fillStyle = grade.accent;
    roundRectPath(ctx, bx, by, bw, bs * 1.9, bs * 0.95);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(badge, cx, by + bs * 1.42);
    ctx.restore();
  }

  const title = (state.title || '').trim().toUpperCase();
  if (title) {
    const size = fitFont(ctx, title, 'Anton, sans-serif', H * 0.125, W * 0.94, '');
    ctx.save();
    ctx.translate(cx, bandY + bandH * 0.52);
    ctx.rotate(-0.018);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${size}px Anton, sans-serif`;
    ctx.lineJoin = 'round';
    // Hard offset shadow in the grade's shadow colour.
    ctx.fillStyle = grade.shadow;
    ctx.fillText(title, size * 0.035, size * 0.045);
    // Outline, then the fill per the chosen lettering style.
    ctx.lineWidth = Math.max(2, size * 0.075);
    ctx.strokeStyle = lettering.outline;
    ctx.strokeText(title, 0, 0);
    if (lettering.gradient) {
      const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
      g.addColorStop(0, '#ffe08a');
      g.addColorStop(0.5, grade.accent);
      g.addColorStop(1, '#19e3c2');
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = lettering.fill;
    }
    ctx.fillText(title, 0, 0);
    ctx.restore();
  }

  const subtitle = (state.subtitle || '').trim();
  if (subtitle) {
    const ss = fitFont(ctx, subtitle, 'Pacifico, cursive', H * 0.05, W * 0.8, '');
    const subGrad = ctx.createLinearGradient(0, H * 0.86, 0, H * 0.97);
    subGrad.addColorStop(0, '#ffe08a');
    subGrad.addColorStop(0.5, grade.accent);
    subGrad.addColorStop(1, '#19e3c2');
    ctx.save();
    ctx.translate(cx, bandY + bandH * 0.88);
    ctx.rotate(-0.01);
    ctx.font = `${ss}px Pacifico, cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Dark scrim behind the script so it reads over the skyline.
    const tw = ctx.measureText(subtitle).width;
    ctx.fillStyle = 'rgba(12, 5, 26, 0.55)';
    roundRectPath(ctx, -tw / 2 - ss * 0.7, -ss * 0.85, tw + ss * 1.4, ss * 1.7, ss * 0.85);
    ctx.fill();
    ctx.fillStyle = subGrad;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = ss * 0.25;
    ctx.fillText(subtitle, 0, 0);
    ctx.restore();
  }

  // Grain + vignette over everything.
  drawGrain(ctx, W, H, rand);
  const vig = ctx.createRadialGradient(cx, H * 0.5, Math.min(W, H) * 0.45, cx, H * 0.5, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}
