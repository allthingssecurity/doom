const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const panel = document.getElementById("panel");
const startBtn = document.getElementById("start-btn");
const panelTitle = panel.querySelector("h1");
const panelLines = Array.from(panel.querySelectorAll("p"));

const MAP = [
  "1111111111111111",
  "1000000000010001",
  "1011110111010101",
  "1000010000010001",
  "1011010111111101",
  "1001010000000001",
  "1101011111110101",
  "1001000000010101",
  "1011111101010101",
  "1000000101010001",
  "1111010101011101",
  "1000010001000001",
  "1011111101111101",
  "1000000000000001",
  "1000111111110001",
  "1111111111111111",
];

const state = {
  mode: "menu",
  level: 1,
  player: { x: 1.5, y: 1.5, angle: 0, hp: 100, score: 0 },
  keys: new Set(),
  mouseDeltaX: 0,
  enemies: [],
  projectiles: [],
  enemyProjectiles: [],
  rays: [],
  lastTs: 0,
  flashTimer: 0,
  hurtTimer: 0,
  gunKick: 0,
  enemySpritesReady: false,
  gunSpriteReady: false,
  enemiesAlive: 0,
  gameTime: 0,
};

const PHYSICS = {
  playerRadius: 0.2,
  enemyRadius: 0.28,
  corpseRadius: 0.24,
  stepSize: 0.06,
};

const MENU_PANEL_LINES = [
  "Doom-like 2.5D, cyberpunk arena.",
  "Move: WASD / Arrows | Turn: Mouse or Q/E | Shoot: Click / Space",
  "Fullscreen: F | Restart Campaign: R",
];

const LEVEL_SPAWNS = [
  { x: 3.6, y: 1.5, type: 0 },
  { x: 5.3, y: 1.8, type: 1 },
  { x: 6.8, y: 2.1, type: 0 },
  { x: 8.2, y: 1.7, type: 1 },
  { x: 9.5, y: 12.5, type: 0 },
  { x: 4.2, y: 9.6, type: 1 },
  { x: 13.5, y: 13.5, type: 0 },
  { x: 11.9, y: 11.1, type: 1 },
  { x: 2.6, y: 11.8, type: 0 },
  { x: 12.3, y: 3.5, type: 1 },
  { x: 7.5, y: 7.6, type: 0 },
  { x: 10.8, y: 8.9, type: 1 },
];

const LEVELS = [
  {
    name: "Sector 1",
    enemyCount: 4,
    hpMul: 0.95,
    speedMul: 0.95,
    cooldownMul: 1.05,
    projectileSpeed: 4.9,
    healOnStart: 0,
  },
  {
    name: "Sector 2",
    enemyCount: 6,
    hpMul: 1.12,
    speedMul: 1.06,
    cooldownMul: 0.92,
    projectileSpeed: 5.6,
    healOnStart: 12,
  },
  {
    name: "Sector 3",
    enemyCount: 8,
    hpMul: 1.32,
    speedMul: 1.18,
    cooldownMul: 0.8,
    projectileSpeed: 6.3,
    healOnStart: 8,
  },
  {
    name: "Sector 4",
    enemyCount: 10,
    hpMul: 1.56,
    speedMul: 1.3,
    cooldownMul: 0.7,
    projectileSpeed: 7.1,
    healOnStart: 6,
  },
];

const ENEMY_TYPES = [
  {
    code: "KEJ",
    portraitSrc: "./kej.jpeg",
    spriteSheetSrc: "./output/imagegen/kej_enemy_sheet.png",
    accent: "#34f6ff",
    speed: 0.92,
    shootCooldown: 1.85,
    spriteScale: 0.78,
    hp: 72,
  },
  {
    code: "PAPPU",
    portraitSrc: "./pappu.jpeg",
    spriteSheetSrc: "./output/imagegen/pappu_enemy_sheet.png",
    accent: "#ff3278",
    speed: 1.0,
    shootCooldown: 1.65,
    spriteScale: 0.74,
    hp: 62,
  },
];

const enemyPortraitImages = ENEMY_TYPES.map((entry) => {
  const img = new Image();
  img.src = entry.portraitSrc;
  return img;
});

const enemySheetImages = ENEMY_TYPES.map((entry) => {
  const img = new Image();
  img.src = entry.spriteSheetSrc;
  return img;
});

const enemySpriteSheets = [];
let gunSpriteSheet = null;
const audio = {
  ctx: null,
  master: null,
  noiseBuffer: null,
  ambience: null,
};

function buildEnemySpriteSheetFromGrid(img, cols = 4, rows = 2) {
  const srcW = Math.max(1, img.naturalWidth || img.width || 1);
  const srcH = Math.max(1, img.naturalHeight || img.height || 1);
  const frameW = Math.max(1, Math.floor(srcW / cols));
  const frameH = Math.max(1, Math.floor(srcH / rows));
  const frames = cols * rows;

  const out = document.createElement("canvas");
  out.width = frameW * frames;
  out.height = frameH;
  const c = out.getContext("2d");

  let frame = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      c.drawImage(
        img,
        col * frameW,
        row * frameH,
        frameW,
        frameH,
        frame * frameW,
        0,
        frameW,
        frameH
      );
      frame += 1;
    }
  }

  return { image: out, frameW, frameH, frames };
}

