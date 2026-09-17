import * as THREE from 'three';
import { CameraRig } from './cameraRig.js';
import { RoadView } from './roadView.js';
import { VehicleView } from './vehicleView.js';
import { PlayerView } from './playerView.js';
import { ItemView } from './itemView.js';
import { GRAPHICS_DEFAULTS } from '../core/settings.js';

const SKY = { day: 0x9dbcd9, night: 0x0a0d14, rain: 0x5b6470, winter: 0xcbd5e0 };

/** three.js setup, lighting, resize, graphics settings; owns the road/vehicle/player views (SPEC §16). */
export class Renderer {
  constructor(canvas, tuning) {
    this.tuning = tuning;
    this.graphics = { ...GRAPHICS_DEFAULTS };
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY.day);
    this.scene.fog = new THREE.FogExp2(SKY.day, tuning.camera.fog);

    this.camera = new THREE.PerspectiveCamera(tuning.camera.fov, 1, 0.5, 500);
    this.rig = new CameraRig(this.camera, tuning);

    this.hemi = new THREE.HemisphereLight(0xdfefff, 0x4a5a3a, 0.7);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 0.95);      // toned down so white bodies keep their shading
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -50; sc.right = 50; sc.top = 35; sc.bottom = -35; sc.near = 1; sc.far = 160;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.vehicles = new VehicleView(this.scene);
    this.player = new PlayerView(this.scene);
    this.items = new ItemView(this.scene);
    this.roadView = null; this.world = null;
    this.time = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Graphics settings (§17.4): shadows, resolution, shake, camera mode. Safe to call at any time. */
  applyGraphics(g) {
    this.graphics = g;
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, g.pixelRatio));
    if (this.gl.shadowMap.enabled !== !!g.shadows) {
      this.gl.shadowMap.enabled = !!g.shadows;
      this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    }
    this.rig.shakeEnabled = !!g.shake;
    if (this.world) this.rig.setup(this.world.road);
    this.setFirstPerson(!!g.firstPerson);
  }

  /** 1st-Squirrel view (§16.7): first-person rig, wide lens, close near plane, and no squirrel in shot. */
  setFirstPerson(on) {
    this.graphics.firstPerson = on;
    this.rig.mode = on ? 'first' : 'top';
    this.camera.fov = on ? this.graphics.fpFov : this.tuning.camera.fov;
    this.camera.near = on ? 0.05 : 0.5;
    this.camera.updateProjectionMatrix();
    this.player.hidden = on;
    if (this.world) this.rig.snap(this.world.player.x, this.world.player.facing);
  }

  setWorld(world) {
    this.world = world;
    const mods = world.modifiers;
    if (this.roadView) this.roadView.dispose(this.scene);
    this.roadView = new RoadView(this.scene, world.road, this.tuning, mods);
    this.rig.setup(world.road);
    this.rig.snap(world.player.x, world.player.facing);

    const sky = mods.night ? SKY.night : mods.winter ? SKY.winter : mods.rain ? SKY.rain : SKY.day;
    this.scene.background.setHex(sky);
    this.scene.fog.color.setHex(sky);
    this.scene.fog.density = this.tuning.camera.fog * (mods.rain ? 1.8 : mods.winter ? 1.3 : 1);
    this.hemi.intensity = mods.night ? 0.22 : mods.rain ? 0.55 : mods.winter ? 0.85 : 0.7;
    this.sun.intensity = mods.night ? 0.25 : mods.rain ? 0.5 : mods.winter ? 0.7 : 0.95;
    this.sun.color.setHex(mods.night ? 0x8fa8ff : mods.winter ? 0xe6eeff : 0xfff1d6);
    this.vehicles.night = !!mods.night;
  }

  shake(amount) { this.rig.shake(amount); }

  render(world, alpha, dt) {
    this.time += dt;
    this.rig.update(world.player, alpha, dt);
    const cx = this.rig.camX, lz = this.rig.lookZ;
    this.sun.position.set(cx + 25, 45, lz + 15);
    this.sun.target.position.set(cx, 0, lz);
    if (this.roadView) this.roadView.update(world);
    this.vehicles.update(world, alpha, this.time);
    this.items.update(world, this.time);
    this.player.update(world.player, alpha, this.time);
    this.gl.render(this.scene, this.camera);
  }
}