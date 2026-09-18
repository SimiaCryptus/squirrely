// Settings model (SPEC §17.4). Pure: defaults in, a flat `path → value` override map out.
// Persistence goes through an injected storage so Node tests can run it without a DOM.
import { PROFILE_NUMBERS } from './config.js';

export const GRAPHICS_DEFAULTS = {
  firstPerson: false,
  fpFov: 80,
  shadows: true,
  pixelRatio: 2,
  shake: true,
};

/** Custom game (§13.5): a symmetric road built from these numbers, see data/levels.js customLevel(). */
export const CUSTOM_DEFAULTS = {
  lanesEach: 3,
  baseSpeed: 14,
  speedStep: 2,
  density: 24,
  densityRamp: 2,
  timeLimit: 45,
  platoonChance: 0.3,
  median: true,
  shoulders: false,
  night: false,
  rain: false,
  winter: false,
  rushHour: false,
  mix: { white: 0.3, purple: 0.2, yellow: 0.15, green: 0.15, blue: 0.1, red: 0.1 },
};

/** All config data is JSON-safe (numbers, strings, booleans, arrays, plain objects). */
export function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

export function getPath(obj, path) {
  let cur = obj;
  for (const k of path.split('.')) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return cur;
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof cur[keys[i]] !== 'object' || cur[keys[i]] === null) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

const num = (path, label, min, max, step, hint) => ({
  path,
  label,
  type: 'number',
  min,
  max,
  step,
  hint,
});
const bool = (path, label, hint) => ({ path, label, type: 'boolean', hint });
const SIGNED = new Set(['p', 'playerGain']); // driver numbers that are meaningful on both sides of zero

/** Range heuristic for numbers that only exist as a default (driver profile numbers). */
function autoRange(key, def) {
  const a = Math.abs(def);
  if (a === 0) return { min: -10, max: 10, step: 0.05 };
  const mag = Math.pow(10, Math.floor(Math.log10(a)));
  const signed = def < 0 || SIGNED.has(key);
  return { min: signed ? -a * 4 : 0, max: a * 4, step: mag / 10 };
}

