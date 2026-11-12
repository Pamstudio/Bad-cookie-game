/* Genre: platformer (C.genre "platformer") and auto-runner (C.genre "runner").
   Level map legend: # solid, = platform, ^ spikes, * collectible, E exit, P start, e enemy, C checkpoint, . empty
   The player moves with a fixed-step tile controller (step()); the QA planner runs the same function, so a plan
   found by the planner replays exactly in the game. */
(function () {
  'use strict';
  const { W, H, C, QA, palette } = GK;
  const RUNNER = C.genre === 'runner';
  const T = C.tileSize || 48;
  const PHYS = Object.assign({ gravity: 1500, jump: 760, speed: 280, runSpeed: 300, lives: 3, enemySpeed: 80 }, C.physics || {});
  const BW = Math.round(T * 0.6);
  const BH = Math.round(T * 0.9);
  const DT = 1 / 60;
  const COYOTE = 6;
  const SOLID = '#=';

  function parse(level) {
    const rows = level.map.map((r) => r.replace(/ /g, '.'));
    const width = Math.max(...rows.map((r) => r.length));
    return { grid: rows.map((r) => r.padEnd(width, '.').split('')), cols: width, rows: rows.length };
  }

  const cellAt = (g, c, r) => (r < 0 || r >= g.rows || c < 0 || c >= g.cols ? '.' : g.grid[r][c]);
  const solidAt = (g, c, r) => c < 0 || c >= g.cols || (r >= 0 && r < g.rows && SOLID.includes(g.grid[r][c]));

  /* One 60 Hz step. s = { x, y, vy, ground, coyote }, x/y = body top-left. Mutates s, returns 'spike' | 'fall' | 'wall' | null. */
  function step(g, s, dir, jump) {
    const vx = RUNNER ? PHYS.runSpeed : dir * PHYS.speed;
    if (jump && (s.ground || s.coyote > 0)) { s.vy = -PHYS.jump; s.ground = false; s.coyote = 0; s.jumped = true; }
    s.vy = Math.min(s.vy + PHYS.gravity * DT, 1100);
    let hitWall = false;
    s.x += vx * DT;
    const r0 = Math.floor(s.y / T);
    const r1 = Math.floor((s.y + BH - 1) / T);
    if (vx > 0) {
      const c = Math.floor((s.x + BW - 1) / T);
      for (let r = r0; r <= r1; r++) if (solidAt(g, c, r)) { s.x = c * T - BW; hitWall = true; break; }
    } else if (vx < 0) {
      const c = Math.floor(s.x / T);
      for (let r = r0; r <= r1; r++) if (solidAt(g, c, r)) { s.x = (c + 1) * T; hitWall = true; break; }
    }
    s.y += s.vy * DT;
    const wasGround = s.ground;
    s.ground = false;
    const c0 = Math.floor(s.x / T);
    const c1 = Math.floor((s.x + BW - 1) / T);
    if (s.vy > 0) {
      const r = Math.floor((s.y + BH) / T);
      for (let c = c0; c <= c1; c++) if (solidAt(g, c, r)) { s.y = r * T - BH; s.vy = 0; s.ground = true; break; }
    } else if (s.vy < 0) {
      const r = Math.floor(s.y / T);
      for (let c = c0; c <= c1; c++) if (solidAt(g, c, r)) { s.y = (r + 1) * T; s.vy = 0; break; }
    }
    s.coyote = s.ground ? COYOTE : wasGround ? COYOTE - 1 : Math.max(0, s.coyote - 1);
    for (let r = Math.floor((s.y + 6) / T); r <= Math.floor((s.y + BH - 1) / T); r++) {
      for (let c = Math.floor((s.x + 6) / T); c <= Math.floor((s.x + BW - 7) / T); c++) if (cellAt(g, c, r) === '^') return 'spike';
    }
    if (s.y > g.rows * T + T) return 'fall';
    if (RUNNER && hitWall) return 'wall';
    return null;
  }

  const overlaps = (s, cx, cy, half) => s.x < cx + half && s.x + BW > cx - half && s.y < cy + half && s.y + BH > cy - half;

  class Play extends Phaser.Scene {
    constructor() { super('Play'); }

    init(data) { this.levelId = data.id; }

    create() {
      const level = C.levels[this.levelId];
      this.level = level;
      this.g = parse(level);
      const loc = C.locations[level.location] || {};
      const worldW = this.g.cols * T;
      const worldH = this.g.rows * T;
      this.physics.world.gravity.y = PHYS.gravity;
      this.physics.world.setBounds(0, 0, worldW, worldH + T * 4);

      const bgKey = GK.keys.bg(level.location);
      const bgTex = this.textures.get(bgKey).getSourceImage();
      const bgScale = H / bgTex.height;
      this.bg = this.add.tileSprite(0, 0, W, H, bgKey).setOrigin(0).setScrollFactor(0).setTileScale(bgScale, bgScale);

      this.makeTileTextures(loc);
      this.solids = this.physics.add.staticGroup();
      this.enemies = this.physics.add.group();
      this.pickups = [];
      const itemId = level.collectible || Object.keys(C.items || {})[0];
      this.itemId = itemId;
      this.stomped = [];
      this.cpCell = null;
      this.safe = null;
      this.invuln = false;
      const foeId = level.enemy || Object.keys(C.characters).find((id) => C.characters[id].role === 'enemy');

      this.g.grid.forEach((row, r) => row.forEach((ch, c) => {
        const x = c * T + T / 2;
        const y = r * T + T / 2;
        if (ch === '#' || ch === '=') {
          const key = ch === '=' ? 'tile-plat' : SOLID.includes(cellAt(this.g, c, r - 1)) ? 'tile-fill' : 'tile-top';
          this.solids.create(x, y, key).refreshBody();
        } else if (ch === '^') {
          this.add.image(x, y, 'tile-spike');
        } else if (ch === '*') {
          const p = this.add.image(x, y, GK.keys.item(itemId)).setDisplaySize(T * 0.8, T * 0.8);
          this.tweens.add({ targets: p, y: y - 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
          this.pickups.push({ c, r, x, y, sprite: p, taken: false });
        } else if (ch === 'E') {
          this.add.image(x, y, 'tile-door');
          this.exitCell = { c, r, x, y };
        } else if (ch === 'P') {
          this.spawn = { x: c * T + (T - BW) / 2, y: (r + 1) * T - BH };
        } else if (ch === 'e' && foeId) {
          this.addEnemy(x, r, foeId).cell = c + ',' + r;
        } else if (ch === 'C') {
          this.add.image(x, y, 'tile-flag');
          (this.checkpoints = this.checkpoints || []).push({ c, r });
        }
      }));
      this.need = level.need != null ? Math.min(level.need, this.pickups.length) : RUNNER ? 0 : this.pickups.length;
      this.checkpoint = Object.assign({}, this.spawn);
      this.s = { x: this.spawn.x, y: this.spawn.y, vy: 0, ground: false, coyote: 0 };

      const heroId = level.hero || C.hero || Object.keys(C.characters).find((id) => C.characters[id].role === 'hero');
      this.hero = GK.actor(this, heroId, 0, 0, { height: T * 1.3, depth: 10 });
      this.camTarget = this.add.rectangle(this.s.x, this.s.y, 2, 2, 0, 0);
      this.physics.add.collider(this.enemies, this.solids);

      const cam = this.cameras.main;
      cam.setBounds(0, Math.min(0, worldH - H), worldW, Math.max(worldH, H));
      cam.startFollow(this.camTarget, true, 0.12, 0.12, RUNNER ? -W * 0.25 : 0, 0);
      cam.setDeadzone(RUNNER ? 0 : 120, 80);

      this.keys = this.input.keyboard ? this.input.keyboard.addKeys('LEFT,RIGHT,UP,SPACE,A,D,W') : {};
      this.pad = GK.touchPad(this, RUNNER ? [] : ['left', 'right', 'jump']);
      if (RUNNER) this.input.on('pointerdown', () => { this.tapJump = 8; });
      this.lives = PHYS.lives;
      this.collected = 0;
      this.acc = 0;
      this.jumpBuffer = 0;
      this.jumpHeld = false;
      this.auto = null;
      this.hud = GK.hud(this);
      GK.setState({ scene: 'Play', level: this.levelId, status: 'playing', score: 0, collected: 0, need: this.need, lives: this.lives, moves: null });
      this.updateHud();
      GK.music(this, GK.keys.music(level.location));
      cam.fadeIn(QA ? 0 : 250);
      if (level.intro) {
        const sp = GK.speech(this, level.intro.speaker, level.intro.text, 180);
        this.time.delayedCall(QA ? 10 : 3200, () => sp.destroy());
      }
    }

    makeTileTextures(loc) {
      const base = GK.color(loc.ground || loc.tint || '#5a3d2b');
      const top = GK.color(loc.groundTop || '#6cc04a');
      const mk = (key, draw) => {
        if (this.textures.exists(key)) this.textures.remove(key);
        const g = this.make.graphics({ x: 0, y: 0 }, false);
        draw(g);
        g.generateTexture(key, T, T);
        g.destroy();
      };
      mk('tile-fill', (g) => { g.fillStyle(base, 1).fillRect(0, 0, T, T); g.fillStyle(0x000000, 0.12).fillRect(4, 6, 8, 6).fillRect(T - 16, T - 14, 10, 6); });
      mk('tile-top', (g) => { g.fillStyle(base, 1).fillRect(0, 0, T, T); g.fillStyle(top, 1).fillRect(0, 0, T, T * 0.28); g.fillStyle(0xffffff, 0.18).fillRect(0, 0, T, 4); });
      mk('tile-plat', (g) => { g.fillStyle(GK.color(loc.platform || '#b07a45'), 1).fillRoundedRect(0, 0, T, T * 0.9, 8); g.fillStyle(0x000000, 0.18).fillRect(0, T * 0.6, T, 4); });
      mk('tile-spike', (g) => { g.fillStyle(0xdddddd, 1); for (let i = 0; i < 3; i++) g.fillTriangle(i * T / 3, T, i * T / 3 + T / 6, T * 0.35, (i + 1) * T / 3, T); });
      mk('tile-door', (g) => { g.fillStyle(GK.color(palette.accent), 1).fillRoundedRect(T * 0.1, 0, T * 0.8, T, { tl: T * 0.4, tr: T * 0.4, bl: 0, br: 0 }); g.fillStyle(0x000000, 0.35).fillRoundedRect(T * 0.22, T * 0.14, T * 0.56, T * 0.86, { tl: T * 0.3, tr: T * 0.3, bl: 0, br: 0 }); });
      mk('tile-flag', (g) => { g.fillStyle(0xffffff, 1).fillRect(T * 0.2, 0, 5, T); g.fillStyle(GK.color(palette.accent), 1).fillTriangle(T * 0.2 + 5, 2, T * 0.85, T * 0.2, T * 0.2 + 5, T * 0.4); });
    }

    addEnemy(x, r, foeId) {
      const b = this.add.rectangle(x, (r + 1) * T - BH / 2, BW, BH, 0, 0);
      this.physics.add.existing(b);
      this.enemies.add(b);
      b.body.setVelocityX(-PHYS.enemySpeed);
      b.sprite = GK.actor(this, foeId, x, 0, { height: T * 1.1, depth: 9 }).setMotion('walk', 0.8);
      return b;
    }

    collect(p) {
      GK.outcome(this, { kind: 'pickup', match: 'overlap', mover: GK.bodyOf(this.hero, { id: 'hero' }), target: GK.bodyOf(p.sprite, { id: 'pickup' }) });
      p.taken = true;
      p.sprite.destroy();
      this.collected++;
      GK.sfx(this, 'collect');
      const fx = this.add.circle(p.x, p.y, 10, GK.color(palette.accent)).setDepth(20);
      this.tweens.add({ targets: fx, scale: 3, alpha: 0, duration: 300, onComplete: () => fx.destroy() });
      GK.setState({ collected: this.collected, score: GK.state.score + 10 });
      this.updateHud();
    }

    hurt() {
      if (this.invuln || GK.state.status !== 'playing') return;
      this.lives--;
      GK.setState({ lives: this.lives });
      GK.sfx(this, 'hurt');
      this.cameras.main.shake(180, 0.01);
      this.updateHud();
      if (this.lives <= 0) return GK.levelLost(this);
      this.invuln = true;
      Object.assign(this.s, { x: this.checkpoint.x, y: this.checkpoint.y, vy: 0, ground: false, coyote: 0 });
      if (this.auto) this.auto.reset();
      this.tweens.add({ targets: this.hero, alpha: 0.3, duration: 120, yoyo: true, repeat: 5, onComplete: () => { this.invuln = false; this.hero.setAlpha(1); } });
    }

    updateHud() {
      this.hud.set([this.need ? '★ ' + this.collected + '/' + this.need : null, '♥ ' + this.lives, 'Score ' + GK.state.score]);
    }

    readInput() {
      if (this.auto) return this.auto.input();
      const k = this.keys;
      const left = (k.LEFT && k.LEFT.isDown) || (k.A && k.A.isDown) || this.pad.left;
      const right = (k.RIGHT && k.RIGHT.isDown) || (k.D && k.D.isDown) || this.pad.right;
      const jump = (k.UP && k.UP.isDown) || (k.SPACE && k.SPACE.isDown) || (k.W && k.W.isDown) || this.pad.jump || this.tapJump > 0;
      if (this.tapJump > 0) this.tapJump--;
      return { dir: right ? 1 : left ? -1 : 0, jump };
    }

    update(time, delta) {
      if (GK.state.status !== 'playing') return;
      this.acc = Math.min(this.acc + delta / 1000, DT * 5);
      while (this.acc >= DT && GK.state.status === 'playing') {
        this.acc -= DT;
        this.fixedStep();
      }
      const s = this.s;
      const moving = RUNNER || this.lastDir !== 0;
      if (s.ground && !this.wasGround) this.hero.land();
      this.wasGround = s.ground;
      this.hero.setMotion(!s.ground ? 'jump' : moving ? 'walk' : 'idle', RUNNER ? 1.4 : 1).setFeet(s.x + BW / 2, s.y + BH);
      this.camTarget.setPosition(s.x + BW / 2, s.y + BH / 2);
      this.enemies.getChildren().forEach((e) => {
        if (!e.active) return;
        const eb = e.body;
        if (this.auto) { eb.setVelocity(0, 0); } else {
          const ahead = Math.floor((e.x + Math.sign(eb.velocity.x || -1) * (BW / 2 + 2)) / T);
          if (eb.blocked.left || eb.blocked.right || (eb.blocked.down && !solidAt(this.g, ahead, Math.floor(e.y / T) + 1))) {
            eb.setVelocityX((eb.blocked.left ? 1 : eb.blocked.right ? -1 : -Math.sign(eb.velocity.x || -1)) * PHYS.enemySpeed);
          }
        }
        e.sprite.setFeet(e.x, e.y + BH / 2).face(eb.velocity.x > 0 ? 1 : -1).setMotion(eb.velocity.x ? 'walk' : 'idle', 0.8);
      });
      this.bg.tilePositionX = (this.cameras.main.scrollX * 0.3) / this.bg.tileScaleX;
      GK.setState({ player: { x: Math.round(s.x), y: Math.round(s.y), c: Math.floor((s.x + BW / 2) / T), r: Math.floor((s.y + BH / 2) / T), onGround: s.ground } });
    }

    fixedStep() {
      const input = this.readInput();
      const pressed = input.jump && !this.jumpHeld;
      this.jumpHeld = input.jump;
      this.jumpBuffer = pressed ? 7 : Math.max(0, this.jumpBuffer - 1);
      const s = this.s;
      s.jumped = false;
      const result = step(this.g, s, input.dir, this.jumpBuffer > 0);
      if (s.jumped) {
        this.jumpBuffer = 0;
        GK.sfx(this, 'jump');
      }
      if (!input.jump && s.vy < -PHYS.jump * 0.45 && !this.auto) s.vy = -PHYS.jump * 0.45;
      this.lastDir = input.dir;
      if (!RUNNER && input.dir !== 0) this.hero.face(input.dir);
      if (this.auto) this.auto.after(s);
      if (result) return this.hurt();
      if (s.ground && !this.invuln) this.safe = { x: s.x, y: s.y };

      this.pickups.forEach((p) => { if (!p.taken && overlaps(s, p.x, p.y, T * 0.4)) this.collect(p); });
      (this.checkpoints || []).forEach((cp) => {
        if (!overlaps(s, cp.c * T + T / 2, cp.r * T + T / 2, T / 2)) return;
        this.checkpoint = { x: cp.c * T + (T - BW) / 2, y: (cp.r + 1) * T - BH };
        if (this.cpCell !== cp.c + ',' + cp.r) { this.cpCell = cp.c + ',' + cp.r; GK.autosave(this); }
      });
      if (!this.auto) {
        this.enemies.getChildren().forEach((e) => {
          if (!e.active || this.invuln || !overlaps(s, e.x, e.y, BW / 2)) return;
          if (s.vy > 0 && s.y + BH <= e.y - BH / 2 + 16) {
            if (e.cell) this.stomped.push(e.cell);
            e.sprite.destroy();
            e.destroy();
            s.vy = -PHYS.jump * 0.6;
            GK.sfx(this, 'stomp');
            GK.setState({ score: GK.state.score + 25 });
            this.updateHud();
          } else {
            this.hurt();
          }
        });
      }
      if (this.exitCell && overlaps(s, this.exitCell.x, this.exitCell.y, T * 0.35)) {
        if (this.collected >= this.need) GK.levelWon(this);
        else if (!this.hintShown) {
          this.hintShown = true;
          GK.toast(this, 'Collect ' + (this.need - this.collected) + ' more!');
          this.time.delayedCall(1500, () => { this.hintShown = false; });
        }
      }
    }

    /* ---------- save and resume ----------
       The ledger lists the collected pickups by map cell, so they stay collected; the hero comes back on the last
       ground it stood on (or the last checkpoint) with the lives it had. */

    snapshot() {
      return {
        ledger: this.pickups.filter((p) => p.taken).map((p) => p.c + ',' + p.r),
        stomped: this.stomped.slice(),
        cp: this.cpCell || null,
        at: !RUNNER && this.safe ? [Math.round(this.safe.x), Math.round(this.safe.y)] : null,
        lives: this.lives,
      };
    }

    /* A body at (x, y) stands there: inside the map, nothing solid or sharp in it, ground under its feet. */
    standsAt(x, y) {
      if (!(x >= 0 && y >= 0 && x + BW <= this.g.cols * T && y + BH <= this.g.rows * T)) return false;
      const c0 = Math.floor(x / T);
      const c1 = Math.floor((x + BW - 1) / T);
      for (let r = Math.floor(y / T); r <= Math.floor((y + BH - 1) / T); r++) {
        for (let c = c0; c <= c1; c++) if (solidAt(this.g, c, r) || cellAt(this.g, c, r) === '^') return false;
      }
      const below = Math.floor((y + BH) / T);
      for (let c = c0; c <= c1; c++) if (solidAt(this.g, c, below)) return true;
      return false;
    }

    restore(snap) {
      const taken = new Set(Array.isArray(snap.ledger) ? snap.ledger : []);
      this.pickups.forEach((p) => {
        if (p.taken || !taken.has(p.c + ',' + p.r)) return;
        p.taken = true;
        p.sprite.destroy();
        this.collected++;
      });
      const gone = new Set(Array.isArray(snap.stomped) ? snap.stomped : []);
      this.enemies.getChildren().slice().forEach((e) => {
        if (!e.cell || !gone.has(e.cell)) return;
        this.stomped.push(e.cell);
        e.sprite.destroy();
        e.destroy();
      });
      const cp = (this.checkpoints || []).find((k) => k.c + ',' + k.r === snap.cp);
      if (cp) {
        this.cpCell = snap.cp;
        this.checkpoint = { x: cp.c * T + (T - BW) / 2, y: (cp.r + 1) * T - BH };
      }
      const at = Array.isArray(snap.at) && this.standsAt(snap.at[0], snap.at[1]) ? { x: snap.at[0], y: snap.at[1] } : this.checkpoint;
      Object.assign(this.s, { x: at.x, y: at.y, vy: 0, ground: false, coyote: 0 });
      this.safe = { x: at.x, y: at.y };
      if (typeof snap.lives === 'number' && snap.lives > 0) this.lives = Math.min(snap.lives, PHYS.lives);
      this.camTarget.setPosition(at.x + BW / 2, at.y + BH / 2);
      this.cameras.main.centerOn(at.x + BW / 2, at.y + BH / 2);
      /* A moment of grace: the player has just come back. */
      this.invuln = true;
      this.time.delayedCall(1200, () => { this.invuln = false; });
      GK.setState({ collected: this.collected, lives: this.lives });
      this.updateHud();
    }

    ledger() {
      return { got: this.collected, of: this.pickups.length, items: this.collected && this.itemId ? [this.itemId] : [] };
    }

    /* ---------- QA autopilot ----------
       Enemies are paused and harmless while it runs; it proves the terrain is beatable with real inputs. */

    goals() {
      const list = this.collected >= this.need && RUNNER ? [] : this.pickups.filter((p) => !p.taken).map((p) => ({ x: p.x, y: p.y, half: T * 0.4 }));
      if (this.collected >= this.need && this.exitCell) list.push({ x: this.exitCell.x, y: this.exitCell.y, half: T * 0.35 });
      return list;
    }

    /* Simulate a policy from a standing state with the game's own step(). */
    rollout(s0, policy, goals, maxFrames) {
      const s = Object.assign({}, s0);
      let held = false;
      let buffer = 0;
      let airborne = false;
      for (let f = 0; f < maxFrames; f++) {
        const { dir, jump } = policy(f, s);
        buffer = jump && !held ? 7 : Math.max(0, buffer - 1);
        held = jump;
        s.jumped = false;
        const res = step(this.g, s, dir, buffer > 0);
        if (s.jumped) buffer = 0;
        if (res) return { s, dead: true, frames: f };
        if (goals.some((g) => overlaps(s, g.x, g.y, g.half))) return { s, hit: true, frames: f + 1 };
        if (!s.ground) airborne = true;
        else if (airborne && policy.landing !== false) return { s, frames: f + 1 };
      }
      return { s, frames: maxFrames };
    }

    policies() {
      const list = [];
      if (RUNNER) {
        for (const wait of [0, 3, 6, 9, 12, 15, 18, 22, 26, 30, 36, 42]) list.push({ wait, fn: (f) => ({ dir: 1, jump: f >= wait && f < wait + 24 }) });
        return list;
      }
      for (const dir of [-1, 1]) {
        list.push({ fn: () => ({ dir, jump: false }) });
        for (const start of [0, 8, 16, 24]) {
          for (const stop of [12, 24, 999]) {
            if (stop > start) list.push({ fn: (f) => ({ dir: f >= start && f < stop ? dir : 0, jump: f < 24 }) });
          }
        }
      }
      list.push({ fn: (f) => ({ dir: 0, jump: f < 24 }) });
      return list;
    }

    standSpots(s) {
      const r = Math.floor((s.y + BH) / T);
      const free = (c) => solidAt(this.g, c, r) && !solidAt(this.g, c, r - 1) && cellAt(this.g, c, r - 1) !== '^';
      let cL = Math.floor((s.x + BW / 2) / T);
      let cR = cL;
      while (cL > 0 && free(cL - 1)) cL--;
      while (cR < this.g.cols - 1 && free(cR + 1)) cR++;
      const xs = [];
      for (let c = cL; c <= cR; c++) xs.push(c * T + (T - BW) / 2);
      xs.push(cL * T, (cR + 1) * T - BW);
      return xs;
    }

    /* BFS over landing states. Platformer edge = walk to a spot on the ledge, then one policy.
       Runner edge = keep running for `wait` frames, then jump. Returns the first edge toward the nearest goal. */
    plan() {
      const goals = this.goals();
      const start = { x: this.s.x, y: this.s.y, vy: 0, ground: true, coyote: COYOTE };
      const keyOf = (s) => Math.round(s.x / 12) + ':' + Math.round(s.y / 12);
      const seen = new Set([keyOf(start)]);
      let frontier = [{ s: start, first: null }];
      const pols = this.policies();
      for (let depth = 0; depth < 24 && frontier.length; depth++) {
        const nextF = [];
        for (const node of frontier) {
          const spots = RUNNER ? [node.s.x] : this.standSpots(node.s);
          for (const x of spots) {
            let pre = node.s;
            if (!RUNNER) {
              const walkPolicy = (f, s) => ({ dir: Math.abs(x - s.x) <= PHYS.speed * DT ? 0 : Math.sign(x - s.x), jump: false });
              walkPolicy.landing = false;
              const walk = this.rollout(node.s, walkPolicy, goals, Math.ceil(Math.abs(x - node.s.x) / (PHYS.speed * DT)) + 1);
              if (walk.dead || !walk.s.ground) continue;
              if (walk.hit) return node.first || { walkTo: x, policy: null };
              pre = Object.assign({}, walk.s, { x, vy: 0, ground: true, coyote: COYOTE });
            }
            for (const p of pols) {
              const res = this.rollout(pre, p.fn, goals, 300);
              if (res.dead || (!res.hit && !res.s.ground)) continue;
              const first = node.first || { walkTo: RUNNER ? null : x, policy: p };
              if (res.hit) return first;
              const k = keyOf(res.s);
              if (seen.has(k)) continue;
              seen.add(k);
              nextF.push({ s: res.s, first });
            }
          }
        }
        frontier = nextF;
      }
      return null;
    }

    /* What the physics checks look at: the hero and enemies standing on the tiles. surfaceY comes from the map,
       not from the drawn sprite, so a sprite drawn above or into the ground is caught. */
    bodies() {
      const list = [];
      const s = this.s;
      const surface = (bottom) => {
        const r = Math.round(bottom / T);
        return { r, y: r * T };
      };
      const hs = surface(s.y + BH);
      list.push(GK.bodyOf(this.hero, { id: 'hero', role: 'hero', grounded: true, airborne: !s.ground, surfaceY: hs.y }));
      this.enemies.getChildren().forEach((e, i) => {
        if (!e.active || !e.sprite) return;
        const down = e.body.blocked.down || e.body.touching.down;
        list.push(GK.bodyOf(e.sprite, { id: 'enemy-' + i, role: 'enemy', grounded: true, airborne: !down, surfaceY: surface(e.body.bottom).y }));
      });
      return list;
    }

    /* opts.skill 'casual': each planned move is walked to a slightly wrong spot and jumped a little early or
       late (a few frames, like a person), so the playtest can measure how forgiving a level is. */
    startAutopilot(opts) {
      const scene = this;
      const casual = opts && opts.skill === 'casual';
      let action = null;
      let frame = 0;
      let phase = 'plan';
      let airborne = false;
      let jitter = 0;
      this.auto = {
        reset() { action = null; phase = 'plan'; },
        input() {
          if (phase === 'plan') {
            if (!scene.s.ground) return { dir: 0, jump: false };
            action = scene.plan();
            if (!action) { scene.autoStuck = true; return { dir: 0, jump: false }; }
            scene.autoStuck = false;
            if (casual) {
              jitter = Math.round(GK.gauss() * 2);
              if (action.walkTo != null) action = Object.assign({}, action, { walkTo: action.walkTo + GK.gauss() * T * 0.15 });
            }
            phase = action.walkTo != null ? 'walk' : 'act';
            frame = 0;
            airborne = false;
            scene.jumpHeld = false;
            scene.jumpBuffer = 0;
          }
          if (phase === 'walk') {
            const dx = action.walkTo - scene.s.x;
            if (Math.abs(dx) <= PHYS.speed * DT) {
              scene.s.x = action.walkTo;
              phase = action.policy ? 'act' : 'plan';
              frame = 0;
              scene.jumpHeld = false;
              scene.jumpBuffer = 0;
              if (phase === 'plan') return { dir: 0, jump: false };
            } else {
              return { dir: Math.sign(dx), jump: false };
            }
          }
          const out = action.policy.fn(Math.max(0, frame + jitter), scene.s);
          frame++;
          return out;
        },
        after(s) {
          if (phase !== 'act') return;
          if (!s.ground) airborne = true;
          else if (airborne || frame > 300) phase = 'plan';
        },
      };
    }

    qaWin() {
      this.pickups.filter((p) => !p.taken).forEach((p) => this.collect(p));
      if (this.exitCell) Object.assign(this.s, { x: this.exitCell.x - BW / 2, y: this.exitCell.y - BH / 2, vy: 0 });
    }

    describe() {
      const p = GK.state.player || {};
      return 'player cell=(' + p.c + ',' + p.r + ') onGround=' + p.onGround + ' lives=' + this.lives +
        ' pickups_left=' + this.pickups.filter((x) => !x.taken).length + ' exit=' + JSON.stringify(this.exitCell ? { c: this.exitCell.c, r: this.exitCell.r } : null) +
        (this.autoStuck ? ' AUTOPILOT_NO_PATH' : '');
    }
  }

  GK.playScene = Play;
  GK.genre.autoplay = (scene, opts) => scene.startAutopilot && scene.startAutopilot(opts);
  GK.genre.qaWin = (scene) => scene.qaWin && scene.qaWin();
  GK.genre.describe = (scene) => scene.describe();
  GK.genre.bodies = (scene) => scene.bodies();
  GK.genre.snapshot = (scene) => scene.snapshot();
  GK.genre.restore = (scene, snap) => scene.restore(snap);
  GK.genre.ledger = (scene) => scene.ledger();
  GK.genre.collects = true;
})();
