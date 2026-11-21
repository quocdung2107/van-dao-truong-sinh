import {
  Scene, TransformNode, Vector3, Color3, MeshBuilder, StandardMaterial, DynamicTexture, Mesh,
} from '@babylonjs/core';
import { groundHeight } from './scene';
import { BEAST_BASE, ELITE, counterOf, type BeastType, type Element } from './data';

function mat(scene: Scene, name: string, color: Color3, emissive?: Color3): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  if (emissive) m.emissiveColor = emissive;
  return m;
}

export interface BeastRewards { tuVi: number; linhThach: number; insight: number }
export interface BeastUpdateResult { attacked: boolean; dmg: number }
export interface DamageResult { killed: boolean; shieldHit: boolean; shieldBroken: boolean; dealt: number }

export interface BeastOptions {
  /** Hệ số nhân chỉ số theo bản đồ / bí cảnh */
  statMul?: number;
  /** Bí cảnh: chết là hết, không hồi sinh */
  noRespawn?: boolean;
  /** Boss: đòn dậm đất diện rộng + khiên phản hệ ở 50% HP */
  boss?: boolean;
  aggroRange?: number;
}

export class Beast {
  root = new TransformNode('beastRoot');
  typeDef: BeastType;
  elite: boolean;
  boss: boolean;
  maxHp: number;
  hp: number;
  alive = true;
  respawnT = 0;
  flashT = 0;
  attackCooldown = 0;
  slowT = 0;
  stunT = 0;
  /** Điểm hồi sinh gốc của con quái này */
  home: Vector3;
  // Boss
  shieldActive = false;
  shieldHits = 0;
  counterElement: Element;
  private shieldTriggered = false;
  private slamState: 'idle' | 'warn' = 'idle';
  private slamT = 0;
  private slamCooldown = 3;
  private slamPos = new Vector3();
  private slamMesh: Mesh | null = null;
  /** Game gán: tạo vòng đỏ cảnh báo (dùng Fx.spawnTelegraph) */
  onTelegraph: ((pos: Vector3, radius: number) => Mesh) | null = null;

  private statMul: number;
  private noRespawn: boolean;
  private aggroRange: number;
  private wanderTarget: Vector3;
  private idleT = 1;
  private barTexture: DynamicTexture;
  private bodyMat: StandardMaterial;
  private meshes: Mesh[] = [];
  private mats: StandardMaterial[] = [];
  private disposed = false;

  constructor(scene: Scene, typeDef: BeastType, elite: boolean, spawn: Vector3, index: number, opts: BeastOptions = {}) {
    this.typeDef = typeDef;
    this.elite = elite;
    this.boss = !!opts.boss;
    this.statMul = opts.statMul ?? 1;
    this.noRespawn = !!opts.noRespawn;
    this.aggroRange = opts.aggroRange ?? 9;
    this.maxHp = Math.round(typeDef.maxHp * (elite ? ELITE.hpMult : 1) * this.statMul);
    this.hp = this.maxHp;
    this.home = spawn.clone();
    this.wanderTarget = spawn.clone();
    this.counterElement = counterOf(typeDef.element);

    const sfx = `${index}_${Math.floor(Math.random() * 1e6)}`;
    const bodyC = new Color3(...typeDef.bodyColor);
    const darkC = new Color3(...typeDef.darkColor);
    const m = (name: string, color: Color3, emissive?: Color3) => {
      const mm = mat(scene, `${name}${sfx}`, color, emissive);
      this.mats.push(mm);
      return mm;
    };
    const fur = m('fur', bodyC);
    this.bodyMat = fur;
    const dark = m('beastDark', darkC);
    const hornM = elite
      ? m('horn', new Color3(1, 0.84, 0.2), new Color3(0.35, 0.25, 0.02))
      : m('horn', new Color3(0.85, 0.8, 0.65));
    const eyeM = m('eye', new Color3(1, 0.2, 0.1), new Color3(1, 0.25, 0.05));

    if (typeDef.form === 'golem') this.buildGolem(scene, sfx, fur, dark, hornM, eyeM);
    else this.buildAnimal(scene, sfx, fur, dark, hornM, eyeM);

    this.barTexture = new DynamicTexture(`beastBar${sfx}`, { width: 256, height: 48 }, scene, false);
    const bar = MeshBuilder.CreatePlane(`beastBarPlane${sfx}`, { width: 2.4, height: 0.45 }, scene);
    bar.position.y = 3.0 * typeDef.scale; bar.billboardMode = Mesh.BILLBOARDMODE_ALL;
    const bm = new StandardMaterial(`beastBarMat${sfx}`, scene);
    this.mats.push(bm);
    bm.diffuseTexture = this.barTexture; bm.emissiveTexture = this.barTexture;
    bm.disableLighting = true; bm.backFaceCulling = false;
    bar.material = bm; bar.parent = this.root;
    this.meshes.push(bar);
    this.drawBar();

    this.root.scaling.setAll(typeDef.scale * (elite ? ELITE.scaleMult : 1));
    this.root.position.copyFrom(spawn);
    this.root.position.y = groundHeight(spawn.x, spawn.z);
  }

