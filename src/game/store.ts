// Cầu nối Babylon -> React: emitter rất nhỏ, HUD được cập nhật ~5 lần/giây.
// Lệnh có tham số dùng dạng 'skill:Q', 'method:luyen-the', 'eventChoice:0'.
import type { Element, MethodId, SkillKey } from './data';

export interface HudSkill { key: SkillKey; name: string; element: Element; cdLeft: number; cdTotal: number; mpCost: number; ready: boolean }
export interface HudEvent { id: string; title: string; desc: string; choices: [string, string]; expiresIn: number }
export interface HudBeast { name: string; hp: number; maxHp: number; alive: boolean; anyAlive: boolean; elite: boolean }

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