function buildGunSpriteSheet() {
  const frameW = 520;
  const frameH = 320;
  const frames = 4;
  const out = document.createElement("canvas");
  out.width = frameW * frames;
  out.height = frameH;
  const c = out.getContext("2d");

  for (let f = 0; f < frames; f++) {
    const ox = f * frameW;
    const recoil = f === 2 ? -15 : f === 3 ? -7 : Math.sin(f) * 2;
    const slide = f === 2 ? -9 : f === 3 ? -4 : 0;
    const muzzle = f === 2 ? 1 : 0;

    c.save();
    c.translate(ox, 0);
    c.clearRect(0, 0, frameW, frameH);
    const cx = frameW * 0.5;
    const by = frameH - 18 + recoil;

    c.shadowBlur = 18;
    c.shadowColor = "#2cefff";
    c.lineJoin = "round";
    c.lineCap = "round";
    c.lineWidth = 3;
    c.strokeStyle = "#2cefff";
    c.fillStyle = "#08122f";

    // Butt / base block.
    c.beginPath();
    c.moveTo(cx - 110, by);
    c.lineTo(cx - 84, by - 42);
    c.lineTo(cx + 84, by - 42);
    c.lineTo(cx + 110, by);
    c.lineTo(cx + 64, by + 6);
    c.lineTo(cx - 64, by + 6);
    c.closePath();
    c.fill();
    c.stroke();

    // Main body tapering toward the barrel.
    c.fillStyle = "#0d1b45";
    c.beginPath();
    c.moveTo(cx - 70, by - 42);
    c.lineTo(cx - 42, by - 112);
    c.lineTo(cx + 42, by - 112);
    c.lineTo(cx + 70, by - 42);
    c.lineTo(cx + 50, by + 4);
    c.lineTo(cx - 50, by + 4);
    c.closePath();
    c.fill();
    c.stroke();

    // Upper receiver and bolt.
    c.fillStyle = "#10275b";
    c.fillRect(cx - 32 + slide, by - 132, 64, 22);
    c.strokeRect(cx - 32 + slide, by - 132, 64, 22);

    // Barrel pointing forward (toward screen center).
    c.fillStyle = "#132f6f";
    c.fillRect(cx - 14, by - 196, 28, 84);
    c.strokeRect(cx - 14, by - 196, 28, 84);
    c.fillStyle = "#0d1a44";
    c.fillRect(cx - 20, by - 212, 40, 20);
    c.strokeRect(cx - 20, by - 212, 40, 20);

    // Side armor hints for depth.
    c.fillStyle = "#091634";
    c.beginPath();
    c.moveTo(cx - 92, by - 20);
    c.lineTo(cx - 120, by - 32);
    c.lineTo(cx - 120, by - 66);
    c.lineTo(cx - 90, by - 60);
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(cx + 92, by - 20);
    c.lineTo(cx + 120, by - 32);
    c.lineTo(cx + 120, by - 66);
    c.lineTo(cx + 90, by - 60);
    c.closePath();
    c.fill();
    c.stroke();

    // Front grip and magazine.
    c.beginPath();
    c.moveTo(cx + 30, by - 66);
    c.lineTo(cx + 64, by - 66);
    c.lineTo(cx + 54, by + 6);
    c.lineTo(cx + 34, by + 6);
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(cx - 62, by - 58);
    c.lineTo(cx - 28, by - 58);
    c.lineTo(cx - 36, by + 18);
    c.lineTo(cx - 58, by + 18);
    c.closePath();
    c.fill();
    c.stroke();

    // Sight and glow strip.
    c.fillStyle = "#ff2d90";
    c.fillRect(cx - 10, by - 152, 20, 16);
    c.fillStyle = "#2cefff";
    c.globalAlpha = 0.85;
    c.fillRect(cx - 58, by - 114, 116, 8);
    c.globalAlpha = 1;

    if (muzzle) {
      c.fillStyle = "#fff6b2";
      c.shadowColor = "#fff6b2";
      c.shadowBlur = 28;
      c.beginPath();
      c.moveTo(cx, by - 240);
      c.lineTo(cx - 22, by - 206);
      c.lineTo(cx + 22, by - 206);
      c.closePath();
      c.fill();

      c.fillStyle = "#ffc56c";
      c.beginPath();
      c.moveTo(cx, by - 230);
      c.lineTo(cx - 14, by - 208);
      c.lineTo(cx + 14, by - 208);
      c.closePath();
      c.fill();
    }
    c.restore();
  }
  return { image: out, frameW, frameH, frames };
}