  private buildAnimal(scene: Scene, sfx: string, fur: StandardMaterial, dark: StandardMaterial, hornM: StandardMaterial, eyeM: StandardMaterial) {
    const typeDef = this.typeDef;
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
    for (const mm of this.meshes) mm.parent = this.root;
  }

  private buildGolem(scene: Scene, sfx: string, stone: StandardMaterial, dark: StandardMaterial, gold: StandardMaterial, eyeM: StandardMaterial) {
    const torso = MeshBuilder.CreateBox(`golemTorso${sfx}`, { width: 1.9, height: 1.7, depth: 1.1 }, scene);
    torso.position.y = 1.85; torso.material = stone;
    const head = MeshBuilder.CreateBox(`golemHead${sfx}`, { width: 0.85, height: 0.8, depth: 0.85 }, scene);
    head.position.y = 3.1; head.material = dark;
    const core = MeshBuilder.CreateSphere(`golemCore${sfx}`, { diameter: 0.5, segments: 10 }, scene);
    core.position.set(0, 1.95, 0.6);
    core.material = mat(scene, `golemCoreMat${sfx}`, new Color3(1, 0.6, 0.15), new Color3(0.9, 0.45, 0.05));
    this.mats.push(core.material as StandardMaterial);
    for (const s of [-1, 1]) {
      const arm = MeshBuilder.CreateCylinder(`golemArm${sfx}_${s}`, { diameter: 0.5, height: 1.9, tessellation: 8 }, scene);
      arm.position.set(1.25 * s, 1.8, 0); arm.material = dark;
      const fist = MeshBuilder.CreateBox(`golemFist${sfx}_${s}`, { width: 0.7, height: 0.6, depth: 0.7 }, scene);
      fist.position.set(1.25 * s, 0.75, 0); fist.material = stone;
      const leg = MeshBuilder.CreateCylinder(`golemLeg${sfx}_${s}`, { diameter: 0.55, height: 1.1, tessellation: 8 }, scene);
      leg.position.set(0.5 * s, 0.55, 0); leg.material = dark;
      const eye = MeshBuilder.CreateSphere(`golemEye${sfx}_${s}`, { diameter: 0.15, segments: 8 }, scene);
      eye.position.set(0.2 * s, 3.2, 0.44); eye.material = eyeM;
      const trim = MeshBuilder.CreateBox(`golemTrim${sfx}_${s}`, { width: 0.16, height: 1.7, depth: 0.06 }, scene);
      trim.position.set(0.7 * s, 1.85, 0.57); trim.material = gold;
      this.meshes.push(arm, fist, leg, eye, trim);
    }
    this.meshes.push(torso, head, core);
    for (const mm of this.meshes) mm.parent = this.root;
  }

  get displayName(): string {
    if (this.boss) return `👹 ${this.typeDef.name}`;
    return (this.elite ? '⭐ Tinh Anh · ' : '') + this.typeDef.name;
  }

