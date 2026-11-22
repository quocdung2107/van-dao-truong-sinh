import {
  REALM_STAGES, CULTIVATION, breakthroughChance,
  methodById, itemById, techniqueById, rewardsLabel,
  NO_TECH_EFFECTS, computeStats,
  SECLUSION, OFFLINE, LINH_FIELD, FORGE,
  spiritArrayBonus, fieldRatePerHour, fieldStorageCap, recipeByItemId, enhanceCost,
  effectiveItemStats, lootTierCap, equipPoolForTierCap,
  BEAST_TYPES, locationById,
  type Element, type SchoolId, type MethodId, type LocationId, type EquipSlot,
  type EquipBonuses, type TechEffects, type CounterKey, type QuestDef, type QuestRewards,
  type CultivationMethod,
  QUESTS, LOCATIONS,
} from './data';

const SAVE_KEY_V4 = 'van-dao-truong-sinh-save-v4';
const SAVE_KEY_V3 = 'van-dao-truong-sinh-save-v3';
const SAVE_KEY_V2 = 'van-dao-truong-sinh-save-v2';
const SAVE_KEY_V1 = 'van-dao-truong-sinh-save-v1';

export interface CharacterInfo { name: string; root: Element; school: SchoolId }

export interface Counters {
  killsByType: Record<string, number>;
  eliteKills: number;
  meditateSeconds: number;
  breakthroughs: number;
  mapVisits: Record<string, boolean>;
  dungeonAClears: number;
  dungeonBClears: number;
  bossKills: number;
  linhThachEarned: number;
}
function emptyCounters(): Counters {
  return { killsByType: {}, eliteKills: 0, meditateSeconds: 0, breakthroughs: 0, mapVisits: {}, dungeonAClears: 0, dungeonBClears: 0, bossKills: 0, linhThachEarned: 0 };
}

/** Vật phẩm tiêu hao: xếp chồng theo itemId như cũ */
export interface InvEntry { id: string; qty: number }
/** Trang bị: từng món riêng lẻ, có uid + cấp cường hóa (Giai đoạn 3) */
export interface EquipInstance { uid: string; itemId: string; enhance: number }
export interface QuestState { base: number; claims: number; done: boolean; notified: boolean }
export type EquippedMap = Record<EquipSlot, string | null>; // giá trị = uid của instance (v4)
function emptyEquipped(): EquippedMap { return { weapon: null, armor: null, boots: null, accessory: null }; }

// =====================================================================
// GIAI ĐOẠN 3 — Offline progress (công thức thuần, server-ready)
// =====================================================================

export type OfflineKind = 'meditate' | 'seclusion' | 'hunt';
export interface OfflineActivity { kind: OfflineKind; mapId: LocationId; methodId: MethodId }

export interface OfflineReport {
  fromAt: number;
  toAt: number;
  /** Tổng thời gian vắng mặt (giây) */
  elapsedSeconds: number;
  /** Thời gian thực tính thành quả sau khi áp trần (giây) */
  countedSeconds: number;
  capSeconds: number;
  activity: OfflineActivity;
  tuVi: number;
  canCo: number;
  ngoTinh: number;
  linhThach: number;
  linhThao: number;
  kills: number;
  items: { itemId: string; name: string; qty: number }[];
  /** Linh Thảo Linh Điền tích lũy thêm trong lúc vắng mặt (vào kho chờ thu hoạch khi nhận) */
  fieldGained: number;
}

/** Ảnh chụp trạng thái tối thiểu để tính offline — hàm thuần, không phụ thuộc localStorage */
export interface OfflineSnapshot {
  stageIndex: number;
  tuVi: number;
  canCo: number;
  character: CharacterInfo | null;
  activity: OfflineActivity;
  spiritArrayLevel: number;
  linhFieldLevel: number;
  tech: TechEffects;
  equip: EquipBonuses;
  /** Hạt giống RNG (lastActiveAt) — cùng input cho cùng kết quả rơi đồ */
  seed: number;
}

