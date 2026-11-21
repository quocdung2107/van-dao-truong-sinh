import { REALM_STAGES, CULTIVATION, breakthroughChance } from './data';

const SAVE_KEY = 'van-dao-truong-sinh-save-v1';

export interface SaveData { stageIndex: number; tuVi: number; canCo: number; ngoTinh: number; kills: number }

export class Cultivation {
  stageIndex = 0;
  tuVi = 0;
  canCo = 30;
  ngoTinh = 0;
  kills = 0;
  message = 'Chào mừng đến Thanh Vân Sơn. Hãy tĩnh tọa (C) để tu luyện.';

  constructor() { this.load(); }

  get stage() { return REALM_STAGES[Math.min(this.stageIndex, REALM_STAGES.length - 1)]; }
  get isMaxStage() { return this.stageIndex >= REALM_STAGES.length - 1; }
  get canBreakthrough() {
    return !this.isMaxStage && this.tuVi >= this.stage.tuViNeed && this.canCo >= this.stage.canCoRequired;
  }
  get chance() { return breakthroughChance(this.canCo, this.stage.difficulty); }

  tick(dt: number, meditating: boolean) {
    const rate = CULTIVATION.tuViPerSecond * (meditating ? CULTIVATION.meditateMultiplier : 1);
    if (!this.isMaxStage || this.tuVi < this.stage.tuViNeed) {
      this.tuVi = Math.min(this.stage.tuViNeed, this.tuVi + rate * dt);
    }
    if (meditating) {
      this.canCo = Math.min(100, this.canCo + CULTIVATION.canCoPerSecondMeditating * dt);
      if (Math.random() < CULTIVATION.insightChancePerSecondMeditating * dt) {
        this.ngoTinh += 1;
        this.message = 'Đốn ngộ! +1 Ngộ Tính.';
      }
    }
  }

  addBeastReward() {
    this.tuVi = Math.min(this.stage.tuViNeed, this.tuVi + CULTIVATION.beastTuViReward);
    this.kills += 1;
    this.message = `Hạ yêu thú! +${CULTIVATION.beastTuViReward} Tu Vi.`;
    this.save();
  }

  /** @returns true nếu thành công */
  breakthrough(): boolean {
    if (!this.canBreakthrough) {
      this.message = `Chưa đủ điều kiện: cần Tu Vi đầy và Căn Cơ ≥ ${this.stage.canCoRequired}.`;
      return false;
    }
    const roll = Math.random() * 100;
    if (roll <= this.chance) {
      const from = `${this.stage.realm} ${this.stage.sub}`;
      this.stageIndex += 1;
      this.tuVi = 0;
      this.canCo = Math.min(100, this.canCo + 5);
      this.message = `Đột phá thành công! ${from} → ${this.stage.realm} ${this.stage.sub}.`;
      this.save();
      return true;
    }
    // Thất bại: mất 15% Tu Vi của tiểu cảnh hiện tại, Căn Cơ -15 (không tụt cảnh giới)
    this.tuVi = Math.max(0, this.tuVi - this.stage.tuViNeed * 0.15);
    this.canCo = Math.max(0, this.canCo - 15);
    this.message = `Đột phá thất bại (cần ≤ ${this.chance.toFixed(0)}%, ra ${roll.toFixed(0)}%). Mất 15% Tu Vi, Căn Cơ −15. Tâm ma quấy nhiễu — hãy thiền để hồi Căn Cơ.`;
    this.save();
    return false;
  }

  save() {
    try {
      const d: SaveData = { stageIndex: this.stageIndex, tuVi: this.tuVi, canCo: this.canCo, ngoTinh: this.ngoTinh, kills: this.kills };
      localStorage.setItem(SAVE_KEY, JSON.stringify(d));
    } catch { /* bỏ qua nếu storage bị chặn */ }
  }
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw) as SaveData;
      this.stageIndex = Math.min(d.stageIndex ?? 0, REALM_STAGES.length - 1);
      this.tuVi = d.tuVi ?? 0; this.canCo = d.canCo ?? 30; this.ngoTinh = d.ngoTinh ?? 0; this.kills = d.kills ?? 0;
    } catch { /* save hỏng -> bắt đầu mới */ }
  }
  reset() {
    this.stageIndex = 0; this.tuVi = 0; this.canCo = 30; this.ngoTinh = 0; this.kills = 0;
    try { localStorage.removeItem(SAVE_KEY); } catch { /* noop */ }
    this.message = 'Đã bắt đầu hành trình mới.';
  }
}
