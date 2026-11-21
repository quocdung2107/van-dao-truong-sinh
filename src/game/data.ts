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
  meditateMultiplier: 3, // (giữ lại để tham chiếu) — tốc độ thiền thật nằm ở CULTIVATION_METHODS
  canCoPerSecondMeditating: 0.6,
  insightChancePerSecondMeditating: 0.04,
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

// =====================================================================
// GIAI ĐOẠN 1 — Ngũ hành / Linh căn / Trường phái / Kỹ năng / Quái
// =====================================================================

export type Element = 'Kim' | 'Moc' | 'Thuy' | 'Hoa' | 'Tho';
export const ELEMENTS: Element[] = ['Kim', 'Moc', 'Thuy', 'Hoa', 'Tho'];

export const ELEMENT_LABEL: Record<Element, string> = {
  Kim: 'Kim', Moc: 'Mộc', Thuy: 'Thủy', Hoa: 'Hỏa', Tho: 'Thổ',
};
/** Màu đại diện cho UI (hex) và Babylon (rgb 0..1) */
export const ELEMENT_COLOR: Record<Element, string> = {
  Kim: '#facc15', Moc: '#4ade80', Thuy: '#38bdf8', Hoa: '#f87171', Tho: '#d6a35c',
};
export const ELEMENT_RGB: Record<Element, [number, number, number]> = {
  Kim: [0.98, 0.8, 0.08], Moc: [0.29, 0.87, 0.5], Thuy: [0.22, 0.74, 0.97], Hoa: [0.97, 0.44, 0.44], Tho: [0.84, 0.64, 0.36],
};

/** Ngũ hành tương khắc: A khắc B (Kim→Mộc→Thổ→Thủy→Hỏa→Kim) */
const OVERCOMES: Record<Element, Element> = { Kim: 'Moc', Moc: 'Tho', Tho: 'Thuy', Thuy: 'Hoa', Hoa: 'Kim' };
/** Hệ số sát thương theo tương khắc: khắc +20%, bị khắc −20%, còn lại 1.0 */
export function elementFactor(atk: Element, def: Element): number {
  if (OVERCOMES[atk] === def) return 1.2;
  if (OVERCOMES[def] === atk) return 0.8;
  return 1.0;
}
/** Bonus khi kỹ năng cùng hệ với linh căn của người chơi (theo GDD: +15%) */
export const ROOT_SKILL_BONUS = 1.15;

export interface SpiritRoot {
  element: Element;
  name: string;
  pros: string;
  cons: string;
}
export const SPIRIT_ROOTS: SpiritRoot[] = [
  { element: 'Kim', name: 'Kim Linh Căn', pros: 'Sát thương hệ Kim +15%, khắc Mộc. Kiếm khí sắc bén, hợp Kiếm Tu.', cons: 'Bị Hỏa khắc — gặp yêu thú hệ Hỏa sẽ bất lợi.' },
  { element: 'Moc', name: 'Mộc Linh Căn', pros: 'Sát thương hệ Mộc +15%, khắc Thổ. Sinh sôi bền bỉ, hợp Đan Tu.', cons: 'Bị Kim khắc — cẩn thận yêu thú hệ Kim.' },
  { element: 'Thuy', name: 'Thủy Linh Căn', pros: 'Sát thương hệ Thủy +15%, khắc Hỏa. Linh hoạt, hợp Phù Trận Tu khống chế.', cons: 'Bị Thổ khắc — yêu thú hệ Thổ là khắc tinh.' },
  { element: 'Hoa', name: 'Hỏa Linh Căn', pros: 'Sát thương hệ Hỏa +15%, khắc Kim. Bùng nổ mạnh, hợp Pháp Tu.', cons: 'Bị Thủy khắc — yêu thú hệ Thủy dập tắt hỏa lực.' },
  { element: 'Tho', name: 'Thổ Linh Căn', pros: 'Sát thương hệ Thổ +15%, khắc Thủy. Vững như núi, hợp Thể Tu.', cons: 'Bị Mộc khắc — yêu thú hệ Mộc xuyên phá phòng thủ.' },
];

// ---------- Trường phái ----------
export type SchoolId = 'kiem' | 'phap' | 'the' | 'dan' | 'phutran';
export interface School {
  id: SchoolId;
  name: string;
  icon: string;
  desc: string;
  /** Hệ số nhân chỉ số nền */
  mult: { hp: number; mp: number; atk: number; def: number; speed: number; crit: number };
  critChance: number; // tỉ lệ bạo kích nền (0..1)
}
export const SCHOOLS: School[] = [
  { id: 'kiem', name: 'Kiếm Tu', icon: '🗡️', desc: 'Đơn thể cực mạnh, bạo kích cao (20%). Nhất kiếm phá vạn pháp.', mult: { hp: 1.0, mp: 0.9, atk: 1.15, def: 0.95, speed: 1.05, crit: 1 }, critChance: 0.2 },
  { id: 'phap', name: 'Pháp Tu', icon: '🔥', desc: 'Pháp thuật diện rộng, Linh Lực dồi dào, nhưng thân thể mỏng.', mult: { hp: 0.85, mp: 1.4, atk: 1.2, def: 0.85, speed: 0.95, crit: 1 }, critChance: 0.1 },
  { id: 'the', name: 'Thể Tu', icon: '🪨', desc: 'HP và phòng thủ vượt trội, cận chiến bền bỉ. Kim cương bất hoại.', mult: { hp: 1.5, mp: 0.7, atk: 1.05, def: 1.4, speed: 0.9, crit: 1 }, critChance: 0.08 },
  { id: 'dan', name: 'Đan Tu', icon: '⚗️', desc: 'Chiến đấu yếu hơn nhưng tự hồi phục cực tốt bằng đan dược.', mult: { hp: 0.95, mp: 1.2, atk: 0.85, def: 1.0, speed: 1.0, crit: 1 }, critChance: 0.1 },
  { id: 'phutran', name: 'Phù Trận Tu', icon: '🌀', desc: 'Khống chế và làm chậm địch bằng phù trận, Linh Lực cao.', mult: { hp: 0.9, mp: 1.3, atk: 1.0, def: 1.05, speed: 1.0, crit: 1 }, critChance: 0.12 },
];
export function schoolById(id: SchoolId): School { return SCHOOLS.find((s) => s.id === id) ?? SCHOOLS[0]; }

