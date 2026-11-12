/* Story shell core: content access, flow, progress, assets, audio, HUD, QA hooks. */
window.GK = (function () {
  'use strict';

  const C = window.GAME_CONTENT;
  /* Stage size from game.json orientation (fixed for the life of a game). The short side is always 540, so every
     pixel constant keeps its proportion of the screen in both shapes. */
  const ORIENTATION = C.orientation === 'portrait' ? 'portrait' : 'landscape';
  const PORTRAIT = ORIENTATION === 'portrait';
  const W = PORTRAIT ? 540 : 960;
  const H = PORTRAIT ? 960 : 540;
  /* Sharper text on high-density screens (FIT scales the canvas up with CSS); capped at 2 to keep textures small. */
  const TEXT_RES = Math.min(window.devicePixelRatio || 1, 2);
  /* QA switches: window.__GK_QA__ = { qa, seed, touch, renderer, save, now } set by an init script (an ad wrapper has
     no query string) wins field by field over the query string (?qa=1&seed=…&touch=1&renderer=canvas). */
  const QA_INIT = window.__GK_QA__ && typeof window.__GK_QA__ === 'object' ? window.__GK_QA__ : {};
  const query = new URLSearchParams(location.search);
  const params = { get(k) { const v = QA_INIT[k]; return v == null ? query.get(k) : v === true ? '1' : v === false ? '0' : String(v); } };
  const QA = params.get('qa') === '1';

  /* Playable mode (one level wrapped as an ad, references/playable-mode.md): GAME_CONTENT.playable, overridden field by
     field by window.__GK_PLAYABLE__ set before the engine loads; window.__GK_PLAYABLE__ = false forces it off and true
     turns it on with the defaults. */
  const PLAYABLE = (function () {
    const rt = window.__GK_PLAYABLE__ === true ? {} : window.__GK_PLAYABLE__;
    const obj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
    if (rt === false || (!obj(C.playable) && !obj(rt))) return null;
    const raw = Object.assign({}, obj(C.playable) ? C.playable : {}, obj(rt) ? rt : {});
    const first = ((C.chapters || [])[0] || { levels: [] }).levels[0];
    const known = typeof raw.level === 'string' && Object.prototype.hasOwnProperty.call(C.levels || {}, raw.level);
    return Object.freeze({
      level: known ? raw.level : first, badLevel: known || raw.level == null ? null : raw.level,
      endAfter: ['win', 'lose', 'first'].includes(raw.endAfter) ? raw.endAfter : 'win',
      brand: raw.brand === 'none' ? 'none' : 'text',
      fonts: raw.fonts === 'game' ? 'game' : 'system',
      audioContext: obj(rt) && rt.audioContext ? rt.audioContext : null, /* runtime only, never from JSON */
    });
  })();

  /* Story presentation: one style per game (story.style), with its fonts and UI skin. */
  const FONTS = {
    sans: { body: '"BC Outfit", "Trebuchet MS", "Segoe UI", Verdana, sans-serif', title: '"BC Bagel", "Trebuchet MS", Impact, sans-serif', scale: 1, titleStyle: 'normal', files: ['500 20px "BC Outfit"', '700 20px "BC Outfit"', '20px "BC Bagel"'] }, /* Bad Cookie brand fonts */
    serif: { body: '"GK Lora", Georgia, serif', title: '"GK Lora", Georgia, serif', scale: 0.95, titleStyle: 'bold', files: ['500 20px "GK Lora"', '700 20px "GK Lora"'] },
    hand: { body: '"GK Hand", "Comic Sans MS", cursive', title: '"GK Hand", "Comic Sans MS", cursive', scale: 1.12, titleStyle: 'normal', files: ['20px "GK Hand"'] },
    comic: { body: '"GK Comic", "Comic Sans MS", sans-serif', title: '"GK Bangers", Impact, sans-serif', scale: 1, titleStyle: 'normal', files: ['20px "GK Comic"', '20px "GK Bangers"'] },
    rounded: { body: '"GK Rounded", "Trebuchet MS", sans-serif', title: '"GK Rounded", "Trebuchet MS", sans-serif', scale: 1, titleStyle: 'normal', files: ['20px "GK Rounded"'] },
    pixel: { body: '"GK Pixel", monospace', title: '"GK Pixel", monospace', scale: 0.62, titleStyle: 'normal', files: ['20px "GK Pixel"'] },
    fell: { body: '"GK Fell", Georgia, serif', title: '"GK Fell", Georgia, serif', scale: 1.08, titleStyle: 'normal', files: ['20px "GK Fell"', 'italic 20px "GK Fell"'] },
    typewriter: { body: '"GK Type", "Courier New", monospace', title: '"GK Type", "Courier New", monospace', scale: 0.95, titleStyle: 'normal', files: ['20px "GK Type"'] },
  };
  /* Playable mode draws with the system fallbacks, so an ad ships no font files (no "GK …" face is ever requested). */
  if (PLAYABLE && PLAYABLE.fonts === 'system') Object.keys(FONTS).forEach((k) => {
    const f = FONTS[k];
    const sys = (s) => s.replace(/"GK [^"]+",\s*/g, '');
    f.body = sys(f.body); f.title = sys(f.title); f.files = [];
    if (k === 'pixel') f.scale = 1; /* 0.62 was tuned for Press Start 2P's wide glyphs */
  });
  const STYLE_DEFAULTS = {
    cinematic: { font: 'sans', transition: 'fade' },
    storybook: { font: 'serif', transition: 'page' },
    comic: { font: 'comic', transition: 'cut' },
    journal: { font: 'hand', transition: 'page' },
    chat: { font: 'rounded', transition: 'slide' },
    stage: { font: 'rounded', transition: 'fade' },
    video: { font: 'sans', transition: 'fade' },
  };
  const story = Object.assign({ style: 'cinematic' }, C.story || {});
  if (!STYLE_DEFAULTS[story.style]) story.style = 'cinematic';
  Object.assign(story, Object.assign({}, STYLE_DEFAULTS[story.style], C.story || {}));
  if (!FONTS[story.font]) story.font = STYLE_DEFAULTS[story.style].font;
  story.textSpeed = story.textSpeed > 0 ? story.textSpeed : 1;
  const font = FONTS[story.font];
  const palette = Object.assign(
    { bg: '#141428', panel: '#1f1f3a', accent: '#ffcc33', text: '#ffffff', muted: '#a8a8c8', danger: '#ff5566' },
    C.palette || {}
  );

  const bus = new Phaser.Events.EventEmitter();
  const missing = [];
  const errors = [];
  if (PLAYABLE && PLAYABLE.badLevel != null) errors.push('playable: unknown level ' + PLAYABLE.badLevel + ', playing ' + PLAYABLE.level);

  /* Key-value storage under C.id + ':' + key: localStorage when the browser allows it, this page's memory otherwise
     (private mode, blocked or full storage), so the game always plays and saving silently stops. QA pages keep
     everything in memory unless ?save=1 asks for the real storage (the playtest's save checks). Playable mode never
     touches localStorage: everything (sound, settings) lives in page memory. */
  const PERSIST = !PLAYABLE && (!QA || params.get('save') === '1');
  const memory = {};
  const storageOk = PERSIST && (function () {
    try {
      const k = C.id + ':probe';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();
  const store = {
    get(key, fallback) {
      try {
        const raw = key in memory ? memory[key] : storageOk ? window.localStorage.getItem(C.id + ':' + key) : null;
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      const raw = JSON.stringify(value);
      memory[key] = raw;
      if (!storageOk) return false;
      try { window.localStorage.setItem(C.id + ':' + key, raw); return true; } catch (e) { return false; }
    },
    remove(key) {
      delete memory[key];
      if (!storageOk) return;
      try { window.localStorage.removeItem(C.id + ':' + key); } catch (e) { /* storage blocked */ }
    },
  };

  /* Settings stay outside the save slot, so "Restart game" keeps them: sound (muted), the last version seen (NEW! badge). */
  const legacy = store.get('progress', null);
  const progress = { done: [], lastSeenVersion: legacy && typeof legacy.lastSeenVersion === 'number' ? legacy.lastSeenVersion : 0 };
  const saveProgress = () => store.set('progress', { lastSeenVersion: progress.lastSeenVersion });

  /* Interface words; content may override any of them in game.json strings (its own voice or language). */
  const STR = Object.assign({
    win: 'Level complete!', lose: 'Try again!', play: 'Play', continue: 'Continue', newGame: 'New game', chapters: 'Chapters',
    collection: 'Collection', paused: 'Paused', resume: 'Resume', restartLevel: 'Restart level', restartGame: 'Restart game',
    quit: 'Quit to title', startOver: 'Start over', cancel: 'Cancel', back: 'Back', level: 'Level', best: 'Best',
    confirmNew: 'Start a new game? Your saved progress will be lost.',
    confirmRestart: 'Restart the whole game? Your saved progress will be lost.',
    allDone: 'Every chapter played', nothingFound: 'Nothing found yet', locked: 'Locked',
    rotate: PORTRAIT ? 'Turn your phone upright to play' : 'Turn your phone sideways to play',
  }, C.strings || {});

  const state = {
    scene: 'boot', chapter: null, level: null, status: 'idle',
    score: 0, collected: 0, need: 0, moves: null, lives: null, player: null, extra: {}, results: {}, paused: false,
  };
  const sceneLog = []; /* every scene the game showed, in order (QA: playable mode never shows Title, Map or Story) */

  const color = (hex) => Phaser.Display.Color.HexStringToColor(hex || '#888888').color;

  /* UI skin per story style: panels, speech boxes and buttons share it, so the whole game feels consistent. */
  const SKINS = {
    cinematic: { panel: palette.panel, panelAlpha: 0.94, edge: palette.accent, edgeWidth: 4, ink: palette.text, inkStroke: 3, radius: 10, name: palette.accent },
    video: { panel: palette.panel, panelAlpha: 0.94, edge: palette.accent, edgeWidth: 4, ink: palette.text, inkStroke: 3, radius: 10, name: palette.accent },
    storybook: { panel: '#f6ecd8', panelAlpha: 1, edge: '#8a6a4a', edgeWidth: 3, ink: '#3b2f2a', inkStroke: 0, radius: 14, name: '#8a3b2a', paper: true },
    comic: { panel: '#ffffff', panelAlpha: 1, edge: '#111111', edgeWidth: 5, ink: '#111111', inkStroke: 0, radius: 22, name: '#111111', nameFill: palette.accent },
    journal: { panel: '#fbf5e6', panelAlpha: 1, edge: '#c9b79a', edgeWidth: 2, ink: '#2f3b5c', inkStroke: 0, radius: 4, name: '#7a2e2e', paper: true },
    chat: { panel: palette.panel, panelAlpha: 1, edge: palette.panel, edgeWidth: 0, ink: palette.text, inkStroke: 0, radius: 24, name: palette.muted },
    stage: { panel: palette.panel, panelAlpha: 0.92, edge: palette.accent, edgeWidth: 3, ink: palette.text, inkStroke: 2, radius: 16, name: palette.accent },
  };
  const skin = SKINS[story.style];

  /* Resolves when the game's fonts are ready (or after a short cap, so a slow font never blocks the game). */
  function fontsReady() {
    if (!font.files.length || !document.fonts || !document.fonts.load) return Promise.resolve();
    const all = Promise.all(font.files.map((f) => document.fonts.load(f).catch(() => null)));
    return Promise.race([all, new Promise((r) => setTimeout(r, 3000))]);
  }

  function now() {
    const forced = params.get('now');
    return forced ? new Date(forced) : new Date();
  }

  function isReleased(ch) {
    return !ch.releaseAt || new Date(ch.releaseAt) <= now();
  }

  function chapters() { return C.chapters.filter(isReleased); }

  function nextDrop() {
    const upcoming = C.chapters.filter((ch) => !isReleased(ch));
    if (upcoming.length) {
      const ch = upcoming[0];
      return { at: new Date(ch.releaseAt), teaser: ch.teaser || ch.title };
    }
    if (C.nextDrop && C.nextDrop.at && new Date(C.nextDrop.at) > now()) {
      return { at: new Date(C.nextDrop.at), teaser: C.nextDrop.teaser || '' };
    }
    return null;
  }

  function countdown(at) {
    let s = Math.max(0, Math.floor((at - now()) / 1000));
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60);
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + m + 'm';
    return Math.max(1, m) + 'm';
  }

  function chapterUnlocked(index) {
    if (index === 0) return true;
    const prev = chapters()[index - 1];
    return prev.levels.every((id) => progress.done.includes(id));
  }

  function chapterOf(levelId) {
    return C.chapters.find((ch) => ch.levels.includes(levelId));
  }

  function hasNewContent() {
    return progress.lastSeenVersion > 0 && (C.version || 1) > progress.lastSeenVersion;
  }

  function markSeen() {
    progress.lastSeenVersion = C.version || 1;
    saveProgress();
  }

  /* ---------- flow ---------- */

  let queue = [];

  function setQueue(steps) { queue = steps.slice(); }

  function chapterSteps(ch) {
    const steps = [];
    if (ch.before) steps.push({ type: 'story', id: ch.before });
    ch.levels.forEach((id) => steps.push({ type: 'level', id }));
    if (ch.after) steps.push({ type: 'story', id: ch.after });
    return steps;
  }

  /* Story flows on: the chosen chapter, every later released chapter, then the ending. */
  function campaignSteps(chapterId) {
    const list = chapters();
    const from = Math.max(0, list.findIndex((c) => c.id === chapterId));
    return list.slice(from).flatMap(chapterSteps).concat([{ type: 'ending' }]);
  }

  function startChapter(scene, chapterId, fromLevel) {
    let steps = campaignSteps(chapterId);
    if (fromLevel) {
      const i = steps.findIndex((s) => s.type === 'level' && s.id === fromLevel);
      if (i > 0) steps = steps.slice(i);
    }
    state.chapter = chapterId;
    setQueue(steps);
    next(scene);
  }

  function startCampaign(scene) {
    const list = chapters();
    const firstOpen = list.find((ch) => ch.levels.some((id) => !progress.done.includes(id)));
    if (!progress.done.length && C.intro) {
      setQueue([{ type: 'story', id: C.intro }].concat(campaignSteps(list[0].id)));
      state.chapter = list[0].id;
      next(scene);
    } else if (firstOpen) {
      const resume = firstOpen.levels.find((id) => !progress.done.includes(id));
      startChapter(scene, firstOpen.id, resume === firstOpen.levels[0] ? null : resume);
    } else {
      go(scene, 'Map');
    }
  }

  function next(scene) {
    const step = queue.shift();
    if (!step) return go(scene, 'Map');
    if (step.type === 'story') return go(scene, 'Story', { id: step.id });
    if (step.type === 'level') {
      const ch = chapterOf(step.id);
      if (ch) state.chapter = ch.id;
      return go(scene, 'Play', { id: step.id });
    }
    if (step.type === 'ending') return go(scene, 'End');
    return go(scene, 'Map');
  }

  function go(scene, key, data) {
    bus.emit('scene-change', key);
    const cam = scene.cameras && scene.cameras.main;
    const fade = { fade: 220, page: 140, slide: 120, cut: 0 }[story.transition] || 0;
    if (cam && !QA && fade) {
      cam.fadeOut(fade, 0, 0, 0);
      cam.once('camerafadeoutcomplete', () => scene.scene.start(key, data || {}));
    } else {
      scene.scene.start(key, data || {});
    }
  }

  /* ---------- the save slot ----------
     One slot per game in localStorage (C.id + ':save'), small JSON with a schema version:
       { v, game, version, at, done: [level ids], levels: { <id>: { best, got, of, items } }, run }
     run is the level in progress: { level, score, collected, need, lives, moves, hud, got, of, items, snap }, where
     snap is the play scene's own snapshot (GK.genre.snapshot / restore). It is written at level start, on every score,
     pickup, life or move, at checkpoints (GK.autosave), every few seconds, on pause and when the page is hidden or
     closed. A slot that cannot be read, belongs to another schema or game is ignored; entries for levels the content no
     longer has are dropped, so a save survives a content update. game.json "save": false turns the slot off. */
  const SAVE_VERSION = 1;
  const SAVING = C.save !== false && !PLAYABLE;
  const AUTOSAVE_MS = 5000;
  const SAVE_KEYS = ['score', 'collected', 'lives', 'moves'];
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  const knownLevel = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(C.levels, id);
  const knownItems = (list) => (Array.isArray(list) ? list.filter((i, k) => typeof i === 'string' && (C.items || {})[i] && list.indexOf(i) === k).slice(0, 60) : []);
  const numOr = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

  function blankSave() { return { v: SAVE_VERSION, game: C.id, version: C.version || 1, at: 0, done: [], levels: {}, run: null }; }
  function blankRun(id) { return { level: id, score: 0, collected: 0, need: 0, lives: null, moves: null, hud: '', got: 0, of: 0, items: [], snap: null }; }

  function cleanSave(raw) {
    const s = blankSave();
    if (!isObj(raw) || raw.v !== SAVE_VERSION || raw.game !== C.id) return s;
    s.at = numOr(raw.at, 0);
    if (Array.isArray(raw.done)) raw.done.forEach((id) => { if (knownLevel(id) && !s.done.includes(id)) s.done.push(id); });
    if (isObj(raw.levels)) {
      Object.keys(raw.levels).forEach((id) => {
        const l = raw.levels[id];
        if (knownLevel(id) && isObj(l)) s.levels[id] = { best: numOr(l.best, 0), got: numOr(l.got, 0), of: numOr(l.of, 0), items: knownItems(l.items) };
      });
    }
    const r = raw.run;
    const ch = isObj(r) && knownLevel(r.level) ? chapterOf(r.level) : null;
    if (ch && isReleased(ch)) {
      s.run = Object.assign(blankRun(r.level), {
        score: numOr(r.score, 0), collected: numOr(r.collected, 0), need: numOr(r.need, 0), got: numOr(r.got, 0), of: numOr(r.of, 0),
        lives: typeof r.lives === 'number' ? r.lives : null, moves: typeof r.moves === 'number' ? r.moves : null,
        hud: typeof r.hud === 'string' ? r.hud.slice(0, 120) : '', items: knownItems(r.items), snap: isObj(r.snap) ? r.snap : null,
      });
    }
    return s;
  }

  const save = SAVING ? cleanSave(store.get('save', null)) : blankSave();
  progress.done = save.done;

  function writeSave() {
    if (!SAVING) return false;
    save.at = Date.now();
    save.version = C.version || 1;
    return store.set('save', save);
  }

  /* Games saved before the slot existed kept only the finished levels, under 'progress': they move into the slot. */
  if (SAVING && !save.at && legacy && Array.isArray(legacy.done) && legacy.done.some(knownLevel)) {
    legacy.done.forEach((id) => { if (knownLevel(id) && !save.done.includes(id)) save.done.push(id); });
    writeSave();
  }

  let playScene = null; /* the running Play scene, once its save hooks are in */
  let resumeLevel = null; /* the level Continue is about to restore */
  let restored = null; /* what the last restore brought back (QA) */
  let playableAttempts = 0, playableEnded = false;
  const playableResults = [];

  function ledgerOf(scene) {
    let l = null;
    if (genre.ledger) { try { l = genre.ledger(scene); } catch (e) { l = null; } }
    l = isObj(l) ? l : {};
    return { got: numOr(l.got, state.collected || 0), of: numOr(l.of, state.need || 0), items: knownItems(l.items) };
  }

  /* Copies the level in progress into the slot. A genre snapshot of null means "not a consistent moment" (a cascade
     still falling, a dialog about to pay off): the slot keeps the last consistent one. */
  function captureRun(scene) {
    const s = scene || playScene;
    if (!SAVING || !s || !s.__gkSave || state.status !== 'playing' || !save.run || save.run.level !== state.level) return false;
    let snap = null;
    if (genre.snapshot) {
      try { snap = genre.snapshot(s); } catch (e) { errors.push('save snapshot: ' + (e && e.message)); return false; }
      if (snap == null) return false;
    }
    const led = ledgerOf(s);
    Object.assign(save.run, {
      score: state.score, collected: state.collected, need: state.need, lives: state.lives, moves: state.moves,
      hud: s.__gkHud || '', got: led.got, of: led.of, items: led.items, snap,
    });
    return true;
  }

  function autosave(scene) { return captureRun(scene) ? writeSave() : false; }

  let saveQueued = false;
  function queueSave() {
    if (saveQueued || !SAVING) return;
    saveQueued = true;
    Promise.resolve().then(() => { saveQueued = false; autosave(); });
  }

  function setState(patch) {
    if (patch.scene && patch.scene !== state.scene && sceneLog.length < 200) sceneLog.push(patch.scene);
    Object.assign(state, patch);
    if (playScene && state.status === 'playing' && SAVE_KEYS.some((k) => k in patch)) queueSave();
  }

  /* Runs right after every Play scene's create(): restores the level Continue asked for, or opens a fresh run. */
  function playCreated(scene) {
    const id = scene.levelId;
    if (PLAYABLE) {
      TEST.ready = true; /* playable mode is ready once its level is on screen */
      bus.emit('start', { level: id, attempt: ++playableAttempts });
    }
    const run = resumeLevel === id && save.run && save.run.level === id && save.run.snap && genre.restore ? save.run : null;
    resumeLevel = null;
    restored = null;
    state.paused = false;
    scene.__gkSave = true;
    playScene = scene;
    scene.events.once('shutdown', () => { if (playScene === scene) playScene = null; });
    if (run) {
      try {
        state.score = run.score;
        genre.restore(scene, run.snap, run);
        restored = { level: id, score: state.score, collected: state.collected, lives: state.lives, moves: state.moves, snap: genre.snapshot ? genre.snapshot(scene) : null };
      } catch (e) {
        /* A snapshot this content cannot take: play the level from its start instead. */
        errors.push('save restore: ' + (e && e.message));
        save.run = blankRun(id);
        writeSave();
        scene.__gkSave = false;
        scene.scene.restart({ id });
        return;
      }
    } else {
      save.run = blankRun(id);
    }
    if (!SAVING) return;
    autosave(scene);
    scene.time.addEvent({ delay: AUTOSAVE_MS, loop: true, callback: () => autosave(scene) });
  }

  /* Every play scene gets the save hooks without code of its own (templates and freeform alike). */
  function wrapPlay(Play) {
    if (!Play || Play.__gkWrapped) return Play;
    const create = Play.prototype.create;
    Play.prototype.create = function () {
      const out = create.apply(this, arguments);
      playCreated(this);
      return out;
    };
    Play.__gkWrapped = true;
    return Play;
  }

  function hasSave() { return SAVING && (!!save.run || save.done.length > 0); }

  /* "Level 3 · Clues 2/4": the level in progress and its HUD line, or the next level to play. */
  function saveSummary() {
    if (!hasSave()) return null;
    const list = chapters().flatMap((ch) => ch.levels);
    const r = save.run;
    if (r && list.includes(r.level)) return STR.level + ' ' + (list.indexOf(r.level) + 1) + (r.hud ? ' · ' + r.hud : '');
    const nextId = list.find((id) => !save.done.includes(id));
    if (!nextId) return STR.allDone;
    return STR.level + ' ' + (list.indexOf(nextId) + 1) + ((C.levels[nextId] || {}).title ? ' · ' + C.levels[nextId].title : '');
  }

  function continueGame(scene) {
    const r = save.run;
    if (hasSave() && r && chapterOf(r.level)) {
      resumeLevel = r.level;
      return startChapter(scene, chapterOf(r.level).id, r.level);
    }
    return startCampaign(scene);
  }

  /* New game / Restart game: progress goes, settings (sound, last version seen, help toggles) stay. */
  function resetSave() {
    save.done.length = 0;
    save.levels = {};
    save.run = null;
    save.at = 0;
    state.results = {};
    resumeLevel = null;
    store.remove('save');
    saveProgress();
  }

  /* Each released level for the collection view: finished, in progress, open, best score and what was found. */
  function ledger() {
    return chapters().flatMap((ch, ci) => ch.levels.map((id) => {
      const rec = save.levels[id] || { best: 0, got: 0, of: 0, items: [] };
      const run = save.run && save.run.level === id ? save.run : null;
      return {
        id, title: (C.levels[id] || {}).title || id, chapter: ch.id, done: save.done.includes(id), playing: !!run, open: chapterUnlocked(ci),
        best: rec.best, got: Math.max(rec.got, run ? run.got : 0), of: rec.of || (run ? run.of : 0),
        items: knownItems(rec.items.concat(run ? run.items : [])),
      };
    }));
  }

  function recordLevel(scene) {
    const led = ledgerOf(scene);
    const prev = save.levels[state.level] || { best: 0, got: 0, of: 0, items: [] };
    save.levels[state.level] = { best: Math.max(prev.best, state.score || 0), got: Math.max(prev.got, led.got), of: led.of || prev.of, items: knownItems(prev.items.concat(led.items)) };
  }

  /* Pause: the Pause scene runs over the frozen Play scene. */
  function pause(scene) {
    if (PLAYABLE) return false; /* the ad shell owns pausing: GK.pause() freezes the whole game instead */
    const s = scene || playScene;
    if (!s || s.scene.key !== 'Play' || state.status !== 'playing' || state.paused || !s.sys.isActive()) return false;
    autosave(s);
    state.paused = true;
    s.scene.launch('Pause', { id: state.level });
    s.scene.bringToTop('Pause');
    s.scene.pause();
    return true;
  }

  function restartLevel(fromScene) {
    const id = state.level;
    resumeLevel = null;
    delete state.results[id];
    state.paused = false;
    fromScene.scene.stop('Play');
    fromScene.scene.start('Play', { id });
  }

  if (SAVING) {
    window.addEventListener('pagehide', () => autosave());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'hidden') return;
      autosave();
      if (!QA) pause();
    });
  }

  function levelWon(scene) {
    if (state.status !== 'playing') return;
    state.status = 'won';
    state.results[state.level] = 'won';
    state.lastWin = { level: state.level, moves: state.moves, lives: state.lives, score: state.score };
    if (!progress.done.includes(state.level)) progress.done.push(state.level);
    recordLevel(scene);
    save.run = null;
    writeSave();
    sfx(scene, 'win');
    bus.emit('level-won', state.level);
    if (PLAYABLE) return playableOutcome(scene, 'win', STR.win, palette.accent);
    banner(scene, STR.win, palette.accent, () => next(scene));
  }

  function levelLost(scene, reason) {
    if (state.status !== 'playing') return;
    state.status = 'lost';
    state.results[state.level] = 'lost';
    /* The level restarts from its beginning; a player who leaves now resumes it fresh. */
    if (save.run && save.run.level === state.level) { save.run = blankRun(state.level); writeSave(); }
    sfx(scene, 'lose');
    bus.emit('level-lost', state.level);
    if (PLAYABLE) return playableOutcome(scene, 'lose', reason || STR.lose, palette.danger);
    banner(scene, reason || STR.lose, palette.danger, () => go(scene, 'Play', { id: state.level }));
  }

  /* Playable mode: every outcome goes on GK.bus and the campaign never advances. endAfter decides which outcome ends the
     session (once): its banner stays and the Play scene freezes on that frame. Any other outcome replays the level. */
  function playableOutcome(scene, result, msg, fill) {
    const info = { result, level: state.level, score: state.score || 0 };
    playableResults.push(info);
    bus.emit('result', info);
    if (playableEnded || !(PLAYABLE.endAfter === 'first' || PLAYABLE.endAfter === result)) {
      return banner(scene, msg, fill, () => go(scene, 'Play', { id: state.level }));
    }
    playableEnded = true;
    bus.emit('end', info);
    banner(scene, msg, fill, () => {
      if (PLAYABLE.brand === 'text' && window.GK.brandBadge) window.GK.brandBadge(scene, H - 22).setDepth(202);
      scene.scene.pause();
    }, true);
  }

  /* Playable mode boots straight into its one level: no splash, title, map, intro or cutscenes. */
  function startPlayable(scene) {
    const ch = chapterOf(PLAYABLE.level);
    state.chapter = ch ? ch.id : null;
    setQueue([]);
    bus.emit('scene-change', 'Play');
    scene.scene.start('Play', { id: PLAYABLE.level });
  }

  /* ---------- assets ---------- */

  const keys = {
    sprite: (id) => 'char:' + id,
    portrait: (id) => 'portrait:' + id,
    bg: (id) => 'bg:' + id,
    music: (id) => 'music:' + id,
    item: (id) => 'item:' + id,
    image: (src) => 'img:' + src,
    sound: (src) => 'snd:' + src,
    frame: (id, motion, i) => 'anim:' + id + ':' + motion + ':' + (i || 0),
  };

  /* characters.<id>.anim = { idle, walk: [2-4 frames], jump, fps } or "procedural". Returns { idle: [], walk: [], jump: [] } of paths. */
  function animFrames(ch) {
    const a = ch && typeof ch.anim === 'object' ? ch.anim : {};
    const list = (v) => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);
    return { idle: list(a.idle), walk: list(a.walk), jump: list(a.jump) };
  }

  function queueAssets(scene) {
    const L = scene.load;
    const img = (key, src) => { if (src) L.image(key, src); };
    const snd = (key, src) => { if (src) L.audio(key, src); };
    Object.entries(C.characters || {}).forEach(([id, ch]) => {
      img(keys.sprite(id), ch.sprite);
      img(keys.portrait(id), ch.portrait);
      const fr = animFrames(ch);
      Object.keys(fr).forEach((motion) => fr[motion].forEach((src, i) => img(keys.frame(id, motion, i), src)));
    });
    Object.entries(C.locations || {}).forEach(([id, loc]) => {
      img(keys.bg(id), loc.background);
      snd(keys.music(id), loc.music);
    });
    Object.entries(C.items || {}).forEach(([id, it]) => img(keys.item(id), it.image));
    /* Playable mode skips what only the story and title use (cutscene media, title music); every character, location,
       item and sfx still loads, since a play scene may draw any of them. */
    if (!PLAYABLE) Object.values(C.cutscenes || {}).forEach((cs) => (cs.beats || []).forEach((b) => {
      if (b.image) img(keys.image(b.image), b.image);
      if (b.poster) img(keys.image(b.poster), b.poster);
      if (b.audio) snd(keys.sound(b.audio), b.audio);
    }));
    Object.entries(C.sfx || {}).forEach(([name, src]) => snd('sfx:' + name, src));
    if (C.keyArt) img('keyart', C.keyArt);
    if (C.music && C.music.title && !PLAYABLE) snd('music:title', C.music.title);
    L.on('loaderror', (file) => missing.push(file.src || file.key));
  }

  function placeholder(scene, key, label, tint, w, h) {
    if (scene.textures.exists(key)) return;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(color(tint), 1);
    g.fillRoundedRect(0, 0, w, h, Math.min(w, h) * 0.22);
    g.lineStyle(4, 0xffffff, 0.85);
    g.strokeRoundedRect(2, 2, w - 4, h - 4, Math.min(w, h) * 0.2);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(w * 0.36, h * 0.32, Math.max(3, w * 0.07));
    g.fillCircle(w * 0.64, h * 0.32, Math.max(3, w * 0.07));
    g.generateTexture(key, w, h);
    g.destroy();
    if (label) missing.push('placeholder:' + key);
  }

  function ensureTextures(scene) {
    Object.entries(C.characters || {}).forEach(([id, ch]) => {
      placeholder(scene, keys.sprite(id), ch.sprite, ch.color || '#6aa9ff', 96, 128);
      placeholder(scene, keys.portrait(id), ch.portrait, ch.color || '#6aa9ff', 256, 256);
    });
    Object.entries(C.items || {}).forEach(([id, it]) => placeholder(scene, keys.item(id), it.image, it.color || '#ffcc33', 96, 96));
    Object.entries(C.locations || {}).forEach(([id, loc]) => {
      const key = keys.bg(id);
      if (scene.textures.exists(key)) return;
      const g = scene.make.graphics({ x: 0, y: 0 }, false);
      const top = Phaser.Display.Color.HexStringToColor(loc.sky || loc.tint || palette.bg);
      const bottom = Phaser.Display.Color.HexStringToColor(loc.tint || palette.panel);
      for (let i = 0; i < 32; i++) {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, bottom, 31, i);
        g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
        g.fillRect(0, (H / 32) * i, W, H / 32 + 1);
      }
      g.generateTexture(key, W, H);
      g.destroy();
      if (loc.background) missing.push('placeholder:' + key);
    });
  }

  /* The page behind the canvas (the bars FIT leaves around the stage): the theme colour, and the key art blurred
     and dimmed when it loaded. Only a texture that loaded is used, so a missing key art never adds a failed request. */
  function pageBackdrop(scene) {
    document.body.style.background = palette.bg;
    const el = document.getElementById('gk-backdrop');
    if (!el || !C.keyArt || !scene.textures.exists('keyart') || el.style.backgroundImage) return;
    /* A 48 px wide dimmed copy that the browser stretches: a soft blur without a CSS filter (see index.html). */
    try {
      const src = scene.textures.get('keyart').getSourceImage();
      const c = document.createElement('canvas');
      c.width = 48;
      c.height = Math.max(1, Math.round(48 * src.height / src.width));
      const g = c.getContext('2d');
      g.drawImage(src, 0, 0, c.width, c.height);
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(0, 0, c.width, c.height);
      el.style.backgroundImage = 'url("' + c.toDataURL() + '")';
    } catch (e) { /* a cross-origin key art cannot be read back: the theme colour stays */ }
  }

  /* Scale an image to cover the viewport, pinned to the camera. */
  function backdrop(scene, key, alpha) {
    const im = scene.add.image(W / 2, H / 2, key).setScrollFactor(0);
    const s = Math.max(W / im.width, H / im.height);
    im.setScale(s).setAlpha(alpha == null ? 1 : alpha);
    return im;
  }

  /* Tint baked into a texture copy (multiply, alpha kept). Phaser's setTint is WebGL-only: canvas ignores it, so a
     tint set that way looks different in QA (canvas) and for players (WebGL). These work the same in both. */
  function tintedKey(scene, key, rgb) {
    const k = key + '#' + rgb.toString(16).padStart(6, '0');
    if (scene.textures.exists(k)) return k;
    const src = scene.textures.get(key).getSourceImage();
    const c = scene.textures.createCanvas(k, src.width, src.height);
    const ctx = c.getContext();
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#' + rgb.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, src.width, src.height);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(src, 0, 0);
    c.refresh();
    return k;
  }

  /* tint(image, 0x777777) shades an image; tint(image, null) restores it. */
  function tint(im, rgb) {
    im.__baseKey = im.__baseKey || im.texture.key;
    im.setTexture(rgb == null ? im.__baseKey : tintedKey(im.scene, im.__baseKey, rgb));
    return im;
  }

  /* ---------- characters on screen ---------- */

  /* A character standing on the floor: an image whose origin is at the feet, with a contact shadow and motion.
     a.setMotion('idle'|'walk'|'jump', speed) · a.face(-1|1) · a.setFeet(x, y) · a.land() · a.shadow
     With anim frames it cycles them; with one image it walks procedurally (step bob, lean, rock, squash on
     contact), so a character never glides. Purely visual: game logic never reads it. Sheets face right. */
  function actor(scene, charId, x, y, opts) {
    const o = Object.assign({ height: 110, depth: 10, shadow: true }, opts || {});
    const ch = (C.characters || {})[charId] || {};
    const fr = animFrames(ch);
    const fk = {};
    Object.keys(fr).forEach((m) => { fk[m] = fr[m].map((_, i) => keys.frame(charId, m, i)).filter((k) => scene.textures.exists(k)); });
    const idleKey = fk.idle[0] || keys.sprite(charId);
    const fps = (ch.anim && ch.anim.fps) || 8;
    const facesLeft = ch.facesLeft != null ? !!ch.facesLeft : !!C.spriteFacesLeft;
    const scaleFor = (key) => o.height / Math.max(1, scene.textures.get(key).getSourceImage().height);
    const im = scene.add.image(x, y, idleKey).setOrigin(0.5, 1).setDepth(o.depth);
    let base = scaleFor(idleKey);
    im.setScale(base);
    const sw = Math.max(18, Math.min(im.displayWidth, o.height * 0.7) * 0.8);
    const shadow = o.shadow === false ? null
      : scene.add.ellipse(x, y, sw, Math.max(6, sw * 0.22), 0x000000, 0.3).setDepth(o.depth - 0.5);
    const st = { motion: 'idle', speed: 1, phase: 0, dir: 1, feetX: x, feetY: y, lastX: x, lastY: y, land: 0, key: idleKey, t: 0 };

    function tick(time, delta) {
      if (!im.active) return;
      if (im.x !== st.lastX || im.y !== st.lastY) { st.feetX = im.x; st.feetY = im.y; } /* moved with setPosition */
      const dt = Math.min(delta || 16, 100) / 1000;
      st.t += dt;
      const h = o.height;
      let key = idleKey;
      let bob = 0;
      let angle = 0;
      let sx = 1;
      let sy = 1;
      if (st.motion === 'walk') {
        const n = fk.walk.length;
        if (n >= 2) {
          st.phase += dt * fps * st.speed;
          key = fk.walk[Math.floor(st.phase) % n];
          bob = -h * 0.015 * Math.abs(Math.sin((Math.PI * st.phase) / (n / 2)));
          angle = st.dir * 1.5;
        } else {
          st.phase += dt * (fps / 3) * st.speed; /* steps */
          const s = Math.sin(Math.PI * st.phase);
          bob = -h * 0.045 * Math.abs(s);
          angle = st.dir * 3 + 2.5 * s;
          const contact = Math.pow(1 - Math.abs(s), 4);
          sy = 1 - 0.05 * contact;
          sx = 1 + 0.04 * contact;
        }
      } else if (st.motion === 'jump') {
        key = fk.jump[0] || (fk.walk.length ? fk.walk[0] : idleKey);
        if (!fk.jump.length) { sy = 1.05; sx = 0.95; }
        angle = -st.dir * 3;
      } else {
        sy = 1 + 0.012 * Math.sin(st.t * 2.4);
      }
      if (st.land > 0) {
        sy *= 1 - 0.12 * st.land;
        sx *= 1 + 0.1 * st.land;
        st.land = Math.max(0, st.land - dt / 0.15);
      }
      if (key !== st.key) { im.setTexture(key); base = scaleFor(key); st.key = key; }
      im.setFlipX(st.dir < 0 ? !facesLeft : facesLeft);
      im.setScale(base * sx, base * sy).setAngle(angle).setPosition(st.feetX, st.feetY + bob);
      st.lastX = im.x;
      st.lastY = im.y;
      if (shadow) {
        const air = st.motion === 'jump';
        shadow.setPosition(st.feetX, st.feetY).setDepth(im.depth - 0.5).setVisible(im.visible && !air)
          .setAlpha(0.3 * im.alpha).setScale(1 + bob / h);
      }
    }
    scene.events.on('postupdate', tick);
    im.once('destroy', () => { scene.events.off('postupdate', tick); if (shadow) shadow.destroy(); });

    im.shadow = shadow;
    im.setMotion = (m, speed) => {
      if (m !== st.motion) { if (m === 'walk') st.phase = 0; st.motion = m; }
      const v = speed && typeof speed === 'object' ? speed.speed : speed;
      st.speed = v > 0 ? v : 1;
      return im;
    };
    /* Display height of the full frame in game px (perspective scaling); the shadow scales with it. */
    im.setHeight = (px) => {
      const k = px / o.height;
      o.height = px;
      base = scaleFor(st.key);
      if (shadow) shadow.setSize(shadow.width * k, shadow.height * k);
      return im;
    };
    const setDepth = im.setDepth.bind(im);
    im.setDepth = (d) => { setDepth(d); if (shadow) shadow.setDepth(d - 0.5); return im; };
    im.getMotion = () => st.motion;
    im.face = (d) => { if (d) st.dir = d < 0 ? -1 : 1; return im; };
    im.setFeet = (fx, fy) => {
      st.feetX = fx; st.feetY = fy;
      im.setPosition(fx, fy);
      st.lastX = fx; st.lastY = fy;
      return im;
    };
    im.land = () => { st.land = 1; return im; };
    im.framed = fk.walk.length >= 2;
    tick(0, 0);
    return im;
  }

  /* ---------- audio ---------- */

  let muted = store.get('muted', false);
  let currentMusic = null;

  function music(scene, key) {
    if (currentMusic && currentMusic.key === key && currentMusic.isPlaying) return;
    if (currentMusic) { currentMusic.stop(); currentMusic = null; }
    if (!key || !scene.cache.audio.exists(key)) return;
    currentMusic = scene.sound.add(key, { loop: true, volume: 0.45 });
    if (!muted) currentMusic.play();
  }

  function stopMusic() { if (currentMusic) { currentMusic.stop(); currentMusic = null; } }

  function sfx(scene, name) {
    const key = 'sfx:' + name;
    if (!muted && scene.cache.audio.exists(key)) scene.sound.play(key, { volume: 0.7 });
  }

  /* Sound on or off for the whole game (the mute button, M, or the host's GK.mute in playable mode). */
  function setMuted(on) {
    muted = !!on;
    store.set('muted', muted); /* page memory only in playable mode */
    if (game && game.sound) game.sound.mute = muted;
    /* Music paused by a freeze (GK.pause, the rotate prompt) is left to resumeAll() on release; music that never started
       starts, held paused while the game is frozen so it too waits for the release. */
    if (!muted && currentMusic && !currentMusic.isPlaying && !currentMusic.isPaused) {
      currentMusic.play();
      if (game && game.isPaused) currentMusic.pause();
    }
    bus.emit('mute', muted);
    return muted;
  }

  function toggleMute() { return setMuted(!muted); } /* scene.sound is game.sound */

  /* ---------- UI ---------- */

  function text(scene, x, y, str, size, fill, opts) {
    const px = Math.round((size || 22) * font.scale);
    return scene.add.text(x, y, str, Object.assign({
      fontFamily: font.body, fontSize: px + 'px', color: fill || palette.text,
      stroke: '#000000', strokeThickness: Math.max(2, Math.round(px / 7)),
      align: 'center', resolution: TEXT_RES,
    }, opts || {}));
  }

  /* Headings: the style's display face. */
  function title(scene, x, y, str, size, fill, opts) {
    return text(scene, x, y, str, size, fill, Object.assign({ fontFamily: font.title, fontStyle: font.titleStyle }, opts || {}));
  }

  /* Text on a skin panel: the skin's ink, outlined only when the skin needs it. */
  function ink(scene, x, y, str, size, opts) {
    return text(scene, x, y, str, size, skin.ink, Object.assign({ strokeThickness: skin.inkStroke }, opts || {}));
  }

  /* A rounded panel in the current skin, drawn with graphics so every style gets its corners. */
  function panel(scene, x, y, w, h, opts) {
    const o = Object.assign({ fill: skin.panel, alpha: skin.panelAlpha, edge: skin.edge, edgeWidth: skin.edgeWidth, radius: skin.radius }, opts || {});
    const g = scene.add.graphics({ x, y });
    g.fillStyle(color(o.fill), o.alpha).fillRoundedRect(-w / 2, -h / 2, w, h, o.radius);
    if (o.edgeWidth) g.lineStyle(o.edgeWidth, color(o.edge), 1).strokeRoundedRect(-w / 2, -h / 2, w, h, o.radius);
    if (skin.paper && !o.plain) {
      g.lineStyle(1, color(skin.edge), 0.25);
      for (let ly = -h / 2 + 34; ly < h / 2 - 10; ly += 30) g.lineBetween(-w / 2 + 18, ly, w / 2 - 18, ly);
    }
    return g;
  }

  function button(scene, x, y, label, onClick, opts) {
    const o = Object.assign({ w: 240, h: 60, size: 26, fill: palette.accent, textColor: '#1a1a1a' }, opts || {});
    const box = panel(scene, 0, 0, o.w, o.h, {
      fill: o.fill, alpha: 1, plain: true, radius: Math.min(o.h / 2, skin.radius + 6),
      edge: story.style === 'comic' ? '#111111' : '#ffffff', edgeWidth: story.style === 'comic' ? 5 : 4,
    });
    const label_ = title(scene, 0, 0, label, o.size, o.textColor, { strokeThickness: 0 }).setOrigin(0.5);
    const c = scene.add.container(x, y, [box, label_]).setSize(o.w, o.h).setScrollFactor(0).setDepth(o.depth || 50);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerover', () => c.setScale(1.05));
    c.on('pointerout', () => c.setScale(1));
    c.on('pointerdown', () => { scene.tweens.add({ targets: c, scale: 0.94, yoyo: true, duration: 70 }); onClick(); });
    c.label = label_;
    c.__gkButton = o.id || label;
    c.__gkLabel = label;
    return c;
  }

  /* Bad Cookie: the exit X owns the top-right corner, so the sound toggle sits just left of it (left side in a level). */
  function muteButton(scene, mx, my, ox) {
    const t = text(scene, mx != null ? mx : W - 70, my != null ? my : 12, '\u266A', 34).setOrigin(ox != null ? ox : 1, 0).setScrollFactor(0).setDepth(90).setAlpha(muted ? 0.35 : 1);
    const flip = () => t.setAlpha(toggleMute(scene) ? 0.35 : 1);
    t.setInteractive({ useHandCursor: true }).on('pointerdown', flip);
    if (scene.input.keyboard) scene.input.keyboard.on('keydown-M', flip);
    scene.sound.mute = muted;
    return t;
  }

  /* Pause on the HUD (and Esc or P). The tap is kept from the play scene, so it never jumps, steers or selects. */
  function pauseButton(scene) {
    const c = scene.add.container(PORTRAIT ? W - 74 : 92, 30).setScrollFactor(0).setDepth(90);
    const ring = scene.add.circle(0, 0, 17, 0x000000, 0.35).setStrokeStyle(2, 0xffffff, 0.85);
    const bars = scene.add.graphics();
    bars.fillStyle(0xffffff, 1).fillRect(-6, -8, 4, 16).fillRect(2, -8, 4, 16);
    c.add([ring, bars]).setSize(48, 48).setInteractive({ useHandCursor: true });
    c.on('pointerdown', (p, x, y, e) => { if (e && e.stopPropagation) e.stopPropagation(); });
    c.on('pointerup', (p, x, y, e) => { if (e && e.stopPropagation) e.stopPropagation(); pause(scene); });
    c.__gkButton = 'pause';
    c.__gkLabel = STR.paused;
    if (scene.input.keyboard) {
      scene.input.keyboard.on('keydown-ESC', () => pause(scene));
      scene.input.keyboard.on('keydown-P', () => pause(scene));
    }
    return c;
  }

  /* hold: the banner stays on screen after done() (playable mode's final frame). */
  function banner(scene, msg, fill, done, hold) {
    const shade = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setScrollFactor(0).setDepth(200);
    const t = text(scene, W / 2, H / 2, msg, 54, fill, { wordWrap: { width: W - 60 } }).setOrigin(0.5).setScrollFactor(0).setDepth(201).setScale(0.3);
    scene.tweens.add({ targets: t, scale: 1, duration: 320, ease: 'Back.Out' });
    scene.time.delayedCall(QA ? 50 : 1500, () => { if (!hold) { shade.destroy(); t.destroy(); } done(); });
  }

  /* HUD: call hud.set({ ... }) from the play scene. Portrait: two rows in the band y 0-84 (title, then the stats). */
  function hud(scene) {
    const level = C.levels[scene.levelId || state.level] || {};
    const title = text(scene, PORTRAIT ? 20 : 126, 14, level.title || '', 22, palette.text, { align: 'left' }).setScrollFactor(0).setDepth(80);
    if (PORTRAIT) {
      /* The title must clear pause (W - 74) and mute (W - 24). */
      let str = level.title || '';
      while (title.width > W - 140 && str.length > 4) { str = str.slice(0, -2); title.setText(str.trim() + '\u2026'); }
    }
    const right = PORTRAIT
      ? text(scene, 20, 48, '', 20, palette.accent, { align: 'left' }).setOrigin(0, 0).setScrollFactor(0).setDepth(80)
      : text(scene, W - 104, 16, '', 22, palette.accent, { align: 'right' }).setOrigin(1, 0).setScrollFactor(0).setDepth(80);
    /* Playable mode: the ad shell owns pause and sound (GK.pause, GK.resume, GK.mute), so the HUD shows neither. */
    if (!PLAYABLE) { if (PORTRAIT) muteButton(scene); else muteButton(scene, 22, 12, 0); pauseButton(scene); }
    return {
      set(parts) {
        const list = parts.filter(Boolean);
        right.setText(list.join('   '));
        scene.__gkHud = list.join(' · ');
      },
      title,
    };
  }

  /* Speech box anchored to the bottom of the screen, drawn in the game's story style. */
  function speech(scene, speakerId, line, depth) {
    const ch = (C.characters || {})[speakerId];
    const d = depth || 150;
    const parts = [];
    const add = (o) => { parts.push(o.setScrollFactor(0).setDepth(o.depth || d)); return o; };
    const st = story.style;
    if (PORTRAIT) return speechPortrait(scene, ch, speakerId, line, add, d, parts);
    const boxY = H - 92;
    let textX = 50;
    let textTop = H - 150;
    if (st === 'stage' && ch) {
      const p = add(scene.add.image(150, H - 150, keys.portrait(speakerId)).setOrigin(0.5, 1));
      p.setScale(300 / Math.max(p.width, p.height)).setDepth(d);
    }
    const box = add(panel(scene, W / 2, boxY, W - 40, 150, st === 'journal' ? { radius: 2 } : {}));
    box.setDepth(d);
    if (st === 'journal') box.setAngle(-0.6);
    if (ch && st !== 'stage') {
      const size = st === 'chat' ? 90 : 120;
      const p = add(scene.add.image(110, boxY, keys.portrait(speakerId)));
      p.setScale(size / Math.max(p.width, p.height)).setDepth(d + 1);
      if (st === 'journal') tint(p, 0xe8dcc4).setAngle(-4);
      if (st === 'storybook' || st === 'journal') {
        const frame = add(scene.add.rectangle(110, boxY, size + 10, size + 10).setStrokeStyle(st === 'journal' ? 6 : 4, color(st === 'journal' ? '#ffffff' : skin.edge)));
        frame.setDepth(d + 1).setAngle(st === 'journal' ? -4 : 0);
      }
      textX = 190;
    } else if (ch && st === 'stage') {
      textX = 60;
    }
    if (ch) {
      const nameY = st === 'stage' ? H - 186 : H - 160;
      if (st === 'stage' || skin.nameFill) {
        const tagW = Math.max(120, ch.name.length * 14 + 40);
        add(panel(scene, textX + tagW / 2 - 10, nameY + 14, tagW, 34, { fill: skin.nameFill || palette.accent, alpha: 1, radius: 10, edge: '#111111', edgeWidth: st === 'comic' ? 3 : 0, plain: true })).setDepth(d + 1);
        add(title(scene, textX + tagW / 2 - 10, nameY + 14, ch.name, 20, '#111111', { strokeThickness: 0 }).setOrigin(0.5)).setDepth(d + 2);
      } else {
        add(title(scene, textX, nameY, ch.name, 22, st === 'cinematic' || st === 'video' ? (ch.color || skin.name) : skin.name, { align: 'left', strokeThickness: skin.inkStroke })).setDepth(d + 1);
      }
      textTop = st === 'stage' ? H - 145 : H - 128;
    }
    const body = add(ink(scene, textX, textTop, '', 22, { align: 'left', wordWrap: { width: W - textX - 50 } })).setDepth(d + 1);
    return typeLine(scene, body, line, parts);
  }

  /* Portrait speech box: taller (the stage is narrow), small portrait on the left, the name above the text.
     Reached from cinematic, chat and video stories (build.py allows only those in portrait) and from custom code. */
  function speechPortrait(scene, ch, speakerId, line, add, d, parts) {
    const st = story.style;
    const boxY = H - 112;
    add(panel(scene, W / 2, boxY, W - 40, 200)).setDepth(d);
    let textX = 40;
    let textTop = H - 196;
    if (ch) {
      const p = add(scene.add.image(76, H - 150, keys.portrait(speakerId)));
      p.setScale(84 / Math.max(p.width, p.height)).setDepth(d + 1);
      textX = 136;
      textTop = H - 166;
      add(title(scene, textX, H - 198, ch.name, 22, st === 'cinematic' || st === 'video' ? (ch.color || skin.name) : skin.name, { align: 'left', strokeThickness: skin.inkStroke })).setDepth(d + 1);
    }
    const body = add(ink(scene, textX, textTop, '', 22, { align: 'left', wordWrap: { width: W - textX - 30 } })).setDepth(d + 1);
    return typeLine(scene, body, line, parts);
  }

  /* Types a line into a speech box's text; the handle finishes or removes the box. */
  function typeLine(scene, body, line, parts) {
    let i = 0;
    const typer = scene.time.addEvent({
      delay: QA ? 1 : Math.max(4, Math.round(18 / story.textSpeed)), repeat: Math.max(0, line.length - 1),
      callback: () => { i++; body.setText(line.slice(0, i)); },
    });
    return {
      done: () => i >= line.length,
      finish: () => { typer.remove(false); i = line.length; body.setText(line); },
      destroy: () => { typer.remove(false); parts.forEach((p) => p.destroy()); },
    };
  }

  /* ---------- touch input ---------- */

  const isTouch = () => QA ? params.get('touch') === '1' : (navigator.maxTouchPoints || 0) > 0;
  /* A phone or small tablet: coarse pointer and a short screen side. Touch laptops, Surfaces and Chromebooks
     report touch points too, so the turn-your-phone prompt keys off this, never off isTouch. */
  const isPhone = () => QA ? params.get('touch') === '1'
    : !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches) && Math.min(screen.width, screen.height) < 700;

  /* Emitted on every scene's input (scene.input.on(GK.INPUT_CANCEL, (pointer, dragged) => ...)) for a press still down
     when GK.pause() holds the game: its moves and lift never reach a scene, not even after GK.resume().
     No pointerup follows, so a held control or stick must let go here, and nothing a tap or swipe does may happen. A
     built-in drag of that pointer has already stopped without drop or dragend; `dragged` lists its objects, to put back. */
  const INPUT_CANCEL = 'gk-inputcancel';

  function touchPad(scene, buttons) {
    const pad = { left: false, right: false, up: false, down: false, jump: false };
    if (!isTouch()) return pad;
    scene.__gkPad = buttons.length > 0;
    scene.input.addPointer(2);
    const owner = {};
    scene.input.on(INPUT_CANCEL, (p) => { for (const prop in owner) if (owner[prop] === p.id) pad[prop] = false; });
    const make = (x, y, label, prop, r) => {
      const c = scene.add.circle(x, y, r || 46, 0xffffff, 0.18).setStrokeStyle(3, 0xffffff, 0.5).setScrollFactor(0).setDepth(95);
      text(scene, x, y, label, 30).setOrigin(0.5).setScrollFactor(0).setDepth(96).setAlpha(0.8);
      c.setInteractive();
      c.on('pointerdown', (p) => { pad[prop] = true; owner[prop] = p.id; });
      c.on('pointerup', () => { pad[prop] = false; });
      c.on('pointerout', () => { pad[prop] = false; });
    };
    if (buttons.includes('left')) make(80, H - 80, '◀', 'left');
    if (buttons.includes('right')) make(190, H - 80, '▶', 'right');
    /* Raised above the bottom-right corner, where the host's "Powered by Netlify" badge sits and takes the taps. */
    if (buttons.includes('jump')) make(W - 90, H - 165, '▲', 'jump', 54);
    return pad;
  }

  /* ---------- QA hooks ---------- */

  /* Genre hooks. QA: autoplay, qaWin, describe, bodies. Saves (optional): snapshot(scene) -> small JSON of the level in
     progress (null when the moment is not consistent), restore(scene, snap) after create(), ledger(scene) ->
     { got, of, items } for the collection view; collects = true when the game has things to find. */
  const genre = { autoplay: null, qaWin: null, describe: null, bodies: null, snapshot: null, restore: null, ledger: null, collects: false };
  let game = null;

  /* ---------- bodies: what is on screen, for the physics and staging checks ----------
     genre.bodies(scene) returns the objects that matter, each built with bodyOf(): its visible rect in world
     coordinates (crop-aware), depth, and what it promises: role, z (world distance, larger = farther), grounded
     with surfaceY or surfaceBand, airborne, behind (an occluder id), group (same-kind objects for the scale check),
     world {x, y (height), z} for projectiles. The playtest traces them every frame while the autopilot plays. */
  const bodyRefs = new Map();

  function bodyOf(obj, fields) {
    if (!obj) return null;
    const f = fields || {};
    let rect;
    if (typeof obj.getBounds === 'function') {
      if (obj.active === false || obj.visible === false) return null;
      const b = obj.getBounds();
      rect = { x: b.x, y: b.y, w: b.width, h: b.height };
      const c = obj.isCropped && obj._crop;
      if (c && obj.frame && !obj.rotation) {
        const sx = Math.abs(obj.scaleX), sy = Math.abs(obj.scaleY);
        const fw = obj.frame.realWidth || obj.width;
        const cx = obj.flipX ? fw - c.x - c.width : c.x;
        rect = { x: b.x + cx * sx, y: b.y + c.y * sy, w: c.width * sx, h: c.height * sy };
      }
      if (f.id) bodyRefs.set(f.id, obj);
    } else {
      rect = { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
    }
    const out = Object.assign({ depth: obj.depth != null ? obj.depth : (f.depth || 0) }, f, rect);
    ['x', 'y', 'w', 'h'].forEach((k) => { out[k] = Math.round(out[k] * 10) / 10; });
    return out;
  }

  /* A scored outcome (a sink, a hit, a catch, a pickup): the drawn mover and target at that moment. The playtest
     checks the mover really ended inside the target, so the score always matches what the player saw. */
  const outcomes = [];
  function outcome(scene, o) {
    if (!QA) return;
    const snap = (b) => (!b ? null : typeof b.getBounds === 'function' ? bodyOf(b, {}) : Object.assign({}, b));
    outcomes.push({ t: scene && scene.time ? Math.round(scene.time.now) : 0, level: state.level, kind: o.kind,
      match: o.match || 'center', mover: snap(o.mover), target: snap(o.target) });
    if (outcomes.length > 400) outcomes.shift();
  }

  /* Per-frame trace of the bodies the checks need (dynamic, grounded, occluded, perspective, projectiles). */
  const trace = { on: false, frames: [], max: 2400, hooked: false };
  function tracedBodies(s) {
    const list = genre.bodies ? (genre.bodies(s) || []).filter(Boolean) : [];
    return list.filter((b) => b.grounded || b.behind || b.role === 'occluder' || b.role === 'ball' || b.z != null || b.track);
  }
  function hookTrace() {
    if (trace.hooked || !game) return;
    trace.hooked = true;
    game.events.on('poststep', () => {
      if (!trace.on) return;
      const s = activeScene();
      if (!s || s.scene.key !== 'Play' || state.status !== 'playing') return;
      const cam = s.cameras && s.cameras.main;
      trace.frames.push({ t: Math.round(s.time.now), level: state.level,
        cam: cam ? [Math.round(cam.scrollX), Math.round(cam.scrollY)] : [0, 0], bodies: tracedBodies(s) });
      if (trace.frames.length > trace.max) trace.frames.shift();
    });
  }

  function activeScene() {
    if (!game) return null;
    const list = game.scene.getScenes(true);
    return list[list.length - 1] || null;
  }

  /* Test switches leave exactly one scene running: the one they start (restarted when it was running).
     The scene manager's own stop/start run immediately outside the game loop, so they apply in order. */
  function switchTo(key, data) {
    game.scene.getScenes(true).forEach((s) => game.scene.stop(s.scene.key));
    game.scene.start(key, data || {});
  }

  const TEST = {
    ready: false,
    qa: QA,
    content: C,
    state: () => JSON.parse(JSON.stringify(Object.assign({}, state, { missing: missing.slice(), errors: errors.slice() }))),
    levels: () => C.chapters.flatMap((ch) => ch.levels.map((id) => ({ chapter: ch.id, id, released: isReleased(ch) }))),
    startLevel(id) {
      const ch = chapterOf(id);
      state.chapter = ch && ch.id;
      delete state.results[id];
      const steps = ch ? campaignSteps(ch.id) : [];
      setQueue(steps.slice(steps.findIndex((x) => x.id === id) + 1));
      switchTo('Play', { id });
    },
    startStory(id) { setQueue([]); switchTo('Story', { id }); },
    startScene(key) { switchTo(key, {}); },
    skipStory() { const s = activeScene(); if (s && s.skipAll) s.skipAll(); },
    /* Story QA: finishes typing the current beat and says which page it is on and which page the next beat opens. */
    storyStep() {
      const s = activeScene();
      if (!s || s.scene.key !== 'Story' || !s.view || !s.cs) return null;
      if (s.view.busy()) s.view.finish();
      const pageOf = (i) => (s.view.pageOf ? s.view.pageOf(s.cs.beats[i]) : i);
      const i = s.index;
      return { index: i, beats: s.cs.beats.length, page: pageOf(i), next: i + 1 < s.cs.beats.length ? pageOf(i + 1) : null };
    },
    storyNext() { const s = activeScene(); if (s && s.scene.key === 'Story' && s.advance) s.advance(); },
    /* opts.skill: 'perfect' (default) or 'casual' (aim and timing noise like a casual player). */
    autoplay(opts) { const s = activeScene(); if (s && genre.autoplay) genre.autoplay(s, opts || {}); return !!genre.autoplay; },
    renderer() { return game && game.renderer && game.renderer.type === Phaser.WEBGL ? 'webgl' : 'canvas'; },
    bodies() {
      const s = activeScene();
      if (!s || s.scene.key !== 'Play' || !genre.bodies) return [];
      const cam = s.cameras.main;
      return { cam: [Math.round(cam.scrollX), Math.round(cam.scrollY)], bodies: (genre.bodies(s) || []).filter(Boolean) };
    },
    trace(on) {
      hookTrace();
      if (on) { trace.frames = []; outcomes.length = 0; }
      trace.on = !!on;
      return true;
    },
    traceFrames() { return { frames: trace.frames.slice(), outcomes: outcomes.slice() }; },
    /* Hide or show one body (by the id genre.bodies gave it) for the occlusion pixel probe. */
    setBodyVisible(id, visible) {
      const o = bodyRefs.get(id);
      if (!o || !o.setVisible) return false;
      o.setVisible(!!visible);
      if (o.shadow && o.shadow.setVisible) o.shadow.setVisible(!!visible);
      return true;
    },
    /* A fresh seed for the next level start, so repeated attempts differ. */
    reseed(n) { rngSeed = (Number(n) || 1) % 2147483647 || 1; return rngSeed; },
    qaWin() { const s = activeScene(); if (s && genre.qaWin) genre.qaWin(s); return !!genre.qaWin; },
    /* Saves: the slot as the game holds it (null when game.json turns saving off), a save right now, what the last
       Continue restored, the play scene's snapshot, and the tappable buttons on screen (game coordinates). */
    save() { return SAVING ? JSON.parse(JSON.stringify(save)) : null; },
    saveNow() { return autosave(); },
    restored() { return restored ? JSON.parse(JSON.stringify(restored)) : null; },
    snapshot() { return playScene && genre.snapshot ? JSON.parse(JSON.stringify(genre.snapshot(playScene))) : null; },
    buttons() {
      if (!game) return [];
      const out = [];
      game.scene.getScenes(true).forEach((s) => s.children.list.forEach((o) => {
        if (o.__gkButton && o.visible && o.input && o.input.enabled) out.push({ scene: s.scene.key, id: o.__gkButton, label: o.__gkLabel || '', x: Math.round(o.x), y: Math.round(o.y), depth: o.depth });
      }));
      return out;
    },
    /* Playable mode as the engine resolved it, with what happened so far; and every scene shown, in order. */
    playable() {
      return PLAYABLE ? { on: true, level: PLAYABLE.level, endAfter: PLAYABLE.endAfter, brand: PLAYABLE.brand, fonts: PLAYABLE.fonts,
        attempts: playableAttempts, ended: playableEnded, results: playableResults.slice() } : { on: false };
    },
    scenes() { return sceneLog.slice(); },
    text() {
      const s = activeScene();
      const base = 'scene=' + state.scene + ' level=' + state.level + ' status=' + state.status +
        ' score=' + state.score + ' collected=' + state.collected + '/' + state.need +
        (state.moves != null ? ' moves=' + state.moves : '');
      return genre.describe && s && s.scene.key === 'Play' ? base + '\n' + genre.describe(s) : base;
    },
  };
  window.__TEST__ = TEST;
  let rngSeed = Number(params.get('seed')) || (QA ? 12345 : Date.now() % 2147483647);
  function rng() { rngSeed = (rngSeed * 16807) % 2147483647; return (rngSeed - 1) / 2147483646; }
  window.addEventListener('error', (e) => errors.push(String(e.message || e)));

  return {
    W, H, C, QA, params, palette, ORIENTATION, PORTRAIT, PLAYABLE, pageBackdrop, bus, state, progress, store, missing, errors, keys, genre, TEST, strings: STR,
    color, now, isReleased, chapters, nextDrop, countdown, chapterUnlocked, chapterOf, hasNewContent, markSeen,
    startCampaign, startChapter, next, go, levelWon, levelLost, bodyOf, outcome,
    saving: SAVING, hasSave, saveSummary, continueGame, resetSave, autosave, ledger, pauseLevel: pause, restartLevel, wrapPlay, startPlayable,
    queueAssets, ensureTextures, backdrop, tint, tintedKey, actor, animFrames, music, stopMusic, sfx, toggleMute, mute: setMuted,
    text, title, ink, panel, button, muteButton, banner, hud, speech, touchPad, INPUT_CANCEL, isTouch, isPhone,
    story, skin, fonts: FONTS, styles: Object.keys(STYLE_DEFAULTS), fontsReady,
    setGame(g) { game = g; },
    setState,
    rng,
    /* Normal-distributed noise (mean 0, sd 1) from the seeded rng: the casual autopilot's aim and timing error. */
    gauss: () => Math.sqrt(-2 * Math.log(1 - rng() * 0.999999)) * Math.cos(2 * Math.PI * rng()),
  };
})();