/** Groups of fields; every path resolves against { tuning, drivers, graphics, custom }. */
export function buildSchema(tuning, drivers) {
  const T = (k, label, min, max, step, hint) => num(`tuning.${k}`, label, min, max, step, hint);
  const groups = [
    {
      id: 'rules',
      title: 'Rules & scoring',
      fields: [
        T('lives', 'Starting lives', 1, 9, 1),
        T('maxLives', 'Life cap', 1, 12, 1),
        T('timeLimit', 'Default time per crossing (s)', 10, 300, 5),
        T('wreckLifetime', 'Wreck lifetime (s)', 2, 60, 1),
        T('nearMissRadius', 'Near-miss radius (m)', 0.3, 3, 0.1),
        T('nearMissSpeed', 'Near-miss min speed (m/s)', 0, 20, 0.5),
        T('slowMoTime', 'Near-miss slow-mo (s)', 0, 1, 0.02),
        T('slowMoScale', 'Slow-mo time scale', 0.05, 1, 0.05),
        T('slowMoCap', 'Slow-mos per crossing', 0, 10, 1),
        T('multDecay', 'Multiplier decay / s', 0, 1, 0.01),
        T('multCap', 'Multiplier cap', 1, 20, 0.5),
        T('acornPoints', 'Acorn points (× multiplier)', 0, 1000, 10),
        T('mouthCapacity', 'Smoke bombs carried', 0, 6, 1),
      ],
    },
    {
      id: 'squirrel',
      title: 'Squirrel & stamina',
      fields: [
        T('hopTime', 'Hop time (s)', 0.05, 0.6, 0.01),
        T('lateralHopTime', 'Side-hop time (s)', 0.05, 0.6, 0.01),
        T('hopArc', 'Hop height (m)', 0, 2, 0.05),
        T('lateralHop', 'Side-hop distance (m)', 0.5, 5, 0.1),
        T('dashTime', 'Dash time (s)', 0.1, 1, 0.01),
        T('dashCooldown', 'Dash cooldown (s)', 0, 5, 0.1),
        T('hopCooldown', 'Hop cooldown, fresh legs (s)', 0, 1, 0.01),
        T('inputBuffer', 'Input buffer (s)', 0, 0.5, 0.01),
        T('grace', 'Landing grace (s)', 0, 1, 0.05),
        T('playerRadius', 'Squirrel hit radius (m)', 0.05, 1, 0.01),
        T('playerXLimit', 'Lateral travel limit (m)', 5, 50, 1),
        T('staminaHop', 'Stamina per hop', 0, 0.5, 0.01),
        T('staminaLateral', 'Stamina per side-hop', 0, 0.5, 0.01),
        T('staminaDash', 'Stamina per dash', 0, 1, 0.05),
        T('staminaTaunt', 'Stamina per taunt', 0, 0.5, 0.01),
        T('staminaRegen', 'Stamina regen / s (resting)', 0, 2, 0.05),
        T('staminaCrouchBoost', 'Crouch regen multiplier', 1, 5, 0.1),
        T('staminaAcorn', 'Stamina per acorn', 0, 1, 0.05),
        T('staminaCooldownMax', 'Extra hop cooldown when exhausted (s)', 0, 2, 0.05),
      ],
    },
    {
      id: 'physics',
      title: 'Traffic physics',
      fields: [
        T('DELTA', 'IDM acceleration exponent', 1, 8, 0.5),
        T('jerkMax', 'Jerk limit (m/s³)', 5, 200, 5),
        T('warmUpSeconds', 'Traffic warm-up (s)', 0, 30, 1),
        T('spawnMargin', 'Spawn distance beyond the edge (m)', 10, 150, 5),
        T('winterTraction', 'Winter traction (1 = dry)', 0.1, 1, 0.05),
        T('phantomLength', 'Squirrel phantom length (m)', 0.1, 2, 0.05),
        T('phantomWidth', 'Squirrel phantom width (m)', 0.1, 2, 0.05),
      ],
    },
    {
      id: 'items',
      title: 'Acorns & smoke',
      fields: [
        T('itemSpawnMin', 'Item spawn interval min (s)', 0.5, 30, 0.5),
        T('itemSpawnMax', 'Item spawn interval max (s)', 0.5, 60, 0.5),
        T('itemMax', 'Items on the road', 0, 16, 1),
        T('itemLifetime', 'Item lifetime (s)', 3, 60, 1),
        T('smokeChance', 'Smoke bomb share', 0, 1, 0.05),
        T('smokeTime', 'Smoke duration (s)', 1, 30, 0.5),
        T('smokeRadius', 'Smoke radius (m)', 1, 8, 0.25),
        T('smokeStopRange', 'Smoke: traffic stops from (m)', 0, 80, 1),
        T('smokeStopWidth', 'Smoke: blocked width beyond the plume (m)', 0, 8, 0.5),
        T('smokeSlow', 'Gawking speed factor', 0.1, 1, 0.05),
        T('smokeDistract', 'Gawking range (m)', 0, 80, 1),
      ],
    },
    {
      id: 'graphics',
      title: 'Graphics & camera',
      fields: [
        bool('graphics.firstPerson', '1st-Squirrel view (V toggles in game)'),
        num('graphics.fpFov', '1st-Squirrel field of view (°)', 40, 120, 1),
        bool('graphics.shadows', 'Shadows'),
        num('graphics.pixelRatio', 'Max pixel ratio', 0.5, 3, 0.25),
        bool('graphics.shake', 'Screen shake'),
        T('camera.fov', 'Top-down field of view (°)', 20, 90, 1),
        T('camera.pitchDeg', 'Camera pitch (°)', 30, 85, 1),
        T('camera.followTime', 'Camera follow time (s)', 0.02, 1, 0.01),
        T('camera.fog', 'Fog density', 0, 0.03, 0.001),
      ],
    },
    {
      id: 'custom',
      title: 'Custom game',
      fields: [
        num('custom.lanesEach', 'Lanes per direction', 1, 6, 1),
        num('custom.baseSpeed', 'Slow-lane limit (m/s)', 6, 40, 1),
        num('custom.speedStep', 'Limit step per lane (m/s)', 0, 6, 0.5),
        num('custom.density', 'Traffic density', 4, 80, 1),
        num('custom.densityRamp', 'Density ramp per crossing (%)', 0, 20, 1),
        num('custom.timeLimit', 'Time per crossing (s)', 10, 300, 5),
        num('custom.platoonChance', 'Platoon chance', 0, 1, 0.05),
        bool('custom.median', 'Median (off = curb)'),
        bool('custom.shoulders', 'Shoulders'),
        bool('custom.night', 'Night'),
        bool('custom.rain', 'Rain'),
        bool('custom.winter', 'Winter (ice)'),
        bool('custom.rushHour', 'Rush hour'),
        ...Object.keys(drivers).map((id) =>
          num(`custom.mix.${id}`, `${drivers[id].label} share`, 0, 1, 0.05)
        ),
      ],
    },
  ];
  for (const id in drivers) {
    const p = drivers[id];
    const fields = PROFILE_NUMBERS.map((k) => {
      const r = autoRange(k, p[k]);
      return num(`drivers.${id}.${k}`, k, r.min, r.max, r.step);
    });
    for (const k in p.extras) {
      const r = autoRange(k, p.extras[k]);
      fields.push(num(`drivers.${id}.extras.${k}`, `extras.${k}`, r.min, r.max, r.step));
    }
    groups.push({
      id: `driver-${id}`,
      title: `${p.icon} ${p.label} (${id})`,
      colorHex: p.colorHex,
      fields,
    });
  }
  return groups;
}

export class Settings {
  constructor({ tuning, drivers, storage = null, key = 'squirrely.settings' }) {
    this.defaults = { tuning, drivers, graphics: GRAPHICS_DEFAULTS, custom: CUSTOM_DEFAULTS };
    this.schema = buildSchema(tuning, drivers);
    this.storage = storage;
    this.key = key;
    this.overrides = {};
    this.load();
  }

  default(path) {
    return getPath(this.defaults, path);
  }
  get(path) {
    return path in this.overrides ? this.overrides[path] : this.default(path);
  }
  isOverridden(path) {
    return path in this.overrides;
  }
  get modified() {
    return Object.keys(this.overrides).length > 0;
  }

  set(path, value) {
    if (value === this.default(path)) delete this.overrides[path];
    else this.overrides[path] = value;
  }

  /** Reset the given fields, or everything. */
  reset(fields) {
    if (!fields) {
      this.overrides = {};
      return;
    }
    for (const f of fields) delete this.overrides[f.path];
  }

  /** Deep copy of a defaults branch ('tuning' | 'drivers' | 'graphics' | 'custom') with overrides applied. */
  build(root) {
    const out = deepClone(this.defaults[root]);
    const prefix = `${root}.`;
    for (const k in this.overrides)
      if (k.startsWith(prefix)) setPath(out, k.slice(prefix.length), this.overrides[k]);
    return out;
  }

  load() {
    try {
      const raw = this.storage?.getItem(this.key);
      const parsed = raw ? JSON.parse(raw) : null;
      this.overrides = parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      this.overrides = {};
    }
  }

  save() {
    try {
      this.storage?.setItem(this.key, JSON.stringify(this.overrides));
    } catch {
      /* storage unavailable */
    }
  }
}
