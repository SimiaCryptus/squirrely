/**
 * Acorns & smoke bombs (SPEC §11.7). Pure sim: items lie on lane rows on the squirrel's 2.5 m lateral grid, one in
 * five is a smoke bomb. Acorns are eaten the moment the squirrel stands on them (points + stamina, §11.8); smoke
 * bombs are carried (up to `mouthCapacity`) and dropped, where they light into a plume that occludes sight lines,
 * halts the traffic approaching it and slows the gawkers in the other lanes.
 */
export class Items {
  constructor(world, rng) {
    this.world = world;
    this.rng = rng;
    this.list = []; // { id, kind: 'acorn' | 'smoke', x, z, row, timer }
    this.smokes = []; // { x, z, timer, total }
    this.nextId = 1;
    const tn = world.tuning;
    this.timer = rng.range(tn.itemSpawnMin, tn.itemSpawnMax);
  }

  step(dt) {
    const w = this.world,
      tn = w.tuning,
      p = w.player;
    let k = 0;
    for (const it of this.list) {
      it.timer -= dt;
      if (it.timer > 0) this.list[k++] = it;
      else w.events.emit('item:expire', { item: it });
    }
    this.list.length = k;
    k = 0;
    for (const s of this.smokes) {
      s.timer -= dt;
      if (s.timer > 0) this.smokes[k++] = s;
    }
    this.smokes.length = k;

    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = this.rng.range(tn.itemSpawnMin, tn.itemSpawnMax);
      if (this.list.length < tn.itemMax) this.spawn();
    }

    // pickup: standing (not mid-hop) on top of an item. Acorns go straight down the hatch; smoke bombs need a free mouth slot.
    if (!w.warm && w.status === 'playing' && p.alive && !p.hopping) {
      for (let i = 0; i < this.list.length; i++) {
        const it = this.list[i];
        if (Math.abs(it.x - p.x) >= tn.pickupRadius || Math.abs(it.z - p.z) >= tn.pickupRadius)
          continue;
        if (it.kind === 'smoke' && p.mouth.length >= tn.mouthCapacity) continue;
        this.list.splice(i, 1);
        let points = 0;
        if (it.kind === 'acorn') {
          p.eat(tn.staminaAcorn);
          points = w.scoring.eat(tn.acornPoints);
        } else p.mouth.push('smoke');
        w.events.emit('item:pickup', {
          kind: it.kind,
          x: it.x,
          z: it.z,
          held: p.mouth.length,
          points,
        });
        break;
      }
    }
  }

  spawn() {
    const w = this.world,
      tn = w.tuning,
      lanes = w.road.lanes;
    if (!lanes.length) return;
    const lane = this.rng.pick(lanes);
    const n = Math.floor(tn.itemXRange / tn.lateralHop);
    const x = (this.rng.int(2 * n + 1) - n) * tn.lateralHop; // on the squirrel's lateral grid
    const kind = this.rng() < tn.smokeChance ? 'smoke' : 'acorn';
    for (const it of this.list)
      if (Math.abs(it.x - x) < 1 && Math.abs(it.z - lane.zCenter) < 1) return;
    const it = {
      id: this.nextId++,
      kind,
      x,
      z: lane.zCenter,
      row: lane.row.index,
      timer: tn.itemLifetime,
    };
    this.list.push(it);
    w.events.emit('item:spawn', { item: it });
  }

  /** Player drop intent: light the smoke bomb in the mouth (nothing else is ever carried). */
  drop() {
    const w = this.world,
      p = w.player,
      tn = w.tuning;
    if (w.status !== 'playing' || !p.alive || p.hopping || !p.mouth.length) return false;
    p.mouth.pop();
    this.smokes.push({ x: p.x, z: p.z, timer: tn.smokeTime, total: tn.smokeTime });
    w.events.emit('smoke:lit', { x: p.x, z: p.z });
    return true;
  }
}
