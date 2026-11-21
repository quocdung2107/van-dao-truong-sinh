import {
  Scene, TransformNode, Vector3, Color3, MeshBuilder, StandardMaterial, DynamicTexture, Mesh,
} from '@babylonjs/core';
import { groundHeight } from './scene';
import { BEAST_BASE } from './data';

function mat(scene: Scene, name: string, color: Color3, emissive?: Color3): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  if (emissive) m.emissiveColor = emissive;
  return m;
}

export class Beast {
  root = new TransformNode('beastRoot');
  hp = BEAST_BASE.maxHp;
  alive = true;
  respawnT = 0;
  flashT = 0;
  attackCooldown = 0;
  private wanderTarget = new Vector3(8, 0, 6);
  private idleT = 1;
  private barTexture: DynamicTexture;
  private bodyMat: StandardMaterial;
  private meshes: Mesh[] = [];

  constructor(scene: Scene) {
    const fur = mat(scene, 'fur', new Color3(0.32, 0.22, 0.3));
    this.bodyMat = fur;
    const dark = mat(scene, 'beastDark', new Color3(0.18, 0.12, 0.2));
    const hornM = mat(scene, 'horn', new Color3(0.85, 0.8, 0.65));
    const eyeM = mat(scene, 'eye', new Color3(1, 0.2, 0.1), new Color3(1, 0.25, 0.05));

    const body = MeshBuilder.CreateSphere('beastBody', { diameter: 1.7, segments: 10 }, scene);
    body.scaling.set(1.25, 0.95, 1); body.position.y = 1.05; body.material = fur;
    const head = MeshBuilder.CreateSphere('beastHead', { diameter: 1.0, segments: 10 }, scene);
    head.position.set(0, 1.35, 0.95); head.material = dark;
    const snout = MeshBuilder.CreateBox('snout', { width: 0.55, height: 0.4, depth: 0.5 }, scene);
    snout.position.set(0, 1.2, 1.45); snout.material = fur;
    for (const s of [-1, 1]) {
      const horn = MeshBuilder.CreateCylinder(`horn${s}`, { diameterTop: 0.02, diameterBottom: 0.28, height: 0.85, tessellation: 8 }, scene);
      horn.position.set(0.38 * s, 1.95, 0.8); horn.rotation.z = -0.45 * s; horn.rotation.x = -0.25; horn.material = hornM;
      const eye = MeshBuilder.CreateSphere(`eye${s}`, { diameter: 0.16, segments: 8 }, scene);
      eye.position.set(0.26 * s, 1.5, 1.38); eye.material = eyeM;
      const ear = MeshBuilder.CreateCylinder(`ear${s}`, { diameterTop: 0.02, diameterBottom: 0.3, height: 0.5, tessellation: 6 }, scene);
      ear.position.set(0.5 * s, 1.8, 0.95); ear.material = dark;
      this.meshes.push(ear);
      for (const f of [0.55, -0.6]) {
        const leg = MeshBuilder.CreateCylinder(`leg${s}${f}`, { diameter: 0.26, height: 0.9 }, scene);
        leg.position.set(0.55 * s, 0.45, f); leg.material = dark;
        this.meshes.push(leg);
      }
      this.meshes.push(horn, eye);
    }
    // Đuôi có gai
    const tail = MeshBuilder.CreateCylinder('tail', { diameterTop: 0.05, diameterBottom: 0.22, height: 1.2 }, scene);
    tail.position.set(0, 1.25, -1.15); tail.rotation.x = 0.9; tail.material = dark;
    // Vây lưng
    for (let i = 0; i < 4; i++) {
      const spike = MeshBuilder.CreateCylinder(`spike${i}`, { diameterTop: 0.02, diameterBottom: 0.3, height: 0.55, tessellation: 5 }, scene);
      spike.position.set(0, 1.95 - i * 0.06, 0.5 - i * 0.42); spike.material = hornM;
      this.meshes.push(spike);
    }
    this.meshes.push(body, head, snout, tail);
    for (const m of this.meshes) m.parent = this.root;
    // Các mesh tạo trực tiếp (body/head...) đã có parent qua vòng trên; horns/eyes cũng vậy.

    // Thanh HP billboard bằng DynamicTexture
    this.barTexture = new DynamicTexture('beastBar', { width: 256, height: 48 }, scene, false);
    const bar = MeshBuilder.CreatePlane('beastBarPlane', { width: 2.2, height: 0.42 }, scene);
    bar.position.y = 2.9; bar.billboardMode = Mesh.BILLBOARDMODE_ALL;
    const bm = new StandardMaterial('beastBarMat', scene);
    bm.diffuseTexture = this.barTexture; bm.emissiveTexture = this.barTexture;
    bm.disableLighting = true; bm.backFaceCulling = false;
    bar.material = bm; bar.parent = this.root;
    this.meshes.push(bar);
    this.drawBar();

    this.root.position.set(9, 0, 7);
  }

