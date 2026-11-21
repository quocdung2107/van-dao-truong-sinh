import {
  Scene, Vector3, Color3, MeshBuilder, StandardMaterial, DynamicTexture, Mesh,
} from '@babylonjs/core';

// Hiệu ứng đơn giản bằng primitives: số sát thương bay, vòng kỹ năng, đạn bay, sét thiên kiếp.

interface FloatText { mesh: Mesh; tex: DynamicTexture; t: number; life: number; active: boolean }
interface Ring { mesh: Mesh; t: number; dur: number; maxR: number }
interface Projectile { mesh: Mesh; from: Vector3; to: Vector3; t: number; dur: number; onArrive: () => void }
interface Bolt { mesh: Mesh; t: number; life: number }

const FLOAT_POOL = 20;

export class Fx {
  private scene: Scene;
  private floats: FloatText[] = [];
  private rings: Ring[] = [];
  private projectiles: Projectile[] = [];
  private bolts: Bolt[] = [];
  private floatIdx = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    for (let i = 0; i < FLOAT_POOL; i++) {
      const tex = new DynamicTexture(`floatTex${i}`, { width: 256, height: 80 }, scene, false);
      tex.hasAlpha = true;
      const mesh = MeshBuilder.CreatePlane(`float${i}`, { width: 1.9, height: 0.6 }, scene);
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
      const m = new StandardMaterial(`floatMat${i}`, scene);
      m.diffuseTexture = tex; m.emissiveTexture = tex; m.disableLighting = true; m.backFaceCulling = false;
      m.useAlphaFromDiffuseTexture = true;
      mesh.material = m;
      mesh.isVisible = false;
      this.floats.push({ mesh, tex, t: 0, life: 0.95, active: false });
    }
  }

  spawnDamage(pos: Vector3, amount: number, crit: boolean) {
    const f = this.floats[this.floatIdx];
    this.floatIdx = (this.floatIdx + 1) % FLOAT_POOL;
    const ctx = f.tex.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 256, 80);
    ctx.font = crit ? 'bold 52px sans-serif' : 'bold 38px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    const label = crit ? `${Math.round(amount)} BẠO!` : `${Math.round(amount)}`;
    ctx.strokeText(label, 128, 54);
    ctx.fillStyle = crit ? '#ffd23d' : '#ffffff';
    ctx.fillText(label, 128, 54);
    f.tex.update();
    f.mesh.position.copyFrom(pos).addInPlace(new Vector3((Math.random() - 0.5) * 0.7, 2.6, 0));
    f.mesh.isVisible = true;
    f.t = 0; f.active = true;
  }

  spawnRing(pos: Vector3, rgb: [number, number, number], maxR: number, dur = 0.45) {
    const mesh = MeshBuilder.CreateTorus(`fxRing${Date.now()}_${Math.random()}`, { diameter: 0.4, thickness: 0.09, tessellation: 36 }, this.scene);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.copyFrom(pos).addInPlace(new Vector3(0, 0.35, 0));
    const m = new StandardMaterial(`fxRingMat${Math.random()}`, this.scene);
    m.diffuseColor = new Color3(...rgb); m.emissiveColor = new Color3(rgb[0] * 0.8, rgb[1] * 0.8, rgb[2] * 0.8);
    m.disableLighting = true;
    mesh.material = m;
    this.rings.push({ mesh, t: 0, dur, maxR });
  }

  spawnProjectile(from: Vector3, to: Vector3, rgb: [number, number, number], onArrive: () => void) {
    const mesh = MeshBuilder.CreateSphere(`fxProj${Math.random()}`, { diameter: 0.42, segments: 8 }, this.scene);
    const m = new StandardMaterial(`fxProjMat${Math.random()}`, this.scene);
    m.diffuseColor = new Color3(...rgb); m.emissiveColor = new Color3(rgb[0], rgb[1], rgb[2]);
    m.disableLighting = true;
    mesh.material = m;
    mesh.position.copyFrom(from);
    this.projectiles.push({ mesh, from: from.clone(), to: to.clone(), t: 0, dur: 0.28, onArrive });
  }

  /** Vòng đỏ cảnh báo sét (telegraph) — trả về mesh để Game tự dispose */
  spawnTelegraph(pos: Vector3, radius: number): Mesh {
    const mesh = MeshBuilder.CreateDisc(`telegraph${Math.random()}`, { radius, tessellation: 36 }, this.scene);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.copyFrom(pos).addInPlace(new Vector3(0, 0.22, 0));
    const m = new StandardMaterial(`telegraphMat${Math.random()}`, this.scene);
    m.diffuseColor = new Color3(1, 0.15, 0.1); m.emissiveColor = new Color3(0.7, 0.05, 0.02);
    m.alpha = 0.45; m.disableLighting = true; m.backFaceCulling = false;
    mesh.material = m;
    return mesh;
  }

  spawnLightning(pos: Vector3) {
    const mesh = MeshBuilder.CreateCylinder(`bolt${Math.random()}`, { diameterTop: 0.12, diameterBottom: 0.4, height: 22, tessellation: 6 }, this.scene);
    mesh.position.copyFrom(pos).addInPlace(new Vector3(0, 11, 0));
    const m = new StandardMaterial(`boltMat${Math.random()}`, this.scene);
    m.diffuseColor = new Color3(0.75, 0.85, 1); m.emissiveColor = new Color3(0.65, 0.78, 1);
    m.disableLighting = true;
    mesh.material = m;
    this.bolts.push({ mesh, t: 0, life: 0.3 });
    this.spawnRing(pos, [0.65, 0.78, 1], 2.6, 0.35);
  }

  update(dt: number) {
    for (const f of this.floats) {
      if (!f.active) continue;
      f.t += dt;
      f.mesh.position.y += dt * 1.5;
      const k = f.t / f.life;
      f.mesh.scaling.setAll(1 - k * 0.15);
      if (f.t >= f.life) { f.active = false; f.mesh.isVisible = false; }
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      const d = 0.4 + (r.maxR * 2 - 0.4) * k;
      r.mesh.scaling.set(d / 0.4, d / 0.4, 1);
      const mat = r.mesh.material as StandardMaterial | null;
      if (mat) mat.alpha = 1 - k;
      if (k >= 1) { r.mesh.dispose(); this.rings.splice(i, 1); }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.mesh.position = Vector3.Lerp(p.from, p.to, k).add(new Vector3(0, Math.sin(k * Math.PI) * 0.7, 0));
      if (k >= 1) { p.mesh.dispose(); this.projectiles.splice(i, 1); p.onArrive(); }
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.t += dt;
      if (b.t >= b.life) { b.mesh.dispose(); this.bolts.splice(i, 1); }
    }
  }
}
