// Adapt the unchanged ALGO/ART V7 engine, rather than approximating its layouts.
import {makeImageCuts} from './image-cuts.js';
export const COLLAGE_VERSION = 4;
export const ENGINE_COMMIT = 'd231259ad08a690c1109a6af7f624c769c50eadc';
export const DEFAULTS = Object.freeze({
  orientation: 'portrait', cutMode: 'geometric', layoutMode: 'field',
  cutSeed: 'CUT-001', layoutSeed: 'LAYOUT-001', imageSeed: 'POOL-001',
  detail: 18, pieces: 12, negativeSpace: 35, rotation: 14, scale: 185,
  cutStyle: 'subjects', cutSize: 80, wholeSubjects: true,
  paper: '#f4f0e5', shadow: true, monochrome: false
});
export const MODES = ['field', 'geometric', 'rects'];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function sanitiseSettings(input = {}) {
  const out = { ...DEFAULTS };
  for (const k of ['cutSeed', 'layoutSeed', 'imageSeed']) {
    if (typeof input[k] === 'string' && input[k].trim()) out[k] = input[k].trim().slice(0, 80);
  }
  for (const k of ['cutMode', 'layoutMode']) if (MODES.includes(input[k])) out[k] = input[k];
  if (['subjects', 'regions', 'geometric'].includes(input.cutStyle)) out.cutStyle = input.cutStyle;
  if (['portrait', 'landscape', 'square'].includes(input.orientation)) out.orientation = input.orientation;
  for (const [k, lo, hi] of [['detail', 8, 60], ['pieces', 6, 48], ['negativeSpace', 0, 90], ['rotation', 0, 60], ['scale', 60, 230], ['cutSize', 35, 100]]) {
    if (Number.isFinite(input[k])) out[k] = Math.round(clamp(input[k], lo, hi));
  }
  if (/^#[0-9a-f]{6}$/i.test(input.paper || '')) out.paper = input.paper;
  for (const k of ['shadow', 'monochrome', 'wholeSubjects']) if (typeof input[k] === 'boolean') out[k] = input[k];
  return out;
}

function engineSettings(options, stage) {
  const isCut = stage === 'cut';
  // A square export uses landscape engine geometry, fitted into a square below.
  return {
    orientation: options.orientation === 'portrait' ? 'portrait' : 'landscape',
    seed: isCut ? options.cutSeed : options.layoutSeed,
    mode: isCut ? options.cutMode : options.layoutMode,
    elements: isCut ? options.detail : options.pieces,
    density: isCut ? 55 : 46, complexity: isCut ? 46 : 52,
    negativeSpace: isCut ? 10 : options.negativeSpace, phiStrength: 95,
    recursion: isCut ? 4 : 3, spiralInfluence: 63, goldenAngle: 95, nesting: 0,
    pen: 'felt', thickness: 3, wobble: 0, overdraw: 1, opacity: 90,
    pressure: 0, dryness: 0, curveBias: 0, shapeAmount: 100,
    overlap: isCut ? 30 : 40, rotation: isCut ? 35 : options.rotation,
    lines: false, circles: true, rectangles: true, polygons: true, arcs: false,
    palette: 'mono', colourCount: 1, saturation: 75, brightness: 50,
    paper: '#ffffff', grain: 0
  };
}

function noOpCanvas() {
  const context = new Proxy({}, { get: (obj, key) => key in obj ? obj[key] : () => {}, set: (obj, key, value) => { obj[key] = value; return true; } });
  return { getContext: () => context };
}

function runEngine(A, options, stage) {
  const polygons = [];
  const original = A.stroke;
  const previousVersion = A.rendererVersion;
  const previousMeta = A.lastRenderMeta;
  const previousSize = [A.W, A.H];
  A.rendererVersion = 7;
  A.stroke = function(ctx, points, ...rest) {
    if (points.length > 3 && Math.hypot(points[0].x - points.at(-1).x, points[0].y - points.at(-1).y) < 0.01) {
      polygons.push(points.slice(0, -1).map(p => ({ x: p.x, y: p.y })));
    }
    // Preserve every original random-number call and the engine's metadata.
    return original.call(A, ctx, points, ...rest);
  };
  try {
    const settings = engineSettings(options, stage);
    const metadata = A.render(noOpCanvas(), settings, 1, false);
    return { metadata, polygons, width: A.W, height: A.H, settings };
  } finally {
    A.stroke = original;
    A.rendererVersion = previousVersion;
    A.lastRenderMeta = previousMeta;
    [A.W, A.H] = previousSize;
  }
}

const rectangle = c => [{x:c.x,y:c.y}, {x:c.x+c.w,y:c.y}, {x:c.x+c.w,y:c.y+c.h}, {x:c.x,y:c.y+c.h}];

// Clip the original closed outline to the image plane. An off-canvas ALGO/ART
// shape must not ask drawImage to read beyond its source image.
function clipPolygon(points, width, height) {
  let out = points;
  for (const [axis, edge, sign] of [['x', 0, 1], ['x', width, -1], ['y', 0, 1], ['y', height, -1]]) {
    const input = out; out = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i], b = input[(i + 1) % input.length];
      const aIn = (a[axis] - edge) * sign >= 0, bIn = (b[axis] - edge) * sign >= 0;
      if (aIn) out.push(a);
      if (aIn !== bIn) {
        const t = (edge - a[axis]) / (b[axis] - a[axis]);
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
  }
  return out;
}

function polygonArea(points) {
  return Math.abs(points.reduce((sum, a, i) => {
    const b = points[(i + 1) % points.length]; return sum + a.x * b.y - b.x * a.y;
  }, 0)) / 2;
}

export function makeCuts(A, input = {}) {
  const options = sanitiseSettings(input), result = runEngine(A, options, 'cut');
  const { width, height, metadata } = result;
  const raw = options.cutMode === 'rects' ? metadata.guide.cells.map(rectangle) : result.polygons;
  const masks = raw.map(p => clipPolygon(p, width, height)).filter(p => p.length >= 3 && polygonArea(p) > 180).map((points, index) => {
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
    return { index, points, bounds: { x, y, w, h } };
  });
  if (!masks.length) throw new Error('The cut engine produced no usable closed shapes. Change the cut seed.');
  return { width, height, masks, strategy: metadata.strategy, settings: result.settings };
}

export function makeLayout(A, input = {}) {
  const options = sanitiseSettings(input), result = runEngine(A, options, 'layout');
  const { width, height, metadata } = result, guide = metadata.guide;
  let slots;
  if (guide.type === 'rects') {
    slots = guide.cells.map(c => ({ x: c.x + c.w / 2, y: c.y + c.h / 2, w: c.w, h: c.h, size: c.w, rot: 0, tier: 'cell' }));
  } else slots = (guide.layout || guide.items).map(item => ({ x: item.x, y: item.y, size: item.size, rot: item.rot || 0, tier: item.tier }));
  // Engine families produce different numbers of slots. The slider is a maximum.
  slots = slots.slice(0, options.pieces);
  const finalWidth = options.orientation === 'square' ? 1200 : width;
  const finalHeight = options.orientation === 'square' ? 1200 : height;
  const sx = finalWidth / width, sy = finalHeight / height;
  slots = slots.map((p, index) => ({ ...p, index, x: p.x * sx, y: p.y * sy, size: p.size * Math.min(sx, sy), ...(p.w ? {w:p.w*sx,h:p.h*sy} : {}) }));
  return { width: finalWidth, height: finalHeight, slots, strategy: metadata.strategy,
    voids: metadata.voids.map(v => ({...v, x:v.x*sx, y:v.y*sy, w:v.w*sx, h:v.h*sy})), settings: result.settings };
}

export function makeScene(A, input, images, cuts = null, layout = null) {
  const settings = sanitiseSettings(input);
  cuts ||= makeCuts(A, settings); layout ||= makeLayout(A, settings);
  const enabled = images.filter(image => image.enabled !== false);
  const r = A.makeR(settings.imageSeed);
  const order = enabled.slice();
  for (let i = order.length - 1; i > 0; i--) { const j = r.int(0, i); [order[i], order[j]] = [order[j], order[i]]; }
  const maskOrder = cuts.masks.slice();
  for (let i = maskOrder.length - 1; i > 0; i--) { const j = r.int(0, i); [maskOrder[i], maskOrder[j]] = [maskOrder[j], maskOrder[i]]; }
  const imageCuts = settings.cutStyle === 'geometric' ? {} : Object.fromEntries(images.map(image=>[image.id,makeImageCuts(cuts,settings,image)]));
  const pieces = order.length ? layout.slots.map((slot, i) => {
    const image = order[i % order.length];
    // Cycle through a source's complete cut map before reusing its fragments.
    const sourceMasks = imageCuts[image.id]?.masks || maskOrder;
    const mask = sourceMasks[Math.floor(i / order.length) % sourceMasks.length];
    return { slot, mask, imageId: image.id, fragmentId: `${image.id}:${mask.id || mask.index}` };
  }) : [];
  return { settings, cuts, layout, pieces, imageCuts };
}
