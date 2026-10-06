const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });
const metrics = SweepMetrics;
const HUES = [168, 188, 206, 262, 292, 336, 128, 36];
const GAP = 640;
const HD = 200;
const MASTER_N = 16;
const MAX_FUND = 70;
const MAX_MASTER = 36;
const agents = [];
const pods = [];
const masterDots = [];
let liveIndex = 0;
let seq = 1;
let W = 1, H = 1, t = 0, last = performance.now(), paused = false;
const ZOOM_OPEN = 3;
const zoomEl = document.getElementById("zoom");
const cam = { x: 0, y: 0, z: 1, dpr: 1, home: 1, desk: 1, max: 2, user: false };

function hash(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

const GRID = 14;

function makeAgent() {
  return {
    id: seq++,
    hue: Math.floor(Math.random() * 360),
    side: Math.random() > 0.48 ? 1 : -1,
    ox: 0,
    oy: 0,
    world: null,
    active: false,
    slot: -1,
  };
}

function gridFrame() {
  const spanX = metrics.scene.maxX - metrics.scene.minX + GAP;
  const spanY = metrics.scene.maxY - metrics.scene.minY + GAP;
  const originX = -((GRID - 1) * spanX) / 2;
  const originY = -((GRID - 1) * spanY) / 2;
  const m = metrics.M;
  return {
    spanX,
    spanY,
    originX,
    originY,
    minX: originX + m.x,
    maxX: originX + (GRID - 1) * spanX + m.x + m.w,
    minY: originY + m.y,
    maxY: originY + (GRID - 1) * spanY + m.y + m.h,
  };
}

function layoutAgents() {
  const f = gridFrame();
  agents.forEach((a) => { a.active = false; a.slot = -1; });
  const pod = livePod();
  const boxes = pod && pod.boxes && pod.boxes.length ? pod.boxes : null;
  if (!boxes) {
    const n = Math.max(1, agents.length);
    const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    const originX = -((cols - 1) * f.spanX) / 2;
    const originY = -((Math.ceil(n / cols) - 1) * f.spanY) / 2;
    agents.forEach((a, i) => {
      a.ox = originX + (i % cols) * f.spanX;
      a.oy = originY + Math.floor(i / cols) * f.spanY;
      a.active = true;
      a.slot = i;
    });
    return;
  }
  while (agents.length < boxes.length) agents.push(makeAgent());
  boxes.forEach((slot, i) => {
    const a = agents[i];
    if (!a) return;
    const c = slot % GRID;
    const r = (slot / GRID) | 0;
    a.ox = f.originX + c * f.spanX;
    a.oy = f.originY + r * f.spanY;
    a.active = true;
    a.slot = slot;
  });
}

function syncCount(n) {
  const inside = hdOn();
  let rel = null;
  if (inside) {
    const focus = agentNearest();
    const live = livePod();
    if (focus && live) rel = { id: focus.id, x: cam.x - live.ox - focus.ox, y: cam.y - live.oy - focus.oy };
  }
  const need = Math.max(n, 150);
  while (agents.length < need) agents.push(makeAgent());
  while (agents.length > need) {
    const i = Math.floor(Math.random() * agents.length);
    agents.splice(i, 1);
  }
  layoutAgents();
  if (rel) {
    const a = agents.find((x) => x.id === rel.id && x.active);
    const live = livePod();
    if (a && live) {
      cam.x = live.ox + a.ox + rel.x;
      cam.y = live.oy + a.oy + rel.y;
      return;
    }
  }
  layoutPods();
  if (!inside) fitOpen();
}

const fundDots = [];

function pileBox() {
  const f = gridFrame();
  return { minX: f.minX, minY: f.minY, maxX: f.maxX, maxY: f.maxY };
}

function gateGeom() {
  const p = pileBox();
  const pileW = Math.max(1, p.maxX - p.minX);
  const pileH = Math.max(1, p.maxY - p.minY);
  const w = pileW * 0.94 * 0.6;
  const h = Math.max(pileH * 0.045, pileW * 0.028) * 0.7;
  return {
    x: -w / 2,
    y: p.maxY + pileH * 0.1,
    w,
    h,
    cx: 0,
    slits: 48,
    outH: pileH * 0.28,
  };
}

function deskLocalBox() {
  const p = pileBox();
  const g = gateGeom();
  const pad = metrics.M.w * 0.22;
  return {
    minX: Math.min(p.minX, g.x) - pad,
    maxX: Math.max(p.maxX, g.x + g.w) + pad,
    minY: p.minY - pad,
    maxY: g.y + g.h + g.outH * 0.2 + pad,
  };
}

function livePod() {
  return pods[liveIndex] || pods[0];
}

function layoutPods() {
  if (!pods.length) {
    for (let i = 0; i < MASTER_N; i++) pods.push({ i, on: false, ox: 0, oy: 0, emit: Math.random() * 2 });
  }
  const b = deskLocalBox();
  const w = Math.max(1, b.maxX - b.minX);
  const h = Math.max(1, b.maxY - b.minY);
  const spanX = w + metrics.M.w * 0.45;
  const spanY = h + metrics.M.w * 0.45;
  const originX = -1.5 * spanX;
  const originY = -1.5 * spanY;
  pods.forEach((pod, i) => {
    pod.ox = originX + (i % 4) * spanX;
    pod.oy = originY + Math.floor(i / 4) * spanY;
  });
}

function rollMaster() {
  const n = 1 + Math.floor(Math.random() * 16);
  const order = pods.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  pods.forEach((p) => { p.on = false; });
  for (let k = 0; k < n; k++) pods[order[k]].on = true;
  pods.forEach((p) => {
    const count = 1 + ((Math.random() * 150) | 0);
    const slots = [];
    for (let s = 0; s < GRID * GRID; s++) slots.push(s);
    for (let i = slots.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const tmp = slots[i];
      slots[i] = slots[j];
      slots[j] = tmp;
    }
    p.boxes = slots.slice(0, count);
  });
  if (!pods[liveIndex] || !pods[liveIndex].on) liveIndex = order[0];
  layoutPods();
  layoutAgents();
}

function masterBox() {
  const b = deskLocalBox();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pods.forEach((pod) => {
    minX = Math.min(minX, pod.ox + b.minX);
    maxX = Math.max(maxX, pod.ox + b.maxX);
    minY = Math.min(minY, pod.oy + b.minY);
    maxY = Math.max(maxY, pod.oy + b.maxY);
  });
  if (!isFinite(minX)) {
    minX = b.minX;
    maxX = b.maxX;
    minY = b.minY;
    maxY = b.maxY;
  }
  return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
}

function masterExit(kind, m) {
  const pad = Math.max(m.w, m.h) * 0.08;
  if (kind === "left") return { x: m.minX - pad, y: m.cy };
  if (kind === "right") return { x: m.maxX + pad, y: m.cy };
  return { x: m.cx, y: m.maxY + pad };
}

function refreshZoomRef() {
  const m = masterBox();
  const pad = Math.max(m.w, m.h) * 0.12;
  const w = Math.max(1, m.w + pad * 2);
  const h = Math.max(1, m.h + pad * 2);
  cam.home = Math.min(W / w, H / h) * 0.9;
  cam.max = Math.max(cam.home * ZOOM_OPEN, metrics.maxZ(W, H), metrics.homeZ(W, H));
  const p = pileBox();
  const g = gateGeom();
  const dw = Math.max(p.maxX, g.x + g.w) - Math.min(p.minX, g.x) + metrics.M.w * 0.44;
  const dh = (g.y + g.h + g.outH) - p.minY + metrics.M.w * 0.44;
  cam.desk = Math.min(W / Math.max(1, dw), H / Math.max(1, dh)) * 0.94;
}

function zoomPct() {
  return Math.max(100, Math.round(100 * cam.z / Math.max(cam.home, 1e-9)));
}

function paintZoom() {
  if (zoomEl) zoomEl.textContent = "ZOOM:" + zoomPct() + "%";
}

function centerMaster() {
  const m = masterBox();
  cam.x = m.cx;
  cam.y = m.cy;
}

function centerSmallest() {
  const live = livePod();
  const b = deskLocalBox();
  cam.x = live.ox + (b.minX + b.maxX) / 2;
  cam.y = live.oy + (b.minY + b.maxY) / 2;
}

function fitMaster() {
  refreshZoomRef();
  centerMaster();
  cam.z = cam.home;
}

function fitOpen() {
  refreshZoomRef();
  const live = livePod();
  const a = agents[Math.floor(agents.length / 2)] || agents[0];
  if (a && live) {
    cam.x = live.ox + a.ox;
    cam.y = live.oy + a.oy;
    if (!a.world) a.world = createSweepWorld();
  } else {
    centerSmallest();
  }
  cam.z = clamp(metrics.homeZ(W, H), cam.home, cam.max);
  cam.user = false;
}

function masterView() {
  return cam.z < cam.desk * 0.62;
}

function frameAgent(a) {
  const live = livePod();
  const z = metrics.homeZ(W, H);
  cam.x = live.ox + a.ox;
  cam.y = live.oy + a.oy;
  cam.z = z;
  cam.user = true;
  if (!a.world) a.world = createSweepWorld();
}

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  const long = Math.max(W, H, 1);
  cam.dpr = Math.min(8, Math.max(window.devicePixelRatio || 1, 6144 / long));
  canvas.width = Math.floor(W * cam.dpr);
  canvas.height = Math.floor(H * cam.dpr);
  ctx.imageSmoothingEnabled = false;
  ctx.imageSmoothingQuality = "high";
  refreshZoomRef();
  if (!cam.user) fitOpen();
  else cam.z = clamp(cam.z, cam.home, cam.max);
  paintZoom();
}

