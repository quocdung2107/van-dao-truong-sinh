import {
  Engine, Scene, Vector3, ArcRotateCamera, Mesh, StandardMaterial,
} from '@babylonjs/core';
import { buildEnvironment, setGroundProfile, groundHeight, type BuiltEnvironment } from './scene';
import { Player } from './player';
import { Beast } from './beast';
import { Cultivation } from './cultivation';
import { bridge } from './store';
import { Fx } from './fx';
import {
  SKILLS, CULT_EVENTS, TRIBULATION, LOCATIONS, TECHNIQUES,
  computeStats, mitigate, elementFactor, ROOT_SKILL_BONUS, ELEMENT_RGB,
  schoolById, ELEMENT_LABEL, locationById, beastTypeById, itemById,
  lootTierCap, equipPoolForTierCap,
  type SkillDef, type SkillKey, type CultEventDef, type LocationDef, type LocationId, type EquipSlot,
} from './data';

type AutoPhase = 'SEEK' | 'ATTACK' | 'RETREAT' | 'MEDITATE';

interface TribState {
  wave: number;
  phase: 'warn' | 'pause';
  t: number;
  strikes: { pos: Vector3; mesh: Mesh }[];
}

interface DungeonRun {
  kind: 'A' | 'B';
  wave: number;
  room: number;
  phase: 'fighting' | 'complete';
  gate1Open: boolean;
  gate2Open: boolean;
  trapT: number;
}

const SPAWN_POINTS = [
  new Vector3(9, 0, 7), new Vector3(-12, 0, 5), new Vector3(6, 0, -14), new Vector3(-8, 0, -11),
];
const CONSUMABLE_IDS = ['hoi-huyet-dan', 'hoi-linh-dan', 'tu-linh-dan'];

export class Game {
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene: Scene;
  private player: Player;
  private beasts: Beast[] = [];
  private cultivation = new Cultivation();
  private fx: Fx;
  private camera: ArcRotateCamera;
  private env: BuiltEnvironment;
  private loc: LocationDef;
  private beastSeq = 0;

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

  // Giai đoạn 2: bí cảnh
  private run: DungeonRun | null = null;
  private prevMapId: LocationId = 'thanh-van';
  private trapStrikes: { pos: Vector3; mesh: Mesh; t: number }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new Engine(canvas, true, { stencil: true });
    this.scene = new Scene(this.engine);
    this.player = new Player(this.scene);
    this.fx = new Fx(this.scene);

    // Khôi phục bản đồ đã lưu (chỉ map thường mới được lưu; bí cảnh không lưu giữa chừng)
    const savedLoc = locationById(this.cultivation.currentMapId);
    this.loc = savedLoc.kind === 'map' ? savedLoc : locationById('thanh-van');
    this.env = this.loadLocation(this.loc, true);

    const st = this.stats;
    this.hp = st.maxHp;
    this.mp = st.maxMp;

    this.camera = new ArcRotateCamera('cam', -Math.PI / 2, 1.05, 9, this.player.root.position.add(new Vector3(0, 1.5, 0)), this.scene);
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
  private get stats() {
    const st = computeStats(this.cultivation.stageIndex, this.cultivation.canCo, this.char.school, this.cultivation.equipmentBonuses());
    st.critChance += this.cultivation.techEffects().critPct / 100;
    return st;
  }
  private get skillDefs(): SkillDef[] { return SKILLS[this.char.school]; }
  private get inDungeon(): boolean { return this.loc.kind !== 'map'; }
  private moveSpeed(): number { return this.stats.speed * (this.speedBuffT > 0 ? this.speedBuffValue : 1); }

