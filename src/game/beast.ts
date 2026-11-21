import {
  Scene, TransformNode, Vector3, Color3, MeshBuilder, StandardMaterial, DynamicTexture, Mesh,
} from '@babylonjs/core';
import { groundHeight } from './scene';
import { BEAST_BASE, ELITE, type BeastType } from './data';

function mat(scene: Scene, name: string, color: Color3, emissive?: Color3): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  if (emissive) m.emissiveColor = emissive;
  return m;
}

export interface BeastRewards { tuVi: number; linhThach: number; insight: number }

export class Beast {
  root = new TransformNode('beastRoot');
  typeDef: BeastType;
  elite: boolean;
  maxHp: number;
  hp: number;
  alive = true;
  respawnT = 0;
  flashT = 0;
  attackCooldown = 0;
  slowT = 0;
  /** Điểm hồi sinh gốc của con quái này */
  home: Vector3;
  private wanderTarget: Vector3;
  private idleT = 1;
  private barTexture: DynamicTexture;
  private bodyMat: StandardMaterial;
  private meshes: Mesh[] = [];

  constructor(scene: Scene, typeDef: BeastType, elite: boolean, spawn: Vector3, index: number) {
    this.typeDef = typeDef;
    this.elite = elite;
    this.maxHp = Math.round(typeDef.maxHp * (elite ? ELITE.hpMult : 1));
    this.hp = this.maxHp;
    this.home = spawn.clone();
    this.wanderTarget = spawn.clone();

    const sfx = `${index}`;
    const bodyC = new Color3(...typeDef.bodyColor);
    const darkC = new Color3(...typeDef.darkColor);
    const fur = mat(scene, `fur${sfx}`, bodyC);
    this.bodyMat = fur;
    const dark = mat(scene, `beastDark${sfx}`, darkC);
    // Tinh anh: sừng/vây viền vàng
    const hornM = elite
      ? mat(scene, `horn${sfx}`, new Color3(1, 0.84, 0.2), new Color3(0.35, 0.25, 0.02))
      : mat(scene, `horn${sfx}`, new Color3(0.85, 0.8, 0.65));
    const eyeM = mat(scene, `eye${sfx}`, new Color3(1, 0.2, 0.1), new Color3(1, 0.25, 0.05));

    const elong = typeDef.elongate;
    const body = MeshBuilder.CreateSphere(`beastBody${sfx}`, { diameter: 1.7, segments: 10 }, scene);
    body.scaling.set(1.25, 0.95, elong); body.position.y = 1.05; body.material = fur;
    const head = MeshBuilder.CreateSphere(`beastHead${sfx}`, { diameter: 1.0, segments: 10 }, scene);
    head.position.set(0, 1.3, 0.85 * elong); head.material = dark;
    const snout = MeshBuilder.CreateBox(`snout${sfx}`, { width: 0.55, height: 0.4, depth: 0.5 }, scene);
    snout.position.set(0, 1.15, (0.85 + 0.45) * elong); snout.material = fur;
    for (const s of [-1, 1]) {
      const horn = MeshBuilder.CreateCylinder(`horn${sfx}_${s}`, { diameterTop: 0.02, diameterBottom: 0.28, height: 0.85, tessellation: 8 }, scene);
      horn.position.set(0.38 * s, 1.9, 0.7 * elong); horn.rotation.z = -0.45 * s; horn.rotation.x = -0.25; horn.material = hornM;
      const eye = MeshBuilder.CreateSphere(`eye${sfx}_${s}`, { diameter: 0.16, segments: 8 }, scene);
      eye.position.set(0.26 * s, 1.45, (0.85 + 0.42) * elong); eye.material = eyeM;
      const ear = MeshBuilder.CreateCylinder(`ear${sfx}_${s}`, { diameterTop: 0.02, diameterBottom: 0.3, height: 0.5, tessellation: 6 }, scene);
      ear.position.set(0.5 * s, 1.75, 0.85 * elong); ear.material = dark;
      this.meshes.push(ear, horn, eye);
      if (elong <= 1.1) {
        for (const f of [0.55, -0.6]) {
          const leg = MeshBuilder.CreateCylinder(`leg${sfx}_${s}_${f}`, { diameter: 0.26, height: 0.9 }, scene);
          leg.position.set(0.55 * s, 0.45, f); leg.material = dark;
          this.meshes.push(leg);
        }
      }
    }
    const tail = MeshBuilder.CreateCylinder(`tail${sfx}`, { diameterTop: 0.05, diameterBottom: 0.22, height: 1.2 * elong }, scene);
    tail.position.set(0, 1.25, -1.15 * elong); tail.rotation.x = 0.9; tail.material = dark;
    for (let i = 0; i < 4; i++) {
      const spike = MeshBuilder.CreateCylinder(`spike${sfx}_${i}`, { diameterTop: 0.02, diameterBottom: 0.3, height: 0.55, tessellation: 5 }, scene);
      spike.position.set(0, 1.95 - i * 0.06, (0.5 - i * 0.42) * elong); spike.material = hornM;
      this.meshes.push(spike);
    }
    this.meshes.push(body, head, snout, tail);
    for (const m of this.meshes) m.parent = this.root;

    this.barTexture = new DynamicTexture(`beastBar${sfx}`, { width: 256, height: 48 }, scene, false);
    const bar = MeshBuilder.CreatePlane(`beastBarPlane${sfx}`, { width: 2.4, height: 0.45 }, scene);
    bar.position.y = 3.0 * typeDef.scale; bar.billboardMode = Mesh.BILLBOARDMODE_ALL;
    const bm = new StandardMaterial(`beastBarMat${sfx}`, scene);
    bm.diffuseTexture = this.barTexture; bm.emissiveTexture = this.barTexture;
    bm.disableLighting = true; bm.backFaceCulling = false;
    bar.material = bm; bar.parent = this.root;
    this.meshes.push(bar);
    this.drawBar();

    this.root.scaling.setAll(typeDef.scale * (elite ? ELITE.scaleMult : 1));
    this.root.position.copyFrom(spawn);
  }

