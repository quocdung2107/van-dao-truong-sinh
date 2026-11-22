// Test tự động cho Offline Progress (Giai đoạn 3) — không cần thêm thư viện nào.
// Cách chạy: node scripts/test-offline.mjs
// Cơ chế: dùng TypeScript compiler sẵn có trong node_modules để biên dịch
// src/game/data.ts + src/game/cultivation.ts sang CommonJS trong thư mục tạm,
// rồi require và kiểm tra các hàm thuần (computeOffline) + vòng đời báo cáo
// (prepareOffline/claimOffline) trên class Cultivation (localStorage không tồn tại
// trong Node -> các hàm load/save tự bỏ qua nhờ try/catch sẵn có).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = mkdtempSync(join(tmpdir(), 'vdts-test-'));
const tscBin = join(root, 'node_modules', 'typescript', 'bin', 'tsc');

let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures += 1; console.log(`  FAIL  ${name} ${detail}`); }
}
function approx(name, actual, expected, tolPct = 1) {
  const tol = Math.abs(expected) * tolPct / 100;
  check(name, Math.abs(actual - expected) <= tol, `(thực=${actual}, kỳ vọng=${expected} ±${tolPct}%)`);
}

try {
  execFileSync(process.execPath, [
    tscBin, '--ignoreConfig',
    join(root, 'src/game/data.ts'), join(root, 'src/game/cultivation.ts'),
    '--outDir', outDir, '--module', 'commonjs', '--target', 'es2022',
    '--moduleResolution', 'bundler', '--skipLibCheck', '--lib', 'es2022,dom',
  ], { stdio: 'pipe' });
} catch (e) {
  console.error('Không biên dịch được data.ts/cultivation.ts cho test:\n', e.stdout?.toString() ?? e.message);
  process.exit(1);
}

const require2 = createRequire(import.meta.url);
const { Cultivation, computeOffline, meditateTuViRate } = require2(join(outDir, 'cultivation.js'));
const { methodById, NO_TECH_EFFECTS, NO_EQUIP } = require2(join(outDir, 'data.js'));

const baseSnap = {
  stageIndex: 8, // Trúc Cơ Sơ Kỳ — tuViNeed 800
  tuVi: 0, canCo: 30,
  character: { name: 'Test', root: 'Kim', school: 'kiem' },
  activity: { kind: 'meditate', mapId: 'thanh-van', methodId: 'tinh-toa' },
  spiritArrayLevel: 0, linhFieldLevel: 0,
  tech: { ...NO_TECH_EFFECTS }, equip: { ...NO_EQUIP },
  seed: 1700000000000,
};

console.log('— Test 1: computeOffline thiền 100 giây khớp công thức tốc độ dùng chung —');
{
  const rate = meditateTuViRate(methodById('tinh-toa'), 1, 0, 0); // 2 * 3 = 6/s
  approx('tốc độ thiền Tĩnh Tọa = 6 Tu Vi/s', rate, 6, 0.01);
  const g = computeOffline(baseSnap, 100);
  approx('Tu Vi sau 100s = rate × 100', g.tuVi, rate * 100);
  approx('Căn Cơ sau 100s = 0.6 × 100', g.canCo, 60);
  check('Thiền Tĩnh Tọa không cho Linh Thạch/Linh Thảo', g.linhThach === 0 && g.linhThao === 0);
}

console.log('— Test 2: trần offline (vắng 24 giờ, Tụ Linh Trận cấp 0 -> chỉ tính 8 giờ) + nhận 1 lần duy nhất —');
{
  const c = new Cultivation();
  c.character = { name: 'Test', root: 'Kim', school: 'kiem' };
  c.stageIndex = 8; c.tuVi = 0; c.canCo = 30;
  c.offlineActivity = { kind: 'meditate', mapId: 'thanh-van', methodId: 'tinh-toa' };
  const now = Date.now();
  c.lastActiveAt = now - 24 * 3600000;
  c.pendingOffline = null;
  const report = c.prepareOffline(now);
  check('Có báo cáo offline', !!report);
  check('countedSeconds bị kẹp ở trần 8h = 28800', report && report.countedSeconds === 28800, `(thực=${report?.countedSeconds})`);
  check('elapsedSeconds vẫn ghi đủ 24h', report && report.elapsedSeconds === 86400, `(thực=${report?.elapsedSeconds})`);
  check('Tu Vi bị kẹp ở ngưỡng tiểu cảnh (800)', report && report.tuVi === 800, `(thực=${report?.tuVi})`);
  const claimed = c.claimOffline();
  check('Nhận lần 1 trả về báo cáo', !!claimed);
  const tuViAfterFirst = c.tuVi;
  check('Tu Vi sau nhận = 800', tuViAfterFirst === 800, `(thực=${tuViAfterFirst})`);
  const second = c.claimOffline();
  check('Nhận lần 2 trả về null (không cộng trùng)', second === null);
  check('Tu Vi không đổi sau lần nhận 2', c.tuVi === tuViAfterFirst);
  const again = c.prepareOffline(Date.now());
  check('prepareOffline ngay sau nhận không tạo báo cáo mới', again === null);
}

console.log('— Test 3: săn offline xác định theo hạt giống (cùng input -> cùng output, kills <= 400) —');
{
  const huntSnap = { ...baseSnap, activity: { kind: 'hunt', mapId: 'thanh-van', methodId: 'tinh-toa' } };
  const a = computeOffline(huntSnap, 3600);
  const b = computeOffline(huntSnap, 3600);
  check('Hai lần tính cho kết quả giống hệt (kể cả rơi đồ)', JSON.stringify(a) === JSON.stringify(b));
  check('kills trong giới hạn 1..400', a.kills >= 1 && a.kills <= 400, `(kills=${a.kills})`);
  check('Linh Thảo = floor(kills × 0.5)', a.linhThao === Math.floor(a.kills * 0.5));
  check('Rơi đồ tối đa 2 món', a.items.length <= 2, `(items=${a.items.length})`);
  const capped = computeOffline(huntSnap, 100000);
  check('kills bị kẹp ở 400 khi thời gian rất dài', capped.kills === 400, `(kills=${capped.kills})`);
}

console.log('— Test 4: đồng hồ lùi / vắng mặt ngắn -> không có báo cáo —');
{
  const c = new Cultivation();
  c.character = { name: 'Test', root: 'Kim', school: 'kiem' };
  c.lastActiveAt = Date.now() + 3600000; // đồng hồ bị chỉnh tới tương lai
  c.pendingOffline = null;
  check('Đồng hồ lùi: không tạo báo cáo', c.prepareOffline(Date.now()) === null);
  const c2 = new Cultivation();
  c2.character = { name: 'Test', root: 'Kim', school: 'kiem' };
  c2.lastActiveAt = Date.now() - 60000; // mới vắng 1 phút
  c2.pendingOffline = null;
  check('Vắng 1 phút (< 5 phút): không tạo báo cáo', c2.prepareOffline(Date.now()) === null);
}

rmSync(outDir, { recursive: true, force: true });
console.log(failures === 0 ? '\n✅ TẤT CẢ TEST OFFLINE ĐẠT' : `\n❌ Có ${failures} test KHÔNG đạt`);
process.exit(failures === 0 ? 0 : 1);