  // ---------------- Địa điểm / du hành ----------------
  private loadLocation(loc: LocationDef, first = false): BuiltEnvironment {
    this.cleanupTrib();
    this.clearTrapStrikes();
    this.run = null;
    for (const b of this.beasts) b.dispose();
    this.beasts = [];
    if (!first) this.env.dispose();
    setGroundProfile(loc.groundProfile);
    this.loc = loc;
    const env = buildEnvironment(this.scene, loc);
    const [sx, sz] = loc.spawn;
    this.player.root.position.set(sx, groundHeight(sx, sz), sz);
    this.player.root.rotation.y = loc.kind === 'map' ? 0 : Math.PI;
    this.setMeditating(false);
    if (loc.kind === 'map') {
      this.cultivation.counters.mapVisits[loc.id] = true;
      this.spawnMapBeasts(loc);
      this.cultivation.currentMapId = loc.id;
      this.cultivation.save();
    }
    this.syncSwordTint();
    return env;
  }

  private spawnBeasts(specs: { typeId: string; elite: boolean; pos: Vector3; statMul: number; boss?: boolean }[]) {
    for (const s of specs) {
      const b = new Beast(this.scene, beastTypeById(s.typeId), s.elite, s.pos, this.beastSeq++, {
        statMul: s.statMul, noRespawn: this.inDungeon, boss: s.boss, aggroRange: this.inDungeon ? 16 : 9,
      });
      b.onTelegraph = (pos, r) => this.fx.spawnTelegraph(pos, r);
      this.beasts.push(b);
    }
  }

  private spawnMapBeasts(loc: LocationDef) {
    const specs = SPAWN_POINTS.map((p, i) => ({
      typeId: loc.beastTypeIds[i % loc.beastTypeIds.length],
      elite: Math.random() < loc.eliteChance,
      pos: p.clone(),
      statMul: loc.beastStatMul,
    }));
    this.spawnBeasts(specs);
  }

  private travelTo(id: LocationId) {
    const target = locationById(id);
    if (target.kind !== 'map') { this.enterDungeon(target.kind === 'dungeonA' ? 'A' : 'B'); return; }
    if (this.inDungeon) { this.cultivation.message = 'Đang ở trong bí cảnh — hãy bấm "Rời bí cảnh" trước khi du hành.'; this.emitHud(); return; }
    if (this.cultivation.stageIndex < target.unlockStage) {
      this.cultivation.message = `${target.name} cần ${target.unlockLabel} mới vào được.`;
      this.emitHud(); return;
    }
    if (target.id === this.loc.id) { this.cultivation.message = `Bạn đang ở ${target.name} rồi.`; this.emitHud(); return; }
    this.setAuto(false); this.autoMode = false;
    this.env = this.loadLocation(target);
    this.cultivation.message = `Đã đến ${target.icon} ${target.name}. ${target.desc}`;
    this.afterProgressEvent();
    this.emitHud();
  }

  private enterDungeon(kind: 'A' | 'B') {
    const target = locationById(kind === 'A' ? 'bc-sao-huyet' : 'bc-dong-phu');
    if (this.inDungeon) { this.cultivation.message = 'Đang ở trong bí cảnh khác — hãy rời ra trước.'; this.emitHud(); return; }
    if (this.cultivation.stageIndex < target.unlockStage) {
      this.cultivation.message = `${target.name} cần ${target.unlockLabel} mới vào được.`;
      this.emitHud(); return;
    }
    this.prevMapId = this.loc.id;
    this.setAuto(false); this.autoMode = false;
    this.env = this.loadLocation(target);
    this.run = { kind, wave: 0, room: 0, phase: 'fighting', gate1Open: false, gate2Open: false, trapT: 4.5 };
    if (kind === 'A') {
      this.run.wave = 1;
      this.spawnDungeonWave(1);
      this.cultivation.message = `🕳️ Đã vào ${target.name} — Đợt 1/3: yêu thú đang kéo đến!`;
    } else {
      this.run.room = 1;
      this.spawnDungeonRoom(1);
      this.cultivation.message = `🏛️ Đã vào ${target.name} — Gian 1: dọn sạch yêu thú để mở kết giới!`;
    }
    this.emitHud();
  }

  private dungeonStatMul(waveOrRoom: number): number {
    return this.loc.beastStatMul * (1 + this.cultivation.stageIndex * 0.06) * (1 + (waveOrRoom - 1) * 0.15);
  }

