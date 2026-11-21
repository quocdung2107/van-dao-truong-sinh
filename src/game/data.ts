// Dữ liệu game — mọi ngưỡng/công thức nằm ở đây, không rải rác trong code.
// Số liệu là giá trị playtest cho prototype (nhỏ để đột phá được trong vài phút).

export interface RealmStage {
  realm: string;
  sub: string;
  /** Tu Vi cần tích lũy trong tiểu cảnh này để được đột phá */
  tuViNeed: number;
  /** Độ khó trừ vào tỉ lệ đột phá: Luyện Thể 0, Luyện Khí 10, Trúc Cơ 20, Kim Đan 30 */
  difficulty: number;
  /** Căn Cơ tối thiểu: 50 cho tiểu cảnh, 65 khi lên đại cảnh giới mới */
  canCoRequired: number;
  isRealmUp: boolean;
}

function stage(realm: string, sub: string, need: number, diff: number, realmUp: boolean): RealmStage {
  return { realm, sub, tuViNeed: need, difficulty: diff, canCoRequired: realmUp ? 65 : 50, isRealmUp: realmUp };
}

export const REALM_STAGES: RealmStage[] = [
  stage('Luyện Thể', 'Sơ Kỳ', 100, 0, false),
  stage('Luyện Thể', 'Trung Kỳ', 150, 0, false),
  stage('Luyện Thể', 'Hậu Kỳ', 200, 0, false),
  stage('Luyện Thể', 'Đại Viên Mãn', 250, 0, true),
  stage('Luyện Khí', 'Sơ Kỳ', 300, 10, false),
  stage('Luyện Khí', 'Trung Kỳ', 400, 10, false),
  stage('Luyện Khí', 'Hậu Kỳ', 500, 10, false),
  stage('Luyện Khí', 'Đại Viên Mãn', 650, 10, true),
  stage('Trúc Cơ', 'Sơ Kỳ', 800, 20, false),
  stage('Trúc Cơ', 'Trung Kỳ', 1000, 20, false),
  stage('Trúc Cơ', 'Hậu Kỳ', 1200, 20, false),
  stage('Trúc Cơ', 'Đại Viên Mãn', 1500, 20, true),
  stage('Kim Đan', 'Sơ Kỳ', 2000, 30, false),
  stage('Kim Đan', 'Trung Kỳ', 2500, 30, false),
  stage('Kim Đan', 'Hậu Kỳ', 3000, 30, false),
  stage('Kim Đan', 'Đại Viên Mãn', 4000, 30, false),
];

export const CULTIVATION = {
  tuViPerSecond: 2, // cơ bản khi không thiền
  meditateMultiplier: 3, // thiền: x3
  canCoPerSecondMeditating: 0.6,
  insightChancePerSecondMeditating: 0.04, // ~1 điểm mỗi ~25 giây thiền
  beastTuViReward: 30,
};

export const PLAYER_BASE = { maxHp: 100, maxMp: 100, attackMin: 16, attackMax: 26 };
export const BEAST_BASE = { maxHp: 120, attackMin: 7, attackMax: 12, respawnSeconds: 5 };

/** Tỉ lệ đột phá theo GDD: 60 + 0.4*CănCơ − độ khó, kẹp [5, 95] */
export function breakthroughChance(canCo: number, difficulty: number): number {
  return Math.min(95, Math.max(5, 60 + 0.4 * canCo - difficulty));
}

/** Hệ số sức mạnh thực chiến từ Căn Cơ */
export function powerFactor(canCo: number): number {
  return 0.7 + 0.3 * (canCo / 100);
}
