/* Story scene: plays a cutscene in the game's story style (C.story.style).
   Beats: narration | line | image | video. Styles: cinematic, storybook, comic, journal, chat, stage, video. */
(function () {
  'use strict';
  const { W, H, C, QA, palette } = GK;
  const STYLE = GK.story.style;

  /* Typewriter on a text object; speed follows story.textSpeed. */
  function typer(scene, obj, full) {
    let i = 0;
    const ev = full.length && !QA ? scene.time.addEvent({
      delay: Math.max(4, Math.round(18 / GK.story.textSpeed)), repeat: full.length - 1,
      callback: () => { i++; obj.setText(full.slice(0, i)); },
    }) : null;
    if (!ev) { i = full.length; obj.setText(full); }
    return {
      done: () => i >= full.length,
      finish: () => { if (ev) ev.remove(false); i = full.length; obj.setText(full); },
      stop: () => { if (ev) ev.remove(false); },
    };
  }

  /* An image cropped to cover a w*h box centred on (x, y). */
  function framed(scene, key, x, y, w, h) {
    const im = scene.add.image(x, y, key);
    const s = Math.max(w / im.width, h / im.height);
    im.setScale(s);
    im.setCrop((im.width - w / s) / 2, (im.height - h / s) / 2, w / s, h / s);
    return im;
  }

  const nameOf = (id) => ((C.characters || {})[id] || {}).name || '';
  const imageKey = (scene, beat, cs) => {
    if (beat.image && scene.textures.exists(GK.keys.image(beat.image))) return GK.keys.image(beat.image);
    return GK.keys.bg(cs.location || Object.keys(C.locations)[0]);
  };

  /* ---------- views: show(beat), busy(), finish(), destroy() ---------- */

  function cinematicView(scene, cs) {
    let layer = [];
    let current = null;
    const clear = () => { if (current && current.destroy) current.destroy(); current = null; layer.forEach((o) => o.destroy()); layer = []; };
    return {
      show(beat) {
        clear();
        if (beat.image) {
          const im = GK.backdrop(scene, GK.keys.image(beat.image), 1);
          layer.push(im);
          scene.tweens.add({ targets: im, scale: im.scale * 1.06, duration: 6000 });
        }
        if (beat.type === 'line') {
          current = GK.speech(scene, beat.speaker, beat.text);
        } else if (beat.text && GK.PORTRAIT) {
          /* Portrait: a wider wrap on the narrow stage, and a band that grows with the text and keeps the Skip row clear. */
          const t = GK.text(scene, W / 2, 0, beat.text, 26, '#ffffff', { wordWrap: { width: W - 60 } }).setOrigin(0.5).setAlpha(0);
          t.setY(H - 36 - t.height / 2);
          const bar = scene.add.rectangle(W / 2, H - (t.height + 60) / 2, W, t.height + 60, 0x000000, 0.6);
          t.setDepth(bar.depth + 1);
          scene.tweens.add({ targets: t, alpha: 1, duration: QA ? 1 : 400 });
          layer.push(bar, t);
        } else if (beat.text) {
          const bar = scene.add.rectangle(W / 2, H - 70, W, 110, 0x000000, 0.6);
          const t = GK.text(scene, W / 2, H - 70, beat.text, 26, '#ffffff', { wordWrap: { width: W - 120 } }).setOrigin(0.5).setAlpha(0);
          scene.tweens.add({ targets: t, alpha: 1, duration: QA ? 1 : 400 });
          layer.push(bar, t);
        }
      },
      busy: () => !!(current && current.done && !current.done()),
      finish: () => current && current.finish(),
      destroy: clear,
    };
  }

  /* Storybook: a book spread in the game's material (story.material): cloth-bound, watercolour or picture book. */
  function storybookView(scene, cs) {
    const m = GK.kit.mat;
    const mat = GK.kit.material;
    const ink = GK.readable(m.ink || '#3b2f2a', m.paper || '#f6ecd8');
    const head = GK.readable(m.head || GK.skin.name, m.paper || '#f6ecd8');
    scene.add.rectangle(W / 2, H / 2, W, H, GK.color(palette.bg));
    GK.backdrop(scene, GK.keys.bg(cs.location || Object.keys(C.locations)[0]), mat === 'picturebook' ? 0.12 : 0.22);
    const PW = 840;
    const PH = 480;
    let page = null;
    let type = null;
    const build = (beat) => {
      const c = scene.add.container(W / 2, H / 2);
      c.add(scene.add.rectangle(8, 10, PW, PH, 0x000000, 0.35));
      if (m.cover) c.add(scene.add.rectangle(0, 0, PW + 30, PH + 26, GK.color(m.cover)).setStrokeStyle(3, 0x000000, 0.35));
      c.add(GK.page(scene, 0, 0, PW, PH));
      c.add(scene.add.rectangle(0, 0, 4, PH - 10, GK.color(m.edge || GK.skin.edge), 0.25));
      const key = imageKey(scene, beat, cs);
      if (mat === 'picturebook') {
        c.add(framed(scene, key, -PW / 4, 0, PW / 2 - 4, PH - 4));
      } else if (mat === 'watercolor') {
        const im = framed(scene, key, -205, -10, 360, 400);
        im.setAlpha(0.92);
        c.add(im);
      } else {
        c.add(framed(scene, key, -205, -10, 360, 400));
        c.add(scene.add.rectangle(-205, -10, 366, 406).setStrokeStyle(4, GK.color(m.edge || GK.skin.edge)));
      }
      const big = mat === 'picturebook';
      const tx = big ? 40 : 30;
      if (beat.type === 'line') c.add(GK.title(scene, tx, -190, nameOf(beat.speaker), big ? 30 : 26, head, { align: 'left', strokeThickness: 0 }));
      const body = GK.ink(scene, tx, beat.type === 'line' ? -146 : -190, '', big ? 28 : (beat.type === 'line' ? 24 : 25), {
        align: 'left', wordWrap: { width: big ? 360 : 350 }, lineSpacing: big ? 10 : 8, fontStyle: beat.type === 'line' || big ? 'normal' : 'italic',
      });
      body.setColor(ink).setStroke('#000000', 0);
      c.add(body);
      const imageBox = mat === 'picturebook' ? { x: -PW / 2, y: -PH / 2, w: PW / 2, h: PH } : { x: -390, y: -216, w: 370, h: 412 };
      body.setText(beat.text || '');
      const textBox = { x: tx - 6, y: -200, w: (big ? 360 : 350) + 12, h: 64 + body.height + (beat.type === 'line' ? 40 : 0) };
      body.setText('');
      GK.decorate(scene, c, PW, PH, [imageBox, textBox]);
      type = typer(scene, body, beat.text || '');
      return c;
    };
    return {
      show(beat) {
        const old = page;
        if (type) type.stop();
        page = build(beat);
        if (old && !QA) {
          page.setScale(0, 1);
          scene.tweens.add({ targets: old, scaleX: 0, duration: 180, ease: 'Sine.In', onComplete: () => old.destroy() });
          scene.tweens.add({ targets: page, scaleX: 1, duration: 220, delay: 170, ease: 'Sine.Out' });
        } else if (old) {
          old.destroy();
        }
      },
      busy: () => !!(type && !type.done()),
      finish: () => type && type.finish(),
      destroy: () => { if (type) type.stop(); if (page) page.destroy(); },
    };
  }

  /* Comic: three panels a page on the game's material (story.material): digital, newsprint or screentone. */
  function comicView(scene, cs) {
    const m = GK.kit.mat;
    const dots = (key, bg, dot, step, r) => {
      if (scene.textures.exists(key)) return key;
      const t = scene.textures.createCanvas(key, W, H);
      const ctx = t.getContext();
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = dot;
      for (let y = 0; y < H; y += step) for (let x = (y / step) % 2 ? step / 2 : 0; x < W; x += step) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      t.refresh();
      return key;
    };
    if (m.halftone) scene.add.image(W / 2, H / 2, dots('comic:halftone', m.bg, 'rgba(60,40,20,0.12)', 9, 2.2));
    else if (m.tone) scene.add.image(W / 2, H / 2, dots('comic:tone', m.bg, 'rgba(0,0,0,0.18)', 6, 1.4));
    else scene.add.rectangle(W / 2, H / 2, W, H, GK.color(m.bg || palette.bg));
    const border = GK.color(m.border || '#111111');
    const PW = 290;
    const PH = 440;
    const xs = [W / 2 - PW - 15, W / 2, W / 2 + PW + 15];
    let panels = [];
    const newPage = () => { panels.forEach((p) => p.destroy()); panels = []; };
    return {
      show(beat) {
        if (panels.length >= 3 || beat.panel === 'new') newPage();
        const x = xs[panels.length];
        const c = scene.add.container(x, H / 2 + 10);
        const key = beat.type === 'line' && !beat.image ? GK.keys.portrait(beat.speaker) : imageKey(scene, beat, cs);
        c.add(scene.add.rectangle(0, 0, PW, PH, GK.color(m.panel || '#ffffff')));
        const im = framed(scene, key, 0, 0, PW - 14, PH - 14);
        if (m.halftone && im.setTexture) GK.tint(im, 0xf2e6cc);
        if (m.tone && im.setTexture) GK.tint(im, 0xdddddd);
        c.add(im);
        c.add(scene.add.rectangle(0, 0, PW, PH).setStrokeStyle(m.tone ? 8 : 6, border));
        if (beat.type === 'line') {
          const t = GK.ink(scene, 0, 0, beat.text || '', 18, { wordWrap: { width: PW - 50 } }).setOrigin(0.5);
          t.setColor('#111111').setStroke('#000000', 0);
          const bh = t.height + 50;
          const by = PH / 2 - bh / 2 - 16;
          c.add(GK.panel(scene, 0, by, PW - 24, bh, { fill: '#ffffff', alpha: 1, edge: '#111111', edgeWidth: 4, radius: m.tone ? 40 : 26, plain: true }));
          c.add(scene.add.triangle(0, 0, -20, by - bh / 2 + 2, 10, by - bh / 2 + 2, -34, by - bh / 2 - 26, 0xffffff).setOrigin(0, 0).setStrokeStyle(0));
          c.add(GK.title(scene, -PW / 2 + 24, by - bh / 2 + 8, nameOf(beat.speaker).toUpperCase(), 18, '#111111', { strokeThickness: 0 }));
          t.setPosition(0, by + 12);
          c.add(t);
        } else if (beat.text) {
          const capFill = m.caption || palette.accent;
          const t = GK.ink(scene, -PW / 2 + 18, -PH / 2 + 18, beat.text, 17, { align: 'left', wordWrap: { width: PW - 50 } });
          t.setColor(GK.readable('#111111', capFill)).setStroke('#000000', 0);
          c.add(scene.add.rectangle(-PW / 2 + 10, -PH / 2 + 10, PW - 20, t.height + 18, GK.color(capFill)).setOrigin(0, 0).setStrokeStyle(3, 0x111111));
          c.add(t);
        }
        if (!QA) { c.setScale(0.85).setAlpha(0); scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 200, ease: 'Back.Out' }); }
        panels.push(c);
      },
      busy: () => false,
      finish: () => {},
      destroy: newPage,
    };
  }

  /* Journal: entries on the game's material (story.material), each sheet sized to what it holds.
     A sheet with little text gets a taped photo of the place, so a page is never mostly empty.
     The text column ends before the photo, and on lined materials every line of text sits on a rule. */
  const PAGE_RULES = { ruled: { first: 78, pitch: 30, left: 86 }, columns: { first: 96, pitch: 30, left: 128 } };
  function journalView(scene, cs) {
    const m = GK.kit.mat;
    const fam = m.mono ? { fontFamily: GK.kit.mono, padding: GK.kit.monoPad } : {};
    const ink = GK.readable(m.ink || '#2f3b5c', m.paper || '#fbf5e6');
    const spread = m.placement === 'spread';
    /* A generated page texture brings its own paper, so the drawn rules are not there to follow. */
    const rule = !spread && !scene.textures.exists('ui:story-page') ? PAGE_RULES[m.lines] || null : null;
    scene.add.rectangle(W / 2, H / 2, W, H, GK.color(palette.bg));
    GK.backdrop(scene, GK.keys.bg(cs.location || Object.keys(C.locations)[0]), 0.2);
    const place = cs.location || Object.keys(C.locations)[0];
    const labelOf = (b) => (b.type === 'line' ? nameOf(b.speaker) + ': ' : '') + (b.text || '');

    /* Line metrics: on a ruled page the line advance is the rule pitch and the first baseline lands on a rule. */
    const style = (width, spacing) => Object.assign({ align: 'left', wordWrap: { width }, lineSpacing: spacing }, fam);
    const probe = GK.ink(scene, 0, 0, 'Ag', 23, style(1000, 0));
    const one = probe.height;
    probe.setText('Ag\nAg');
    const lineH = probe.height - one;
    const pad = (fam.padding && fam.padding.top) || 0;
    const ascent = (probe.getTextMetrics().ascent) || Math.round(lineH * 0.78);
    probe.destroy();
    const spacing = rule ? rule.pitch - lineH : 6;
    const SINK = 3;
    const baseOff = pad + ascent + SINK;
    const measure = (str, width) => {
      const t = GK.ink(scene, 0, 0, str, 23, style(width, spacing));
      const r = { h: t.height, lines: t.getWrappedText(str).length };
      t.destroy();
      return r;
    };

    /* Sheet geometry: the photo hangs at the right, the text column stops 28px before it. */
    const PW = 250;
    const PH = 190;
    const PHOTO_SPAN = Math.ceil((PW + 20) * Math.cos(0.0524) + (PH + 20) * Math.sin(0.0524)) + 2;
    const geom = (photo) => {
      if (spread) return { w: 880, textLeft: 30, textW: 340 };
      const w = photo ? 800 : 700;
      const textLeft = -w / 2 + (rule ? rule.left : 44);
      const right = photo ? w / 2 - 26 - PHOTO_SPAN - 28 : Math.min(textLeft + 600, w / 2 - 40);
      return { w, textLeft, textW: right - textLeft };
    };
    /* Where each entry's text starts, measured from the top of the page; `bottom` is where the last one ends. */
    const flow = (beats, width, off) => {
      const at = new Map();
      let y = off;
      let row = null;
      beats.forEach((b) => {
        if (!b.text) return;
        const r = measure(labelOf(b), width);
        if (rule) {
          if (row === null) row = Math.max(0, Math.ceil((off + baseOff - rule.first) / rule.pitch));
          at.set(b, rule.first + rule.pitch * row - baseOff);
          y = rule.first + rule.pitch * (row + r.lines - 1) + 12;
          row += r.lines + 1;
        } else {
          at.set(b, y);
          y += r.h + 18;
        }
      });
      return { at, bottom: y };
    };
    const headerOffset = (headerW, label) => {
      const c = scene.add.container(0, 0);
      const off = GK.header(scene, c, headerW, 0, label, m);
      c.destroy();
      return off;
    };

    /* Plan the sheets up front: new sheet on a date, or when the text would not fit. A sheet with an image is
       measured at the photo column (`text`), one without at the full column (`wide`), so neither overflows. */
    const narrow = geom(true).textW;
    const wide = geom(false).textW;
    const MAXC = (spread ? 460 : 470) - headerOffset(spread ? 440 : 800, 'X') - 70 - (rule ? rule.pitch : 0);
    const needOf = (b, width) => {
      if (!b.text) return 0;
      const r = measure(labelOf(b), width);
      return rule ? (r.lines + 1) * rule.pitch : r.h + 18;
    };
    const sheets = [];
    const sheetOf = new Map();
    cs.beats.forEach((b) => {
      if (b.type === 'video') return;
      let cur = sheets[sheets.length - 1];
      const needN = needOf(b, narrow);
      const needW = needOf(b, wide);
      const full = cur && ((cur.image || b.image) ? cur.text + needN : cur.wide + needW) > MAXC;
      if (!cur || b.date || full) {
        cur = { beats: [], text: 0, wide: 0, image: null, date: b.date || cs.date || cs.title || C.title || '' };
        sheets.push(cur);
      }
      cur.beats.push(b);
      cur.text += needN;
      cur.wide += needW;
      if (b.image && !cur.image) cur.image = b.image;
      sheetOf.set(b, sheets.length - 1);
    });
    let idx = -1;
    let sheet = null;
    let geo = null;
    let type = null;

    const build = (plan) => {
      if (sheet) sheet.destroy();
      const photo = plan.image ? GK.keys.image(plan.image) : (plan.text < 220 || spread ? GK.keys.bg(place) : null);
      const { w, textLeft, textW } = geom(!!photo);
      const headerW = spread ? w / 2 : w;
      const off = headerOffset(headerW, plan.date);
      const laid = flow(plan.beats, textW, off);
      const decorRoom = ((GK.C.story && GK.C.story.decorations) || []).length ? 44 : 0;
      const h = spread ? 460 : Math.max(photo ? off + 262 : 240, Math.min(470, laid.bottom + 70 + decorRoom));
      const angle = m.placement === 'tilted' ? (idx % 2 ? 1.1 : -1.3) : 0;
      sheet = scene.add.container(W / 2, H / 2 + 8).setAngle(angle);
      sheet.add(scene.add.rectangle(10, 12, w, h, 0x000000, 0.3));
      if (m.cover) sheet.add(scene.add.rectangle(0, 0, w + 34, h + 30, GK.color(m.cover)).setStrokeStyle(2, 0x000000, 0.4));
      if (spread) {
        sheet.add(GK.page(scene, -w / 4, 0, w / 2, h, { tag: ':L' }));
        sheet.add(GK.page(scene, w / 4, 0, w / 2, h, { tag: ':R' }));
        sheet.add(scene.add.rectangle(0, 0, 6, h, 0x000000, 0.18));
      } else {
        sheet.add(GK.page(scene, 0, 0, w, h));
      }
      const hc = scene.add.container(spread ? w / 4 : 0, 0);
      sheet.add(hc);
      const top = GK.header(scene, hc, headerW, h, plan.date, m);
      const occupied = [
        spread ? { x: 0, y: -h / 2, w: w / 2, h: top + h / 2 } : { x: -w / 2, y: -h / 2, w, h: top + h / 2 },
        { x: textLeft, y: top, w: textW, h: laid.bottom - off },
      ];
      if (photo) {
        const px = spread ? -w / 4 : w / 2 - 26 - PHOTO_SPAN / 2;
        const py = spread ? 0 : top + 122;
        const pw = spread ? 340 : PW;
        const ph = spread ? 260 : PH;
        occupied.push({ x: px - pw / 2 - 14, y: py - ph / 2 - 22, w: pw + 28, h: ph + 36 });
        const c = scene.add.container(px, py).setAngle(spread ? -2 : 3);
        c.add(scene.add.rectangle(4, 6, pw + 20, ph + 20, 0x000000, 0.25));
        c.add(scene.add.rectangle(0, 0, pw + 20, ph + 20, 0xffffff));
        c.add(framed(scene, photo, 0, 0, pw, ph));
        c.add(scene.add.rectangle(-pw / 3, -ph / 2 - 8, 70, 20, 0xf3e3a0, 0.8).setAngle(-8));
        c.add(scene.add.rectangle(pw / 3, -ph / 2 - 8, 70, 20, 0xf3e3a0, 0.8).setAngle(8));
        sheet.add(c);
      }
      GK.decorate(scene, sheet, w, h, occupied);
      geo = { textLeft, textW, at: laid.at, pageTop: -h / 2 };
      if (!QA) { sheet.setAlpha(0); scene.tweens.add({ targets: sheet, alpha: 1, duration: 220 }); }
    };

    return {
      show(beat) {
        if (type) type.finish();
        let k = sheetOf.has(beat) ? sheetOf.get(beat) : -1;
        if (k === -1) { sheets.push({ beats: [beat], text: 0, image: beat.image || null, date: '' }); k = sheets.length - 1; sheetOf.set(beat, k); }
        if (k !== idx) { idx = k; build(sheets[k]); }
        if (!beat.text) { type = null; return; }
        const full = labelOf(beat);
        const t = GK.ink(scene, geo.textLeft, geo.pageTop + geo.at.get(beat), '', 23, style(geo.textW, spacing));
        t.setColor(ink).setStroke('#000000', 0);
        sheet.add(t);
        type = typer(scene, t, full);
      },
      busy: () => !!(type && !type.done()),
      finish: () => type && type.finish(),
      pageOf: (b) => (sheetOf.has(b) ? sheetOf.get(b) : 'beat:' + cs.beats.indexOf(b)),
      destroy: () => { if (type) type.stop(); if (sheet) sheet.destroy(); },
    };
  }

  /* Chat: a message thread in the game's material (story.material): dark or light phone, old SMS, terminal. */
  function chatView(scene, cs) {
    const m = GK.kit.mat;
    const fam = m.mono ? { fontFamily: GK.kit.mono, padding: GK.kit.monoPad } : {};
    scene.add.rectangle(W / 2, H / 2, W, H, GK.color(m.bg || palette.bg));
    if (m.terminal) {
      const g = scene.add.graphics();
      g.lineStyle(1, 0x9cff9c, 0.05);
      for (let y = 0; y < H; y += 3) g.lineBetween(0, y, W, y);
    }
    scene.add.rectangle(W / 2, 32, W, 64, GK.color(m.bar || palette.panel)).setDepth(50);
    const barTitle = m.terminal ? '> ' + (cs.title || C.title || '').toLowerCase() + '.log' : (cs.title || C.title);
    GK.text(scene, W / 2, 32, barTitle, 22, GK.readable(m.terminal ? m.theirsInk : (m.mineInk === '#ffffff' ? '#111111' : palette.text), m.bar || palette.panel), Object.assign({ strokeThickness: 0 }, fam)).setOrigin(0.5).setDepth(51);
    const hero = C.hero;
    let items = [];
    let pending = null;
    const BOTTOM = H - 30;
    const push = (c, h) => {
      items.forEach((it) => {
        it.y -= h + 14;
        if (QA) it.c.y = it.y; else scene.tweens.add({ targets: it.c, y: it.y, duration: 160 });
      });
      items.push({ c, y: BOTTOM - h / 2, h });
      c.y = BOTTOM - h / 2;
      items = items.filter((it) => { if (it.y - it.h / 2 < 74) { it.c.destroy(); return false; } return true; });
      if (!QA) { c.setAlpha(0); scene.tweens.add({ targets: c, alpha: 1, duration: 160 }); }
    };
    const terminalLine = (beat) => {
      const c = scene.add.container(0, 0);
      const mine = beat.type === 'line' && beat.speaker === hero;
      const who = beat.type === 'line' ? nameOf(beat.speaker).toLowerCase() : 'sys';
      const t = GK.text(scene, 60, 0, who + '> ' + (beat.text || ''), 20, mine ? m.mineInk : (beat.type === 'line' ? m.theirsInk : m.meta), Object.assign({ strokeThickness: 0, align: 'left', wordWrap: { width: W - 140 } }, fam)).setOrigin(0, 0.5);
      c.add(t);
      return { c, h: t.height };
    };
    const bubble = (beat) => {
      if (m.terminal) return terminalLine(beat);
      const mine = beat.type === 'line' && (beat.side ? beat.side === 'right' : beat.speaker === hero);
      const c = scene.add.container(0, 0);
      if (beat.type === 'narration' && !beat.image) {
        const t = GK.text(scene, W / 2, 0, beat.text || '', 17, m.meta || palette.muted, Object.assign({ strokeThickness: 0, wordWrap: { width: Math.min(560, W - 80) } }, fam)).setOrigin(0.5);
        c.add(GK.panel(scene, W / 2, 0, t.width + 36, t.height + 16, { fill: m.theirs || palette.panel, alpha: 0.6, radius: m.radius != null ? Math.min(14, m.radius) : 14, edgeWidth: 0, plain: true }));
        c.add(t);
        return { c, h: t.height + 16 };
      }
      const maxW = Math.min(520, W - 170);
      const fill = mine ? (m.mine || palette.accent) : (m.theirs || palette.panel);
      const t = GK.text(scene, 0, 0, beat.text || '', 20, GK.readable(mine ? m.mineInk : m.theirsInk, fill), Object.assign({ strokeThickness: 0, align: 'left', wordWrap: { width: maxW - 36 } }, fam));
      const bw = Math.max(beat.image ? 300 : 0, t.width + 36);
      /* Portrait story stills are 9:16; a taller box keeps faces in frame (landscape 16:9 fits 160 exactly). */
      const picH = GK.PORTRAIT ? Math.round(Math.min(320, (bw - 16) * 1.4)) : 160;
      const imgH = beat.image ? picH + 10 : 0;
      const bh = imgH + (beat.text ? t.height + 24 : 12);
      const bx = mine ? W - 40 - bw / 2 : 130 + bw / 2;
      c.add(GK.panel(scene, bx, 0, bw, bh, { fill, alpha: 1, radius: m.radius != null ? m.radius : 20, edgeWidth: m.mono ? 2 : 0, edge: m.meta || '#000000', plain: true }));
      if (beat.image) c.add(framed(scene, GK.keys.image(beat.image), bx, -bh / 2 + 6 + picH / 2, bw - 16, picH));
      t.setPosition(bx - bw / 2 + 18, -bh / 2 + imgH + 12);
      c.add(t);
      if (!mine && beat.type === 'line') {
        const av = scene.add.image(80, bh / 2 - 26, GK.keys.portrait(beat.speaker));
        av.setScale(52 / Math.max(av.width, av.height));
        if (m.mono) GK.tint(av, 0xb8c79a);
        c.add(av);
        c.add(GK.text(scene, bx - bw / 2 + 6, -bh / 2 - 22, nameOf(beat.speaker), 15, m.meta || palette.muted, Object.assign({ strokeThickness: 0, align: 'left' }, fam)));
      }
      return { c, h: bh + (!mine && beat.type === 'line' ? 22 : 0) };
    };
    return {
      show(beat) {
        if (pending) { pending.remove(false); pending = null; }
        const b = bubble(beat);
        if (QA || beat.type !== 'line') { push(b.c, b.h); return; }
        b.c.setVisible(false);
        const dots = GK.text(scene, beat.speaker === hero ? W - 80 : 160, BOTTOM - 14, m.terminal ? '_' : '• • •', 22, m.meta || palette.muted, Object.assign({ strokeThickness: 0 }, fam)).setOrigin(0.5);
        pending = scene.time.delayedCall(450, () => { dots.destroy(); b.c.setVisible(true); push(b.c, b.h); pending = null; });
      },
      busy: () => !!pending,
      finish: () => { if (pending) { pending.callback(); pending.remove(false); pending = null; } },
      destroy: () => { if (pending) pending.remove(false); items.forEach((it) => it.c.destroy()); items = []; },
    };
  }

  /* Stage: two characters face off on the game's material (story.material): plain gradient, theatre curtain or film strip. */
  function stageView(scene, cs) {
    const m = GK.kit.mat;
    const film = !!m.film;
    const tintBg = (im) => { if (film) GK.tint(im, m.tint); return im; };
    let bg = tintBg(GK.backdrop(scene, GK.keys.bg(cs.location || Object.keys(C.locations)[0]), 1));
    if (m.curtain) {
      const g = scene.add.graphics().setDepth(15);
      const cur = GK.color(m.curtain);
      [[0, 1], [W, -1]].forEach(([x0, dir]) => {
        g.fillStyle(cur, 1).fillRect(dir > 0 ? 0 : W - 110, 0, 110, H);
        g.fillStyle(0x000000, 0.25);
        for (let i = 0; i < 5; i++) g.fillRect(x0 + dir * (14 + i * 22), 0, 6, H);
      });
      g.fillStyle(GK.color(m.valance), 1).fillRect(0, 0, W, 54);
      for (let x = 0; x < W; x += 60) g.fillCircle(x + 30, 54, 30);
      g.fillStyle(GK.color(m.trim), 1).fillRect(0, 50, W, 5);
    } else if (film) {
      const g = scene.add.graphics().setDepth(30);
      g.fillStyle(GK.color(m.film), 1).fillRect(0, 0, W, 34);
      g.fillStyle(0xf2f2f2, 0.85);
      for (let x = 12; x < W; x += 40) g.fillRoundedRect(x, 9, 20, 16, 3);
    }
    const slots = { left: null, right: null };
    const ids = { left: null, right: null };
    /* Between the drapes when the stage has curtains. */
    const inset = m.curtain ? 110 : 0;
    const box = GK.panel(scene, W / 2, H - 80, W - 40 - inset * 2, 140).setDepth(20);
    const plateX = { left: 150 + inset, right: W - 150 - inset };
    const plate = GK.panel(scene, plateX.left, H - 162, 220, 40, { fill: palette.accent, alpha: 1, radius: 12, edgeWidth: 0, plain: true }).setDepth(21).setVisible(false);
    const plateText = GK.title(scene, plateX.left, H - 162, '', 20, '#111111', { strokeThickness: 0 }).setOrigin(0.5).setDepth(22);
    const body = GK.ink(scene, 50 + inset, H - 132, '', 23, { align: 'left', wordWrap: { width: W - 100 - inset * 2 }, lineSpacing: 4 }).setDepth(21);
    let type = null;
    const place = (side, id) => {
      if (ids[side] === id) return;
      if (slots[side]) slots[side].destroy();
      const x = side === 'left' ? 200 : W - 200;
      const hasSprite = !!((C.characters || {})[id] || {}).sprite;
      const p = scene.add.image(x, H - 150, hasSprite ? GK.keys.sprite(id) : GK.keys.portrait(id)).setOrigin(0.5, 1).setDepth(10);
      p.setScale((hasSprite ? 360 : 300) / Math.max(p.width, p.height));
      p.baseScale = p.scale;
      if (side === 'right') p.setFlipX(!C.spriteFacesLeft);
      else if (C.spriteFacesLeft) p.setFlipX(true);
      if (!QA) { p.x += side === 'left' ? -60 : 60; p.setAlpha(0); scene.tweens.add({ targets: p, x, alpha: 1, duration: 220 }); }
      slots[side] = p;
      ids[side] = id;
    };
    return {
      show(beat) {
        if (type) type.stop();
        if (beat.image) { bg.destroy(); bg = tintBg(GK.backdrop(scene, GK.keys.image(beat.image), 1)).setDepth(0); }
        let active = null;
        if (beat.type === 'line') {
          const side = beat.side || (beat.speaker === C.hero ? 'left' : ids.left === beat.speaker ? 'left' : 'right');
          place(side, beat.speaker);
          active = side;
          plate.setVisible(true).x = plateX[side];
          plateText.setText(nameOf(beat.speaker)).x = plate.x;
        } else {
          plate.setVisible(false);
          plateText.setText('');
        }
        ['left', 'right'].forEach((s) => {
          const p = slots[s];
          if (!p) return;
          if (active === s) { GK.tint(p, null).setScale(p.baseScale * 1.05); } else { GK.tint(p, 0x777777).setScale(p.baseScale); }
        });
        body.setFontStyle(beat.type === 'line' ? 'normal' : 'italic');
        type = typer(scene, body, beat.text || '');
      },
      busy: () => !!(type && !type.done()),
      finish: () => type && type.finish(),
      destroy: () => { if (type) type.stop(); },
    };
  }

  const VIEWS = { cinematic: cinematicView, video: cinematicView, storybook: storybookView, comic: comicView, journal: journalView, chat: chatView, stage: stageView };

  class Story extends Phaser.Scene {
    constructor() { super('Story'); }
    init(data) { this.csId = data.id; this.index = -1; this.finished = false; this.video = null; this.view = null; }
    create() {
      this.cs = (C.cutscenes || {})[this.csId] || { beats: [] };
      GK.setState({ scene: 'Story', status: 'story', extra: { cutscene: this.csId, style: STYLE } });
      if (STYLE === 'cinematic' || STYLE === 'video') {
        if (this.cs.location) GK.backdrop(this, GK.keys.bg(this.cs.location), 1);
        else this.add.rectangle(W / 2, H / 2, W, H, GK.color(palette.bg));
      }
      if (this.cs.location) GK.music(this, GK.keys.music(this.cs.location));
      this.view = (VIEWS[STYLE] || cinematicView)(this, this.cs);
      const skip = GK.text(this, W - 24, H - 12, 'Skip ▸▸', 18, '#ffffff').setOrigin(1, 1).setDepth(300).setInteractive({ useHandCursor: true });
      skip.on('pointerdown', (p, x, y, ev) => { if (ev) ev.stopPropagation(); this.skipAll(); });
      this.input.on('pointerdown', () => this.advance());
      if (this.input.keyboard) {
        this.input.keyboard.on('keydown-SPACE', () => this.advance());
        this.input.keyboard.on('keydown-ENTER', () => this.advance());
        this.input.keyboard.on('keydown-ESC', () => this.skipAll());
      }
      GK.muteButton(this);
      this.events.once('shutdown', () => { if (this.view) this.view.destroy(); this.removeVideo(); });
      this.cameras.main.fadeIn(QA ? 0 : 250);
      this.advance();
    }
    advance() {
      if (this.video) return;
      if (this.view.busy()) { this.view.finish(); return; }
      this.index++;
      const beat = this.cs.beats[this.index];
      if (!beat) { this.finished = true; return GK.next(this); }
      if (beat.audio && this.cache.audio.exists(GK.keys.sound(beat.audio))) {
        if (this.voice) this.voice.stop();
        this.voice = this.sound.add(GK.keys.sound(beat.audio));
        this.voice.play();
      }
      if (beat.type === 'video') return this.playVideo(beat);
      this.view.show(beat);
    }
    /* Video beats play over the canvas with optional timed subtitles; the poster stands in under QA and on errors. */
    playVideo(beat) {
      const fallback = () => {
        this.removeVideo();
        const caption = beat.text || (Array.isArray(beat.subtitles) && beat.subtitles[0] ? beat.subtitles[0].text : '');
        if (beat.poster) this.view.show({ type: 'image', image: beat.poster, text: caption });
        else this.advance();
      };
      if (QA) { fallback(); return; }
      const rect = this.game.canvas.getBoundingClientRect();
      const box = document.createElement('div');
      Object.assign(box.style, { position: 'absolute', left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px', zIndex: 10, background: '#000' });
      const v = document.createElement('video');
      v.className = 'gk-video';
      Object.assign(v.style, { position: 'absolute', inset: 0, width: '100%', height: '100%' });
      v.src = beat.src;
      v.playsInline = true;
      if (beat.poster) v.poster = beat.poster;
      v.muted = GK.store.get('muted', false);
      const sub = document.createElement('div');
      Object.assign(sub.style, {
        position: 'absolute', left: '8%', right: '8%', bottom: '7%', textAlign: 'center', color: '#fff',
        font: Math.round(Math.min(rect.width, rect.height) / 22) + 'px ' + GK.fonts[GK.story.font].body, textShadow: '0 2px 4px #000, 0 0 2px #000',
      });
      const cues = Array.isArray(beat.subtitles) ? beat.subtitles : (beat.text ? [{ at: 0, to: 1e9, text: beat.text }] : []);
      v.ontimeupdate = () => { const cue = cues.find((c) => v.currentTime >= c.at && v.currentTime < c.to); sub.textContent = cue ? cue.text : ''; };
      /* Behind the turn-your-phone prompt (GK.frozen) the video only waits: it neither ends the beat nor retries. */
      const done = () => { if (GK.frozen) return; this.removeVideo(); this.advance(); };
      v.onended = done;
      v.onerror = fallback;
      box.onclick = done;
      box.appendChild(v);
      box.appendChild(sub);
      document.body.appendChild(box);
      this.video = box;
      GK.stopMusic();
      v.play().catch(() => { if (GK.frozen) return; v.muted = true; v.play().catch(() => { if (!GK.frozen) fallback(); }); });
    }
    removeVideo() { if (this.video) { this.video.remove(); this.video = null; } }
    skipAll() {
      if (this.finished) return;
      this.finished = true;
      this.removeVideo();
      if (this.view) this.view.destroy();
      GK.next(this);
    }
  }

  GK.scenes.push(Story);
})();
