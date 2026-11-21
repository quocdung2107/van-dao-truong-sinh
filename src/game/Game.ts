import {
  Engine, Scene, Vector3, ArcRotateCamera, Mesh, StandardMaterial,
} from '@babylonjs/core';
import { buildEnvironment, groundHeight } from './scene';
import { Player } from './player';
import { Beast } from './beast';
import { Cultivation } from './cultivation';
import { bridge } from './store';
import { Fx } from './fx';
import {
  BEAST_TYPES, ELITE_CHANCE, SKILLS, CULT_EVENTS, TRIBULATION,
  computeStats, mitigate, elementFactor, ROOT_SKILL_BONUS, ELEMENT_RGB,
  schoolById, ELEMENT_LABEL,
  type SkillDef, type SkillKey, type CultEventDef,
} from './data';

type AutoPhase = 'SEEK' | 'ATTACK' | 'RETREAT' | 'MEDITATE';

interface TribState {
  wave: number;
  phase: 'warn' | 'pause';
  t: number;
  strikes: { pos: Vector3; mesh: Mesh }[];
}

const SPAWN_POINTS = [
  new Vector3(9, 0, 7), new Vector3(-12, 0, 5), new Vector3(6, 0, -14), new Vector3(-8, 0, -11),
];
const BEAST_ORDER = [0, 1, 2, 0]; // Lang, Mộc Tinh, Thủy Xà, Lang

export class Game {
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene: Scene;
  private player: Player;
  private beasts: Beast[] = [];
  private cultivation = new Cultivation();
  private fx: Fx;
  private camera: ArcRotateCamera;
  private clouds: { move: (dt: number) => void };

  private keys = new Set<string>();
  hp: number;
  mp: number;
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
  private pendingHitT = -1;