function ensureAudio() {
  if (navigator.webdriver) return null;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;

  if (!audio.ctx) {
    try {
      audio.ctx = new AudioCtor();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.2;
      audio.master.connect(audio.ctx.destination);

      audio.noiseBuffer = audio.ctx.createBuffer(1, audio.ctx.sampleRate, audio.ctx.sampleRate);
      const data = audio.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const hum = audio.ctx.createOscillator();
      hum.type = "sine";
      hum.frequency.value = 42;
      const humGain = audio.ctx.createGain();
      humGain.gain.value = 0.0001;
      hum.connect(humGain);
      humGain.connect(audio.master);
      hum.start();
      humGain.gain.linearRampToValueAtTime(0.016, audio.ctx.currentTime + 1.2);
      audio.ambience = { hum, humGain };
    } catch {
      audio.ctx = null;
      audio.master = null;
      audio.noiseBuffer = null;
      audio.ambience = null;
      return null;
    }
  }

  if (audio.ctx?.state === "suspended") {
    audio.ctx.resume().catch(() => {});
  }
  return audio.ctx;
}

function playTone({ type = "square", freq = 220, freqEnd = 110, duration = 0.12, gain = 0.08 }) {
  const ctx = ensureAudio();
  if (!ctx || !audio.master) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(24, freqEnd), now + duration);
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(amp);
  amp.connect(audio.master);
  osc.start(now);
  osc.stop(now + duration + 0.03);
}

function playNoise({ duration = 0.08, gain = 0.04, highpass = 500 }) {
  const ctx = ensureAudio();
  if (!ctx || !audio.master || !audio.noiseBuffer) return;
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = audio.noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = highpass;

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  src.connect(filter);
  filter.connect(amp);
  amp.connect(audio.master);
  src.start(now);
  src.stop(now + duration + 0.03);
}

function playPlayerShotSound() {
  playTone({ type: "square", freq: 180, freqEnd: 80, duration: 0.11, gain: 0.095 });
  playNoise({ duration: 0.06, gain: 0.05, highpass: 900 });
}

function playEnemyShotSound(distance) {
  const nearFactor = Math.max(0, 1 - Math.min(1, distance / 11));
  playTone({
    type: "triangle",
    freq: 130 + nearFactor * 30,
    freqEnd: 90,
    duration: 0.1,
    gain: 0.05 + nearFactor * 0.02,
  });
  playNoise({ duration: 0.045, gain: 0.026 + nearFactor * 0.015, highpass: 1200 });
}

function playHitSound() {
  playTone({ type: "triangle", freq: 420, freqEnd: 180, duration: 0.07, gain: 0.05 });
}

function playDeathSound() {
  playTone({ type: "sawtooth", freq: 130, freqEnd: 45, duration: 0.2, gain: 0.07 });
  playNoise({ duration: 0.12, gain: 0.03, highpass: 260 });
}

function playHurtSound() {
  playTone({ type: "square", freq: 210, freqEnd: 115, duration: 0.09, gain: 0.05 });
}

function tryProcessSprites() {
  if (!enemySheetImages[0].complete || !enemySheetImages[1].complete) return;
  if (enemySpriteSheets.length === 2 && gunSpriteSheet) return;
  enemySpriteSheets[0] = buildEnemySpriteSheetFromGrid(enemySheetImages[0], 4, 2);
  enemySpriteSheets[1] = buildEnemySpriteSheetFromGrid(enemySheetImages[1], 4, 2);
  gunSpriteSheet = buildGunSpriteSheet();
  state.enemySpritesReady = true;
  state.gunSpriteReady = true;
}

enemySheetImages.forEach((img) => {
  img.onload = tryProcessSprites;
  img.onerror = tryProcessSprites;
});
tryProcessSprites();

function getLevelConfig(level = state.level) {
  const clamped = Math.max(1, Math.min(LEVELS.length, level));
  return LEVELS[clamped - 1];
}

function setPanelContent(title, lines, buttonLabel) {
  panelTitle.textContent = title;
  for (let i = 0; i < panelLines.length; i++) {
    const text = lines[i] || "";
    panelLines[i].textContent = text;
    panelLines[i].style.display = text ? "" : "none";
  }
  startBtn.textContent = buttonLabel;
}

function showMissionFailedPanel() {
  setPanelContent(
    "MISSION FAILED",
    [
      `You were eliminated in ${getLevelConfig(state.level).name}.`,
      `Score ${state.player.score} | Reached level ${state.level}/${LEVELS.length}`,
      "Press button or R to restart campaign.",
    ],
    "Restart Campaign"
  );
  panel.classList.remove("hidden");
}

function showLevelClearedPanel() {
  const nextLevel = Math.min(LEVELS.length, state.level + 1);
  const nextCfg = getLevelConfig(nextLevel);
  setPanelContent(
    `${getLevelConfig(state.level).name.toUpperCase()} CLEARED`,
    [
      `HP ${state.player.hp} | SCORE ${state.player.score}`,
      `Next: ${nextCfg.name} (${nextLevel}/${LEVELS.length})`,
      `${nextCfg.enemyCount} hostiles, faster movement and heavier fire.`,
    ],
    "Start Next Level"
  );
  panel.classList.remove("hidden");
}

function showCampaignWonPanel() {
  setPanelContent(
    "ALL DISTRICTS CLEARED",
    [
      `Final score ${state.player.score} | HP ${state.player.hp}`,
      `Completed ${LEVELS.length}/${LEVELS.length} levels.`,
      "Press button or R to run campaign again.",
    ],
    "Restart Campaign"
  );
  panel.classList.remove("hidden");
}