  private spawnDungeonWave(wave: number) {
    const counts = [2, 3, 4];
    const n = counts[wave - 1] ?? 3;
    const types = this.loc.beastTypeIds;
    const specs = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + wave;
      specs.push({
        typeId: types[(i + wave) % types.length],
        elite: Math.random() < this.loc.eliteChance,
        pos: new Vector3(Math.cos(a) * 9, 0, Math.sin(a) * 9),
        statMul: this.dungeonStatMul(wave),
      });
    }
    this.spawnBeasts(specs);
  }

  private spawnDungeonRoom(room: number) {
    const mul = this.dungeonStatMul(room);
    if (room === 1) {
      this.spawnBeasts([
        { typeId: 'am-lang', elite: false, pos: new Vector3(-4, 0, 12), statMul: mul },
        { typeId: 'moc-tinh', elite: false, pos: new Vector3(4, 0, 10), statMul: mul },
      ]);
    } else if (room === 2) {
      this.spawnBeasts([
        { typeId: 'am-lang', elite: false, pos: new Vector3(0, 0, -4), statMul: mul },
        { typeId: 'moc-tinh', elite: false, pos: new Vector3(-6, 0, -8), statMul: mul },
        { typeId: 'am-lang', elite: Math.random() < 0.3, pos: new Vector3(6, 0, -8), statMul: mul },
      ]);
    } else {
      this.spawnBeasts([
        { typeId: 'thach-tuong', elite: false, pos: new Vector3(0, 0, -32), statMul: this.loc.beastStatMul * (1 + this.cultivation.stageIndex * 0.05), boss: true },
      ]);
    }
  }

  private exitDungeon() {
    if (!this.inDungeon) return;
    const back = locationById(this.prevMapId);
    this.env = this.loadLocation(back);
    this.cultivation.message = `Đã rời bí cảnh, trở về ${back.icon} ${back.name}.`;
    this.emitHud();
  }

  private ejectFromDungeon() {
    const back = locationById(this.prevMapId);
    this.env = this.loadLocation(back);
    this.hp = this.stats.maxHp * 0.3;
    this.cultivation.message = `Bị đánh trọng thương trong bí cảnh! Bị đẩy ra ngoài về ${back.name}, HP còn 30%.`;
  }

  private completeDungeonA() {
    if (!this.run) return;
    this.run.phase = 'complete';
    const c = this.cultivation;
    c.counters.dungeonAClears += 1;
    const lt = 60 + c.stageIndex * 8;
    c.gainLinhThach(lt);
    c.addTuVi(120);
    const drop = this.rollDrop(1, true);
    let dropMsg = '';
    if (drop) { c.addItem(drop.id, drop.qty); dropMsg = ` Rương báu rơi: ${drop.name}!`; }
    c.message = `🎉 Vượt qua Yêu Thú Sào Huyệt! +120 Tu Vi, +${lt} Linh Thạch.${dropMsg} Bấm "Rời bí cảnh" để trở ra.`;
    c.addChronicle('Một mình dẹp sạch Yêu Thú Sào Huyệt.');
    c.save();
    this.afterProgressEvent(true);
  }

  private handleBossKill() {
    const c = this.cultivation;
    c.counters.bossKills += 1;
    c.counters.dungeonBClears += 1;
    if (this.run) this.run.phase = 'complete';
    c.gainLinhThach(200);
    c.addTuVi(300);
    // Boss chắc chắn rơi trang bị phẩm cao nhất theo cảnh giới
    const cap = lootTierCap(c.stageIndex, 2);
    const pool = equipPoolForTierCap(cap).filter((i) => i.tier && ['Phàm', 'Hoàng', 'Huyền', 'Địa'].indexOf(i.tier) === cap);
    const fullPool = equipPoolForTierCap(cap);
    const pickFrom = pool.length ? pool : fullPool;
    const item = pickFrom[Math.floor(Math.random() * pickFrom.length)];
    if (item) c.addItem(item.id, 1);
    c.message = `👹 HỘ PHÁP THẠCH TƯỢNG ĐÃ GỤC NGÃ! +300 Tu Vi, +200 Linh Thạch${item ? `, rơi bảo vật: ${item.name}` : ''}! Bấm "Rời bí cảnh" để trở ra.`;
    c.addChronicle('Đánh bại Hộ Pháp Thạch Tượng, đoạt bảo vật Cổ Tu Động Phủ.');
    c.save();
    this.afterProgressEvent(true);
  }

  // ---------------- Rơi đồ ----------------
  private rollDrop(bonusTier: number, guaranteed = false): { id: string; name: string; qty: number } | null {
    if (!guaranteed && Math.random() >= 0.7) {
      // 30% rơi đan dược tiêu hao
      const id = CONSUMABLE_IDS[Math.floor(Math.random() * CONSUMABLE_IDS.length)];
      const it = itemById(id);
      return it ? { id, name: it.name, qty: 1 + (Math.random() < 0.4 ? 1 : 0) } : null;
    }
    const pool = equipPoolForTierCap(lootTierCap(this.cultivation.stageIndex, bonusTier));
    if (!pool.length) return null;
    const item = pool[Math.floor(Math.random() * pool.length)];
    return { id: item.id, name: item.name, qty: 1 };
  }

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
    const cul = this.cultivation;
    if (c === 'toggleMeditate') this.setMeditating(!this.meditating);
    else if (c === 'toggleSword') this.setSword(!this.swordDrawn);
    else if (c === 'toggleAuto') this.setAuto(!this.autoMode);
    else if (c === 'breakthrough') this.tryBreakthrough();
    else if (c === 'attack') this.tryAttack();
    else if (c.startsWith('skill:')) this.castSkill(c.slice(6) as SkillKey);
    else if (c.startsWith('method:')) {
      cul.methodId = c.slice(7) as typeof cul.methodId;
      cul.message = `Đổi phương pháp tu luyện: ${cul.method.name}.`;
      cul.save();
    } else if (c.startsWith('eventChoice:')) this.chooseEvent(Number(c.slice(12)));
    else if (c.startsWith('travel:')) this.travelTo(c.slice(7) as LocationId);
    else if (c.startsWith('enterDungeon:')) this.enterDungeon(c.slice(13) as 'A' | 'B');
    else if (c === 'exitDungeon') this.exitDungeon();
    else if (c.startsWith('claimQuest:')) { cul.message = cul.claimQuest(c.slice(11)); }
    else if (c.startsWith('questChoice:')) {
      const [id, ch] = c.slice(12).split(':');
      cul.message = cul.chooseQuest(id, Number(ch));
    }
    else if (c.startsWith('learnTech:')) { cul.message = cul.learnTechnique(c.slice(10)); }
    else if (c.startsWith('toggleTech:')) { cul.message = cul.toggleTechnique(c.slice(11)); }
    else if (c.startsWith('equip:')) { cul.message = cul.equip(c.slice(6)); this.syncSwordTint(); }
    else if (c.startsWith('unequip:')) { cul.message = cul.unequip(c.slice(8) as EquipSlot); this.syncSwordTint(); }
    else if (c.startsWith('useItem:')) this.useItem(c.slice(8));
    else if (c.startsWith('buyItem:')) { cul.message = cul.buy(c.slice(8)); }
    else if (c.startsWith('sellItem:')) { cul.message = cul.sell(c.slice(9)); }
    else if (c === 'resetSave') {
      this.cleanupTrib();
      this.pendingEvent = null;
      cul.reset();
      this.env = this.loadLocation(locationById('thanh-van'));
      this.hp = this.stats.maxHp; this.mp = this.stats.maxMp; this.shield = 0;
    }
    this.emitHud();
  }

  private useItem(itemId: string) {
    const it = itemById(itemId);
    const cul = this.cultivation;
    if (!it || it.kind !== 'consumable') { cul.message = 'Vật phẩm này không dùng trực tiếp được.'; return; }
    if (!cul.removeItem(itemId, 1)) { cul.message = `Không có ${it.name} trong túi.`; return; }
    if (it.effect === 'healHp') {
      const amount = this.stats.maxHp * (it.effectValue ?? 0.5);
      this.hp = Math.min(this.stats.maxHp, this.hp + amount);
      cul.message = `Dùng ${it.name}: hồi ${amount.toFixed(0)} HP!`;
    } else if (it.effect === 'restoreMp') {
      this.mp = this.stats.maxMp;
      cul.message = `Dùng ${it.name}: Linh Lực đầy tràn!`;
    } else if (it.effect === 'gainTuVi') {
      cul.addTuVi(it.effectValue ?? 80);
      cul.message = `Luyện hóa ${it.name}: +${it.effectValue ?? 80} Tu Vi!`;
    }
    cul.save();
  }

  private syncSwordTint() {
    const wid = this.cultivation.equipped.weapon;
    const it = wid ? itemById(wid) : undefined;
    this.player.setBladeTint(it?.swordRgb ?? [0.35, 0.6, 1]);
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
    const cdMult = 1 - this.cultivation.techEffects().cdPct / 100;
    if (def.kind === 'buff') {
      this.mp -= def.mpCost;
      this.cooldowns[key] = def.cooldown * cdMult;
      this.setMeditating(false);
      if (!this.swordDrawn) this.setSword(true);
      this.applyBuff(def);
      this.fx.spawnRing(this.player.root.position, ELEMENT_RGB[def.element], 2.4);
      this.emitHud();
      return;
    }
    const reach = def.range + def.aoeRadius;
    const target = this.nearestBeast(reach + 0.001);
    if (!target) {
      this.cultivation.message = `Không có yêu thú nào trong tầm của ${def.name}!`;
      this.emitHud();
      return;
    }
    this.mp -= def.mpCost;
    this.cooldowns[key] = def.cooldown * cdMult;
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
    const techDmg = 1 + this.cultivation.techEffects().dmgPct / 100;
    for (const b of targets) {
      if (!b.alive) continue;
      const crit = Math.random() < this.stats.critChance;
      let dmg = this.stats.atk * def.dmgMult * techDmg
        * elementFactor(def.element, b.typeDef.element)
        * (def.element === this.char.root ? ROOT_SKILL_BONUS : 1)
        * (0.9 + Math.random() * 0.2);
      if (crit) dmg *= this.stats.critDmg;
      if (def.slowSeconds > 0) b.applySlow(def.slowSeconds);
      const res = b.takeDamage(dmg, this.player.root.position, def.element);
      this.fx.spawnDamage(b.position, res.dealt, crit);
      if (res.killed) this.handleKill(b);
      else if (res.shieldBroken) this.cultivation.message = `💥 PHÁ KHIÊN! ${b.displayName} choáng 3 giây — dồn sát thương ngay!`;
      else if (res.shieldHit) this.cultivation.message = `🛡️ Đòn hệ ${ELEMENT_LABEL[def.element]} làm rung khiên! Còn ${b.shieldHits} lớp khiên.`;
      else this.cultivation.message = `${def.name} trúng ${b.displayName}! −${res.dealt.toFixed(0)} HP${crit ? ' (BẠO KÍCH!)' : ''}.`;
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
    const c = this.cultivation;
    c.counters.killsByType[b.typeDef.id] = (c.counters.killsByType[b.typeDef.id] ?? 0) + 1;
    if (b.elite) {
      c.counters.eliteKills += 1;
      if (c.counters.eliteKills === 1) c.addChronicle('Lần đầu hạ yêu thú tinh anh ⭐.');
    }
    if (b.boss) { this.handleBossKill(); return; }
    const r = b.rewards();
    c.addBeastReward(r.tuVi, r.linhThach, r.insight, b.displayName);
    const dropChance = b.elite ? 0.4 : 0.12;
    if (Math.random() < dropChance) {
      const drop = this.rollDrop(b.elite ? 1 : 0);
      if (drop) {
        c.addItem(drop.id, drop.qty);
        c.message += ` 🎁 Rơi: ${drop.name}${drop.qty > 1 ? ` ×${drop.qty}` : ''}! (Túi đồ — phím B)`;
        c.save();
      }
    }
    this.afterProgressEvent();
  }

  /** Toast khi có nhiệm vụ vừa hoàn thành (giữ nguyên message nếu keepMessage=true) */
  private afterProgressEvent(keepMessage = false) {
    const names = this.cultivation.pollQuestCompletions();
    if (names.length && !keepMessage) {
      this.cultivation.message = `🎉 Nhiệm vụ hoàn thành: ${names.join(' · ')} — mở panel Nhiệm vụ (phím J) để nhận thưởng!`;
    } else if (names.length) {
      this.cultivation.message += ` 🎉 Hoàn thành nhiệm vụ: ${names.join(' · ')} (phím J nhận thưởng)`;
    }
  }

  // ---------------- Đột phá + Thiên kiếp ----------------
  private tryBreakthrough() {
    if (this.trib) return;
    const c = this.cultivation;
    if (this.inDungeon) { c.message = 'Trong bí cảnh không thể đột phá — hãy rời bí cảnh trước.'; this.emitHud(); return; }
    if (!c.canBreakthrough) { c.breakthrough(); this.emitHud(); return; }
    if (c.stage.isRealmUp) {
      this.startTribulation();
    } else {
      const ok = c.breakthrough();
      if (ok) { this.hp = this.stats.maxHp; this.mp = this.stats.maxMp; this.afterProgressEvent(true); }
    }
    this.emitHud();
  }

  private makeStrikes(): { pos: Vector3; mesh: Mesh }[] {
    const out: { pos: Vector3; mesh: Mesh }[] = [];
    const pp = this.player.root.position;
    for (let i = 0; i < TRIBULATION.strikesPerWave; i++) {
      let p: Vector3;
      if (i === 0) p = pp.clone();
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
          if (!this.trib) return;
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
        if (ok) { this.hp = this.stats.maxHp; this.mp = this.stats.maxMp; this.afterProgressEvent(true); }
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
      if (this.inDungeon) { this.ejectFromDungeon(); return; }
      this.hp = this.stats.maxHp;
      const [sx, sz] = this.loc.spawn;
      this.player.root.position.set(sx, groundHeight(sx, sz), sz);
      this.cultivation.message = `Bị ${sourceLabel} đánh trọng thương! Được đưa về điểm hồi phục, HP hồi đầy.`;
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

  // ---------------- Bí cảnh: tiến trình + bẫy ----------------
  private clearTrapStrikes() {
    for (const s of this.trapStrikes) s.mesh.dispose();
    this.trapStrikes = [];
  }

  private updateDungeon(dt: number) {
    const run = this.run;
    if (!run) return;
    // Bẫy sét gian 2 của Động Phủ
    if (run.kind === 'B' && run.room === 2 && run.phase === 'fighting') {
      run.trapT -= dt;
      if (run.trapT <= 0) {
        run.trapT = 4.5;
        const p = this.player.root.position.clone();
        p.y = groundHeight(p.x, p.z);
        this.trapStrikes.push({ pos: p, mesh: this.fx.spawnTelegraph(p, 2.0), t: 1.0 });
        this.cultivation.message = '⚠️ Trận pháp cổ trong động phủ kích hoạt — né vòng đỏ!';
      }
    }
    for (let i = this.trapStrikes.length - 1; i >= 0; i--) {
      const s = this.trapStrikes[i];
      s.t -= dt;
      const m = s.mesh.material as StandardMaterial | null;
      if (m) m.alpha = 0.35 + 0.25 * Math.abs(Math.sin(this.time * 9));
      if (s.t <= 0) {
        this.fx.spawnLightning(s.pos);
        if (Vector3.Distance(this.player.root.position, s.pos) <= 2.0 && this.invulnT <= 0) {
          this.damagePlayer(12, 'Trận pháp cổ');
        }
        s.mesh.dispose();
        this.trapStrikes.splice(i, 1);
      }
    }
    if (run.phase !== 'fighting') return;
    const allDead = this.beasts.length > 0 && this.beasts.every((b) => !b.alive);
    if (!allDead) return;
    if (run.kind === 'A') {
      if (run.wave < 3) {
        run.wave += 1;
        this.spawnDungeonWave(run.wave);
        this.cultivation.message = `🕳️ Đợt ${run.wave}/3: yêu thú kéo đến đông hơn!`;
        this.emitHud();
      } else {
        this.completeDungeonA();
        this.emitHud();
      }
    } else {
      if (run.room === 1) {
        run.room = 2;
        run.gate1Open = true;
        const gate = this.env.gates[0];
        if (gate) gate.dispose();
        this.spawnDungeonRoom(2);
        this.cultivation.message = '🔓 Kết giới gian 1 đã mở! Tiến vào gian 2 — cẩn thận, động phủ có trận pháp cổ bắn sét định kỳ.';
        this.emitHud();
      } else if (run.room === 2) {
        run.room = 3;
        run.gate2Open = true;
        const gate = this.env.gates[1];
        if (gate) gate.dispose();
        this.clearTrapStrikes();
        this.spawnDungeonRoom(3);
        this.cultivation.message = '🔓 Kết giới gian 2 đã mở! Hộ Pháp Thạch Tượng đang chờ ở gian cuối — ở 50% HP nó dựng KHIÊN, chỉ đòn hệ khắc mới phá được!';
        this.emitHud();
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
    const maxR = this.loc.moveRadius;
    if (len > maxR) { p.x *= maxR / len; p.z *= maxR / len; }
    // Cổng kết giới Động Phủ chưa mở thì không qua được
    if (this.run?.kind === 'B') {
      if (!this.run.gate1Open) p.z = Math.max(p.z, 6.8);
      else if (!this.run.gate2Open) p.z = Math.max(p.z, -17.2);
    }
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
    this.env.move(dt);
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

    const beastsSnapshot = this.beasts;
    for (const b of beastsSnapshot) {
      const res = b.update(dt, pos, this.time, { ignorePlayer: !!this.trib });
      if (res.attacked) this.damagePlayer(res.dmg, b.displayName);
      // damagePlayer có thể khiến người chơi bị đẩy khỏi bí cảnh -> beasts đã bị dispose, dừng ngay
      if (this.beasts !== beastsSnapshot) break;
    }

    if (this.pendingHitT > 0) {
      this.pendingHitT -= dt;
      if (this.pendingHitT <= 0) {
        const target = this.nearestBeast(3.2);
        if (target) {
          const crit = Math.random() < this.stats.critChance;
          let dmg = this.stats.atk * (1 + this.cultivation.techEffects().dmgPct / 100) * (0.85 + Math.random() * 0.35)
            * elementFactor(this.char.root, target.typeDef.element) * ROOT_SKILL_BONUS;
          if (crit) dmg *= this.stats.critDmg;
          const res = target.takeDamage(dmg, pos, this.char.root);
          this.fx.spawnDamage(target.position, res.dealt, crit);
          if (res.killed) this.handleKill(target);
          else if (res.shieldBroken) this.cultivation.message = `💥 PHÁ KHIÊN! ${target.displayName} choáng 3 giây — dồn sát thương ngay!`;
          else if (res.shieldHit) this.cultivation.message = `🛡️ Đòn hệ ${ELEMENT_LABEL[this.char.root]} làm rung khiên! Còn ${target.shieldHits} lớp khiên.`;
          else this.cultivation.message = `Chém trúng ${target.displayName}! −${res.dealt.toFixed(0)} HP${crit ? ' (BẠO KÍCH!)' : ''}.`;
          this.emitHud();
        }
      }
    }

    this.updateTribulation(dt);
    this.updateDungeon(dt);
    this.updateEvents(dt);
    this.cultivation.tick(dt, this.meditating, { auraTuVi: this.loc.auraTuVi, auraCanCo: this.loc.auraCanCo });
    const st = this.stats;
    this.hp = Math.min(st.maxHp, this.hp + dt * (this.meditating ? 2.5 : 0.6));
    this.mp = Math.min(st.maxMp, this.mp + dt * 4 * (1 + this.cultivation.techEffects().mpRegenPct / 100));

    this.player.medParticles.emitter = pos.add(new Vector3(0, 0.4, 0));
    this.player.update(dt, { moving, meditating: this.meditating, swordDrawn: this.swordDrawn, time: this.time });
    const camTarget = pos.add(new Vector3(0, 1.5, 0));
    this.camera.target = Vector3.Lerp(this.camera.target, camTarget, Math.min(1, dt * 6));

    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.2; this.emitHud(); }
    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 5; this.cultivation.save(); this.afterProgressEvent(); }
  }

  private updateAuto(dt: number): boolean {
    const pos = this.player.root.position;
    const st = this.stats;
    const hpRatio = this.hp / st.maxHp;

    if (hpRatio < 0.25) this.autoPhase = 'RETREAT';
    if (this.autoPhase === 'RETREAT') {
      if (this.inDungeon) {
        // Trong bí cảnh không về sân thiền được — đánh tiếp hoặc gục ngã bị đẩy ra
        this.autoPhase = 'SEEK';
      } else {
        const [sx, sz] = this.loc.spawn;
        const home = new Vector3(sx, 0, sz);
        const dir = home.subtract(pos); dir.y = 0;
        if (dir.length() > 1) { this.movePlayer(dir.normalize(), this.moveSpeed() + 0.8, dt); this.setMeditating(false); return true; }
        this.autoPhase = 'MEDITATE';
      }
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
    const boss = this.beasts.find((b) => b.boss);
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
      // Giai đoạn 2
      locationId: this.loc.id,
      locationName: `${this.loc.icon} ${this.loc.name}`,
      locations: LOCATIONS.map((l) => ({
        id: l.id, kind: l.kind, name: l.name, icon: l.icon, desc: l.desc,
        unlocked: c.stageIndex >= l.unlockStage, unlockLabel: l.unlockLabel, current: l.id === this.loc.id,
        auraLabel: l.kind === 'map' ? `Tu Vi ×${l.auraTuVi}${l.auraCanCo !== 1 ? ` · Căn Cơ ×${l.auraCanCo}` : ''} · Quái ×${l.beastStatMul}` : 'Bí cảnh — phần thưởng lớn',
      })),
      dungeon: this.run
        ? {
            active: true, kind: this.run.kind, wave: this.run.wave, room: this.run.room, phase: this.run.phase,
            bossShield: boss && boss.alive && boss.shieldActive
              ? { hits: boss.shieldHits, counterLabel: ELEMENT_LABEL[boss.counterElement] }
              : null,
          }
        : null,
      quests: c.questViews(),
      questReady: c.questReadyCount(),
      techniques: TECHNIQUES.map((t) => ({
        id: t.id, name: t.name, element: t.element, schoolLabel: schoolById(t.school).name,
        desc: t.desc, effectsLabel: t.effectsLabel, cost: t.insightCost, unlockLabel: t.unlockLabel,
        realmOk: c.stageIndex >= t.unlockStage,
        learned: c.learnedTechs.includes(t.id), active: c.activeTechs.includes(t.id),
      })),
      inventory: c.inventory.map((e) => ({ id: e.id, qty: e.qty })),
      equipped: { ...c.equipped },
      invCount: c.invCount(),
      chronicle: [...c.chronicle],
    });
  }

  resize() { this.engine.resize(); }
  dispose() {
    this.cleanupTrib();
    this.clearTrapStrikes();
    for (const b of this.beasts) b.dispose();
    this.env.dispose();
    this.disposers.forEach((d) => d());
    this.engine.dispose();
  }
}