function viewRect() {
  return {
    x0: cam.x - (W / 2) / cam.z,
    y0: cam.y - (H / 2) / cam.z,
    x1: cam.x + (W / 2) / cam.z,
    y1: cam.y + (H / 2) / cam.z,
  };
}

function worldToDesk(p) {
  const live = livePod();
  return { x: p.x - live.ox, y: p.y - live.oy };
}

function agentAt(p) {
  const d = worldToDesk(p);
  const m = metrics.M;
  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    if (!a.active) continue;
    if (d.x >= a.ox + m.x && d.x <= a.ox + m.x + m.w && d.y >= a.oy + m.y && d.y <= a.oy + m.y + m.h) return a;
  }
  return null;
}

function podAt(p) {
  const b = deskLocalBox();
  for (let i = 0; i < pods.length; i++) {
    const pod = pods[i];
    if (p.x >= pod.ox + b.minX && p.x <= pod.ox + b.maxX && p.y >= pod.oy + b.minY && p.y <= pod.oy + b.maxY) return pod;
  }
  return null;
}

function adoptLiveFromView() {
  const pod = podAt({ x: cam.x, y: cam.y });
  if (!pod || pod.i === liveIndex) return;
  liveIndex = pod.i;
  layoutAgents();
}

function agentNearest() {
  let best = null;
  let bestD = Infinity;
  const live = livePod();
  agents.forEach((a) => {
    if (!a.active) return;
    const d = (live.ox + a.ox - cam.x) ** 2 + (live.oy + a.oy - cam.y) ** 2;
    if (d < bestD) { bestD = d; best = a; }
  });
  return best;
}