  // Giai đoạn 1: kỹ năng / buff / sự kiện / thiên kiếp
  private cooldowns: Record<string, number> = { Q: 0, E: 0, R: 0, F: 0 };
  private shield = 0;
  private shieldT = 0;
  private speedBuffT = 0;
  private speedBuffValue = 1;
  private pendingEvent: { def: CultEventDef; expires: number } | null = null;
  private eventT = 45 + Math.random() * 45;
  private trib: TribState | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, true, { stencil: true });
    this.scene = new Scene(this.engine);
    const env = buildEnvironment(this.scene);
    this.clouds = env.clouds;
    this.player = new Player(this.scene);
    this.player.root.position.set(0, 0, 3);
    this.fx = new Fx(this.scene);
    for (let i = 0; i < SPAWN_POINTS.length; i++) {
      const type = BEAST_TYPES[BEAST_ORDER[i]];
      const elite = Math.random() < ELITE_CHANCE;
      this.beasts.push(new Beast(this.scene, type, elite, SPAWN_POINTS[i], i));
    }

    const st = this.stats;
    this.hp = st.maxHp;
    this.mp = st.maxMp;

    this.camera = new ArcRotateCamera('cam', -Math.PI / 2, 1.05, 9, new Vector3(0, 1.5, 3), this.scene);
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 4; this.camera.upperRadiusLimit = 18;
    this.camera.upperBetaLimit = 1.45;
    this.camera.panningSensibility = 0;

    this.bindInput();
    this.disposers.push(bridge.onCommand((c) => this.handleCommand(c)));
    this.emitHud();

    this.engine.runRenderLoop(() => {
      const dt = Math.min(0.05, this.engine.getDeltaTime() / 1000);
      this.update(dt);
      this.scene.render();
    });
  }

  private get char() {
    return this.cultivation.character ?? { name: 'Vô Danh', root: 'Kim' as const, school: 'kiem' as const };
  }
  private get stats() { return computeStats(this.cultivation.stageIndex, this.cultivation.canCo, this.char.school); }
  private get skillDefs(): SkillDef[] { return SKILLS[this.char.school]; }
  private moveSpeed(): number { return this.stats.speed * (this.speedBuffT > 0 ? this.speedBuffValue : 1); }

  private nearestBeast(maxDist = Infinity): Beast | null {
    const pos = this.player.root.position;
    let best: Beast | null = null; let bestD = maxDist;
    for (const b of this.beasts) {
      if (!b.alive) continue;
      const d = Vector3.Distance(pos, b.position);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  private handleCommand(c: string) {
    if (c === 'toggleMeditate') this.setMeditating(!this.meditating);
    else if (c === 'toggleSword') this.setSword(!this.swordDrawn);
    else if (c === 'toggleAuto') this.setAuto(!this.autoMode);
    else if (c === 'breakthrough') this.tryBreakthrough();
    else if (c === 'attack') this.tryAttack();
    else if (c.startsWith('skill:')) this.castSkill(c.slice(6) as SkillKey);
    else if (c.startsWith('method:')) {
      this.cultivation.methodId = c.slice(7) as typeof this.cultivation.methodId;
      this.cultivation.message = `Đổi phương pháp tu luyện: ${this.cultivation.method.name}.`;
      this.cultivation.save();
    } else if (c.startsWith('eventChoice:')) this.chooseEvent(Number(c.slice(12)));
    else if (c === 'resetSave') {
      this.cleanupTrib();
      this.pendingEvent = null;
      this.cultivation.reset();
      this.hp = this.stats.maxHp; this.mp = this.stats.maxMp; this.shield = 0;
    }
    this.emitHud();
  }

  private setMeditating(v: boolean) {
    if (this.trib && v) return;
    this.meditating = v;
    if (v) this.cultivation.message = `${this.cultivation.method.name} — ${this.cultivation.method.desc}`;
  }
  private setSword(v: boolean) {
    this.swordDrawn = v;
    this.cultivation.message = v ? 'Đã rút kiếm! Click chuột để tấn công, Q/E/R/F tung kỹ năng.' : 'Đã cất kiếm.';
  }
  private setAuto(v: boolean) {
    this.autoMode = v;
    this.autoPhase = 'SEEK';
    this.cultivation.message = v ? 'Chế độ TỰ ĐỘNG: nhân vật tự săn yêu thú gần nhất, đuối sức sẽ về thiền.' : 'Đã tắt chế độ tự động.';
  }

  private bindInput() {
    const down = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (k === 'tab') { e.preventDefault(); this.setAuto(!this.autoMode); this.emitHud(); return; }
      this.keys.add(k);
      if (k === 'c') { this.setMeditating(!this.meditating); this.emitHud(); }
      if (k === 'q') this.castSkill('Q');
      if (k === 'e') this.castSkill('E');
      if (k === 'r') this.castSkill('R');
      if (k === 'f') this.castSkill('F');
      if (k === ' ') { e.preventDefault(); this.tryDodge(); }
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    this.disposers.push(() => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); });

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
    if (this.trib) return;
    if (!this.swordDrawn) this.setSword(true);
    if (this.attackCooldown > 0 || this.meditating) return;
    this.attackCooldown = 0.55;
    this.player.startAttack();
    this.pendingHitT = 0.15;
  }

  // ---------------- Kỹ năng ----------------
  private castSkill(key: SkillKey) {
    if (this.trib) return;
    const def = this.skillDefs.find((s) => s.key === key);
    if (!def) return;
    if (this.cooldowns[key] > 0) return;
    if (this.mp < def.mpCost) {
      this.cultivation.message = `Không đủ Linh Lực cho ${def.name} (cần ${def.mpCost})!`;
      this.emitHud();
      return;
    }
    if (def.kind === 'buff') {
      this.mp -= def.mpCost;
      this.cooldowns[key] = def.cooldown;
      this.setMeditating(false);
      if (!this.swordDrawn) this.setSword(true);
      this.applyBuff(def);
      this.fx.spawnRing(this.player.root.position, ELEMENT_RGB[def.element], 2.4);
      this.emitHud();
      return;
    }
    // Kỹ năng sát thương: cần mục tiêu trong tầm (AoE tính thêm bán kính vùng)
    const reach = def.range + def.aoeRadius;
    const target = this.nearestBeast(reach + 0.001);
    if (!target) {
      this.cultivation.message = `Không có yêu thú nào trong tầm của ${def.name}!`;
      this.emitHud();
      return;
    }
    this.mp -= def.mpCost;
    this.cooldowns[key] = def.cooldown;
    this.setMeditating(false);
    if (!this.swordDrawn) this.setSword(true);
    this.player.root.rotation.y = Math.atan2(target.position.x - this.player.root.position.x, target.position.z - this.player.root.position.z);
    this.player.startAttack();

    const doDamage = () => this.applySkillDamage(def, target);
    if (def.aoeRadius > 0) {
      this.fx.spawnRing(target.position, ELEMENT_RGB[def.element], def.aoeRadius);
      doDamage();
    } else if (def.range > 5.5) {
      const from = this.player.root.position.add(new Vector3(0, 1.6, 0));
      const to = target.position.add(new Vector3(0, 1.2, 0));
      this.fx.spawnProjectile(from, to, ELEMENT_RGB[def.element], doDamage);
    } else {
      this.fx.spawnRing(target.position, ELEMENT_RGB[def.element], 1.6, 0.3);
      doDamage();
    }
    this.emitHud();
  }

  private applySkillDamage(def: SkillDef, center: Beast) {
    const targets = def.aoeRadius > 0
      ? this.beasts.filter((b) => b.alive && Vector3.Distance(b.position, center.position) <= def.aoeRadius + 0.5)
      : [center];
    for (const b of targets) {
      if (!b.alive) continue;
      const crit = Math.random() < this.stats.critChance;
      let dmg = this.stats.atk * def.dmgMult
        * elementFactor(def.element, b.typeDef.element)
        * (def.element === this.char.root ? ROOT_SKILL_BONUS : 1)
        * (0.9 + Math.random() * 0.2);
      if (crit) dmg *= this.stats.critDmg;
      if (def.slowSeconds > 0) b.applySlow(def.slowSeconds);
      this.fx.spawnDamage(b.position, dmg, crit);
      const killed = b.takeDamage(dmg, this.player.root.position);
      if (killed) this.handleKill(b);
      else this.cultivation.message = `${def.name} trúng ${b.displayName}! −${dmg.toFixed(0)} HP${crit ? ' (BẠO KÍCH!)' : ''}.`;
    }
  }

  private applyBuff(def: SkillDef) {
    const buff = def.buff;
    if (!buff) return;
    if (buff.type === 'heal') {
      const amount = this.stats.maxHp * buff.value;
      this.hp = Math.min(this.stats.maxHp, this.hp + amount);
      this.cultivation.message = `${def.name}: hồi ${amount.toFixed(0)} HP!`;
    } else if (buff.type === 'shield') {
      this.shield = buff.value; this.shieldT = buff.duration;
      this.cultivation.message = `${def.name}: khiên hấp thụ ${buff.value} sát thương trong ${buff.duration}s!`;
    } else if (buff.type === 'speed') {
      this.speedBuffValue = buff.value; this.speedBuffT = buff.duration;
      this.cultivation.message = `${def.name}: tốc độ +${Math.round((buff.value - 1) * 100)}% trong ${buff.duration}s!`;
    }
  }

  private handleKill(b: Beast) {
    const r = b.rewards();
    this.cultivation.addBeastReward(r.tuVi, r.linhThach, r.insight, b.displayName);
  }

  // ---------------- Đột phá + Thiên kiếp ----------------
  private tryBreakthrough() {
    if (this.trib) return;
    const c = this.cultivation;
    if (!c.canBreakthrough) { c.breakthrough(); this.emitHud(); return; }
    if (c.stage.isRealmUp) {
      this.startTribulation();
    } else {
      const ok = c.breakthrough();
      if (ok) { this.hp = this.stats.maxHp; this.mp = this.stats.maxMp; }
    }
    this.emitHud();
  }

  private makeStrikes(): { pos: Vector3; mesh: Mesh }[] {
    const out: { pos: Vector3; mesh: Mesh }[] = [];
    const pp = this.player.root.position;
    for (let i = 0; i < TRIBULATION.strikesPerWave; i++) {
      let p: Vector3;
      if (i === 0) p = pp.clone(); // tia đầu nhắm thẳng người chơi — buộc phải di chuyển
      else {
        const a = Math.random() * Math.PI * 2, d = 1.5 + Math.random() * 4;
        p = new Vector3(pp.x + Math.cos(a) * d, 0, pp.z + Math.sin(a) * d);
      }
      const len = Math.hypot(p.x, p.z);
      if (len > 38) { p.x *= 38 / len; p.z *= 38 / len; }
      p.y = groundHeight(p.x, p.z);
      out.push({ pos: p.clone(), mesh: this.fx.spawnTelegraph(p, TRIBULATION.strikeRadius) });
    }
    return out;
  }

  private startTribulation() {
    this.setAuto(false);
    this.autoMode = false;
    this.setMeditating(false);
    this.trib = { wave: 1, phase: 'warn', t: TRIBULATION.warningSeconds, strikes: this.makeStrikes() };
    this.cultivation.message = `🌩️ THIÊN KIẾP giáng xuống! Né các vòng đỏ — đợt 1/${TRIBULATION.waves}!`;
  }

  private cleanupTrib() {
    if (!this.trib) return;
    for (const s of this.trib.strikes) s.mesh.dispose();
    this.trib = null;
  }

  private updateTribulation(dt: number) {
    const trib = this.trib;
    if (!trib) return;
    if (trib.phase === 'warn') {
      for (const s of trib.strikes) {
        const m = s.mesh.material as StandardMaterial | null;
        if (m) m.alpha = 0.35 + 0.25 * Math.abs(Math.sin(this.time * 9));
      }
    }
    trib.t -= dt;
    if (trib.t > 0) return;
    if (trib.phase === 'warn') {
      for (const s of trib.strikes) {
        this.fx.spawnLightning(s.pos);
        const d = Vector3.Distance(this.player.root.position, s.pos);
        if (d <= TRIBULATION.strikeRadius && this.invulnT <= 0) {
          this.damagePlayer(TRIBULATION.strikeDamage, 'Thiên kiếp');
          if (!this.trib) return; // đã thất bại trong damagePlayer
        }
        s.mesh.dispose();
      }
      trib.strikes = [];
      trib.phase = 'pause';
      trib.t = TRIBULATION.pauseSeconds;
    } else {
      if (trib.wave >= TRIBULATION.waves) {
        this.trib = null;
        const ok = this.cultivation.breakthrough(TRIBULATION.successBonus);
        if (ok) { this.hp = this.stats.maxHp; this.mp = this.stats.maxMp; }
        else this.cultivation.message = `Vượt qua thiên kiếp nhưng đột phá vẫn thất bại. ${this.cultivation.message}`;
        if (ok) this.cultivation.message = `⚡ Vượt thiên kiếp! ${this.cultivation.message}`;
      } else {
        trib.wave += 1;
        trib.strikes = this.makeStrikes();
        trib.phase = 'warn';
        trib.t = TRIBULATION.warningSeconds;
        this.cultivation.message = `🌩️ Thiên Kiếp — đợt ${trib.wave}/${TRIBULATION.waves}! Né vòng đỏ!`;
      }
    }
  }

  private tribulationFail() {
    this.cleanupTrib();
    this.cultivation.applyBreakthroughFailure('🌩️ Gục ngã dưới thiên kiếp! Đột phá thất bại: mất 15% Tu Vi, Căn Cơ −15. HP hồi lại 30%.');
    this.hp = this.stats.maxHp * 0.3;
  }

  // ---------------- Sát thương lên người chơi ----------------
  private damagePlayer(raw: number, sourceLabel: string) {
    if (this.invulnT > 0) return;
    let dmg = mitigate(raw, this.stats.def);
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed; dmg -= absorbed;
    }
    this.hp -= dmg;
    this.player.flash();
    if (this.meditating) this.setMeditating(false);
    if (this.hp <= 0) {
      if (this.trib) { this.tribulationFail(); return; }
      this.hp = this.stats.maxHp;
      this.player.root.position.set(0, 0, 3);
      this.cultivation.message = `Bị ${sourceLabel} đánh trọng thương! Được đưa về sân tu luyện, HP hồi đầy.`;
    } else if (sourceLabel !== 'Thiên kiếp') {
      this.cultivation.message = `${sourceLabel} tấn công! −${dmg.toFixed(0)} HP.`;
    } else {
      this.cultivation.message = `⚡ Sét đánh trúng! −${dmg.toFixed(0)} HP. Hãy né vòng đỏ!`;
    }
    this.emitHud();
  }

  // ---------------- Sự kiện tu luyện ----------------
  private chooseEvent(choice: number) {
    if (!this.pendingEvent) return;
    const msg = this.cultivation.applyEventChoice(this.pendingEvent.def.id, choice);
    if (msg) this.cultivation.message = msg;
    this.pendingEvent = null;
    this.eventT = 45 + Math.random() * 45;
    this.cultivation.save();
  }

  private updateEvents(dt: number) {
    if (this.pendingEvent) {
      this.pendingEvent.expires -= dt;
      if (this.pendingEvent.expires <= 0) {
        this.pendingEvent = null;
        this.cultivation.message = 'Kỳ ngộ tan biến như mây khói...';
        this.eventT = 45 + Math.random() * 45;
      }
      return;
    }
    if (this.meditating && !this.trib) {
      this.eventT -= dt;
      if (this.eventT <= 0) {
        const def = CULT_EVENTS[Math.floor(Math.random() * CULT_EVENTS.length)];
        this.pendingEvent = { def, expires: 20 };
        this.cultivation.message = `Kỳ ngộ xuất hiện: ${def.title} — hãy lựa chọn!`;
      }
    }
  }

  private moveDirection(): Vector3 {
    const f = (this.keys.has('w') ? 1 : 0) - (this.keys.has('s') ? 1 : 0);
    const r = (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0);
    const alpha = this.camera.alpha;
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
    for (const k of Object.keys(this.cooldowns)) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    this.shieldT = Math.max(0, this.shieldT - dt);
    if (this.shieldT <= 0) this.shield = 0;
    this.speedBuffT = Math.max(0, this.speedBuffT - dt);
    this.clouds.move(dt);
    this.fx.update(dt);

    let moving = false;
    const pos = this.player.root.position;

    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      this.movePlayer(this.dodgeDir, 13, dt);
      moving = true;
    } else if (this.trib) {
      const dir = this.moveDirection();
      if (dir.lengthSquared() > 0.01) { this.movePlayer(dir, this.moveSpeed(), dt); moving = true; }
    } else if (this.autoMode) {
      moving = this.updateAuto(dt);
    } else if (!this.meditating) {
      const dir = this.moveDirection();
      if (dir.lengthSquared() > 0.01) { this.movePlayer(dir, this.moveSpeed(), dt); moving = true; }
    }

    // --- Yêu thú (trong thiên kiếp: quái bỏ qua người chơi) ---
    for (const b of this.beasts) {
      const res = b.update(dt, pos, this.time, { ignorePlayer: !!this.trib });
      if (res.attacked) this.damagePlayer(res.dmg, b.displayName);
    }

    // --- Đòn đánh thường đang chờ trúng ---
    if (this.pendingHitT > 0) {
      this.pendingHitT -= dt;
      if (this.pendingHitT <= 0) {
        const target = this.nearestBeast(3.2);
        if (target) {
          const crit = Math.random() < this.stats.critChance;
          let dmg = this.stats.atk * (0.85 + Math.random() * 0.35)
            * elementFactor(this.char.root, target.typeDef.element) * ROOT_SKILL_BONUS;
          if (crit) dmg *= this.stats.critDmg;
          this.fx.spawnDamage(target.position, dmg, crit);
          const killed = target.takeDamage(dmg, pos);
          if (killed) this.handleKill(target);
          else this.cultivation.message = `Chém trúng ${target.displayName}! −${dmg.toFixed(0)} HP${crit ? ' (BẠO KÍCH!)' : ''}.`;
          this.emitHud();
        }
      }
    }

    // --- Thiên kiếp + sự kiện + tu luyện ---
    this.updateTribulation(dt);
    this.updateEvents(dt);
    this.cultivation.tick(dt, this.meditating);
    const st = this.stats;
    this.hp = Math.min(st.maxHp, this.hp + dt * (this.meditating ? 2.5 : 0.6));
    this.mp = Math.min(st.maxMp, this.mp + dt * 4);

    this.player.medParticles.emitter = pos.add(new Vector3(0, 0.4, 0));
    this.player.update(dt, { moving, meditating: this.meditating, swordDrawn: this.swordDrawn, time: this.time });
    const camTarget = pos.add(new Vector3(0, 1.5, 0));
    this.camera.target = Vector3.Lerp(this.camera.target, camTarget, Math.min(1, dt * 6));

    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.2; this.emitHud(); }
    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 5; this.cultivation.save(); }
  }

  private updateAuto(dt: number): boolean {
    const pos = this.player.root.position;
    const st = this.stats;
    const hpRatio = this.hp / st.maxHp;

    if (hpRatio < 0.25) this.autoPhase = 'RETREAT';
    if (this.autoPhase === 'RETREAT') {
      const home = new Vector3(0, 0, 3);
      const dir = home.subtract(pos); dir.y = 0;
      if (dir.length() > 1) { this.movePlayer(dir.normalize(), this.moveSpeed() + 0.8, dt); this.setMeditating(false); return true; }
      this.autoPhase = 'MEDITATE';
    }
    const target = this.nearestBeast();
    if (this.autoPhase === 'MEDITATE') {
      if (!target && hpRatio > 0.5) { if (!this.meditating) this.setMeditating(true); return false; }
      if (hpRatio >= 0.75 || (target && hpRatio > 0.4)) { this.setMeditating(false); this.autoPhase = 'SEEK'; }
      else { if (!this.meditating) this.setMeditating(true); return false; }
    }
    if (!target) { this.autoPhase = 'MEDITATE'; return false; }

    const toBeast = target.position.subtract(pos); toBeast.y = 0;
    const dist = toBeast.length();
    this.autoPhase = dist <= 2.8 ? 'ATTACK' : 'SEEK';
    if (dist > 2.4) { this.movePlayer(toBeast.normalize(), this.moveSpeed() + 0.4, dt); return true; }
    this.player.root.rotation.y = Math.atan2(toBeast.x, toBeast.z);
    if (!this.swordDrawn) this.setSword(true);
    // Ưu tiên kỹ năng Q khi hết hồi chiêu và đủ Linh Lực
    const q = this.skillDefs.find((s) => s.key === 'Q');
    if (q && this.cooldowns['Q'] <= 0 && this.mp >= q.mpCost) this.castSkill('Q');
    else this.tryAttack();
    return false;
  }

  private emitHud() {
    const c = this.cultivation;
    const st = this.stats;
    const target = this.nearestBeast();
    const anyAlive = this.beasts.some((b) => b.alive);
    const hudBeast = target ?? this.beasts[0];
    bridge.emitHud({
      charName: this.char.name,
      rootLabel: `${ELEMENT_LABEL[this.char.root]} Linh Căn`,
      schoolLabel: schoolById(this.char.school).name,
      statAtk: Math.round(st.atk), statDef: Math.round(st.def), statSpeed: Math.round(st.speed * 10) / 10,
      statCrit: Math.round(st.critChance * 100),
      tuVi: Math.floor(c.tuVi), tuViNeed: c.stage.tuViNeed, canCo: Math.floor(c.canCo), ngoTinh: c.ngoTinh,
      linhThach: c.linhThach,
      realmLabel: `${c.stage.realm} — ${c.stage.sub}`, stageIndex: c.stageIndex,
      methodId: c.methodId,
      hp: Math.ceil(this.hp), maxHp: st.maxHp, mp: Math.floor(this.mp), maxMp: st.maxMp,
      shield: Math.ceil(this.shield),
      meditating: this.meditating, swordDrawn: this.swordDrawn, autoMode: this.autoMode,
      autoPhase: this.autoMode ? this.autoPhase : '',
      skills: this.skillDefs.map((d) => ({
        key: d.key, name: d.name, element: d.element, cdLeft: this.cooldowns[d.key] ?? 0, cdTotal: d.cooldown, mpCost: d.mpCost,
        ready: (this.cooldowns[d.key] ?? 0) <= 0 && this.mp >= d.mpCost,
      })),
      beast: {
        name: hudBeast ? hudBeast.displayName : 'Yêu thú',
        hp: hudBeast ? Math.max(0, Math.ceil(hudBeast.hp)) : 0,
        maxHp: hudBeast ? hudBeast.maxHp : 1,
        alive: hudBeast ? hudBeast.alive : false,
        anyAlive, elite: hudBeast ? hudBeast.elite : false,
      },
      message: c.message, canBreakthrough: c.canBreakthrough, breakthroughChance: c.chance,
      isRealmUpNext: c.stage.isRealmUp, kills: c.kills,
      pendingEvent: this.pendingEvent
        ? { id: this.pendingEvent.def.id, title: this.pendingEvent.def.title, desc: this.pendingEvent.def.desc, choices: this.pendingEvent.def.choices, expiresIn: Math.ceil(this.pendingEvent.expires) }
        : null,
      tribActive: !!this.trib, tribWave: this.trib ? this.trib.wave : 0, tribWaves: TRIBULATION.waves,
    });
  }

  resize() { this.engine.resize(); }
  dispose() {
    this.cleanupTrib();
    this.disposers.forEach((d) => d());
    this.engine.dispose();
  }
}