// ---------- Chỉ số suy ra ----------
export interface DerivedStats { maxHp: number; maxMp: number; atk: number; def: number; speed: number; critChance: number; critDmg: number }
/**
 * Chỉ số = nền theo bậc cảnh giới (tăng theo stageIndex) × hệ số Căn Cơ (chỉ cho Công/Thủ)
 * × hệ số trường phái. Tốc độ nền 5.2 (bằng prototype).
 */
export function computeStats(stageIndex: number, canCo: number, schoolId: SchoolId, equip: EquipBonuses = NO_EQUIP): DerivedStats {
  const sch = schoolById(schoolId);
  const pf = powerFactor(canCo);
  const g = stageIndex; // 0..15
  return {
    maxHp: Math.round(100 * (1 + g * 0.4) * sch.mult.hp) + equip.hp,
    maxMp: Math.round(100 * (1 + g * 0.3) * sch.mult.mp) + equip.mp,
    atk: 21 * (1 + g * 0.35) * sch.mult.atk * pf + equip.atk,
    def: (8 + g * 4) * sch.mult.def * pf + equip.def,
    speed: 5.2 * sch.mult.speed + equip.speed,
    critChance: sch.critChance + equip.crit / 100,
    critDmg: 1.5,
  };
}
/** Giảm sát thương nhận vào nhờ Thủ: dmg * 100/(100+def) */
export function mitigate(rawDmg: number, def: number): number {
  return rawDmg * (100 / (100 + def));
}

/** Cộng thêm từ trang bị (Giai đoạn 2) — cộng thẳng sau hệ số trường phái. crit tính bằng điểm % */
export interface EquipBonuses { atk: number; def: number; hp: number; mp: number; speed: number; crit: number }
export const NO_EQUIP: EquipBonuses = { atk: 0, def: 0, hp: 0, mp: 0, speed: 0, crit: 0 };

// ---------- Kỹ năng theo trường phái ----------
export type SkillKey = 'Q' | 'E' | 'R' | 'F';
export type SkillKind = 'damage' | 'aoe' | 'buff';
export interface SkillDef {
  key: SkillKey;
  name: string;
  element: Element;
  kind: SkillKind;
  mpCost: number;
  cooldown: number; // giây
  dmgMult: number; // × Công (0 với buff thuần)
  range: number;
  aoeRadius: number; // 0 = đơn thể
  slowSeconds: number; // làm chậm quái (Phù Trận)
  buff?: { type: 'heal' | 'shield' | 'speed'; value: number; duration: number };
  desc: string;
}
function sk(partial: Omit<SkillDef, 'slowSeconds'> & Partial<Pick<SkillDef, 'slowSeconds'>>): SkillDef {
  return { slowSeconds: 0, ...partial };
}
export const SKILLS: Record<SchoolId, SkillDef[]> = {
  kiem: [
    sk({ key: 'Q', name: 'Kiếm Khí Trảm', element: 'Kim', kind: 'damage', mpCost: 10, cooldown: 3, dmgMult: 1.6, range: 4.5, aoeRadius: 0, desc: 'Chém kiếm khí đơn thể cực mạnh.' }),
    sk({ key: 'E', name: 'Vạn Kiếm Quy Tông', element: 'Kim', kind: 'aoe', mpCost: 20, cooldown: 8, dmgMult: 1.1, range: 5, aoeRadius: 4, desc: 'Muôn kiếm quy về một mối — sát thương quanh mục tiêu.' }),
    sk({ key: 'R', name: 'Kiếm Tâm Thông Minh', element: 'Kim', kind: 'buff', mpCost: 12, cooldown: 14, dmgMult: 0, range: 0, aoeRadius: 0, buff: { type: 'speed', value: 1.35, duration: 6 }, desc: 'Tăng 35% tốc độ di chuyển trong 6 giây.' }),
    sk({ key: 'F', name: 'Thiên Ngoại Phi Tiên', element: 'Kim', kind: 'damage', mpCost: 35, cooldown: 15, dmgMult: 3.2, range: 5.5, aoeRadius: 0, desc: 'Tuyệt kỹ kết liễu đơn thể.' }),
  ],
  phap: [
    sk({ key: 'Q', name: 'Hỏa Cầu Thuật', element: 'Hoa', kind: 'damage', mpCost: 12, cooldown: 2.5, dmgMult: 1.7, range: 9, aoeRadius: 0, desc: 'Cầu lửa tầm xa, sát thương lớn.' }),
    sk({ key: 'E', name: 'Liệt Diễm Phần Thiên', element: 'Hoa', kind: 'aoe', mpCost: 25, cooldown: 9, dmgMult: 1.3, range: 9, aoeRadius: 5, desc: 'Biển lửa thiêu rụi cả vùng quanh mục tiêu.' }),
    sk({ key: 'R', name: 'Linh Khí Hộ Thể', element: 'Hoa', kind: 'buff', mpCost: 15, cooldown: 14, dmgMult: 0, range: 0, aoeRadius: 0, buff: { type: 'shield', value: 45, duration: 8 }, desc: 'Khiên linh khí hấp thụ 45 sát thương trong 8 giây.' }),
    sk({ key: 'F', name: 'Cửu Thiên Huyền Hỏa', element: 'Hoa', kind: 'aoe', mpCost: 40, cooldown: 16, dmgMult: 3.0, range: 9, aoeRadius: 4.5, desc: 'Huyền hỏa từ cửu thiên giáng xuống cả vùng.' }),
  ],
  the: [
    sk({ key: 'Q', name: 'Băng Sơn Quyền', element: 'Tho', kind: 'damage', mpCost: 8, cooldown: 2.5, dmgMult: 1.5, range: 3.2, aoeRadius: 0, desc: 'Một quyền như núi sập.' }),
    sk({ key: 'E', name: 'Địa Liệt Ba', element: 'Tho', kind: 'aoe', mpCost: 18, cooldown: 8, dmgMult: 1.0, range: 3.5, aoeRadius: 3.8, desc: 'Đất nứt sóng chấn quanh thân, đẩy lùi địch.' }),
    sk({ key: 'R', name: 'Kim Cương Bất Hoại', element: 'Tho', kind: 'buff', mpCost: 12, cooldown: 14, dmgMult: 0, range: 0, aoeRadius: 0, buff: { type: 'shield', value: 65, duration: 8 }, desc: 'Khiên thể phách hấp thụ 65 sát thương trong 8 giây.' }),
    sk({ key: 'F', name: 'Phá Thiên Kích', element: 'Tho', kind: 'damage', mpCost: 30, cooldown: 14, dmgMult: 2.8, range: 3.8, aoeRadius: 0, desc: 'Một kích phá thiên, kết liễu đơn thể.' }),
  ],
  dan: [
    sk({ key: 'Q', name: 'Đan Hỏa', element: 'Moc', kind: 'damage', mpCost: 10, cooldown: 3, dmgMult: 1.4, range: 6.5, aoeRadius: 0, desc: 'Lửa lò đan thiêu đốt đơn thể.' }),
    sk({ key: 'E', name: 'Độc Vụ Mạn Thiên', element: 'Moc', kind: 'aoe', mpCost: 20, cooldown: 9, dmgMult: 1.1, range: 7, aoeRadius: 4.5, desc: 'Mây độc lan khắp vùng quanh mục tiêu.' }),
    sk({ key: 'R', name: 'Hồi Xuân Đan', element: 'Moc', kind: 'buff', mpCost: 18, cooldown: 16, dmgMult: 0, range: 0, aoeRadius: 0, buff: { type: 'heal', value: 0.35, duration: 0 }, desc: 'Hồi ngay 35% HP tối đa.' }),
    sk({ key: 'F', name: 'Phần Thiên Đan Lô', element: 'Moc', kind: 'aoe', mpCost: 35, cooldown: 15, dmgMult: 2.6, range: 7, aoeRadius: 4, desc: 'Lò đan bùng nổ — sát thương vùng lớn.' }),
  ],
  phutran: [
    sk({ key: 'Q', name: 'Băng Phù', element: 'Thuy', kind: 'damage', mpCost: 11, cooldown: 2.8, dmgMult: 1.5, range: 7.5, aoeRadius: 0, slowSeconds: 2, desc: 'Phù băng đơn thể, làm chậm địch 2 giây.' }),
    sk({ key: 'E', name: 'Khốn Tiên Trận', element: 'Thuy', kind: 'aoe', mpCost: 22, cooldown: 10, dmgMult: 0.8, range: 7, aoeRadius: 4.5, slowSeconds: 3, desc: 'Trận pháp khốn địch cả vùng, làm chậm 3 giây.' }),
    sk({ key: 'R', name: 'Tụ Linh Trận', element: 'Thuy', kind: 'buff', mpCost: 14, cooldown: 14, dmgMult: 0, range: 0, aoeRadius: 0, buff: { type: 'shield', value: 35, duration: 8 }, desc: 'Trận tụ linh hộ thể: khiên hấp thụ 35 sát thương, 8 giây.' }),
    sk({ key: 'F', name: 'Ngũ Hành Phù Diệt', element: 'Thuy', kind: 'aoe', mpCost: 38, cooldown: 16, dmgMult: 2.9, range: 8, aoeRadius: 5, slowSeconds: 1, desc: 'Phù diệt diện rộng, tuyệt kỹ của Phù Trận Tu.' }),
  ],
};