function hdOn() {
  const zCut = Math.min(HD / metrics.M.w, metrics.homeZ(W, H) * 0.62);
  return !masterView() && cam.z >= zCut;
}

function hdAgents() {
  if (!hdOn()) return [];
  const v = viewRect();
  const s = metrics.scene;
  const list = [];
  const live = livePod();
  agents.forEach((a) => {
    if (!a.active) return;
    const x0 = live.ox + a.ox + s.minX;
    const x1 = live.ox + a.ox + s.maxX;
    const y0 = live.oy + a.oy + s.minY;
    const y1 = live.oy + a.oy + s.maxY;
    if (x1 < v.x0 || x0 > v.x1 || y1 < v.y0 || y0 > v.y1) return;
    list.push({ a, d: (live.ox + a.ox - cam.x) ** 2 + (live.oy + a.oy - cam.y) ** 2 });
  });
  list.sort((p, q) => p.d - q.d);
  return list.slice(0, 3).map((p) => p.a);
}

function mosaicOn(a) {
  return !!(a.world && a.world.portraitOn) || !!a.mosaic;
}

function mosaicU(a) {
  let u = 0;
  if (a.world && a.world.portraitOn) u = a.world.portrait;
  else if (a.mosaic) u = a.mosaic.age / a.mosaic.dur;
  return u < 0 ? 0 : u > 1 ? 1 : u;
}

