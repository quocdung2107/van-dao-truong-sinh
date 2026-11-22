import { useEffect, useState } from 'react';
import { bridge, type HudState } from '../game/store';
import {
  CULTIVATION_METHODS, ELEMENT_COLOR, ELEMENT_LABEL,
  itemById, itemStatsLabel, SLOT_LABEL, SHOP_IDS, type EquipSlot,
  RECIPES, FORGE, enhanceCost,
} from '../game/data';

type Panel = 'map' | 'quests' | 'tech' | 'bag' | 'char' | 'mansion';

function fmtDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h} giờ ${m} phút`;
  if (m > 0) return `${m} phút`;
  return `${Math.max(1, Math.round(totalSeconds))} giây`;
}
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
  const [offlineClosed, setOfflineClosed] = useState(false);
  useEffect(() => bridge.onHud(setS), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      const map: Record<string, Panel> = { m: 'map', j: 'quests', k: 'tech', b: 'bag', i: 'char', h: 'mansion' };
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
        <div className="stat-row">
          <span>🌿 Linh Thảo: <b>{s.linhThao}</b></span>
          <span>✨ Tinh Hoa: <b>{s.tinhHoa}</b></span>
          <span>⏳ Trần offline: <b>{s.mansion.offlineCapHours}h</b></span>
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
          className={s.seclusion ? 'btn active wide-btn' : 'btn wide-btn'}
          onClick={() => bridge.send('toggleSeclusion')}
          title="Bế quan: khóa nhân vật, Tu Vi theo Tĩnh Tọa ×2.5, Căn Cơ +0.2/s. Thoát game khi đang bế quan -> offline tính theo bế quan."
        >
          {s.seclusion ? '🏯 Đang BẾ QUAN — bấm để Xuất quan' : '🏯 Bế quan (Tu Vi ×2.5)'}
        </button>
        <button
          className="btn-breakthrough"
          disabled={!s.canBreakthrough}
          onClick={() => bridge.send('breakthrough')}
          title={s.canBreakthrough ? `Tỉ lệ thành công ${s.breakthroughChance.toFixed(0)}%${s.doKiepBonus ? ' + 15% Độ Kiếp Đan' : ''}` : 'Cần Tu Vi đầy và Căn Cơ đủ'}
        >
          🌩️ ĐỘT PHÁ {s.canBreakthrough ? `(${s.breakthroughChance.toFixed(0)}%${s.doKiepBonus ? ' +15%💊' : ''}${s.isRealmUpNext ? ' + Thiên Kiếp!' : ''})` : ''}
        </button>
        {s.doKiepBonus && <div className="hint">💊 Độ Kiếp Đan đang có hiệu lực: lần đột phá tới +15% tỉ lệ (mất khi đã tung tỉ lệ).</div>}
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

      {/* Bế quan: viền tối + nhãn */}
      {s.seclusion && <div className="seclusion-vignette" />}
      {s.seclusion && (
        <div className="seclusion-banner">🏯 ĐANG BẾ QUAN — Tu Vi ×2.5 · Căn Cơ +0.2/s · <button className="btn small" onClick={() => bridge.send('toggleSeclusion')}>Xuất quan</button></div>
      )}

      {/* Báo cáo offline (Giai đoạn 3) */}
      {s.offlineReport && !offlineClosed && (
        <div className="offline-overlay">
          <div className="offline-box">
            <div className="offline-head">
              <span>📜 Báo cáo offline</span>
              <button className="btn ghost small" title="Đóng — thành quả vẫn chờ, mở lại bằng nút 📜 ở thanh dưới" onClick={() => setOfflineClosed(true)}>✕</button>
            </div>
            <div className="offline-sub">
              Vắng mặt {fmtDuration(s.offlineReport.elapsedSeconds)} · tính thành quả {fmtDuration(s.offlineReport.countedSeconds)}
              {s.offlineReport.countedSeconds < s.offlineReport.elapsedSeconds && <> (trần tối đa {fmtDuration(s.offlineReport.capSeconds)} — nâng Tụ Linh Trận ở Động Phủ để tăng trần)</>}
            </div>
            <div className="offline-sub">Hoạt động lúc rời game: <b>{s.offlineReport.activityLabel}</b></div>
            <div className="offline-gains">
              {s.offlineReport.tuVi > 0 && <div className="offline-line"><span>Tu Vi</span><b>+{s.offlineReport.tuVi}</b></div>}
              {s.offlineReport.canCo > 0 && <div className="offline-line"><span>Căn Cơ</span><b>+{s.offlineReport.canCo}</b></div>}
              {s.offlineReport.ngoTinh > 0 && <div className="offline-line"><span>Ngộ Tính</span><b>+{s.offlineReport.ngoTinh}</b></div>}
              {s.offlineReport.linhThach > 0 && <div className="offline-line"><span>💰 Linh Thạch</span><b>+{s.offlineReport.linhThach}</b></div>}
              {s.offlineReport.linhThao > 0 && <div className="offline-line"><span>🌿 Linh Thảo</span><b>+{s.offlineReport.linhThao}</b></div>}
              {s.offlineReport.kills > 0 && <div className="offline-line"><span>🐺 Yêu thú đã hạ (ước tính)</span><b>{s.offlineReport.kills}</b></div>}
              {s.offlineReport.fieldGained > 0 && <div className="offline-line"><span>🌱 Linh Điền tích lũy (vào kho chờ thu hoạch)</span><b>+{s.offlineReport.fieldGained}</b></div>}
              {s.offlineReport.items.map((it, i) => (
                <div key={i} className="offline-line"><span>🎁 {it.name}</span><b>×{it.qty}</b></div>
              ))}
              {s.offlineReport.tuVi === 0 && s.offlineReport.linhThach === 0 && s.offlineReport.items.length === 0 && (
                <div className="offline-line"><span>Chưa có thành quả đáng kể kỳ này.</span><b></b></div>
              )}
            </div>
            <button className="btn-create" onClick={() => { bridge.send('claimOffline'); setOfflineClosed(false); }}>Nhận thành quả</button>
            <div className="hint center">Nhận 1 lần duy nhất — đóng hộp thoại này không làm mất thành quả.</div>
          </div>
        </div>
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
              const det = s.equippedDetail[slot];
              const it = det ? itemById(det.itemId) : undefined;
              const cost = det && det.enhance < FORGE.maxEnhance ? enhanceCost(det.enhance) : null;
              return (
                <div key={slot} className="equip-slot">
                  <div className="equip-slot-label">{SLOT_LABEL[slot]}</div>
                  <div className="equip-slot-name">{it ? `${it.name} (${it.tier})${det && det.enhance > 0 ? ` +${det.enhance}` : ''}` : '— trống —'}</div>
                  {it && det && <div className="equip-slot-stats">{itemStatsLabel(it, det.enhance)}</div>}
                  {it && det && (
                    <div className="slot-btns">
                      <button className="btn ghost small" onClick={() => bridge.send(`unequip:${slot}`)}>Tháo</button>
                      {cost && (
                        <button className="btn ghost small" disabled={s.tinhHoa < cost.tinhHoa || s.linhThach < cost.linhThach}
                          title={`Cường hóa +${det.enhance + 1}: chỉ số +10%`}
                          onClick={() => bridge.send(`enhance:${det.uid}`)}>
                          ✨ Cường hóa · {cost.tinhHoa}TH + {cost.linhThach}💰
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="quest-group-title">Trang bị trong túi ({s.equipBag.length} món — mỗi món riêng lẻ, có cấp cường hóa)</div>
          {s.equipBag.length === 0 && <div className="hint">Chưa có trang bị nào trong túi. Đánh quái (12% rơi, tinh anh 40%), vượt bí cảnh, làm nhiệm vụ — hoặc chế tạo ở Động Phủ (phím H).</div>}
          {s.equipBag.map((inst) => {
            const it = itemById(inst.itemId);
            if (!it) return null;
            const cost = inst.enhance < FORGE.maxEnhance ? enhanceCost(inst.enhance) : null;
            return (
              <div key={inst.uid} className="item-card">
                <div className="tech-main">
                  <div className="tech-name">{it.name} {it.tier && <span className="tier-badge">{it.tier}</span>} {inst.enhance > 0 && <span className="enh-badge">+{inst.enhance}</span>}</div>
                  <div className="quest-desc">{itemStatsLabel(it, inst.enhance)} — {it.desc}</div>
                </div>
                <button className="btn" onClick={() => bridge.send(`equip:${inst.uid}`)}>Trang bị</button>
                {cost && (
                  <button className="btn ghost" disabled={s.tinhHoa < cost.tinhHoa || s.linhThach < cost.linhThach}
                    title={`Cường hóa lên +${inst.enhance + 1}: chỉ số +10% so với gốc`}
                    onClick={() => bridge.send(`enhance:${inst.uid}`)}>
                    ✨ +{inst.enhance + 1} · {cost.tinhHoa}TH+{cost.linhThach}💰
                  </button>
                )}
                <button className="btn ghost" onClick={() => bridge.send(`sellEquip:${inst.uid}`)}>Bán +{it.sellPrice}💰</button>
              </div>
            );
          })}
          <div className="quest-group-title">Đan dược & vật phẩm tiêu hao</div>
          {s.inventory.length === 0 && <div className="hint">Chưa có đan dược. Mua ở shop bên dưới hoặc luyện tại Động Phủ (phím H).</div>}
          {s.inventory.map((e) => {
            const it = itemById(e.id);
            if (!it) return null;
            return (
              <div key={e.id} className="item-card">
                <div className="tech-main">
                  <div className="tech-name">{it.name} {it.tier && <span className="tier-badge">{it.tier}</span>} <span className="item-qty">×{e.qty}</span></div>
                  <div className="quest-desc">{itemStatsLabel(it)} — {it.desc}</div>
                </div>
                <button className="btn" onClick={() => bridge.send(`useItem:${e.id}`)}>Dùng</button>
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

      {/* ===== Panel Động Phủ (H) — Giai đoạn 3 ===== */}
      {panel === 'mansion' && (
        <div className="overlay-panel">
          <div className="overlay-head"><span>🏯 Động Phủ</span><button className="btn ghost small" onClick={() => setPanel(null)}>✕ Đóng (H)</button></div>
          <div className="stat-row">
            <span>💰 Linh Thạch: <b>{s.linhThach}</b></span>
            <span>🌿 Linh Thảo: <b>{s.linhThao}</b></span>
            <span>✨ Tinh Hoa: <b>{s.tinhHoa}</b></span>
          </div>

          <div className="quest-group-title">🔮 Tụ Linh Trận — cấp {s.mansion.spiritLevel}/5</div>
          <div className="loc-card">
            <div className="loc-card-main">
              <div className="loc-desc">
                Trần offline hiện tại: <b>{s.mansion.offlineCapHours} giờ</b> · Tu Vi thiền ×{s.mansion.spiritTuViMul.toFixed(2)}.
                Cấp 1–4: mỗi cấp +1 giờ trần offline và +4% Tu Vi thiền. Cấp 5: +10% Tu Vi thiền.
              </div>
            </div>
            {s.mansion.spiritNextCost !== null
              ? <button className="btn" disabled={s.linhThach < s.mansion.spiritNextCost} onClick={() => bridge.send('upgradeArray')}>Nâng cấp · {s.mansion.spiritNextCost}💰</button>
              : <span className="badge-here">TỐI ĐA</span>}
          </div>

          <div className="quest-group-title">🌱 Linh Điền — {s.mansion.fieldLevel === 0 ? 'chưa xây' : `cấp ${s.mansion.fieldLevel}/3`}</div>
          <div className="loc-card">
            <div className="loc-card-main">
              <div className="loc-desc">
                {s.mansion.fieldLevel === 0
                  ? 'Xây Linh Điền để tự trồng Linh Thảo theo thời gian (kể cả khi offline).'
                  : <>Sản lượng <b>{s.mansion.fieldRatePerHour} Linh Thảo/giờ</b> · Đang chờ thu hoạch: <b>{s.mansion.fieldStored}</b> / tối đa {s.mansion.fieldCap} (48 giờ sản lượng).</>}
              </div>
            </div>
            {s.mansion.fieldLevel > 0 && (
              <button className="btn claim" disabled={s.mansion.fieldStored <= 0} onClick={() => bridge.send('harvestField')}>🌿 Thu hoạch ({s.mansion.fieldStored})</button>
            )}
            {s.mansion.fieldNextCost && (
              <button className="btn" disabled={s.linhThach < s.mansion.fieldNextCost.linhThach || s.linhThao < s.mansion.fieldNextCost.linhThao}
                onClick={() => bridge.send('upgradeField')}>
                {s.mansion.fieldLevel === 0 ? 'Xây dựng' : 'Nâng cấp'} · {s.mansion.fieldNextCost.linhThach}💰{s.mansion.fieldNextCost.linhThao > 0 ? ` + ${s.mansion.fieldNextCost.linhThao}🌿` : ''}
              </button>
            )}
            {s.mansion.fieldNextCost === null && <span className="badge-here">TỐI ĐA</span>}
          </div>

          <div className="quest-group-title">⚗️ Luyện Đan (Linh Thạch luôn tốn · thất bại mất nửa Linh Thảo, không ra đan)</div>
          {RECIPES.map((r) => {
            const it = itemById(r.itemId);
            if (!it) return null;
            return (
              <div key={r.itemId} className="item-card">
                <div className="tech-main">
                  <div className="tech-name">{it.name}</div>
                  <div className="quest-desc">{itemStatsLabel(it)} · Tỉ lệ thành công {Math.round(r.successRate * 100)}%</div>
                </div>
                <button className="btn" disabled={s.linhThao < r.linhThao || s.linhThach < r.linhThach}
                  onClick={() => bridge.send(`craft:${r.itemId}`)}>
                  Luyện · {r.linhThao}🌿 + {r.linhThach}💰
                </button>
              </div>
            );
          })}

          <div className="quest-group-title">🔨 Luyện Khí — chế tạo trang bị ngẫu nhiên theo ô (phẩm theo cảnh giới, tối đa Địa)</div>
          <div className="loc-card">
            <div className="loc-card-main">
              <div className="loc-desc">Chi phí mỗi lần: <b>{FORGE.craftTinhHoa}✨ Tinh Hoa + {FORGE.craftLinhThach}💰</b>. Cường hóa trang bị (+1 = +10% chỉ số, tối đa +{FORGE.maxEnhance}) làm ngay trong Túi đồ (phím B): tốn {FORGE.enhanceTinhHoa}✨ + Linh Thạch tăng theo cấp.</div>
            </div>
          </div>
          <div className="btn-row left">
            {SLOTS.map((slot) => (
              <button key={slot} className="btn" disabled={s.tinhHoa < FORGE.craftTinhHoa || s.linhThach < FORGE.craftLinhThach}
                onClick={() => bridge.send(`forgeCraft:${slot}`)}>
                🔨 Chế {SLOT_LABEL[slot]}
              </button>
            ))}
          </div>

          <div className="quest-group-title">🧪 Kiểm thử</div>
          <div className="loc-card">
            <div className="loc-card-main">
              <div className="loc-desc">Giả lập bạn vừa rời game 2 giờ (theo hoạt động hiện tại: bế quan / tự động / thiền) rồi tải lại trang để xem Báo cáo offline.</div>
            </div>
            <button className="btn ghost" onClick={() => { if (confirm('Giả lập offline 2 giờ và tải lại trang? Tiến trình hiện tại đã được lưu tự động.')) bridge.send('debugOffline'); }}>🧪 Giả lập offline 2 giờ</button>
          </div>
          <div className="hint">Nguồn Tinh Hoa: hạ tinh anh +1 · dẹp Sào Huyệt +2 · diệt Thạch Tượng +5. Nguồn Linh Thảo: Linh Điền · quái rơi 30% (1–3) · săn offline.</div>
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
          <button className={panel === 'mansion' ? 'btn active' : 'btn'} onClick={() => toggle('mansion')}>🏯 Động phủ (H)</button>
          {s.offlineReport && offlineClosed && (
            <button className="btn claim" onClick={() => setOfflineClosed(false)}>📜 Có thành quả chưa nhận</button>
          )}
          <button className={panel === 'char' ? 'btn active' : 'btn'} onClick={() => toggle('char')}>👤 Nhân vật (I)</button>
          <button className="btn ghost" onClick={() => setShowHelp(!showHelp)}>❓ Hướng dẫn</button>
          <button className="btn ghost danger" onClick={() => { if (confirm('Chơi lại từ đầu? Tiến trình và nhân vật đã lưu sẽ bị xóa.')) { bridge.send('resetSave'); bridge.notifyReset(); } }}>↺ Chơi lại</button>
        </div>
        {showHelp && (
          <div className="help-box">
            <b>Điều khiển:</b> W A S D — di chuyển • Kéo chuột — xoay camera, lăn chuột — zoom • Space — né •
            Click chuột — đánh thường • <b>Q / E / R / F</b> — kỹ năng theo trường phái • C — thiền • Tab — tự động săn quái •
            <b>M</b> — bản đồ/bí cảnh • <b>J</b> — nhiệm vụ • <b>K</b> — công pháp • <b>B</b> — túi đồ • <b>H</b> — động phủ • <b>I</b> — nhân vật<br />
            <b>Offline:</b> đóng game rồi quay lại (≥5 phút) sẽ có Báo cáo thành quả theo việc bạn đang làm lúc rời game — đang Tự Động thì tính săn quái, đang Bế quan thì tính bế quan, còn lại tính thiền. Trần mặc định 8 giờ, nâng Tụ Linh Trận ở Động Phủ để tăng.<br />
            <b>Ngũ hành tương khắc:</b> Kim khắc Mộc khắc Thổ khắc Thủy khắc Hỏa khắc Kim (±20% sát thương). Kỹ năng cùng hệ với linh căn được +15%.
          </div>
        )}
      </div>
    </>
  );
}