// ---------- Phương pháp tu luyện ----------
export type MethodId = 'tinh-toa' | 'van-chuyen' | 'luyen-the' | 'ngo-dao';
export interface CultivationMethod {
  id: MethodId;
  name: string;
  icon: string;
  desc: string;
  /** Hệ số Tu Vi khi thiền (nhân với tuViPerSecond = 2/s). Tĩnh tọa = 3 như prototype */
  tuViMult: number;
  canCoPerSecond: number;
  /** Ngộ đạo: mỗi insight cần ~8 giây; 0 = không tích lũy kiểu này */
  insightEverySeconds: number;
  /** Tĩnh tọa: tỉ lệ đốn ngộ ngẫu nhiên mỗi giây (như prototype) */
  insightChancePerSecond: number;
  /** 'root': Vận chu thiên — Tu Vi ×1.3 nhờ linh căn tương hợp */
  affinity: 'root' | 'none';
}
export const CULTIVATION_METHODS: CultivationMethod[] = [
  { id: 'tinh-toa', name: 'Tĩnh Tọa', icon: '🧘', desc: 'Cân bằng: Tu Vi ×3, Căn Cơ +0.6/s, thỉnh thoảng đốn ngộ.', tuViMult: 3, canCoPerSecond: 0.6, insightEverySeconds: 0, insightChancePerSecond: 0.04, affinity: 'none' },
  { id: 'van-chuyen', name: 'Vận Chu Thiên', icon: '🌀', desc: 'Tu Vi ×4.5 (×1.3 thêm nhờ linh căn tương hợp), Căn Cơ chỉ +0.1/s.', tuViMult: 4.5, canCoPerSecond: 0.1, insightEverySeconds: 0, insightChancePerSecond: 0, affinity: 'root' },
  { id: 'luyen-the', name: 'Luyện Thể', icon: '🪨', desc: 'Tu Vi ×1.5 nhưng Căn Cơ +1.5/s — nền tảng vững chắc.', tuViMult: 1.5, canCoPerSecond: 1.5, insightEverySeconds: 0, insightChancePerSecond: 0, affinity: 'none' },
  { id: 'ngo-dao', name: 'Ngộ Đạo', icon: '✨', desc: 'Tu Vi ×1, mỗi ~8 giây +1 Ngộ Tính, dễ gặp kỳ ngộ.', tuViMult: 1, canCoPerSecond: 0.2, insightEverySeconds: 8, insightChancePerSecond: 0, affinity: 'none' },
];
export function methodById(id: MethodId): CultivationMethod {
  return CULTIVATION_METHODS.find((m) => m.id === id) ?? CULTIVATION_METHODS[0];
}