function rollMosaicPack() {
  const n = 3 + ((Math.random() * 5) | 0);
  const density = (0.3 + Math.random() * 0.45) / 3;
  const ang = Math.random() * Math.PI * 2;
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const tiles = [];
  let pMin = Infinity, pMax = -Infinity;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (Math.random() > density) continue;
      const hue = Math.random() * 360;
      const sat = 30 + Math.random() * 65;
      const lit = 26 + Math.random() * 52;
      const proj = c * dx + r * dy;
      if (proj < pMin) pMin = proj;
      if (proj > pMax) pMax = proj;
      tiles.push({
        r, c,
        fill: `hsl(${hue.toFixed(1)} ${sat.toFixed(1)}% ${lit.toFixed(1)}%)`,
        j: Math.random() * 0.6,
        jx: (Math.random() - 0.5),
        jy: (Math.random() - 0.5),
        d: proj,
      });
    }
  }
  if (!tiles.length) {
    const r = (Math.random() * n) | 0, c = (Math.random() * n) | 0;
    tiles.push({
      r, c,
      fill: `hsl(${(Math.random() * 360).toFixed(1)} ${(40 + Math.random() * 50).toFixed(1)}% ${(30 + Math.random() * 45).toFixed(1)}%)`,
      j: Math.random() * 0.6, jx: 0, jy: 0, d: 0,
    });
    pMin = pMax = 0;
  }
  const span = pMax - pMin;
  for (let i = 0; i < tiles.length; i++) {
    const base = span > 0 ? (tiles[i].d - pMin) / span : 0;
    tiles[i].d = base * 0.8 + Math.random() * 0.2;
  }
  return { n, tiles };
}

function bakeMosaic(a) {
  a.mosaicTiles = metrics.cells.map(() => rollMosaicPack());
  a.mosaicPlate = rollMosaicPack();
}

function clearMosaic(a) {
  a.mosaic = null;
  a.mosaicTiles = null;
  a.mosaicPlate = null;
}

function ensureMosaicTiles(a) {
  if (!mosaicOn(a)) return;
  if (!a.mosaicTiles) bakeMosaic(a);
}

function startMosaic(a) {
  if (mosaicOn(a)) return;
  bakeMosaic(a);
  a.mosaic = { age: 0, dur: 1.05 };
}

function tickMosaic(a, dt) {
  if (a.world && a.world.portraitOn) {
    a.mosaic = null;
    ensureMosaicTiles(a);
    return false;
  }
  if (!a.mosaic) {
    if (a.mosaicTiles) clearMosaic(a);
    return false;
  }
  a.mosaic.age += dt;
  if (a.mosaic.age < a.mosaic.dur) return false;
  clearMosaic(a);
  return true;
}

function onMosaicDone(a) {
  clearMosaic(a);
  if (!masterView()) {
    spawnFundDot(a);
    return;
  }
  const g = gateGeom();
  const color = tintFromSlot(a.ox, g);
  pods.forEach((pod) => {
    if (!pod.on) return;
    if (Math.random() > 0.2) return;
    spawnMasterDot(pod.ox + a.ox, pod.oy + g.y + g.h, color);
  });
}