  get displayName(): string { return (this.elite ? '⭐ Tinh Anh · ' : '') + this.typeDef.name; }

  drawBar() {
    const ctx = this.barTexture.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 256, 48);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 8, 256, 30);
    const w = Math.max(0, (this.hp / this.maxHp) * 248);
    ctx.fillStyle = this.elite ? '#fbbf24' : (this.hp / this.maxHp > 0.35 ? '#e5484d' : '#ff8a3d');
    if (this.alive) ctx.fillRect(4, 12, w, 22);
    ctx.font = 'bold 17px sans-serif'; ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(this.alive ? this.displayName : 'Đang hồi sinh...', 128, 34);
    this.barTexture.update();
  }

  get position(): Vector3 { return this.root.position; }

  rewards(): BeastRewards {
    const t = this.typeDef;
    const mult = this.elite ? ELITE.rewardMult : 1;
    const linhThach = Math.round((t.linhThachMin + Math.random() * (t.linhThachMax - t.linhThachMin)) * mult);
    const insight = this.elite && Math.random() < ELITE.insightChance ? 1 : 0;
    return { tuVi: Math.round(t.tuViReward * mult), linhThach, insight };
  }

  kill() {
    this.alive = false; this.hp = 0; this.respawnT = BEAST_BASE.respawnSeconds;
    this.root.scaling.setAll(0.001);
    this.drawBar();
  }

  private respawn() {
    // Mỗi lần hồi sinh có thể đổi thành tinh anh theo tỉ lệ trong data (Game quyết định qua setElite khó) —
    // ở đây giữ nguyên tính chất ban đầu cho đơn giản, chỉ hồi máu + về gần điểm nhà.
    this.alive = true; this.hp = this.maxHp;
    this.root.scaling.setAll(this.typeDef.scale * (this.elite ? ELITE.scaleMult : 1));
    const a = Math.random() * Math.PI * 2;
    this.root.position.set(this.home.x + Math.cos(a) * 3, 0, this.home.z + Math.sin(a) * 3);
    this.drawBar();
  }

  update(dt: number, playerPos: Vector3, time: number, opts?: { ignorePlayer?: boolean }): { attacked: boolean; dmg: number } {
    if (!this.alive) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) { this.respawn(); }
      return { attacked: false, dmg: 0 };
    }
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    const speedMult = this.slowT > 0 ? 0.45 : 1;
    const ignore = opts?.ignorePlayer ?? false;
    const toPlayer = playerPos.subtract(this.root.position); toPlayer.y = 0;
    const dist = toPlayer.length();
    let moving = false;

    if (!ignore && dist < 9) {
      if (dist > 2.1) {
        toPlayer.normalize();
        this.root.position.addInPlace(toPlayer.scale(dt * this.typeDef.chaseSpeed * speedMult));
        moving = true;
      }
      this.root.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
    } else {
      this.idleT -= dt;
      const toT = this.wanderTarget.subtract(this.root.position); toT.y = 0;
      if (toT.length() < 1 || this.idleT <= 0) {
        const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 6;
        this.wanderTarget.set(this.home.x + Math.cos(a) * d, 0, this.home.z + Math.sin(a) * d);
        this.idleT = 3 + Math.random() * 3;
      } else {
        toT.normalize();
        this.root.position.addInPlace(toT.scale(dt * 1.1 * speedMult));
        this.root.rotation.y = Math.atan2(toT.x, toT.z);
        moving = true;
      }
    }
    this.root.position.y = groundHeight(this.root.position.x, this.root.position.z) + Math.sin(time * (moving ? 8 : 2)) * 0.04;

    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - dt * 5);
      this.bodyMat.emissiveColor = new Color3(0.8 * this.flashT, 0.1 * this.flashT, 0.1 * this.flashT);
    }

    const attacked = !ignore && dist <= 2.3 && this.attackCooldown <= 0;
    let dmg = 0;
    if (attacked) {
      this.attackCooldown = 1.3;
      const t = this.typeDef;
      dmg = (t.attackMin + Math.random() * (t.attackMax - t.attackMin)) * (this.elite ? ELITE.atkMult : 1);
    }
    return { attacked, dmg };
  }

  applySlow(seconds: number) { this.slowT = Math.max(this.slowT, seconds); }

  takeDamage(dmg: number, fromPos: Vector3): boolean {
    if (!this.alive) return false;
    this.hp -= dmg;
    this.flashT = 1;
    const dir = this.root.position.subtract(fromPos); dir.y = 0;
    if (dir.lengthSquared() > 0.001) { dir.normalize(); this.root.position.addInPlace(dir.scale(0.7)); }
    this.drawBar();
    if (this.hp <= 0) { this.kill(); return true; }
    return false;
  }
}