function buildEnemiesForLevel(level) {
  const cfg = getLevelConfig(level);
  const enemies = [];
  for (let i = 0; i < cfg.enemyCount; i++) {
    const spawn = LEVEL_SPAWNS[(i + (level - 1) * 2) % LEVEL_SPAWNS.length];
    const type = (i + level) % ENEMY_TYPES.length;
    const kind = ENEMY_TYPES[type];
    const hpBase = kind.hp + Math.floor(i / 2) * 8;
    const maxHp = Math.max(30, Math.round(hpBase * cfg.hpMul));
    enemies.push({
      x: spawn.x,
      y: spawn.y,
      hp: maxHp,
      maxHp,
      type,
      cooldown: 0.55 + (i % 4) * 0.22,
      bob: i * 0.7,
      walkCycle: i * 0.9,
      attackTimer: 0,
      deathTimer: 0,
      vx: 0,
      vy: 0,
      speed: kind.speed * cfg.speedMul * (1 + (i % 3) * 0.03),
      shootCooldown: Math.max(0.55, kind.shootCooldown * cfg.cooldownMul * (1 - (i % 3) * 0.03)),
      projectileSpeed: cfg.projectileSpeed + (i % 2) * 0.35,
    });
  }
  for (const e of enemies) {
    snapEntityToOpenSpace(e, PHYSICS.enemyRadius);
    resolveCircleAgainstWalls(e, PHYSICS.enemyRadius);
  }
  return enemies;
}

function loadLevel(level, { freshCampaign = false } = {}) {
  state.level = Math.max(1, Math.min(LEVELS.length, level));
  const cfg = getLevelConfig(state.level);

  state.player.x = 1.5;
  state.player.y = 1.5;
  state.player.angle = 0;
  if (freshCampaign) {
    state.player.hp = 100;
    state.player.score = 0;
  } else {
    state.player.hp = Math.min(100, state.player.hp + cfg.healOnStart);
  }
  state.projectiles = [];
  state.enemyProjectiles = [];
  state.flashTimer = 0;
  state.hurtTimer = 0;
  state.gunKick = 0;
  state.enemies = buildEnemiesForLevel(state.level);
  state.enemiesAlive = state.enemies.length;
  state.gameTime = 0;
}

function startCampaign() {
  loadLevel(1, { freshCampaign: true });
}
startCampaign();
setPanelContent("NEON DOOM RUNNER", MENU_PANEL_LINES, "Start Mission");

function isWall(x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cy >= MAP.length || cx >= MAP[0].length) return true;
  return MAP[cy][cx] === "1";
}

function normalizeAngle(a) {
  while (a < -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}

function canOccupyCircle(x, y, radius) {
  const probes = [
    [0, 0],
    [radius, 0],
    [-radius, 0],
    [0, radius],
    [0, -radius],
    [radius * 0.707, radius * 0.707],
    [-radius * 0.707, radius * 0.707],
    [radius * 0.707, -radius * 0.707],
    [-radius * 0.707, -radius * 0.707],
  ];
  for (const [ox, oy] of probes) {
    if (isWall(x + ox, y + oy)) return false;
  }
  return true;
}

function resolveCircleAgainstWalls(entity, radius) {
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    const minTileX = Math.floor(entity.x - radius) - 1;
    const maxTileX = Math.floor(entity.x + radius) + 1;
    const minTileY = Math.floor(entity.y - radius) - 1;
    const maxTileY = Math.floor(entity.y + radius) + 1;

    for (let ty = minTileY; ty <= maxTileY; ty++) {
      for (let tx = minTileX; tx <= maxTileX; tx++) {
        if (tx < 0 || ty < 0 || ty >= MAP.length || tx >= MAP[0].length) continue;
        if (MAP[ty][tx] !== "1") continue;

        const nearestX = Math.max(tx, Math.min(entity.x, tx + 1));
        const nearestY = Math.max(ty, Math.min(entity.y, ty + 1));
        let dx = entity.x - nearestX;
        let dy = entity.y - nearestY;
        let distSq = dx * dx + dy * dy;

        if (distSq >= radius * radius) continue;

        let dist = Math.sqrt(distSq);
        if (dist < 1e-6) {
          dx = entity.x - (tx + 0.5);
          dy = entity.y - (ty + 0.5);
          dist = Math.hypot(dx, dy);
          if (dist < 1e-6) {
            dx = 1;
            dy = 0;
            dist = 1;
          }
        }

        const overlap = radius - dist + 0.001;
        entity.x += (dx / dist) * overlap;
        entity.y += (dy / dist) * overlap;
        moved = true;
      }
    }
    if (!moved) break;
  }
}

function snapEntityToOpenSpace(entity, radius) {
  if (canOccupyCircle(entity.x, entity.y, radius)) return;
  const originX = entity.x;
  const originY = entity.y;
  const ringStep = 0.08;
  const maxRadius = 1.8;

  for (let r = ringStep; r <= maxRadius; r += ringStep) {
    const samples = Math.max(8, Math.ceil((Math.PI * 2 * r) / 0.12));
    for (let i = 0; i < samples; i++) {
      const a = (i / samples) * Math.PI * 2;
      const tx = originX + Math.cos(a) * r;
      const ty = originY + Math.sin(a) * r;
      if (!canOccupyCircle(tx, ty, radius)) continue;
      entity.x = tx;
      entity.y = ty;
      return;
    }
  }

  resolveCircleAgainstWalls(entity, radius);
}