function strokePlate(z) {
  const m = metrics.M;
  ctx.lineWidth = 1.05 / z;
  ctx.strokeStyle = "rgba(65, 90, 64, 0.78)";
  ctx.strokeRect(m.x, m.y, m.w, m.h);
  metrics.cells.forEach((cell, i) => {
    ctx.strokeStyle = "rgba(65, 90, 64, 0.85)";
    ctx.strokeRect(cell.x, cell.y, cell.w, cell.h);
  });
}

function drawMini(a) {
  const z = Math.max(cam.z, 0.00001);
  ctx.save();
  ctx.translate(a.ox, a.oy);
  drawPortrait(a, z);
  const panelZ = metrics.homeZ(W, H);
  const ratio = z / Math.max(panelZ, 0.00001);
  const budget = mosaicOn(a) ? 0 : ratio < 0.28 ? 0 : ratio < 0.5 ? 1 : 2;
  const ps = 3.2 / z;
  for (let k = 0; k < budget; k++) {
    const cell = metrics.cells[Math.floor(hash(a.id * 17 + k * 9) * 7)];
    if (!cell) continue;
    const gap = Math.max(1.4 / z, cell.w * 0.08);
    const x = cell.x + gap + (cell.w - gap * 2 - ps) * (0.2 + hash(a.id + k + 3) * 0.6);
    const y = cell.y + gap + (cell.h - gap * 2 - ps) * (0.2 + hash(a.id * 3 + k) * 0.6);
    ctx.fillStyle = `hsl(${(a.hue + HUES[k % 8]) % 360} 68% 50%)`;
    ctx.fillRect(x, y, ps, ps);
  }
  strokePlate(z);
  ctx.restore();
}

function fillMosaicBox(x, y, w, h, z, u, pack) {
  if (!pack || !pack.tiles.length) return;
  const gap = Math.max(1.15 / z, Math.min(w, h) * 0.07);
  const ix = x + gap;
  const iy = y + gap;
  const iw = w - gap * 2;
  const ih = h - gap * 2;
  if (iw <= 0 || ih <= 0) return;
  const n = pack.n;
  const tw = iw / n;
  const th = ih / n;
  const pad = Math.max(0.7 / z, Math.min(tw, th) * 0.12);
  const fade = u >= 0.72 ? Math.max(0, 1 - (u - 0.72) / 0.28) : 1;
  if (fade <= 0) return;
  const prevAlpha = ctx.globalAlpha;
  const tiles = pack.tiles;
  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    let ap = (u - tile.d * 0.22) / 0.09;
    if (ap <= 0) continue;
    if (ap > 1) ap = 1;
    const s = 1 - (1 - ap) * (1 - ap);
    const p = pad * (1 + tile.j);
    const bw = tw - p * 2;
    const bh = th - p * 2;
    if (bw <= 0 || bh <= 0) continue;
    const sw = bw * (0.6 + 0.4 * s);
    const sh = bh * (0.6 + 0.4 * s);
    const cx = ix + tile.c * tw + tw * 0.5 + tile.jx * pad * 0.5;
    const cy = iy + tile.r * th + th * 0.5 + tile.jy * pad * 0.5;
    ctx.globalAlpha = prevAlpha * fade * s;
    ctx.fillStyle = tile.fill;
    ctx.fillRect(cx - sw * 0.5, cy - sh * 0.5, sw, sh);
  }
  ctx.globalAlpha = prevAlpha;
}

function drawPortrait(a, z) {
  if (!mosaicOn(a)) return;
  ensureMosaicTiles(a);
  const u = mosaicU(a);
  const showCells = metrics.cells[0] && metrics.cells[0].w * z >= 6;
  if (showCells && a.mosaicTiles) {
    metrics.cells.forEach((cell, i) => {
      fillMosaicBox(cell.x, cell.y, cell.w, cell.h, z, u, a.mosaicTiles[i]);
    });
  } else {
    const m = metrics.M;
    fillMosaicBox(m.x, m.y, m.w, m.h, z, u, a.mosaicPlate);
  }
}

