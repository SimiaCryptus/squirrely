import { deg2rad, lerp, lerpAngle } from '../core/math.js';

/**
 * Two camera modes (SPEC §16.1). 'top' frames the whole road along Z with a damped follow on X.
 * 'first' is the 1st-Squirrel view: eye height, interpolated hop, damped yaw toward the facing direction,
 * lower when crouched, on the tarmac when squashed. Both modes shake.
 */
export class CameraRig {
  constructor(camera, tuning) {
    this.camera = camera;
    this.tuning = tuning;
    this.mode = 'top';
    this.camX = 0;
    this.h = 30;
    this.d = 20;
    this.lookZ = -10;
    this.yaw = 0;
    this.eye = 0.4;
    this.shakeT = 0;
    this.shakeA = 0;
    this.shakeEnabled = true;
    this.sx = 0;
    this.sy = 0;
  }

  get cfg() {
    return this.tuning.camera;
  }

  setup(road) {
    const th = deg2rad(this.cfg.pitchDeg),
      ph = deg2rad(this.cfg.fov / 2);
    const K = 1 / Math.tan(th - ph) - 1 / Math.tan(th + ph);
    const D = (road.depth + 10) / (Math.sin(th) * K);
    this.h = D * Math.sin(th);
    this.d = D * Math.cos(th);
    this.lookZ = road.zMax + 5 - this.d + this.h / Math.tan(th + ph);
  }

  snap(x, facing = 0) {
    this.camX = x;
    this.yaw = facing;
  }

  shake(amount) {
    if (!this.shakeEnabled) return;
    this.shakeA = Math.min(1, this.shakeA + amount);
    this.shakeT = 0.4;
  }

  /** Advances the shake and leaves the current offset in (sx, sy). */
  shakeStep(dt) {
    this.sx = this.sy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = this.shakeA * (this.shakeT / 0.4);
      this.sx = (Math.random() - 0.5) * k * 1.2;
      this.sy = (Math.random() - 0.5) * k * 0.8;
    } else this.shakeA = 0;
  }

  update(player, alpha, dt) {
    this.shakeStep(dt);
    if (this.mode === 'first') return this.updateFirst(player, alpha, dt);
    this.camX += (player.x - this.camX) * (1 - Math.exp(-dt / this.cfg.followTime));
    this.camera.position.set(this.camX + this.sx, this.h + this.sy, this.lookZ + this.d);
    this.camera.lookAt(this.camX, 0, this.lookZ);
  }

  updateFirst(p, alpha, dt) {
    const x = lerp(p.prevX, p.x, alpha),
      z = lerp(p.prevZ, p.z, alpha),
      y = lerp(p.prevY, p.y, alpha);
    const k = 1 - Math.exp(-dt / 0.07);
    this.yaw = lerpAngle(this.yaw, p.facing, k);
    const squashed = p.state === 'squashed';
    const eyeH = squashed ? 0.06 : p.crouched ? 0.2 : 0.4;
    this.eye += (eyeH - this.eye) * k;
    const fx = -Math.sin(this.yaw),
      fz = -Math.cos(this.yaw); // the squirrel model faces -Z at facing = 0
    this.camX = x;
    this.lookZ = z; // keeps the sun rig centred on the squirrel
    this.camera.position.set(x - fx * 0.12 + this.sx, y + this.eye + this.sy, z - fz * 0.12);
    this.camera.lookAt(x + fx * 6, y + this.eye + (squashed ? 1.5 : -0.9), z + fz * 6);
  }
}
