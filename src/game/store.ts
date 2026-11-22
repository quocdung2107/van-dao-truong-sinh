// Cầu nối Babylon -> React: emitter rất nhỏ, HUD được cập nhật ~5 lần/giây.
// Lệnh có tham số dùng dạng 'skill:Q', 'method:luyen-the', 'eventChoice:0', 'travel:linh-khe',
// 'enterDungeon:A', 'claimQuest:<id>', 'questChoice:<id>:<0|1>', 'learnTech:<id>', 'toggleTech:<id>',
// 'equip:<uid>', 'unequip:<slot>', 'useItem:<itemId>', 'buyItem:<itemId>', 'sellItem:<itemId>',
// 'sellEquip:<uid>', 'enhance:<uid>'.
// Giai đoạn 3: 'toggleSeclusion', 'claimOffline', 'debugOffline', 'upgradeArray', 'upgradeField',
// 'harvestField', 'craft:<itemId>', 'forgeCraft:<slot>'.
import type { Element, MethodId, SkillKey, LocationId, EquipSlot } from './data';

export interface HudSkill { key: SkillKey; name: string; element: Element; cdLeft: number; cdTotal: number; mpCost: number; ready: boolean }
export interface HudEvent { id: string; title: string; desc: string; choices: [string, string]; expiresIn: number }
export interface HudBeast { name: string; hp: number; maxHp: number; alive: boolean; anyAlive: boolean; elite: boolean }

// ---- Giai đoạn 2 ----
export interface HudLocation {
  id: LocationId; kind: 'map' | 'dungeonA' | 'dungeonB'; name: string; icon: string; desc: string;
  unlocked: boolean; unlockLabel: string; current: boolean; auraLabel: string;
}
export interface HudDungeon {
  active: boolean; kind: 'A' | 'B'; wave: number; room: number; phase: 'fighting' | 'complete';
  bossShield: { hits: number; counterLabel: string } | null;
}
export interface HudQuest {
  id: string; group: string; name: string; desc: string; kind: 'counter' | 'choice';
  progress: number; target: number; state: 'active' | 'ready' | 'done' | 'hidden';
  repeatable: boolean; rewardsText: string;
  choices?: [string, string]; choiceRewardsText?: [string, string];
}
export interface HudTech {
  id: string; name: string; element: Element; schoolLabel: string; desc: string; effectsLabel: string;
  cost: number; unlockLabel: string; realmOk: boolean; learned: boolean; active: boolean;
}

// ---- Giai đoạn 3 ----
export interface HudEquipInstance { uid: string; itemId: string; enhance: number }
export interface HudOfflineReport {
  elapsedSeconds: number;
  countedSeconds: number;
  capSeconds: number;
  activityKind: 'meditate' | 'seclusion' | 'hunt';
  activityLabel: string;
  tuVi: number; canCo: number; ngoTinh: number; linhThach: number; linhThao: number;
  kills: number;
  items: { name: string; qty: number }[];
  fieldGained: number;
}
export interface HudMansion {
  spiritLevel: number;
  spiritNextCost: number | null;
  spiritTuViMul: number;
  offlineCapHours: number;
  fieldLevel: number;
  fieldNextCost: { linhThach: number; linhThao: number } | null;
  fieldRatePerHour: number;
  fieldStored: number; // đã làm tròn xuống để hiển thị
  fieldCap: number;
}

export interface HudState {
  // Nhân vật
  charName: string;
  rootLabel: string;
  schoolLabel: string;
  statAtk: number;
  statDef: number;
  statSpeed: number;
  statCrit: number; // %
  // Tu luyện
  tuVi: number;
  tuViNeed: number;
  canCo: number;
  ngoTinh: number;
  linhThach: number;
  realmLabel: string;
  stageIndex: number;
  methodId: MethodId;
  // Chiến đấu
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  shield: number;
  meditating: boolean;
  swordDrawn: boolean;
  autoMode: boolean;
  autoPhase: string;
  skills: HudSkill[];
  beast: HudBeast;
  message: string;
  canBreakthrough: boolean;
  breakthroughChance: number;
  isRealmUpNext: boolean;
  kills: number;
  // Sự kiện + thiên kiếp
  pendingEvent: HudEvent | null;
  tribActive: boolean;
  tribWave: number;
  tribWaves: number;
  // Giai đoạn 2 — World
  locationId: LocationId;
  locationName: string;
  locations: HudLocation[];
  dungeon: HudDungeon | null;
  quests: HudQuest[];
  questReady: number;
  techniques: HudTech[];
  inventory: { id: string; qty: number }[];
  /** Trang bị trong túi (instance riêng, chưa trang bị) */
  equipBag: HudEquipInstance[];
  /** Ô đang trang bị: uid của instance hoặc null */
  equipped: Record<EquipSlot, string | null>;
  /** Chi tiết instance đang trang bị theo ô */
  equippedDetail: Record<EquipSlot, HudEquipInstance | null>;
  invCount: number;
  chronicle: string[];
  // Giai đoạn 3 — Idle
  linhThao: number;
  tinhHoa: number;
  seclusion: boolean;
  doKiepBonus: boolean;
  offlineReport: HudOfflineReport | null;
  mansion: HudMansion;
}

export type GameCommand = string;

type HudListener = (s: HudState) => void;
type CmdListener = (c: GameCommand) => void;

class Bridge {
  private hudListeners = new Set<HudListener>();
  private cmdListeners = new Set<CmdListener>();
  private resetListeners = new Set<() => void>();
  state: HudState | null = null;

  onHud(fn: HudListener): () => void {
    this.hudListeners.add(fn);
    if (this.state) fn(this.state);
    return () => this.hudListeners.delete(fn);
  }
  emitHud(s: HudState) {
    this.state = s;
    this.hudListeners.forEach((f) => f(s));
  }
  onCommand(fn: CmdListener): () => void {
    this.cmdListeners.add(fn);
    return () => this.cmdListeners.delete(fn);
  }
  send(c: GameCommand) {
    this.cmdListeners.forEach((f) => f(c));
  }
  /** App đăng ký để quay về màn hình tạo nhân vật khi người chơi bấm Chơi lại */
  onReset(fn: () => void): () => void {
    this.resetListeners.add(fn);
    return () => this.resetListeners.delete(fn);
  }
  notifyReset() { this.resetListeners.forEach((f) => f()); }
}

export const bridge = new Bridge();
