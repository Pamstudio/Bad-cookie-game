/* Story shell scenes: Boot, Title, Story, Map, End. The Play scene lives in play.js. */
(function () {
  'use strict';
  const { W, H, C, QA, palette } = GK;
  /* Credit removed: brandBadge/brandStrip return an empty, hidden, non-interactive text so callers keep working. */
  function emptyCredit(scene, y) {
    return GK.text(scene, W / 2, y, '', 18, '#ffffff').setOrigin(0.5).setScrollFactor(0).setDepth(95).setVisible(false);
  }

  function brandBadge(scene, y) { return emptyCredit(scene, y); }
  GK.brandBadge = brandBadge;

  /* ---------- start screen (C.titleScreen) ---------- */

  const TITLE = Object.assign({ layout: 'centered', background: 'keyart', ambient: 'none', showcase: 'none' }, C.titleScreen || {});
  const TITLE_FONT = GK.fonts[(TITLE.titleStyle || {}).font] || null;

  /* The title face may differ from the story face: load it before the title screen draws. */
  function titleFontReady() {
    if (!TITLE_FONT || !TITLE_FONT.files.length || !document.fonts || !document.fonts.load) return Promise.resolve();
    const all = Promise.all(TITLE_FONT.files.map((f) => document.fonts.load(f).catch(() => null)));
    return Promise.race([all, new Promise((r) => setTimeout(r, 3000))]);
  }

  /* Where each layout puts the title (anchor x, alignment, size, wrap), the buttons, the countdown and the
     showcase stage (x range, feet line, height). The bottom strip (H - 44 to H) is kept clear. */
  const LAYOUTS = {
    centered: { tx: W / 2, align: 'center', titleY: 130, size: 64, wrap: 760, maxH: 150, b1: [W / 2, 300], b2: [W / 2, 375], drop: [W / 2, 450], bob: true,
      stage: { slots: [[120, 1], [W - 120, -1], [235, 1], [W - 235, -1]], feet: H - 50, h: 220 } },
    'left-column': { tx: 60, align: 'left', titleY: 140, size: 56, wrap: 420, maxH: 170, b1: [180, 330], b2: [180, 400], drop: [60, 462], panel: 'left',
      stage: { slots: [[W * 0.7, -1], [W * 0.86, -1], [W * 0.56, 1], [W * 0.95, -1]], feet: H - 50, h: 330 } },
    'bottom-banner': { tx: 48, align: 'left', titleY: H - 160, size: 50, wrap: 560, maxH: 72, tagMaxH: 46, b1: [W - 170, H - 146], b2: [W - 170, H - 84], drop: [W / 2, 30], panel: 'bottom',
      stage: { slots: [[W * 0.72, -1], [W * 0.58, 1], [W * 0.86, -1], [W * 0.44, 1]], feet: H - 212, h: 210 } },
    'split-hero': { tx: W * 0.3, align: 'center', titleY: 140, size: 56, wrap: 500, maxH: 170, b1: [W * 0.3, 330], b2: [W * 0.3, 400], drop: [W * 0.3, 466], panel: 'left',
      stage: { slots: [[W * 0.74, -1], [W * 0.9, -1], [W * 0.6, 1]], feet: H - 46, h: 400 } },
    'logo-top': { tx: W / 2, align: 'center', titleY: 120, size: 76, wrap: 820, maxH: 170, b1: [W / 2 - 125, 340], b2: [W / 2 + 125, 340], drop: [W / 2, 428], bob: true,
      stage: { slots: [[110, 1], [W - 110, -1]], feet: H - 50, h: 190 } },
  };

  /* The same five layouts on a tall (portrait, 540x960) stage: title in the top third, the cast in the middle,
     buttons stacked in the lower third. No portrait layout puts a panel on the left. */
  const P_CENTRED = { tx: W / 2, align: 'center', titleY: 190, size: 56, wrap: W - 60, maxH: 190, b1: [W / 2, 640], b2: [W / 2, 715], drop: [W / 2, 800], bob: true,
    stage: { slots: [[W / 2, 1], [W * 0.2, 1], [W * 0.8, -1], [W * 0.35, 1]], feet: 600, h: 220 } };
  const PORTRAIT_LAYOUTS = {
    centered: P_CENTRED,
    'left-column': Object.assign({}, P_CENTRED, { tx: 36, align: 'left', bob: false }),
    'bottom-banner': { tx: 32, align: 'left', titleY: H - 330, size: 48, wrap: W - 64, maxH: 110, tagMaxH: 60, b1: [W / 2, H - 170], b2: [W / 2, H - 100], drop: [W / 2, 40], panel: 'bottom', panelH: 420,
      stage: { slots: [[W * 0.5, 1], [W * 0.25, 1], [W * 0.75, -1]], feet: H - 400, h: 300 } },
    'split-hero': P_CENTRED,
    'logo-top': Object.assign({}, P_CENTRED, { titleY: 170, size: 64 }),
  };

  /* A canvas texture with a linear gradient of one colour, for layout panels (works on canvas and WebGL). */
  function gradientTexture(scene, key, w, h, horizontal, colour, a0, a1) {
    if (scene.textures.exists(key)) return key;
    const tex = scene.textures.createCanvas(key, w, h);
    const ctx = tex.getContext();
    const g = horizontal ? ctx.createLinearGradient(0, 0, w, 0) : ctx.createLinearGradient(0, 0, 0, h);
    const c = Phaser.Display.Color.HexStringToColor(colour);
    g.addColorStop(0, 'rgba(' + c.red + ',' + c.green + ',' + c.blue + ',' + a0 + ')');
    g.addColorStop(1, 'rgba(' + c.red + ',' + c.green + ',' + c.blue + ',' + a1 + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    tex.refresh();
    return key;
  }

  /* One canvas texture holding a sprite in several colours (frames c0, c1, ...): particles pick a frame
     at random. Colours are painted in, not tinted, because the canvas renderer ignores tint. */
  function swatches(scene, key, size, colours, draw) {
    if (!scene.textures.exists(key)) {
      const [w, h] = size;
      const tex = scene.textures.createCanvas(key, w * colours.length, h);
      const ctx = tex.getContext();
      colours.forEach((c, i) => { ctx.save(); ctx.translate(i * w, 0); draw(ctx, w, h, Phaser.Display.Color.HexStringToColor(c)); ctx.restore(); });
      colours.forEach((_, i) => tex.add('c' + i, 0, i * w, 0, w, h));
      tex.refresh();
    }
    return { key, frames: colours.map((_, i) => 'c' + i) };
  }

  const rgbaOf = (c, a) => 'rgba(' + c.red + ',' + c.green + ',' + c.blue + ',' + a + ')';

  function radial(ctx, w, h, inner, c) {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, rgbaOf(c, 1));
    g.addColorStop(inner, rgbaOf(c, 0.6));
    g.addColorStop(1, rgbaOf(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  /* Procedural ambience in palette colours: a few dozen particles at most, cheap on phones. */
  function ambient(scene, kind) {
    const dots = (key, colours, inner) => swatches(scene, key, [32, 32], colours, (ctx, w, h, c) => radial(ctx, w, h, inner || 0.35, c));
    const kinds = {
      fog: () => [swatches(scene, 'amb:fog', [256, 256], [palette.muted, '#ffffff'], (ctx, w, h, c) => radial(ctx, w, h, 0.25, c)),
        { x: { min: -150, max: W + 150 }, y: { min: H * 0.3, max: H + 40 }, lifespan: 16000, speedX: { min: 6, max: 20 }, scale: { min: 1.4, max: 3 }, alpha: { start: 0.16, end: 0 }, frequency: 650, maxAliveParticles: 26 }, 16000],
      rain: () => [swatches(scene, 'amb:rain', [4, 28], ['#d6e0ee'], (ctx, w, h, c) => {
        const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, rgbaOf(c, 0)); g.addColorStop(1, rgbaOf(c, 0.9));
        ctx.fillStyle = g; ctx.fillRect(1, 0, 2, h);
      }), { x: { min: 0, max: W + 260 }, y: -30, lifespan: 900, speedY: { min: 720, max: 900 }, speedX: -150, rotate: 11, alpha: 0.32, frequency: 14, quantity: 2 }, 1200],
      snow: () => [dots('amb:snow', ['#ffffff']),
        { x: { min: 0, max: W }, y: -12, lifespan: 13000, speedY: { min: 28, max: 64 }, speedX: { min: -18, max: 18 }, scale: { min: 0.18, max: 0.42 }, alpha: 0.85, frequency: 110 }, 13000],
      embers: () => [dots('amb:embers', [palette.accent, '#ff7a2e', palette.danger]),
        { x: { min: 0, max: W }, y: H + 10, lifespan: 5200, speedY: { min: -120, max: -40 }, speedX: { min: -24, max: 24 }, scale: { start: 0.42, end: 0.06 }, alpha: { start: 1, end: 0 }, blendMode: 'ADD', frequency: 90 }, 5200],
      fireflies: () => [dots('amb:fireflies', ['#d9ff7a', '#fff3a0', palette.accent]),
        { x: { min: 0, max: W }, y: { min: H * 0.3, max: H - 40 }, lifespan: { min: 2600, max: 4600 }, speed: { min: 6, max: 26 }, angle: { min: 0, max: 360 }, scale: { min: 0.22, max: 0.4 }, alpha: { start: 1, end: 0 }, blendMode: 'ADD', frequency: 180 }, 4600],
      leaves: () => [swatches(scene, 'amb:leaves', [24, 14], ['#c8642a', '#e0a03a', '#8a3b1f', palette.accent], (ctx, w, h, c) => {
        ctx.fillStyle = rgbaOf(c, 1); ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.moveTo(2, h / 2); ctx.lineTo(w - 2, h / 2); ctx.stroke();
      }), { x: { min: 0, max: W + 120 }, y: -20, lifespan: 11000, speedY: { min: 40, max: 90 }, speedX: { min: -70, max: -10 }, rotate: { start: 0, end: 540 }, scale: { min: 0.7, max: 1.3 }, frequency: 420 }, 11000],
      dust: () => [dots('amb:dust', ['#fff4d6']),
        { x: { min: 0, max: W }, y: { min: 0, max: H }, lifespan: 8000, speed: { min: 3, max: 12 }, angle: { min: 0, max: 360 }, scale: { min: 0.08, max: 0.18 }, alpha: { start: 0.55, end: 0 }, blendMode: 'ADD', frequency: 140 }, 8000],
    };
    if (kind === 'stars') {
      const star = dots('amb:stars', ['#ffffff', '#fff3c4', '#cfe0ff']);
      for (let i = 0; i < 70; i++) {
        const s = scene.add.image(GK.rng() * W, GK.rng() * H * 0.62, star.key, star.frames[i % 3]).setScale(0.06 + GK.rng() * 0.14).setDepth(5).setBlendMode('ADD');
        scene.tweens.add({ targets: s, alpha: 0.2, duration: 700 + GK.rng() * 1600, yoyo: true, repeat: -1, delay: GK.rng() * 1500 });
      }
      return;
    }
    if (!kinds[kind]) return;
    const [tex, config, warm] = kinds[kind]();
    const em = scene.add.particles(0, 0, tex.key, Object.assign({ frame: tex.frames }, config)).setDepth(5);
    if (em.fastForward) em.fastForward(warm, 50); /* the screen opens already full, not filling up */
  }

  /* Text that must fit a box: shrink the font until it does. */
  function fit(t, maxH, size) {
    let s = size;
    while (t.height > maxH && s > 20) { s -= 3; t.setFontSize(Math.round(s * (TITLE_FONT ? TITLE_FONT.scale : 1)) + 'px'); }
    return t;
  }

  function titleText(scene, L) {
    const ts = TITLE.titleStyle || {};
    const ox = L.align === 'left' ? 0 : 0.5;
    if (TITLE.logo && scene.textures.exists('title:logo')) {
      const im = scene.add.image(L.tx, L.titleY, 'title:logo').setOrigin(ox, 0.5).setDepth(10);
      im.setScale(Math.min(L.wrap / im.width, L.maxH / im.height));
      return im;
    }
    const col = ts.color || palette.accent;
    const opts = { align: L.align, wordWrap: { width: L.wrap, useAdvancedWrap: true } };
    if (TITLE_FONT) Object.assign(opts, { fontFamily: TITLE_FONT.title, fontStyle: TITLE_FONT.titleStyle });
    const t = GK.title(scene, L.tx, L.titleY, ts.effect === 'stamp' ? C.title.toUpperCase() : C.title, L.size, col, opts).setOrigin(ox, 0.5).setDepth(10);
    fit(t, L.maxH, L.size);
    const fx = ts.effect;
    if (fx === 'plain') t.setStroke('#000000', 0);
    else if (fx === 'glow') t.setStroke('#000000', 0).setShadow(0, 0, col, 18, true, true);
    else if (fx === 'neon') {
      t.setColor(GK.mix(col, '#ffffff', 0.55)).setStroke(col, 3).setShadow(0, 0, col, 24, true, true);
      if (!QA) scene.time.addEvent({ delay: 2600, loop: true, callback: () => scene.tweens.add({ targets: t, alpha: 0.55, duration: 60, yoyo: true, repeat: 1 }) });
    } else if (fx === 'outline') t.setStroke('#111111', Math.max(6, Math.round(L.size / 6))).setShadow(0, 4, '#000000', 0, true, true);
    else if (fx === 'shadow-drop') t.setStroke('#000000', 0).setShadow(6, 6, 'rgba(0,0,0,0.7)', 0, false, true);
    else if (fx === 'engraved') {
      const g = t.context.createLinearGradient(0, 0, 0, t.height);
      g.addColorStop(0, GK.mix(col, '#ffffff', 0.7));
      g.addColorStop(0.5, col);
      g.addColorStop(1, GK.mix(col, '#000000', 0.45));
      t.setFill(g).setStroke(GK.mix(col, '#000000', 0.7), 3).setShadow(2, 3, '#000000', 2, true, true);
    } else if (fx === 'stamp') {
      t.setStroke('#000000', 0).setAlpha(0.95);
      if (t.originX === 0) t.setX(t.x + 26); /* the double border sits outside the text */
      const g = scene.add.graphics({ x: t.x + (0.5 - t.originX) * t.width, y: t.y }).setDepth(9);
      g.lineStyle(5, GK.color(col), 0.95).strokeRect(-t.width / 2 - 16, -t.height / 2 - 10, t.width + 32, t.height + 20);
      g.lineStyle(2, GK.color(col), 0.95).strokeRect(-t.width / 2 - 24, -t.height / 2 - 18, t.width + 48, t.height + 36);
      t.setAngle(-4);
      g.setAngle(-4);
      /* Lowest point of the tilted outer border: what the tagline lays out from. */
      const hw = t.width / 2 + 24;
      const hh = t.height / 2 + 18;
      const tilt = Phaser.Math.DegToRad(4);
      t.blockBottom = g.y + hw * Math.sin(tilt) + hh * Math.cos(tilt);
      t.stampFrame = g;
    }
    return t;
  }

  /* Buttons wear the dialog kit when the game has one, so the first screen already matches the game.
     opts: { w, h, size, id (QA name), sub (a small second line, e.g. the save summary) }. */
  function titleButton(scene, x, y, label, onClick, primary, opts) {
    const D = GK.kit && GK.kit.dialog;
    const o = Object.assign(primary ? { w: 240, h: 60, size: 26 } : { w: 200, h: 50, size: 22 }, opts || {});
    if (!D) return withSub(GK.button(scene, x, y, label, onClick, Object.assign(primary ? {} : { fill: '#ffffff' }, { w: o.w, h: o.h, size: o.size, id: o.id })), o);
    const framed = D.frame && scene.textures.exists('ui:dialog-frame');
    const fill = D.fill || GK.skin.panel;
    const parts = [];
    if (framed) parts.push(GK.nineSlice(scene, 'ui:dialog-frame', 0, 0, o.w, o.h + 6, D.inset));
    else {
      const g = scene.add.graphics();
      const r = Math.min(o.h / 2, D.radius != null ? D.radius : GK.skin.radius + 4);
      g.fillStyle(GK.color(primary ? (D.edge || palette.accent) : fill), 1).fillRoundedRect(-o.w / 2, -o.h / 2, o.w, o.h, r);
      g.lineStyle(primary ? 4 : 3, GK.color(primary ? fill : (D.edge || palette.accent)), 1).strokeRoundedRect(-o.w / 2, -o.h / 2, o.w, o.h, r);
      parts.push(g);
    }
    const bg = framed ? GK.centreColour(scene, 'ui:dialog-frame') : primary ? (D.edge || palette.accent) : fill;
    const t = GK.title(scene, 0, 0, label, o.size, GK.readable(primary && !framed ? fill : (D.ink || GK.skin.ink), bg), { strokeThickness: 0 }).setOrigin(0.5);
    if (D.layout === 'terminal') t.setFontFamily(GK.kit.mono);
    parts.push(t);
    const c = scene.add.container(x, y, parts).setSize(o.w, o.h).setDepth(50);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerover', () => c.setScale(1.05));
    c.on('pointerout', () => c.setScale(1));
    c.on('pointerdown', () => { scene.tweens.add({ targets: c, scale: 0.94, yoyo: true, duration: 70 }); onClick(); });
    c.label = t;
    c.__gkButton = o.id || label;
    c.__gkLabel = label;
    return withSub(c, o);
  }

  /* A second, smaller line under a button's label, shortened until it fits. */
  function withSub(c, o) {
    if (!o.sub) return c;
    c.label.setY(-10);
    const t = GK.text(c.scene, 0, 15, o.sub, 15, c.label.style.color, { strokeThickness: 0 }).setOrigin(0.5).setAlpha(0.85);
    let str = o.sub;
    while (t.width > o.w - 28 && str.length > 4) { str = str.slice(0, -2); t.setText(str.replace(/[\s·]+$/, '') + '…'); }
    c.add(t);
    c.sub = t;
    return c;
  }

  /* A yes/cancel question over the scene; Esc cancels. The shade takes every tap meant for what is below it. */
  function confirmBox(scene, message, yesLabel, onYes, yesId) {
    const S = GK.strings;
    const parts = [];
    const close = () => { parts.forEach((p) => p.destroy()); scene.__gkModal = null; };
    parts.push(scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setScrollFactor(0).setDepth(900).setInteractive());
    parts.push(GK.panel(scene, W / 2, H / 2, Math.min(540, W - 40), 240).setScrollFactor(0).setDepth(901));
    parts.push(GK.ink(scene, W / 2, H / 2 - 48, message, 24, { wordWrap: { width: Math.min(470, W - 80) } }).setOrigin(0.5).setScrollFactor(0).setDepth(902));
    parts.push(titleButton(scene, W / 2 - 125, H / 2 + 58, yesLabel, () => { close(); onYes(); }, true, { w: 220, h: 54, size: 22, id: yesId || 'yes' }).setDepth(903));
    parts.push(titleButton(scene, W / 2 + 125, H / 2 + 58, S.cancel, close, false, { w: 200, h: 50, size: 22, id: 'cancel' }).setDepth(903));
    scene.__gkModal = { close };
    return scene.__gkModal;
  }

  /* The collection view over a scene (title or pause), which waits paused underneath. */
  function openLedger(scene) {
    scene.scene.launch('Ledger', { from: scene.scene.key });
    scene.scene.bringToTop('Ledger');
    scene.scene.pause();
  }

  const showsCollection = () => GK.saving && !!GK.genre.collects;

  /* The cast standing on the title screen, idle, facing the middle. */
  function showcase(scene, L) {
    const mode = TITLE.showcase !== 'none' ? TITLE.showcase : TITLE.layout === 'split-hero' ? 'hero' : 'none';
    if (mode === 'none') return;
    const hero = C.hero || Object.keys(C.characters).find((id) => C.characters[id].role === 'hero');
    let ids = [hero];
    if (mode === 'cast') {
      const order = ['ally', 'npc', 'enemy'];
      ids = ids.concat(Object.keys(C.characters).filter((id) => id !== hero && C.characters[id].sprite)
        .sort((a, b) => order.indexOf(C.characters[a].role) - order.indexOf(C.characters[b].role)));
    }
    ids.slice(0, Math.min(4, L.stage.slots.length)).forEach((id, i) => {
      const [x, dir] = L.stage.slots[i];
      GK.actor(scene, id, x, L.stage.feet, { height: L.stage.h * (i === 0 ? 1 : 0.88), depth: 4 + (i === 0 ? 1 : 0) }).face(dir).setMotion('idle');
    });
  }

  function brandStrip(scene) { return { link: emptyCredit(scene, H - 22) }; }

  function titleBackground(scene) {
    const firstLoc = (C.chapters[0] && C.levels[C.chapters[0].levels[0]] || {}).location;
    const bg = String(TITLE.background);
    const locId = bg.startsWith('location:') ? bg.slice(9) : null;
    const key = locId && scene.textures.exists(GK.keys.bg(locId)) ? GK.keys.bg(locId)
      : scene.textures.exists('keyart') ? 'keyart' : GK.keys.bg(firstLoc);
    GK.backdrop(scene, key, 1);
    if (bg === 'video' && scene.cache.video && scene.cache.video.exists('title:video')) {
      const v = scene.add.video(W / 2, H / 2, 'title:video');
      v.setMute(true);
      v.play(true);
      const cover = () => { if (v.width && v.height) v.setScale(Math.max(W / v.width, H / v.height)); };
      v.on('play', cover);
      v.on('locked', () => v.destroy());
      cover();
    }
    return firstLoc;
  }

  class Boot extends Phaser.Scene {
    constructor() { super('Boot'); }
    preload() {
      const bar = this.add.rectangle(W / 2 - 200, H / 2 + 60, 4, 14, GK.color(palette.accent)).setOrigin(0, 0.5);
      GK.text(this, W / 2, H / 2 + 26, C.title || '', 20, palette.muted).setOrigin(0.5);
      this.load.on('progress', (p) => bar.setSize(Math.max(4, 400 * p), 14));
      GK.queueAssets(this);
      GK.queueKitAssets(this);
      /* Playable mode never shows the title screen, so it loads none of it. */
      if (TITLE.logo && !GK.PLAYABLE) this.load.image('title:logo', TITLE.logo);
      if (TITLE.background === 'video' && TITLE.video && !QA && !GK.PLAYABLE) this.load.video('title:video', TITLE.video, true);
    }
    create() {
      GK.ensureTextures(this);
      GK.pageBackdrop(this);
      GK.setState({ scene: 'Boot' });
      if (GK.PLAYABLE) { GK.fontsReady().then(() => GK.startPlayable(this)); return; }
      const started = Date.now();
      Promise.all([GK.fontsReady(), titleFontReady()]).then(() => {
        const wait = QA ? 0 : Math.max(0, 600 - (Date.now() - started));
        this.time.delayedCall(wait, () => this.scene.start('Title'));
      });
    }
  }

  class Title extends Phaser.Scene {
    constructor() { super('Title'); }
    create() {
      GK.TEST.ready = true; /* only now: a test that switches scenes earlier would leave Boot's hand-over to Title running underneath */
      GK.setState({ scene: 'Title', status: 'idle', paused: false });
      const layouts = GK.PORTRAIT ? PORTRAIT_LAYOUTS : LAYOUTS;
      const L = layouts[TITLE.layout] || layouts.centered;
      const firstLoc = titleBackground(this);
      if (L.panel === 'left') {
        this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.12);
        this.add.image(0, 0, gradientTexture(this, 'title:panel-left', Math.round(W * 0.62), H, true, palette.bg, 0.86, 0)).setOrigin(0).setDepth(1);
      } else if (L.panel === 'bottom') {
        const ph = L.panelH || 250;
        this.add.image(0, H - ph, gradientTexture(this, 'title:panel-bottom', W, ph, false, palette.bg, 0, 0.9)).setOrigin(0).setDepth(1);
      } else {
        this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.35);
      }
      showcase(this, L);
      if (TITLE.ambient && TITLE.ambient !== 'none') ambient(this, TITLE.ambient);

      const title = titleText(this, L);
      if (L.bob) this.tweens.add({ targets: [title, title.stampFrame].filter(Boolean), y: '-=8', duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      const ox = L.align === 'left' ? 0 : 0.5;
      let flow = title.blockBottom != null ? title.blockBottom + 12 : title.y + title.displayHeight / 2 + 14;
      if (C.tagline) {
        const tag = GK.text(this, L.tx, flow, C.tagline, 24, '#ffffff', { align: L.align, wordWrap: { width: L.wrap, useAdvancedWrap: true } }).setOrigin(ox, 0).setDepth(10);
        if (L.tagMaxH) while (tag.height > L.tagMaxH && parseInt(tag.style.fontSize, 10) > 15) tag.setFontSize((parseInt(tag.style.fontSize, 10) - 2) + 'px');
        flow = tag.y + tag.height;
      }

      /* With a save: Continue (and where the player is) and New game; Chapters and Collection sit top-left. */
      const S = GK.strings;
      const started = GK.hasSave();
      const summary = started ? GK.saveSummary() : null;
      GK.setState({ extra: { continue: summary } });
      this.__gkModal = null;
      this.__gkGone = false;
      const sideBySide = L.b1[1] === L.b2[1];
      const by = Math.max(L.b1[1], L.panel === 'bottom' ? 0 : flow + 44);
      const wide = started ? 290 : 240;
      const b1x = sideBySide && !started ? L.tx : sideBySide ? L.b1[0] - 35 : L.b1[0];
      const primary = () => {
        if (this.__gkModal || this.__gkGone) return;
        this.__gkGone = true;
        GK.markSeen();
        if (started) GK.continueGame(this); else GK.startCampaign(this);
      };
      titleButton(this, b1x, by, started ? S.continue : S.play, primary, true, { w: wide, h: started ? 66 : 60, sub: summary, id: started ? 'continue' : 'play' });
      const b2y = sideBySide ? by : by + (L.b2[1] - L.b1[1]) + (started ? 6 : 0);
      if (started) {
        titleButton(this, sideBySide ? L.b2[0] + 35 : L.b2[0], b2y, S.newGame, () => {
          if (this.__gkModal || this.__gkGone) return;
          confirmBox(this, S.confirmNew, S.startOver, () => {
            this.__gkGone = true;
            GK.resetSave();
            GK.markSeen();
            GK.startCampaign(this);
          }, 'startOver');
        }, false, { id: 'newGame' });
        const links = [['chapters', S.chapters, () => { if (!this.__gkModal) { GK.markSeen(); GK.go(this, 'Map'); } }]];
        if (showsCollection()) links.push(['collection', S.collection, () => { if (!this.__gkModal) openLedger(this); }]);
        links.forEach(([id, label, fn], i) => GK.button(this, 91 + i * 162, 28, label, fn, { w: 150, h: 36, size: 18, fill: '#ffffff', id, depth: 60 }));
      }

      if (GK.hasNewContent()) {
        const badge = GK.text(this, b1x + wide / 2 + 30, by - 22, 'NEW!', 24, palette.danger).setOrigin(0.5).setAngle(12).setDepth(60);
        this.tweens.add({ targets: badge, scale: 1.2, duration: 500, yoyo: true, repeat: -1 });
      }
      const drop = GK.nextDrop();
      if (drop) {
        const label = 'Next chapter in ' + GK.countdown(drop.at) + (drop.teaser ? ': ' + drop.teaser : '');
        const dy = L.panel === 'bottom' ? (started ? 74 : L.drop[1]) : Math.max(L.drop[1], (started && !sideBySide ? b2y + 25 : by + 33) + 26);
        const dx = L.panel === 'bottom' ? W / 2 : L.drop[0];
        const t = GK.text(this, dx, Math.min(dy, H - 70), label, 20, '#ffffff', { align: L.panel === 'bottom' ? 'center' : L.align, wordWrap: { width: L.panel === 'bottom' ? Math.min(700, W - 60) : Math.min(L.wrap + 60, W - 60) } })
          .setOrigin(L.panel === 'bottom' ? 0.5 : ox, 0.5).setDepth(10);
        if (t.y + t.height / 2 > H - 48) t.setY(H - 48 - t.height / 2);
      }
      brandStrip(this);
      GK.muteButton(this);
      GK.music(this, this.cache.audio.exists('music:title') ? 'music:title' : GK.keys.music(firstLoc));
      if (this.input.keyboard) {
        this.input.keyboard.on('keydown-ENTER', primary);
        this.input.keyboard.on('keydown-ESC', () => { if (this.__gkModal) this.__gkModal.close(); });
      }
      this.cameras.main.fadeIn(QA ? 0 : 300);
    }
  }

  class MapScene extends Phaser.Scene {
    constructor() { super('Map'); }
    create() {
      GK.setState({ scene: 'Map', status: 'idle', level: null });
      this.add.rectangle(W / 2, H / 2, W, H, GK.color(palette.bg));
      GK.title(this, W / 2, 44, C.mapTitle || 'Chapters', 40, palette.accent).setOrigin(0.5);
      const list = GK.chapters();
      const cols = Math.min(GK.PORTRAIT ? 2 : 3, list.length + (GK.nextDrop() ? 1 : 0));
      const cardW = GK.PORTRAIT ? 236 : 270;
      const gap = 24;
      const startX = W / 2 - ((cols - 1) * (cardW + gap)) / 2;
      list.forEach((ch, i) => {
        const x = startX + (i % cols) * (cardW + gap);
        const y = 170 + Math.floor(i / cols) * 170;
        const open = GK.chapterUnlocked(i);
        const done = ch.levels.filter((id) => GK.progress.done.includes(id)).length;
        const loc = (C.levels[ch.levels[0]] || {}).location;
        /* Locked chapters are shaded through a baked texture (setTint is WebGL-only). */
        const thumb = this.add.image(x, y - 10, open ? GK.keys.bg(loc) : GK.tintedKey(this, GK.keys.bg(loc), 0x444444));
        thumb.setScale(Math.max(cardW / thumb.width, 120 / thumb.height));
        thumb.setCrop((thumb.width - cardW / thumb.scale) / 2, (thumb.height - 120 / thumb.scale) / 2, cardW / thumb.scale, 120 / thumb.scale);
        this.add.rectangle(x, y + 10, cardW, 160).setStrokeStyle(4, open ? GK.color(palette.accent) : 0x666666);
        GK.text(this, x, y + 66, ch.title, 20, open ? '#ffffff' : '#888888', { wordWrap: { width: cardW - 20 } }).setOrigin(0.5);
        GK.text(this, x, y - 52, open ? done + '/' + ch.levels.length : 'Locked', 18, palette.accent).setOrigin(0.5);
        if (open) {
          const hit = this.add.rectangle(x, y + 10, cardW, 160, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
          hit.on('pointerdown', () => GK.startChapter(this, ch.id));
        }
      });
      const drop = GK.nextDrop();
      if (drop) {
        const i = list.length;
        const x = startX + (i % cols) * (cardW + gap);
        const y = 170 + Math.floor(i / cols) * 170;
        this.add.rectangle(x, y + 10, cardW, 160, 0x000000, 0.4).setStrokeStyle(4, 0xffffff, 0.4);
        GK.text(this, x, y - 20, 'Coming in ' + GK.countdown(drop.at), 22, palette.accent).setOrigin(0.5);
        GK.text(this, x, y + 30, drop.teaser || '???', 18, '#ffffff', { wordWrap: { width: cardW - 24 } }).setOrigin(0.5);
      }
      GK.button(this, 90, H - 40, '◀ Title', () => GK.go(this, 'Title'), { w: 140, h: 44, size: 20, fill: '#ffffff' });
      GK.muteButton(this);
      this.cameras.main.fadeIn(QA ? 0 : 250);
    }
  }

  class End extends Phaser.Scene {
    constructor() { super('End'); }
    create() {
      GK.setState({ scene: 'End', status: 'ended', level: null });
      const drop = GK.nextDrop();
      const lastLoc = (C.levels[GK.chapters().slice(-1)[0].levels.slice(-1)[0]] || {}).location;
      GK.backdrop(this, this.textures.exists('keyart') ? 'keyart' : GK.keys.bg(lastLoc), 1);
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5);
      const heading = drop ? GK.strings.toBeContinued || 'To be continued...' : GK.strings.theEnd || 'The End';
      const ys = GK.PORTRAIT ? H / 540 : 1;   /* portrait spreads the same column over the tall screen */
      const wrap = Math.min(760, W - 60);
      GK.title(this, W / 2, 150 * ys, heading, GK.PORTRAIT ? 46 : 58, palette.accent, GK.PORTRAIT ? { wordWrap: { width: W - 60 } } : {}).setOrigin(0.5);
      if (drop) {
        GK.text(this, W / 2, 240 * ys, drop.teaser || '', 26, '#ffffff', { wordWrap: { width: wrap } }).setOrigin(0.5);
        GK.text(this, W / 2, 310 * ys, 'Next chapter in ' + GK.countdown(drop.at) + '. Come back!', 24, palette.accent, { wordWrap: { width: wrap } }).setOrigin(0.5);
      } else if (C.outro) {
        GK.text(this, W / 2, 260 * ys, C.outro, 24, '#ffffff', { wordWrap: { width: wrap } }).setOrigin(0.5);
      }
      GK.button(this, W / 2, 410 * ys, 'Chapters', () => GK.go(this, 'Map'));
      brandBadge(this, H - 22);
      GK.muteButton(this);
      this.cameras.main.fadeIn(QA ? 0 : 300);
    }
  }

  /* ---------- pause menu (over the frozen Play scene) ---------- */

  class Pause extends Phaser.Scene {
    constructor() { super('Pause'); }
    init(data) { this.levelId = data.id; }
    create() {
      const S = GK.strings;
      this.__gkModal = null;
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setInteractive();
      const items = [
        ['resume', S.resume, () => this.resume(), true],
        ['restartLevel', S.restartLevel, () => this.restartLevel()],
        ['restartGame', S.restartGame, () => confirmBox(this, S.confirmRestart, S.startOver, () => this.restartGame(), 'startOver')],
        showsCollection() ? ['collection', S.collection, () => openLedger(this)] : null,
        ['quit', S.quit, () => this.quit()],
      ].filter(Boolean);
      const gap = 60;
      const h = 112 + items.length * gap;
      const top = H / 2 - h / 2;
      GK.panel(this, W / 2, H / 2, 400, h);
      GK.title(this, W / 2, top + 42, S.paused, 34, GK.readable ? GK.readable(palette.accent, GK.skin.panel) : palette.accent, { strokeThickness: GK.skin.inkStroke }).setOrigin(0.5);
      items.forEach(([id, label, fn, primary], i) => titleButton(this, W / 2, top + 106 + i * gap, label, () => { if (!this.__gkModal) fn(); }, !!primary, { w: 290, h: 50, size: 22, id }));
      const back = () => { if (this.__gkModal) this.__gkModal.close(); else this.resume(); };
      if (this.input.keyboard) {
        this.input.keyboard.on('keydown-ESC', back);
        this.input.keyboard.on('keydown-P', back);
      }
      GK.muteButton(this);
    }
    resume() {
      GK.setState({ paused: false });
      this.scene.resume('Play');
      this.scene.stop();
    }
    restartLevel() { GK.restartLevel(this); }
    restartGame() {
      GK.resetSave();
      GK.setState({ paused: false });
      this.scene.stop('Play');
      GK.startCampaign(this);
    }
    quit() {
      GK.autosave(this.scene.get('Play'));
      GK.setState({ paused: false });
      this.scene.stop('Play');
      GK.go(this, 'Title');
    }
  }

  /* ---------- collection: what was found, level by level (title and pause) ---------- */

  const PER_PAGE = GK.PORTRAIT ? 8 : 9;
  /* Ledger grid: 3 columns on a wide screen, 2 on a tall one. */
  const LG = GK.PORTRAIT ? { cols: 2, pitch: 244, w: 230, inner: 100, clip: 180, items: 8, flip: 175 }
    : { cols: 3, pitch: 282, w: 268, inner: 120, clip: 210, items: 14, flip: 230 };

  class Ledger extends Phaser.Scene {
    constructor() { super('Ledger'); }
    init(data) { this.from = data.from; this.page = data.page || 0; }
    create() {
      const S = GK.strings;
      const ink = (str, x, y, size, opts) => GK.ink(this, x, y, str, size, opts);
      this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive();
      GK.panel(this, W / 2, H / 2, W - 60, H - 40);
      GK.title(this, W / 2, 52, S.collection, 34, GK.readable ? GK.readable(palette.accent, GK.skin.panel) : palette.accent, { strokeThickness: GK.skin.inkStroke }).setOrigin(0.5);
      const list = GK.ledger();
      const found = [];
      list.forEach((l) => l.items.forEach((i) => { if (!found.includes(i)) found.push(i); }));
      const shown = found.slice(0, LG.items);
      shown.forEach((id, i) => {
        const im = this.add.image(W / 2 + (i - (shown.length - 1) / 2) * 56, 108, GK.keys.item(id));
        im.setScale(44 / Math.max(im.width, im.height));
      });
      if (!found.length) ink(S.nothingFound || 'Nothing found yet', W / 2, 108, 20).setOrigin(0.5);
      const got = list.reduce((n, l) => n + l.got, 0);
      const of = list.reduce((n, l) => n + l.of, 0);
      const best = list.reduce((n, l) => n + l.best, 0);
      ink([of ? '★ ' + got + '/' + of : null, best ? S.best + ' ' + best : null].filter(Boolean).join('   ·   '), W / 2, 150, 20).setOrigin(0.5);

      const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
      this.page = Math.min(this.page, pages - 1);
      const well = GK.mix ? GK.mix(GK.skin.panel, '#000000', 0.14) : GK.skin.panel;
      list.slice(this.page * PER_PAGE, (this.page + 1) * PER_PAGE).forEach((l, i) => {
        const x = W / 2 + ((i % LG.cols) - (LG.cols - 1) / 2) * LG.pitch;
        const y = 216 + Math.floor(i / LG.cols) * 90;
        GK.panel(this, x, y, LG.w, 78, { fill: well, alpha: 1, edgeWidth: 2, radius: 10, plain: true });
        const mark = l.done ? '✓' : l.playing ? '▶' : l.open ? '' : '·';
        let title = l.title;
        const t = ink(title, x - LG.inner, y - 30, 18, { align: 'left' });
        while (t.width > LG.clip && title.length > 4) { title = title.slice(0, -2); t.setText(title.trim() + '…'); }
        ink(mark, x + LG.inner, y - 30, 20, { align: 'right' }).setOrigin(1, 0);
        const line = l.open ? [l.of ? '★ ' + l.got + '/' + l.of : null, l.best ? S.best + ' ' + l.best : null].filter(Boolean).join('   ') : S.locked || 'Locked';
        ink(line, x - LG.inner, y + 2, 17, { align: 'left' }).setAlpha(0.85);
      });
      if (pages > 1) {
        const flip = (d) => this.scene.restart({ from: this.from, page: (this.page + d + pages) % pages });
        GK.button(this, W / 2 - LG.flip, H - 52, '◀', () => flip(-1), { w: 70, h: 44, size: 22, fill: '#ffffff', id: 'prevPage' });
        GK.button(this, W / 2 + LG.flip, H - 52, '▶', () => flip(1), { w: 70, h: 44, size: 22, fill: '#ffffff', id: 'nextPage' });
      }
      titleButton(this, W / 2, H - 52, S.back, () => this.close(), true, { w: 200, h: 48, size: 22, id: 'back' });
      if (this.input.keyboard) this.input.keyboard.on('keydown-ESC', () => this.close());
    }
    close() {
      this.scene.resume(this.from);
      this.scene.stop();
    }
  }

  GK.scenes = [Boot, Title, MapScene, End];
  GK.overlays = [Pause, Ledger];
})();
