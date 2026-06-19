/* =========================================================================
   THE LAST OF US — PART II  (unofficial 3D fan tribute)
   First-person stealth-survival built with Three.js.
   100% original code & geometry. No copyrighted assets are used.
   Requires THREE (loaded from CDN in index.html).
   ========================================================================= */
(() => {
  'use strict';
  const THREE = window.THREE;

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
    crosshair: document.getElementById('crosshair'),
    flash: document.getElementById('flash'),
  };

  if (!THREE) {
    ui.overlayTitle.textContent = 'Failed to load 3D engine';
    ui.overlayText.textContent = 'Three.js could not be loaded. Check your internet connection and refresh.';
    ui.overlay.classList.add('show');
    ui.overlayBtn.style.display = 'none';
    return;
  }

  // ---------- helpers ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const TWO_PI = Math.PI * 2;
  function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= TWO_PI; while (d < -Math.PI) d += TWO_PI; return d; }

  // ---------- constants ----------
  const CS = 4;                 // world units per grid cell
  const GW = 30, GH = 30;       // grid size
  const WALL_H = 3.4;
  const EYE = 1.6;
  const PLAYER_R = 0.42;

  // ---------- renderer / scene ----------
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const SKY = 0x10151c;
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 8, 52);

  const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 300);
  camera.rotation.order = 'YXZ';

  // ambient + hemisphere so geometry is always readable (not pitch black)
  scene.add(new THREE.AmbientLight(0x3a4452, 0.7));
  const hemi = new THREE.HemisphereLight(0x68788c, 0x20262e, 0.65);
  scene.add(hemi);
  // faint moonlight
  const moon = new THREE.DirectionalLight(0x8fa6c4, 0.35);
  moon.position.set(-30, 60, 20);
  scene.add(moon);

  // flashlight = spotlight attached to camera
  const flashlight = new THREE.SpotLight(0xfff0d0, 0, 60, Math.PI / 7, 0.45, 1.2);
  flashlight.castShadow = true;
  flashlight.shadow.mapSize.set(1024, 1024);
  scene.add(flashlight);
  const flashTarget = new THREE.Object3D();
  scene.add(flashTarget);
  flashlight.target = flashTarget;
  let flashOn = true;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---------- textures (generated, no external files) ----------
  function makeNoiseTexture(base, spread, lines) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) {
      const v = (Math.random() * spread) | 0;
      g.fillStyle = `rgba(${v},${v},${v},0.10)`;
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    if (lines) {
      g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 2;
      g.strokeRect(1, 1, 126, 126);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  const floorTex = makeNoiseTexture('#24282d', 120, false);
  floorTex.repeat.set(GW, GH);
  const wallTex = makeNoiseTexture('#3a3026', 90, true);
  const ceilTex = makeNoiseTexture('#15181d', 60, false);
  ceilTex.repeat.set(GW, GH);

  // ---------- level generation ----------
  let grid = [];
  let walls = [];           // {x,z} cell centers for collision
  let exitCell = null;
  const wallSet = new Set();
  const key = (i, j) => i + ',' + j;

  function genGrid() {
    grid = [];
    for (let j = 0; j < GH; j++) {
      const row = [];
      for (let i = 0; i < GW; i++) row.push(i === 0 || j === 0 || i === GW - 1 || j === GH - 1 ? 1 : 0);
      grid.push(row);
    }
    // interior structures (rooms / debris) leaving open lanes
    const blocks = 16;
    for (let b = 0; b < blocks; b++) {
      const w = Math.floor(rand(1, 4)), h = Math.floor(rand(1, 4));
      const x = Math.floor(rand(3, GW - 3 - w)), y = Math.floor(rand(3, GH - 3 - h));
      for (let j = y; j < y + h; j++)
        for (let i = x; i < x + w; i++)
          grid[j][i] = 1;
    }
    // scattered pillars
    for (let p = 0; p < 22; p++) {
      const i = Math.floor(rand(2, GW - 2)), j = Math.floor(rand(2, GH - 2));
      grid[j][i] = 1;
    }
    // carve guaranteed-open zones: spawn (2,2) and exit (GW-3,GH-3)
    carve(2, 2, 3); carve(GW - 4, GH - 4, 3);
    exitCell = { i: GW - 3, j: GH - 3 };
    grid[exitCell.j][exitCell.i] = 0;
  }
  function carve(ci, cj, r) {
    for (let j = cj - r; j <= cj + r; j++)
      for (let i = ci - r; i <= ci + r; i++)
        if (j > 0 && i > 0 && j < GH - 1 && i < GW - 1) grid[j][i] = 0;
  }
  const isWallCell = (i, j) => (i < 0 || j < 0 || i >= GW || j >= GH) ? true : grid[j][i] === 1;
  const cellToWorld = (i, j) => ({ x: (i + 0.5) * CS, z: (j + 0.5) * CS });
  const worldToCell = (x, z) => ({ i: Math.floor(x / CS), j: Math.floor(z / CS) });

  // collision: circle vs wall cells
  function blocked(x, z, r) {
    for (const [dx, dz] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]]) {
      const c = worldToCell(x + dx, z + dz);
      if (isWallCell(c.i, c.j)) return true;
    }
    return false;
  }

  // line of sight on the grid (DDA-ish sampling)
  function losClear(x1, z1, x2, z2) {
    const d = Math.hypot(x2 - x1, z2 - z1);
    const steps = Math.ceil(d / (CS * 0.4));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const c = worldToCell(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t);
      if (isWallCell(c.i, c.j)) return false;
    }
    return true;
  }

  // ---------- build meshes ----------
  let levelGroup = null;
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95, metalness: 0.0, color: 0x9a8a72 });
  const wallGeo = new THREE.BoxGeometry(CS, WALL_H, CS);

  function buildLevel() {
    if (levelGroup) scene.remove(levelGroup);
    levelGroup = new THREE.Group();
    walls = []; wallSet.clear();

    // floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(GW * CS, GH * CS),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1, metalness: 0, color: 0x6a7078 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(GW * CS / 2, 0, GH * CS / 2);
    floor.receiveShadow = true;
    levelGroup.add(floor);

    // ceiling
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(GW * CS, GH * CS),
      new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 1, color: 0x4a525c })
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(GW * CS / 2, WALL_H, GH * CS / 2);
    levelGroup.add(ceil);

    // walls (merge into instanced-ish group of meshes)
    for (let j = 0; j < GH; j++) {
      for (let i = 0; i < GW; i++) {
        if (grid[j][i] === 1) {
          const w = cellToWorld(i, j);
          const m = new THREE.Mesh(wallGeo, wallMat);
          m.position.set(w.x, WALL_H / 2, w.z);
          m.castShadow = true; m.receiveShadow = true;
          levelGroup.add(m);
          walls.push(w); wallSet.add(key(i, j));
        }
      }
    }

    // exit pad marker (green glow)
    const ew = cellToWorld(exitCell.i, exitCell.j);
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.12, 24),
      new THREE.MeshStandardMaterial({ color: 0x37d27a, emissive: 0x1f7a44, emissiveIntensity: 0.9 })
    );
    pad.position.set(ew.x, 0.06, ew.z);
    levelGroup.add(pad);
    const padLight = new THREE.PointLight(0x49e08a, 0.0, 14, 2);
    padLight.position.set(ew.x, 1.5, ew.z);
    padLight.userData.isExitLight = true;
    levelGroup.add(padLight);
    exitPad = pad; exitLight = padLight;

    scene.add(levelGroup);
  }
  let exitPad = null, exitLight = null;

  // ---------- entities ----------
  let enemies = [], pickups = [], tracers = [], bottlesInAir = [], noises = [];
  let enemyMeshes = [];   // for raycasting

  function makeEnemyMesh(type) {
    const g = new THREE.Group();
    const bodyColor = type === 'clicker' ? 0x9a9384 : 0x6e4038;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.5, 1.5, 10),
      new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.9 })
    );
    body.position.y = 0.95; body.castShadow = true;
    body.userData.isEnemyHit = true;
    g.add(body);
    const headColor = type === 'clicker' ? 0xd8cdb4 : 0x8a5246;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 12, 10),
      new THREE.MeshStandardMaterial({ color: headColor, roughness: 0.85 })
    );
    head.position.y = 1.95; head.castShadow = true;
    head.userData.isEnemyHit = true;
    g.add(head);
    if (type === 'clicker') {
      // fungal bloom
      for (let k = 0; k < 6; k++) {
        const b = new THREE.Mesh(
          new THREE.SphereGeometry(rand(0.12, 0.2), 7, 6),
          new THREE.MeshStandardMaterial({ color: 0xe7dcc2, emissive: 0x3a3320, emissiveIntensity: 0.3 })
        );
        const a = (k / 6) * TWO_PI;
        b.position.set(Math.cos(a) * 0.28, 1.95 + Math.sin(a) * 0.2, Math.sin(a) * 0.28);
        g.add(b);
      }
    } else {
      // eyes
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff3322, emissive: 0xaa1100, emissiveIntensity: 0.8 });
      for (const sx of [-0.13, 0.13]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), eyeMat);
        eye.position.set(sx, 2.0, 0.3);
        g.add(eye);
      }
    }
    return g;
  }

  function spawnEnemy(type, i, j) {
    const w = cellToWorld(i, j);
    const mesh = makeEnemyMesh(type);
    mesh.position.set(w.x, 0, w.z);
    scene.add(mesh);
    const e = {
      type, mesh, x: w.x, z: w.z, ang: rand(0, TWO_PI),
      hp: type === 'clicker' ? 70 : 45,
      maxHp: type === 'clicker' ? 70 : 45,
      speed: type === 'clicker' ? 1.7 : 2.5,
      chaseSpeed: type === 'clicker' ? 3.0 : 4.4,
      state: 'patrol', alert: 0, lastX: w.x, lastZ: w.z,
      wps: [], wpi: 0, investigateT: 0, atkCd: 0, dead: false, bob: rand(0, TWO_PI),
    };
    for (let k = 0; k < 4; k++) {
      let wx, wz, tries = 0;
      do { const di = Math.floor(rand(-4, 4)), dj = Math.floor(rand(-4, 4));
        const c = worldToCell(w.x, w.z);
        wx = (c.i + di + 0.5) * CS; wz = (c.j + dj + 0.5) * CS; tries++;
      } while (blocked(wx, wz, PLAYER_R) && tries < 14);
      e.wps.push({ x: wx, z: wz });
    }
    mesh.traverse(o => { if (o.userData.isEnemyHit) { o.userData.enemy = e; enemyMeshes.push(o); } });
    enemies.push(e);
  }

  function makePickupMesh(type) {
    const colors = { ammo: 0xe0c060, bottle: 0x7fb8a0, kit: 0x46c46e, supplies: 0x5aa0ff };
    const c = colors[type];
    let mesh;
    if (type === 'ammo') mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.6), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25 }));
    else if (type === 'bottle') mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25, transparent: true, opacity: 0.85 }));
    else if (type === 'kit') mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.25 }));
    else mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.5 }));
    return mesh;
  }
  function spawnPickup(type, i, j) {
    const w = cellToWorld(i, j);
    const mesh = makePickupMesh(type);
    mesh.position.set(w.x, 0.6, w.z);
    scene.add(mesh);
    const light = new THREE.PointLight({ ammo: 0xe0c060, bottle: 0x7fb8a0, kit: 0x46c46e, supplies: 0x5aa0ff }[type], 0.5, 4, 2);
    light.position.set(w.x, 0.8, w.z);
    scene.add(light);
    pickups.push({ type, mesh, light, x: w.x, z: w.z, taken: false, bob: rand(0, TWO_PI) });
  }

  function randomFloorCell(minDistFromSpawn) {
    for (let t = 0; t < 200; t++) {
      const i = Math.floor(rand(2, GW - 2)), j = Math.floor(rand(2, GH - 2));
      if (grid[j][i] !== 0) continue;
      const w = cellToWorld(i, j);
      if (Math.hypot(w.x - CS * 2.5, w.z - CS * 2.5) < minDistFromSpawn) continue;
      return { i, j };
    }
    return { i: Math.floor(GW / 2), j: Math.floor(GH / 2) };
  }

  // ---------- player ----------
  let player;
  function resetPlayer() {
    const w = cellToWorld(2, 2);
    player = { x: w.x, z: w.z, yaw: Math.PI / 4, pitch: 0, hp: 100, maxHp: 100,
      ammo: 8, bottles: 2, kits: 1, crouch: false, meleeCd: 0, hurtCd: 0, footT: 0, dead: false };
  }

  // ---------- world reset ----------
  let suppliesTaken = false, exitOpen = false, gameTime = 0, maxAlert = 0;
  function clearScene() {
    for (const e of enemies) scene.remove(e.mesh);
    for (const p of pickups) { scene.remove(p.mesh); scene.remove(p.light); }
    enemies = []; pickups = []; tracers.forEach(t => scene.remove(t.line)); tracers = [];
    bottlesInAir.forEach(b => scene.remove(b.mesh)); bottlesInAir = [];
    enemyMeshes = []; noises = [];
  }
  function resetWorld() {
    clearScene();
    genGrid();
    buildLevel();
    resetPlayer();
    // enemies
    const types = ['runner', 'clicker', 'runner', 'runner', 'clicker', 'runner', 'clicker', 'runner', 'runner', 'clicker'];
    for (const t of types) { const c = randomFloorCell(CS * 6); spawnEnemy(t, c.i, c.j); }
    // pickups
    const items = ['ammo', 'ammo', 'ammo', 'kit', 'kit', 'bottle', 'bottle', 'bottle'];
    for (const it of items) { const c = randomFloorCell(CS * 3); spawnPickup(it, c.i, c.j); }
    // supplies near exit corner
    spawnPickup('supplies', GW - 5, GH - 5);
    suppliesTaken = false; exitOpen = false; gameTime = 0; maxAlert = 0; flashOn = true;
    setObjective('Find the surgical supplies, then reach the green extraction pad.');
  }

  // ---------- audio ----------
  let AC = null;
  const actx = () => { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return AC; };
  function blip(f, d, type, v) { const ac = actx(); if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.value = v || 0.05; o.connect(g); g.connect(ac.destination); const n = ac.currentTime; g.gain.exponentialRampToValueAtTime(0.0001, n + d); o.start(n); o.stop(n + d); }
  function noise(d, v) { const ac = actx(); if (!ac) return; const n = Math.floor(ac.sampleRate * d); const buf = ac.createBuffer(1, n, ac.sampleRate); const dt = buf.getChannelData(0); for (let i = 0; i < n; i++) dt[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = ac.createBufferSource(); s.buffer = buf; const g = ac.createGain(); g.gain.value = v || 0.2; s.connect(g); g.connect(ac.destination); s.start(); }
  const sfx = {
    shot: () => { noise(0.18, 0.35); blip(110, 0.18, 'square', 0.12); },
    melee: () => noise(0.08, 0.18),
    hurt: () => blip(150, 0.18, 'sawtooth', 0.12),
    kill: () => { noise(0.12, 0.15); blip(80, 0.2, 'square', 0.08); },
    pickup: () => { blip(660, 0.08, 'triangle', 0.08); blip(880, 0.08, 'triangle', 0.06); },
    bottle: () => { blip(420, 0.12, 'triangle', 0.07); noise(0.06, 0.1); },
    click: () => blip(1200, 0.03, 'square', 0.05),
    win: () => { blip(523, 0.2, 'triangle', 0.1); setTimeout(() => blip(784, 0.3, 'triangle', 0.1), 180); },
  };

  // ---------- input ----------
  const keys = {};
  let state = 'menu';
  document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (state !== 'playing') return;
    if (e.code === 'KeyE') tryTakedown();
    if (e.code === 'KeyF') flashOn = !flashOn;
    if (e.code === 'KeyR') useKit();
    if (e.code === 'Space') melee();
  });
  document.addEventListener('keyup', e => { keys[e.code] = false; });

  canvas.addEventListener('click', () => {
    if (state === 'menu' || state === 'dead' || state === 'won') return;
    if (document.pointerLockElement !== canvas) { canvas.requestPointerLock(); return; }
  });
  document.addEventListener('mousemove', e => {
    if (document.pointerLockElement !== canvas || state !== 'playing') return;
    const sens = 0.0022;
    player.yaw -= e.movementX * sens;
    player.pitch = clamp(player.pitch - e.movementY * sens, -1.2, 1.2);
  });
  document.addEventListener('mousedown', e => {
    if (state !== 'playing' || document.pointerLockElement !== canvas) return;
    if (e.button === 0) shoot();
    if (e.button === 2) throwBottle();
  });
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas && state === 'playing') pause();
  });

  // ---------- actions ----------
  function forwardVec() { return { x: Math.sin(player.yaw), z: Math.cos(player.yaw) }; }

  function emitNoise(x, z, radius, strong) {
    noises.push({ x, z, r: radius, life: 0.45, max: 0.45 });
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      const hear = radius * (e.type === 'clicker' ? 1.4 : 1);
      if (d < hear && losClear(e.x, e.z, x, z)) {
        e.lastX = x; e.lastZ = z;
        e.alert = Math.min(1, e.alert + (strong ? 0.85 : 0.45));
        if (e.state === 'patrol') { e.state = 'investigate'; e.investigateT = 6; }
      }
    }
  }

  const raycaster = new THREE.Raycaster();
  function shoot() {
    if (player.dead) return;
    if (player.ammo <= 0) { toast('Out of ammo'); blip(200, 0.05, 'square', 0.04); return; }
    player.ammo--;
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    const hits = raycaster.intersectObjects(enemyMeshes, false);
    let end = raycaster.ray.at(60, new THREE.Vector3());
    if (hits.length) {
      const e = hits[0].object.userData.enemy;
      end = hits[0].point;
      if (e && !e.dead) {
        e.hp -= 55;
        if (e.hp <= 0) killEnemy(e); else { e.alert = 1; e.state = 'chase'; e.lastX = player.x; e.lastZ = player.z; }
      }
    }
    spawnTracer(camera.position.clone(), end);
    sfx.shot();
    flashMuzzle();
    emitNoise(player.x, player.z, 34, true);
  }

  function spawnTracer(a, b) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe69a }));
    scene.add(line);
    tracers.push({ line, life: 0.05 });
  }

  function throwBottle() {
    if (player.dead || player.bottles <= 0) { if (player.bottles <= 0) toast('No bottles'); return; }
    player.bottles--;
    const f = forwardVec();
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({ color: 0x9fd6c0 }));
    mesh.position.set(player.x, EYE, player.z);
    scene.add(mesh);
    bottlesInAir.push({ mesh, x: player.x, z: player.z, y: EYE, vx: f.x * 14, vz: f.z * 14, vy: 3, life: 2 });
    sfx.bottle();
  }

  function melee() {
    if (player.meleeCd > 0 || player.dead) return;
    player.meleeCd = 0.45; sfx.melee();
    const f = forwardVec();
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - player.x, e.z - player.z);
      if (d < 2.2) {
        const a = Math.atan2(e.x - player.x, e.z - player.z);
        if (Math.abs(angDiff(a, player.yaw)) < 1.0) {
          e.hp -= 48;
          if (e.hp <= 0) killEnemy(e); else { e.alert = 1; e.state = 'chase'; e.lastX = player.x; e.lastZ = player.z; }
        }
      }
    }
    emitNoise(player.x, player.z, 8, false);
  }

  function tryTakedown() {
    if (player.dead) return;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - player.x, e.z - player.z);
      if (d < 2.0) {
        const behind = Math.abs(angDiff(Math.atan2(player.x - e.x, player.z - e.z), e.ang)) < 1.2;
        const ok = e.type === 'clicker' ? player.crouch : (player.crouch && e.alert < 0.6 && behind);
        if (ok) { killEnemy(e, true); toast('Silent takedown'); return; }
      }
    }
  }

  function killEnemy(e, silent) {
    e.dead = true;
    scene.remove(e.mesh);
    enemyMeshes = enemyMeshes.filter(o => o.userData.enemy !== e);
    if (silent) blip(90, 0.12, 'sine', 0.05); else sfx.kill();
  }

  function useKit() {
    if (player.dead || player.kits <= 0 || player.hp >= player.maxHp) return;
    player.kits--; player.hp = Math.min(player.maxHp, player.hp + 55);
    sfx.pickup(); toast('Used health kit');
  }

  // ---------- update ----------
  function update(dt) {
    gameTime += dt;
    if (player.meleeCd > 0) player.meleeCd -= dt;
    if (player.hurtCd > 0) player.hurtCd -= dt;
    player.crouch = !!keys['ShiftLeft'] || !!keys['ShiftRight'];

    // movement (camera-relative)
    let mf = 0, ms = 0;
    if (keys['KeyW'] || keys['ArrowUp']) mf += 1;
    if (keys['KeyS'] || keys['ArrowDown']) mf -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) ms += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) ms -= 1;
    if (mf || ms) {
      const len = Math.hypot(mf, ms);
      const spd = (player.crouch ? 2.2 : 4.6) * dt;
      const fwd = forwardVec();
      const rgt = { x: Math.cos(player.yaw), z: -Math.sin(player.yaw) };
      let nx = player.x + (fwd.x * mf + rgt.x * ms) / len * spd;
      let nz = player.z + (fwd.z * mf + rgt.z * ms) / len * spd;
      if (!blocked(nx, player.z, PLAYER_R)) player.x = nx;
      if (!blocked(player.x, nz, PLAYER_R)) player.z = nz;
      player.footT -= dt;
      if (player.footT <= 0) {
        player.footT = player.crouch ? 0.55 : 0.34;
        emitNoise(player.x, player.z, player.crouch ? 2.5 : 7, false);
      }
    }

    // camera
    const eyeY = player.crouch ? EYE * 0.7 : EYE;
    camera.position.set(player.x, eyeY + Math.sin(gameTime * 8) * (mf || ms ? 0.03 : 0), player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);

    // flashlight follows camera
    flashlight.intensity = flashOn ? 2.4 : 0;
    flashlight.position.copy(camera.position);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    flashTarget.position.copy(camera.position).add(dir.multiplyScalar(10));

    // pickups
    for (const p of pickups) {
      if (p.taken) continue;
      p.mesh.rotation.y += dt * 1.5;
      p.mesh.position.y = 0.6 + Math.sin(gameTime * 3 + p.bob) * 0.1;
      if (Math.hypot(p.x - player.x, p.z - player.z) < 1.1) {
        p.taken = true; p.mesh.visible = false; p.light.visible = false; sfx.pickup();
        if (p.type === 'ammo') { player.ammo += 5; toast('+5 ammo'); }
        else if (p.type === 'bottle') { player.bottles += 2; toast('+2 bottles'); }
        else if (p.type === 'kit') { player.kits += 1; toast('+1 health kit'); }
        else if (p.type === 'supplies') { suppliesTaken = true; exitOpen = true; toast('Supplies secured — reach extraction!'); setObjective('Reach the glowing green extraction pad.'); }
      }
    }

    // exit
    if (exitLight) exitLight.intensity = exitOpen ? (1.2 + Math.sin(gameTime * 4) * 0.4) : 0;
    if (exitPad) exitPad.material.emissiveIntensity = exitOpen ? 1.4 : 0.3;
    if (exitOpen) {
      const ew = cellToWorld(exitCell.i, exitCell.j);
      if (Math.hypot(ew.x - player.x, ew.z - player.z) < 1.8) { win(); return; }
    }

    updateEnemies(dt);
    updateBottles(dt);
    for (const t of tracers) t.life -= dt;
    tracers = tracers.filter(t => { if (t.life <= 0) { scene.remove(t.line); return false; } return true; });
    for (const n of noises) n.life -= dt;
    noises = noises.filter(n => n.life > 0);

    maxAlert = enemies.reduce((m, e) => e.dead ? m : Math.max(m, e.alert), 0);
    if (player.hp <= 0 && !player.dead) { player.dead = true; die(); }
  }

  function canSee(e) {
    if (e.type === 'clicker') return false;
    const d = Math.hypot(player.x - e.x, player.z - e.z);
    let range = 26;
    if (player.crouch) range *= 0.6;
    if (d > range) return false;
    const a = Math.atan2(player.x - e.x, player.z - e.z);
    if (Math.abs(angDiff(a, e.ang)) > 0.95) return false;
    return losClear(e.x, e.z, player.x, player.z);
  }

  function updateEnemies(dt) {
    for (const e of enemies) {
      if (e.dead) continue;
      e.bob += dt * (e.state === 'chase' ? 12 : 5);
      if (e.atkCd > 0) e.atkCd -= dt;
      const pd = Math.hypot(player.x - e.x, player.z - e.z);
      const seeing = canSee(e);

      if (e.type === 'clicker' && pd < 4.5 && losClear(e.x, e.z, player.x, player.z)) {
        e.alert = Math.min(1, e.alert + dt * 1.5); e.lastX = player.x; e.lastZ = player.z;
        if (Math.random() < 0.02) sfx.click();
      }
      if (seeing) { e.alert = Math.min(1, e.alert + dt * (pd < 10 ? 2.4 : 1.4)); e.lastX = player.x; e.lastZ = player.z; }
      else e.alert = Math.max(0, e.alert - dt * 0.3);

      if (e.alert >= 1) e.state = 'chase';
      else if (e.state === 'chase' && e.alert < 0.35) { e.state = 'investigate'; e.investigateT = 4; }

      let tx, tz, spd;
      if (e.state === 'chase') {
        tx = e.lastX; tz = e.lastZ; spd = e.chaseSpeed;
        if (Math.hypot(e.x - tx, e.z - tz) < 0.6 && !seeing) { e.state = 'investigate'; e.investigateT = 4; }
      } else if (e.state === 'investigate') {
        tx = e.lastX; tz = e.lastZ; spd = e.speed * 1.1; e.investigateT -= dt;
        if (Math.hypot(e.x - tx, e.z - tz) < 0.7 || e.investigateT <= 0) e.state = 'patrol';
      } else {
        const wp = e.wps[e.wpi]; tx = wp.x; tz = wp.z; spd = e.speed;
        if (Math.hypot(e.x - tx, e.z - tz) < 0.7) e.wpi = (e.wpi + 1) % e.wps.length;
      }

      const desired = Math.atan2(tx - e.x, tz - e.z);
      e.ang += angDiff(desired, e.ang) * Math.min(1, dt * 6);
      const mx = Math.sin(e.ang) * spd * dt, mz = Math.cos(e.ang) * spd * dt;
      let moved = false;
      if (!blocked(e.x + mx, e.z, PLAYER_R)) { e.x += mx; moved = true; }
      if (!blocked(e.x, e.z + mz, PLAYER_R)) { e.z += mz; moved = true; }
      if (!moved && e.state === 'patrol') e.wpi = (e.wpi + 1) % e.wps.length;

      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = -e.ang + Math.PI;

      if (pd < 1.15) {
        if (e.type === 'clicker') { if (player.hurtCd <= 0) { player.hp = 0; player.hurtCd = 1; sfx.hurt(); damageFlash(); } }
        else if (e.atkCd <= 0) { e.atkCd = 0.7; player.hp -= 14; player.hurtCd = 0.3; sfx.hurt(); damageFlash(); }
      }
    }
  }

  function updateBottles(dt) {
    for (const b of bottlesInAir) {
      b.life -= dt; b.vy -= 14 * dt;
      let nx = b.x + b.vx * dt, nz = b.z + b.vz * dt;
      b.y += b.vy * dt;
      if (blocked(nx, nz, 0.1)) { b.vx *= -0.4; b.vz *= -0.4; nx = b.x; nz = b.z; }
      b.x = nx; b.z = nz;
      if (b.y <= 0.12) { b.y = 0.12; b.vy *= -0.4; b.vx *= 0.6; b.vz *= 0.6;
        if (Math.abs(b.vy) < 1.2 && b.life > 0) { // landed
          emitNoise(b.x, b.z, 18, true); sfx.bottle(); b.life = 0;
        }
      }
      b.mesh.position.set(b.x, b.y, b.z);
      if (b.life <= 0) b.dead = true;
    }
    bottlesInAir = bottlesInAir.filter(b => { if (b.dead) { scene.remove(b.mesh); return false; } return true; });
  }

  // ---------- HUD ----------
  function updateHUD() {
    if (!player) return;
    ui.hp.style.width = clamp(player.hp, 0, 100) + '%';
    ui.ammo.textContent = player.ammo;
    ui.bottles.textContent = player.bottles;
    ui.kits.textContent = player.kits;
    if (maxAlert >= 1) { ui.alert.textContent = 'SPOTTED'; ui.alert.className = 'alert spotted'; }
    else if (maxAlert > 0.35) { ui.alert.textContent = 'HUNTING'; ui.alert.className = 'alert hunting'; }
    else { ui.alert.textContent = 'HIDDEN'; ui.alert.className = 'alert hidden'; }
  }
  function setObjective(t) { ui.objective.textContent = t; }
  let toastT = 0;
  function toast(t) { ui.toast.textContent = t; ui.toast.classList.add('show'); toastT = 2.4; }
  function damageFlash() { ui.flash.style.opacity = '0.55'; }
  function flashMuzzle() { ui.flash.style.background = 'radial-gradient(circle, rgba(255,220,120,0.25), transparent 60%)'; ui.flash.style.opacity = '0.5'; setTimeout(() => { ui.flash.style.background = 'rgba(140,0,0,0.6)'; }, 60); }

  // ---------- overlay / state ----------
  function ctrlsHTML() {
    return `<div class="ctrls">
      <span><b>Mouse</b> — Look &nbsp; <b>WASD</b> — Move</span>
      <span><b>Hold Shift</b> — Crouch (quiet & lower profile)</span>
      <span><b>Left-Click</b> — Fire pistol (loud!) &nbsp; <b>Right-Click</b> — Throw bottle</span>
      <span><b>Space</b> — Melee &nbsp; <b>E</b> — Stealth takedown (crouch / from behind)</span>
      <span><b>R</b> — Health kit &nbsp; <b>F</b> — Flashlight &nbsp; <b>Esc</b> — Pause</span>
    </div>`;
  }
  function showOverlay(title, text, btn) {
    ui.overlayTitle.textContent = title; ui.overlayText.innerHTML = text;
    ui.overlayBtn.textContent = btn; ui.overlayBtn.style.display = '';
    ui.overlay.classList.add('show'); ui.crosshair.style.display = 'none';
  }
  function hideOverlay() { ui.overlay.classList.remove('show'); ui.crosshair.style.display = 'block'; }
  function startGame() { resetWorld(); state = 'playing'; hideOverlay(); actx(); canvas.requestPointerLock(); }
  function pause() { if (state !== 'playing') return; state = 'paused'; showOverlay('Paused', ctrlsHTML(), 'Resume'); }
  function resume() { state = 'playing'; hideOverlay(); canvas.requestPointerLock(); }
  function die() { state = 'dead'; document.exitPointerLock(); showOverlay('You did not make it', 'The Infected caught you in the ruins of Seattle.<br>Stay low. Stay quiet. Try again.', 'Retry'); }
  function win() { state = 'won'; document.exitPointerLock(); sfx.win(); showOverlay('Extracted', 'You secured the supplies and slipped out alive.<br><b>Survivor.</b>', 'Play again'); }

  ui.overlayBtn.addEventListener('click', () => { if (state === 'paused') resume(); else startGame(); });

  // ---------- loop ----------
  let last = performance.now();
  function loop(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;
    if (state === 'playing') { update(dt); updateHUD(); }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) ui.toast.classList.remove('show'); }
    // fade damage/muzzle flash
    const cur = parseFloat(ui.flash.style.opacity || '0');
    if (cur > 0) ui.flash.style.opacity = Math.max(0, cur - dt * 1.6).toString();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  // boot: build a level for the menu backdrop
  genGrid(); buildLevel(); resetPlayer();
  camera.position.set(player.x, EYE, player.z);
  camera.rotation.set(0, player.yaw, 0);
  showOverlay('THE LAST OF US — PART II',
    '<i>Unofficial 3D fan tribute · original code &amp; geometry</i><br><br>' +
    'Seattle has fallen. Scavenge the surgical supplies and reach extraction — but the Infected hunt by sight and sound. ' +
    'Crouch to stay quiet, distract them with bottles, and save your bullets.' + ctrlsHTML(),
    'Click to Start');
  requestAnimationFrame(loop);
})();