  drawBar() {
    const ctx = this.barTexture.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 256, 48);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 8, 256, 30);
    const w = Math.max(0, (this.hp / this.maxHp) * 248);
    ctx.fillStyle = this.boss ? '#c084fc' : this.elite ? '#fbbf24' : (this.hp / this.maxHp > 0.35 ? '#e5484d' : '#ff8a3d');
    if (this.alive) ctx.fillRect(4, 12, w, 22);
    ctx.font = 'bold 17px sans-serif'; ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    const label = this.alive
      ? (this.shieldActive ? `${this.displayName} 🛡️×${this.shieldHits}` : this.displayName)
      : (this.noRespawn ? '' : 'Đang hồi sinh...');
    ctx.fillText(label, 128, 34);
    this.barTexture.update();
  }

  get position(): Vector3 { return this.root.position; }

  rewards(): BeastRewards {
    const t = this.typeDef;
    const mult = (this.elite ? ELITE.rewardMult : 1) * this.statMul;
    const linhThach = Math.round((t.linhThachMin + Math.random() * (t.linhThachMax - t.linhThachMin)) * mult);
    const insight = this.elite && Math.random() < ELITE.insightChance ? 1 : 0;
    return { tuVi: Math.round(t.tuViReward * mult), linhThach, insight };
  }

  kill() {
    this.alive = false; this.hp = 0; this.respawnT = BEAST_BASE.respawnSeconds;
    this.clearSlam();
    this.root.scaling.setAll(0.001);
    this.drawBar();
  }

  private respawn() {
    this.alive = true; this.hp = this.maxHp;
    this.root.scaling.setAll(this.typeDef.scale * (this.elite ? ELITE.scaleMult : 1));
    const a = Math.random() * Math.PI * 2;
    this.root.position.set(this.home.x + Math.cos(a) * 3, 0, this.home.z + Math.sin(a) * 3);
    this.drawBar();
  }

  private clearSlam() {
    if (this.slamMesh) { this.slamMesh.dispose(); this.slamMesh = null; }
    this.slamState = 'idle';
  }

  update(dt: number, playerPos: Vector3, time: number, opts?: { ignorePlayer?: boolean }): BeastUpdateResult {
    if (!this.alive) {
      if (!this.noRespawn) {
        this.respawnT -= dt;
        if (this.respawnT <= 0) this.respawn();
      }
      return { attacked: false, dmg: 0 };
    }
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.stunT = Math.max(0, this.stunT - dt);
    this.slamCooldown = Math.max(0, this.slamCooldown - dt);
    const speedMult = this.slowT > 0 ? 0.45 : 1;
    const ignore = opts?.ignorePlayer ?? false;
    const toPlayer = playerPos.subtract(this.root.position); toPlayer.y = 0;
    const dist = toPlayer.length();
    let moving = false;
    let result: BeastUpdateResult = { attacked: false, dmg: 0 };

    // --- Boss: đòn dậm đất diện rộng (telegraph 1.2s rồi giáng xuống) ---
    if (this.boss && this.slamState === 'warn') {
      this.slamT -= dt;
      if (this.slamMesh && this.slamMesh.material) {
        (this.slamMesh.material as StandardMaterial).alpha = 0.35 + 0.25 * Math.abs(Math.sin(time * 9));
      }
      if (this.slamT <= 0) {
        const hitDist = Vector3.Distance(playerPos, this.slamPos);
        this.clearSlam();
        this.slamCooldown = 5;
        if (!ignore && hitDist <= 3.2) {
          result = { attacked: true, dmg: (this.typeDef.attackMax * 2.2) * this.statMul };
        }
      }
      this.root.position.y = groundHeight(this.root.position.x, this.root.position.z);
      return result;
    }

    if (this.stunT <= 0 && !ignore) {
      if (this.boss && dist < 7.5 && dist > 2.6 && this.slamCooldown <= 0) {
        this.slamState = 'warn';
        this.slamT = 1.2;
        this.slamPos.copyFrom(playerPos);
        this.slamPos.y = groundHeight(playerPos.x, playerPos.z);
        if (this.onTelegraph) this.slamMesh = this.onTelegraph(this.slamPos.clone(), 3.2);
        this.root.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
        return result;
      }
      if (dist < this.aggroRange) {
        if (dist > 2.1) {
          toPlayer.normalize();
          this.root.position.addInPlace(toPlayer.scale(dt * this.typeDef.chaseSpeed * speedMult));
          moving = true;
        }
        this.root.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);
      } else {
        moving = this.wander(dt, speedMult);
      }
    } else if (!ignore && this.stunT <= 0) {
      moving = this.wander(dt, speedMult);
    }
    this.root.position.y = groundHeight(this.root.position.x, this.root.position.z) + Math.sin(time * (moving ? 8 : 2)) * 0.04;

    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - dt * 5);
      this.bodyMat.emissiveColor = new Color3(0.8 * this.flashT, 0.1 * this.flashT, 0.1 * this.flashT);
    }

    const attacked = !ignore && this.stunT <= 0 && dist <= 2.3 && this.attackCooldown <= 0;
    if (attacked) {
      this.attackCooldown = 1.3;
      const t = this.typeDef;
      const dmg = (t.attackMin + Math.random() * (t.attackMax - t.attackMin)) * (this.elite ? ELITE.atkMult : 1) * this.statMul;
      result = { attacked: true, dmg };
    }
    return result;
  }

  private wander(dt: number, speedMult: number): boolean {
    this.idleT -= dt;
    const toT = this.wanderTarget.subtract(this.root.position); toT.y = 0;
    if (toT.length() < 1 || this.idleT <= 0) {
      const a = Math.random() * Math.PI * 2, d = 3 + Math.random() * 6;
      this.wanderTarget.set(this.home.x + Math.cos(a) * d, 0, this.home.z + Math.sin(a) * d);
      this.idleT = 3 + Math.random() * 3;
      return false;
    }
    toT.normalize();
    this.root.position.addInPlace(toT.scale(dt * 1.1 * speedMult));
    this.root.rotation.y = Math.atan2(toT.x, toT.z);
    return true;
  }

  applySlow(seconds: number) { this.slowT = Math.max(this.slowT, seconds); }

  /**
   * Nhận sát thương. Khiên boss: chỉ đòn đúng hệ khắc mới trừ khiên (và chịu 50% sát thương),
   * đòn khác hệ chỉ gây 10% sát thương và không trừ khiên. Phá khiên -> boss choáng 3s, chịu +50%.
   */
  takeDamage(dmg: number, fromPos: Vector3, element?: Element): DamageResult {
    const res: DamageResult = { killed: false, shieldHit: false, shieldBroken: false, dealt: 0 };
    if (!this.alive) return res;
    let final = dmg;
    if (this.boss && !this.shieldTriggered && this.hp - dmg <= this.maxHp * 0.5) {
      this.shieldTriggered = true;
      this.shieldActive = true;
      this.shieldHits = 5;
      this.drawBar();
    }
    if (this.boss && this.shieldActive) {
      if (element && element === this.counterElement) {
        this.shieldHits -= 1;
        res.shieldHit = true;
        final = dmg * 0.5;
        if (this.shieldHits <= 0) {
          this.shieldActive = false;
          this.stunT = 3;
          res.shieldBroken = true;
        }
        this.drawBar();
      } else {
        final = dmg * 0.1;
      }
    } else if (this.boss && this.stunT > 0) {
      final = dmg * 1.5;
    }
    this.hp -= final;
    res.dealt = final;
    this.flashT = 1;
    const dir = this.root.position.subtract(fromPos); dir.y = 0;
    if (dir.lengthSquared() > 0.001 && !this.boss) { dir.normalize(); this.root.position.addInPlace(dir.scale(0.7)); }
    this.drawBar();
    if (this.hp <= 0) { this.kill(); res.killed = true; }
    return res;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clearSlam();
    for (const mm of this.meshes) mm.dispose();
    this.barTexture.dispose();
    for (const mm of this.mats) mm.dispose();
    this.root.dispose();
  }
}
