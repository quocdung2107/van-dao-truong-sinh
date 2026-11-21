import {
  REALM_STAGES, CULTIVATION, breakthroughChance,
  methodById, type Element, type SchoolId, type MethodId,
} from './data';

const SAVE_KEY_V2 = 'van-dao-truong-sinh-save-v2';
const SAVE_KEY_V1 = 'van-dao-truong-sinh-save-v1';

export interface CharacterInfo { name: string; root: Element; school: SchoolId }

export interface SaveDataV2 {
  version: 2;
  character: CharacterInfo | null;
  stageIndex: number; tuVi: number; canCo: number; ngoTinh: number; kills: number;
  linhThach: number; methodId: MethodId;
}

interface SaveDataV1 { stageIndex: number; tuVi: number; canCo: number; ngoTinh: number; kills: number }

/** Đọc nhân vật từ save (dùng cho màn hình tạo nhân vật). v1 không có nhân vật -> null. */
export function peekCharacter(): CharacterInfo | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY_V2);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveDataV2;
    return d.character ?? null;
  } catch { return null; }
}

/** Tạo nhân vật: giữ lại tiến trình nếu đang migrate từ save cũ, ghi save v2. */
export function createCharacterSave(info: CharacterInfo) {
  const c = new Cultivation();
  c.character = info;
  c.message = `Chào mừng ${info.name} nhập đạo tại Thanh Vân Sơn. Hãy tĩnh tọa (C) để tu luyện.`;
  c.save();
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

  tick(dt: number, meditating: boolean) {
    if (!meditating) {
      if (!this.isMaxStage || this.tuVi < this.stage.tuViNeed) {
        this.tuVi = Math.min(this.stage.tuViNeed, this.tuVi + CULTIVATION.tuViPerSecond * dt);
      }
      return;
    }
    const m = this.method;
    let rate = CULTIVATION.tuViPerSecond * m.tuViMult;
    if (m.affinity === 'root') rate *= 1.3; // linh căn tương hợp với chu thiên
    if (!this.isMaxStage || this.tuVi < this.stage.tuViNeed) {
      this.tuVi = Math.min(this.stage.tuViNeed, this.tuVi + rate * dt);
    }
    this.canCo = Math.min(100, this.canCo + m.canCoPerSecond * dt);
    // Ngộ Tính: Ngộ đạo tích lũy theo giây; Tĩnh tọa đốn ngộ ngẫu nhiên
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

  addBeastReward(tuVi: number, linhThach: number, insightBonus: number, beastName: string) {
    this.tuVi = Math.min(this.stage.tuViNeed, this.tuVi + tuVi);
    this.linhThach += linhThach;
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
      this.message = `Đột phá thành công! ${from} → ${this.stage.realm} ${this.stage.sub}.`;
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
      this.tuVi = Math.min(this.stage.tuViNeed, this.tuVi + 60); return 'Linh quang hóa thành tu vi! +60 Tu Vi.';
    }
    if (eventId === 'di-bien') {
      if (choice === 0) {
        this.tuVi = Math.min(this.stage.tuViNeed, this.tuVi + 130);
        this.canCo = Math.max(0, this.canCo - 10);
        return 'Hấp thụ dị biến thành công! +130 Tu Vi, −10 Căn Cơ.';
      }
      this.tuVi = Math.min(this.stage.tuViNeed, this.tuVi + 25); return 'Dẫn khí an toàn. +25 Tu Vi.';
    }
    if (eventId === 'tam-ma') {
      if (choice === 0) { this.tuVi = Math.max(0, this.tuVi - 30); return 'Tâm ma tan đi nhưng hao tổn: −30 Tu Vi.'; }
      if (this.ngoTinh >= 2) { this.ngoTinh -= 2; this.canCo = Math.min(100, this.canCo + 8); return 'Trấn áp tâm ma! −2 Ngộ Tính, +8 Căn Cơ.'; }
      this.tuVi = Math.max(0, this.tuVi - 30); return 'Không đủ Ngộ Tính để trấn áp — tâm ma hao tổn: −30 Tu Vi.';
    }
    return '';
  }

  save() {
    try {
      const d: SaveDataV2 = {
        version: 2, character: this.character, stageIndex: this.stageIndex, tuVi: this.tuVi,
        canCo: this.canCo, ngoTinh: this.ngoTinh, kills: this.kills, linhThach: this.linhThach, methodId: this.methodId,
      };
      localStorage.setItem(SAVE_KEY_V2, JSON.stringify(d));
    } catch { /* bỏ qua nếu storage bị chặn */ }
  }
  load() {
    try {
      const raw2 = localStorage.getItem(SAVE_KEY_V2);
      if (raw2) {
        const d = JSON.parse(raw2) as SaveDataV2;
        this.applyLoaded(d);
        return;
      }
      // Migration từ v1: giữ tiến trình, chưa có nhân vật -> màn hình tạo nhân vật sẽ hiện
      const raw1 = localStorage.getItem(SAVE_KEY_V1);
      if (raw1) {
        const d = JSON.parse(raw1) as SaveDataV1;
        this.applyLoaded(d);
        this.character = null;
      }
    } catch { /* save hỏng -> bắt đầu mới */ }
  }
  private applyLoaded(d: Partial<SaveDataV2> & Partial<SaveDataV1>) {
    this.stageIndex = Math.min(d.stageIndex ?? 0, REALM_STAGES.length - 1);
    this.tuVi = d.tuVi ?? 0; this.canCo = d.canCo ?? 30; this.ngoTinh = d.ngoTinh ?? 0; this.kills = d.kills ?? 0;
    this.linhThach = (d as SaveDataV2).linhThach ?? 0;
    this.methodId = (d as SaveDataV2).methodId ?? 'tinh-toa';
    this.character = (d as SaveDataV2).character ?? null;
  }
  reset() {
    this.character = null;
    this.stageIndex = 0; this.tuVi = 0; this.canCo = 30; this.ngoTinh = 0; this.kills = 0; this.linhThach = 0; this.methodId = 'tinh-toa';
    try { localStorage.removeItem(SAVE_KEY_V2); localStorage.removeItem(SAVE_KEY_V1); } catch { /* noop */ }
    this.message = 'Đã bắt đầu hành trình mới.';
  }
}