/** RNG xác định theo hạt giống (mulberry32) */
export function mulberry32(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Tốc độ Tu Vi thiền mỗi giây — DÙNG CHUNG cho vòng lặp trực tiếp (tick) và offline.
 * = cơ bản × hệ số phương pháp × (1 + TuVi% công pháp) × linh khí bản đồ × Tụ Linh Trận
 * × 1.3 nếu phương pháp tương hợp linh căn (Vận Chu Thiên).
 */
export function meditateTuViRate(method: CultivationMethod, auraTuVi: number, techTuViPct: number, spiritArrayLevel: number): number {
  let rate = CULTIVATION.tuViPerSecond * method.tuViMult * (1 + techTuViPct / 100) * auraTuVi
    * spiritArrayBonus(spiritArrayLevel).tuViMul;
  if (method.affinity === 'root') rate *= 1.3;
  return rate;
}
/** Tốc độ Căn Cơ thiền mỗi giây — dùng chung tick + offline */
export function meditateCanCoRate(method: CultivationMethod, auraCanCo: number, techCanCoPct: number): number {
  return method.canCoPerSecond * (1 + techCanCoPct / 100) * auraCanCo;
}

export interface OfflineGains {
  tuVi: number; canCo: number; ngoTinh: number; linhThach: number; linhThao: number;
  kills: number; items: { itemId: string; qty: number }[];
}

/** HÀM THUẦN: tính thành quả offline từ snapshot + số giây đã áp trần. Cùng input -> cùng output. */
export function computeOffline(snap: OfflineSnapshot, seconds: number): OfflineGains {
  const gains: OfflineGains = { tuVi: 0, canCo: 0, ngoTinh: 0, linhThach: 0, linhThao: 0, kills: 0, items: [] };
  if (seconds <= 0) return gains;
  const stage = REALM_STAGES[Math.min(snap.stageIndex, REALM_STAGES.length - 1)];
  const loc = locationById(snap.activity.mapId);
  const tuViRoom = Math.max(0, stage.tuViNeed - snap.tuVi);
  const canCoRoom = Math.max(0, 100 - snap.canCo);

  if (snap.activity.kind === 'meditate' || snap.activity.kind === 'seclusion') {
    const method = snap.activity.kind === 'seclusion' ? methodById('tinh-toa') : methodById(snap.activity.methodId);
    let rate = meditateTuViRate(method, loc.auraTuVi, snap.tech.tuViPct, snap.spiritArrayLevel);
    if (snap.activity.kind === 'seclusion') rate *= SECLUSION.tuViRateMult;
    gains.tuVi = Math.min(tuViRoom, Math.floor(rate * seconds));
    const canCoRate = snap.activity.kind === 'seclusion'
      ? SECLUSION.canCoPerSecond
      : meditateCanCoRate(method, loc.auraCanCo, snap.tech.canCoPct);
    gains.canCo = Math.min(canCoRoom, Math.floor(canCoRate * seconds * 10) / 10);
    if (snap.activity.kind === 'meditate' && method.insightEverySeconds > 0) {
      gains.ngoTinh = Math.floor(seconds / method.insightEverySeconds);
    }
    return gains;
  }

  // ---- hunt: ước tính theo DPS người chơi so với HP quái trung bình của bản đồ ----
  const school = snap.character?.school ?? 'kiem';
  const stats = computeStats(snap.stageIndex, snap.canCo, school, snap.equip);
  const dps = Math.max(1, stats.atk * OFFLINE.huntDpsFactor);
  const types = loc.beastTypeIds.map((id) => BEAST_TYPES.find((b) => b.id === id)).filter((b) => !!b);
  const list = types.length ? types : [BEAST_TYPES[0]];
  const eliteHpFactor = 1 + loc.eliteChance * 2; // tinh anh HP ×3 -> trung bình cộng thêm
  const avgHp = (list.reduce((s, b) => s + b.maxHp, 0) / list.length) * loc.beastStatMul * eliteHpFactor;
  const avgKillSeconds = Math.min(OFFLINE.huntMaxKillSeconds, Math.max(OFFLINE.huntMinKillSeconds, avgHp / dps));
  const kills = Math.min(OFFLINE.huntMaxKills, Math.floor(seconds / avgKillSeconds));
  gains.kills = kills;
  const rewardMul = loc.beastStatMul * (1 + loc.eliteChance * 1); // tinh anh thưởng ×2 -> trung bình +eliteChance
  const avgTuVi = list.reduce((s, b) => s + b.tuViReward, 0) / list.length;
  const avgLt = list.reduce((s, b) => s + (b.linhThachMin + b.linhThachMax) / 2, 0) / list.length;
  gains.tuVi = Math.min(tuViRoom, Math.floor(kills * avgTuVi * rewardMul));
  gains.linhThach = Math.floor(kills * avgLt * rewardMul);
  gains.linhThao = Math.floor(kills * OFFLINE.linhThaoPerKill);
  // Rơi đồ: RNG theo hạt giống, tối đa OFFLINE.maxDropRolls vật phẩm
  const rng = mulberry32(Math.floor(snap.seed / 1000));
  const rolls = Math.min(OFFLINE.maxDropRolls, Math.floor(kills / OFFLINE.killsPerDropRoll));
  for (let i = 0; i < rolls; i++) {
    if (rng() >= OFFLINE.dropChancePerRoll) continue;
    if (rng() < 0.7) {
      const pool = equipPoolForTierCap(lootTierCap(snap.stageIndex, 0));
      if (pool.length) gains.items.push({ itemId: pool[Math.floor(rng() * pool.length)].id, qty: 1 });
    } else {
      const consumables = ['hoi-huyet-dan', 'hoi-linh-dan', 'tu-linh-dan'];
      gains.items.push({ itemId: consumables[Math.floor(rng() * consumables.length)], qty: 1 });
    }
  }
  return gains;
}

// ---------- Kiểu save ----------
export interface SaveDataV4 {
  version: 4;
  character: CharacterInfo | null;
  stageIndex: number; tuVi: number; canCo: number; ngoTinh: number; kills: number;
  linhThach: number; methodId: MethodId;
  currentMapId: LocationId;
  inventory: InvEntry[];
  equipInstances: EquipInstance[];
  equipped: EquippedMap;
  learnedTechs: string[];
  activeTechs: string[];
  questState: Record<string, QuestState>;
  counters: Counters;
  chronicle: string[];
  // Giai đoạn 3
  linhThao: number;
  tinhHoa: number;
  lastActiveAt: number;
  offlineActivity: OfflineActivity;
  pendingOffline: OfflineReport | null;
  buildings: { spiritArray: number; linhField: number };
  fieldStored: number;
  fieldUpdatedAt: number;
  breakthroughBonus: boolean;
  uidSeq: number;
}

interface SaveDataV3 {
  version: 3;
  character: CharacterInfo | null;
  stageIndex: number; tuVi: number; canCo: number; ngoTinh: number; kills: number;
  linhThach: number; methodId: MethodId;
  currentMapId: LocationId;
  inventory: InvEntry[];
  equipped: Record<EquipSlot, string | null>;
  learnedTechs: string[];
  activeTechs: string[];
  questState: Record<string, QuestState>;
  counters: Counters;
  chronicle: string[];
}
interface SaveDataV2 {
  version: 2; character: CharacterInfo | null;
  stageIndex: number; tuVi: number; canCo: number; ngoTinh: number; kills: number;
  linhThach: number; methodId: MethodId;
}
interface SaveDataV1 { stageIndex: number; tuVi: number; canCo: number; ngoTinh: number; kills: number }

/** Đọc nhân vật từ save (v4 -> v3 -> v2). v1 không có nhân vật -> null. */
export function peekCharacter(): CharacterInfo | null {
  try {
    const raw4 = localStorage.getItem(SAVE_KEY_V4);
    if (raw4) return (JSON.parse(raw4) as SaveDataV4).character ?? null;
    const raw3 = localStorage.getItem(SAVE_KEY_V3);
    if (raw3) return (JSON.parse(raw3) as SaveDataV3).character ?? null;
    const raw2 = localStorage.getItem(SAVE_KEY_V2);
    if (raw2) return (JSON.parse(raw2) as SaveDataV2).character ?? null;
    return null;
  } catch { return null; }
}

/** Tạo nhân vật: giữ lại tiến trình nếu đang migrate từ save cũ, ghi save v4. */
export function createCharacterSave(info: CharacterInfo) {
  const c = new Cultivation();
  c.character = info;
  c.message = `Chào mừng ${info.name} nhập đạo tại Thanh Vân Sơn. Hãy tĩnh tọa (C) để tu luyện.`;
  c.save();
}

export interface QuestView {
  id: string; group: string; name: string; desc: string; kind: 'counter' | 'choice';
  progress: number; target: number;
  state: 'active' | 'ready' | 'done' | 'hidden';
  repeatable: boolean; rewardsText: string;
  choices?: [string, string]; choiceRewardsText?: [string, string];
}

export class Cultivation {
  character: CharacterInfo | null = null;
  stageIndex = 0;
  tuVi = 0;
  canCo = 30;
  ngoTinh = 0;
  kills = 0;
  linhThach = 0;
  methodId: MethodId = 'tinh-toa';
  // Giai đoạn 2
  currentMapId: LocationId = 'thanh-van';
  inventory: InvEntry[] = [];
  equipInstances: EquipInstance[] = [];
  equipped: EquippedMap = emptyEquipped();
  learnedTechs: string[] = [];
  activeTechs: string[] = [];
  questState: Record<string, QuestState> = {};
  counters: Counters = emptyCounters();
  chronicle: string[] = [];
  // Giai đoạn 3
  linhThao = 0;
  tinhHoa = 0;
  lastActiveAt = 0;
  offlineActivity: OfflineActivity = { kind: 'meditate', mapId: 'thanh-van', methodId: 'tinh-toa' };
  pendingOffline: OfflineReport | null = null;
  buildings = { spiritArray: 0, linhField: 0 };
  fieldStored = 0;
  fieldUpdatedAt = 0;
  breakthroughBonus = false;
  private uidSeq = 0;
  message = 'Chào mừng đến Thanh Vân Sơn. Hãy tĩnh tọa (C) để tu luyện.';
  private insightProgress = 0;

  constructor() { this.load(); }

  get stage() { return REALM_STAGES[Math.min(this.stageIndex, REALM_STAGES.length - 1)]; }
  get isMaxStage() { return this.stageIndex >= REALM_STAGES.length - 1; }
  get canBreakthrough() {
    return !this.isMaxStage && this.tuVi >= this.stage.tuViNeed && this.canCo >= this.stage.canCoRequired;
  }
  get chance() { return breakthroughChance(this.canCo, this.stage.difficulty); }
  get method() { return methodById(this.methodId); }
  get offlineCapSeconds() { return spiritArrayBonus(this.buildings.spiritArray).capSeconds; }

  private nextUid(): string { this.uidSeq += 1; return `eq${this.uidSeq}`; }
  instanceByUid(uid: string | null): EquipInstance | undefined {
    return uid ? this.equipInstances.find((i) => i.uid === uid) : undefined;
  }
  equippedInstance(slot: EquipSlot): EquipInstance | undefined {
    return this.instanceByUid(this.equipped[slot]);
  }

  // ---------- Tu luyện ----------
  /** mods: aura của bản đồ + hiệu ứng công pháp (chỉ áp khi thiền, trừ tech áp cả hai); seclusion = bế quan */
  tick(dt: number, meditating: boolean, mods?: { auraTuVi?: number; auraCanCo?: number; seclusion?: boolean }) {
    const tech = this.techEffects();
    const techTuVi = 1 + tech.tuViPct / 100;
    if (!meditating) {
      if (!this.isMaxStage || this.tuVi < this.stage.tuViNeed) {
        this.tuVi = Math.min(this.stage.tuViNeed, this.tuVi + CULTIVATION.tuViPerSecond * techTuVi * dt);
      }
      return;
    }
    this.counters.meditateSeconds += dt;
    if (mods?.seclusion) {
      // Bế quan: Tu Vi theo tốc độ thiền Tĩnh Tọa × 2.5, Căn Cơ +0.2/s, không đốn ngộ
      const rate = meditateTuViRate(methodById('tinh-toa'), mods?.auraTuVi ?? 1, tech.tuViPct, this.buildings.spiritArray)
        * SECLUSION.tuViRateMult;
      if (!this.isMaxStage || this.tuVi < this.stage.tuViNeed) {
        this.tuVi = Math.min(this.stage.tuViNeed, this.tuVi + rate * dt);
      }
      this.canCo = Math.min(100, this.canCo + SECLUSION.canCoPerSecond * dt);
      return;
    }
    const m = this.method;
    const rate = meditateTuViRate(m, mods?.auraTuVi ?? 1, tech.tuViPct, this.buildings.spiritArray);
    if (!this.isMaxStage || this.tuVi < this.stage.tuViNeed) {
      this.tuVi = Math.min(this.stage.tuViNeed, this.tuVi + rate * dt);
    }
    this.canCo = Math.min(100, this.canCo
      + meditateCanCoRate(m, mods?.auraCanCo ?? 1, tech.canCoPct) * dt);
    if (m.insightEverySeconds > 0) {
      this.insightProgress += dt;
      if (this.insightProgress >= m.insightEverySeconds) {
        this.insightProgress = 0;
        this.ngoTinh += 1;
        this.message = 'Ngộ đạo có thành quả! +1 Ngộ Tính.';
      }
    } else if (m.insightChancePerSecond > 0 && Math.random() < m.insightChancePerSecond * dt) {
      this.ngoTinh += 1;
      this.message = 'Đốn ngộ! +1 Ngộ Tính.';
    }
  }

  gainLinhThach(n: number) {
    this.linhThach += n;
    if (n > 0) this.counters.linhThachEarned += n;
  }

  addTuVi(n: number) {
    this.tuVi = Math.min(this.stage.tuViNeed, this.tuVi + n);
  }

  addBeastReward(tuVi: number, linhThach: number, insightBonus: number, beastName: string) {
    this.addTuVi(tuVi);
    this.gainLinhThach(linhThach);
    this.kills += 1;
    let extra = '';
    if (insightBonus > 0) { this.ngoTinh += insightBonus; extra = `, +${insightBonus} Ngộ Tính`; }
    this.message = `Hạ ${beastName}! +${tuVi} Tu Vi, +${linhThach} Linh Thạch${extra}.`;
    this.save();
  }

  /** Áp dụng hình phạt thất bại dùng chung (đột phá thường + thiên kiếp). Không tụt cảnh giới. */
  applyBreakthroughFailure(reasonMsg: string) {
    this.tuVi = Math.max(0, this.tuVi - this.stage.tuViNeed * 0.15);
    this.canCo = Math.max(0, this.canCo - 15);
    this.message = reasonMsg;
    this.save();
  }

  /** @param bonusChance cộng thêm % (thiên kiếp +10). Độ Kiếp Đan +15% nếu đang có hiệu lực. @returns true nếu thành công */
  breakthrough(bonusChance = 0): boolean {
    if (!this.canBreakthrough) {
      this.message = `Chưa đủ điều kiện: cần Tu Vi đầy và Căn Cơ ≥ ${this.stage.canCoRequired}.`;
      return false;
    }
    // Chỉ tiêu thụ Độ Kiếp Đan khi thực sự tung tỉ lệ
    const danBonus = this.breakthroughBonus ? 15 : 0;
    if (this.breakthroughBonus) this.breakthroughBonus = false;
    const chance = Math.min(95, Math.max(5, this.chance + bonusChance + danBonus));
    const roll = Math.random() * 100;
    if (roll <= chance) {
      const from = `${this.stage.realm} ${this.stage.sub}`;
      this.stageIndex += 1;
      this.tuVi = 0;
      this.canCo = Math.min(100, this.canCo + 5);
      this.counters.breakthroughs += 1;
      this.message = `Đột phá thành công! ${from} → ${this.stage.realm} ${this.stage.sub}.`;
      if (this.stageIndex === 12) this.addChronicle('Kết thành Kim Đan — bước vào cảnh giới Kim Đan.');
      this.save();
      return true;
    }
    this.applyBreakthroughFailure(
      `Đột phá thất bại (tỉ lệ ${chance.toFixed(0)}%, ra ${roll.toFixed(0)}%). Mất 15% Tu Vi, Căn Cơ −15. Hãy thiền để hồi Căn Cơ.`,
    );
    return false;
  }

  /** Sự kiện tu luyện: áp lựa chọn, trả về mô tả kết quả */
  applyEventChoice(eventId: string, choice: number): string {
    if (eventId === 'don-ngo') {
      if (choice === 0) { this.ngoTinh += 3; return 'Đốn ngộ sâu xa! +3 Ngộ Tính.'; }
      this.addTuVi(60); return 'Linh quang hóa thành tu vi! +60 Tu Vi.';
    }
    if (eventId === 'di-bien') {
      if (choice === 0) {
        this.addTuVi(130);
        this.canCo = Math.max(0, this.canCo - 10);
        return 'Hấp thụ dị biến thành công! +130 Tu Vi, −10 Căn Cơ.';
      }
      this.addTuVi(25); return 'Dẫn khí an toàn. +25 Tu Vi.';
    }
    if (eventId === 'tam-ma') {
      if (choice === 0) { this.tuVi = Math.max(0, this.tuVi - 30); return 'Tâm ma tan đi nhưng hao tổn: −30 Tu Vi.'; }
      if (this.ngoTinh >= 2) { this.ngoTinh -= 2; this.canCo = Math.min(100, this.canCo + 8); return 'Trấn áp tâm ma! −2 Ngộ Tính, +8 Căn Cơ.'; }
      this.tuVi = Math.max(0, this.tuVi - 30); return 'Không đủ Ngộ Tính để trấn áp — tâm ma hao tổn: −30 Tu Vi.';
    }
    return '';
  }

  // ---------- Thiên Đạo Ký Lục ----------
  addChronicle(text: string) {
    const entry = `📜 ${text}`;
    if (!this.chronicle.includes(entry)) { this.chronicle.push(entry); this.save(); }
  }

  // ---------- Túi đồ / Trang bị ----------
  /** Số lượng sở hữu: tiêu hao đếm theo stack, trang bị đếm theo instance */
  countItem(id: string): number {
    const it = itemById(id);
    if (it?.kind === 'equip') return this.equipInstances.filter((i) => i.itemId === id).length;
    return this.inventory.find((e) => e.id === id)?.qty ?? 0;
  }
  invCount(): number {
    return this.inventory.reduce((s, e) => s + e.qty, 0) + this.equipInstances.filter((i) => !Object.values(this.equipped).includes(i.uid)).length;
  }
  /** Thêm vật phẩm: trang bị -> tạo instance riêng; tiêu hao -> xếp chồng */
  addItem(id: string, qty = 1): EquipInstance | null {
    const it = itemById(id);
    if (it?.kind === 'equip') {
      let last: EquipInstance | null = null;
      for (let n = 0; n < qty; n++) {
        last = { uid: this.nextUid(), itemId: id, enhance: 0 };
        this.equipInstances.push(last);
      }
      return last;
    }
    const e = this.inventory.find((x) => x.id === id);
    if (e) e.qty += qty; else this.inventory.push({ id, qty });
    return null;
  }
  addEquipment(itemId: string, enhance = 0): EquipInstance {
    const inst: EquipInstance = { uid: this.nextUid(), itemId, enhance };
    this.equipInstances.push(inst);
    return inst;
  }
  /** Chỉ dùng cho vật phẩm tiêu hao (stack) */
  removeItem(id: string, qty = 1): boolean {
    const e = this.inventory.find((x) => x.id === id);
    if (!e || e.qty < qty) return false;
    e.qty -= qty;
    if (e.qty <= 0) this.inventory = this.inventory.filter((x) => x.id !== id);
    return true;
  }
  /** instance đang nằm trong túi (chưa trang bị)? */
  isInBag(inst: EquipInstance): boolean {
    return !Object.values(this.equipped).includes(inst.uid);
  }
  equip(uid: string): string {
    const inst = this.instanceByUid(uid);
    if (!inst) return 'Không tìm thấy trang bị này.';
    const it = itemById(inst.itemId);
    if (!it || it.kind !== 'equip' || !it.slot) return 'Vật phẩm này không trang bị được.';
    if (!this.isInBag(inst)) return 'Trang bị này đang được đeo rồi.';
    // instance cũ ở ô này tự trở về túi (vẫn là instance riêng, giữ cấp cường hóa)
    this.equipped[it.slot] = uid;
    this.save();
    return `Đã trang bị ${it.name}${inst.enhance > 0 ? ` +${inst.enhance}` : ''}.`;
  }
  unequip(slot: EquipSlot): string {
    const uid = this.equipped[slot];
    if (!uid) return 'Chưa trang bị ô này.';
    const inst = this.instanceByUid(uid);
    this.equipped[slot] = null;
    this.save();
    return `Đã tháo ${inst ? (itemById(inst.itemId)?.name ?? inst.itemId) : 'trang bị'} — đã về túi.`;
  }
  equipmentBonuses(): EquipBonuses {
    const b: EquipBonuses = { atk: 0, def: 0, hp: 0, mp: 0, speed: 0, crit: 0 };
    for (const slot of Object.keys(this.equipped) as EquipSlot[]) {
      const inst = this.equippedInstance(slot);
      if (!inst) continue;
      const it = itemById(inst.itemId);
      if (!it) continue;
      const s = effectiveItemStats(it, inst.enhance);
      b.atk += s.atk ?? 0; b.def += s.def ?? 0; b.hp += s.hp ?? 0; b.mp += s.mp ?? 0; b.speed += s.speed ?? 0; b.crit += s.crit ?? 0;
    }
    return b;
  }
  buy(itemId: string): string {
    const it = itemById(itemId);
    if (!it || !it.price) return 'Vật phẩm này không bán trong shop.';
    if (this.linhThach < it.price) return `Không đủ Linh Thạch (cần ${it.price}).`;
    this.linhThach -= it.price;
    this.addItem(itemId, 1);
    this.save();
    return `Đã mua ${it.name} với ${it.price} Linh Thạch.`;
  }
  /** Bán vật phẩm tiêu hao theo itemId */
  sell(itemId: string): string {
    const it = itemById(itemId);
    if (!it) return 'Vật phẩm không tồn tại.';
    if (it.kind === 'equip') return 'Trang bị bán theo từng món trong danh sách trang bị ở túi đồ.';
    if (!this.removeItem(itemId, 1)) return 'Không có vật phẩm này trong túi.';
    this.gainLinhThach(it.sellPrice);
    this.save();
    return `Đã bán ${it.name}: +${it.sellPrice} Linh Thạch.`;
  }
  /** Bán 1 instance trang bị trong túi */
  sellEquipment(uid: string): string {
    const inst = this.instanceByUid(uid);
    if (!inst) return 'Không tìm thấy trang bị này.';
    if (!this.isInBag(inst)) return 'Đang trang bị — hãy tháo ra trước khi bán.';
    const it = itemById(inst.itemId);
    this.equipInstances = this.equipInstances.filter((i) => i.uid !== uid);
    const price = it?.sellPrice ?? 0;
    this.gainLinhThach(price);
    this.save();
    return `Đã bán ${it?.name ?? inst.itemId}${inst.enhance > 0 ? ` +${inst.enhance}` : ''}: +${price} Linh Thạch.`;
  }

  // ---------- Công pháp ----------
  techEffects(): TechEffects {
    const out: TechEffects = { ...NO_TECH_EFFECTS };
    for (const id of this.activeTechs) {
      const t = techniqueById(id);
      if (!t) continue;
      out.tuViPct += t.effects.tuViPct ?? 0;
      out.canCoPct += t.effects.canCoPct ?? 0;
      out.dmgPct += t.effects.dmgPct ?? 0;
      out.critPct += t.effects.critPct ?? 0;
      out.mpRegenPct += t.effects.mpRegenPct ?? 0;
      out.cdPct += t.effects.cdPct ?? 0;
    }
    return out;
  }
  learnTechnique(id: string): string {
    const t = techniqueById(id);
    if (!t) return 'Công pháp không tồn tại.';
    if (this.learnedTechs.includes(id)) return 'Đã học công pháp này rồi.';
    if (this.stageIndex < t.unlockStage) return `Cần đạt ${t.unlockLabel} mới học được.`;
    if (this.ngoTinh < t.insightCost) return `Không đủ Ngộ Tính (cần ${t.insightCost}).`;
    this.ngoTinh -= t.insightCost;
    this.learnedTechs.push(id);
    if (this.activeTechs.length < 2) this.activeTechs.push(id);
    this.save();
    return `Đã lĩnh ngộ ${t.name}! ${this.activeTechs.includes(id) ? 'Đã kích hoạt.' : 'Vào panel Công pháp (K) để kích hoạt.'}`;
  }
  toggleTechnique(id: string): string {
    const t = techniqueById(id);
    if (!t || !this.learnedTechs.includes(id)) return 'Chưa học công pháp này.';
    if (this.activeTechs.includes(id)) {
      this.activeTechs = this.activeTechs.filter((x) => x !== id);
      this.save();
      return `Đã tắt kích hoạt ${t.name}.`;
    }
    if (this.activeTechs.length >= 2) return 'Chỉ kích hoạt tối đa 2 công pháp cùng lúc. Hãy tắt bớt 1 cuốn.';
    this.activeTechs.push(id);
    this.save();
    return `Đã kích hoạt ${t.name}: ${t.effectsLabel}.`;
  }

  // ---------- Nhiệm vụ ----------
  counterValue(key: CounterKey): number {
    switch (key) {
      case 'kills': return this.kills;
      case 'eliteKills': return this.counters.eliteKills;
      case 'meditateSeconds': return Math.floor(this.counters.meditateSeconds);
      case 'breakthroughs': return this.counters.breakthroughs;
      case 'linhThachEarned': return this.counters.linhThachEarned;
      case 'dungeonAClears': return this.counters.dungeonAClears;
      case 'dungeonBClears': return this.counters.dungeonBClears;
      case 'bossKills': return this.counters.bossKills;
      case 'mapsVisited': return LOCATIONS.filter((l) => l.kind === 'map' && this.counters.mapVisits[l.id]).length;
      default: return 0;
    }
  }
  private qState(id: string): QuestState {
    if (!this.questState[id]) this.questState[id] = { base: 0, claims: 0, done: false, notified: false };
    return this.questState[id];
  }
  questTarget(q: QuestDef, st: QuestState): number {
    return (q.target ?? 0) + (q.targetStep ?? 0) * st.claims;
  }
  questViews(): QuestView[] {
    return QUESTS.map((q) => {
      const st = this.qState(q.id);
      const base: QuestView = {
        id: q.id, group: q.group, name: q.name, desc: q.desc, kind: q.kind,
        progress: 0, target: 0, state: 'active', repeatable: !!q.repeatable,
        rewardsText: q.rewards ? rewardsLabel(q.rewards) : '',
        choices: q.choices,
        choiceRewardsText: q.choiceRewards ? [rewardsLabel(q.choiceRewards[0]), rewardsLabel(q.choiceRewards[1])] : undefined,
      };
      if (st.done) return { ...base, state: 'done', progress: 1, target: 1 };
      if (q.kind === 'choice') {
        const stageOk = q.conditionStage === undefined || this.stageIndex >= q.conditionStage;
        const counterOk = !q.conditionCounter || this.counterValue(q.conditionCounter.key) >= q.conditionCounter.value;
        return { ...base, state: stageOk && counterOk ? 'ready' : 'hidden', progress: 0, target: 1 };
      }
      const target = this.questTarget(q, st);
      const progress = Math.min(target, this.counterValue(q.counter!) - st.base);
      return { ...base, progress: Math.max(0, progress), target, state: progress >= target ? 'ready' : 'active' };
    });
  }
  /** Kiểm tra nhiệm vụ vừa hoàn thành (chưa thông báo) — Game gọi sau các sự kiện để toast */
  pollQuestCompletions(): string[] {
    const names: string[] = [];
    for (const v of this.questViews()) {
      const st = this.qState(v.id);
      if (v.state === 'ready' && v.kind === 'counter' && !st.notified) {
        st.notified = true;
        names.push(v.name);
      }
    }
    if (names.length) this.save();
    return names;
  }
  questReadyCount(): number {
    return this.questViews().filter((v) => v.state === 'ready').length;
  }
  private applyRewards(r: QuestRewards) {
    if (r.tuVi) this.addTuVi(r.tuVi);
    if (r.linhThach) this.gainLinhThach(r.linhThach);
    if (r.ngoTinh) this.ngoTinh += r.ngoTinh;
    if (r.canCo) this.canCo = Math.min(100, this.canCo + r.canCo);
    if (r.itemId) this.addItem(r.itemId, r.itemQty ?? 1);
  }
  claimQuest(id: string): string {
    const q = QUESTS.find((x) => x.id === id);
    if (!q || q.kind !== 'counter') return 'Nhiệm vụ không tồn tại.';
    const view = this.questViews().find((v) => v.id === id);
    if (!view || view.state !== 'ready') return 'Chưa hoàn thành nhiệm vụ này.';
    const st = this.qState(id);
    this.applyRewards(q.rewards ?? {});
    st.claims += 1;
    st.notified = false;
    if (q.repeatable && q.counter) st.base = this.counterValue(q.counter);
    else st.done = true;
    this.save();
    return `Nhận thưởng nhiệm vụ ${q.name}: ${rewardsLabel(q.rewards ?? {})}.`;
  }
  chooseQuest(id: string, choice: number): string {
    const q = QUESTS.find((x) => x.id === id);
    if (!q || q.kind !== 'choice' || !q.choiceRewards) return 'Kỳ ngộ không tồn tại.';
    const view = this.questViews().find((v) => v.id === id);
    if (!view || view.state !== 'ready') return 'Kỳ ngộ này chưa xuất hiện.';
    const st = this.qState(id);
    const r = q.choiceRewards[choice === 0 ? 0 : 1];
    this.applyRewards(r);
    st.done = true;
    this.save();
    return `Kỳ ngộ ${q.name}: nhận ${rewardsLabel(r)}.`;
  }

  // =====================================================================
  // GIAI ĐOẠN 3 — Offline / Động phủ / Luyện đan / Luyện khí
  // =====================================================================

  private offlineSnapshot(): OfflineSnapshot {
    return {
      stageIndex: this.stageIndex, tuVi: this.tuVi, canCo: this.canCo,
      character: this.character, activity: this.offlineActivity,
      spiritArrayLevel: this.buildings.spiritArray, linhFieldLevel: this.buildings.linhField,
      tech: this.techEffects(), equip: this.equipmentBonuses(),
      seed: this.lastActiveAt,
    };
  }

  /** Sản lượng Linh Điền trong khoảng vắng mặt (dùng cho báo cáo offline, trần 48h sản lượng) */
  private fieldGainOver(elapsedSeconds: number): number {
    const rate = fieldRatePerHour(this.buildings.linhField);
    if (rate <= 0) return 0;
    return Math.floor(Math.min(elapsedSeconds / 3600, LINH_FIELD.storageCapHours) * rate);
  }

  /**
   * Chuẩn bị báo cáo offline khi khởi động game. Nếu đã có báo cáo chờ nhận -> trả lại nguyên trạng (không tính lại).
   * Trả về report vừa tính (đã lưu vào pendingOffline) hoặc null nếu chưa đủ 5 phút / đồng hồ bị lùi.
   */
  prepareOffline(now: number): OfflineReport | null {
    if (this.pendingOffline) return this.pendingOffline;
    if (this.lastActiveAt <= 0) {
      this.lastActiveAt = now;
      this.fieldUpdatedAt = now;
      this.save();
      return null;
    }
    const elapsedMs = now - this.lastActiveAt;
    if (elapsedMs < 0) { // đồng hồ bị chỉnh lùi -> không tính, chống gian lận giờ hệ thống (bản local)
      this.lastActiveAt = now;
      this.fieldUpdatedAt = now;
      this.save();
      return null;
    }
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    if (elapsedSeconds < OFFLINE.minSeconds) {
      this.accrueFieldLive(now);
      this.lastActiveAt = now;
      this.save();
      return null;
    }
    const capSeconds = this.offlineCapSeconds;
    const countedSeconds = Math.min(elapsedSeconds, capSeconds);
    const gains = computeOffline(this.offlineSnapshot(), countedSeconds);
    const report: OfflineReport = {
      fromAt: this.lastActiveAt, toAt: now,
      elapsedSeconds, countedSeconds, capSeconds,
      activity: { ...this.offlineActivity },
      tuVi: gains.tuVi, canCo: gains.canCo, ngoTinh: gains.ngoTinh,
      linhThach: gains.linhThach, linhThao: gains.linhThao,
      kills: gains.kills,
      items: gains.items.map((g) => ({ itemId: g.itemId, name: itemById(g.itemId)?.name ?? g.itemId, qty: g.qty })),
      fieldGained: this.fieldGainOver(elapsedSeconds),
    };
    this.pendingOffline = report;
    this.save();
    return report;
  }

  /**
   * Nhận thành quả offline: áp dụng ĐÚNG 1 LẦN. Gọi lần 2 (pendingOffline đã null) -> trả null, không đổi gì.
   */
  claimOffline(): OfflineReport | null {
    const r = this.pendingOffline;
    if (!r) return null;
    if (r.tuVi) this.addTuVi(r.tuVi);
    if (r.canCo) this.canCo = Math.min(100, this.canCo + r.canCo);
    if (r.ngoTinh) this.ngoTinh += r.ngoTinh;
    if (r.linhThach) this.gainLinhThach(r.linhThach);
    if (r.linhThao) this.linhThao += r.linhThao;
    if (r.kills) { this.kills += r.kills; this.counters.killsByType['offline'] = (this.counters.killsByType['offline'] ?? 0) + r.kills; }
    for (const it of r.items) this.addItem(it.itemId, it.qty);
    if (r.fieldGained > 0) {
      this.fieldStored = Math.min(fieldStorageCap(this.buildings.linhField), this.fieldStored + r.fieldGained);
    }
    this.pendingOffline = null;
    const now = Date.now();
    this.lastActiveAt = now;
    this.fieldUpdatedAt = now;
    this.message = '📜 Đã nhận thành quả offline. Đạo lộ không ngừng nghỉ!';
    this.save();
    return r;
  }

  /** Linh Điền tích lũy dần khi đang chơi (gọi định kỳ + khi mở panel). Không chạy khi đang có báo cáo offline chờ nhận. */
  accrueFieldLive(now: number): number {
    if (this.pendingOffline) return 0;
    if (this.fieldUpdatedAt <= 0) { this.fieldUpdatedAt = now; return 0; }
    const rate = fieldRatePerHour(this.buildings.linhField);
    if (rate <= 0) { this.fieldUpdatedAt = now; return 0; }
    const hours = Math.max(0, (now - this.fieldUpdatedAt) / 3600000);
    const gained = hours * rate;
    this.fieldUpdatedAt = now;
    if (gained <= 0) return 0;
    const before = this.fieldStored;
    this.fieldStored = Math.min(fieldStorageCap(this.buildings.linhField), this.fieldStored + gained);
    return this.fieldStored - before;
  }

  harvestField(): string {
    const n = Math.floor(this.fieldStored);
    if (n <= 0) return 'Linh Điền chưa có gì để thu hoạch.';
    this.fieldStored -= n;
    this.linhThao += n;
    this.save();
    return `🌿 Thu hoạch Linh Điền: +${n} Linh Thảo!`;
  }

  upgradeSpiritArray(): string {
    const lv = this.buildings.spiritArray;
    if (lv >= 5) return 'Tụ Linh Trận đã đạt cấp tối đa (5).';
    const cost = [100, 250, 600, 1400, 3000][lv];
    if (this.linhThach < cost) return `Không đủ Linh Thạch để nâng Tụ Linh Trận (cần ${cost}, có ${this.linhThach}).`;
    this.linhThach -= cost;
    this.buildings.spiritArray = lv + 1;
    const b = spiritArrayBonus(lv + 1);
    this.save();
    return `🔮 Tụ Linh Trận lên cấp ${lv + 1}! Trần offline: ${Math.round(b.capSeconds / 3600)} giờ · Tu Vi thiền ×${b.tuViMul.toFixed(2)}.`;
  }

  upgradeLinhField(): string {
    const lv = this.buildings.linhField;
    if (lv >= LINH_FIELD.maxLevel) return 'Linh Điền đã đạt cấp tối đa (3).';
    const cost = LINH_FIELD.costs[lv];
    if (this.linhThach < cost.linhThach) return `Không đủ Linh Thạch (cần ${cost.linhThach}, có ${this.linhThach}).`;
    if (this.linhThao < cost.linhThao) return `Không đủ Linh Thảo (cần ${cost.linhThao}, có ${this.linhThao}).`;
    this.linhThach -= cost.linhThach;
    this.linhThao -= cost.linhThao;
    this.buildings.linhField = lv + 1;
    if (lv === 0) this.fieldUpdatedAt = Date.now();
    this.save();
    return `🌱 ${lv === 0 ? 'Đã xây Linh Điền' : `Linh Điền lên cấp ${lv + 1}`} — sản lượng ${fieldRatePerHour(lv + 1)} Linh Thảo/giờ.`;
  }

  /** Luyện đan: Linh Thạch luôn tốn; thành công tốn hết thảo + nhận đan, thất bại chỉ mất nửa số thảo */
  craftRecipe(itemId: string): string {
    const recipe = recipeByItemId(itemId);
    const it = itemById(itemId);
    if (!recipe || !it) return 'Công thức luyện đan không tồn tại.';
    if (this.linhThao < recipe.linhThao) return `Không đủ Linh Thảo để luyện ${it.name} (cần ${recipe.linhThao}, có ${this.linhThao}).`;
    if (this.linhThach < recipe.linhThach) return `Không đủ Linh Thạch để luyện ${it.name} (cần ${recipe.linhThach}).`;
    this.linhThach -= recipe.linhThach;
    const success = Math.random() < recipe.successRate;
    if (success) {
      this.linhThao -= recipe.linhThao;
      this.addItem(itemId, 1);
      this.save();
      return `⚗️ LUYỆN ĐAN THÀNH CÔNG! Nhận ${it.name} (vào Túi đồ — phím B).`;
    }
    const lost = Math.ceil(recipe.linhThao / 2);
    this.linhThao -= lost;
    this.save();
    return `💥 Lò đan nổ nhẹ... luyện ${it.name} THẤT BẠI — mất ${lost} Linh Thảo (phí Linh Thạch không hoàn).`;
  }

  /** Luyện khí — chế tạo: ngẫu nhiên 1 trang bị của ô chọn, phẩm theo trần rơi đồ của cảnh giới */
  forgeCraft(slot: EquipSlot): string {
    if (this.tinhHoa < FORGE.craftTinhHoa) return `Không đủ Tinh Hoa để chế tạo (cần ${FORGE.craftTinhHoa}, có ${this.tinhHoa}).`;
    if (this.linhThach < FORGE.craftLinhThach) return `Không đủ Linh Thạch để chế tạo (cần ${FORGE.craftLinhThach}).`;
    const cap = lootTierCap(this.stageIndex, 0);
    const pool = equipPoolForTierCap(cap).filter((i) => i.slot === slot);
    if (!pool.length) return 'Chưa chế tạo được trang bị ô này ở cảnh giới hiện tại.';
    this.tinhHoa -= FORGE.craftTinhHoa;
    this.linhThach -= FORGE.craftLinhThach;
    const item = pool[Math.floor(Math.random() * pool.length)];
    this.addEquipment(item.id, 0);
    this.save();
    return `🔨 LUYỆN KHÍ THÀNH CÔNG! Chế tạo được ${item.name} (${item.tier}) — xem trong Túi đồ (phím B).`;
  }

  /** Cường hóa 1 instance (túi hoặc đang trang bị đều được) */
  enhanceInstance(uid: string): string {
    const inst = this.instanceByUid(uid);
    if (!inst) return 'Không tìm thấy trang bị này.';
    const it = itemById(inst.itemId);
    if (!it) return 'Trang bị không tồn tại.';
    if (inst.enhance >= FORGE.maxEnhance) return `${it.name} đã cường hóa tối đa (+${FORGE.maxEnhance}).`;
    const cost = enhanceCost(inst.enhance);
    if (this.tinhHoa < cost.tinhHoa) return `Không đủ Tinh Hoa để cường hóa (cần ${cost.tinhHoa}, có ${this.tinhHoa}).`;
    if (this.linhThach < cost.linhThach) return `Không đủ Linh Thạch để cường hóa (cần ${cost.linhThach}).`;
    this.tinhHoa -= cost.tinhHoa;
    this.linhThach -= cost.linhThach;
    inst.enhance += 1;
    this.save();
    return `✨ Cường hóa thành công! ${it.name} lên +${inst.enhance} (chỉ số +${inst.enhance * FORGE.statPctPerEnhance}% so với gốc).`;
  }

  /** Giả lập offline (nút 🧪 trong panel Động Phủ): lùi đồng hồ hoạt động, xóa báo cáo chờ, lưu lại — Game sẽ reload trang */
  debugSimulateOffline(hours: number) {
    const now = Date.now();
    this.lastActiveAt = now - hours * 3600000;
    this.fieldUpdatedAt = this.lastActiveAt;
    this.pendingOffline = null;
    this.save();
  }

  // ---------- Lưu / tải ----------
  save() {
    try {
      const d: SaveDataV4 = {
        version: 4, character: this.character, stageIndex: this.stageIndex, tuVi: this.tuVi,
        canCo: this.canCo, ngoTinh: this.ngoTinh, kills: this.kills, linhThach: this.linhThach, methodId: this.methodId,
        currentMapId: this.currentMapId, inventory: this.inventory, equipInstances: this.equipInstances, equipped: this.equipped,
        learnedTechs: this.learnedTechs, activeTechs: this.activeTechs,
        questState: this.questState, counters: this.counters, chronicle: this.chronicle,
        linhThao: this.linhThao, tinhHoa: this.tinhHoa,
        lastActiveAt: this.lastActiveAt, offlineActivity: this.offlineActivity, pendingOffline: this.pendingOffline,
        buildings: this.buildings, fieldStored: this.fieldStored, fieldUpdatedAt: this.fieldUpdatedAt,
        breakthroughBonus: this.breakthroughBonus, uidSeq: this.uidSeq,
      };
      localStorage.setItem(SAVE_KEY_V4, JSON.stringify(d));
    } catch { /* bỏ qua nếu storage bị chặn */ }
  }
  load() {
    try {
      const raw4 = localStorage.getItem(SAVE_KEY_V4);
      if (raw4) { this.applyLoadedV4(JSON.parse(raw4) as SaveDataV4); return; }
      const raw3 = localStorage.getItem(SAVE_KEY_V3);
      if (raw3) { this.applyLoadedV3(JSON.parse(raw3) as SaveDataV3); return; }
      // Migration v2 -> v4: giữ nhân vật/tiến trình/Linh Thạch, trường mới lấy mặc định
      const raw2 = localStorage.getItem(SAVE_KEY_V2);
      if (raw2) { this.applyLoadedLegacy(JSON.parse(raw2) as SaveDataV2); return; }
      // Migration từ v1: giữ tiến trình, chưa có nhân vật
      const raw1 = localStorage.getItem(SAVE_KEY_V1);
      if (raw1) {
        this.applyLoadedLegacy(JSON.parse(raw1) as SaveDataV1);
        this.character = null;
      }
    } catch { /* save hỏng -> bắt đầu mới */ }
  }
  private applyLoadedV4(d: Partial<SaveDataV4>) {
    this.applyCommon(d);
    this.inventory = Array.isArray(d.inventory) ? d.inventory : [];
    this.equipInstances = Array.isArray(d.equipInstances) ? d.equipInstances : [];
    this.equipped = { ...emptyEquipped(), ...(d.equipped ?? {}) };
    this.uidSeq = d.uidSeq ?? this.equipInstances.length;
    this.applyPhase3(d);
  }
  /** Migration v3 -> v4: stack trang bị tách thành instance; equipped (itemId) đổi thành uid */
  private applyLoadedV3(d: Partial<SaveDataV3>) {
    this.applyCommon(d as Partial<SaveDataV4>);
    this.inventory = [];
    this.equipInstances = [];
    this.equipped = emptyEquipped();
    for (const e of (Array.isArray(d.inventory) ? d.inventory : [])) {
      const it = itemById(e.id);
      if (it?.kind === 'equip') {
        for (let n = 0; n < e.qty; n++) this.equipInstances.push({ uid: this.nextUid(), itemId: e.id, enhance: 0 });
      } else {
        this.inventory.push({ id: e.id, qty: e.qty });
      }
    }
    const oldEquipped = (d.equipped ?? {}) as Record<EquipSlot, string | null>;
    for (const slot of Object.keys(this.equipped) as EquipSlot[]) {
      const itemId = oldEquipped[slot];
      if (!itemId) continue;
      const inst = this.equipInstances.find((i) => i.itemId === itemId && !Object.values(this.equipped).includes(i.uid))
        ?? this.addEquipment(itemId, 0);
      this.equipped[slot] = inst.uid;
    }
    this.applyPhase3({});
  }
  private applyLoadedLegacy(d: Omit<Partial<SaveDataV4>, 'version'> & Partial<SaveDataV1>) {
    this.applyCommon(d);
    this.inventory = [];
    this.equipInstances = [];
    this.equipped = emptyEquipped();
    this.applyPhase3({});
  }
  private applyCommon(d: Partial<SaveDataV4>) {
    this.stageIndex = Math.min(d.stageIndex ?? 0, REALM_STAGES.length - 1);
    this.tuVi = d.tuVi ?? 0; this.canCo = d.canCo ?? 30; this.ngoTinh = d.ngoTinh ?? 0; this.kills = d.kills ?? 0;
    this.linhThach = d.linhThach ?? 0;
    this.methodId = d.methodId ?? 'tinh-toa';
    this.character = d.character ?? null;
    this.currentMapId = d.currentMapId ?? 'thanh-van';
    this.learnedTechs = d.learnedTechs ?? [];
    this.activeTechs = d.activeTechs ?? [];
    this.questState = d.questState ?? {};
    this.counters = { ...emptyCounters(), ...(d.counters ?? {}) };
    this.counters.killsByType = this.counters.killsByType ?? {};
    this.counters.mapVisits = this.counters.mapVisits ?? {};
    this.chronicle = d.chronicle ?? [];
  }
  private applyPhase3(d: Partial<SaveDataV4>) {
    this.linhThao = d.linhThao ?? 0;
    this.tinhHoa = d.tinhHoa ?? 0;
    this.lastActiveAt = d.lastActiveAt ?? 0;
    this.offlineActivity = d.offlineActivity ?? { kind: 'meditate', mapId: this.currentMapId, methodId: this.methodId };
    this.pendingOffline = d.pendingOffline ?? null;
    this.buildings = { spiritArray: 0, linhField: 0, ...(d.buildings ?? {}) };
    this.fieldStored = d.fieldStored ?? 0;
    this.fieldUpdatedAt = d.fieldUpdatedAt ?? 0;
    this.breakthroughBonus = d.breakthroughBonus ?? false;
  }
  reset() {
    this.character = null;
    this.stageIndex = 0; this.tuVi = 0; this.canCo = 30; this.ngoTinh = 0; this.kills = 0; this.linhThach = 0; this.methodId = 'tinh-toa';
    this.currentMapId = 'thanh-van';
    this.inventory = []; this.equipInstances = []; this.equipped = emptyEquipped();
    this.learnedTechs = []; this.activeTechs = [];
    this.questState = {}; this.counters = emptyCounters(); this.chronicle = [];
    this.linhThao = 0; this.tinhHoa = 0;
    this.lastActiveAt = 0; this.pendingOffline = null;
    this.offlineActivity = { kind: 'meditate', mapId: 'thanh-van', methodId: 'tinh-toa' };
    this.buildings = { spiritArray: 0, linhField: 0 };
    this.fieldStored = 0; this.fieldUpdatedAt = 0;
    this.breakthroughBonus = false; this.uidSeq = 0;
    try {
      localStorage.removeItem(SAVE_KEY_V4); localStorage.removeItem(SAVE_KEY_V3);
      localStorage.removeItem(SAVE_KEY_V2); localStorage.removeItem(SAVE_KEY_V1);
    } catch { /* noop */ }
    this.message = 'Đã bắt đầu hành trình mới.';
  }
}
