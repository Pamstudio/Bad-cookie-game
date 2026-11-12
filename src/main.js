(function () {
  'use strict';
  document.title = GK.C.title || document.title;
  const config = {
    type: GK.params.get('renderer') === 'canvas' ? Phaser.CANVAS : Phaser.AUTO,
    parent: 'game',
    width: GK.W,
    height: GK.H,
    backgroundColor: GK.palette.bg,
    pixelArt: false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    input: { activePointers: 3 },
    /* Overlays (pause, collection) come after Play so they draw over it; wrapPlay adds the save hooks. */
    scene: GK.scenes.concat(GK.playScene ? [GK.wrapPlay(GK.playScene)] : [], GK.overlays || []),
  };
  /* Playable mode never creates an AudioContext of its own: no sound at all (no context, no audio files), or the
     context the ad shell hands over in window.__GK_PLAYABLE__.audioContext. Outside it the key stays off the config. */
  if (GK.PLAYABLE) config.audio = GK.PLAYABLE.audioContext ? { context: GK.PLAYABLE.audioContext } : { noAudio: true };
  const game = new Phaser.Game(config);
  GK.setGame(game);
  /* A host's context is the host's to suspend and resume. Phaser suspends its context on blur, resumes it on focus and
     on every frame after (its update calls onFocus), and suspends then resumes it 100 ms after the tab shows again. */
  if (GK.PLAYABLE && GK.PLAYABLE.audioContext && game.sound && game.sound.context) {
    const sound = game.sound;
    sound.pauseOnBlur = false;
    game.events.off(Phaser.Core.Events.VISIBLE, sound.onGameVisible, sound);
    sound.onBlur = sound.onFocus = sound.onGameVisible = () => {};
  }

  /* One whole-game freeze, shared by the turn-your-phone prompt and the ad shell (GK.pause / GK.resume): every scene,
     timer, tween, sound and cutscene video stops, so nothing advances unseen (a win banner moving on to the next level,
     a video ending into gameplay). The game runs again once every holder has let go.
     The hold is scene-level: each running scene is paused, so Phaser itself gives it no update, timer, pointer or key
     (paused scenes take no input). A scene that would start while held (a level whose art finishes loading during the
     hold) is created only on release, so its music and the playable start event wait too. */
  const holds = new Set();
  const paused = new Set(); // scenes this hold paused, and only those resume
  const pending = new Set(); // scenes whose create() waits for the release
  let videos = [];
  /* GK.frozen tells the story scene a video was paused on purpose: a play() still pending when it froze rejects, and
     that must not count as blocked autoplay (no muted retry, no advancing); release plays it again as it was. */
  GK.frozen = false;
  const scenes = game.scene;
  const create = scenes.create;
  const pauseScene = (s) => { if (s.sys.isActive()) { s.sys.pause(); paused.add(s); } };
  scenes.create = function (scene) {
    if (GK.frozen) { pending.add(scene); return; }
    create.apply(this, arguments);
    /* A host that pauses from inside create (on the start event) still gets a paused scene. */
    if (GK.frozen) pauseScene(scene);
  };
  /* A press the scenes saw lets go when the hold starts: each scene's input drops any built-in drag of that pointer
     without a drop or dragend, then emits GK.INPUT_CANCEL, so a held control, stick or dragged piece lets go without a
     tap, swipe or line advancing. A pointer still down at the release (held through the hold, or pressed during it)
     stays unseen until it lifts: its moves and its lift never reach a scene. */
  const stale = new Set();
  const letGo = (input, pointer) => {
    const stopped = ((input._drag && input._drag[pointer.id]) || []).splice(0);
    stopped.forEach((o) => { if (o.input) { o.input.dragState = 0; o.input.target = null; o.input.dragStartCamera = null; } });
    input.setDragState(pointer, 0);
    input.emit(GK.INPUT_CANCEL, pointer, stopped);
  };
  const down = () => game.input.pointers.filter((p) => p.isDown);
  const dispatch = game.input.updateInputPlugins;
  game.input.updateInputPlugins = function (type, pointers) {
    const live = stale.size ? pointers.filter((p) => !stale.has(p.id)) : pointers;
    pointers.forEach((p) => { if (!p.isDown) stale.delete(p.id); });
    if (live.length) dispatch.call(this, type, live);
  };
  function hold(reason) {
    if (holds.has(reason)) return;
    holds.add(reason);
    GK.frozen = true;
    if (holds.size > 1) return;
    game.pause();
    const all = scenes.getScenes(false);
    down().forEach((p) => all.forEach((s) => { if (s.sys.input) letGo(s.sys.input, p); }));
    all.forEach(pauseScene);
    /* A phone already held the wrong way freezes the game before it boots, when it has no sound manager yet. */
    if (game.sound) game.sound.pauseAll();
    videos = Array.from(document.querySelectorAll('video.gk-video')).filter((v) => !v.paused);
    videos.forEach((v) => v.pause());
  }
  function release(reason) {
    if (!holds.delete(reason) || holds.size) return;
    GK.frozen = false;
    /* Resizing is no user gesture, so a browser may refuse sound now: play muted rather than stay stuck. */
    videos.forEach((v) => v.play().catch(() => { if (GK.frozen) return; v.muted = true; v.play().catch(() => {}); }));
    videos = [];
    if (game.sound) game.sound.resumeAll();
    /* Timers must not jump by the time spent frozen. */
    game.loop.resetDelta();
    game.resume();
    down().forEach((p) => stale.add(p.id));
    /* Phaser keeps key events until the next frame, which a paused game never reaches: keys pressed while held would
       replay into the scenes on the first key after the release. */
    if (game.input.keyboard) game.input.keyboard.queue = [];
    paused.forEach((s) => { if (s.sys.isPaused()) s.sys.resume(); });
    paused.clear();
    /* Only a scene still in INIT..LOADING is created (one the engine stopped or restarted meanwhile is skipped). */
    const waiting = Array.from(pending);
    pending.clear();
    waiting.forEach((s) => {
      const st = s.sys.settings.status;
      if (st > Phaser.Scenes.PENDING && st < Phaser.Scenes.CREATING) scenes.create(s);
    });
  }
  GK.pause = () => { hold('host'); return true; };
  GK.resume = () => { release('host'); return true; };

  /* Phones held the wrong way get a turn-your-phone prompt; the game freezes behind it, and a level in progress also
     opens its pause menu. Playable mode has none: the ad shell owns orientation and pausing. */
  if (GK.isPhone() && !GK.PLAYABLE) {
    const el = document.createElement('div');
    el.id = 'gk-rotate';
    const icon = document.createElement('div');
    icon.style.fontSize = '64px';
    icon.textContent = '\u27F3';
    const label = document.createElement('div');
    label.textContent = GK.strings.rotate;
    el.append(icon, label);
    document.body.appendChild(el);
    let sideways = false;
    const freeze = () => {
      sideways = true;
      GK.pauseLevel();
      hold('rotate');
    };
    const thaw = () => {
      sideways = false;
      release('rotate');
    };
    const check = () => {
      const wrong = (window.innerWidth > window.innerHeight) === GK.PORTRAIT;
      if (wrong && !sideways) freeze();
      else if (!wrong && sideways) thaw();
      el.style.display = wrong ? 'flex' : 'none';
    };
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    check();
  }
  window.__GAME__ = game;
})();