  drawBar() {
    const ctx = this.barTexture.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 256, 48);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 8, 256, 30);
    const w = Math.max(0, (this.hp / BEAST_BASE.maxHp) * 248);
    ctx.fillStyle = this.hp / BEAST_BASE.maxHp > 0.35 ? '#e5484d' : '#ff8a3d';
    if (this.alive) ctx.fillRect(4, 12, w, 22);
    ctx.font = 'bold 20px sans-serif'; ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(this.alive ? 'Yêu Thú Hắc Phong' : 'Đang hồi sinh...', 128, 34);
    this.barTexture.update();
  }

  get position(): Vector3 { return this.root.position; }

  kill() {
    this.alive = false; this.hp = 0; this.respawnT = BEAST_BASE.respawnSeconds;
    this.root.scaling.setAll(0.001);
    this.drawBar();
  }

  private respawn() {
    this.alive = true; this.hp = BEAST_BASE.maxHp;
    this.root.scaling.setAll(1);
    const a = Math.random() * Math.PI * 2;
    this.root.position.set(Math.cos(a) * 10, 0, Math.sin(a) * 10);
    this.drawBar();
  }

  /** @returns true nếu vừa hồi sinh xong */
  update(dt: number, playerPos: Vector3, time: number): { attacked: boolean } {
    if (!this.alive) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) { this.respawn(); return { attacked: false }; }
      return { attacked: false };
    }
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    const toPlayer = playerPos.subtract(this.root.position); toPlayer.y = 0;
    const dist = toPlayer.length();
    let moving = false;

    if (dist < 9) {
      // Đuổi theo người chơi
      if (dist > 2.1) {
        toPlayer.normalize();
        this.root.position.addInPlace(toPlayer.scale(dt * 2.4));
        moving = true;
      }
      this.root.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    } else {
      // Đi lang thang
      this.idleT -= dt;
      const toT = this.wanderTarget.subtract(this.root.position); toT.y = 0;
      if (toT.length() < 1 || this.idleT <= 0) {
        const a = Math.random() * Math.PI * 2, d = 6 + Math.random() * 9;
        this.wanderTarget.set(Math.cos(a) * d, 0, Math.sin(a) * d);
        this.idleT = 3 + Math.random() * 3;
      } else {
        toT.normalize();
        this.root.position.addInPlace(toT.scale(dt * 1.1));
        this.root.rotation.y = Math.atan2(toT.x, toT.z);
        moving = true;
      }
    }
    this.root.position.y = groundHeight(this.root.position.x, this.root.position.z) + Math.sin(time * (moving ? 8 : 2)) * 0.04;

    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - dt * 5);
      this.bodyMat.emissiveColor = new Color3(0.8 * this.flashT, 0.1 * this.flashT, 0.1 * this.flashT);
    }

    const attacked = dist <= 2.3 && this.attackCooldown <= 0;
    if (attacked) this.attackCooldown = 1.3;
    return { attacked };
  }

  takeDamage(dmg: number, fromPos: Vector3): boolean {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.flashT = 1;
    // Đẩy lùi
    const dir = this.root.position.subtract(fromPos); dir.y = 0;
    if (dir.lengthSquared() > 0.001) { dir.normalize(); this.root.position.addInPlace(dir.scale(0.7)); }
    this.drawBar();
    if (this.hp <= 0) { this.kill(); return true; }
    return false;
  }
}
