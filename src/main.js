// Bootstrap: settings → config → sim → render → loop (SPEC §4). This is the only file allowed to be impure and glue everything.
import { TUNING } from './data/tuning.js';
import { DRIVERS, DRIVER_RULES } from './data/drivers.js';
import { LEVELS, endlessLevel, customLevel } from './data/levels.js';
import { validateAll, validateLevel } from './core/config.js';
import { Settings, deepClone } from './core/settings.js';
import { EventBus } from './core/events.js';
import { createLoop } from './core/loop.js';
import { clamp } from './core/math.js';
import { BODY_TYPES } from './sim/vehicle.js';
import { createDriverRegistry } from './sim/drivers/index.js';
import { World } from './sim/world.js';
import { Renderer } from './render/renderer.js';
import { Input } from './ui/input.js';
import { Hud } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { SettingsMenu } from './ui/settingsMenu.js';
import { Sfx } from './audio/sfx.js';

const params = new URLSearchParams(location.search);
const BODIES = Object.keys(BODY_TYPES);

class Game {
  constructor() {
    validateAll(DRIVERS, LEVELS, TUNING, BODIES); // the shipped data must be sane before anything else
    this.settings = new Settings({
      tuning: TUNING,
      drivers: DRIVERS,
      storage: window.localStorage,
    });
    // effective config: rebuilt in place from the settings so renderer, HUD and world share one object
    this.tuning = deepClone(TUNING);
    this.profiles = deepClone(DRIVERS);
    this.graphics = this.settings.build('graphics');
    this.custom = null; // custom-game definition while a custom game runs
    const canvas = document.getElementById('game');
    this.renderer = new Renderer(canvas, this.tuning);
    this.hud = new Hud(DRIVERS, DRIVER_RULES, this.tuning);
    this.menus = new Menus();
    this.settingsBack = () => this.showTitle();
    this.settingsMenu = new SettingsMenu(this.settings, {
      onClose: () => {
        this.settingsMenu.hide();
        if (this.applySettings()) this.settingsBack();
      },
      onCustom: () => {
        this.settingsMenu.hide();
        this.startCustom();
      },
    });
    this.sfx = new Sfx();
    this.input = new Input(canvas, {
      onPause: () => this.togglePause(),
      onDebug: () => {
        this.hud.debug = !this.hud.debug;
      },
      onView: () => this.setFirstPerson(!this.graphics.firstPerson),
    });
    this.loop = createLoop({
      dt: TUNING.dt,
      maxSubsteps: TUNING.maxSubsteps,
      step: (dt) => this.step(dt),
      render: (alpha, ft) => this.render(alpha, ft),
    });
    this.world = null;
    this.levelIndex = 0;
    this.paused = false;
    this.lastPlayerState = 'idle';
    this.best = Number(localStorage.getItem('squirrely.best')) || 0;
    this.baseSeed = params.has('seed')
      ? Number(params.get('seed')) >>> 0
      : (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.world && !this.paused && this.world.status === 'playing')
        this.togglePause();
    });
    if (this.applySettings()) this.showTitle();
  }

  /** Rebuilds tuning / profiles / graphics from the settings. Shows an error menu and returns false if they are unusable. */
  applySettings() {
    const tuning = this.settings.build('tuning'),
      profiles = this.settings.build('drivers');
    try {
      validateAll(profiles, [], tuning, BODIES);
    } catch (e) {
      this.menus.show({
        title: 'Bad settings',
        lines: [e.message],
        buttons: [
          { label: 'Settings', onClick: () => this.showSettings(this.settingsBack) },
          {
            label: 'Reset all',
            onClick: () => {
              this.settings.reset();
              this.settings.save();
              if (this.applySettings()) this.settingsBack();
            },
          },
        ],
      });
      return false;
    }
    for (const k of Object.keys(this.tuning)) delete this.tuning[k];
    Object.assign(this.tuning, tuning);
    for (const k of Object.keys(this.profiles)) delete this.profiles[k];
    Object.assign(this.profiles, profiles);
    this.graphics = this.settings.build('graphics');
    this.renderer.applyGraphics(this.graphics);
    return true;
  }

  levelFor(index) {
    if (this.custom) return customLevel(this.custom, index + 1);
    return index < LEVELS.length ? LEVELS[index] : endlessLevel(index - LEVELS.length + 1);
  }

  showTitle() {
    this.custom = null;
    this.paused = false;
    this.world = null;
    const startAt = params.has('level')
      ? clamp(Number(params.get('level')) - 1, 0, LEVELS.length - 1)
      : 0;
    const lines = [...this.menus.intro];
    if (this.best > 0) lines.push(`Best score: <b>${this.best}</b>`);
    if (this.settings.modified) lines.push('<i>Custom settings are active.</i>');
    this.menus.show({
      title: 'Squirrely',
      lines,
      buttons: [
        { label: 'Start', onClick: () => this.start(startAt, {}) },
        {
          label: '1st‑Squirrel',
          onClick: () => {
            this.setFirstPerson(true);
            this.start(startAt, {});
          },
        },
        { label: 'Custom game', onClick: () => this.startCustom() },
        { label: 'Settings', onClick: () => this.showSettings(() => this.showTitle()) },
      ],
    });
  }

  showSettings(back) {
    this.settingsBack = back;
    this.menus.hide();
    this.settingsMenu.show();
  }

  startCustom() {
    if (!this.applySettings()) return;
    this.custom = this.settings.build('custom');
    this.start(0, {});
  }

  /** 1st-Squirrel view (§16.7); remembered as a setting. */
  setFirstPerson(on) {
    this.graphics.firstPerson = on;
    this.settings.set('graphics.firstPerson', on);
    this.settings.save();
    this.renderer.setFirstPerson(on);
  }

  start(index, carry) {
    this.sfx.unlock();
    const level = this.levelFor(index);
    try {
      if (level.endless || level.custom) validateLevel(level, this.profiles, index);
    } catch (e) {
      this.menus.show({
        title: 'Bad custom level',
        lines: [e.message],
        buttons: [
          { label: 'Settings', onClick: () => this.showSettings(() => this.showTitle()) },
          { label: 'Title', onClick: () => this.showTitle() },
        ],
      });
      return;
    }
    const events = new EventBus();
    const drivers = createDriverRegistry(this.profiles, level.modifiers);
    const seed = (this.baseSeed + Math.imul(index + 1, 0x9e3779b9)) >>> 0;
    this.world = new World({ level, drivers, tuning: this.tuning, seed, events, carry });
    this.levelIndex = index;
    this.renderer.setWorld(this.world);
    this.hud.bind(this.world, events, `${index + 1} · ${level.name}`);
    this.sfx.bind(events, this.world);
    events.on('level:complete', () => this.onComplete());
    events.on('game:over', () => this.onGameOver());
    events.on('crash', ({ x, z, severity }) => {
      const p = this.world.player,
        d2 = (x - p.x) ** 2 + (z - p.z) ** 2;
      const w = severity === 'wreck' ? 1 : 0.6;
      this.renderer.shake(clamp((w * 60) / (d2 + 40), 0, 0.8));
    });
    events.on('player:death', () => this.renderer.shake(0.5));
    this.menus.hide();
    this.paused = false;
    this.input.reset();
    this.loop.start();
  }

  step(dt) {
    if (!this.world || this.paused) return;
    this.world.step(dt, this.input.sample());
  }

  render(alpha, frameTime) {
    const w = this.world;
    if (!w) return;
    const tn = this.tuning;
    this.loop.setTimeScale(this.paused ? 0 : w.slowMoTimer > 0 ? tn.slowMoScale : 1);
    this.renderer.render(w, alpha, frameTime);
    this.hud.update(w, frameTime);
    const st = w.player.state;
    if (st !== this.lastPlayerState) {
      if (st === 'hopping') {
        if (w.player.dur === tn.dashTime) this.sfx.dash();
        else this.sfx.hop();
      }
      this.lastPlayerState = st;
    }
  }

  togglePause() {
    const w = this.world;
    if (!w || w.status !== 'playing' || this.settingsMenu.visible) return;
    this.paused = !this.paused;
    if (!this.paused) {
      this.menus.hide();
      return;
    }
    this.showPauseMenu();
  }

  showPauseMenu() {
    const dossier = Object.keys(DRIVERS).map((id) => {
      const p = DRIVERS[id];
      return `<b style="color:#${p.colorHex.toString(16).padStart(6, '0')}">${p.icon} ${p.label}</b> — ${DRIVER_RULES[id]}`;
    });
    this.menus.show({
      title: 'Paused',
      lines: dossier,
      buttons: [
        { label: 'Resume', onClick: () => this.togglePause() },
        { label: 'Settings', onClick: () => this.showSettings(() => this.showPauseMenu()) },
        { label: 'Quit to title', onClick: () => this.showTitle() },
      ],
    });
  }

  saveBest(score) {
    if (score > this.best) {
      this.best = score;
      localStorage.setItem('squirrely.best', String(score));
    }
  }

  onComplete() {
    const w = this.world,
      next = this.levelIndex + 1,
      score = w.scoring.score;
    let lives = w.lives;
    if (next % 2 === 0) lives = Math.min(this.tuning.maxLives, lives + 1); // +1 life every 2 levels (§13.1)
    this.saveBest(score);
    const nl = this.levelFor(next);
    this.menus.show({
      title: 'Crossing complete!',
      lines: [`Score <b>${score}</b> · Lives ${'🐿️'.repeat(lives)}`, `Next: <b>${nl.name}</b>`],
      buttons: [{ label: 'Next level', onClick: () => this.start(next, { score, lives }) }],
    });
  }

  onGameOver() {
    const score = this.world.scoring.score;
    this.saveBest(score);
    this.menus.show({
      title: 'Squashed.',
      lines: [
        `Score <b>${score}</b> · Best <b>${this.best}</b>`,
        `Reached level ${this.levelIndex + 1}: ${this.world.level.name}`,
      ],
      buttons: [
        { label: 'Retry level', onClick: () => this.start(this.levelIndex, {}) },
        { label: 'Title', onClick: () => this.showTitle() },
      ],
    });
  }
}

new Game();