// ---------- Sự kiện tu luyện ----------
export interface CultEventChoice { label: string; }
export interface CultEventDef { id: string; title: string; desc: string; choices: [string, string] }
export const CULT_EVENTS: CultEventDef[] = [
  { id: 'don-ngo', title: '💡 Đốn Ngộ', desc: 'Một tia linh quang lóe lên trong tâm thức. Nắm bắt nó thế nào?', choices: ['Sâu vào tâm pháp: +3 Ngộ Tính', 'Hóa thành tu vi: +60 Tu Vi'] },
  { id: 'di-bien', title: '🌪️ Linh Khí Dị Biến', desc: 'Linh khí quanh thân bỗng cuộn trào bất thường — cơ hội lớn, rủi ro cũng lớn.', choices: ['Mạo hiểm hấp thụ: +130 Tu Vi, −10 Căn Cơ', 'An toàn dẫn khí: +25 Tu Vi'] },
  { id: 'tam-ma', title: '👁️ Tâm Ma Quấy Nhiễu', desc: 'Tâm ma thì thầm bên tai, dao động đạo tâm...', choices: ['Cắn răng chịu đựng: −30 Tu Vi', 'Dùng 2 Ngộ Tính trấn áp: +8 Căn Cơ'] },
];

// ---------- Yêu thú ----------
export interface BeastType {
  id: string;
  name: string;
  element: Element;
  maxHp: number;
  attackMin: number;
  attackMax: number;
  chaseSpeed: number;
  scale: number;
  elongate: number; // 1 = bình thường, >1 = thân dài (xà)
  bodyColor: [number, number, number];
  darkColor: [number, number, number];
  tuViReward: number;
  linhThachMin: number;
  linhThachMax: number;
  /** 'beast' = yêu thú thường, 'golem' = thạch tượng (boss bí cảnh) */
  form?: 'beast' | 'golem';
}
export const BEAST_TYPES: BeastType[] = [
  { id: 'lang', name: 'Hắc Phong Lang', element: 'Hoa', maxHp: 120, attackMin: 7, attackMax: 12, chaseSpeed: 2.4, scale: 1, elongate: 1, bodyColor: [0.32, 0.22, 0.3], darkColor: [0.18, 0.12, 0.2], tuViReward: 30, linhThachMin: 8, linhThachMax: 15 },
  { id: 'moc-tinh', name: 'Mộc Tinh', element: 'Moc', maxHp: 230, attackMin: 9, attackMax: 14, chaseSpeed: 1.7, scale: 1.35, elongate: 1, bodyColor: [0.25, 0.45, 0.22], darkColor: [0.3, 0.2, 0.12], tuViReward: 45, linhThachMin: 12, linhThachMax: 20 },
  { id: 'thuy-xa', name: 'Thủy Xà', element: 'Thuy', maxHp: 80, attackMin: 6, attackMax: 10, chaseSpeed: 3.4, scale: 0.85, elongate: 1.9, bodyColor: [0.2, 0.45, 0.65], darkColor: [0.12, 0.3, 0.5], tuViReward: 25, linhThachMin: 6, linhThachMax: 12 },
  // Giai đoạn 2: Ám Ảnh Lang (Hắc Phong Lâm) + Boss Thạch Tượng (bí cảnh)
  { id: 'am-lang', name: 'Ám Ảnh Lang', element: 'Kim', maxHp: 150, attackMin: 10, attackMax: 16, chaseSpeed: 2.8, scale: 1.05, elongate: 1, bodyColor: [0.13, 0.09, 0.2], darkColor: [0.05, 0.04, 0.1], tuViReward: 40, linhThachMin: 12, linhThachMax: 20 },
  { id: 'thach-tuong', name: 'Hộ Pháp Thạch Tượng', element: 'Tho', maxHp: 950, attackMin: 14, attackMax: 20, chaseSpeed: 1.1, scale: 1.9, elongate: 1, bodyColor: [0.45, 0.42, 0.4], darkColor: [0.3, 0.28, 0.26], tuViReward: 0, linhThachMin: 0, linhThachMax: 0, form: 'golem' },
];
export function beastTypeById(id: string): BeastType {
  return BEAST_TYPES.find((b) => b.id === id) ?? BEAST_TYPES[0];
}
export const ELITE_CHANCE = 0.2;
export const ELITE = { hpMult: 3, atkMult: 1.5, rewardMult: 2, scaleMult: 1.4, insightChance: 0.5 };

/** Hệ khắc lại hệ cho trước (dùng cho khiên của boss: phải dùng hệ khắc mới phá được) */
export function counterOf(el: Element): Element {
  const found = ELEMENTS.find((e) => OVERCOMES[e] === el);
  return found ?? 'Kim';
}

// =====================================================================
// GIAI ĐOẠN 2 — World: Bản đồ / Bí cảnh / Nhiệm vụ / Công pháp / Vật phẩm
// =====================================================================

// ---------- Địa điểm: 3 bản đồ + 2 bí cảnh ----------
export type LocationId = 'thanh-van' | 'linh-khe' | 'hac-phong' | 'bc-sao-huyet' | 'bc-dong-phu';
export type LocationKind = 'map' | 'dungeonA' | 'dungeonB';
export type GroundProfile = 'thanh-van' | 'linh-khe' | 'hac-phong' | 'arena';

export interface LocationDef {
  id: LocationId;
  kind: LocationKind;
  name: string;
  icon: string;
  desc: string;
  /** stageIndex tối thiểu để mở (4 = Luyện Khí Sơ Kỳ, 8 = Trúc Cơ Sơ Kỳ) */
  unlockStage: number;
  unlockLabel: string;
  /** Linh khí: hệ số Tu Vi / Căn Cơ khi thiền tại đây */
  auraTuVi: number;
  auraCanCo: number;
  /** Hệ số nhân chỉ số quái tại đây */
  beastStatMul: number;
  eliteChance: number;
  beastTypeIds: string[];
  groundProfile: GroundProfile;
  spawn: [number, number];
  /** Bán kính giới hạn di chuyển */
  moveRadius: number;
}