function moveCircleWithCollision(entity, vx, vy, dt, radius) {
  const travel = Math.hypot(vx, vy) * dt;
  const steps = Math.max(1, Math.ceil(travel / PHYSICS.stepSize));
  let stepX = (vx * dt) / steps;
  let stepY = (vy * dt) / steps;
  let outVx = vx;
  let outVy = vy;

  for (let i = 0; i < steps; i++) {
    if (stepX !== 0) {
      const tx = entity.x + stepX;
      if (canOccupyCircle(tx, entity.y, radius)) {
        entity.x = tx;
      } else {
        stepX = 0;
        outVx = 0;
      }
    }

    if (stepY !== 0) {
      const ty = entity.y + stepY;
      if (canOccupyCircle(entity.x, ty, radius)) {
        entity.y = ty;
      } else {
        stepY = 0;
        outVy = 0;
      }
    }
  }

  return { vx: outVx, vy: outVy };
}

function hasLineOfSight(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 0.08));

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + dx * t;
    const y = ay + dy * t;
    if (isWall(x, y)) return false;
  }
  return true;
}

function castRays() {
  const rays = [];
  const rayCount = Math.floor(canvas.width / 2);
  const fov = Math.PI / 3;
  for (let i = 0; i < rayCount; i++) {
    const t = i / (rayCount - 1);
    const angle = state.player.angle - fov / 2 + t * fov;
    let dist = 0.0;
    let hit = false;
    let hitX = 0;
    let hitY = 0;
    while (!hit && dist < 20) {
      dist += 0.03;
      const x = state.player.x + Math.cos(angle) * dist;
      const y = state.player.y + Math.sin(angle) * dist;
      if (isWall(x, y)) {
        hit = true;
        hitX = x;
        hitY = y;
      }
    }
    const shade = 1 / (1 + dist * 0.25);
    rays.push({ angle, dist, shade, hitX, hitY });
  }
  state.rays = rays;
}

function movePlayer(dt) {
  const moveSpeed = 2.8;
  const rotSpeed = 2.2;
  let forward = 0;
  let strafe = 0;
  let turn = 0;

  if (state.keys.has("KeyW") || state.keys.has("ArrowUp")) forward += 1;
  if (state.keys.has("KeyS") || state.keys.has("ArrowDown")) forward -= 1;
  if (state.keys.has("KeyA")) strafe -= 1;
  if (state.keys.has("KeyD")) strafe += 1;
  if (state.keys.has("ArrowLeft") || state.keys.has("KeyQ")) turn -= 1;
  if (state.keys.has("ArrowRight") || state.keys.has("KeyE")) turn += 1;

  state.player.angle = normalizeAngle(state.player.angle + turn * rotSpeed * dt + state.mouseDeltaX * 0.0024);
  state.mouseDeltaX = 0;

  const vx = Math.cos(state.player.angle) * forward + Math.cos(state.player.angle + Math.PI / 2) * strafe;
  const vy = Math.sin(state.player.angle) * forward + Math.sin(state.player.angle + Math.PI / 2) * strafe;
  const len = Math.hypot(vx, vy) || 1;
  const nx = vx / len;
  const ny = vy / len;

  const nextX = state.player.x + nx * moveSpeed * dt;
  const nextY = state.player.y + ny * moveSpeed * dt;

  if (canOccupyCircle(nextX, state.player.y, PHYSICS.playerRadius)) state.player.x = nextX;
  if (canOccupyCircle(state.player.x, nextY, PHYSICS.playerRadius)) state.player.y = nextY;
  resolveCircleAgainstWalls(state.player, PHYSICS.playerRadius);
}

function shoot() {
  if (state.mode !== "playing") return;
  state.flashTimer = 0.08;
  state.gunKick = 1;
  playPlayerShotSound();
  state.projectiles.push({
    x: state.player.x,
    y: state.player.y,
    vx: Math.cos(state.player.angle) * 12,
    vy: Math.sin(state.player.angle) * 12,
    ttl: 1.2,
  });
}

function updateProjectiles(dt) {
  for (const p of state.projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.ttl -= dt;
    if (isWall(p.x, p.y)) p.ttl = 0;
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) < 0.5) {
        e.hp -= 35;
        playHitSound();
        p.ttl = 0;
        if (e.hp <= 0) {
          e.hp = 0;
          e.attackTimer = 0;
          e.deathTimer = 0.42;
          e.vx = 0;
          e.vy = 0;
          snapEntityToOpenSpace(e, PHYSICS.corpseRadius);
          resolveCircleAgainstWalls(e, PHYSICS.corpseRadius);
          playDeathSound();
          state.player.score += 100;
        }
      }
    }
  }
  state.projectiles = state.projectiles.filter((p) => p.ttl > 0);

  for (const p of state.enemyProjectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.ttl -= dt;
    if (isWall(p.x, p.y)) p.ttl = 0;
    if (Math.hypot(state.player.x - p.x, state.player.y - p.y) < 0.33) {
      p.ttl = 0;
      state.player.hp -= 8;
      state.hurtTimer = 0.22;
      playHurtSound();
      if (state.player.hp <= 0) {
        state.player.hp = 0;
        state.mode = "dead";
        showMissionFailedPanel();
      }
    }
  }
  state.enemyProjectiles = state.enemyProjectiles.filter((p) => p.ttl > 0);
}

