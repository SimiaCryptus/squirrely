/** Score + multiplier (SPEC §14). */
export class Scoring {
  constructor(tuning, score = 0) {
    this.t = tuning;
    this.score = score;
    this.multiplier = 1;
    this.tauntBoost = 0;
    this.lastGain = null;
  }
  add(n, label) {
    this.score += Math.round(n);
    this.lastGain = { n: Math.round(n), label };
  }
  step(dt, player, road) {
    if (this.tauntBoost > 0) {
      this.tauntBoost -= dt;
      if (this.tauntBoost <= 0) this.multiplier = Math.max(1, this.multiplier - 0.5);
    }
    const row = road.rowAt(player.z);
    const idle = player.state === 'idle' || player.crouched;
    if (row && row.safe && idle) {
      const rate = this.t.multDecay * (player.crouched ? 2 : 1);
      this.multiplier = Math.max(1, this.multiplier - rate * dt);
    }
  }
  advance() {
    this.add(10, 'row');
  }
  nearMiss() {
    this.add(25 * this.multiplier, 'whisker');
    this.multiplier = Math.min(this.t.multCap, this.multiplier + 0.2);
  }
  hollow(secondsRemaining) {
    this.add(200 + 5 * Math.max(0, Math.floor(secondsRemaining)), 'hollow');
  }
  complete() {
    this.add(1000, 'level');
  }
  /** An acorn eaten on the road (§11.7). Returns the points awarded. */
  eat(base) {
    const pts = Math.round(base * this.multiplier);
    this.add(pts, 'acorn');
    return pts;
  }
  chaos() {
    this.add(100, 'chaos');
  }
  taunt() {
    if (this.tauntBoost <= 0) this.multiplier = Math.min(this.t.multCap, this.multiplier + 0.5);
    this.tauntBoost = 5;
  }
  death() {
    this.multiplier = 1;
    this.tauntBoost = 0;
  }
  bankLives(n) {
    if (n > 0) this.add(250 * n, 'lives');
  }
}
