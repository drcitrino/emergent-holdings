(function initCensus() {
  const KEY = "emergent_census_v4";
  const CYCLE_MS = 5 * 60 * 1000;
  const FLIP_MS = 900;
  const BROWN = "#8B5A2B";
  const PX = 5;
  const MAP = [
    "#############",
    "#TTTTTTTTTTT#",
    ".#TTTTTTTTT#.",
    "..#TTTTTTT#..",
    "...#TTTTT#...",
    "....#TTT#....",
    ".....#T#.....",
    "......#......",
    ".....#B#.....",
    "....#BBB#....",
    "...#BBBBB#...",
    "..#BBBBBBB#..",
    ".#BBBBBBBBB#.",
    "#BBBBBBBBBBB#",
    "#############",
  ];
  const topCells = [];
  const botCells = [];
  const frameCells = [];
  let neck = { x: 6, y: 7 };
  MAP.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === "#" || ch === "F") frameCells.push({ x, y });
      else if (ch === "T") topCells.push({ x, y });
      else if (ch === "B") botCells.push({ x, y });
      else if (ch === "N") neck = { x, y };
    }
  });
  topCells.sort((a, b) => a.y - b.y || a.x - b.x);
  botCells.sort((a, b) => b.y - a.y || a.x - b.x);

  const root = document.getElementById("census");
  if (!root) return;
  const sand = document.getElementById("sand");
  const sctx = sand ? sand.getContext("2d", { alpha: true }) : null;
  if (sand) {
    sand.width = MAP[0].length * PX;
    sand.height = MAP.length * PX;
  }

  function read() {
    try {
      const c = JSON.parse(sessionStorage.getItem(KEY) || "null");
      if (c && c.spawned >= c.retired) {
        const active = c.spawned - c.retired;
        if (active >= 80 && active <= 320) {
          if (!c.cycleStart) c.cycleStart = Date.now();
          return c;
        }
      }
    } catch (e) {}
    const active = 188 + Math.floor(Math.random() * 25);
    const retired = 3600 + Math.floor(Math.random() * 81);
    return { spawned: active + retired, retired, cycleStart: Date.now() };
  }

  let census = read();
  let flipping = null;
  sessionStorage.setItem(KEY, JSON.stringify(census));

  function pad(n) {
    return String(Math.max(0, n)).padStart(6, "0");
  }

  function save() {
    sessionStorage.setItem(KEY, JSON.stringify(census));
  }

  function paintNumbers() {
    const spawn = root.querySelector("[data-spawn]");
    const retire = root.querySelector("[data-retire]");
    const total = root.querySelector("[data-total]");
    if (spawn) spawn.textContent = pad(census.spawned);
    if (retire) retire.textContent = pad(census.retired);
    if (total) total.textContent = pad(census.spawned + census.retired);
  }

  function advance() {
    const active = Math.max(0, census.spawned - census.retired);
    const dRetire = Math.min(active, Math.floor(Math.random() * 21));
    const dSpawn = 1 + Math.floor(Math.random() * 20);
    census.retired += dRetire;
    census.spawned += dSpawn;
  }

  function dot(x, y) {
    sctx.fillRect(x * PX, y * PX, PX - 1, PX - 1);
  }

  function paintClock() {
    if (!sctx) return;
    const now = Date.now();
    let u = 0;
    let rot = 0;
    if (flipping) {
      u = 1;
      rot = Math.min(1, (now - flipping) / FLIP_MS) * 180;
    } else {
      u = Math.max(0, Math.min(1, (now - census.cycleStart) / CYCLE_MS));
    }
    sctx.clearRect(0, 0, sand.width, sand.height);
    sctx.fillStyle = BROWN;
    const trickle = u > 0 && u < 1 && Math.floor(now / 140) % 2 === 0;
    frameCells.forEach((p) => {
      if (trickle && neck && p.x === neck.x && p.y === neck.y) return;
      dot(p.x, p.y);
    });
    const fallen = Math.floor(u * topCells.length);
    for (let i = fallen; i < topCells.length; i++) dot(topCells[i].x, topCells[i].y);
    for (let i = 0; i < fallen && i < botCells.length; i++) dot(botCells[i].x, botCells[i].y);
    if (trickle && neck) dot(neck.x, neck.y - 1);
    sand.style.transform = "rotate(" + rot.toFixed(2) + "deg)";
  }

  function tick() {
    const now = Date.now();
    if (flipping) {
      if (now - flipping >= FLIP_MS) {
        flipping = null;
        census.cycleStart = now;
        save();
      }
    } else if (now - census.cycleStart >= CYCLE_MS) {
      advance();
      paintNumbers();
      save();
      flipping = now;
      if (window.onEmergentCensus) window.onEmergentCensus(census);
    }
    paintClock();
    return census;
  }

  paintNumbers();
  paintClock();
  window.EmergentCensus = {
    tick,
    get: () => census,
    active: () => census.spawned - census.retired,
    cycleMs: CYCLE_MS,
  };
})();