function spawnFundDot(a) {
  if (masterView() || fundDots.length >= MAX_FUND) return;
  const g = gateGeom();
  const x0 = a.ox;
  const y0 = a.oy + metrics.M.y + metrics.M.h;
  fundDots.push({
    x: x0,
    y: y0,
    x0,
    hue: Math.random() * 360,
    mode: "fall",
    u: 0,
    vy: Math.max((g.y - y0) / 1.4, g.h * 16),
  });
}

function tintFromSlot(x0, g) {
  const slot = (x0 - g.x) / Math.max(1, g.w);
  if (slot >= 1 / 3 && slot < 2 / 3) return "#b4b8b7";
  return x0 >= g.cx ? "#1f8a3b" : "#d1263f";
}

function spawnMasterDot(wx, wy, color) {
  if (masterDots.length >= MAX_MASTER) return;
  const kind = color === "#1f8a3b" ? "right" : color === "#d1263f" ? "left" : "down";
  masterDots.push({
    x: wx,
    y: wy,
    x0: wx,
    y0: wy,
    color,
    kind,
    u: 0,
    dur: 2.2 + Math.random() * 1.1,
  });
}

function updateFund(dt) {
  if (!agents.length) return;
  const g = gateGeom();
  const top = g.y;
  const bot = g.y + g.h;
  for (let i = fundDots.length - 1; i >= 0; i--) {
    const p = fundDots[i];
    if (p.mode === "fall") {
      p.x = p.x0;
      p.y += Math.max(g.h * 8, p.vy) * dt;
      if (p.y >= top) {
        p.mode = "out";
        p.u = 0;
        p.y = bot;
        p.out = tintFromSlot(p.x0, g);
        const live = livePod();
        spawnMasterDot(live.ox + p.x, live.oy + bot, p.out);
      }
    } else {
      p.u = Math.min(1, p.u + dt / 0.85);
      const u = p.u * p.u;
      p.x = g.cx + (p.x0 - g.cx) * (1 + u * 1.2);
      p.y = bot + g.outH * p.u;
      if (p.u >= 1) fundDots.splice(i, 1);
    }
  }
}

function updateMaster(dt) {
  const m = masterBox();
  const live = livePod();
  const g = gateGeom();
  pods.forEach((pod) => {
    if (!pod.on) return;
    if (pod.i === live.i && !masterView()) return;
    pod.emit -= dt;
    if (pod.emit > 0 || masterDots.length >= MAX_MASTER) return;
    pod.emit = 7 + Math.random() * 9;
    const roll = Math.random();
    const color = roll < 0.33 ? "#d1263f" : roll < 0.66 ? "#1f8a3b" : "#b4b8b7";
    spawnMasterDot(pod.ox + g.cx, pod.oy + g.y + g.h, color);
  });
  for (let i = masterDots.length - 1; i >= 0; i--) {
    const p = masterDots[i];
    p.u = Math.min(1, p.u + dt / p.dur);
    const e = masterExit(p.kind, m);
    const u = p.u * p.u * (3 - 2 * p.u);
    p.x = p.x0 + (e.x - p.x0) * u;
    p.y = p.y0 + (e.y - p.y0) * u;
    if (p.kind === "down") p.x += Math.sin(p.u * 3.1 + p.y0) * m.w * 0.01 * (1 - u);
    if (p.u >= 1) masterDots.splice(i, 1);
  }
}

function drawGate() {
  const g = gateGeom();
  const z = Math.max(cam.z, 0.00001);
  const grey = "#b4b8b7";
  const ink = "rgba(65, 90, 64, 0.55)";
  const lip = g.h * 0.22;
  const inset = g.w * 0.028;
  ctx.save();
  ctx.fillStyle = grey;
  ctx.fillRect(g.x, g.y, g.w, lip);
  ctx.fillRect(g.x, g.y + g.h - lip, g.w, lip);
  ctx.fillRect(g.x, g.y, inset, g.h);
  ctx.fillRect(g.x + g.w - inset, g.y, inset, g.h);
  const inner = g.w - inset * 2;
  const pitch = inner / g.slits;
  const tooth = pitch * 0.42;
  ctx.fillStyle = "#8a8e8d";
  ctx.fillRect(g.x + inset, g.y + lip, inner, g.h - lip * 2);
  ctx.fillStyle = grey;
  for (let i = 0; i <= g.slits; i++) {
    ctx.fillRect(g.x + inset + i * pitch - tooth * 0.5, g.y + lip, tooth, g.h - lip * 2);
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.1 / z;
  ctx.strokeRect(g.x, g.y, g.w, g.h);
  ctx.restore();
}

function hudBoxes() {
  const pad = 16;
  const boxes = [];
  ["census", "ver", "zoom"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const r = el.getBoundingClientRect();
    boxes.push({ x0: r.left - pad, y0: r.top - pad, x1: r.right + pad, y1: r.bottom + pad });
  });
  return boxes;
}