function updateEnemies(dt) {
  const kept = [];
  let aliveCount = 0;
  const holdDistance = 2.65;
  const aggroDistance = 10.4;
  for (const e of state.enemies) {
    if (e.hp <= 0) {
      e.deathTimer -= dt;
      e.vx = 0;
      e.vy = 0;
      resolveCircleAgainstWalls(e, PHYSICS.corpseRadius);
      if (!canOccupyCircle(e.x, e.y, PHYSICS.corpseRadius)) {
        snapEntityToOpenSpace(e, PHYSICS.corpseRadius);
      }
      kept.push(e);
      continue;
    }

    aliveCount += 1;
    const kind = ENEMY_TYPES[e.type];
    const dx = state.player.x - e.x;
    const dy = state.player.y - e.y;
    const dist = Math.hypot(dx, dy);
    const dirX = dx / (dist || 1);
    const dirY = dy / (dist || 1);
    const los = hasLineOfSight(e.x, e.y, state.player.x, state.player.y);

    e.vx = e.vx || 0;
    e.vy = e.vy || 0;
    const maxSpeed = e.speed || kind.speed;

    let targetVx = 0;
    let targetVy = 0;
    if (dist > holdDistance && dist < aggroDistance) {
      const chase = los ? 1 : 0.72;
      targetVx = dirX * maxSpeed * chase;
      targetVy = dirY * maxSpeed * chase;
    }

    const accel = Math.min(1, dt * 6.2);
    e.vx += (targetVx - e.vx) * accel;
    e.vy += (targetVy - e.vy) * accel;

    const velMag = Math.hypot(e.vx, e.vy);
    if (velMag > maxSpeed) {
      e.vx = (e.vx / velMag) * maxSpeed;
      e.vy = (e.vy / velMag) * maxSpeed;
    }

    const moved = moveCircleWithCollision(e, e.vx, e.vy, dt, PHYSICS.enemyRadius);
    e.vx = moved.vx;
    e.vy = moved.vy;
    resolveCircleAgainstWalls(e, PHYSICS.enemyRadius);

    e.cooldown -= dt;
    e.attackTimer = Math.max(0, e.attackTimer - dt);
    const speed = Math.hypot(e.vx, e.vy);
    e.walkCycle += dt * (speed * 4.8 + 1.1);
    e.bob += dt * (speed * 3.7 + 1.1);

    if (los && dist < aggroDistance && e.cooldown <= 0) {
      const shotSpeed = e.projectileSpeed || 5;
      e.cooldown = (e.shootCooldown || kind.shootCooldown) + Math.random() * 0.45;
      e.attackTimer = 0.2;
      state.enemyProjectiles.push({
        x: e.x,
        y: e.y,
        vx: dirX * shotSpeed,
        vy: dirY * shotSpeed,
        ttl: 3,
      });
      playEnemyShotSound(dist);
    }
    kept.push(e);
  }
  state.enemies = kept;
  state.enemiesAlive = aliveCount;
  if (aliveCount === 0 && state.mode === "playing") {
    if (state.level < LEVELS.length) {
      state.mode = "level_cleared";
      showLevelClearedPanel();
    } else {
      state.mode = "won";
      showCampaignWonPanel();
    }
  }
}

function drawBackground() {
  const w = canvas.width;
  const h = canvas.height;

  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  sky.addColorStop(0, "#2a0e46");
  sky.addColorStop(0.35, "#111537");
  sky.addColorStop(1, "#0a1024");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.55);

  const floor = ctx.createLinearGradient(0, h * 0.55, 0, h);
  floor.addColorStop(0, "#070a13");
  floor.addColorStop(1, "#020309");
  ctx.fillStyle = floor;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);

  for (let i = 0; i < 26; i++) {
    const y = h * 0.55 + i * 15;
    ctx.strokeStyle = i % 3 === 0 ? "#11e8ff2f" : "#ff2a9230";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function drawWalls() {
  const w = canvas.width;
  const h = canvas.height;
  const rayCount = state.rays.length;
  for (let i = 0; i < rayCount; i++) {
    const ray = state.rays[i];
    const corrected = ray.dist * Math.cos(ray.angle - state.player.angle);
    const wallHeight = Math.min(h, (h / Math.max(0.001, corrected)) * 1.3);
    const x = (i / rayCount) * w;
    const colW = w / rayCount + 1;
    const y = h / 2 - wallHeight / 2;

    const pulse = 0.5 + 0.5 * Math.sin(ray.hitX * 8 + ray.hitY * 4);
    const stripe = i % 8 < 4 ? 1 : 0.7;
    const r = Math.floor((60 + pulse * 90) * ray.shade * stripe);
    const g = Math.floor((30 + pulse * 35) * ray.shade * stripe);
    const b = Math.floor((120 + pulse * 110) * ray.shade * stripe);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, y, colW, wallHeight);

    ctx.fillStyle = `rgba(0, 0, 0, ${0.24 * (1 - ray.shade)})`;
    ctx.fillRect(x, y, colW, wallHeight);
    ctx.fillStyle = `rgba(255, 40, 130, ${0.18 * ray.shade})`;
    ctx.fillRect(x, y + wallHeight * 0.15, colW, wallHeight * 0.05);
  }
}

