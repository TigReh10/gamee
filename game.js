/* =========================================================================
   THE LAST OF US — PART II  (unofficial fan tribute)
   An original top-down stealth-survival game.
   All code and art are original and drawn at runtime on a <canvas>.
   No copyrighted assets are used.
   ========================================================================= */

(() => {
  'use strict';

  // ---------------------------------------------------------------------
  // Canvas / DOM
  // ---------------------------------------------------------------------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    hp: document.getElementById('hpFill'),
    ammo: document.getElementById('ammo'),
    bottles: document.getElementById('bottles'),
    kits: document.getElementById('kits'),
    objective: document.getElementById('objective'),
    alert: document.getElementById('alert'),
    overlay: document.getElementById('overlay'),
    overlayTitle: document.getElementById('overlayTitle'),
    overlayText: document.getElementById('overlayText'),
    overlayBtn: document.getElementById('overlayBtn'),
    toast: document.getElementById('toast'),
  };

  let W = 0, H = 0;
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------
  const TILE = 44;
  const FOV = Math.PI * 0.62;       // runner vision cone
  const TWO_PI = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= TWO_PI; while (d < -Math.PI) d += TWO_PI; return d; }

  // ---------------------------------------------------------------------
  // Level definition
  // Tiles: 0 floor, 1 wall, 2 cover crate, 3 tall grass, 4 exit pad
  // ---------------------------------------------------------------------
  const MAP_W = 56, MAP_H = 40;
  let grid = [];

  function buildLevel() {
    grid = [];
    for (let y = 0; y < MAP_H; y++) {
      const row = [];
      for (let x = 0; x < MAP_W; x++) {
        const border = (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1);
        row.push(border ? 1 : 0);
      }
      grid.push(row);
    }

    const wallRect = (x, y, w, h) => {
      for (let j = y; j < y + h; j++)
        for (let i = x; i < x + w; i++)
          if (grid[j] && grid[j][i] !== undefined) grid[j][i] = 1;
    };
    const fillRect = (x, y, w, h, t) => {
      for (let j = y; j < y + h; j++)
        for (let i = x; i < x + w; i++)
          if (grid[j] && grid[j][i] !== undefined) grid[j][i] = t;
    };

    // Building blocks — a ruined Seattle block layout
    wallRect(8, 0, 1, 11);
    wallRect(8, 14, 1, 12);
    wallRect(0, 11, 6, 1);
    wallRect(16, 6, 1, 14);
    wallRect(16, 6, 10, 1);
    wallRect(25, 6, 1, 9);
    wallRect(20, 19, 12, 1);
    wallRect(31, 10, 1, 10);
    wallRect(36, 0, 1, 14);
    wallRect(36, 17, 1, 13);
    wallRect(36, 24, 12, 1);
    wallRect(44, 8, 1, 16);
    wallRect(40, 8, 5, 1);
    wallRect(10, 28, 18, 1);
    wallRect(10, 28, 1, 8);
    wallRect(22, 28, 1, 8);
    wallRect(31, 24, 1, 13);
    wallRect(46, 28, 9, 1);
    wallRect(46, 28, 1, 8);

    // Cover crates / debris (crouch behind these)
    const crates = [
      [4, 5], [5, 5], [4, 6], [12, 3], [13, 3], [12, 9], [13, 16], [14, 16],
      [20, 9], [21, 9], [22, 12], [28, 9], [29, 9], [28, 16], [33, 14], [34, 14],
      [40, 4], [41, 4], [40, 18], [41, 18], [48, 12], [49, 12], [48, 13],
      [14, 31], [15, 31], [26, 31], [27, 31], [34, 30], [35, 30], [50, 31], [51, 31],
      [6, 22], [7, 22], [19, 24], [20, 24], [42, 30], [43, 30],
    ];
    crates.forEach(([x, y]) => { if (grid[y] && grid[y][x] === 0) grid[y][x] = 2; });

    // Tall grass patches (hide while crouched)
    const grassPatches = [[2, 2, 4, 3], [10, 20, 5, 4], [18, 14, 4, 3], [26, 22, 4, 3],
      [38, 14, 3, 3], [46, 18, 4, 3], [4, 32, 4, 4], [24, 12, 3, 3], [12, 24, 3, 3]];
    grassPatches.forEach(([x, y, w, h]) => {
      for (let j = y; j < y + h; j++)
        for (let i = x; i < x + w; i++)
          if (grid[j] && grid[j][i] === 0) grid[j][i] = 3;
    });

    // Extraction pad (exit)
    fillRect(50, 2, 4, 4, 4);
  }

  const tileAt = (px, py) => {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 1;
    return grid[ty][tx];
  };
  const isWall = (px, py) => tileAt(px, py) === 1;
  const isGrass = (px, py) => tileAt(px, py) === 3;
  const isExit = (px, py) => tileAt(px, py) === 4;

  // Line of sight — true if a wall blocks the segment
  function losBlocked(x1, y1, x2, y2) {
    const d = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.ceil(d / (TILE * 0.5));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (isWall(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------
  // Audio (synthesized — no external files)
  // ---------------------------------------------------------------------
  let AC = null;
  function actx() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
    return AC;
  }
  function blip(freq, dur, type, vol) {
    const ac = actx(); if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.value = vol || 0.05;
    o.connect(g); g.connect(ac.destination);
    const now = ac.currentTime;
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.start(now); o.stop(now + dur);
  }
  function noiseBurst(dur, vol) {
    const ac = actx(); if (!ac) return;
    const n = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain(); g.gain.value = vol || 0.2;
    src.connect(g); g.connect(ac.destination); src.start();
  }
  const sfx = {
    shot: () => { noiseBurst(0.18, 0.35); blip(120, 0.18, 'square', 0.12); },
    melee: () => { noiseBurst(0.08, 0.18); },
    pickup: () => { blip(660, 0.08, 'triangle', 0.08); blip(880, 0.08, 'triangle', 0.06); },
    hurt: () => { blip(160, 0.18, 'sawtooth', 0.12); },
    kill: () => { noiseBurst(0.12, 0.15); blip(90, 0.2, 'square', 0.08); },
    bottle: () => { blip(420, 0.12, 'triangle', 0.07); noiseBurst(0.06, 0.1); },
    click: () => { blip(1200, 0.03, 'square', 0.05); },
    win: () => { blip(523, 0.2, 'triangle', 0.1); setTimeout(() => blip(784, 0.3, 'triangle', 0.1), 180); },
  };

  // ---------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------
  const keys = {};
  const mouse = { x: 0, y: 0, down: false, right: false };
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (['Space', 'ShiftLeft', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.code === 'KeyE') tryTakedown();
    if (e.code === 'KeyF') flashlight = !flashlight;
    if (e.code === 'KeyR') useKit();
    if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'playing') pause(); else if (state === 'paused') resume(); }
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', e => {
    if (state !== 'playing') return;
    if (e.button === 0) { mouse.down = true; shoot(); }
    if (e.button === 2) { mouse.right = true; throwBottle(); }
  });
  canvas.addEventListener('mouseup', e => {
    if (e.button === 0) mouse.down = false;
    if (e.button === 2) mouse.right = false;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // ---------------------------------------------------------------------
  // Entities
  // ---------------------------------------------------------------------
  let player, enemies, pickups, projectiles, particles, noises, supplies, exitOpen;
  let camX = 0, camY = 0, flashlight = true, gameTime = 0, alertTimer = 0;
  let state = 'menu';
  let toastTimer = 0;

  function spawnPlayer(tx, ty) {
    player = {
      x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, r: 12,
      hp: 100, maxHp: 100, ang: 0, speed: 150, crouch: false,
      ammo: 7, bottles: 2, kits: 1, meleeCd: 0, hurtCd: 0, footTimer: 0,
      dead: false,
    };
  }

  function makeEnemy(type, tx, ty) {
    const x = tx * TILE + TILE / 2, y = ty * TILE + TILE / 2;
    const wps = [];
    const n = 3;
    for (let i = 0; i < n; i++) {
      let wx, wy, tries = 0;
      do {
        wx = x + rand(-3, 3) * TILE; wy = y + rand(-3, 3) * TILE; tries++;
      } while (isWall(wx, wy) && tries < 12);
      wps.push({ x: clamp(wx, TILE, (MAP_W - 1) * TILE), y: clamp(wy, TILE, (MAP_H - 1) * TILE) });
    }
    return {
      type, x, y, r: type === 'clicker' ? 13 : 12,
      ang: rand(0, TWO_PI), spawnX: x, spawnY: y,
      hp: type === 'clicker' ? 60 : 40,
      speed: type === 'clicker' ? 52 : 74,
      chaseSpeed: type === 'clicker' ? 92 : 132,
      alert: 0, state: 'patrol', wps, wpi: 0,
      lastX: x, lastY: y, investigateT: 0, attackCd: 0,
      bob: rand(0, TWO_PI), dead: false,
    };
  }

  function reset() {
    buildLevel();
    spawnPlayer(3, 5);
    enemies = [
      makeEnemy('runner', 13, 4), makeEnemy('runner', 22, 11), makeEnemy('runner', 29, 14),
      makeEnemy('clicker', 24, 10), makeEnemy('runner', 19, 23), makeEnemy('clicker', 14, 33),
      makeEnemy('runner', 40, 6), makeEnemy('clicker', 42, 20), makeEnemy('runner', 48, 30),
      makeEnemy('runner', 34, 30), makeEnemy('clicker', 39, 14), makeEnemy('runner', 47, 14),
    ];
    pickups = [
      { type: 'ammo', tx: 5, ty: 3 }, { type: 'bottle', tx: 13, ty: 17 },
      { type: 'kit', tx: 28, ty: 17 }, { type: 'ammo', tx: 33, ty: 13 },
      { type: 'bottle', tx: 20, ty: 25 }, { type: 'ammo', tx: 41, ty: 19 },
      { type: 'kit', tx: 50, ty: 14 }, { type: 'bottle', tx: 6, ty: 23 },
      { type: 'supplies', tx: 47, ty: 31 }, { type: 'ammo', tx: 12, ty: 32 },
      { type: 'bottle', tx: 35, ty: 30 }, { type: 'kit', tx: 19, ty: 9 },
    ].map(p => ({ ...p, x: p.tx * TILE + TILE / 2, y: p.ty * TILE + TILE / 2, taken: false, bob: rand(0, TWO_PI) }));
    projectiles = []; particles = []; noises = [];
    supplies = 0; exitOpen = false;
    flashlight = true; gameTime = 0; alertTimer = 0;
    setObjective('Find the surgical supplies, then reach extraction (NE).');
  }

  // ---------------------------------------------------------------------
  // Player actions
  // ---------------------------------------------------------------------
  function emitNoise(x, y, radius, strong) {
    noises.push({ x, y, radius, life: 0.5, max: 0.5 });
    for (const e of enemies) {
      if (e.dead) continue;
      const d = dist(e.x, e.y, x, y);
      const hear = radius * (e.type === 'clicker' ? 1.35 : 1);
      if (d < hear && !losBlocked(e.x, e.y, x, y)) {
        e.lastX = x; e.lastY = y;
        if (strong || e.type === 'clicker') { e.alert = Math.min(1, e.alert + 0.8); }
        else e.alert = Math.min(1, e.alert + 0.45);
        if (e.state === 'patrol') { e.state = 'investigate'; e.investigateT = 6; }
      }
    }
  }

  function shoot() {
    if (player.dead) return;
    if (player.ammo <= 0) { toast('Out of ammo'); blip(200, 0.05, 'square', 0.04); return; }
    player.ammo--;
    const a = player.ang;
    const sx = player.x + Math.cos(a) * 14, sy = player.y + Math.sin(a) * 14;
    // hitscan
    let bx = sx, by = sy, hitE = null, bestD = 1400;
    for (let i = 0; i < 1400; i += 6) {
      const px = sx + Math.cos(a) * i, py = sy + Math.sin(a) * i;
      if (isWall(px, py)) { bx = px; by = py; break; }
      for (const e of enemies) {
        if (e.dead) continue;
        if (dist2(px, py, e.x, e.y) < (e.r + 4) * (e.r + 4)) {
          if (i < bestD) { bestD = i; hitE = e; bx = px; by = py; }
        }
      }
      if (hitE) break;
      bx = px; by = py;
    }
    projectiles.push({ kind: 'tracer', x1: sx, y1: sy, x2: bx, y2: by, life: 0.06 });
    if (hitE) {
      hitE.hp -= 55; spark(bx, by, '#ff5544', 10);
      if (hitE.hp <= 0) { killEnemy(hitE); }
      else { hitE.alert = 1; hitE.state = 'chase'; hitE.lastX = player.x; hitE.lastY = player.y; }
    }
    sfx.shot();
    emitNoise(player.x, player.y, 720, true);
    shake(6);
  }

  function throwBottle() {
    if (player.dead || player.bottles <= 0) { if (player.bottles <= 0) toast('No bottles'); return; }
    player.bottles--;
    const a = player.ang;
    const tx = mouse.x + camX, ty = mouse.y + camY;
    projectiles.push({ kind: 'bottle', x: player.x, y: player.y, tx, ty,
      vx: Math.cos(a), vy: Math.sin(a), life: 1.2 });
    sfx.bottle();
  }

  function meleeAttack() {
    if (player.meleeCd > 0) return;
    player.meleeCd = 0.45;
    sfx.melee();
    spark(player.x + Math.cos(player.ang) * 18, player.y + Math.sin(player.ang) * 18, '#ddd', 5);
    for (const e of enemies) {
      if (e.dead) continue;
      const d = dist(player.x, player.y, e.x, e.y);
      if (d < 42) {
        const a = Math.atan2(e.y - player.y, e.x - player.x);
        if (Math.abs(angDiff(a, player.ang)) < 1.0) {
          e.hp -= 45;
          spark(e.x, e.y, '#aa3322', 8);
          if (e.hp <= 0) killEnemy(e);
          else { e.alert = 1; e.state = 'chase'; e.lastX = player.x; e.lastY = player.y; }
        }
      }
    }
    emitNoise(player.x, player.y, 160, false);
  }

  function tryTakedown() {
    if (state !== 'playing' || player.dead) return;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = dist(player.x, player.y, e.x, e.y);
      if (d < 40) {
        // Must approach from behind & enemy unaware (clickers are always blind so any side works)
        const behind = Math.abs(angDiff(Math.atan2(player.y - e.y, player.x - e.x), e.ang)) < 1.1;
        const stealthOk = e.type === 'clicker' ? player.crouch : (player.crouch && e.alert < 0.6 && behind);
        if (stealthOk) {
          killEnemy(e, true);
          toast('Silent takedown');
          return;
        }
      }
    }
  }

  function killEnemy(e, silent) {
    e.dead = true;
    spark(e.x, e.y, '#7a1f1f', 16);
    if (silent) blip(90, 0.12, 'sine', 0.05); else sfx.kill();
  }

  function useKit() {
    if (player.dead || player.kits <= 0 || player.hp >= player.maxHp) return;
    player.kits--;
    player.hp = Math.min(player.maxHp, player.hp + 55);
    sfx.pickup();
    toast('Used health kit');
    spark(player.x, player.y, '#33dd77', 10);
  }

  // ---------------------------------------------------------------------
  // Particles / fx
  // ---------------------------------------------------------------------
  let shakeAmt = 0;
  function shake(n) { shakeAmt = Math.max(shakeAmt, n); }
  function spark(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TWO_PI), s = rand(20, 140);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.3, 0.8), max: 0.8, color, r: rand(1, 3) });
    }
  }

  // ---------------------------------------------------------------------
  // Movement collision
  // ---------------------------------------------------------------------
  function moveEntity(ent, dx, dy) {
    const r = ent.r;
    if (!isWall(ent.x + dx + Math.sign(dx) * r, ent.y) &&
        !isWall(ent.x + dx + Math.sign(dx) * r, ent.y - r * 0.7) &&
        !isWall(ent.x + dx + Math.sign(dx) * r, ent.y + r * 0.7)) {
      ent.x += dx;
    }
    if (!isWall(ent.x, ent.y + dy + Math.sign(dy) * r) &&
        !isWall(ent.x - r * 0.7, ent.y + dy + Math.sign(dy) * r) &&
        !isWall(ent.x + r * 0.7, ent.y + dy + Math.sign(dy) * r)) {
      ent.y += dy;
    }
  }

  // ---------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------
  function update(dt) {
    gameTime += dt;
    if (player.meleeCd > 0) player.meleeCd -= dt;
    if (player.hurtCd > 0) player.hurtCd -= dt;

    // aim toward mouse
    player.ang = Math.atan2((mouse.y + camY) - player.y, (mouse.x + camX) - player.x);
    player.crouch = !!keys['ShiftLeft'] || !!keys['ShiftRight'];

    // movement
    let mx = 0, my = 0;
    if (keys['KeyW'] || keys['ArrowUp']) my -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) my += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
    const moving = (mx || my);
    if (moving) {
      const len = Math.hypot(mx, my);
      const spd = (player.crouch ? player.speed * 0.55 : player.speed) * dt;
      moveEntity(player, (mx / len) * spd, (my / len) * spd);
      // footstep noise
      player.footTimer -= dt;
      if (player.footTimer <= 0) {
        player.footTimer = player.crouch ? 0.55 : 0.35;
        const onGrass = isGrass(player.x, player.y);
        const radius = player.crouch ? (onGrass ? 30 : 70) : (onGrass ? 90 : 150);
        emitNoise(player.x, player.y, radius, false);
      }
    }
    if (keys['Space']) meleeAttack();

    // pickups
    for (const p of pickups) {
      if (p.taken) continue;
      if (dist2(player.x, player.y, p.x, p.y) < 26 * 26) {
        p.taken = true; sfx.pickup(); spark(p.x, p.y, '#ffd166', 8);
        if (p.type === 'ammo') { player.ammo += 5; toast('+5 ammo'); }
        else if (p.type === 'bottle') { player.bottles += 2; toast('+2 bottles'); }
        else if (p.type === 'kit') { player.kits += 1; toast('+1 health kit'); }
        else if (p.type === 'supplies') {
          supplies++; exitOpen = true;
          toast('Surgical supplies secured — get to extraction!');
          setObjective('Reach the extraction pad in the NE corner.');
        }
      }
    }

    // win condition
    if (exitOpen && isExit(player.x, player.y)) { win(); return; }

    updateProjectiles(dt);
    updateEnemies(dt);
    updateParticles(dt);
    for (const n of noises) n.life -= dt;
    noises = noises.filter(n => n.life > 0);

    // camera follow (clamped)
    const tcx = player.x - W / 2, tcy = player.y - H / 2;
    camX += (tcx - camX) * Math.min(1, dt * 8);
    camY += (tcy - camY) * Math.min(1, dt * 8);
    camX = clamp(camX, 0, Math.max(0, MAP_W * TILE - W));
    camY = clamp(camY, 0, Math.max(0, MAP_H * TILE - H));
    if (MAP_W * TILE < W) camX = (MAP_W * TILE - W) / 2;
    if (MAP_H * TILE < H) camY = (MAP_H * TILE - H) / 2;

    if (shakeAmt > 0) shakeAmt = Math.max(0, shakeAmt - dt * 30);
    if (player.hp <= 0 && !player.dead) { player.dead = true; die(); }

    // alert indicator decay
    const maxAlert = enemies.reduce((m, e) => e.dead ? m : Math.max(m, e.alert), 0);
    alertTimer = maxAlert;
  }

  function updateProjectiles(dt) {
    for (const pr of projectiles) {
      if (pr.kind === 'tracer') { pr.life -= dt; continue; }
      if (pr.kind === 'bottle') {
        const dx = pr.tx - pr.x, dy = pr.ty - pr.y;
        const d = Math.hypot(dx, dy);
        const step = 520 * dt;
        if (d <= step || pr.life <= 0 || isWall(pr.x + (dx / (d || 1)) * step, pr.y + (dy / (d || 1)) * step)) {
          // land
          spark(pr.x, pr.y, '#88ccaa', 10);
          sfx.bottle();
          emitNoise(pr.x, pr.y, 360, true);
          pr.dead = true;
        } else {
          pr.x += (dx / d) * step; pr.y += (dy / d) * step; pr.life -= dt;
        }
      }
    }
    projectiles = projectiles.filter(p => !p.dead && p.life > 0);
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92; p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function canSeePlayer(e) {
    const d = dist(e.x, e.y, player.x, player.y);
    if (e.type === 'clicker') return false; // blind
    let range = 320;
    const onGrass = isGrass(player.x, player.y);
    if (player.crouch) range *= onGrass ? 0.28 : 0.7;
    if (flashlight) {
      // flashlight makes the player easier to spot if in front of you
      range *= 1.15;
    }
    if (d > range) return false;
    const a = Math.atan2(player.y - e.y, player.x - e.x);
    if (Math.abs(angDiff(a, e.ang)) > FOV / 2) return false;
    if (losBlocked(e.x, e.y, player.x, player.y)) return false;
    return true;
  }

  function updateEnemies(dt) {
    for (const e of enemies) {
      if (e.dead) continue;
      e.bob += dt * (e.state === 'chase' ? 14 : 6);
      if (e.attackCd > 0) e.attackCd -= dt;
      const seeing = canSeePlayer(e);
      const pd = dist(e.x, e.y, player.x, player.y);

      // clicker proximity hearing (constant faint awareness)
      if (e.type === 'clicker' && pd < 70 && !losBlocked(e.x, e.y, player.x, player.y)) {
        e.alert = Math.min(1, e.alert + dt * 1.4);
        e.lastX = player.x; e.lastY = player.y;
        if (Math.random() < 0.02) sfx.click();
      }

      if (seeing) {
        e.alert = Math.min(1, e.alert + dt * (pd < 160 ? 2.4 : 1.4));
        e.lastX = player.x; e.lastY = player.y;
      } else {
        e.alert = Math.max(0, e.alert - dt * 0.35);
      }

      if (e.alert >= 1) e.state = 'chase';
      else if (e.state === 'chase' && e.alert < 0.35) { e.state = 'investigate'; e.investigateT = 4; }

      let tx, ty, spd;
      if (e.state === 'chase') {
        tx = e.lastX; ty = e.lastY; spd = e.chaseSpeed;
        if (seeing || (e.type === 'clicker' && pd < 70)) { e.lastX = player.x; e.lastY = player.y; }
        if (dist(e.x, e.y, e.lastX, e.lastY) < 12 && !seeing) { e.state = 'investigate'; e.investigateT = 4; }
      } else if (e.state === 'investigate') {
        tx = e.lastX; ty = e.lastY; spd = e.speed * 1.1;
        e.investigateT -= dt;
        if (dist(e.x, e.y, tx, ty) < 14 || e.investigateT <= 0) { e.state = 'patrol'; }
      } else {
        const wp = e.wps[e.wpi];
        tx = wp.x; ty = wp.y; spd = e.speed;
        if (dist(e.x, e.y, tx, ty) < 16) e.wpi = (e.wpi + 1) % e.wps.length;
      }

      // steer
      const a = Math.atan2(ty - e.y, tx - e.x);
      e.ang += angDiff(a, e.ang) * Math.min(1, dt * 7);
      const before = { x: e.x, y: e.y };
      moveEntity(e, Math.cos(e.ang) * spd * dt, Math.sin(e.ang) * spd * dt);
      if (Math.abs(e.x - before.x) < 0.2 && Math.abs(e.y - before.y) < 0.2 && e.state === 'patrol') {
        e.wpi = (e.wpi + 1) % e.wps.length; // unstick
      }

      // attack player
      if (pd < e.r + player.r + 4) {
        if (e.type === 'clicker') {
          if (player.hurtCd <= 0) { player.hp = 0; player.hurtCd = 1; sfx.hurt(); }
        } else if (e.attackCd <= 0) {
          e.attackCd = 0.7; player.hp -= 14; player.hurtCd = 0.3; sfx.hurt(); shake(5);
          spark(player.x, player.y, '#cc3322', 6);
        }
      }
    }
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  const floorPattern = (() => {
    const c = document.createElement('canvas'); c.width = c.height = TILE;
    const g = c.getContext('2d');
    g.fillStyle = '#23262b'; g.fillRect(0, 0, TILE, TILE);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(${rand(30,55)|0},${rand(34,60)|0},${rand(36,64)|0},0.6)`;
      g.fillRect(rand(0, TILE), rand(0, TILE), rand(1, 4), rand(1, 4));
    }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.strokeRect(0.5, 0.5, TILE - 1, TILE - 1);
    return c;
  })();

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    let ox = 0, oy = 0;
    if (shakeAmt > 0) { ox = rand(-shakeAmt, shakeAmt); oy = rand(-shakeAmt, shakeAmt); }
    ctx.translate(-camX + ox, -camY + oy);

    // visible tile range
    const x0 = Math.max(0, Math.floor(camX / TILE)), x1 = Math.min(MAP_W, Math.ceil((camX + W) / TILE));
    const y0 = Math.max(0, Math.floor(camY / TILE)), y1 = Math.min(MAP_H, Math.ceil((camY + H) / TILE));

    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const t = grid[y][x], px = x * TILE, py = y * TILE;
        if (t === 1) {
          ctx.fillStyle = '#15171b'; ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = '#2a2e35'; ctx.fillRect(px, py, TILE, 5);
          ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        } else {
          ctx.drawImage(floorPattern, px, py);
          if (t === 4) {
            ctx.fillStyle = exitOpen ? 'rgba(80,220,140,0.22)' : 'rgba(220,180,80,0.12)';
            ctx.fillRect(px, py, TILE, TILE);
            ctx.strokeStyle = exitOpen ? 'rgba(120,255,170,0.6)' : 'rgba(220,180,80,0.4)';
            ctx.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5);
          }
          if (t === 2) { // crate
            ctx.fillStyle = '#4a3b29'; ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
            ctx.fillStyle = '#5d4a33'; ctx.fillRect(px + 4, py + 4, TILE - 8, 6);
            ctx.strokeStyle = '#2c2014'; ctx.strokeRect(px + 4.5, py + 4.5, TILE - 9, TILE - 9);
          }
          if (t === 3) { // grass
            ctx.fillStyle = 'rgba(40,70,38,0.85)'; ctx.fillRect(px, py, TILE, TILE);
            ctx.strokeStyle = 'rgba(70,110,60,0.7)'; ctx.lineWidth = 2;
            for (let i = 0; i < 5; i++) {
              const gx = px + 6 + i * 7 + Math.sin(gameTime * 2 + i + x) * 2;
              ctx.beginPath(); ctx.moveTo(gx, py + TILE - 3);
              ctx.lineTo(gx + 2, py + 8); ctx.stroke();
            }
            ctx.lineWidth = 1;
          }
        }
      }
    }

    // noise rings
    for (const n of noises) {
      const t = 1 - n.life / n.max;
      ctx.strokeStyle = `rgba(150,180,255,${0.4 * (1 - t)})`;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.radius * t, 0, TWO_PI); ctx.stroke();
    }

    // pickups
    for (const p of pickups) {
      if (p.taken) continue;
      const yo = Math.sin(gameTime * 3 + p.bob) * 2;
      drawPickup(p.x, p.y + yo, p.type);
    }

    // enemies
    for (const e of enemies) { if (!e.dead) drawEnemy(e); else drawCorpse(e); }

    // projectiles
    for (const pr of projectiles) {
      if (pr.kind === 'tracer') {
        ctx.strokeStyle = 'rgba(255,230,150,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(pr.x1, pr.y1); ctx.lineTo(pr.x2, pr.y2); ctx.stroke();
        ctx.lineWidth = 1;
      } else if (pr.kind === 'bottle') {
        ctx.fillStyle = '#9fd6c0'; ctx.beginPath(); ctx.arc(pr.x, pr.y, 4, 0, TWO_PI); ctx.fill();
      }
    }

    // particles
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TWO_PI); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // player
    drawPlayer();

    ctx.restore();

    // lighting / fog of war overlay
    drawLighting(ox, oy);

    // film grain + vignette
    drawVignette();
  }

  function drawPickup(x, y, type) {
    ctx.save(); ctx.translate(x, y);
    const colors = { ammo: '#e0c060', bottle: '#7fb8a0', kit: '#46c46e', supplies: '#5aa0ff' };
    ctx.shadowColor = colors[type]; ctx.shadowBlur = 10;
    ctx.fillStyle = colors[type];
    if (type === 'ammo') { ctx.fillRect(-6, -4, 12, 8); }
    else if (type === 'bottle') { ctx.fillRect(-3, -8, 6, 16); ctx.fillRect(-2, -11, 4, 4); }
    else if (type === 'kit') {
      ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = '#fff'; ctx.fillRect(-1.5, -4, 3, 8); ctx.fillRect(-4, -1.5, 8, 3);
    } else if (type === 'supplies') {
      ctx.fillRect(-8, -6, 16, 12); ctx.fillStyle = '#cfe3ff'; ctx.fillRect(-8, -6, 16, 3);
    }
    ctx.restore();
  }

  function drawPlayer() {
    const p = player;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 8, 12, 6, 0, 0, TWO_PI); ctx.fill();
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang);
    const sc = p.crouch ? 0.85 : 1;
    ctx.scale(sc, sc);
    // body
    ctx.fillStyle = '#3a5a4a'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = '#2c4438'; ctx.fillRect(-11, -4, 6, 8); // backpack
    // head
    ctx.fillStyle = '#caa07a'; ctx.beginPath(); ctx.arc(4, 0, 5, 0, TWO_PI); ctx.fill();
    // weapon
    ctx.fillStyle = '#1c1c1c'; ctx.fillRect(6, -2, 12, 4);
    ctx.restore();
  }

  function drawEnemy(e) {
    // detection cone for runners
    if (e.type === 'runner') {
      let range = 320 * (e.state === 'chase' ? 1.05 : 1);
      const col = e.state === 'chase' ? 'rgba(255,60,60,' : e.alert > 0.4 ? 'rgba(255,180,60,' : 'rgba(255,255,255,';
      const grd = ctx.createRadialGradient(e.x, e.y, 8, e.x, e.y, range);
      grd.addColorStop(0, col + (0.10 + e.alert * 0.12) + ')');
      grd.addColorStop(1, col + '0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.moveTo(e.x, e.y);
      ctx.arc(e.x, e.y, range, e.ang - FOV / 2, e.ang + FOV / 2); ctx.closePath(); ctx.fill();
    } else {
      // clicker hearing aura
      ctx.strokeStyle = 'rgba(180,160,200,0.18)';
      ctx.beginPath(); ctx.arc(e.x, e.y, 70, 0, TWO_PI); ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + 7, 11, 5, 0, 0, TWO_PI); ctx.fill();
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.ang);
    const sway = Math.sin(e.bob) * 2;
    if (e.type === 'runner') {
      ctx.fillStyle = '#6e4038'; ctx.beginPath(); ctx.arc(0, sway, 11, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = '#8a5246'; ctx.beginPath(); ctx.arc(4, sway, 5, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = '#c23b2b'; ctx.fillRect(6, -1 + sway, 3, 2);
    } else {
      // clicker — pale with fungal bloom on head
      ctx.fillStyle = '#9b9384'; ctx.beginPath(); ctx.arc(0, sway, 12, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = '#d8cdb4';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TWO_PI + e.bob * 0.3;
        ctx.beginPath(); ctx.arc(4 + Math.cos(a) * 4, sway + Math.sin(a) * 4, 3, 0, TWO_PI); ctx.fill();
      }
    }
    ctx.restore();

    // health pip if damaged
    if (e.hp < (e.type === 'clicker' ? 60 : 40)) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - 11, e.y - 18, 22, 3);
      ctx.fillStyle = '#cc4433'; ctx.fillRect(e.x - 11, e.y - 18, 22 * clamp(e.hp / (e.type === 'clicker' ? 60 : 40), 0, 1), 3);
    }
  }

  function drawCorpse(e) {
    ctx.fillStyle = 'rgba(60,20,20,0.5)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y, 14, 9, e.ang, 0, TWO_PI); ctx.fill();
    ctx.fillStyle = 'rgba(110,40,40,0.7)';
    ctx.beginPath(); ctx.arc(e.x, e.y, 7, 0, TWO_PI); ctx.fill();
  }

  function drawLighting(ox, oy) {
    ctx.save();
    ctx.fillStyle = 'rgba(2,4,8,0.9)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';
    const sx = player.x - camX + ox, sy = player.y - camY + oy;
    // ambient circle around player
    let g = ctx.createRadialGradient(sx, sy, 10, sx, sy, 150);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 150, 0, TWO_PI); ctx.fill();
    // flashlight cone toward mouse
    if (flashlight) {
      const a = player.ang, len = 460, spread = 0.5;
      const cg = ctx.createRadialGradient(sx, sy, 20, sx, sy, len);
      cg.addColorStop(0, 'rgba(0,0,0,1)'); cg.addColorStop(0.7, 'rgba(0,0,0,0.7)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, len, a - spread, a + spread); ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // warm flashlight tint
    if (flashlight) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const a = player.ang, len = 460, spread = 0.5;
      const cg = ctx.createRadialGradient(sx, sy, 20, sx, sy, len);
      cg.addColorStop(0, 'rgba(60,55,40,0.25)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, len, a - spread, a + spread); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // low-health red pulse
    if (player && player.hp < 35 && !player.dead) {
      const pulse = 0.15 + Math.sin(gameTime * 6) * 0.08;
      ctx.fillStyle = `rgba(120,0,0,${pulse})`; ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------
  function updateHUD() {
    if (!player) return;
    ui.hp.style.width = clamp(player.hp, 0, 100) + '%';
    ui.ammo.textContent = player.ammo;
    ui.bottles.textContent = player.bottles;
    ui.kits.textContent = player.kits;
    if (alertTimer >= 1) { ui.alert.textContent = 'SPOTTED'; ui.alert.className = 'alert spotted'; }
    else if (alertTimer > 0.35) { ui.alert.textContent = 'HUNTING'; ui.alert.className = 'alert hunting'; }
    else { ui.alert.textContent = 'HIDDEN'; ui.alert.className = 'alert hidden'; }
  }
  function setObjective(t) { ui.objective.textContent = t; }
  function toast(t) { ui.toast.textContent = t; ui.toast.classList.add('show'); toastTimer = 2.4; }

  // ---------------------------------------------------------------------
  // State / overlay
  // ---------------------------------------------------------------------
  function showOverlay(title, text, btn) {
    ui.overlayTitle.textContent = title;
    ui.overlayText.innerHTML = text;
    ui.overlayBtn.textContent = btn;
    ui.overlay.classList.add('show');
  }
  function hideOverlay() { ui.overlay.classList.remove('show'); }

  function startGame() { reset(); state = 'playing'; hideOverlay(); actx(); }
  function pause() { state = 'paused'; showOverlay('Paused', controlsHTML(), 'Resume'); }
  function resume() { state = 'playing'; hideOverlay(); }
  function die() {
    state = 'dead';
    showOverlay('You did not make it', 'The infected overwhelmed you in the ruins of Seattle.<br>Stay low. Stay quiet. Try again.', 'Retry');
  }
  function win() {
    state = 'won'; sfx.win();
    showOverlay('Extracted', 'You secured the supplies and slipped out of the city alive.<br><b>Survivor.</b>', 'Play again');
  }

  function controlsHTML() {
    return `<div class="ctrls">
      <span><b>WASD</b> / Arrows — Move</span>
      <span><b>Hold Shift</b> — Crouch (quiet, hides in grass)</span>
      <span><b>Mouse</b> — Aim &nbsp; <b>Left-Click</b> — Fire pistol (loud!)</span>
      <span><b>Right-Click</b> — Throw bottle (distraction)</span>
      <span><b>Space</b> — Melee &nbsp; <b>E</b> — Stealth takedown (crouch, from behind)</span>
      <span><b>R</b> — Use health kit &nbsp; <b>F</b> — Toggle flashlight</span>
      <span><b>Esc / P</b> — Pause</span>
    </div>`;
  }

  ui.overlayBtn.addEventListener('click', () => {
    if (state === 'paused') resume();
    else startGame();
  });

  // ---------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------
  let last = performance.now();
  function loop(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;
    if (state === 'playing') { update(dt); updateHUD(); }
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) ui.toast.classList.remove('show'); }
    if (state === 'playing' || state === 'paused' || state === 'won' || state === 'dead') {
      if (player) draw();
    }
    requestAnimationFrame(loop);
  }

  // boot
  showOverlay('THE LAST OF US — PART II',
    '<i>Unofficial fan tribute · original code &amp; art</i><br><br>' +
    'Seattle has fallen. Scavenge surgical supplies and reach extraction — but the Infected hunt by sight and sound. ' +
    'Stay crouched, use grass for cover, distract with bottles, and save your bullets.' + controlsHTML(),
    'Start');
  requestAnimationFrame(loop);
})();