export const LOCATIONS: LocationDef[] = [
  {
    id: 'thanh-van', kind: 'map', name: 'Thanh Vân Sơn', icon: '🏔️',
    desc: 'Núi tu luyện khởi đầu, linh khí trung hòa (Tu Vi ×1.0).',
    unlockStage: 0, unlockLabel: 'Mở từ đầu', auraTuVi: 1, auraCanCo: 1,
    beastStatMul: 1, eliteChance: 0.2, beastTypeIds: ['lang', 'moc-tinh', 'thuy-xa'],
    groundProfile: 'thanh-van', spawn: [0, 3], moveRadius: 40,
  },
  {
    id: 'linh-khe', kind: 'map', name: 'Linh Khê Cốc', icon: '🌿',
    desc: 'Thung lũng suối linh, hoa linh phát sáng — thiền định Tu Vi ×1.5.',
    unlockStage: 4, unlockLabel: 'Cần Luyện Khí', auraTuVi: 1.5, auraCanCo: 1,
    beastStatMul: 1.3, eliteChance: 0.2, beastTypeIds: ['thuy-xa', 'moc-tinh'],
    groundProfile: 'linh-khe', spawn: [0, 3], moveRadius: 40,
  },
  {
    id: 'hac-phong', kind: 'map', name: 'Hắc Phong Lâm', icon: '🌑',
    desc: 'Rừng đen gió dữ, nguy hiểm — nhưng ma luyện Căn Cơ ×1.5, Tu Vi ×1.2. Quái mạnh ×1.8, tinh anh 30%.',
    unlockStage: 8, unlockLabel: 'Cần Trúc Cơ', auraTuVi: 1.2, auraCanCo: 1.5,
    beastStatMul: 1.8, eliteChance: 0.3, beastTypeIds: ['am-lang', 'lang'],
    groundProfile: 'hac-phong', spawn: [0, 3], moveRadius: 40,
  },
  {
    id: 'bc-sao-huyet', kind: 'dungeonA', name: 'Bí Cảnh · Yêu Thú Sào Huyệt', icon: '🕳️',
    desc: 'Hang ổ yêu thú: vượt 3 đợt quái để mở rương báu (Linh Thạch, Tu Vi, cơ hội rơi trang bị).',
    unlockStage: 4, unlockLabel: 'Cần Luyện Khí', auraTuVi: 1, auraCanCo: 1,
    beastStatMul: 1.1, eliteChance: 0.15, beastTypeIds: ['lang', 'thuy-xa', 'moc-tinh'],
    groundProfile: 'arena', spawn: [0, 26], moveRadius: 44,
  },
  {
    id: 'bc-dong-phu', kind: 'dungeonB', name: 'Bí Cảnh · Cổ Tu Động Phủ', icon: '🏛️',
    desc: 'Động phủ cổ tu 3 gian phòng — gian cuối có Hộ Pháp Thạch Tượng trấn giữ bảo vật.',
    unlockStage: 8, unlockLabel: 'Cần Trúc Cơ', auraTuVi: 1, auraCanCo: 1,
    beastStatMul: 1.2, eliteChance: 0.15, beastTypeIds: ['am-lang', 'moc-tinh'],
    groundProfile: 'arena', spawn: [0, 26], moveRadius: 46,
  },
];
export function locationById(id: LocationId): LocationDef {
  return LOCATIONS.find((l) => l.id === id) ?? LOCATIONS[0];
}

// ---------- Công pháp ----------
export interface TechEffects { tuViPct: number; canCoPct: number; dmgPct: number; critPct: number; mpRegenPct: number; cdPct: number }
export const NO_TECH_EFFECTS: TechEffects = { tuViPct: 0, canCoPct: 0, dmgPct: 0, critPct: 0, mpRegenPct: 0, cdPct: 0 };
export interface TechniqueDef {
  id: string;
  school: SchoolId;
  name: string;
  element: Element;
  unlockStage: number;
  unlockLabel: string;
  insightCost: number;
  effects: Partial<TechEffects>;
  effectsLabel: string;
  desc: string;
}
export const TECHNIQUES: TechniqueDef[] = [
  { id: 'kiem-y', school: 'kiem', name: 'Kiếm Ý Thông Minh', element: 'Kim', unlockStage: 0, unlockLabel: 'Luyện Thể', insightCost: 2, effects: { dmgPct: 8, critPct: 3 }, effectsLabel: 'Sát thương +8%, Bạo kích +3%', desc: 'Ngưng kiếm ý vào tâm, kiếm chưa ra mà ý đã tới.' },
  { id: 'thanh-phong-kiem-phap', school: 'kiem', name: 'Thanh Phong Kiếm Pháp', element: 'Kim', unlockStage: 4, unlockLabel: 'Luyện Khí', insightCost: 4, effects: { tuViPct: 15, cdPct: 10 }, effectsLabel: 'Tu Vi +15%, Hồi chiêu −10%', desc: 'Kiếm pháp nhẹ như gió thoảng Thanh Vân, tu luyện cũng theo đó mà nhanh.' },
  { id: 'hoa-diem-quyet', school: 'phap', name: 'Hỏa Diệm Quyết', element: 'Hoa', unlockStage: 0, unlockLabel: 'Luyện Thể', insightCost: 2, effects: { dmgPct: 10 }, effectsLabel: 'Sát thương +10%', desc: 'Dẫn hỏa linh khí nhập thể, pháp thuật thêm phần bạo liệt.' },
  { id: 'cuu-chuyen-linh-phap', school: 'phap', name: 'Cửu Chuyển Linh Pháp', element: 'Hoa', unlockStage: 8, unlockLabel: 'Trúc Cơ', insightCost: 5, effects: { tuViPct: 20, mpRegenPct: 30 }, effectsLabel: 'Tu Vi +20%, Hồi Linh Lực +30%', desc: 'Linh khí vận chuyển chín vòng chu thiên không dứt.' },
  { id: 'kim-cang-the', school: 'the', name: 'Kim Cang Thể Phách', element: 'Tho', unlockStage: 0, unlockLabel: 'Luyện Thể', insightCost: 2, effects: { canCoPct: 25, dmgPct: 4 }, effectsLabel: 'Căn Cơ tăng +25%, Sát thương +4%', desc: 'Rèn thân như kim cang, căn cơ vững như bàn thạch.' },
  { id: 'long-tuong-cong', school: 'the', name: 'Long Tượng Bàn Nhược Công', element: 'Tho', unlockStage: 8, unlockLabel: 'Trúc Cơ', insightCost: 6, effects: { dmgPct: 14, canCoPct: 15 }, effectsLabel: 'Sát thương +14%, Căn Cơ tăng +15%', desc: 'Sức mạnh long tượng, một quyền trấn sơn hà.' },
  { id: 'dan-dao-tam-kinh', school: 'dan', name: 'Đan Đạo Tâm Kinh', element: 'Moc', unlockStage: 0, unlockLabel: 'Luyện Thể', insightCost: 2, effects: { tuViPct: 10, canCoPct: 10 }, effectsLabel: 'Tu Vi +10%, Căn Cơ tăng +10%', desc: 'Tâm tĩnh như mặt lò luyện đan, đạo cơ tự vững.' },
  { id: 'thao-moc-linh-quyet', school: 'dan', name: 'Thảo Mộc Linh Quyết', element: 'Moc', unlockStage: 4, unlockLabel: 'Luyện Khí', insightCost: 4, effects: { mpRegenPct: 25, tuViPct: 10 }, effectsLabel: 'Hồi Linh Lực +25%, Tu Vi +10%', desc: 'Cảm ứng linh khí thảo mộc, sinh sôi không ngừng.' },
  { id: 'tu-linh-tran-phap', school: 'phutran', name: 'Tụ Linh Trận Pháp', element: 'Thuy', unlockStage: 0, unlockLabel: 'Luyện Thể', insightCost: 3, effects: { tuViPct: 18 }, effectsLabel: 'Tu Vi +18%', desc: 'Bố trận tụ linh quanh thân, linh khí tự tìm đến.' },
  { id: 'ngu-hanh-tran-do', school: 'phutran', name: 'Ngũ Hành Trận Đồ', element: 'Thuy', unlockStage: 8, unlockLabel: 'Trúc Cơ', insightCost: 5, effects: { cdPct: 15, dmgPct: 8 }, effectsLabel: 'Hồi chiêu −15%, Sát thương +8%', desc: 'Trận đồ ngũ hành luân chuyển, xuất chiêu nhanh như chớp.' },
];
export function techniqueById(id: string): TechniqueDef | undefined { return TECHNIQUES.find((t) => t.id === id); }

