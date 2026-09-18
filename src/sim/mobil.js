import { idmAccel } from './idm.js';

function accel(v, leader, s) {
  return leader
    ? idmAccel(v.eff, v.v, v.v0, s, v.v - leader.v)
    : idmAccel(v.eff, v.v, v.v0, Infinity, 0);
}

/**
 * MOBIL lane-change decision (SPEC §7.5). Returns the best neighbor lane or null.
 * Safety: the new follower must not be forced below -bSafe. Incentive weighs the
 * follower losses with politeness p (negative p = enjoys inconveniencing).
 */
export function evaluateLaneChange(world, v, eff, P) {
  const per = world.perception;
  const aOld = P.leader ? accel(v, P.leader.veh, P.leader.s) : accel(v, null, Infinity);
  // multispeed traffic (§7.6): how far this lane's limit is from the speed the driver actually wants
  const misOld = Math.abs(v.v0 - v.lane.speedLimit);
  let best = null,
    bestInc = eff.lcThreshold;

  for (const lane of v.lane.neighbors) {
    const L = per.leaderIn(lane, v);
    const F = per.followerIn(lane, v);
    const sL = L ? per.gap(v, L) : Infinity;
    const sF = F ? per.gap(v, F) : Infinity;
    if (sL < eff.s0 * 0.5 || sF < eff.s0 * 0.5) continue; // physically blocked
    if (L && L.state === 'wrecked' && sL < 15) continue; // don't change into a wreck

    const aSelfNew = accel(v, L, sL);

    let dNew = 0;
    if (F && F.state !== 'wrecked') {
      const FL = per.leaderIn(lane, F);
      const aFOld = FL ? accel(F, FL, per.gap(F, FL)) : accel(F, null, Infinity);
      const aFNew = accel(F, v, sF);
      if (aFNew < -eff.bSafe) continue; // safety criterion
      dNew = aFNew - aFOld;
    }

    let dOld = 0;
    if (P.follower && P.follower.veh.state !== 'wrecked') {
      const F0 = P.follower.veh;
      const aF0Old = accel(F0, v, P.follower.s);
      const aF0New = P.leader
        ? accel(F0, P.leader.veh, P.follower.s + v.length + P.leader.s)
        : accel(F0, null, Infinity);
      dOld = aF0New - aF0Old;
    }

    // speedSeek: drift toward the lane whose limit matches one's own pace (fast drivers left, slow ones right)
    const misNew = Math.abs(v.v0 - lane.speedLimit);
    const incentive =
      aSelfNew - aOld + eff.p * (dNew + dOld) + eff.speedSeek * (misOld - misNew) * 0.1;
    if (incentive > bestInc) {
      bestInc = incentive;
      best = lane;
    }
  }
  return best;
}
