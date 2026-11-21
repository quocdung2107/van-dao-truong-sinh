import { useEffect, useState } from 'react';
import { bridge, type HudState } from '../game/store';
import { CULTIVATION_METHODS, ELEMENT_COLOR, ELEMENT_LABEL } from '../game/data';

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
  const [showHelp, setShowHelp] = useState(false);
  const [showChar, setShowChar] = useState(false);
  useEffect(() => bridge.onHud(setS), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key.toLowerCase() === 'i') setShowChar((v) => !v); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!s) return <div className="hud-loading">Đang tải Thanh Vân Sơn...</div>;

  return (
    <>
      {/* Panel trái: nhân vật + tu luyện */}
      <div className="hud-panel hud-left">
        <div className="realm-title">⚔️ {s.realmLabel}</div>
        <div className="char-sub">{s.charName} · {s.rootLabel} · {s.schoolLabel}</div>
        <Bar value={s.tuVi} max={s.tuViNeed} color="linear-gradient(90deg,#2dd4bf,#0ea5e9)" label="Tu Vi" />
        <Bar value={s.hp} max={s.maxHp} color="linear-gradient(90deg,#f87171,#dc2626)" label="HP" />
        <Bar value={s.mp} max={s.maxMp} color="linear-gradient(90deg,#60a5fa,#2563eb)" label="Linh Lực" />
        {s.shield > 0 && <div className="shield-line">🛡️ Khiên: <b>{s.shield}</b> sát thương</div>}
        <div className="stat-row">
          <span>🪨 Căn Cơ: <b>{s.canCo}</b></span>
          <span>✨ Ngộ Tính: <b>{s.ngoTinh}</b></span>
          <span>💰 Linh Thạch: <b>{s.linhThach}</b></span>
          <span>🐺 Hạ: <b>{s.kills}</b></span>
        </div>

        <div className="method-label">Phương pháp tu luyện (khi thiền):</div>
        <div className="method-row">
          {CULTIVATION_METHODS.map((m) => (
            <button
              key={m.id}
              className={s.methodId === m.id ? 'method-btn active' : 'method-btn'}
              title={m.desc}
              onClick={() => bridge.send(`method:${m.id}`)}
            >
              {m.icon} {m.name}
            </button>
          ))}
        </div>

        <button
          className="btn-breakthrough"
          disabled={!s.canBreakthrough}
          onClick={() => bridge.send('breakthrough')}
          title={s.canBreakthrough ? `Tỉ lệ thành công ${s.breakthroughChance.toFixed(0)}%` : 'Cần Tu Vi đầy và Căn Cơ đủ'}
        >
          🌩️ ĐỘT PHÁ {s.canBreakthrough ? `(${s.breakthroughChance.toFixed(0)}%${s.isRealmUpNext ? ' + Thiên Kiếp!' : ''})` : ''}
        </button>
        {!s.canBreakthrough && <div className="hint">Đột phá cần: Tu Vi đầy + Căn Cơ ≥ 50 (65 khi lên cảnh giới mới — sẽ phải vượt Thiên Kiếp 3 đợt sét).</div>}
        <button className="btn ghost char-btn" onClick={() => setShowChar(!showChar)}>👤 Nhân vật (I)</button>

        {showChar && (
          <div className="char-panel">
            <div className="char-panel-title">👤 {s.charName}</div>
            <div className="char-line"><span>Linh căn</span><b>{s.rootLabel}</b></div>
            <div className="char-line"><span>Trường phái</span><b>{s.schoolLabel}</b></div>
            <div className="char-line"><span>Cảnh giới</span><b>{s.realmLabel}</b></div>
            <div className="char-line"><span>⚔️ Công</span><b>{s.statAtk}</b></div>
            <div className="char-line"><span>🛡️ Thủ</span><b>{s.statDef}</b></div>
            <div className="char-line"><span>💨 Tốc độ</span><b>{s.statSpeed}</b></div>
            <div className="char-line"><span>🎯 Bạo kích</span><b>{s.statCrit}% (×1.5)</b></div>
            <div className="hint">Công/Thủ đã gồm hệ số Căn Cơ (0.7 + 0.3×CănCơ/100) và hệ số trường phái.</div>
          </div>
        )}
      </div>

      {/* Panel phải: yêu thú mục tiêu */}
      <div className="hud-panel hud-right">
        <div className="beast-title">🐺 {s.beast.name}</div>
        <Bar value={s.beast.hp} max={s.beast.maxHp} color="linear-gradient(90deg,#fb923c,#ea580c)" label="HP quái" />
        <div className="hint">
          {s.beast.anyAlive
            ? 'Mục tiêu gần nhất. Quái tinh anh ⭐ cho phần thưởng gấp đôi — cẩn thận, chúng mạnh hơn nhiều.'
            : 'Tất cả yêu thú đã bị hạ! Chúng sẽ hồi sinh sau vài giây.'}
        </div>
        {s.autoMode && <div className="auto-phase">🤖 Tự động: {s.autoPhase}</div>}
      </div>

      {/* Thiên kiếp */}
      {s.tribActive && (
        <div className="trib-banner">🌩️ THIÊN KIẾP — đợt {s.tribWave}/{s.tribWaves} · NÉ CÁC VÒNG ĐỎ! 🌩️</div>
      )}

      {/* Sự kiện tu luyện */}
      {s.pendingEvent && (
        <div className="event-card">
          <div className="event-title">{s.pendingEvent.title} <span className="event-timer">({s.pendingEvent.expiresIn}s)</span></div>
          <div className="event-desc">{s.pendingEvent.desc}</div>
          <div className="event-choices">
            <button className="btn" onClick={() => bridge.send('eventChoice:0')}>{s.pendingEvent.choices[0]}</button>
            <button className="btn" onClick={() => bridge.send('eventChoice:1')}>{s.pendingEvent.choices[1]}</button>
          </div>
        </div>
      )}

      {/* Thanh dưới: thông báo + kỹ năng + nút */}
      <div className="hud-bottom">
        <div className="msg-box">{s.message}</div>
        <div className="skill-bar">
          {s.skills.map((sk) => {
            const cdPct = sk.cdTotal > 0 ? Math.min(100, (sk.cdLeft / sk.cdTotal) * 100) : 0;
            return (
              <button
                key={sk.key}
                className={sk.ready ? 'skill-slot ready' : 'skill-slot'}
                disabled={!sk.ready}
                title={`${sk.name} — hệ ${ELEMENT_LABEL[sk.element]} · ${sk.mpCost} Linh Lực`}
                onClick={() => bridge.send(`skill:${sk.key}`)}
              >
                <span className="skill-key" style={{ background: ELEMENT_COLOR[sk.element] }}>{sk.key}</span>
                <span className="skill-name">{sk.name}</span>
                <span className="skill-cost">{sk.mpCost} MP</span>
                {sk.cdLeft > 0 && <span className="skill-cd" style={{ height: `${cdPct}%` }} />}
                {sk.cdLeft > 0 && <span className="skill-cd-text">{sk.cdLeft.toFixed(1)}</span>}
              </button>
            );
          })}
        </div>
        <div className="btn-row">
          <button className={s.meditating ? 'btn active' : 'btn'} onClick={() => bridge.send('toggleMeditate')}>🧘 Thiền (C)</button>
          <button className={s.swordDrawn ? 'btn active' : 'btn'} onClick={() => bridge.send('toggleSword')}>🗡️ Rút Kiếm</button>
          <button className="btn" onClick={() => bridge.send('attack')}>⚔️ Đánh Thường (Click)</button>
          <button className={s.autoMode ? 'btn active auto' : 'btn'} onClick={() => bridge.send('toggleAuto')}>🤖 Tự Động (Tab)</button>
          <button className="btn ghost" onClick={() => setShowHelp(!showHelp)}>❓ Hướng dẫn</button>
          <button className="btn ghost danger" onClick={() => { if (confirm('Chơi lại từ đầu? Tiến trình và nhân vật đã lưu sẽ bị xóa.')) { bridge.send('resetSave'); bridge.notifyReset(); } }}>↺ Chơi lại</button>
        </div>
        {showHelp && (
          <div className="help-box">
            <b>Điều khiển:</b> W A S D — di chuyển • Kéo chuột — xoay camera, lăn chuột — zoom • Space — né •
            Click chuột — đánh thường • <b>Q / E / R / F</b> — kỹ năng theo trường phái • C — thiền • Tab — tự động săn quái • I — bảng nhân vật<br />
            <b>Ngũ hành tương khắc:</b> Kim khắc Mộc khắc Thổ khắc Thủy khắc Hỏa khắc Kim (±20% sát thương). Kỹ năng cùng hệ với linh căn được +15%.
          </div>
        )}
      </div>
    </>
  );
}
