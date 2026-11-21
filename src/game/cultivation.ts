import {
  REALM_STAGES, CULTIVATION, breakthroughChance,
  methodById, itemById, techniqueById, rewardsLabel,
  NO_TECH_EFFECTS,
  type Element, type SchoolId, type MethodId, type LocationId, type EquipSlot,
  type EquipBonuses, type TechEffects, type CounterKey, type QuestDef, type QuestRewards,
  QUESTS, LOCATIONS,
} from './data';

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

export interface InvEntry { id: string; qty: number }
export interface QuestState { base: number; claims: number; done: boolean; notified: boolean }
export type EquippedMap = Record<EquipSlot, string | null>;
function emptyEquipped(): EquippedMap { return { weapon: null, armor: null, boots: null, accessory: null }; }

export interface SaveDataV3 {
  version: 3;
  character: CharacterInfo | null;
  stageIndex: number; tuVi: number; canCo: number; ngoTinh: number; kills: number;
  linhThach: number; methodId: MethodId;
  currentMapId: LocationId;
  inventory: InvEntry[];
  equipped: EquippedMap;
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

/** Đọc nhân vật từ save (v3 -> v2). v1 không có nhân vật -> null. */
export function peekCharacter(): CharacterInfo | null {
  try {
    const raw3 = localStorage.getItem(SAVE_KEY_V3);
    if (raw3) return (JSON.parse(raw3) as SaveDataV3).character ?? null;
    const raw2 = localStorage.getItem(SAVE_KEY_V2);
    if (raw2) return (JSON.parse(raw2) as SaveDataV2).character ?? null;
    return null;
  } catch { return null; }
}

/** Tạo nhân vật: giữ lại tiến trình nếu đang migrate từ save cũ, ghi save v3. */
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
  equipped: EquippedMap = emptyEquipped();
  learnedTechs: string[] = [];
  activeTechs: string[] = [];
  questState: Record<string, QuestState> = {};
  counters: Counters = emptyCounters();
  chronicle: string[] = [];
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