function hitsHud(wx, wy, size, boxes) {
  const sx = (wx - cam.x) * cam.z + W / 2;
  const sy = (wy - cam.y) * cam.z + H / 2;
  const half = Math.max(6, size * cam.z * 0.55);
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    if (sx + half > b.x0 && sx - half < b.x1 && sy + half > b.y0 && sy - half < b.y1) return true;
  }
  return false;
}

function drawFund() {
  if (!agents.length) return;
  const z = Math.max(cam.z, 0.00001);
  const mote = 6.5 / z;
  const hud = hudBoxes();
  fundDots.forEach((p) => {
    if (p.mode !== "fall") return;
    ctx.fillStyle = "hsl(" + (p.hue | 0) + " 72% 52%)";
    ctx.fillRect(p.x - mote / 2, p.y - mote / 2, mote, mote);
  });
  drawGate();
  fundDots.forEach((p) => {
    if (p.mode !== "out") return;
    const s = mote * (1 + p.u * 3.2);
    const live = livePod();
    if (hitsHud(live.ox + p.x, live.oy + p.y, s, hud)) return;
    ctx.fillStyle = p.out || "#b4b8b7";
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  });
}

function drawPodShell(pod) {
  const b = deskLocalBox();
  const g = gateGeom();
  const z = Math.max(cam.z, 0.00001);
  const m = metrics.M;
  const f = gridFrame();
  ctx.save();
  ctx.translate(pod.ox, pod.oy);
  ctx.strokeStyle = pod.on ? "rgba(65, 90, 64, 0.72)" : "rgba(180, 184, 183, 0.7)";
  ctx.lineWidth = 1.15 / z;
  ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
  if (pod.on) {
    ctx.fillStyle = "#b4b8b7";
    ctx.fillRect(g.x, g.y, g.w, g.h);
    const boxes = pod.boxes || [];
    const showInner = m.w * z >= 7;
    ctx.lineWidth = 1.05 / z;
    for (let i = 0; i < boxes.length; i++) {
      const slot = boxes[i];
      const c = slot % GRID;
      const r = (slot / GRID) | 0;
      const ox = f.originX + c * f.spanX;
      const oy = f.originY + r * f.spanY;
      ctx.strokeStyle = "rgba(65, 90, 64, 0.78)";
      ctx.strokeRect(ox + m.x, oy + m.y, m.w, m.h);
      if (showInner) {
        metrics.cells.forEach((cell, k) => {
          ctx.strokeStyle = "rgba(65, 90, 64, 0.8)";
          ctx.strokeRect(ox + cell.x, oy + cell.y, cell.w, cell.h);
        });
      }
    }
  }
  ctx.restore();
}

function drawMaster() {
  const m = masterBox();
  const z = Math.max(cam.z, 0.00001);
  const pad = Math.max(m.w, m.h) * 0.08;
  ctx.save();
  ctx.strokeStyle = "rgba(65, 90, 64, 0.55)";
  ctx.lineWidth = 1.25 / z;
  ctx.strokeRect(m.minX - pad * 0.35, m.minY - pad * 0.35, m.w + pad * 0.7, m.h + pad * 1.15);
  const mote = (masterView() ? 4 : 2.2) / z;
  const hud = hudBoxes();
  masterDots.forEach((p) => {
    if (hitsHud(p.x, p.y, mote * 2.2, hud)) return;
    const s = mote;
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - s * 1.15, p.y - s * 1.15, s * 2.3, s * 2.3);
    ctx.globalAlpha = 0.92;
    ctx.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#fff";
    ctx.fillRect(p.x - s * 0.28, p.y - s * 0.28, s * 0.28, s * 0.28);
    ctx.globalAlpha = 1;
  });
  ctx.restore();
}

