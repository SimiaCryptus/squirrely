// Global tunables (SPEC §21). Kept as an ES module so browser and Node share it without loaders.
// Everything here is exposed in the settings menu (src/core/settings.js) except dt, maxSubsteps and hollowXs.
export const TUNING = {
  dt: 1 / 120,
  maxSubsteps: 6,
  DELTA: 4,

  xMin: -50, xMax: 50, spawnMargin: 60, visibleHalfWidth: 40,
  reactionRingSize: 128, jerkMax: 40,
  winterTraction: 0.45,                       // fraction of dry grip on a winter road (§13.4)

  wreckLifetime: 14, warmUpSeconds: 6, timeLimit: 45, lives: 3, maxLives: 5,

  playerRadius: 0.28, phantomLength: 0.55, phantomWidth: 0.45,
  hopTime: 0.18, lateralHopTime: 0.13, hopArc: 0.45, lateralHop: 2.5,
  inputBuffer: 0.12, hopCooldown: 0.04, dashTime: 0.26, dashCooldown: 1.6,
  standTime: 0.15, grace: 0.35, deathCam: 1.2, playerXLimit: 35,
  // stamina (§11.8): exertion drains it, rest refills it, acorns refill it fast; low stamina stretches the hop cooldown
  staminaHop: 0.07, staminaLateral: 0.05, staminaDash: 0.25, staminaTaunt: 0.05,
  staminaRegen: 0.2, staminaCrouchBoost: 2.0, staminaAcorn: 0.5, staminaCooldownMax: 0.6,

  nearMissRadius: 1.2, nearMissSpeed: 6, slowMoTime: 0.12, slowMoScale: 0.35, slowMoCap: 3,
  multDecay: 0.15, multCap: 5,
  // acorns & smoke bombs (§11.7): acorns are eaten on the spot, smoke bombs are carried and dropped
  itemSpawnMin: 3.5, itemSpawnMax: 7.0, itemMax: 4, itemLifetime: 18, itemXRange: 30, pickupRadius: 1.1,
  smokeChance: 0.2, mouthCapacity: 2, acornPoints: 150,
  smokeTime: 9, smokeRadius: 3.5, smokeSlow: 0.55, smokeDistract: 30,
  smokeStopRange: 35, smokeStopWidth: 2.5,   // a plume halts traffic approaching it within radius + width either side

  hollowXs: [-13.5, -4.5, 4.5, 13.5],
  camera: { fov: 42, pitchDeg: 55, followTime: 0.15, fog: 0.006 },
};