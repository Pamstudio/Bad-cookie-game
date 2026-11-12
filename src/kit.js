/* UI kit: what makes one game look unlike another. Per-game story materials (paper, boards, phone skins),
   decorations, generated frames (9-slice), the dialog box (C.ui.dialog) and hint toasts (C.ui.hint). */
(function () {
  'use strict';
  const { W, H, C, QA, palette } = GK;
  const STYLE = GK.story.style;
  const MONO = '"Courier New", Courier, monospace';
  /* System monospace fonts report a short descent; padding keeps g, p and y from being clipped. */
  const MONO_PAD = { top: 2, bottom: 6 };
  /* Below the HUD: one row on a wide screen, two rows (band y 0-84) on a tall one. */
  const HUD_GAP = GK.PORTRAIT ? 30 : 0;

  /* ---------- colour ---------- */

  const rgb = (hex) => Phaser.Display.Color.HexStringToColor(hex || '#888888');
  function lum(hex) {
    const c = rgb(hex);
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function contrast(a, b) { const x = lum(a); const y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  /* Keep the requested ink when it reads on the background (WCAG 4.5:1), else the better of near-black and white. */
  function readable(ink, bg) {
    if (contrast(ink, bg) >= 4.5) return ink;
    return contrast('#161616', bg) >= contrast('#ffffff', bg) ? '#161616' : '#ffffff';
  }
  const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  function mix(a, b, t) { const x = rgb(a); const y = rgb(b); return hex(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t); }
  const rgba = (h, a) => { const c = rgb(h); return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')'; };

  /* Deterministic noise so QA screenshots repeat. */
  function seeded(seed) { let s = seed % 2147483647 || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  const hashStr = (str) => { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 2147483647; return h; };

  /* ---------- materials: per story style, chosen per game (story.material) ---------- */

  const P = palette;
  const MATERIALS = {
    journal: {
      ruled: { paper: '#fbf5e6', ink: '#2f3b5c', head: '#9a3030', header: 'hand', lines: 'ruled', margin: '#d27a7a', placement: 'tilted' },
      graph: { paper: '#f4f6f2', ink: '#2b3a2e', head: '#5d6b60', header: 'pencil', lines: 'grid', placement: 'tilted' },
      leather: { paper: '#efe2c4', ink: '#3a2a1c', head: '#6b3b1f', header: 'flourish', cover: '#4a2c1a', placement: 'spread' },
      parchment: { paper: '#ead9ae', ink: '#3b2a16', head: '#6e3d16', header: 'flourish', burnt: true, placement: 'centered' },
      report: { paper: '#fafaf7', ink: '#1e1e1e', head: '#1e1e1e', header: 'report', mono: true, placement: 'centered' },
      telegram: { paper: '#f2e6b8', ink: '#2a2a2a', head: '#b22222', header: 'telegram', mono: true, placement: 'tilted' },
      log: { paper: '#e9eef1', ink: '#1f2a33', head: '#1f2a33', header: 'log', mono: true, lines: 'columns', placement: 'centered' },
      stationery: { paper: '#fdfbf6', ink: '#2a2440', head: P.accent, header: 'letterhead', placement: 'tilted' },
    },
    storybook: {
      cloth: { paper: '#f6ecd8', ink: '#3b2f2a', head: '#8a3b2a', cover: '#5b2e2e', edge: '#8a6a4a' },
      watercolor: { paper: '#fbf8f2', ink: '#33343d', head: '#4d5f7a', wash: P.accent, edge: '#c9c2b4' },
      picturebook: { paper: '#fffdf8', ink: '#222222', head: P.accent, bleed: true, edge: '#e5ddd0' },
    },
    comic: {
      digital: { bg: P.bg, panel: '#ffffff', border: '#111111', caption: P.accent, ink: '#111111' },
      newsprint: { bg: '#e9e2cf', panel: '#f4efe1', border: '#1d1d1d', caption: '#f3d36b', ink: '#1d1d1d', halftone: true },
      screentone: { bg: '#ffffff', panel: '#ffffff', border: '#000000', caption: '#ffffff', ink: '#000000', tone: true },
    },
    chat: {
      'phone-dark': { bg: P.bg, bar: P.panel, mine: P.accent, theirs: P.panel, mineInk: '#111111', theirsInk: P.text, meta: P.muted, radius: 20 },
      'phone-light': { bg: '#f2f2f7', bar: '#ffffff', mine: '#0a84ff', theirs: '#e5e5ea', mineInk: '#ffffff', theirsInk: '#111111', meta: '#6b6b72', radius: 20 },
      sms: { bg: '#9fb08a', bar: '#7f9168', mine: '#c6d4a8', theirs: '#b5c597', mineInk: '#1c2414', theirsInk: '#1c2414', meta: '#3a4a2a', radius: 2, mono: true },
      terminal: { bg: '#07110b', bar: '#0e1f15', mine: null, theirs: null, mineInk: '#9cff9c', theirsInk: '#7ad7ff', meta: '#4f8f62', radius: 0, mono: true, terminal: true },
    },
    stage: {
      gradient: {},
      curtain: { curtain: '#7a1424', valance: '#5c0f1b', trim: '#d4af37' },
      filmstrip: { film: '#0d0d0d', tint: 0xd8c3a0 },
    },
  };
  const DEFAULT_MATERIAL = { journal: 'ruled', storybook: 'cloth', comic: 'digital', chat: 'phone-dark', stage: 'gradient' };
  const materialId = (GK.story.material && MATERIALS[STYLE] && MATERIALS[STYLE][GK.story.material]) ? GK.story.material : DEFAULT_MATERIAL[STYLE];
  const MAT = (MATERIALS[STYLE] || {})[materialId] || {};

  /* ---------- procedural paper (canvas textures work in both renderers) ---------- */

  function canvasTex(scene, key, w, h, draw) {
    if (scene.textures.exists(key)) return key;
    const tex = scene.textures.createCanvas(key, w, h);
    draw(tex.getContext(), w, h);
    tex.refresh();
    return key;
  }

  function grain(ctx, w, h, amount, rnd) {
    for (let i = 0; i < (w * h) / 90; i++) {
      ctx.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,' + amount * rnd() + ')' : 'rgba(255,255,255,' + amount * rnd() + ')';
      ctx.fillRect(rnd() * w, rnd() * h, 1.5, 1.5);
    }
  }

  function paintPaper(ctx, w, h, m, rnd) {
    ctx.fillStyle = m.paper || '#f6efe0';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 0.05, rnd);
    if (m.burnt) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.62);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(90,50,10,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    if (m.wash) {
      for (let i = 0; i < 7; i++) {
        const x = rnd() * w;
        const y = rnd() < 0.5 ? rnd() * h * 0.2 : h - rnd() * h * 0.2;
        const r = 60 + rnd() * 140;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(m.wash, 0.16));
        g.addColorStop(1, rgba(m.wash, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    ctx.lineWidth = 1;
    if (m.lines === 'ruled') {
      ctx.strokeStyle = 'rgba(80,110,160,0.22)';
      for (let y = 78; y < h - 10; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.strokeStyle = rgba(m.margin || '#d27a7a', 0.6);
      ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, h); ctx.stroke();
    } else if (m.lines === 'grid') {
      ctx.strokeStyle = 'rgba(70,120,110,0.18)';
      for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    } else if (m.lines === 'columns') {
      ctx.strokeStyle = 'rgba(30,50,70,0.35)';
      /* One time column; journal text starts right of it (story.js PAGE_RULES.columns). */
      ctx.beginPath(); ctx.moveTo(112, 64); ctx.lineTo(112, h - 16); ctx.stroke();
      ctx.strokeStyle = 'rgba(30,50,70,0.14)';
      for (let y = 96; y < h - 10; y += 30) { ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(w - 16, y); ctx.stroke(); }
    }
    if (m.header === 'telegram') {
      ctx.strokeStyle = 'rgba(40,40,40,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(14, 14, w - 28, h - 28);
    }
  }

  /* A page object (Image of a canvas texture, or a 9-slice of the generated page) centred on (x, y). */
  function page(scene, x, y, w, h, opts) {
    const o = opts || {};
    w = Math.round(w); h = Math.round(h);
    if (scene.textures.exists('ui:story-page')) return nineSlice(scene, 'ui:story-page', x, y, w, h, GK.C.story && GK.C.story.pageInset);
    const m = Object.assign({}, MAT, o.material || {});
    const key = canvasTex(scene, 'page:' + STYLE + ':' + materialId + ':' + w + 'x' + h + (o.tag || ''), w, h, (ctx) => paintPaper(ctx, w, h, m, seeded(hashStr(materialId + w + h))));
    return scene.add.image(x, y, key);
  }

  /* ---------- 9-slice from any texture (frames on the texture + scaled images) ---------- */

  function nineSlice(scene, key, x, y, w, h, insetFrac) {
    const tex = scene.textures.get(key);
    const src = tex.getSourceImage();
    const sw = src.width;
    const sh = src.height;
    const inset = Math.round(Math.min(sw, sh) * Math.max(0.05, Math.min(0.45, insetFrac || 0.22)));
    const cs = Math.max(4, Math.min(inset, w / 2 - 1, h / 2 - 1));
    const xs = [0, inset, sw - inset, sw];
    const ys = [0, inset, sh - inset, sh];
    const dx = [-w / 2, -w / 2 + cs, w / 2 - cs, w / 2];
    const dy = [-h / 2, -h / 2 + cs, h / 2 - cs, h / 2];
    const c = scene.add.container(x, y);
    for (let r = 0; r < 3; r++) {
      for (let col = 0; col < 3; col++) {
        const name = '9s:' + inset + ':' + r + col;
        if (!tex.has(name)) tex.add(name, 0, xs[col], ys[r], xs[col + 1] - xs[col], ys[r + 1] - ys[r]);
        const im = scene.add.image(dx[col], dy[r], key, name).setOrigin(0, 0);
        im.setDisplaySize(Math.max(1, dx[col + 1] - dx[col]), Math.max(1, dy[r + 1] - dy[r]));
        c.add(im);
      }
    }
    c.setSize(w, h);
    return c;
  }

  /* Average colour of a texture's centre: what text on a generated frame sits on. */
  function centreColour(scene, key) {
    try {
      const src = scene.textures.get(key).getSourceImage();
      const cv = document.createElement('canvas');
      cv.width = 16; cv.height = 16;
      const ctx = cv.getContext('2d');
      ctx.drawImage(src, src.width * 0.35, src.height * 0.35, src.width * 0.3, src.height * 0.3, 0, 0, 16, 16);
      const d = ctx.getImageData(0, 0, 16, 16).data;
      let r = 0; let g = 0; let b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4;
      return hex(r / n, g / n, b / n);
    } catch (e) { return '#808080'; }
  }

  /* ---------- decorations (story.decorations, 0-2), palette coloured ---------- */

  function decoration(scene, kind, x, y, angle) {
    const g = scene.add.graphics({ x, y });
    const acc = GK.color(P.accent);
    const red = 0xa3262a;
    switch (kind) {
      case 'stamp':
        g.lineStyle(4, red, 0.55).strokeCircle(0, 0, 38).lineStyle(2, red, 0.55).strokeCircle(0, 0, 30);
        g.fillStyle(red, 0.45).fillRect(-26, -6, 52, 12);
        break;
      case 'wax-seal':
        g.fillStyle(0x8e1b1b, 1).fillCircle(0, 0, 26);
        for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; g.fillCircle(Math.cos(a) * 24, Math.sin(a) * 24, 7); }
        g.lineStyle(3, 0x5a0d0d, 0.8).strokeCircle(0, 0, 15);
        g.fillStyle(0xc0392b, 0.6).fillCircle(-6, -7, 6);
        break;
      case 'coffee-ring':
        g.lineStyle(7, 0x6f4a2a, 0.22).strokeCircle(0, 0, 42).lineStyle(3, 0x6f4a2a, 0.16).strokeCircle(3, 2, 38);
        break;
      case 'paper-clip':
        g.lineStyle(4, 0x8a9096, 1);
        g.strokeRoundedRect(-9, -36, 18, 72, 9).strokeRoundedRect(-4, -24, 8, 52, 4);
        break;
      case 'tape':
        g.fillStyle(0xf3e3a0, 0.75).fillRect(-46, -12, 92, 24);
        break;
      case 'pressed-flower':
        for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.fillStyle(acc, 0.55).fillEllipse(Math.cos(a) * 12, Math.sin(a) * 12, 18, 11); }
        g.fillStyle(0xe8c34a, 0.9).fillCircle(0, 0, 6);
        g.lineStyle(2, 0x5b7a3a, 0.8).lineBetween(0, 8, 6, 46);
        break;
      case 'ink-blot': {
        const r = seeded(hashStr(kind + x + y));
        g.fillStyle(0x1c2340, 0.75).fillCircle(0, 0, 16);
        for (let i = 0; i < 7; i++) g.fillCircle((r() - 0.5) * 50, (r() - 0.5) * 40, 3 + r() * 7);
        break;
      }
      case 'postmark':
        g.lineStyle(3, 0x2a2a2a, 0.45).strokeCircle(0, 0, 30);
        for (let i = 0; i < 4; i++) {
          g.beginPath();
          for (let t = 0; t <= 80; t += 4) g.lineTo(34 + t, -18 + i * 12 + Math.sin(t / 6) * 3);
          g.strokePath();
        }
        break;
      default:
        break;
    }
    g.setAngle(angle || 0);
    return g;
  }

  /* Bounding box of each decoration around its anchor, at the scale it is drawn (marks 0.8). */
  const DECOR_BOX = {
    stamp: { x: -34, y: -34, w: 68, h: 68 },
    'wax-seal': { x: -33, y: -33, w: 66, h: 66 },
    'coffee-ring': { x: -38, y: -38, w: 76, h: 76 },
    'pressed-flower': { x: -20, y: -18, w: 40, h: 58 },
    'ink-blot': { x: -34, y: -26, w: 68, h: 52 },
    postmark: { x: -26, y: -26, w: 120, h: 52 },
    'paper-clip': { x: -10, y: -36, w: 20, h: 72 },
    tape: { x: -42, y: -30, w: 84, h: 60 },
  };
  const MARK_SCALE = 0.8;
  const hit = (a, b, m) => a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y;

  /* Adds the game's decorations to a page where they sit on paper only: each is tried at the spots that suit it
     and placed at the first one clear of every occupied box (header, text column, photo) with a margin, inside the page
     (edge items may hang over the edge). A decoration that fits nowhere is left out. */
  function decorate(scene, container, w, h, occupied) {
    const taken = (occupied || []).slice();
    const list = ((GK.C.story && GK.C.story.decorations) || []).slice(0, 2);
    const spots = {
      mark: [[w / 2 - 58, h / 2 - 48, 12], [-w / 2 + 58, h / 2 - 48, -10], [w / 2 - 58, 0, 8], [w / 2 - 58, -h / 2 + 70, -6], [-w / 2 + 58, -h / 2 + 70, 6]],
      'paper-clip': [[-w / 2 + 4, -h / 2 + 96, 0], [-w / 2 + 4, 0, 0], [w / 2 - 4, -h / 2 + 96, 0], [-w / 2 + 4, h / 2 - 96, 0]],
      tape: [[-w / 2 + 20, h / 2 - 10, -38], [w / 2 - 20, h / 2 - 10, 38], [-w / 2 + 20, -h / 2 + 10, 38], [w / 2 - 20, -h / 2 + 10, -38]],
    };
    list.forEach((kind) => {
      const box = DECOR_BOX[kind];
      if (!box) return;
      const edge = kind === 'tape' || kind === 'paper-clip';
      const k = edge ? 1 : MARK_SCALE;
      for (const [x, y, a] of spots[edge ? kind : 'mark']) {
        const r = { x: x + box.x * k, y: y + box.y * k, w: box.w * k, h: box.h * k };
        const inside = edge || (r.x >= -w / 2 + 6 && r.y >= -h / 2 + 6 && r.x + r.w <= w / 2 - 6 && r.y + r.h <= h / 2 - 6);
        if (!inside || taken.some((t) => hit(r, t, 8))) continue;
        const g = decoration(scene, kind, x, y, a);
        if (!edge) g.setScale(MARK_SCALE);
        container.add(g);
        taken.push(r);
        return;
      }
    });
  }

  /* ---------- material headers (the date line of a journal sheet, a report, a telegram, ...) ---------- */

  function header(scene, container, w, h, label, m) {
    const left = -w / 2 + 40;
    const top = -h / 2 + 28;
    const head = readable(m.head || P.accent, m.paper || '#ffffff');
    const add = (o) => { container.add(o); return o; };
    switch (m.header) {
      case 'report':
        add(scene.add.rectangle(0, top + 6, w - 60, 4, GK.color(head)));
        add(GK.text(scene, left, top + 16, 'REPORT  /  ' + (label || '').toUpperCase(), 20, head, { fontFamily: MONO, padding: MONO_PAD, strokeThickness: 0, align: 'left' }));
        add(scene.add.rectangle(0, top + 50, w - 60, 1, GK.color(head), 0.6));
        return top + 70;
      case 'telegram': {
        add(GK.text(scene, 0, top + 4, 'T E L E G R A M', 22, '#2a2a2a', { fontFamily: MONO, padding: MONO_PAD, strokeThickness: 0 }).setOrigin(0.5, 0));
        add(scene.add.rectangle(0, top + 38, w - 80, 1, 0x2a2a2a, 0.5));
        if (label) {
          const lab = GK.text(scene, 0, 0, label.toUpperCase(), 18, '#b22222', { fontFamily: MONO, padding: MONO_PAD, strokeThickness: 0 }).setOrigin(0.5).setAlpha(0.85);
          const sw = Math.min(w / 2, lab.width + 28);
          const st = add(scene.add.container(w / 2 - 40 - sw / 2, top + 66).setAngle(-4));
          st.add(scene.add.rectangle(0, 0, sw, 34).setStrokeStyle(3, GK.color('#b22222'), 0.8));
          st.add(lab);
          return top + 96;
        }
        return top + 52;
      }
      case 'log':
        add(GK.text(scene, left, top, 'STATION LOG', 20, head, { fontFamily: MONO, padding: MONO_PAD, strokeThickness: 0, align: 'left' }));
        add(GK.text(scene, w / 2 - 40, top, label || '', 20, head, { fontFamily: MONO, padding: MONO_PAD, strokeThickness: 0 }).setOrigin(1, 0));
        return top + 64;
      case 'letterhead':
        add(GK.title(scene, 0, top, GK.C.title || '', 22, head, { strokeThickness: 0 }).setOrigin(0.5, 0));
        add(scene.add.rectangle(0, top + 34, w - 120, 2, GK.color(head), 0.6));
        if (label && label !== GK.C.title) {
          add(GK.text(scene, w / 2 - 40, top + 44, label, 20, m.ink, { strokeThickness: 0 }).setOrigin(1, 0));
          return top + 82;
        }
        return top + 54;
      case 'flourish':
        if (label) add(GK.title(scene, 0, top, label, 24, head, { strokeThickness: 0, fontStyle: 'italic' }).setOrigin(0.5, 0));
        add(scene.add.rectangle(0, top + 40, 160, 2, GK.color(head), 0.7));
        add(scene.add.circle(0, top + 40, 4, GK.color(head), 0.9));
        return top + 64;
      case 'pencil':
        if (label) add(GK.text(scene, w / 2 - 40, top, label, 22, head, { strokeThickness: 0, fontStyle: 'italic' }).setOrigin(1, 0));
        return top + 48;
      default:
        if (label) add(GK.title(scene, left + 30, top, label, 24, head, { align: 'left', strokeThickness: 0 }));
        return top + 52;
    }
  }

  /* ---------- dialog kit (C.ui.dialog) ---------- */

  const DIALOG = (UIConfig().dialog) || null;
  const HINT = Object.assign({ position: 'top' }, UIConfig().hint || {});
  function UIConfig() { return GK.C.ui || {}; }

  const D = DIALOG ? Object.assign({ layout: 'bottom-bar', portrait: 'framed', name: 'inline', text: 'typewriter', surface: 'skin', position: 'bottom', inset: 0.22 }, DIALOG) : null;
  const kitFill = () => (D && D.fill) || (D && D.surface === 'page' && STYLE === 'journal' ? MAT.paper : null) || (D && D.layout === 'terminal' ? '#050b07' : GK.skin.panel);

  function circleTexture(scene, srcKey, size, ring) {
    const key = srcKey + ':circle' + size;
    return canvasTex(scene, key, size, size, (ctx) => {
      const src = scene.textures.get(srcKey).getSourceImage();
      ctx.save();
      ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
      const s = Math.max(size / src.width, size / src.height);
      ctx.drawImage(src, (size - src.width * s) / 2, (size - src.height * s) / 2, src.width * s, src.height * s);
      ctx.restore();
      ctx.lineWidth = 5;
      ctx.strokeStyle = ring;
      ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2); ctx.stroke();
    });
  }

  /* Portrait in the chosen style; returns the width it takes on the text side. */
  function drawPortrait(scene, add, d, id, x, y, boxH, depth) {
    const ch = (C.characters || {})[id];
    if (!ch || D.portrait === 'none') return 0;
    const pk = GK.keys.portrait(id);
    const edge = D.edge || GK.skin.edge;
    if (D.portrait === 'circle') {
      const size = Math.min(110, boxH - 20);
      add(scene.add.image(x, y, circleTexture(scene, pk, 128, edge)).setDisplaySize(size, size)).setDepth(depth + 1);
      return size + 24;
    }
    if (D.portrait === 'polaroid') {
      const size = Math.min(96, boxH - 40);
      const c = add(scene.add.container(x, y - 4).setAngle(-5));
      c.setDepth(depth + 1);
      c.add(scene.add.rectangle(4, 6, size + 16, size + 40, 0x000000, 0.25));
      c.add(scene.add.rectangle(0, 0, size + 16, size + 40, 0xffffff));
      const im = scene.add.image(0, -10, pk);
      im.setScale(size / Math.max(im.width, im.height));
      c.add(im);
      return size + 40;
    }
    if (D.portrait === 'bust' && !d.top) {
      const im = add(scene.add.image(x, y + boxH / 2, pk).setOrigin(0.5, 1));
      im.setScale(210 / Math.max(im.width, im.height)).setDepth(depth + 1);
      return 150;
    }
    if (D.portrait === 'bust') {
      const im = add(scene.add.image(x, y, pk));
      im.setScale((boxH - 8) / Math.max(im.width, im.height)).setDepth(depth + 1);
      return boxH + 8;
    }
    if (D.portrait === 'badge') {
      const r = Math.min(40, boxH / 2 - 12);
      add(scene.add.circle(x, y, r, GK.color(ch.color || P.accent))).setStrokeStyle(4, 0xffffff, 0.9).setDepth(depth + 1);
      add(GK.title(scene, x, y, (ch.name || '?').charAt(0).toUpperCase(), Math.round(r * 1.1), readable('#ffffff', ch.color || P.accent), { strokeThickness: 0 }).setOrigin(0.5)).setDepth(depth + 2);
      return r * 2 + 24;
    }
    const size = Math.min(120, boxH - 24);
    const im = add(scene.add.image(x, y, pk));
    im.setScale(size / Math.max(im.width, im.height)).setDepth(depth + 1);
    add(scene.add.rectangle(x, y, size + 8, size + 8).setStrokeStyle(4, GK.color(edge))).setDepth(depth + 1);
    return size + 30;
  }

  function surface(scene, add, x, y, w, h, depth, fill) {
    if (D.frame && scene.textures.exists('ui:dialog-frame')) {
      return add(nineSlice(scene, 'ui:dialog-frame', x, y, w, h, D.inset)).setDepth(depth);
    }
    if (D.surface === 'page' && STYLE === 'journal') return add(page(scene, x, y, w, h, { tag: ':dlg' })).setDepth(depth);
    return add(GK.panel(scene, x, y, w, h, { fill, alpha: D.layout === 'terminal' ? 0.92 : 1, edge: D.edge || GK.skin.edge, radius: D.radius != null ? D.radius : (D.layout === 'terminal' ? 2 : GK.skin.radius), plain: true })).setDepth(depth);
  }

  /* Text that appears per D.text; returns { done, finish, stop }. */
  function reveal(scene, obj, full) {
    if (QA || D.text === 'instant' || !full) { obj.setText(full); return { done: () => true, finish() {}, stop() {} }; }
    if (D.text === 'fade') {
      obj.setText(full).setAlpha(0);
      let fin = false;
      const tw = scene.tweens.add({ targets: obj, alpha: 1, duration: 420 / GK.story.textSpeed, onComplete: () => { fin = true; } });
      return { done: () => fin, finish: () => { tw.stop(); obj.setAlpha(1); fin = true; }, stop: () => tw.stop() };
    }
    const parts = D.text === 'words' ? full.split(/(\s+)/) : full.split('');
    let i = 0;
    const ev = scene.time.addEvent({
      delay: D.text === 'words' ? Math.round(90 / GK.story.textSpeed) : Math.max(4, Math.round(18 / GK.story.textSpeed)),
      repeat: parts.length - 1,
      callback: () => { i++; obj.setText(parts.slice(0, i).join('') + (D.layout === 'terminal' && i < parts.length ? '_' : '')); },
    });
    return { done: () => i >= parts.length, finish: () => { ev.remove(false); i = parts.length; obj.setText(full); }, stop: () => ev.remove(false) };
  }

  /* Where a box may sit: bottom layouts move under the HUD when the play scene shows touch buttons. */
  const avoidBottom = (scene) => !!scene.__gkPad;

  function kitSpeech(scene, speakerId, line, depth, minH) {
    const ch = (C.characters || {})[speakerId];
    const d = depth || 150;
    const parts = [];
    const add = (o) => { parts.push(o); if (o.setScrollFactor) o.setScrollFactor(0); if (o.setDepth) o.setDepth(d); return o; };
    const fill = kitFill();
    const inkColour = D.frame && scene.textures.exists('ui:dialog-frame')
      ? readable(D.ink || '#1a1a1a', centreColour(scene, 'ui:dialog-frame'))
      : readable(D.ink || (D.layout === 'terminal' ? '#9cff9c' : GK.skin.ink), fill);
    const nameColour = readable(D.nameColor || (D.layout === 'terminal' ? '#7ad7ff' : GK.skin.name), fill);
    const family = D.layout === 'terminal' ? { fontFamily: MONO, padding: MONO_PAD } : {};
    const top = avoidBottom(scene) || D.layout === 'top-bar' || (D.layout === 'terminal' && D.position === 'top');
    let reveals = null;

    if (D.layout === 'subtitle') {
      /* Portrait: a taller band and a wider wrap, since the stage is narrow. */
      const sh = GK.PORTRAIT ? 170 : 120;
      const y = top ? 110 + (GK.PORTRAIT ? HUD_GAP + 25 : 0) : H - 14 - sh / 2;
      scene.__gkDialog = { top: y - sh / 2, bottom: y + sh / 2 };
      add(scene.add.rectangle(W / 2, y, W, sh, 0x000000, 0.45));
      if (ch && D.name !== 'none') add(GK.text(scene, W / 2, y - sh / 2 + 22, D.name === 'caps' ? ch.name.toUpperCase() : ch.name, 20, D.nameColor || P.accent, { strokeThickness: 3 }).setOrigin(0.5)).setDepth(d + 1);
      const body = add(GK.text(scene, W / 2, y + (GK.PORTRAIT ? 14 : 8), '', 24, '#ffffff', { strokeThickness: 4, wordWrap: { width: GK.PORTRAIT ? W - 60 : W - 160 } }).setOrigin(0.5)).setDepth(d + 1);
      reveals = reveal(scene, body, line);
    } else if (D.layout === 'letter') {
      const LW = Math.min(600, W - 40);
      const body = GK.ink(scene, 0, 0, line, 22, { align: 'left', wordWrap: { width: LW - 100 }, lineSpacing: 6 });
      const h = Math.max(150, body.height + (ch ? 110 : 70));
      const y = top ? 60 + HUD_GAP + h / 2 + 10 : Math.min(H - h / 2 - 20, H / 2 + 60);
      scene.__gkDialog = { top: y - h / 2 - 6, bottom: y + h / 2 + 6 };
      const c = add(scene.add.container(W / 2, y).setAngle(-1.5));
      c.add(scene.add.rectangle(8, 10, LW, h, 0x000000, 0.3));
      const sf = surface(scene, (o) => o, 0, 0, LW, h, d, D.fill || '#fbf6ea');
      c.add(sf);
      const ink = readable(D.ink || '#2a2440', D.fill || '#fbf6ea');
      body.setColor(ink).setStroke('#000000', 0).setPosition(-(LW / 2 - 40), -h / 2 + 36).setText('');
      c.add(body);
      if (ch) {
        const sig = GK.title(scene, LW / 2 - 40, h / 2 - 34, '- ' + ch.name, 22, readable(D.nameColor || GK.skin.name, D.fill || '#fbf6ea'), { strokeThickness: 0, fontStyle: 'italic' }).setOrigin(1, 0.5);
        c.add(sig);
        if (D.portrait !== 'none') {
          const im = scene.add.image(-(LW / 2 - 50), h / 2 - 40, GK.keys.portrait(speakerId));
          im.setScale(56 / Math.max(im.width, im.height)).setAngle(4);
          c.add(scene.add.rectangle(-(LW / 2 - 50), h / 2 - 40, 64, 64, 0xffffff).setAngle(4));
          c.add(im);
        }
      }
      reveals = reveal(scene, body, line);
    } else {
      /* box layouts: bottom-bar, top-bar, side-card, bubble, terminal */
      let bw = W - 40;
      let bh = 150;
      let bx = W / 2;
      /* Top layouts start under the HUD row, lower still when a tab or ribbon sits on the box edge. */
      const T0 = 62 + HUD_GAP + (ch && (D.name === 'tab' || D.name === 'ribbon') ? 26 : 0);
      let by = top ? T0 + bh / 2 : H - 16 - bh / 2;
      let portraitX = null;
      if (D.layout === 'side-card') {
        bw = Math.min(470, W - 40); bh = 170;
        const heroSide = speakerId && speakerId === C.hero;
        const side = scene.__gkLastSpeaker && scene.__gkLastSpeaker !== speakerId ? (scene.__gkLastSide === 'left' ? 'right' : 'left') : (scene.__gkLastSide || (heroSide ? 'left' : 'right'));
        scene.__gkLastSide = side;
        scene.__gkLastSpeaker = speakerId;
        bx = side === 'left' ? 20 + bw / 2 : W - 20 - bw / 2;
        by = top ? T0 + bh / 2 : H - 20 - bh / 2;
      } else if (D.layout === 'bubble') {
        bw = GK.PORTRAIT ? W - 150 : 640; bh = 130;
        bx = GK.PORTRAIT ? W - 20 - bw / 2 : W / 2 + 70;
        by = top ? T0 + bh / 2 : H - 24 - bh / 2;
        portraitX = GK.PORTRAIT ? 60 : 90;
      } else if (D.layout === 'terminal') {
        bw = W - 80; bh = 140;
        by = top ? T0 + bh / 2 : H - 24 - bh / 2;
      }
      if (minH && minH > bh) {
        /* Grow to fit the wrapped text: top layouts grow downward, bottom layouts upward. */
        const grow = minH - bh;
        bh = minH;
        by = top ? by + grow / 2 : by - grow / 2;
      }
      const box = surface(scene, add, bx, by, bw, bh, d, fill);
      const framedBox = !!(D.frame && scene.textures.exists('ui:dialog-frame'));
      const pad = framedBox ? Math.max(28, Math.round(Math.min(bh / 2 - 1, scene.textures.get('ui:dialog-frame').getSourceImage().height * (D.inset || 0.22)) * 0.8)) : 28;
      scene.__gkDialog = { top: by - bh / 2 - 20, bottom: by + bh / 2 + 6 };
      if (D.layout === 'terminal') {
        const g = add(scene.add.graphics()).setDepth(d + 1);
        g.lineStyle(1, 0x9cff9c, 0.06);
        for (let y = by - bh / 2 + 2; y < by + bh / 2; y += 3) g.lineBetween(bx - bw / 2 + 2, y, bx + bw / 2 - 2, y);
      }
      if (D.layout === 'bubble') {
        const tail = add(scene.add.graphics()).setDepth(d);
        const tx = bx - bw / 2;
        tail.fillStyle(GK.color(fill), 1).fillTriangle(tx + 2, by + 10, tx + 2, by + 40, tx - 34, by + 46);
        tail.lineStyle(GK.skin.edgeWidth || 3, GK.color(D.edge || GK.skin.edge), 1).lineBetween(tx, by + 10, tx - 34, by + 46).lineBetween(tx - 34, by + 46, tx, by + 40);
      }
      if (D.layout === 'side-card' && box.setAngle) box.setAngle(bx < W / 2 ? -1 : 1);
      let textX = bx - bw / 2 + pad;
      const pd = { top };
      if (ch) {
        if (portraitX != null) {
          drawPortrait(scene, add, pd, speakerId, portraitX, by + 6, bh, d);
        } else {
          const used = drawPortrait(scene, add, pd, speakerId, bx - bw / 2 + pad + (D.portrait === 'bust' && !top ? 62 : 48), by, bh, d);
          if (used) textX = bx - bw / 2 + pad + used + 12;
        }
      }
      const textW = bx + bw / 2 - pad - textX;
      let textTop = by - bh / 2 + Math.max(22, pad - 6);
      if (ch && D.name !== 'none') {
        const label = D.name === 'caps' ? ch.name.toUpperCase() : (D.layout === 'terminal' ? '> ' + ch.name.toUpperCase() : ch.name);
        if (D.name === 'tab' || D.name === 'ribbon') {
          const tw = Math.max(120, label.length * 13 + 40);
          const tx = textX + tw / 2 - 12;
          const ty = by - bh / 2 - 14;
          const tagFill = D.nameColor && D.name === 'ribbon' ? D.nameColor : (D.name === 'ribbon' ? P.accent : fill);
          if (D.name === 'ribbon') {
            const rg = add(scene.add.graphics()).setDepth(d + 2);
            rg.fillStyle(GK.color(tagFill), 1).fillRect(tx - tw / 2, ty - 16, tw, 32);
            rg.fillTriangle(tx - tw / 2 - 14, ty - 16, tx - tw / 2, ty - 16, tx - tw / 2, ty + 16).fillTriangle(tx - tw / 2 - 14, ty + 16, tx - tw / 2, ty - 16, tx - tw / 2, ty + 16);
            rg.fillStyle(0x000000, 0.25).fillTriangle(tx - tw / 2 - 14, ty - 16, tx - tw / 2, ty, tx - tw / 2 - 14, ty + 16);
          } else {
            add(GK.panel(scene, tx, ty + 4, tw, 40, { fill: tagFill, alpha: 1, edge: D.edge || GK.skin.edge, radius: 10, plain: true })).setDepth(d - 1);
          }
          add(GK.title(scene, tx, ty, label, 20, readable(D.name === 'ribbon' ? '#ffffff' : nameColour, tagFill), Object.assign({ strokeThickness: 0 }, family)).setOrigin(0.5)).setDepth(d + 3);
        } else {
          add(GK.title(scene, textX, textTop, label, D.name === 'caps' ? 20 : 22, nameColour, Object.assign({ align: 'left', strokeThickness: 0 }, family, D.name === 'caps' ? { letterSpacing: 2 } : {}))).setDepth(d + 1);
          textTop += 34;
        }
      }
      const body = add(GK.text(scene, textX, textTop, '', 22, inkColour, Object.assign({ align: 'left', strokeThickness: 0, wordWrap: { width: textW }, lineSpacing: 4 }, family))).setDepth(d + 1);
      body.setText(line);
      const need = Math.ceil(textTop - (by - bh / 2) + body.height + Math.max(18, pad - 10));
      body.setText('');
      if (need > bh + 1 && !minH) {
        parts.forEach((p) => p.destroy());
        scene.__gkDialog = null;
        return kitSpeech(scene, speakerId, line, depth, need);
      }
      reveals = reveal(scene, body, line);
    }
    return {
      done: () => reveals.done(),
      finish: () => reveals.finish(),
      destroy: () => { reveals.stop(); parts.forEach((p) => p.destroy()); scene.__gkDialog = null; },
    };
  }

  /* ---------- hint toast (C.ui.hint) ---------- */

  function toast(scene, msg, opts) {
    const o = Object.assign({ duration: 1500, depth: 7000 }, opts || {});
    let pos = HINT.position;
    if (pos === 'bottom' && avoidBottom(scene)) pos = 'top';
    const t = GK.text(scene, 0, 0, msg, 22, '#ffffff', { strokeThickness: 0, wordWrap: { width: 420 } });
    const w = Math.max(200, t.width + 48);
    const h = t.height + 26;
    const x = pos === 'corner' ? W - 24 - w / 2 : W / 2;
    let y = pos === 'bottom' ? H - 40 - h / 2 : (pos === 'corner' ? 62 + HUD_GAP + h / 2 : 70 + HUD_GAP + h / 2);
    const dlg = scene.__gkDialog;
    if (dlg && y + h / 2 > dlg.top && y - h / 2 < dlg.bottom) {
      /* An open dialog owns that band: sit just below it, or just above when there is no room below. */
      const below = dlg.bottom + 12 + h / 2;
      y = below + h / 2 < (avoidBottom(scene) ? H - 140 : H - 10) ? below : Math.max(58 + h / 2, dlg.top - 12 - h / 2);
    }
    const fill = (HINT.fill) || (D ? kitFill() : GK.skin.panel);
    const c = scene.add.container(x, y).setScrollFactor(0).setDepth(o.depth);
    if (D && D.frame && scene.textures.exists('ui:dialog-frame') && HINT.surface !== 'skin') c.add(nineSlice(scene, 'ui:dialog-frame', 0, 0, w, h + 8, D.inset));
    else c.add(GK.panel(scene, 0, 0, w, h, { fill, alpha: 1, edge: HINT.edge || (D && D.edge) || GK.skin.edge, radius: (D && D.radius != null) ? D.radius : GK.skin.radius, plain: true }));
    const bg = D && D.frame && scene.textures.exists('ui:dialog-frame') ? centreColour(scene, 'ui:dialog-frame') : fill;
    t.setColor(readable(HINT.ink || (D && D.ink) || GK.skin.ink, bg)).setOrigin(0.5);
    c.add(t);
    if (!QA) { c.setAlpha(0).setScale(0.9); scene.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 160 }); }
    scene.time.delayedCall(QA ? 800 : o.duration, () => c.destroy());
    return c;
  }

  /* ---------- assets of the kit ---------- */

  function queueKitAssets(scene) {
    if (D && D.frame) scene.load.image('ui:dialog-frame', D.frame);
    if (GK.C.story && GK.C.story.page) scene.load.image('ui:story-page', GK.C.story.page);
  }

  Object.assign(GK, {
    kit: { materials: MATERIALS, material: materialId, mat: MAT, dialog: D, hint: HINT, mono: MONO, monoPad: MONO_PAD },
    readable, contrast, mix, page, nineSlice, centreColour, decorate, decoration, header, toast, queueKitAssets,
  });
  if (D) GK.speech = kitSpeech;
})();