// ---------- Vật phẩm / Trang bị ----------
export type EquipSlot = 'weapon' | 'armor' | 'boots' | 'accessory';
export const SLOT_LABEL: Record<EquipSlot, string> = { weapon: 'Vũ Khí', armor: 'Áo Giáp', boots: 'Giày', accessory: 'Ngọc Bội' };
export type ItemTier = 'Phàm' | 'Hoàng' | 'Huyền' | 'Địa';
export const TIER_ORDER: ItemTier[] = ['Phàm', 'Hoàng', 'Huyền', 'Địa'];
export interface ItemStats { atk?: number; def?: number; hp?: number; mp?: number; speed?: number; crit?: number }
export interface ItemDef {
  id: string;
  name: string;
  kind: 'equip' | 'consumable';
  slot?: EquipSlot;
  tier?: ItemTier;
  element?: Element;
  stats?: ItemStats;
  price?: number; // có = bán trong shop
  sellPrice: number;
  desc: string;
  swordRgb?: [number, number, number]; // màu phát sáng lưỡi kiếm khi trang bị vũ khí
  effect?: 'healHp' | 'restoreMp' | 'gainTuVi';
  effectValue?: number;
}
export function itemStatsLabel(it: ItemDef): string {
  if (it.kind === 'consumable') {
    if (it.effect === 'healHp') return `Hồi ${Math.round((it.effectValue ?? 0) * 100)}% HP`;
    if (it.effect === 'restoreMp') return 'Hồi đầy Linh Lực';
    if (it.effect === 'gainTuVi') return `+${it.effectValue} Tu Vi ngay`;
    return it.desc;
  }
  const s = it.stats ?? {};
  const parts: string[] = [];
  if (s.atk) parts.push(`Công +${s.atk}`);
  if (s.def) parts.push(`Thủ +${s.def}`);
  if (s.hp) parts.push(`HP +${s.hp}`);
  if (s.mp) parts.push(`Linh Lực +${s.mp}`);
  if (s.speed) parts.push(`Tốc +${s.speed}`);
  if (s.crit) parts.push(`Bạo +${s.crit}%`);
  return parts.join(' · ');
}
export const ITEMS: ItemDef[] = [
  // Vũ khí
  { id: 'thanh-moc-kiem', name: 'Thanh Mộc Kiếm', kind: 'equip', slot: 'weapon', tier: 'Phàm', element: 'Moc', stats: { atk: 4 }, price: 80, sellPrice: 30, swordRgb: [0.35, 0.9, 0.45], desc: 'Kiếm gỗ thanh mộc của đệ tử nhập môn.' },
  { id: 'huyen-thiet-kiem', name: 'Huyền Thiết Kiếm', kind: 'equip', slot: 'weapon', tier: 'Hoàng', element: 'Kim', stats: { atk: 9, crit: 2 }, price: 300, sellPrice: 120, swordRgb: [0.85, 0.88, 1], desc: 'Sắt huyền nặng trầm, chém đá như chém bùn.' },
  { id: 'luu-hoa-kiem', name: 'Lưu Hỏa Kiếm', kind: 'equip', slot: 'weapon', tier: 'Huyền', element: 'Hoa', stats: { atk: 16, crit: 3 }, sellPrice: 260, swordRgb: [1, 0.42, 0.18], desc: 'Lưỡi kiếm luôn ấm như có lửa chảy bên trong. (Chỉ rơi từ quái/bí cảnh)' },
  { id: 'dia-tam-co-kiem', name: 'Địa Tâm Cổ Kiếm', kind: 'equip', slot: 'weapon', tier: 'Địa', element: 'Tho', stats: { atk: 26, crit: 4 }, sellPrice: 600, swordRgb: [1, 0.8, 0.25], desc: 'Cổ kiếm chôn sâu trong địa tâm ngàn năm. (Chỉ rơi từ boss/tinh anh)' },
  // Áo giáp
  { id: 'bo-y', name: 'Bố Y', kind: 'equip', slot: 'armor', tier: 'Phàm', stats: { def: 3, hp: 15 }, price: 60, sellPrice: 24, desc: 'Áo vải thô, hơn không có gì.' },
  { id: 'linh-tam-bao-y', name: 'Linh Tàm Bảo Y', kind: 'equip', slot: 'armor', tier: 'Hoàng', stats: { def: 7, hp: 35 }, price: 280, sellPrice: 110, desc: 'Dệt từ tơ linh tàm, mềm mà khó xuyên.' },
  { id: 'huyen-vu-giap', name: 'Huyền Vũ Giáp', kind: 'equip', slot: 'armor', tier: 'Huyền', stats: { def: 13, hp: 70 }, sellPrice: 240, desc: 'Giáp khắc văn huyền vũ, vững như mai rùa thần. (Chỉ rơi từ quái/bí cảnh)' },
  { id: 'dia-long-giap', name: 'Địa Long Bì Giáp', kind: 'equip', slot: 'armor', tier: 'Địa', stats: { def: 20, hp: 120 }, sellPrice: 520, desc: 'Da địa long lột xác, đao thương khó nhập. (Chỉ rơi từ boss/tinh anh)' },
  // Giày
  { id: 'tat-phong-ngoa', name: 'Tật Phong Ngoa', kind: 'equip', slot: 'boots', tier: 'Phàm', stats: { speed: 0.3 }, price: 70, sellPrice: 28, desc: 'Giày nhẹ, bước đi như gió.' },
  { id: 'van-du-ngoa', name: 'Vân Du Ngoa', kind: 'equip', slot: 'boots', tier: 'Hoàng', stats: { speed: 0.6, def: 2 }, price: 260, sellPrice: 100, desc: 'Đạp mây mà đi, thân pháp linh hoạt.' },
  { id: 'lang-ba-ngoa', name: 'Lăng Ba Ngoa', kind: 'equip', slot: 'boots', tier: 'Huyền', stats: { speed: 1.0, def: 4 }, sellPrice: 220, desc: 'Lăng ba vi bộ — lướt trên sóng như trên đất bằng. (Chỉ rơi từ quái/bí cảnh)' },
  // Ngọc bội
  { id: 'linh-thach-truy', name: 'Linh Thạch Trụy', kind: 'equip', slot: 'accessory', tier: 'Phàm', stats: { mp: 15 }, price: 90, sellPrice: 36, desc: 'Mặt dây chuyền khắc từ linh thạch vụn.' },
  { id: 'tu-linh-ngoc-boi', name: 'Tụ Linh Ngọc Bội', kind: 'equip', slot: 'accessory', tier: 'Hoàng', stats: { mp: 30, atk: 3 }, price: 150, sellPrice: 60, desc: 'Ngọc bội tụ linh khí, đeo vào thấy tâm thần sảng khoái.' },
  { id: 'ngu-hanh-chau', name: 'Ngũ Hành Châu', kind: 'equip', slot: 'accessory', tier: 'Huyền', stats: { mp: 50, atk: 6, crit: 2 }, sellPrice: 280, desc: 'Châu chứa ngũ hành luân chuyển không dứt. (Chỉ rơi từ quái/bí cảnh)' },
  // Tiêu hao
  { id: 'hoi-huyet-dan', name: 'Hồi Huyết Đan', kind: 'consumable', price: 20, sellPrice: 8, effect: 'healHp', effectValue: 0.5, desc: 'Đan dược hồi phục 50% HP ngay lập tức.' },
  { id: 'hoi-linh-dan', name: 'Hồi Linh Đan', kind: 'consumable', price: 25, sellPrice: 10, effect: 'restoreMp', effectValue: 1, desc: 'Hồi đầy Linh Lực ngay lập tức.' },
  { id: 'tu-linh-dan', name: 'Tụ Linh Đan', kind: 'consumable', price: 40, sellPrice: 16, effect: 'gainTuVi', effectValue: 80, desc: 'Luyện hóa ngay +80 Tu Vi (không vượt quá ngưỡng tiểu cảnh).' },
];
export function itemById(id: string): ItemDef | undefined { return ITEMS.find((i) => i.id === id); }
export const SHOP_IDS: string[] = [
  'hoi-huyet-dan', 'hoi-linh-dan', 'tu-linh-dan',
  'thanh-moc-kiem', 'bo-y', 'tat-phong-ngoa', 'linh-thach-truy', 'tu-linh-ngoc-boi',
  'huyen-thiet-kiem', 'linh-tam-bao-y', 'van-du-ngoa',
];
/** Bậc phẩm tối đa có thể rơi ở stage hiện tại (tinh anh/boss +1 bậc) */
export function lootTierCap(stageIndex: number, bonus: number): number {
  return Math.min(3, Math.floor(stageIndex / 4) + bonus);
}
export function equipPoolForTierCap(cap: number): ItemDef[] {
  return ITEMS.filter((i) => i.kind === 'equip' && i.tier && TIER_ORDER.indexOf(i.tier) <= cap);
}

