import { useState } from 'react';
import { SPIRIT_ROOTS, SCHOOLS, ELEMENT_COLOR, type Element, type SchoolId } from '../game/data';
import type { CharacterInfo } from '../game/cultivation';

export default function CreationScreen({ onCreate }: { onCreate: (c: CharacterInfo) => void }) {
  const [name, setName] = useState('');
  const [root, setRoot] = useState<Element | null>(null);
  const [school, setSchool] = useState<SchoolId | null>(null);
  const valid = name.trim().length > 0 && root !== null && school !== null;

  return (
    <div className="creation-overlay">
      <div className="creation-box">
        <h1 className="creation-title">🏔️ VẠN ĐẠO TRƯỜNG SINH</h1>
        <p className="creation-sub">Bước chân vào con đường tu tiên — hãy tạo nhân vật của bạn.</p>

        <label className="creation-label">Đạo hiệu (tên nhân vật)</label>
        <input
          className="creation-input"
          placeholder="Ví dụ: Lăng Vân, Tiểu Thạch..."
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="creation-label">Chọn Linh Căn (ngũ hành)</label>
        <div className="card-grid">
          {SPIRIT_ROOTS.map((r) => (
            <button
              key={r.element}
              className={root === r.element ? 'pick-card selected' : 'pick-card'}
              style={root === r.element ? { borderColor: ELEMENT_COLOR[r.element], boxShadow: `0 0 0 1px ${ELEMENT_COLOR[r.element]}` } : undefined}
              onClick={() => setRoot(r.element)}
            >
              <div className="pick-title"><span className="el-dot" style={{ background: ELEMENT_COLOR[r.element] }} />{r.name}</div>
              <div className="pick-pros">✅ {r.pros}</div>
              <div className="pick-cons">⚠️ {r.cons}</div>
            </button>
          ))}
        </div>

        <label className="creation-label">Chọn Trường Phái</label>
        <div className="card-grid">
          {SCHOOLS.map((sc) => (
            <button
              key={sc.id}
              className={school === sc.id ? 'pick-card selected' : 'pick-card'}
              onClick={() => setSchool(sc.id)}
            >
              <div className="pick-title">{sc.icon} {sc.name}</div>
              <div className="pick-pros">{sc.desc}</div>
              <div className="pick-cons">
                HP ×{sc.mult.hp} · Linh Lực ×{sc.mult.mp} · Công ×{sc.mult.atk} · Thủ ×{sc.mult.def} · Bạo {Math.round(sc.critChance * 100)}%
              </div>
            </button>
          ))}
        </div>

        <button
          className="btn-create"
          disabled={!valid}
          onClick={() => { if (root && school) onCreate({ name: name.trim(), root, school }); }}
        >
          ⚔️ BẮT ĐẦU TU TIÊN
        </button>
        {!valid && <div className="hint center">Hãy nhập tên, chọn 1 linh căn và 1 trường phái.</div>}
      </div>
    </div>
  );
}