if (window.EmergentCensus) syncCount(window.EmergentCensus.active());
else { syncCount(200); }
layoutAgents();
rollMaster();
layoutPods();
resize();
window.addEventListener("resize", resize);
window.onEmergentCensus = (c) => {
  syncCount(c.spawned - c.retired);
  rollMaster();
  if (!cam.user) fitOpen();
};

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) t += dt;
  if (window.EmergentCensus) window.EmergentCensus.tick(dt);
  adoptLiveFromView();
  const hot = hdAgents();
  const hotSet = new Set(hot);
  if (!paused) agents.forEach((a) => {
    if (!a.active) return;
    if (hotSet.has(a)) {
      if (!a.world) a.world = createSweepWorld();
      a.world.update(dt);
      if (a.world.takeDrop()) onMosaicDone(a);
      return;
    }
    if (tickMosaic(a, dt)) onMosaicDone(a);
    if (a.dropIn == null) a.dropIn = 15 + hash(a.id) * 80;
    a.dropIn -= dt;
    if (a.dropIn <= 0 && !mosaicOn(a)) {
      a.dropIn = 60 + hash(a.id * 7 + Math.floor(t * 3)) * 90;
      startMosaic(a);
    }
  });
  if (!paused) {
    if (!masterView()) updateFund(dt);
    updateMaster(dt);
  }
  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.setTransform(
    cam.dpr * cam.z, 0, 0, cam.dpr * cam.z,
    cam.dpr * (W / 2 - cam.x * cam.z),
    cam.dpr * (H / 2 - cam.y * cam.z)
  );
  const live = livePod();
  pods.forEach((pod) => {
    if (pod.i === live.i && !masterView()) return;
    drawPodShell(pod);
  });
  if (!masterView() && live && live.on) {
    ctx.save();
    ctx.translate(live.ox, live.oy);
    agents.forEach((a) => {
      if (!a.active) return;
      if (hotSet.has(a)) {
        ctx.save();
        ctx.translate(a.ox, a.oy);
        a.world.draw(ctx, cam.z);
        drawPortrait(a, cam.z);
        strokePlate(cam.z);
        ctx.restore();
      } else drawMini(a);
    });
    drawFund();
    ctx.restore();
  }
  drawMaster();
  paintZoom();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

let down = null;
canvas.addEventListener("pointerdown", (e) => {
  down = { x: e.clientX, y: e.clientY };
  canvas.style.cursor = "grabbing";
});
canvas.addEventListener("pointermove", (e) => {
  if (!down) return;
  cam.user = true;
  cam.x -= (e.clientX - down.x) / cam.z;
  cam.y -= (e.clientY - down.y) / cam.z;
  down.x = e.clientX;
  down.y = e.clientY;
});
canvas.addEventListener("pointerup", () => {
  down = null;
  canvas.style.cursor = "grab";
});
canvas.addEventListener("pointerleave", () => {
  down = null;
  canvas.style.cursor = "grab";
});
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  cam.user = true;
  const mx = e.clientX;
  const my = e.clientY;
  const wx = cam.x + (mx - W / 2) / cam.z;
  const wy = cam.y + (my - H / 2) / cam.z;
  const next = clamp(cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12), cam.home, cam.max);
  cam.z = next;
  if (next <= cam.home * 1.001) {
    centerMaster();
  } else {
    cam.x = wx - (mx - W / 2) / next;
    cam.y = wy - (my - H / 2) / next;
    const pod = podAt({ x: wx, y: wy });
    if (pod) liveIndex = pod.i;
  }
  paintZoom();
}, { passive: false });