function drawSprites() {
  const list = [];
  for (const e of state.enemies) {
    const dx = e.x - state.player.x;
    const dy = e.y - state.player.y;
    const dist = Math.hypot(dx, dy);
    const ang = normalizeAngle(Math.atan2(dy, dx) - state.player.angle);
    const fov = Math.PI / 3;
    if (Math.abs(ang) > fov * 0.7) continue;
    list.push({ e, dist, ang });
  }
  list.sort((a, b) => b.dist - a.dist);

  for (const item of list) {
    const { e, dist, ang } = item;
    const w = canvas.width;
    const h = canvas.height;
    const kind = ENEMY_TYPES[e.type];
    const screenX = (0.5 + ang / (Math.PI / 3)) * w;
    const sheet = enemySpriteSheets[e.type];
    const perspective = h / Math.max(0.001, dist);
    const drawW = Math.min(h * 0.42, perspective * kind.spriteScale);
    const drawH = sheet ? drawW * (sheet.frameH / sheet.frameW) : drawW * 1.32;
    const yBob = Math.sin(e.bob) * 1.8 * (e.hp > 0 ? 1 : 0);
    const floorY = h * 0.8 + yBob;
    const x = screenX - drawW * 0.5;
    const y = floorY - drawH;

    const rayIndex = Math.max(0, Math.min(state.rays.length - 1, Math.floor((screenX / w) * state.rays.length)));
    const wallDist = state.rays[rayIndex]?.dist ?? 99;
    if (dist > wallDist + 0.18) continue;

    const moveSpeed = Math.hypot(e.vx || 0, e.vy || 0);
    let frame = moveSpeed > 0.08 ? Math.floor(e.walkCycle || 0) % 4 : 1;
    if (e.attackTimer > 0) frame = e.attackTimer > 0.12 ? 4 : 5;
    if (e.hp <= 0) frame = e.deathTimer > 0.2 ? 6 : 7;
    const deathAlpha = e.hp > 0 ? 1 : 0.88;

    ctx.save();
    ctx.globalAlpha = Math.max(0.4, Math.min(1, 1.35 - dist * 0.082)) * deathAlpha;
    ctx.shadowBlur = 20;
    ctx.shadowColor = kind.accent;
    if (sheet) {
      ctx.drawImage(
        sheet.image,
        frame * sheet.frameW,
        0,
        sheet.frameW,
        sheet.frameH,
        x,
        y,
        drawW,
        drawH
      );
    } else {
      ctx.drawImage(enemyPortraitImages[e.type], x, y, drawW, drawH);
    }

    if (e.attackTimer > 0 && e.hp > 0) {
      ctx.fillStyle = kind.accent;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(screenX + drawW * 0.18, y + drawH * 0.48, drawW * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (e.hp <= 0) continue;

    const hpRatio = Math.max(0, Math.min(1, e.hp / (e.maxHp || 100)));
    ctx.fillStyle = "#000c";
    ctx.fillRect(x + drawW * 0.16, y - 18, drawW * 0.68, 9);
    ctx.fillStyle = kind.accent;
    ctx.fillRect(x + drawW * 0.16, y - 18, drawW * 0.68 * hpRatio, 9);

  }
}

function drawProjectiles() {
  const all = [...state.projectiles.map((p) => ({ ...p, c: "#d8ff5b" })), ...state.enemyProjectiles.map((p) => ({ ...p, c: "#ff447c" }))];
  for (const p of all) {
    const dx = p.x - state.player.x;
    const dy = p.y - state.player.y;
    const dist = Math.hypot(dx, dy);
    const ang = normalizeAngle(Math.atan2(dy, dx) - state.player.angle);
    if (Math.abs(ang) > Math.PI / 4) continue;
    const screenX = (0.5 + ang / (Math.PI / 3)) * canvas.width;
    const size = Math.max(2, 180 / (dist + 0.2));
    const screenY = canvas.height * 0.52;
    ctx.fillStyle = p.c;
    ctx.shadowBlur = 12;
    ctx.shadowColor = p.c;
    ctx.beginPath();
    ctx.arc(screenX, screenY, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawGun() {
  const w = canvas.width;
  const h = canvas.height;
  const gunBob = Math.sin(state.gameTime * 6) * 2.4;
  const drawW = 520;
  const drawH = 320;
  const gx = w * 0.5 - drawW * 0.5;
  const gy = h - 298 + state.gunKick * 8 + gunBob;
  let frame = Math.floor((state.gameTime * 5) % 2);
  if (state.flashTimer > 0.04) frame = 2;
  else if (state.gunKick > 0.25) frame = 3;
  const sheet = gunSpriteSheet;
  if (!sheet) return;
  ctx.drawImage(sheet.image, frame * sheet.frameW, 0, sheet.frameW, sheet.frameH, gx, gy, drawW, drawH);
}

function drawHud() {
  ctx.fillStyle = "#0b1322c9";
  ctx.fillRect(12, 12, 320, 76);
  ctx.strokeStyle = "#36f4ff";
  ctx.strokeRect(12, 12, 320, 76);

  ctx.fillStyle = "#d9f4ff";
  ctx.font = "18px Trebuchet MS";
  ctx.fillText(`HP ${state.player.hp}`, 24, 38);
  ctx.fillText(`SCORE ${state.player.score}`, 24, 64);
  ctx.fillText(`LEVEL ${state.level}/${LEVELS.length}`, 146, 38);
  ctx.fillText(`ENEMIES ${state.enemiesAlive}`, 146, 64);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.strokeStyle = "#d4faffd8";
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy);
  ctx.lineTo(cx - 4, cy);
  ctx.moveTo(cx + 4, cy);
  ctx.lineTo(cx + 12, cy);
  ctx.moveTo(cx, cy - 12);
  ctx.lineTo(cx, cy - 4);
  ctx.moveTo(cx, cy + 4);
  ctx.lineTo(cx, cy + 12);
  ctx.stroke();

  if (state.hurtTimer > 0) {
    ctx.fillStyle = `rgba(255, 32, 90, ${Math.min(0.45, state.hurtTimer * 1.5)})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();
  castRays();
  drawWalls();
  drawSprites();
  drawProjectiles();
  drawGun();
  drawHud();
}

function update(dt) {
  if (state.mode !== "playing") return render();
  tryProcessSprites();
  state.gameTime += dt;
  movePlayer(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  state.flashTimer = Math.max(0, state.flashTimer - dt);
  state.hurtTimer = Math.max(0, state.hurtTimer - dt);
  state.gunKick = Math.max(0, state.gunKick - dt * 6);
  render();
}

function tick(ts) {
  const dt = Math.min(0.033, (ts - state.lastTs) / 1000 || 0.016);
  state.lastTs = ts;
  update(dt);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function setPlaying() {
  state.mode = "playing";
  state.keys.clear();
  state.mouseDeltaX = 0;
  ensureAudio();
  panel.classList.add("hidden");
}

function handleStartAction() {
  ensureAudio();
  if (state.mode === "level_cleared") {
    loadLevel(state.level + 1, { freshCampaign: false });
  } else {
    startCampaign();
  }
  setPlaying();
}

startBtn.addEventListener("click", handleStartAction);

window.addEventListener("keydown", (e) => {
  state.keys.add(e.code);
  if (
    (e.code === "Space" || e.code === "Enter") &&
    (state.mode === "menu" || state.mode === "dead" || state.mode === "won" || state.mode === "level_cleared")
  ) {
    e.preventDefault();
    handleStartAction();
    return;
  }
  if (e.code === "Space") shoot();
  if (e.code === "KeyR") {
    startCampaign();
    setPlaying();
  }
  if (e.code === "KeyF") {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }
});

window.addEventListener("keyup", (e) => state.keys.delete(e.code));
window.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement === canvas || state.mode === "playing") {
    state.mouseDeltaX += e.movementX || 0;
  }
});
canvas.addEventListener("click", () => {
  if (state.mode === "menu" || state.mode === "dead" || state.mode === "won" || state.mode === "level_cleared") return;
  ensureAudio();
  if (!navigator.webdriver) {
    canvas.requestPointerLock?.();
  }
  shoot();
});

document.addEventListener("fullscreenchange", () => {
  fitCanvas();
});

function fitCanvas() {
  const ratio = 16 / 9;
  const pad = 18;
  let w = Math.max(480, window.innerWidth - pad * 2);
  let h = Math.max(320, window.innerHeight - pad * 2);
  if (w / h > ratio) w = h * ratio;
  else h = w / ratio;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
}
window.addEventListener("resize", fitCanvas);
fitCanvas();

window.render_game_to_text = () => {
  const levelCfg = getLevelConfig(state.level);
  const payload = {
    mode: state.mode,
    coordinate_system: "world grid, origin top-left, +x right, +y down, angle radians",
    level: {
      current: state.level,
      total: LEVELS.length,
      name: levelCfg.name,
      enemies_alive: state.enemiesAlive,
    },
    player: {
      x: Number(state.player.x.toFixed(2)),
      y: Number(state.player.y.toFixed(2)),
      angle: Number(state.player.angle.toFixed(3)),
      hp: state.player.hp,
      score: state.player.score,
    },
    enemies: state.enemies.map((e) => ({
      x: Number(e.x.toFixed(2)),
      y: Number(e.y.toFixed(2)),
      hp: e.hp,
      max_hp: e.maxHp,
      type: e.type,
      attacking: e.attackTimer > 0,
      state: e.hp > 0 ? "alive" : "dying",
    })),
    bullets: {
      player: state.projectiles.length,
      enemy: state.enemyProjectiles.length,
    },
  };
  return JSON.stringify(payload, null, 2);
};

window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i++) {
    update(1 / 60);
  }
};
