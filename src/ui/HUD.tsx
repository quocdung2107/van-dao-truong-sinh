import { useEffect, useState } from 'react';
import { bridge, type HudState } from '../game/store';

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%`, background: color }} /></div>
      <span className="bar-value">{value}/{max}</span>
    </div>
  );
}

export default function HUD() {
  const [s, setS] = useState<HudState | null>(bridge.state);
  const [showHelp, setShowHelp] = useState(true);
  useEffect(() => bridge.onHud(setS), []);
  if (!s) return <div className="hud-loading">Đang tải Thanh Vân Sơn...</div>;

  return (
    <>
      {/* Panel trái: nhân vật + tu luyện */}
      <div className="hud-panel hud-left">
        <div className="realm-title">⚔️ {s.realmLabel}</div>
        <Bar value={s.tuVi} max={s.tuViNeed} color="linear-gradient(90deg,#2dd4bf,#0ea5e9)" label="Tu Vi" />
        <Bar value={s.hp} max={s.maxHp} color="linear-gradient(90deg,#f87171,#dc2626)" label="HP" />
        <Bar value={s.mp} max={s.maxMp} color="linear-gradient(90deg,#60a5fa,#2563eb)" label="Linh Lực" />
        <div className="stat-row">
          <span>🪨 Căn Cơ: <b>{s.canCo}</b>/100</span>
          <span>✨ Ngộ Tính: <b>{s.ngoTinh}</b></span>
          <span>🐺 Đã hạ: <b>{s.kills}</b></span>
        </div>
        <button
          className="btn-breakthrough"
          disabled={!s.canBreakthrough}
          onClick={() => bridge.send('breakthrough')}
          title={s.canBreakthrough ? `Tỉ lệ thành công ${s.breakthroughChance.toFixed(0)}%` : 'Cần Tu Vi đầy và Căn Cơ đủ'}
        >
          🌩️ ĐỘT PHÁ {s.canBreakthrough ? `(${s.breakthroughChance.toFixed(0)}%)` : ''}
        </button>
        {!s.canBreakthrough && <div className="hint">Đột phá cần: Tu Vi đầy + Căn Cơ ≥ 50 (65 khi lên cảnh giới mới). Thiền để tăng cả hai.</div>}
      </div>

      {/* Panel phải: yêu thú */}
      <div className="hud-panel hud-right">
        <div className="beast-title">🐺 Yêu Thú Hắc Phong</div>
        <Bar value={s.beastHp} max={s.beastMaxHp} color="linear-gradient(90deg,#fb923c,#ea580c)" label="HP quái" />
        <div className="hint">{s.beastAlive ? 'Đang lảng vảng quanh núi — lại gần sẽ bị nó đuổi đánh.' : 'Đã bị hạ! Sẽ hồi sinh sau vài giây.'}</div>
        {s.autoMode && <div className="auto-phase">🤖 Tự động: {s.autoPhase}</div>}
      </div>

      {/* Thanh nút điều khiển dưới */}
      <div className="hud-bottom">
        <div className="msg-box">{s.message}</div>
        <div className="btn-row">
          <button className={s.meditating ? 'btn active' : 'btn'} onClick={() => bridge.send('toggleMeditate')}>🧘 Thiền (C)</button>
          <button className={s.swordDrawn ? 'btn active' : 'btn'} onClick={() => bridge.send('toggleSword')}>🗡️ Rút Kiếm (R)</button>
          <button className="btn" onClick={() => bridge.send('attack')}>⚔️ Tấn Công (F)</button>
          <button className={s.autoMode ? 'btn active auto' : 'btn'} onClick={() => bridge.send('toggleAuto')}>🤖 Tự Động (Tab)</button>
          <button className="btn ghost" onClick={() => setShowHelp(!showHelp)}>❓ Hướng dẫn</button>
          <button className="btn ghost danger" onClick={() => { if (confirm('Chơi lại từ đầu? Tiến trình đã lưu sẽ bị xóa.')) bridge.send('resetSave'); }}>↺ Chơi lại</button>
        </div>
        {showHelp && (
          <div className="help-box">
            <b>Điều khiển:</b> W A S D — di chuyển &nbsp;•&nbsp; Kéo chuột — xoay camera, lăn chuột — zoom &nbsp;•&nbsp;
            Space — né (lướt nhanh) &nbsp;•&nbsp; F / Click chuột — tấn công &nbsp;•&nbsp; C — thiền &nbsp;•&nbsp; R — rút/cất kiếm &nbsp;•&nbsp; Tab — tự động săn quái
          </div>
        )}
      </div>
    </>
  );
}
