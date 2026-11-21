import { useEffect, useState } from 'react';
import { bridge, type HudState } from '../game/store';
import {
  CULTIVATION_METHODS, ELEMENT_COLOR, ELEMENT_LABEL,
  itemById, itemStatsLabel, SLOT_LABEL, SHOP_IDS, type EquipSlot,
} from '../game/data';

type Panel = 'map' | 'quests' | 'tech' | 'bag' | 'char';
const QUEST_GROUPS = ['Thiên Đạo', 'Kỳ Ngộ', 'Tông Môn', 'Thám Hiểm'];
const SLOTS: EquipSlot[] = ['weapon', 'armor', 'boots', 'accessory'];

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
  const [panel, setPanel] = useState<Panel | null>(null);
  useEffect(() => bridge.onHud(setS), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      const map: Record<string, Panel> = { m: 'map', j: 'quests', k: 'tech', b: 'bag', i: 'char' };
      const p = map[k];
      if (p) setPanel((cur) => (cur === p ? null : p));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!s) return <div className="hud-loading">Đang tải thế giới...</div>;

  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  return (
    <>
      {/* Panel trái: nhân vật + tu luyện */}
      <div className="hud-panel hud-left">
        <div className="realm-title">⚔️ {s.realmLabel}</div>
        <div className="char-sub">{s.charName} · {s.rootLabel} · {s.schoolLabel}</div>
        <div className="loc-line">📍 {s.locationName}</div>
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
      </div>

      {/* Panel phải: yêu thú mục tiêu + trạng thái bí cảnh */}
      <div className="hud-panel hud-right">
        <div className="beast-title">🐺 {s.beast.name}</div>
        <Bar value={s.beast.hp} max={s.beast.maxHp} color="linear-gradient(90deg,#fb923c,#ea580c)" label="HP quái" />
        <div className="hint">
          {s.beast.anyAlive
            ? 'Mục tiêu gần nhất. Quái tinh anh ⭐ cho phần thưởng gấp đôi và hay rơi trang bị.'
            : 'Tất cả yêu thú đã bị hạ! Chúng sẽ hồi sinh sau vài giây (trong bí cảnh thì không).'}
        </div>
        {s.autoMode && <div className="auto-phase">🤖 Tự động: {s.autoPhase}</div>}
        {s.dungeon && (
          <div className="dungeon-status">
            {s.dungeon.kind === 'A'
              ? <>🕳️ Sào Huyệt — {s.dungeon.phase === 'complete' ? 'ĐÃ VƯỢT QUA 🎉' : `Đợt ${s.dungeon.wave}/3`}</>
              : <>🏛️ Động Phủ — {s.dungeon.phase === 'complete' ? 'ĐÃ THÁM HIỂM XONG 🎉' : `Gian ${s.dungeon.room}/3`}</>}
            {s.dungeon.bossShield && (
              <div className="boss-shield-hint">
                🛡️ Boss đang dựng khiên (còn {s.dungeon.bossShield.hits} lớp)! Chỉ đòn hệ <b>{s.dungeon.bossShield.counterLabel}</b> (hệ khắc Thổ) mới phá được khiên.
              </div>
            )}
            <button className="btn ghost exit-btn" onClick={() => { bridge.send('exitDungeon'); setPanel(null); }}>🚪 Rời bí cảnh</button>
          </div>
        )}
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

      {/* ===== Panel Bản đồ (M) ===== */}
      {panel === 'map' && (
        <div className="overlay-panel">
          <div className="overlay-head"><span>🗺️ Bản đồ & Bí cảnh</span><button className="btn ghost small" onClick={() => setPanel(null)}>✕ Đóng (M)</button></div>
          {s.locations.map((l) => (
            <div key={l.id} className={l.current ? 'loc-card current' : 'loc-card'}>
              <div className="loc-card-main">
                <div className="loc-name">{l.icon} {l.name} {l.current && <span className="badge-here">Đang ở đây</span>}</div>
                <div className="loc-desc">{l.desc}</div>
                <div className="loc-aura">{l.auraLabel}</div>
              </div>
              {l.kind === 'map' ? (
                <button className="btn" disabled={!l.unlocked || l.current} onClick={() => { bridge.send(`travel:${l.id}`); setPanel(null); }}>
                  {l.unlocked ? 'Du hành' : `🔒 ${l.unlockLabel}`}
                </button>
              ) : (
                <button className="btn" disabled={!l.unlocked || l.current} onClick={() => { bridge.send(`enterDungeon:${l.kind === 'dungeonA' ? 'A' : 'B'}`); setPanel(null); }}>
                  {l.unlocked ? 'Vào bí cảnh' : `🔒 ${l.unlockLabel}`}
                </button>
              )}
            </div>
          ))}
          {s.dungeon && <button className="btn ghost exit-btn wide" onClick={() => { bridge.send('exitDungeon'); setPanel(null); }}>🚪 Rời bí cảnh hiện tại</button>}
          <div className="hint">Mở khóa: Linh Khê Cốc + Sào Huyệt ở Luyện Khí · Hắc Phong Lâm + Cổ Tu Động Phủ ở Trúc Cơ. Chết trong bí cảnh = bị đẩy ra ngoài với 30% HP, không mất gì thêm.</div>
        </div>
      )}

      {/* ===== Panel Nhiệm vụ (J) ===== */}
      {panel === 'quests' && (
        <div className="overlay-panel">
          <div className="overlay-head"><span>📜 Nhiệm vụ</span><button className="btn ghost small" onClick={() => setPanel(null)}>✕ Đóng (J)</button></div>
          {QUEST_GROUPS.map((g) => {
            const list = s.quests.filter((q) => q.group === g && q.state !== 'hidden');
            if (!list.length) return null;
            return (
              <div key={g} className="quest-group">
                <div className="quest-group-title">{g}</div>
                {list.map((q) => (
                  <div key={q.id} className={q.state === 'done' ? 'quest-card done' : 'quest-card'}>
                    <div className="quest-main">
                      <div className="quest-name">{q.name} {q.repeatable && <span className="badge-repeat">Lặp lại</span>} {q.state === 'done' && '✅'}</div>
                      <div className="quest-desc">{q.desc}</div>
                      {q.kind === 'counter' && q.state !== 'done' && (
                        <div className="quest-progress">Tiến độ: <b>{q.progress}/{q.target}</b> · Thưởng: {q.rewardsText}</div>
                      )}
                      {q.kind === 'counter' && q.state === 'done' && <div className="quest-progress">Thưởng: {q.rewardsText}</div>}
                    </div>
                    {q.kind === 'counter' && q.state === 'ready' && (
                      <button className="btn claim" onClick={() => bridge.send(`claimQuest:${q.id}`)}>Nhận thưởng</button>
                    )}
                    {q.kind === 'choice' && q.state === 'ready' && q.choices && q.choiceRewardsText && (
                      <div className="quest-choices">
                        <button className="btn" onClick={() => bridge.send(`questChoice:${q.id}:0`)}>{q.choices[0]}<span className="choice-reward">{q.choiceRewardsText[0]}</span></button>
                        <button className="btn" onClick={() => bridge.send(`questChoice:${q.id}:1`)}>{q.choices[1]}<span className="choice-reward">{q.choiceRewardsText[1]}</span></button>
                      </div>
                    )}
                    {q.kind === 'choice' && q.state === 'active' && <div className="quest-progress">Chưa xuất hiện — hãy tiếp tục hành trình.</div>}
                  </div>
                ))}
              </div>
            );
          })}
          <div className="quest-group">
            <div className="quest-group-title">📜 Thiên Đạo Ký Lục</div>
            {s.chronicle.length === 0
              ? <div className="hint">Chưa có ghi chép nào. Những cột mốc lớn trên đạo lộ sẽ được ghi lại tại đây.</div>
              : s.chronicle.map((line, i) => <div key={i} className="chronicle-line">{line}</div>)}
          </div>
        </div>
      )}

      {/* ===== Panel Công pháp (K) ===== */}
      {panel === 'tech' && (
        <div className="overlay-panel">
          <div className="overlay-head"><span>📖 Công pháp (đang kích hoạt {s.techniques.filter((t) => t.active).length}/2)</span><button className="btn ghost small" onClick={() => setPanel(null)}>✕ Đóng (K)</button></div>
          <div className="hint">Học bằng Ngộ Tính (bạn có ✨ {s.ngoTinh}). Chỉ công pháp đang KÍCH HOẠT mới có hiệu lực, tối đa 2 cuốn.</div>
          {s.techniques.map((t) => (
            <div key={t.id} className={t.active ? 'tech-card active' : 'tech-card'}>
              <div className="tech-main">
                <div className="tech-name"><span className="el-dot" style={{ background: ELEMENT_COLOR[t.element] }} /> {t.name} <span className="tech-school">· {t.schoolLabel} · hệ {ELEMENT_LABEL[t.element]}</span></div>
                <div className="quest-desc">{t.desc}</div>
                <div className="tech-effects">⚡ {t.effectsLabel}</div>
              </div>
              {!t.learned && (
                <button className="btn" disabled={!t.realmOk || s.ngoTinh < t.cost} onClick={() => bridge.send(`learnTech:${t.id}`)}>
                  {t.realmOk ? `Học · ✨${t.cost}` : `🔒 ${t.unlockLabel}`}
                </button>
              )}
              {t.learned && (
                <button className={t.active ? 'btn active' : 'btn'} onClick={() => bridge.send(`toggleTech:${t.id}`)}>
                  {t.active ? 'Đang kích hoạt ✓' : 'Kích hoạt'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ===== Panel Túi đồ (B) ===== */}
      {panel === 'bag' && (
        <div className="overlay-panel">
          <div className="overlay-head"><span>🎒 Túi đồ · 💰 {s.linhThach} Linh Thạch</span><button className="btn ghost small" onClick={() => setPanel(null)}>✕ Đóng (B)</button></div>
          <div className="quest-group-title">Đang trang bị</div>
          <div className="equip-row">
            {SLOTS.map((slot) => {
              const id = s.equipped[slot];
              const it = id ? itemById(id) : undefined;
              return (
                <div key={slot} className="equip-slot">
                  <div className="equip-slot-label">{SLOT_LABEL[slot]}</div>
                  <div className="equip-slot-name">{it ? `${it.name} (${it.tier})` : '— trống —'}</div>
                  {it && <div className="equip-slot-stats">{itemStatsLabel(it)}</div>}
                  {it && <button className="btn ghost small" onClick={() => bridge.send(`unequip:${slot}`)}>Tháo</button>}
                </div>
              );
            })}
          </div>
          <div className="quest-group-title">Trong túi ({s.invCount} vật phẩm)</div>
          {s.inventory.length === 0 && <div className="hint">Túi trống. Đánh quái (12% rơi, tinh anh 40%), vượt bí cảnh và làm nhiệm vụ để kiếm trang bị/đan dược — hoặc mua ở shop bên dưới.</div>}
          {s.inventory.map((e) => {
            const it = itemById(e.id);
            if (!it) return null;
            return (
              <div key={e.id} className="item-card">
                <div className="tech-main">
                  <div className="tech-name">{it.name} {it.tier && <span className="tier-badge">{it.tier}</span>} <span className="item-qty">×{e.qty}</span></div>
                  <div className="quest-desc">{itemStatsLabel(it)} — {it.desc}</div>
                </div>
                {it.kind === 'equip'
                  ? <button className="btn" onClick={() => bridge.send(`equip:${e.id}`)}>Trang bị</button>
                  : <button className="btn" onClick={() => bridge.send(`useItem:${e.id}`)}>Dùng</button>}
                <button className="btn ghost" onClick={() => bridge.send(`sellItem:${e.id}`)}>Bán +{it.sellPrice}💰</button>
              </div>
            );
          })}
          <div className="quest-group-title">🛒 Shop (Linh Thạch)</div>
          {SHOP_IDS.map((id) => itemById(id)).filter(Boolean).map((it) => (
            <div key={it!.id} className="item-card">
              <div className="tech-main">
                <div className="tech-name">{it!.name} {it!.tier && <span className="tier-badge">{it!.tier}</span>}</div>
                <div className="quest-desc">{itemStatsLabel(it!)} — {it!.desc}</div>
              </div>
              <button className="btn" disabled={s.linhThach < (it!.price ?? 0)} onClick={() => bridge.send(`buyItem:${it!.id}`)}>Mua · {it!.price}💰</button>
            </div>
          ))}
        </div>
      )}

      {/* ===== Panel Nhân vật (I) ===== */}
      {panel === 'char' && (
        <div className="overlay-panel narrow">
          <div className="overlay-head"><span>👤 {s.charName}</span><button className="btn ghost small" onClick={() => setPanel(null)}>✕ Đóng (I)</button></div>
          <div className="char-line"><span>Linh căn</span><b>{s.rootLabel}</b></div>
          <div className="char-line"><span>Trường phái</span><b>{s.schoolLabel}</b></div>
          <div className="char-line"><span>Cảnh giới</span><b>{s.realmLabel}</b></div>
          <div className="char-line"><span>📍 Đang ở</span><b>{s.locationName}</b></div>
          <div className="char-line"><span>⚔️ Công</span><b>{s.statAtk}</b></div>
          <div className="char-line"><span>🛡️ Thủ</span><b>{s.statDef}</b></div>
          <div className="char-line"><span>💨 Tốc độ</span><b>{s.statSpeed}</b></div>
          <div className="char-line"><span>🎯 Bạo kích</span><b>{s.statCrit}% (×1.5)</b></div>
          <div className="hint">Công/Thủ gồm: nền cảnh giới × hệ số Căn Cơ (0.7 + 0.3×CănCơ/100) × hệ số trường phái + trang bị. Sát thương còn nhân thêm hiệu ứng công pháp đang kích hoạt.</div>
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
          <button className={panel === 'map' ? 'btn active' : 'btn'} onClick={() => toggle('map')}>🗺️ Bản đồ (M)</button>
          <button className={panel === 'quests' ? 'btn active' : 'btn'} onClick={() => toggle('quests')}>
            📜 Nhiệm vụ (J){s.questReady > 0 && <span className="btn-badge">{s.questReady}</span>}
          </button>
          <button className={panel === 'tech' ? 'btn active' : 'btn'} onClick={() => toggle('tech')}>📖 Công pháp (K)</button>
          <button className={panel === 'bag' ? 'btn active' : 'btn'} onClick={() => toggle('bag')}>
            🎒 Túi đồ (B){s.invCount > 0 && <span className="btn-badge">{s.invCount}</span>}
          </button>
          <button className={panel === 'char' ? 'btn active' : 'btn'} onClick={() => toggle('char')}>👤 Nhân vật (I)</button>
          <button className="btn ghost" onClick={() => setShowHelp(!showHelp)}>❓ Hướng dẫn</button>
          <button className="btn ghost danger" onClick={() => { if (confirm('Chơi lại từ đầu? Tiến trình và nhân vật đã lưu sẽ bị xóa.')) { bridge.send('resetSave'); bridge.notifyReset(); } }}>↺ Chơi lại</button>
        </div>
        {showHelp && (
          <div className="help-box">
            <b>Điều khiển:</b> W A S D — di chuyển • Kéo chuột — xoay camera, lăn chuột — zoom • Space — né •
            Click chuột — đánh thường • <b>Q / E / R / F</b> — kỹ năng theo trường phái • C — thiền • Tab — tự động săn quái •
            <b>M</b> — bản đồ/bí cảnh • <b>J</b> — nhiệm vụ • <b>K</b> — công pháp • <b>B</b> — túi đồ • <b>I</b> — nhân vật<br />
            <b>Ngũ hành tương khắc:</b> Kim khắc Mộc khắc Thổ khắc Thủy khắc Hỏa khắc Kim (±20% sát thương). Kỹ năng cùng hệ với linh căn được +15%.
          </div>
        )}
      </div>
    </>
  );
}
