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
export function computeStats(stageIndex: number, canCo: number, schoolId: SchoolId): DerivedStats {
  const sch = schoolById(schoolId);
  const pf = powerFactor(canCo);
  const g = stageIndex; // 0..15
  return {
    maxHp: Math.round(100 * (1 + g * 0.4) * sch.mult.hp),
    maxMp: Math.round(100 * (1 + g * 0.3) * sch.mult.mp),
    atk: 21 * (1 + g * 0.35) * sch.mult.atk * pf,
    def: (8 + g * 4) * sch.mult.def * pf,
    speed: 5.2 * sch.mult.speed,
    critChance: sch.critChance,
    critDmg: 1.5,
  };
}
/** Giảm sát thương nhận vào nhờ Thủ: dmg * 100/(100+def) */
export function mitigate(rawDmg: number, def: number): number {
  return rawDmg * (100 / (100 + def));
}

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
}
export const BEAST_TYPES: BeastType[] = [
  { id: 'lang', name: 'Hắc Phong Lang', element: 'Hoa', maxHp: 120, attackMin: 7, attackMax: 12, chaseSpeed: 2.4, scale: 1, elongate: 1, bodyColor: [0.32, 0.22, 0.3], darkColor: [0.18, 0.12, 0.2], tuViReward: 30, linhThachMin: 8, linhThachMax: 15 },
  { id: 'moc-tinh', name: 'Mộc Tinh', element: 'Moc', maxHp: 230, attackMin: 9, attackMax: 14, chaseSpeed: 1.7, scale: 1.35, elongate: 1, bodyColor: [0.25, 0.45, 0.22], darkColor: [0.3, 0.2, 0.12], tuViReward: 45, linhThachMin: 12, linhThachMax: 20 },
  { id: 'thuy-xa', name: 'Thủy Xà', element: 'Thuy', maxHp: 80, attackMin: 6, attackMax: 10, chaseSpeed: 3.4, scale: 0.85, elongate: 1.9, bodyColor: [0.2, 0.45, 0.65], darkColor: [0.12, 0.3, 0.5], tuViReward: 25, linhThachMin: 6, linhThachMax: 12 },
];
export const ELITE_CHANCE = 0.2;
export const ELITE = { hpMult: 3, atkMult: 1.5, rewardMult: 2, scaleMult: 1.4, insightChance: 0.5 };

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