// ---------- Nhiệm vụ ----------
export type CounterKey = 'kills' | 'eliteKills' | 'meditateSeconds' | 'breakthroughs' | 'linhThachEarned' | 'dungeonAClears' | 'dungeonBClears' | 'bossKills' | 'mapsVisited';
export type QuestGroup = 'Thiên Đạo' | 'Kỳ Ngộ' | 'Tông Môn' | 'Thám Hiểm';
export interface QuestRewards { tuVi?: number; linhThach?: number; ngoTinh?: number; canCo?: number; itemId?: string; itemQty?: number }
export function rewardsLabel(r: QuestRewards): string {
  const parts: string[] = [];
  if (r.tuVi) parts.push(`+${r.tuVi} Tu Vi`);
  if (r.linhThach) parts.push(`+${r.linhThach} Linh Thạch`);
  if (r.ngoTinh) parts.push(`+${r.ngoTinh} Ngộ Tính`);
  if (r.canCo) parts.push(`+${r.canCo} Căn Cơ`);
  if (r.itemId) { const it = itemById(r.itemId); parts.push(`${it ? it.name : r.itemId} ×${r.itemQty ?? 1}`); }
  return parts.join(' · ');
}
export interface QuestDef {
  id: string;
  group: QuestGroup;
  name: string;
  desc: string;
  kind: 'counter' | 'choice';
  counter?: CounterKey;
  target?: number;
  targetStep?: number; // nhiệm vụ lặp: mỗi lần nhận thưởng, mục tiêu tăng thêm
  repeatable?: boolean;
  rewards?: QuestRewards;
  /** Kỳ ngộ: hiện khi đạt điều kiện */
  conditionStage?: number;
  conditionCounter?: { key: CounterKey; value: number };
  choices?: [string, string];
  choiceRewards?: [QuestRewards, QuestRewards];
}
export const QUESTS: QuestDef[] = [
  // Thiên Đạo — lặp lại được
  { id: 'td-tru-yeu', group: 'Thiên Đạo', name: 'Thiên Đạo · Trừ Yêu', desc: 'Hạ yêu thú để trấn an sơn lâm.', kind: 'counter', counter: 'kills', target: 5, targetStep: 3, repeatable: true, rewards: { tuVi: 40, linhThach: 10 } },
  { id: 'td-tinh-tu', group: 'Thiên Đạo', name: 'Thiên Đạo · Tĩnh Tu', desc: 'Thiền định tích lũy đạo tâm (giây thiền).', kind: 'counter', counter: 'meditateSeconds', target: 120, targetStep: 60, repeatable: true, rewards: { ngoTinh: 2, tuVi: 30 } },
  { id: 'td-dot-pha', group: 'Thiên Đạo', name: 'Thiên Đạo · Tiến Cảnh', desc: 'Đột phá thành công để tiến thêm một bước trên đạo lộ.', kind: 'counter', counter: 'breakthroughs', target: 1, targetStep: 1, repeatable: true, rewards: { linhThach: 30, canCo: 5 } },
  // Kỳ ngộ — chọn 1 trong 2, chỉ 1 lần
  { id: 'kn-di-vat', group: 'Kỳ Ngộ', name: 'Kỳ Ngộ · Di Vật Cổ Nhân', desc: 'Đạt Luyện Khí, ngươi nhặt được một hộp ngọc cổ trong hang núi...', kind: 'choice', conditionStage: 4, choices: ['Mở hộp ngọc: nhận Tụ Linh Ngọc Bội', 'Hấp thụ linh khí trong hộp: +5 Ngộ Tính'], choiceRewards: [{ itemId: 'tu-linh-ngoc-boi', itemQty: 1 }, { ngoTinh: 5 }] },
  { id: 'kn-thuong-nhan', group: 'Kỳ Ngộ', name: 'Kỳ Ngộ · Thương Nhân Bí Ẩn', desc: 'Hạ đủ 15 yêu thú, một thương nhân lạ mặt tìm đến ngỏ ý thu mua chiến lợi phẩm.', kind: 'choice', conditionCounter: { key: 'kills', value: 15 }, choices: ['Bán chiến lợi phẩm: +80 Linh Thạch', 'Đổi lấy linh khí tinh thuần: +100 Tu Vi'], choiceRewards: [{ linhThach: 80 }, { tuVi: 100 }] },
  { id: 'kn-tien-boi', group: 'Kỳ Ngộ', name: 'Kỳ Ngộ · Tiền Bối Truyền Pháp', desc: 'Tích lũy 300 Linh Thạch, một vị tiền bối ẩn tu chú ý đến ngươi.', kind: 'choice', conditionCounter: { key: 'linhThachEarned', value: 300 }, choices: ['Thỉnh giáo tâm pháp: +4 Ngộ Tính', 'Nhờ tiền bối quán đỉnh: +10 Căn Cơ'], choiceRewards: [{ ngoTinh: 4 }, { canCo: 10 }] },
  // Tông Môn
  { id: 'tm-tinh-anh', group: 'Tông Môn', name: 'Tông Môn · Săn Tinh Anh', desc: 'Hạ 2 yêu thú tinh anh ⭐ để chứng minh thực lực.', kind: 'counter', counter: 'eliteKills', target: 2, rewards: { linhThach: 60, itemId: 'hoi-huyet-dan', itemQty: 2 } },
  { id: 'tm-sao-huyet', group: 'Tông Môn', name: 'Tông Môn · Dẹp Sào Huyệt', desc: 'Vượt qua Bí Cảnh Yêu Thú Sào Huyệt 1 lần.', kind: 'counter', counter: 'dungeonAClears', target: 1, rewards: { linhThach: 80, tuVi: 100 } },
  { id: 'tm-phu-ho', group: 'Tông Môn', name: 'Tông Môn · Tích Lũy Linh Thạch', desc: 'Tổng Linh Thạch kiếm được đạt 500.', kind: 'counter', counter: 'linhThachEarned', target: 500, rewards: { ngoTinh: 3, linhThach: 50 } },
  // Thám Hiểm
  { id: 'th-ba-map', group: 'Thám Hiểm', name: 'Thám Hiểm · Ba Miền Đất', desc: 'Đặt chân đến cả 3 bản đồ: Thanh Vân Sơn, Linh Khê Cốc, Hắc Phong Lâm.', kind: 'counter', counter: 'mapsVisited', target: 3, rewards: { tuVi: 120, linhThach: 40 } },
  { id: 'th-dong-phu', group: 'Thám Hiểm', name: 'Thám Hiểm · Cổ Tu Động Phủ', desc: 'Thám hiểm thành công Cổ Tu Động Phủ 1 lần.', kind: 'counter', counter: 'dungeonBClears', target: 1, rewards: { linhThach: 150, itemId: 'hoi-linh-dan', itemQty: 2 } },
  { id: 'th-diet-tuong', group: 'Thám Hiểm', name: 'Thám Hiểm · Diệt Thạch Tượng', desc: 'Đánh bại Hộ Pháp Thạch Tượng trong Cổ Tu Động Phủ.', kind: 'counter', counter: 'bossKills', target: 1, rewards: { ngoTinh: 5, linhThach: 100 } },
];

// ---------- Thiên kiếp ----------
export const TRIBULATION = {
  waves: 3,
  strikesPerWave: 3,
  warningSeconds: 1.2,
  pauseSeconds: 0.9,
  strikeRadius: 2.2,
  strikeDamage: 20,
  successBonus: 10, // +10% tỉ lệ đột phá nếu vượt qua
};
