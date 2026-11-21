import {
  Engine, Scene, Vector3, ArcRotateCamera,
} from '@babylonjs/core';
import { buildEnvironment, groundHeight } from './scene';
import { Player } from './player';
import { Beast } from './beast';
import { Cultivation } from './cultivation';
import { bridge } from './store';
import { PLAYER_BASE, BEAST_BASE, powerFactor } from './data';

type AutoPhase = 'SEEK' | 'ATTACK' | 'RETREAT' | 'MEDITATE';

export class Game {
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene: Scene;
  private player: Player;
  private beast: Beast;
  private cultivation = new Cultivation();
  private camera: ArcRotateCamera;
  private clouds: { move: (dt: number) => void };

  private keys = new Set<string>();
  hp = PLAYER_BASE.maxHp;
  mp = PLAYER_BASE.maxMp;
  private meditating = false;
  private swordDrawn = false;
  private autoMode = false;
  private autoPhase: AutoPhase = 'MEDITATE';
  private attackCooldown = 0;
  private dodgeT = 0;
  private dodgeDir = new Vector3();
  private invulnT = 0;
  private hudT = 0;
  private saveT = 0;
  private time = 0;
  private disposers: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, true, { stencil: true });
    this.scene = new Scene(this.engine);
    const env = buildEnvironment(this.scene);
    this.clouds = env.clouds;
    this.player = new Player(this.scene);
    this.player.root.position.set(0, 0, 3);
    this.beast = new Beast(this.scene);

    this.camera = new ArcRotateCamera('cam', -Math.PI / 2, 1.05, 9, new Vector3(0, 1.5, 3), this.scene);
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 4; this.camera.upperRadiusLimit = 18;
    this.camera.upperBetaLimit = 1.45;
    this.camera.panningSensibility = 0; // tắt pan, kéo chuột chỉ xoay

    this.bindInput();
    this.disposers.push(bridge.onCommand((c) => this.handleCommand(c)));
    this.emitHud();

    this.engine.runRenderLoop(() => {
      const dt = Math.min(0.05, this.engine.getDeltaTime() / 1000);
      this.update(dt);
      this.scene.render();
    });
  }

  private handleCommand(c: string) {
    if (c === 'toggleMeditate') this.setMeditating(!this.meditating);
    else if (c === 'toggleSword') this.setSword(!this.swordDrawn);
    else if (c === 'toggleAuto') this.setAuto(!this.autoMode);
    else if (c === 'breakthrough') this.cultivation.breakthrough();
    else if (c === 'attack') this.tryAttack();
    else if (c === 'resetSave') { this.cultivation.reset(); this.hp = PLAYER_BASE.maxHp; }
    this.emitHud();
  }

  private setMeditating(v: boolean) {
    this.meditating = v;
    if (v) this.cultivation.message = 'Tĩnh tọa tu luyện — Tu Vi tăng x3, Căn Cơ hồi phục.';
  }
  private setSword(v: boolean) {
    this.swordDrawn = v;
    this.cultivation.message = v ? 'Đã rút kiếm! Bấm F hoặc click chuột để tấn công.' : 'Đã cất kiếm.';
  }
  private setAuto(v: boolean) {
    this.autoMode = v;
    this.autoPhase = 'SEEK';
    this.cultivation.message = v ? 'Chế độ TỰ ĐỘNG: nhân vật tự săn yêu thú, đuối sức sẽ về thiền.' : 'Đã tắt chế độ tự động.';
  }

  private bindInput() {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'tab') { e.preventDefault(); this.setAuto(!this.autoMode); this.emitHud(); return; }
      this.keys.add(k);
      if (k === 'c') { this.setMeditating(!this.meditating); this.emitHud(); }
      if (k === 'r') { this.setSword(!this.swordDrawn); this.emitHud(); }
      if (k === 'f') this.tryAttack();
      if (k === ' ') { e.preventDefault(); this.tryDodge(); }
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    this.disposers.push(() => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); });

    // Click chuột trái = tấn công (chỉ khi không kéo xoay camera: quãng kéo ngắn + thả nhanh)
    let px = 0, py = 0, pt = 0;
    const pdown = (e: PointerEvent) => { px = e.clientX; py = e.clientY; pt = performance.now(); };
    const pup = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - px, e.clientY - py);
      if (e.button === 0 && moved < 6 && performance.now() - pt < 300) this.tryAttack();
    };
    this.canvas.addEventListener('pointerdown', pdown);
    this.canvas.addEventListener('pointerup', pup);
    this.disposers.push(() => { this.canvas.removeEventListener('pointerdown', pdown); this.canvas.removeEventListener('pointerup', pup); });
  }

  private tryDodge() {
    if (this.dodgeT > 0) return;
    const dir = this.moveDirection();
    this.dodgeDir.copyFrom(dir.lengthSquared() > 0.01 ? dir : new Vector3(Math.sin(this.player.root.rotation.y), 0, Math.cos(this.player.root.rotation.y)));
    this.dodgeT = 0.25; this.invulnT = 0.35;
    this.setMeditating(false);
  }

  private tryAttack() {
    if (!this.swordDrawn) { this.setSword(true); }
    if (this.attackCooldown > 0 || this.meditating) return;
    this.attackCooldown = 0.55;
    this.player.startAttack();
    // Trúng hay không quyết định sau 0.15s trong update qua cờ pendingHit
    this.pendingHitT = 0.15;
  }
  private pendingHitT = -1;

  private moveDirection(): Vector3 {
    const f = (this.keys.has('w') ? 1 : 0) - (this.keys.has('s') ? 1 : 0);
    const r = (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0);
    const alpha = this.camera.alpha;
    // Hướng nhìn của ArcRotateCamera trên mặt đất: forward = (-cos α, 0, -sin α)
    const forward = new Vector3(-Math.cos(alpha), 0, -Math.sin(alpha));
    const right = new Vector3(-forward.z, 0, forward.x);
    const dir = forward.scale(f).add(right.scale(r));
    return dir.lengthSquared() > 0.01 ? dir.normalize() : dir;
  }

  private movePlayer(dir: Vector3, speed: number, dt: number) {
    const p = this.player.root.position;
    p.addInPlace(dir.scale(speed * dt));
    const len = Math.hypot(p.x, p.z);
    if (len > 40) { p.x *= 40 / len; p.z *= 40 / len; }
    p.y = groundHeight(p.x, p.z);
    const targetRot = Math.atan2(dir.x, dir.z);
    let diff = targetRot - this.player.root.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.player.root.rotation.y += diff * Math.min(1, dt * 12);
  }

  private update(dt: number) {
    this.time += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.invulnT = Math.max(0, this.invulnT - dt);
    this.clouds.move(dt);

    // --- Điều khiển / Auto ---
    let moving = false;
    const pos = this.player.root.position;

    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      this.movePlayer(this.dodgeDir, 13, dt);
      moving = true;
    } else if (this.autoMode) {
      moving = this.updateAuto(dt);
    } else if (!this.meditating) {
      const dir = this.moveDirection();
      if (dir.lengthSquared() > 0.01) { this.movePlayer(dir, 5.2, dt); moving = true; }
    }

    // --- Yêu thú ---
    const beastRes = this.beast.update(dt, pos, this.time);
    if (beastRes.attacked && this.invulnT <= 0) {
      const dmg = BEAST_BASE.attackMin + Math.random() * (BEAST_BASE.attackMax - BEAST_BASE.attackMin);
      this.hp -= dmg;
      this.player.flash();
      if (this.meditating) this.setMeditating(false);
      if (this.hp <= 0) {
        this.hp = PLAYER_BASE.maxHp;
        this.player.root.position.set(0, 0, 3);
        this.cultivation.message = 'Bị yêu thú đánh trọng thương! Được đưa về sân tu luyện, HP hồi đầy.';
      } else {
        this.cultivation.message = `Yêu thú tấn công! −${dmg.toFixed(0)} HP.`;
      }
      this.emitHud();
    }

    // --- Đòn đánh đang chờ trúng ---
    if (this.pendingHitT > 0) {
      this.pendingHitT -= dt;
      if (this.pendingHitT <= 0 && this.beast.alive) {
        const d = Vector3.Distance(pos, this.beast.position);
        if (d < 3.2) {
          const dmg = (PLAYER_BASE.attackMin + Math.random() * (PLAYER_BASE.attackMax - PLAYER_BASE.attackMin)) * powerFactor(this.cultivation.canCo);
          const killed = this.beast.takeDamage(dmg, pos);
          this.cultivation.message = killed ? this.cultivation.message : `Chém trúng yêu thú! −${dmg.toFixed(0)} HP.`;
          if (killed) this.cultivation.addBeastReward();
          this.emitHud();
        }
      }
    }

    // --- Tu luyện + hồi phục ---
    this.cultivation.tick(dt, this.meditating);
    this.hp = Math.min(PLAYER_BASE.maxHp, this.hp + dt * (this.meditating ? 2.5 : 0.6));
    this.mp = Math.min(PLAYER_BASE.maxMp, this.mp + dt * 4);

    // --- Animation + camera + hạt thiền ---
    this.player.medParticles.emitter = pos.add(new Vector3(0, 0.4, 0));
    this.player.update(dt, { moving, meditating: this.meditating, swordDrawn: this.swordDrawn, time: this.time });
    const camTarget = pos.add(new Vector3(0, 1.5, 0));
    this.camera.target = Vector3.Lerp(this.camera.target, camTarget, Math.min(1, dt * 6));

    // --- HUD throttle ~5/s + lưu định kỳ ---
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.2; this.emitHud(); }
    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 5; this.cultivation.save(); }
  }

  private updateAuto(dt: number): boolean {
    const pos = this.player.root.position;
    const hpRatio = this.hp / PLAYER_BASE.maxHp;

    if (hpRatio < 0.25) this.autoPhase = 'RETREAT';
    if (this.autoPhase === 'RETREAT') {
      const home = new Vector3(0, 0, 3);
      const dir = home.subtract(pos); dir.y = 0;
      if (dir.length() > 1) { this.movePlayer(dir.normalize(), 6, dt); this.setMeditating(false); return true; }
      this.autoPhase = 'MEDITATE';
    }
    if (this.autoPhase === 'MEDITATE') {
      if (!this.beast.alive && hpRatio > 0.5) { if (!this.meditating) this.setMeditating(true); return false; }
      if (hpRatio >= 0.75 || (this.beast.alive && hpRatio > 0.4)) { this.setMeditating(false); this.autoPhase = 'SEEK'; }
      else { if (!this.meditating) this.setMeditating(true); return false; }
    }
    if (!this.beast.alive) { this.autoPhase = 'MEDITATE'; return false; }

    const toBeast = this.beast.position.subtract(pos); toBeast.y = 0;
    const dist = toBeast.length();
    this.autoPhase = dist <= 2.8 ? 'ATTACK' : 'SEEK';
    if (dist > 2.4) { this.movePlayer(toBeast.normalize(), 5.6, dt); return true; }
    // Trong tầm: đối mặt + tấn công
    this.player.root.rotation.y = Math.atan2(toBeast.x, toBeast.z);
    if (!this.swordDrawn) this.setSword(true);
    this.tryAttack();
    return false;
  }

  private emitHud() {
    const c = this.cultivation;
    bridge.emitHud({
      tuVi: Math.floor(c.tuVi), tuViNeed: c.stage.tuViNeed, canCo: Math.floor(c.canCo), ngoTinh: c.ngoTinh,
      realmLabel: `${c.stage.realm} — ${c.stage.sub}`, stageIndex: c.stageIndex,
      hp: Math.ceil(this.hp), maxHp: PLAYER_BASE.maxHp, mp: Math.floor(this.mp), maxMp: PLAYER_BASE.maxMp,
      meditating: this.meditating, swordDrawn: this.swordDrawn, autoMode: this.autoMode,
      autoPhase: this.autoMode ? this.autoPhase : '',
      beastHp: Math.max(0, Math.ceil(this.beast.hp)), beastMaxHp: BEAST_BASE.maxHp, beastAlive: this.beast.alive,
      message: c.message, canBreakthrough: c.canBreakthrough, breakthroughChance: c.chance, kills: c.kills,
    });
  }

  resize() { this.engine.resize(); }
  dispose() {
    this.disposers.forEach((d) => d());
    this.engine.dispose();
  }
}
