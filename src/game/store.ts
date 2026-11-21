// Cầu nối Babylon -> React: emitter rất nhỏ, HUD được cập nhật ~5 lần/giây.
export interface HudState {
  tuVi: number;
  tuViNeed: number;
  canCo: number;
  ngoTinh: number;
  realmLabel: string;
  stageIndex: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  meditating: boolean;
  swordDrawn: boolean;
  autoMode: boolean;
  autoPhase: string;
  beastHp: number;
  beastMaxHp: number;
  beastAlive: boolean;
  message: string;
  canBreakthrough: boolean;
  breakthroughChance: number;
  kills: number;
}

export type GameCommand = 'toggleMeditate' | 'toggleSword' | 'toggleAuto' | 'breakthrough' | 'attack' | 'resetSave';

type HudListener = (s: HudState) => void;
type CmdListener = (c: GameCommand) => void;

class Bridge {
  private hudListeners = new Set<HudListener>();
  private cmdListeners = new Set<CmdListener>();
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
}

export const bridge = new Bridge();
