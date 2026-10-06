/* One agent plate. Drawn in local world units, master centered at 0,0.
   The fleet page places these with a camera; zoomed in, this is the HD view. */
(function initSweepWorld(global) {
  const HUES = [168, 188, 206, 262, 292, 336, 128, 36];
  const N = 8;
  const CELL = 1040;
  const SPACE = 780;
  const FEED_W = 320;
  const BUBBLE_W = 520;
  const TRADE_W = 300;
  const S = CELL / 140;
  const DOT = 16;

  const M = { x: 0, y: 0, w: 0, h: 0, inset: 0 };
  const cells = [];
  let hLines = [];
  let vLines = [];
  let tradeY = 0;

  function hash(n) {
    let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function hsl(h, s, l, a) {
    return a == null ? `hsl(${h} ${s}% ${l}%)` : `hsla(${h} ${s}% ${l}% / ${a})`;
  }

  function layout() {
    const g = 32;
    const inset = 72;
    const inner = 4 * CELL + 3 * g;
    M.w = inner + inset * 2;
    M.h = M.w;
    M.x = -M.w / 2;
    M.y = -M.h / 2;
    M.inset = inset;
    M.feedW = FEED_W;
    M.feedX = M.x - SPACE - FEED_W;
    M.bubbleW = BUBBLE_W;
    M.tradeLeft = M.x + M.w + SPACE + BUBBLE_W + SPACE * 0.55;
    const gx = M.x + inset;
    const gy = M.y + inset;
    cells.length = 0;
    hLines = [];
    vLines = [];
    for (let i = 0; i < 16; i++) {
      const c = i % 4;
      const r = Math.floor(i / 4);
      cells.push({ x: gx + c * (CELL + g), y: gy + r * (CELL + g), w: CELL, h: CELL });
    }
    for (let r = 0; r < 4; r++) hLines.push(cells[r * 4].y + CELL);
    for (let c = 0; c < 4; c++) vLines.push(cells[c].x + CELL);
    tradeY = 0;
  }

  function floorY() { return M.y + M.h + CELL * 0.42; }

  function returnPoint(u) {
    const x0 = M.tradeLeft + TRADE_W + SPACE * 1.85;
    const x1 = M.feedX + M.feedW * 0.45;
    const chordY = 20;
    const sagitta = M.h * 1.12;
    const chord = Math.abs(x1 - x0);
    const r = (chord * chord) / (8 * sagitta) + sagitta / 2;
    const cx = (x0 + x1) / 2;
    const cy = chordY + (r - sagitta);
    const a0 = Math.atan2(chordY - cy, x0 - cx);
    const a1 = Math.atan2(chordY - cy, x1 - cx);
    let da = a1 - a0;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const midY = cy + Math.sin(a0 + da * 0.5) * r;
    if (midY > chordY) da = da > 0 ? da - Math.PI * 2 : da + Math.PI * 2;
    const a = a0 + da * u;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  }

  function sceneBox() {
    const far = returnPoint(0);
    const crest = returnPoint(0.5);
    const home = returnPoint(1);
    return {
      minX: Math.min(M.feedX, home.x) - 80,
      maxX: Math.max(M.tradeLeft + TRADE_W, far.x) + 120,
      minY: Math.min(M.y, crest.y) - 100,
      maxY: floorY() + 80,
    };
  }

  layout();
  const scene = sceneBox();

  function homeZ(W, H) {
    return Math.min(W / (scene.maxX - scene.minX), H / (scene.maxY - scene.minY)) * 0.92;
  }
  function maxZ(W, H) {
    return (Math.min(W, H) * 0.94) / CELL;
  }

  global.SweepMetrics = {
    CELL, DOT, SPACE, M, cells, scene, homeZ, maxZ, floorY, returnPoint,
  };

  global.createSweepWorld = function createSweepWorld() {
    let ctx = null;
    let viewZ = 1;
    let t = Math.random() * 20;
    let phase = ["flow", "fire", "order"][Math.floor(Math.random() * 3)];
    let phaseT = Math.random() * 3;
    let flowDur = 8.4;
    let fireDur = 5.4;
    let orderDur = 7.8;
    let side = 1;
    let size = 0.6;
    let activeCount = 7;
    let panels = [];
    const dots = [];
    let delivered = false;
    let pendingDrop = false;
    let portrait = null;
    let sweepClock = Math.random() * 20;
    let sweepWait = 36 + Math.random() * 16;
    let broom = null;
    const greys = [];
    let greyWait = 0.6;

    function px(x, y, color, s) {
      const g = s || 4;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x / g) * g, Math.round(y / g) * g, Math.max(1, g - 1), Math.max(1, g - 1));
    }

    function pace() {
      const j = () => 0.8 + Math.random() * 0.45;
      flowDur = 8.4 * j();
      fireDur = 5.4 * j();
      orderDur = 7.8 * j();
    }

    function makePanel(slot) {
      const exitAt = 2 + Math.floor(Math.random() * (N - 2));
      const links = [];
      for (let i = 0; i < exitAt; i++) {
        const strands = 1 + Math.floor(Math.random() * 3);
        for (let s = 0; s < strands; s++) {
          links.push({
            from: i,
            to: i + 1,
            y0: 0.12 + Math.random() * 0.76,
            y1: 0.12 + Math.random() * 0.76,
            weight: 0.2 + Math.random() * 0.8,
            amp: CELL * (0.012 + Math.random() * 0.05),
            freq: 6 + Math.random() * 14,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
      const gaps = [];
      let sum = 0;
      for (let i = 0; i <= exitAt; i++) {
        const g = 0.45 + Math.random() * 1.7;
        gaps.push(g);
        sum += g;
      }
      const emitAt = [];
      let acc = 0;
      gaps.forEach((g) => {
        acc += g;
        emitAt.push(acc / sum);
      });
      return { slot, exitAt, links, emitAt, shedMark: -1, hue: (slot * 23) % 360 };
    }

    function sideHue() { return side > 0 ? 136 : 354; }

    function bubbleGeom() {
      const x0 = M.x + M.w + SPACE;
      return {
        cx: x0 + BUBBLE_W * 0.5,
        cy: 0,
        rx: BUBBLE_W * 0.46,
        ry: M.h * 0.22,
      };
    }

    function erupt() {
      const hue = sideHue();
      panels.forEach((panel) => {
        const cell = cells[panel.slot];
        if (!cell) return;
        const share = Math.max(8, Math.round(110 / Math.max(1, panels.length)));
        const n = share + Math.floor(Math.random() * 6);
        for (let k = 0; k < n; k++) {
          const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.15;
          const sp = (260 + Math.random() * 420) * S;
          dots.push({
            mode: "burst",
            x: cell.x + cell.w * (0.12 + Math.random() * 0.76),
            y: cell.y + cell.h * (0.05 + Math.random() * 0.3),
            vx: Math.cos(ang) * sp * 0.45,
            vy: Math.sin(ang) * sp,
            hue,
            phase: Math.random() * Math.PI * 2,
            rad: Math.random() * 0.92,
            ang: Math.random() * Math.PI * 2,
            age: 0,
            leave: Math.random() * 0.45,
            cell: DOT,
          });
        }
      });
    }

    function roll() {
      pace();
      activeCount = 1 + Math.floor(Math.random() * 16);
      side = Math.random() > 0.48 ? 1 : -1;
      size = 0.22 + Math.random() * 0.78;
      panels = [];
      for (let i = 0; i < activeCount; i++) panels.push(makePanel(i));
      for (let i = dots.length - 1; i >= 0; i--) {
        const m = dots[i].mode;
        if (m === "burst" || m === "layer" || m === "into") dots.splice(i, 1);
      }
      delivered = false;
      pendingDrop = false;
      portrait = null;
    }

    for (let i = 0; i < 9; i++) {
      greys.push({
        u: Math.random(),
        dur: 52 + Math.random() * 46,
        size: 9 + Math.random() * 7,
        l: 62 + Math.random() * 14,
      });
    }

    function updateGreys(dt) {
      greyWait -= dt;
      if (greyWait <= 0 && greys.length < 24) {
        greys.push({
          u: 0,
          dur: 52 + Math.random() * 46,
          size: 9 + Math.random() * 7,
          l: 62 + Math.random() * 14,
        });
        greyWait = 1.8 + Math.random() * 3.4;
      }
      for (let i = greys.length - 1; i >= 0; i--) {
        greys[i].u += dt / greys[i].dur;
        if (greys[i].u >= 1) greys.splice(i, 1);
      }
    }

    function drawGreys() {
      greys.forEach((g) => {
        const p = returnPoint(g.u);
        px(p.x, p.y, `hsla(140 5% ${g.l}% / 0.8)`, g.size);
      });
    }

    function shed(panel, col) {
      const cell = cells[panel.slot];
      const pad = cell.w * 0.1;
      const step = (cell.w - pad * 2) / (N - 1);
      const x = cell.x + pad + step * col;
      const y0 = cell.y + cell.h * 0.14;
      const y1 = cell.y + cell.h * 0.8;
      const n = 1 + Math.floor(Math.random() * 4);
      for (let k = 0; k < n; k++) {
        dots.push({
          x: x + (Math.random() - 0.5) * 4,
          y: lerp(y0, y1, Math.random()),
          px: x,
          py: y0,
          vx: (Math.random() - 0.5) * 10 * S,
          vy: (6 + Math.random() * 14) * S,
          hue: (HUES[col] + panel.hue) % 360,
          phase: Math.random() * Math.PI * 2,
          freq: 0.9 + Math.random() * 1.6,
          sway: CELL * (0.01 + Math.random() * 0.025),
          mode: "inside",
          slot: panel.slot,
          cell: DOT,
        });
      }
      if (dots.length > 480) {
        const cut = dots.findIndex((p) => p.mode === "rest");
        if (cut >= 0) dots.splice(cut, 1);
      }
    }

    function dotRect(x, y, w, h, size, color) {
      const s = size;
      for (let i = 0; i <= w; i += s) {
        px(x + i, y, color, s);
        px(x + i, y + h, color, s);
      }
      for (let j = s; j < h; j += s) {
        px(x, y + j, color, s);
        px(x + w, y + j, color, s);
      }
    }

    function masterFrame() {
      const o = M.w * 0.018;
      dotRect(M.x - o, M.y - o, M.w + o * 2, M.h + o * 2, DOT, "hsla(150 22% 22% / 0.72)");
      ctx.lineWidth = 1.05 / Math.max(0.0001, viewZ);
      cells.forEach((cell) => {
        ctx.strokeStyle = "hsla(160 28% 28% / 0.75)";
        ctx.strokeRect(cell.x + 0.5, cell.y + 0.5, cell.w, cell.h);
      });
    }

    function colX(cell, i) {
      const pad = cell.w * 0.12;
      return cell.x + pad + ((cell.w - pad * 2) / (N - 1)) * i;
    }

    function linkHead(panel, link) {
      if (phase !== "fire") return 1;
      const i = link.from;
      const start = i <= 0 ? 0 : panel.emitAt[i - 1] || 0;
      const end = panel.emitAt[Math.min(i, panel.emitAt.length - 1)] || 1;
      return clamp((phaseT / fireDur - start) / Math.max(0.04, end - start), 0, 1);
    }

    function drawPanel(panel, hot) {
      const cell = cells[panel.slot];
      const y0 = cell.y + cell.h * 0.16;
      const y1 = cell.y + cell.h * 0.8;
      const ps = 13;
      panel.links.forEach((link) => {
        const head = linkHead(panel, link);
        const alpha = hot ? 0.9 : 0.18;
        const x0 = colX(cell, link.from);
        const x1 = colX(cell, link.to);
        const yy0 = lerp(y0, y1, link.y0);
        const yy1 = lerp(y0, y1, link.y1);
        const amp = Math.min(link.amp, cell.h * 0.12);
        for (let u = 0; u < head; u += 0.06) {
          const x = lerp(x0, x1, u);
          const y = lerp(yy0, yy1, u) + Math.sin(u * link.freq + link.phase - t * 2) * amp * (1 - u * 0.3);
          if (hash(panel.slot * 50 + link.from * 9 + Math.floor(u * 40)) > 0.2 + link.weight * 0.5) continue;
          const hue = (lerp(HUES[link.from], HUES[link.to], u) + panel.hue) % 360;
          px(x, y, hsl(hue, 72, 52, alpha), ps);
        }
      });
      for (let i = 0; i < N; i++) {
        const lit = hot && i <= panel.exitAt;
        const rows = Math.max(18, Math.floor((y1 - y0) / (ps * 1.7)));
        for (let r = 0; r < rows; r++) {
          if (!lit && r % 2) continue;
          px(colX(cell, i), y0 + r * ps * 1.65, lit ? hsl((HUES[i] + panel.hue) % 360, 76, 50) : "hsla(150 8% 74% / 0.8)", ps);
        }
      }
    }

    function feed() {
      const x0 = M.feedX;
      const x1 = M.feedX + M.feedW;
      const span = Math.max(40, x1 - x0);
      const y0 = M.y + M.h * 0.18;
      const y1 = M.y + M.h * 0.82;
      for (let row = 0; row < 14; row++) {
        const y = lerp(y0, y1, row / 13);
        for (let k = 0; k < 8; k++) {
          const x = x0 + ((k / 8) * span + t * (70 + row * 10) * S * 0.15) % span;
          if (hash(row * 13 + k + Math.floor(t * 5)) > 0.38) continue;
          px(x, y + Math.sin(t * 1.5 + k) * 6, hsl((168 + row * 16) % 360, 70, 50), DOT);
        }
      }
    }

    function trade() {
      const live = phase === "order";
      const hue = side > 0 ? 136 : 354;
      const cell = DOT + 4;
      const cols = (live ? 5 : 3) + Math.round(size * 8);
      const rows = (live ? 4 : 3) + Math.round(size * 3);
      const ox = M.tradeLeft;
      const oy = tradeY - (rows * cell) / 2;
      const alpha = live ? 1 : 0.3;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (!live && (c + r) % 3 === 0) continue;
          px(ox + c * cell, oy + r * cell, hsl(hue, live ? 80 : 16, 48 + hash(c + r) * 12, alpha), cell);
        }
      }
      if (!live) return;
      const len = 16 + size * 48;
      for (let k = 0; k < 6 + size * 10; k++) {
        const u = (hash(k + 2) + t * 0.35) % 1;
        px(ox + cols * cell + u * len, tradeY + (hash(k + 5) - 0.5) * rows * cell * 0.6, hsl(hue, 80, 54, 1 - u), Math.max(4, cell * 0.55));
      }
    }

    function drawBubble() {
      const b = bubbleGeom();
      const hue = sideHue();
      const live = phase !== "flow";
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2 + t * 0.4;
        px(b.cx + Math.cos(a) * b.rx, b.cy + Math.sin(a) * b.ry, hsl(hue, live ? 55 : 12, live ? 48 : 70, live ? 0.55 : 0.25), DOT * 0.7);
      }
    }

    function updateDots(dt) {
      const fy = floorY();
      const feedMid = M.y + M.h * 0.5;
      const feedX = M.feedX + 8;
      if (!broom) {
        sweepClock += dt;
        if (sweepClock >= sweepWait && dots.some((p) => p.mode === "rest")) {
          broom = M.tradeLeft + TRADE_W;
          sweepClock = 0;
          sweepWait = 40 + Math.random() * 22;
        }
      } else {
        broom -= dt * (M.w + SPACE * 2 + BUBBLE_W) * 0.45;
        if (broom < -40) broom = null;
      }
      for (let n = dots.length - 1; n >= 0; n--) {
        const p = dots[n];
        p.px = p.x;
        p.py = p.y;
        if (p.mode === "burst") {
          p.age += dt;
          const b = bubbleGeom();
          const above = p.y < M.y - 6;
          if (!above) {
            p.vy += 520 * S * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
          } else {
            p.x += (b.cx - p.x) * Math.min(1, dt * 10);
            p.y += (b.cy - p.y) * Math.min(1, dt * 10);
          }
          const nx = (p.x - b.cx) / Math.max(8, b.rx);
          const ny = (p.y - b.cy) / Math.max(8, b.ry);
          if ((above && nx * nx + ny * ny < 1.1) || p.age > 0.85) {
            p.mode = "layer";
            p.ang = Math.atan2(p.y - b.cy, p.x - b.cx);
          }
        } else if (p.mode === "layer") {
          const b = bubbleGeom();
          const tx = b.cx + Math.cos(p.ang) * b.rx * p.rad;
          const ty = b.cy + Math.sin(p.ang) * b.ry * p.rad;
          p.x += (tx - p.x) * Math.min(1, dt * 16);
          p.y += (ty - p.y) * Math.min(1, dt * 16);
          if (phase === "order" && phaseT > p.leave) p.mode = "into";
        } else if (p.mode === "into") {
          const tx = M.tradeLeft + 6;
          const ty = tradeY + (hash(Math.floor(p.ang * 9 + 3)) - 0.5) * 80;
          p.x += (tx - p.x) * Math.min(1, dt * 4.5);
          p.y += (ty - p.y) * Math.min(1, dt * 4.5);
          if (p.x >= M.tradeLeft - 2) {
            if (!delivered) {
              delivered = true;
              portrait = { age: 0, dur: 1.05, seed: (Math.random() * 1e9) | 0 };
            }
            dots.splice(n, 1);
          }
        } else if (p.mode === "drop") {
          p.vy = Math.min(80 * S, p.vy + 32 * S * dt);
          p.x += Math.sin(t * p.freq + p.phase) * (p.sway + 8) * dt + p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.99;
          if (p.y >= fy) {
            p.y = fy - hash(n + 4) * 18;
            p.vy = 0;
            p.mode = "rest";
          }
        } else if (p.mode === "inside") {
          const cell = cells[p.slot];
          p.vy = Math.min(48 * S, p.vy + 22 * S * dt);
          p.x += Math.sin(t * p.freq + p.phase) * p.sway * dt;
          p.y += p.vy * dt;
          p.x = clamp(p.x, cell.x + 2, cell.x + cell.w - 2);
          if (p.y >= cell.y + cell.h - 2) {
            p.mode = "plinko";
            p.y = cell.y + cell.h + 3;
            p.vx = (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 90) * S;
            p.vy = (18 + Math.random() * 24) * S;
          }
        } else if (p.mode === "plinko") {
          p.vy = Math.min(240 * S, p.vy + 150 * S * dt);
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          const L = M.x + 3;
          const R = M.x + M.w - 3;
          if (p.x < L) { p.x = L; p.vx = Math.abs(p.vx) * 0.8; }
          if (p.x > R) { p.x = R; p.vx = -Math.abs(p.vx) * 0.8; }
          for (let i = 0; i < hLines.length; i++) {
            const line = hLines[i];
            if (p.py < line && p.y >= line) {
              p.y = line + 2;
              p.vx = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 120) * S;
              p.vy *= 0.45 + Math.random() * 0.2;
            }
          }
          for (let i = 0; i < vLines.length; i++) {
            const line = vLines[i];
            if ((p.px - line) * (p.x - line) < 0) {
              p.vx = -p.vx * 0.75;
              p.x = line + Math.sign(p.vx || 1) * 2;
            }
          }
          if (p.y > M.y + M.h) {
            p.mode = "fall";
            p.vy = Math.max(14 * S, p.vy * 0.35);
          }
        } else if (p.mode === "fall") {
          p.vy = Math.min(80 * S, p.vy + 32 * S * dt);
          p.x += Math.sin(t * p.freq + p.phase) * (p.sway + 8) * dt + p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.99;
          if (p.y >= fy) {
            p.y = fy - hash(n + 4) * 18;
            p.vy = 0;
            p.mode = "rest";
          }
        } else if (p.mode === "rest") {
          p.x += Math.sin(t * 0.4 + p.phase) * 2 * dt;
          if (!p.major && broom != null && p.x > broom - 4) {
            p.mode = "shovel";
            p.vx = -CELL * 2.4;
            p.vy = (-16 - Math.random() * 28) * S;
          }
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 20 * S * dt;
          if (p.x < M.x) p.y += (feedMid - p.y) * Math.min(1, dt * 1.5);
          if (p.y > fy) p.y = fy;
          if (p.x < feedX - 10) dots.splice(n, 1);
        }
      }
    }

    function takeDrop() {
      if (!pendingDrop) return null;
      pendingDrop = false;
      return {
        x: M.tradeLeft + TRADE_W * 0.4,
        y: tradeY,
        hue: sideHue(),
      };
    }

    function drawDots() {
      dots.forEach((p) => px(p.x, p.y, hsl(p.hue, 70, 52, p.mode === "rest" ? 0.9 : 1), p.cell));
      if (broom == null) return;
      const fy = floorY();
      for (let i = 0; i < 6; i++) px(broom + i * 3, fy - i * 6, "hsla(150 12% 32% / 0.85)", 5);
    }

    function update(dt) {
      t += dt;
      phaseT += dt;
      if (portrait) {
        portrait.age += dt;
        if (portrait.age >= portrait.dur) {
          pendingDrop = true;
          portrait = null;
        }
      }
      updateDots(dt);
      updateGreys(dt);
      if (phase === "fire") {
        panels.forEach((panel) => {
          while (panel.shedMark < panel.exitAt && phaseT / fireDur >= panel.emitAt[panel.shedMark + 1]) {
            panel.shedMark += 1;
            shed(panel, panel.shedMark);
          }
        });
      }
      if (phase === "flow" && phaseT > flowDur) {
        phase = "fire";
        phaseT = 0;
        panels.forEach((p) => { p.shedMark = -1; });
        erupt();
      } else if (phase === "fire" && phaseT > fireDur) {
        phase = "order";
        phaseT = 0;
      } else if (phase === "order" && phaseT > orderDur && !portrait) {
        phase = "flow";
        phaseT = 0;
        roll();
      }
    }

    function draw(c, zoom) {
      ctx = c;
      viewZ = zoom;
      feed();
      masterFrame();
      const hot = phase !== "flow";
      panels.forEach((panel) => drawPanel(panel, hot));
      drawBubble();
      drawDots();
      trade();
      drawGreys();
    }

    function poke() {
      roll();
      phase = "fire";
      phaseT = 0;
      erupt();
    }

    function drawMajor(c, zoom, size) {
      ctx = c;
      viewZ = zoom;
      const s = size || DOT;
      dots.forEach((p) => {
        if (!p.major) return;
        px(p.x, p.y, hsl(p.hue, 70, 52, p.mode === "rest" ? 0.9 : 1), s);
      });
    }

    roll();
    return {
      update, draw, drawMajor, takeDrop, poke,
      get side() { return side; },
      get size() { return size; },
      get portrait() { return portrait ? portrait.age / portrait.dur : 0; },
      get portraitOn() { return !!portrait; },
      get portraitSeed() { return portrait ? portrait.seed : 0; },
    };
  };
})(window);