  // ---------- Tu luyện ----------
  /** mods: aura của bản đồ + hiệu ứng công pháp (chỉ áp khi thiền, trừ tech áp cả hai) */
  tick(dt: number, meditating: boolean, mods?: { auraTuVi?: number; auraCanCo?: number }) {
    const tech = this.techEffects();
    const techTuVi = 1 + tech.tuViPct / 100;
    const techCanCo = 1 + tech.canCoPct / 100;
    if (!meditating) {
      if (!this.isMaxStage || this.tuVi < this.stage.tuViNeed) {
        this.tuVi = Math.min(this.stage.tuViNeed, this.tuVi + CULTIVATION.tuViPerSecond * techTuVi * dt);
      }
      return;
    }
    this.counters.meditateSeconds += dt;
    const m = this.method;
    let rate = CULTIVATION.tuViPerSecond * m.tuViMult * techTuVi * (mods?.auraTuVi ?? 1);
    if (m.affinity === 'root') rate *= 1.3; // linh căn tương hợp với chu thiên
    if (!this.isMaxStage || this.tuVi < this.stage.tuViNeed) {
      this.tuVi = Math.min(this.stage.tuViNeed, this.tuVi + rate * dt);
    }
    this.canCo = Math.min(100, this.canCo + m.canCoPerSecond * techCanCo * (mods?.auraCanCo ?? 1) * dt);
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

  /** @param bonusChance cộng thêm % (thiên kiếp +10). @returns true nếu thành công */
  breakthrough(bonusChance = 0): boolean {
    if (!this.canBreakthrough) {
      this.message = `Chưa đủ điều kiện: cần Tu Vi đầy và Căn Cơ ≥ ${this.stage.canCoRequired}.`;
      return false;
    }
    const chance = Math.min(95, Math.max(5, this.chance + bonusChance));
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
  countItem(id: string): number { return this.inventory.find((e) => e.id === id)?.qty ?? 0; }
  invCount(): number { return this.inventory.reduce((s, e) => s + e.qty, 0); }
  addItem(id: string, qty = 1) {
    const e = this.inventory.find((x) => x.id === id);
    if (e) e.qty += qty; else this.inventory.push({ id, qty });
  }
  removeItem(id: string, qty = 1): boolean {
    const e = this.inventory.find((x) => x.id === id);
    if (!e || e.qty < qty) return false;
    e.qty -= qty;
    if (e.qty <= 0) this.inventory = this.inventory.filter((x) => x.id !== id);
    return true;
  }
  equip(itemId: string): string {
    const it = itemById(itemId);
    if (!it || it.kind !== 'equip' || !it.slot) return 'Vật phẩm này không trang bị được.';
    if (this.countItem(itemId) < 1) return 'Không có vật phẩm này trong túi.';
    const slot = it.slot;
    const old = this.equipped[slot];
    this.removeItem(itemId, 1);
    if (old) this.addItem(old, 1);
    this.equipped[slot] = itemId;
    this.save();
    return `Đã trang bị ${it.name}.`;
  }
  unequip(slot: EquipSlot): string {
    const old = this.equipped[slot];
    if (!old) return 'Chưa trang bị ô này.';
    this.equipped[slot] = null;
    this.addItem(old, 1);
    this.save();
    return `Đã tháo ${itemById(old)?.name ?? old}.`;
  }
  equipmentBonuses(): EquipBonuses {
    const b: EquipBonuses = { atk: 0, def: 0, hp: 0, mp: 0, speed: 0, crit: 0 };
    for (const slot of Object.keys(this.equipped) as EquipSlot[]) {
      const id = this.equipped[slot];
      if (!id) continue;
      const s = itemById(id)?.stats;
      if (!s) continue;
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
  sell(itemId: string): string {
    const it = itemById(itemId);
    if (!it) return 'Vật phẩm không tồn tại.';
    if (!this.removeItem(itemId, 1)) return 'Không có vật phẩm này trong túi.';
    this.gainLinhThach(it.sellPrice);
    this.save();
    return `Đã bán ${it.name}: +${it.sellPrice} Linh Thạch.`;
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

  // ---------- Lưu / tải ----------
  save() {
    try {
      const d: SaveDataV3 = {
        version: 3, character: this.character, stageIndex: this.stageIndex, tuVi: this.tuVi,
        canCo: this.canCo, ngoTinh: this.ngoTinh, kills: this.kills, linhThach: this.linhThach, methodId: this.methodId,
        currentMapId: this.currentMapId, inventory: this.inventory, equipped: this.equipped,
        learnedTechs: this.learnedTechs, activeTechs: this.activeTechs,
        questState: this.questState, counters: this.counters, chronicle: this.chronicle,
      };
      localStorage.setItem(SAVE_KEY_V3, JSON.stringify(d));
    } catch { /* bỏ qua nếu storage bị chặn */ }
  }
  load() {
    try {
      const raw3 = localStorage.getItem(SAVE_KEY_V3);
      if (raw3) { this.applyLoaded(JSON.parse(raw3) as SaveDataV3); return; }
      // Migration v2 -> v3: giữ nhân vật/tiến trình/Linh Thạch, trường mới lấy mặc định
      const raw2 = localStorage.getItem(SAVE_KEY_V2);
      if (raw2) { this.applyLoaded(JSON.parse(raw2) as SaveDataV2); return; }
      // Migration từ v1: giữ tiến trình, chưa có nhân vật
      const raw1 = localStorage.getItem(SAVE_KEY_V1);
      if (raw1) {
        this.applyLoaded(JSON.parse(raw1) as SaveDataV1);
        this.character = null;
      }
    } catch { /* save hỏng -> bắt đầu mới */ }
  }
  private applyLoaded(d: Omit<Partial<SaveDataV3>, 'version'> & Partial<SaveDataV1>) {
    this.stageIndex = Math.min(d.stageIndex ?? 0, REALM_STAGES.length - 1);
    this.tuVi = d.tuVi ?? 0; this.canCo = d.canCo ?? 30; this.ngoTinh = d.ngoTinh ?? 0; this.kills = d.kills ?? 0;
    this.linhThach = d.linhThach ?? 0;
    this.methodId = d.methodId ?? 'tinh-toa';
    this.character = d.character ?? null;
    const v3 = d as Partial<SaveDataV3>;
    this.currentMapId = v3.currentMapId ?? 'thanh-van';
    this.inventory = Array.isArray(v3.inventory) ? v3.inventory : [];
    this.equipped = { ...emptyEquipped(), ...(v3.equipped ?? {}) };
    this.learnedTechs = v3.learnedTechs ?? [];
    this.activeTechs = v3.activeTechs ?? [];
    this.questState = v3.questState ?? {};
    this.counters = { ...emptyCounters(), ...(v3.counters ?? {}) };
    this.counters.killsByType = this.counters.killsByType ?? {};
    this.counters.mapVisits = this.counters.mapVisits ?? {};
    this.chronicle = v3.chronicle ?? [];
  }
  reset() {
    this.character = null;
    this.stageIndex = 0; this.tuVi = 0; this.canCo = 30; this.ngoTinh = 0; this.kills = 0; this.linhThach = 0; this.methodId = 'tinh-toa';
    this.currentMapId = 'thanh-van';
    this.inventory = []; this.equipped = emptyEquipped();
    this.learnedTechs = []; this.activeTechs = [];
    this.questState = {}; this.counters = emptyCounters(); this.chronicle = [];
    try { localStorage.removeItem(SAVE_KEY_V3); localStorage.removeItem(SAVE_KEY_V2); localStorage.removeItem(SAVE_KEY_V1); } catch { /* noop */ }
    this.message = 'Đã bắt đầu hành trình mới.';
  }
}
