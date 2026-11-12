/* BAD COOKIE: the game's own layer on top of the engine.
   - Host bridge: the exit X (always on screen) and "¡Quiero una cookie!" tell the page around the game
     (postMessage + window events) and can open the links set in index.html (BAD_COOKIE_CONFIG) or the URL (?exit=, ?order=).
   - Park: the animated intro in the park and the two clickable signs ("Quedarme sentado" / "¡A ENTRENAR!").
   - Play: the 8-cookie bar next to the X, and the LEVEL UP (Badi's next body) at the end of tramos 1-3.
   - End: the 100 kg finale (golden-hair wink, El Grandote peeking from a bush) with "¡Quiero una cookie!".
   Loaded after play.js and before main.js. */
(function () {
  'use strict';
  const { W, H, C, QA, palette } = GK;
  const BAGEL = '"BC Bagel", "Trebuchet MS", Impact, sans-serif';
  const OUTFIT = '"BC Outfit", "Trebuchet MS", sans-serif';
  const LIME = '#C8FF2E', VIOLET = '#7B3FF2', CREAM = '#FFF1D6', BROWN = '#6B3A1F', PINK = '#FF5FA8';
  const FLAVORS = ['cookie-chips', 'cookie-chips', 'cookie-pistacho', 'cookie-pistacho', 'cookie-redvelvet', 'cookie-redvelvet', 'cookie-chocolatosa', 'cookie-chocolatosa'];
  const ORDER = (C.chapters[0] || { levels: [] }).levels;
  const wait = (ms) => (QA ? Math.min(ms, 40) : ms);

  /* ---------- host bridge ---------- */
  const cfg = Object.assign({ exitUrl: '', orderUrl: '', target: '_top' }, window.BAD_COOKIE_CONFIG || {});
  if (GK.params.get('exit')) cfg.exitUrl = GK.params.get('exit');
  if (GK.params.get('order')) cfg.orderUrl = GK.params.get('order');
  if (GK.params.get('target')) cfg.target = GK.params.get('target');
  const embedded = (() => { try { return window.parent && window.parent !== window; } catch (e) { return true; } })();

  function emit(type) {
    const msg = { source: 'bad-cookie', type, game: C.id };
    try { if (embedded) window.parent.postMessage(msg, '*'); } catch (e) { /* the host may refuse; the event below still fires */ }
    try { window.dispatchEvent(new CustomEvent('badcookie:' + type, { detail: msg })); } catch (e) { /* old browsers */ }
    GK.bus.emit('host-' + type, msg);
  }
  function openLink(url) {
    if (!url || QA) return false;
    const target = cfg.target || '_top';
    try {
      if (target === '_blank') window.open(url, '_blank', 'noopener');
      else if (target === '_top' && window.top) window.top.location.href = url;
      else window.location.href = url;
    } catch (e) { window.location.href = url; }
    return true;
  }
  const activeKey = () => {
    const g = GK.__game;
    if (!g) return null;
    const list = g.scene.getScenes(true);
    return list.length ? list[list.length - 1] : null;
  };
  GK.badCookie = {
    config: cfg,
    exit() {
      emit('exit');
      if (openLink(cfg.exitUrl)) return;
      if (embedded) return; /* the page around the game decides what the X does */
      const s = activeKey();
      if (s && s.scene.key !== 'Title') { GK.stopMusic(); s.scene.manager.getScenes(true).forEach((x) => { if (x !== s) x.scene.stop(); }); s.scene.start('Title'); }
    },
    wantCookie() {
      emit('want-cookie');
      openLink(cfg.orderUrl);
    },
  };

  /* The X lives in the page (above the canvas), so it is there on every screen; it follows the canvas when it resizes. */
  function placeExit() {
    const b = document.getElementById('bc-exit');
    const cv = document.querySelector('#game canvas');
    if (!b || !cv) return;
    const r = cv.getBoundingClientRect();
    const k = r.width / W;
    const size = Math.max(30, Math.round(40 * k));
    b.style.width = size + 'px';
    b.style.height = size + 'px';
    b.style.fontSize = Math.round(size * 0.55) + 'px';
    b.style.top = Math.round(r.top + 10 * k) + 'px';
    b.style.left = Math.round(r.right - 10 * k - size) + 'px';
  }
  function setupExit() {
    const b = document.getElementById('bc-exit');
    if (!b) return;
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); GK.badCookie.exit(); });
    ['pointerdown', 'touchstart', 'mousedown'].forEach((ev) => b.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }));
    window.addEventListener('resize', placeExit);
    window.addEventListener('orientationchange', () => setTimeout(placeExit, 200));
    let n = 0;
    const t = setInterval(() => { placeExit(); if (++n > 40) clearInterval(t); }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupExit); else setupExit();
  const setGame = GK.setGame;
  GK.setGame = (g) => { GK.__game = g; setGame(g); setTimeout(placeExit, 50); };

  /* Buttons in the brand colours: violet with cream letters (a caller can still pass its own fill). */
  const button = GK.button;
  GK.button = (scene, x, y, label, onClick, opts) => {
    const o = Object.assign({}, opts || {});
    if (!o.fill || o.fill === palette.accent) { o.fill = VIOLET; o.textColor = o.textColor || CREAM; }
    return button(scene, x, y, label, onClick, o);
  };

  function bigText(scene, x, y, str, size, fill, stroke) {
    return scene.add.text(x, y, str, {
      fontFamily: BAGEL, fontSize: size + 'px', color: fill || CREAM, stroke: stroke || BROWN,
      strokeThickness: Math.max(4, Math.round(size / 7)), align: 'center', resolution: 2,
    }).setOrigin(0.5).setScrollFactor(0);
  }
  function sprite(scene, id, x, feetY, height, depth) {
    const key = GK.keys.sprite(id);
    const im = scene.add.image(x, feetY, key).setOrigin(0.5, 1).setDepth(depth || 10);
    im.setScale(height / Math.max(1, im.height));
    return im;
  }
  /* Compact speech bubble at the top: small portrait, name, one or two lines. It never covers the action. */
  GK.speech = function (scene, speakerId, line, depth) {
    const ch = (C.characters || {})[speakerId] || {};
    const d = depth || 150;
    const bw = GK.PORTRAIT ? W - 40 : Math.min(440, W - 300), x = W / 2, y = GK.PORTRAIT ? 130 : 96;
    const parts = [];
    const add = (o) => { parts.push(o.setScrollFactor(0).setDepth(d)); return o; };
    const txt = scene.add.text(0, 0, line, { fontFamily: OUTFIT, fontStyle: '500', fontSize: '17px', color: '#2a1a10', wordWrap: { width: bw - 92 }, resolution: 2, lineSpacing: 2 });
    const bh = Math.max(56, txt.height + 28);
    const g = add(scene.add.graphics());
    g.fillStyle(GK.color('#1a0d24'), 0.35).fillRoundedRect(x - bw / 2 + 3, y - bh / 2 + 4, bw, bh, 14);
    g.fillStyle(GK.color(CREAM), 1).fillRoundedRect(x - bw / 2, y - bh / 2, bw, bh, 14);
    g.lineStyle(3, GK.color(BROWN), 1).strokeRoundedRect(x - bw / 2, y - bh / 2, bw, bh, 14);
    const px = x - bw / 2 + 40;
    if (scene.textures.exists(GK.keys.portrait(speakerId))) {
      const p = add(scene.add.image(px, y, GK.keys.portrait(speakerId)));
      p.setScale(50 / Math.max(p.width, p.height)).setDepth(d + 1);
      /* a framed square portrait: masks render differently between WebGL and canvas, so none is used */
      add(scene.add.rectangle(px, y, 54, 54).setStrokeStyle(3, GK.color(VIOLET))).setDepth(d + 1);
    }
    const name = add(scene.add.text(x - bw / 2 + 78, y - bh / 2 - 12, ch.name || '', { fontFamily: BAGEL, fontSize: '17px', color: CREAM, backgroundColor: VIOLET, padding: { x: 8, y: 2 }, resolution: 2 }));
    add(txt).setPosition(x - bw / 2 + 78, y - txt.height / 2 + 4);
    /* same depth draws in creation order and the text was made first: lift text and name above the bubble */
    txt.setDepth(d + 2);
    name.setDepth(d + 2);
    parts.forEach((o) => o.setAlpha(0));
    scene.tweens.add({ targets: parts, alpha: 1, duration: QA ? 0 : 160 });
    return { destroy() { parts.forEach((o) => o.destroy()); }, parts, name };
  };

  function say(scene, who, line, ms) {
    return new Promise((done) => {
      const sp = GK.speech(scene, who, line, 150);
      scene.time.delayedCall(wait(ms || 2600), () => { sp.destroy(); done(); });
    });
  }
  const pause = (scene, ms) => new Promise((done) => scene.time.delayedCall(wait(ms), done));

  /* ---------- Title: Badi melted on her bench beside the BAD COOKIE title ---------- */
  const Title = GK.scenes.find((s) => s && s.name === 'Title');
  if (Title) {
    const create = Title.prototype.create;
    Title.prototype.create = function () {
      create.call(this);
      /* split-hero always stands the hero on the right: Badi sits on her bench instead. */
      this.children.list.slice().forEach((o) => {
        const k = o.texture && o.texture.key;
        if (k && k.indexOf('anim:badi-flaca') === 0) { if (o.shadow) o.shadow.destroy(); o.destroy(); }
      });
      /* Portrait: Badi sits below the stacked buttons instead of beside them. */
      const bx = GK.PORTRAIT ? W * 0.62 : W * 0.74, feet = GK.PORTRAIT ? H - 30 : H * 0.86, bh = GK.PORTRAIT ? 200 : 230;
      const im = sprite(this, 'badi-sentada', bx, feet, bh, 5);
      this.tweens.add({ targets: im, scaleY: im.scaleY * 0.985, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      const z = bigText(this, bx + 70, feet - bh, 'z z z', 26, CREAM, VIOLET).setDepth(6).setAlpha(0.9);
      this.tweens.add({ targets: z, y: z.y - 16, alpha: 0.2, duration: 1800, repeat: -1 });
    };
  }

  /* ---------- the campaign starts in the park, with the choice ---------- */
  const startCampaign = GK.startCampaign;
  GK.startCampaign = (scene, opts) => {
    if (!(opts && opts.skipPark) && !GK.progress.done.length) return GK.go(scene, 'Park');
    return startCampaign(scene);
  };

  class Park extends Phaser.Scene {
    constructor() { super('Park'); }
    create() {
      GK.setState({ scene: 'Story', status: 'story', level: null });
      this.chosen = false;
      GK.backdrop(this, GK.keys.bg('parque'), 1);
      GK.music(this, GK.keys.music('parque'));
      const ground = H * 0.9;
      this.ground = ground;
      this.badi = sprite(this, 'badi-sentada', W * 0.72, ground, 190, 8);
      GK.muteButton(this);
      this.skipBtn = GK.button(this, 70, H - 30, 'Saltar', () => this.showChoice(), { w: 110, h: 38, size: 18, fill: '#2a1640', textColor: CREAM, id: 'skip', depth: 60 });
      this.cameras.main.fadeIn(QA ? 0 : 400);
      this.play();
    }
    /* QA's campaign run skips stories with skipAll: here that means "¡A ENTRENAR!". */
    skipAll() { this.train(); }

    async play() {
      const g = this.ground;
      const run = (id, delay, speed) => {
        const a = GK.actor(this, id, -80, g, { height: 228, depth: 6 }).setMotion('walk', 1.4).face(1);
        this.tweens.add({ targets: a, x: W + 100, duration: wait(speed), delay: wait(delay), onUpdate: () => a.setFeet(a.x, g), onComplete: () => { a.shadow && a.shadow.destroy(); a.destroy(); } });
        return a;
      };
      await pause(this, 400);
      if (this.chosen) return;
      run('corredor', 0, 4200);
      run('corredora', 700, 4400);
      await say(this, 'badi-flaca', '(sin aire) Me cansé de mirarlos.', 2800);
      if (this.chosen) return;
      const big = GK.actor(this, 'el-grandote', -140, g, { height: 255, depth: 7 }).setMotion('walk', 0.9).face(1);
      await new Promise((done) => this.tweens.add({ targets: big, x: W * 0.42, duration: wait(2400), onUpdate: () => big.setFeet(big.x, g), onComplete: done }));
      if (this.chosen) return;
      big.setVisible(false);
      if (big.shadow) big.shadow.setVisible(false);
      const pose = sprite(this, 'el-grandote', W * 0.42, g, 262, 7);
      this.cameras.main.shake(wait(250), 0.006);
      this.tweens.add({ targets: this.badi, x: this.badi.x + 4, duration: 50, yoyo: true, repeat: 5 });
      await say(this, 'el-grandote', '¡Buen día, fideíto!', 2400);
      pose.destroy();
      if (this.chosen) return;
      big.setVisible(true);
      if (big.shadow) big.shadow.setVisible(true);
      this.tweens.add({ targets: big, x: W + 140, duration: wait(2600), onUpdate: () => big.setFeet(big.x, g), onComplete: () => big.setVisible(false) });
      await say(this, 'badi-flaca', '…¿fideíto?', 2200);
      this.showChoice();
    }

    showChoice() {
      if (this.choice || this.chosen) return;
      if (this.skipBtn) this.skipBtn.destroy();
      const P = GK.PORTRAIT; /* portrait stacks the two choices instead of placing them side by side */
      const q = bigText(this, W / 2, P ? 215 : 96, '¿Qué hacés?', 46, CREAM, VIOLET).setDepth(60).setScale(0.4);
      this.tweens.add({ targets: q, scale: 1, duration: 300, ease: 'Back.Out' });
      const stay = GK.button(this, P ? W / 2 : W * 0.3, P ? 410 : 200, 'Quedarme sentado', () => this.stay(), { w: 300, h: 76, size: 26, fill: '#4b3a5c', textColor: CREAM, id: 'stay', depth: 60 });
      const train = GK.button(this, P ? W / 2 : W * 0.7, P ? 310 : 200, '¡A ENTRENAR!', () => this.train(), { w: 300, h: 76, size: 32, fill: LIME, textColor: '#2a1640', id: 'train', depth: 60 });
      [stay, train].forEach((b, i) => {
        b.setScale(0);
        this.tweens.add({ targets: b, scale: 1, duration: 320, delay: 120 * i, ease: 'Back.Out' });
      });
      this.tweens.add({ targets: train, angle: { from: -2, to: 2 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.choice = [q, stay, train];
    }

    clearChoice() { (this.choice || []).forEach((o) => o.destroy()); this.choice = null; if (this.skipBtn) this.skipBtn.destroy(); }

    train() {
      if (this.chosen) return;
      this.chosen = true;
      this.clearChoice();
      GK.sfx(this, 'click');
      GK.sfx(this, 'levelup');
      startCampaign(this);
    }

    stay() {
      if (this.chosen) return;
      this.chosen = true;
      this.clearChoice();
      GK.sfx(this, 'click');
      GK.stopMusic();
      GK.sfx(this, 'shrink');
      const b = this.badi;
      this.tweens.add({
        targets: b, scale: 0, angle: 20, duration: wait(2200), ease: 'Quad.In',
        onComplete: () => {
          GK.sfx(this, 'lose');
          GK.setState({ scene: 'GameOver', status: 'gameover' });
          this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setDepth(70);
          const t = bigText(this, W / 2, H * 0.36, 'GAME OVER', 84, PINK, '#1a0d24').setDepth(71).setScale(0.3);
          this.tweens.add({ targets: t, scale: 1, duration: 420, ease: 'Back.Out' });
          GK.button(this, W / 2, H * 0.7, 'Volver a empezar', () => { GK.sfx(this, 'click'); this.scene.restart(); }, { w: 300, h: 66, size: 26, fill: LIME, textColor: '#2a1640', id: 'restart', depth: 72 });
        },
      });
    }
  }

  /* ---------- Play: the 8-cookie bar and the LEVEL UP ---------- */
  const BasePlay = GK.playScene;
  class Play extends BasePlay {
    create() {
      /* Phaser reuses the scene object between level starts: forget the last run's bar and level-up first. */
      this.__enemyN = 0;
      this.barSlots = null;
      this.livesText = null;
      this.barGlow = null;
      this.barFull = false;
      this.__leveled = false;
      this.__frozen = false;
      super.create();
      const px = STAGE_PX[(this.level || {}).hero];
      if (px && this.hero && this.hero.setHeight) this.hero.setHeight(px);
      this.buildBar();
      this.updateHud();
    }
    addEnemy(x, r, foeId) {
      const list = this.level && this.level.enemies;
      if (Array.isArray(list) && list.length) foeId = list[this.__enemyN++ % list.length];
      const b = super.addEnemy(x, r, foeId);
      /* Vehicles and people at a believable size next to Badi (the hero is about 62 px tall). */
      const px = { 'obst-auto': 74, 'obst-moto': 78, 'obst-bici': 76, 'obst-senor-perro': 64, 'obst-chica-celular': 68 }[foeId];
      if (px && b.sprite && b.sprite.setHeight) b.sprite.setHeight(px);
      return b;
    }
    /* Platforms are giant cookie slabs: golden dough, chocolate chips, a cream outline. */
    makeTileTextures(loc) {
      super.makeTileTextures(loc);
      const T = C.tileSize || 48;
      if (this.textures.exists('tile-plat')) this.textures.remove('tile-plat');
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(GK.color('#3a1f10'), 1).fillRect(0, 2, T, T * 0.86);
      g.fillStyle(GK.color('#d9a35b'), 1).fillRect(2, 4, T - 4, T * 0.86 - 6);
      g.fillStyle(GK.color('#f0c47a'), 1).fillRect(2, 4, T - 4, 6);
      g.fillStyle(GK.color('#b97a3a'), 1).fillRect(2, T * 0.86 - 8, T - 4, 6);
      g.fillStyle(GK.color('#3a1f10'), 1);
      [[8, 14], [26, 12], [38, 22], [14, 28], [30, 30]].forEach(([cx, cy]) => g.fillRect(cx, cy, 5, 5));
      g.generateTexture('tile-plat', T, T);
      g.destroy();
    }
    priorCookies() { const i = ORDER.indexOf(this.levelId); return Math.max(0, i) * 2; }
    buildBar() {
      const slot = 27, gap = 3, n = 8;
      const w = n * slot + (n - 1) * gap + 20;
      const right = W - 62, cy = 30;
      const x0 = right - w;
      this.barGlow = this.add.rectangle(x0 + w / 2, cy, w + 10, 46, GK.color(LIME), 0).setScrollFactor(0).setDepth(84);
      const g = this.add.graphics().setScrollFactor(0).setDepth(85);
      g.fillStyle(GK.color('#2a1640'), 0.85).fillRoundedRect(x0, cy - 19, w, 38, 10);
      g.lineStyle(3, GK.color(CREAM), 1).strokeRoundedRect(x0, cy - 19, w, 38, 10);
      this.barSlots = [];
      for (let i = 0; i < n; i++) {
        const sx = x0 + 10 + slot / 2 + i * (slot + gap);
        g.fillStyle(GK.color(BROWN), 0.85).fillCircle(sx, cy, slot / 2 - 1);
        g.lineStyle(2, GK.color(CREAM), 0.7).strokeCircle(sx, cy, slot / 2 - 2);
        const im = this.add.image(sx, cy, GK.keys.item(FLAVORS[i])).setScrollFactor(0).setDepth(86).setVisible(false);
        im.__base = (slot - 2) / Math.max(im.width, im.height);
        im.setScale(im.__base);
        this.barSlots.push(im);
      }
      this.livesText = this.add.text(right, cy + 26, '', { fontFamily: OUTFIT, fontStyle: '700', fontSize: '20px', color: PINK, stroke: '#1a0d24', strokeThickness: 4, resolution: 2 })
        .setOrigin(1, 0).setScrollFactor(0).setDepth(85);
    }
    updateHud() {
      if (!this.hud) return;
      this.hud.set([]);
      this.__gkHud = 'cookies ' + (this.priorCookies() + (this.collected || 0)) + '/8 lives ' + this.lives;
      if (!this.barSlots) return;
      const have = Math.min(8, this.priorCookies() + (this.collected || 0));
      this.barSlots.forEach((im, i) => {
        if (i < have && !im.visible) {
          im.setVisible(true);
          this.tweens.killTweensOf(im);
          im.setScale(im.__base * 1.3);
          this.tweens.add({ targets: im, scale: im.__base, duration: 260, ease: 'Back.Out', onComplete: () => im.setScale(im.__base) });
        }
      });
      this.livesText.setText('\u2665 ' + this.lives);
      if (have >= 8 && !this.barFull) {
        this.barFull = true;
        /* Full bar: a strong lime glow, a flashing white frame, sparkles and a heartbeat pulse. */
        const gw = this.barGlow;
        gw.setSize(gw.width + 26, 66).setOrigin(0.5).setFillStyle(GK.color(LIME), 0.95).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: gw, alpha: { from: 0.95, to: 0.35 }, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        const frame = this.add.rectangle(gw.x, gw.y, gw.width - 18, 44).setStrokeStyle(4, 0xffffff, 1).setScrollFactor(0).setDepth(87);
        this.tweens.add({ targets: frame, alpha: 0.2, duration: 160, yoyo: true, repeat: -1 });
        this.barSlots.forEach((im, i) => this.tweens.add({ targets: im, scale: im.__base * 1.18, duration: 260, yoyo: true, repeat: -1, delay: i * 45, ease: 'Sine.InOut' }));
        this.time.addEvent({ delay: 140, loop: true, callback: () => {
          const st = this.add.star(gw.x + Phaser.Math.Between(-gw.width / 2, gw.width / 2), gw.y + Phaser.Math.Between(-24, 24), 4, 3, 8, 0xffffff).setScrollFactor(0).setDepth(88);
          this.tweens.add({ targets: st, scale: 1.8, alpha: 0, angle: 90, duration: 520, onComplete: () => st.destroy() });
        } });
        this.cameras.main.flash(QA ? 0 : 260, 220, 255, 120);
        const t = bigText(this, W / 2, 205, '¡BARRA LLENA!', 44, LIME, VIOLET).setDepth(200).setScale(0.3);
        this.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.Out' });
        this.time.delayedCall(QA ? 30 : 1600, () => this.tweens.add({ targets: t, alpha: 0, duration: 300, onComplete: () => t.destroy() }));
      }
    }
    update(time, delta) {
      if (this.__frozen) { this.bg.tilePositionX = (this.cameras.main.scrollX * 0.3) / this.bg.tileScaleX; return; }
      super.update(time, delta);
    }
  }
  GK.playScene = Play;

  const levelWon = GK.levelWon;
  GK.levelWon = function (scene) {
    const lv = C.levels[scene.levelId] || {};
    if (scene.scene && scene.scene.key === 'Play' && lv.levelUp && !scene.__leveled && GK.state.status === 'playing') {
      scene.__leveled = true;
      scene.__frozen = true;
      return levelUp(scene, lv.levelUp, () => { scene.__frozen = false; levelWon(scene); });
    }
    return levelWon(scene);
  };

  const STAGE_PX = { 'badi-flaca': 60, 'badi-tonificada': 64, 'badi-fuerte': 69, 'badi-musculosa': 75 };
  const STAGE_NAME = { 'badi-tonificada': 'TONIFICADA', 'badi-fuerte': 'FUERTE', 'badi-musculosa': 'MUSCULOSA' };
  /* LEVEL UP: the level pauses, Badi jumps in close-up and lands in her new body, big enough to see the change. */
  function levelUp(scene, nextId, done) {
    const fromId = (C.levels[scene.levelId] || {}).hero || C.hero;
    GK.sfx(scene, 'levelup');
    const parts = [];
    const add = (o) => { parts.push(o.setScrollFactor(0)); return o; };
    const shade = add(scene.add.rectangle(W / 2, H / 2, W, H, 0x1a0d24, 0).setDepth(205));
    scene.tweens.add({ targets: shade, fillAlpha: 0.9, duration: wait(250) });
    const feet = H * 0.86;
    const big = (id) => {
      const im = add(scene.add.image(W / 2, feet, GK.keys.sprite(id)).setOrigin(0.5, 1).setDepth(207));
      im.setScale(270 / Math.max(1, im.height));
      return im;
    };
    const ring = add(scene.add.ellipse(W / 2, feet, 200, 34, GK.color(LIME), 0.35).setDepth(206));
    const old = big(fromId);
    const title = add(bigText(scene, W / 2, 70, '¡LEVEL UP!', 66, LIME, VIOLET).setDepth(210).setScale(0.3));
    scene.tweens.add({ targets: title, scale: 1, duration: wait(300), ease: 'Back.Out' });
    /* the jump */
    scene.tweens.add({ targets: old, y: feet - 120, duration: wait(420), ease: 'Quad.Out', delay: wait(300) });
    scene.time.delayedCall(wait(760), () => {
      scene.cameras.main.flash(wait(300), 255, 255, 230);
      GK.sfx(scene, 'powerup');
      const fresh = big(nextId);
      fresh.setY(feet - 120);
      old.destroy();
      scene.tweens.add({ targets: fresh, y: feet, duration: wait(380), ease: 'Bounce.Out' });
      scene.time.delayedCall(wait(380), () => {
        scene.cameras.main.shake(wait(220), 0.01);
        const s0 = fresh.scaleY;
        scene.tweens.add({ targets: fresh, scaleY: s0 * 0.9, duration: 90, yoyo: true });
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          const st = add(scene.add.star(W / 2, feet - 130, 5, 6, 13, GK.color(i % 2 ? LIME : PINK)).setDepth(208));
          scene.tweens.add({ targets: st, x: W / 2 + Math.cos(a) * 220, y: feet - 130 + Math.sin(a) * 150, alpha: 0, angle: 200, duration: wait(800) });
        }
      });
      scene.time.delayedCall(wait(2300), () => {
        parts.forEach((o) => o.active && o.destroy());
        /* the hero continues in the new body */
        const h = scene.hero;
        const fresh2 = GK.actor(scene, nextId, h.x, h.y, { height: STAGE_PX[nextId] || 64, depth: 10 }).face(1);
        if (h.shadow) h.shadow.destroy();
        h.destroy();
        scene.hero = fresh2;
        done();
      });
    });
  }

  /* ---------- End: the 100 kg finale ---------- */
  class End extends Phaser.Scene {
    constructor() { super('End'); }
    create() {
      GK.setState({ scene: 'End', status: 'ended', level: null });
      this.ended = false; /* Phaser reuses the scene object: reset so the buttons show on every visit, not just the first */
      GK.backdrop(this, GK.keys.bg('gimnasio'), 1);
      GK.music(this, GK.keys.music('gimnasio'));
      GK.muteButton(this);
      this.cameras.main.fadeIn(QA ? 0 : 400);
      this.ground = H * 0.9;
      if (QA) { this.showEnding(); return; }
      this.finale();
    }
    async finale() {
      const g = this.ground;
      const cx = W * 0.42;
      const pesa = sprite(this, 'pesa-100kg', cx, g, 70, 6);
      const label = bigText(this, cx, g - 92, '100 KG', 30, CREAM, BROWN).setDepth(7);
      const bush = sprite(this, 'grandote-arbusto', W * 0.86, g + 12, 150, 4);
      bush.setFlipX(true); /* the art looks to the right (checked on a zoomed crop); Badi is on his left */
      bush.setY(g + 160);
      const badi = GK.actor(this, 'badi-musculosa', -80, g, { height: 150, depth: 8 }).setMotion('walk', 1.1).face(1);
      await new Promise((done) => this.tweens.add({ targets: badi, x: cx - 40, duration: wait(2200), onUpdate: () => badi.setFeet(badi.x, g), onComplete: done }));
      badi.setMotion('idle');
      await say(this, 'badi-musculosa', 'Así que vos sos la famosa pesa de 100 kilos…', 2400);
      /* the lift */
      if (badi.shadow) badi.shadow.destroy();
      badi.destroy();
      pesa.destroy();
      label.destroy();
      const lift = sprite(this, 'badi-levanta', cx, g, 240, 8);
      this.cameras.main.shake(wait(300), 0.012);
      GK.sfx(this, 'win');
      this.tweens.add({ targets: bush, y: g + 12, duration: wait(500), ease: 'Back.Out' });
      await pause(this, 900);
      /* the golden-hair wink: a flash, the glowing aura, then back to normal */
      GK.sfx(this, 'powerup');
      this.cameras.main.flash(wait(300), 255, 230, 120);
      const aura = this.add.ellipse(cx, g - 120, 230, 300, GK.color('#FFD447'), 0.35).setDepth(7);
      this.tweens.add({ targets: aura, scaleX: 1.15, scaleY: 1.1, alpha: 0.15, duration: 160, yoyo: true, repeat: -1 });
      lift.setVisible(false);
      const gold = sprite(this, 'badi-dorada', cx, g, 250, 8);
      this.cameras.main.shake(wait(1200), 0.008);
      const sparks = [];
      for (let i = 0; i < 14; i++) {
        const sp = this.add.rectangle(cx + Phaser.Math.Between(-110, 110), g - Phaser.Math.Between(20, 260), 4, 14, GK.color(i % 2 ? '#FFD447' : '#FFFFFF')).setDepth(9);
        this.tweens.add({ targets: sp, y: sp.y - 60, alpha: 0, duration: 500, repeat: -1, delay: i * 40 });
        sparks.push(sp);
      }
      const wow = bigText(this, W * 0.86, g - 175, '!!', 40, LIME, VIOLET).setDepth(9);
      this.tweens.add({ targets: wow, scale: 1.3, duration: 200, yoyo: true, repeat: -1 });
      await pause(this, 1900);
      this.cameras.main.flash(wait(250), 255, 255, 255);
      gold.destroy();
      aura.destroy();
      sparks.forEach((s) => s.destroy());
      lift.setVisible(true);
      wow.destroy();
      await say(this, 'badi-musculosa', '¿Fideíto? Fideíto relleno de cookies.', 2800);
      this.showEnding();
    }
    showEnding() {
      if (this.ended) return;
      this.ended = true;
      /* A short band at the top, so Badi with the 100 kg stays fully in view below it. */
      /* A slim band at the top: title and the two buttons in one row, the scene stays in view. */
      /* Portrait stacks title and buttons in a taller band; landscape keeps them in one row. */
      const P = GK.PORTRAIT;
      this.add.rectangle(W / 2, P ? 150 : 52, W, P ? 300 : 104, 0x1a0d24, 0.6).setDepth(40);
      const t = bigText(this, P ? W / 2 : W * 0.2, P ? 60 : 52, '¡LO LOGRASTE!', P ? 44 : 36, LIME, VIOLET).setDepth(41).setScale(0.3);
      this.tweens.add({ targets: t, scale: 1, duration: 360, ease: 'Back.Out' });
      const want = GK.button(this, P ? W / 2 : W * 0.53, P ? 150 : 52, '¡Quiero una cookie!', () => { GK.sfx(this, 'click'); GK.badCookie.wantCookie(); }, { w: 290, h: 58, size: 25, fill: LIME, textColor: '#2a1640', id: 'want-cookie', depth: 45 });
      this.tweens.add({ targets: want, scale: 1.06, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      GK.button(this, W / 2, 300, 'Jugar de nuevo', () => {
        GK.sfx(this, 'click');
        GK.resetSave();
        this.scene.start('Title');
      }, { w: 190, h: 48, size: 20, id: 'replay', depth: 45 }).setPosition(P ? W / 2 : W * 0.82, P ? 245 : 52);
      GK.brandBadge(this, H - 18);
    }
  }

  /* Replace the engine's ending with the finale, and add the park. */
  const i = GK.scenes.findIndex((s) => s && s.name === 'End');
  if (i >= 0) GK.scenes[i] = End; else GK.scenes.push(End);
  GK.scenes.push(Park);
})();
