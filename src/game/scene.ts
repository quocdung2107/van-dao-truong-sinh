import {
  Scene, Vector3, Color3, Color4, HemisphericLight, DirectionalLight,
  MeshBuilder, StandardMaterial, ParticleSystem, Texture, DynamicTexture, TransformNode, Mesh,
} from '@babylonjs/core';
import type { LocationDef, GroundProfile } from './data';

function stdMat(scene: Scene, name: string, color: Color3, emissive?: Color3): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  if (emissive) m.emissiveColor = emissive;
  return m;
}

export function particleTexture(scene: Scene): Texture {
  const dt = new DynamicTexture('dotTex', { width: 64, height: 64 }, scene, false);
  const ctx = dt.getContext();
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(180,255,230,0.7)');
  g.addColorStop(1, 'rgba(180,255,230,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  dt.update();
  return dt;
}

// ---------- Chiều cao địa hình theo từng bản đồ (module state, Game set khi du hành) ----------
let currentProfile: GroundProfile = 'thanh-van';
export function setGroundProfile(p: GroundProfile) { currentProfile = p; }

export function groundHeight(x: number, z: number): number {
  const d = Math.sqrt(x * x + z * z);
  if (currentProfile === 'arena') return 0;
  if (currentProfile === 'linh-khe') {
    const t = Math.max(0, (d - 12) / 28);
    return t * t * (Math.sin(x * 0.18) * Math.cos(z * 0.16) * 1.3 + Math.sin(x * 0.06 + z * 0.09) * 0.9);
  }
  if (currentProfile === 'hac-phong') {
    const t = Math.max(0, (d - 10) / 24);
    return t * t * (Math.sin(x * 0.3) * Math.cos(z * 0.26) * 3.0 + Math.sin(x * 0.1 + z * 0.13) * 2.0);
  }
  // thanh-van (mặc định): phẳng ở trung tâm, nhấp nhô ở rìa
  const t = Math.max(0, (d - 14) / 26);
  return t * t * (Math.sin(x * 0.22) * Math.cos(z * 0.19) * 2.2 + Math.sin(x * 0.07 + z * 0.11) * 1.6);
}

export interface BuiltEnvironment {
  move: (dt: number) => void;
  /** Cổng chắn của bí cảnh Động Phủ (2 cổng) — Game dispose từng cổng khi mở phòng */
  gates: Mesh[];
  dispose: () => void;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Dựng môi trường cho 1 địa điểm vào cùng scene. Mọi mesh nằm dưới 1 root TransformNode,
 * dispose() dọn sạch mesh/material/texture/particle/light đã tạo.
 */
export function buildEnvironment(scene: Scene, loc: LocationDef): BuiltEnvironment {
  const root = new TransformNode(`env_${loc.id}`);
  const mats: StandardMaterial[] = [];
  const systems: ParticleSystem[] = [];
  const lights: (HemisphericLight | DirectionalLight)[] = [];
  const gates: Mesh[] = [];
  const movers: ((dt: number) => void)[] = [];

  const mat = (name: string, color: Color3, emissive?: Color3): StandardMaterial => {
    const m = stdMat(scene, `${loc.id}_${name}`, color, emissive);
    mats.push(m);
    return m;
  };
  const add = (mesh: Mesh): Mesh => { mesh.parent = root; return mesh; };
  const scatterPos = (minD: number, maxD: number) => {
    const a = Math.random() * Math.PI * 2, d = rand(minD, maxD);
    return { x: Math.cos(a) * d, z: Math.sin(a) * d };
  };

  // ----- Ánh sáng + sương mù theo địa điểm -----
  let hemi: HemisphericLight, sun: DirectionalLight;
  if (loc.id === 'linh-khe') {
    scene.clearColor = new Color4(0.55, 0.85, 0.7, 1);
    scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = 0.01; scene.fogColor = new Color3(0.65, 0.9, 0.75);
    hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene); hemi.intensity = 0.85; hemi.groundColor = new Color3(0.3, 0.5, 0.3);
    sun = new DirectionalLight('sun', new Vector3(-0.4, -1, -0.3), scene); sun.intensity = 1.1; sun.diffuse = new Color3(1, 0.98, 0.85);
  } else if (loc.id === 'hac-phong') {
    scene.clearColor = new Color4(0.16, 0.1, 0.24, 1);
    scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = 0.024; scene.fogColor = new Color3(0.14, 0.08, 0.2);
    hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene); hemi.intensity = 0.45; hemi.groundColor = new Color3(0.12, 0.08, 0.18);
    sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.35), scene); sun.intensity = 0.7; sun.diffuse = new Color3(0.95, 0.45, 0.4); // ánh trăng đỏ
  } else if (loc.kind !== 'map') {
    scene.clearColor = new Color4(0.1, 0.07, 0.09, 1);
    scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = 0.016; scene.fogColor = new Color3(0.12, 0.08, 0.1);
    hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene); hemi.intensity = 0.55; hemi.groundColor = new Color3(0.2, 0.14, 0.1);
    sun = new DirectionalLight('sun', new Vector3(-0.3, -1, -0.2), scene); sun.intensity = 0.8; sun.diffuse = new Color3(1, 0.8, 0.6);
  } else {
    scene.clearColor = new Color4(0.62, 0.78, 0.92, 1);
    scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = 0.012; scene.fogColor = new Color3(0.75, 0.85, 0.95);
    hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene); hemi.intensity = 0.75; hemi.groundColor = new Color3(0.35, 0.45, 0.3);
    sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.35), scene); sun.intensity = 1.15; sun.diffuse = new Color3(1, 0.92, 0.78);
  }
  lights.push(hemi, sun);

  const spiritParticles = (count: number, c1: Color4, c2: Color4, area = 30, rate = 60) => {
    const ps = new ParticleSystem(`spirit_${loc.id}`, count, scene);
    ps.particleTexture = particleTexture(scene);
    ps.emitter = new Vector3(0, 1, 0);
    ps.minEmitBox = new Vector3(-area, 0, -area); ps.maxEmitBox = new Vector3(area, 7, area);
    ps.color1 = c1; ps.color2 = c2; ps.colorDead = new Color4(0, 0, 0, 0);
    ps.minSize = 0.08; ps.maxSize = 0.3;
    ps.minLifeTime = 3; ps.maxLifeTime = 7;
    ps.emitRate = rate;
    ps.direction1 = new Vector3(-0.2, 0.5, -0.2); ps.direction2 = new Vector3(0.2, 1, 0.2);
    ps.minEmitPower = 0.3; ps.maxEmitPower = 0.8;
    ps.updateSpeed = 0.01;
    ps.start();
    systems.push(ps);
    return ps;
  };

  const clouds = (n: number) => {
    const cloudMat = mat('cloud', new Color3(1, 1, 1));
    cloudMat.alpha = 0.75; cloudMat.emissiveColor = new Color3(0.4, 0.4, 0.4);
    const groups: { parts: Mesh[]; speed: number }[] = [];
    for (let i = 0; i < n; i++) {
      const parts: Mesh[] = [];
      const cx = rand(-45, 45), cz = rand(-45, 45), cy = rand(15, 22);
      for (let j = 0; j < 4; j++) {
        const s = MeshBuilder.CreateSphere(`cloud${i}_${j}`, { diameter: rand(4, 8), segments: 8 }, scene);
        s.position.set(cx + j * 3 - 4, cy, cz + rand(-1, 1));
        s.scaling.y = 0.45; s.material = cloudMat;
        add(s); parts.push(s);
      }
      groups.push({ parts, speed: rand(0.3, 0.8) });
    }
    movers.push((dt) => {
      for (const c of groups) for (const p of c.parts) {
        p.position.x += c.speed * dt;
        if (p.position.x > 60) p.position.x = -60;
      }
    });
  };

  const groundPlane = (color: Color3) => {
    const ground = MeshBuilder.CreateGround('ground', { width: 90, height: 90, subdivisionsX: 48, subdivisionsY: 48, updatable: true }, scene);
    const pos = ground.getVerticesData('position');
    if (pos) {
      for (let i = 0; i < pos.length; i += 3) pos[i + 1] = groundHeight(pos[i], pos[i + 2]);
      ground.updateVerticesData('position', pos);
      ground.refreshBoundingInfo();
      ground.computeWorldMatrix(true);
    }
    const gm = mat('groundMat', color);
    gm.specularColor = Color3.Black();
    ground.material = gm;
    add(ground);
  };

  const plazaDisc = (x: number, z: number, radius: number, color: Color3) => {
    const plaza = MeshBuilder.CreateCylinder('plaza', { diameter: radius * 2, height: 0.18, tessellation: 36 }, scene);
    plaza.position.set(x, 0.09, z);
    plaza.material = mat('plazaMat', color);
    add(plaza);
  };

  const trees = (count: number, trunkC: Color3, leafC1: Color3, leafC2: Color3, dead = false) => {
    const trunkMat = mat('trunk', trunkC);
    const leafMat = mat('leaf', leafC1);
    const leafMat2 = mat('leaf2', leafC2);
    for (let i = 0; i < count; i++) {
      const { x, z } = scatterPos(13, 38);
      const y = groundHeight(x, z);
      const trunk = MeshBuilder.CreateCylinder(`trunk${i}`, { diameterTop: 0.22, diameterBottom: 0.36, height: rand(1.6, 2.6) }, scene);
      trunk.position.set(x, y + 1, z); trunk.material = trunkMat; add(trunk);
      if (dead) {
        const branch = MeshBuilder.CreateCylinder(`branch${i}`, { diameterTop: 0.02, diameterBottom: 0.16, height: 1.6, tessellation: 5 }, scene);
        branch.position.set(x + 0.4, y + 2.6, z); branch.rotation.z = 0.7; branch.material = trunkMat; add(branch);
      } else {
        const crown = MeshBuilder.CreateSphere(`crown${i}`, { diameter: rand(2.2, 3.6), segments: 8 }, scene);
        crown.position.set(x, y + 2.6 + Math.random(), z);
        crown.scaling.y = 0.8; crown.material = i % 2 ? leafMat : leafMat2; add(crown);
      }
    }
  };

  const rocks = (count: number, color: Color3, minD = 7, maxD = 38) => {
    const rockMat = mat('rock', color);
    for (let i = 0; i < count; i++) {
      const { x, z } = scatterPos(minD, maxD);
      const r = MeshBuilder.CreatePolyhedron(`rock${i}`, { type: 0, size: rand(0.4, 1.3) }, scene);
      r.position.set(x, groundHeight(x, z) + 0.2, z);
      r.rotation.set(Math.random(), Math.random() * 3, Math.random());
      r.scaling.y = 0.7; r.material = rockMat; add(r);
    }
  };

  const mountains = (color: Color3) => {
    const mtnMat = mat('mtn', color);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.4;
      const m = MeshBuilder.CreateCylinder(`mtn${i}`, { diameterTop: 0.02, diameterBottom: rand(28, 44), height: rand(16, 28), tessellation: 7 }, scene);
      m.position.set(Math.cos(a) * 78, 6, Math.sin(a) * 78);
      m.material = mtnMat; add(m);
    }
  };

  const arenaBase = (floorColor: Color3, wallColor: Color3, radius: number) => {
    const ground = MeshBuilder.CreateDisc('arenaGround', { radius: radius + 6, tessellation: 40 }, scene);
    ground.rotation.x = Math.PI / 2; ground.position.y = 0.02;
    const gm = mat('arenaMat', floorColor); gm.specularColor = Color3.Black();
    ground.material = gm; add(ground);
    const wallMat = mat('wallMat', wallColor);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const r = MeshBuilder.CreatePolyhedron(`wall${i}`, { type: 0, size: rand(2.2, 3.6) }, scene);
      r.position.set(Math.cos(a) * (radius + 3), rand(0.5, 1.4), Math.sin(a) * (radius + 3));
      r.rotation.set(Math.random(), Math.random() * 3, Math.random());
      r.material = wallMat; add(r);
    }
  };

  const torch = (x: number, z: number, flame: Color3, idx: number) => {
    const pole = MeshBuilder.CreateCylinder(`torch${idx}`, { diameter: 0.12, height: 2.2 }, scene);
    pole.position.set(x, 1.1, z); pole.material = mat('torchPole', new Color3(0.3, 0.2, 0.12)); add(pole);
    const fire = MeshBuilder.CreateSphere(`flame${idx}`, { diameter: 0.5, segments: 8 }, scene);
    fire.position.set(x, 2.4, z);
    fire.material = mat('flame', flame, flame); add(fire);
  };

  // ================= Dựng theo từng địa điểm =================
  if (loc.id === 'thanh-van') {
    groundPlane(new Color3(0.36, 0.55, 0.3));
    plazaDisc(0, 0, 4.5, new Color3(0.62, 0.6, 0.55));
    const pond = MeshBuilder.CreateDisc('pond', { radius: 4.2, tessellation: 32 }, scene);
    pond.rotation.x = Math.PI / 2; pond.position.set(11, 0.22, -9);
    const pm = mat('pondMat', new Color3(0.25, 0.55, 0.8));
    pm.alpha = 0.82; pm.emissiveColor = new Color3(0.05, 0.15, 0.25);
    pond.material = pm; add(pond);
    trees(22, new Color3(0.4, 0.28, 0.16), new Color3(0.2, 0.48, 0.22), new Color3(0.3, 0.6, 0.3));
    const bambooMat = mat('bamboo', new Color3(0.25, 0.62, 0.3));
    const leafMat2 = mat('leaf2b', new Color3(0.3, 0.6, 0.3));
    for (let i = 0; i < 26; i++) {
      const { x, z } = scatterPos(10, 36);
      const y = groundHeight(x, z);
      const h = rand(3.5, 5.5);
      const b = MeshBuilder.CreateCylinder(`bamboo${i}`, { diameter: 0.16, height: h }, scene);
      b.position.set(x, y + h / 2, z); b.material = bambooMat; add(b);
      const top = MeshBuilder.CreateCylinder(`btop${i}`, { diameterTop: 0.02, diameterBottom: 1.1, height: 1.2, tessellation: 6 }, scene);
      top.position.set(x, y + h + 0.4, z); top.material = leafMat2; add(top);
    }
    rocks(16, new Color3(0.5, 0.52, 0.55));
    mountains(new Color3(0.45, 0.58, 0.72));
    clouds(5);
    spiritParticles(350, new Color4(0.6, 1, 0.85, 0.7), new Color4(0.4, 0.8, 1, 0.5));
  } else if (loc.id === 'linh-khe') {
    groundPlane(new Color3(0.3, 0.62, 0.34));
    plazaDisc(0, 0, 4, new Color3(0.55, 0.62, 0.5));
    // Hồ linh lớn + suối
    const pond = MeshBuilder.CreateDisc('pond', { radius: 7, tessellation: 36 }, scene);
    pond.rotation.x = Math.PI / 2; pond.position.set(-12, 0.2, -10);
    const pm = mat('pondMat', new Color3(0.3, 0.7, 0.85));
    pm.alpha = 0.85; pm.emissiveColor = new Color3(0.1, 0.3, 0.35);
    pond.material = pm; add(pond);
    const stream = MeshBuilder.CreateGround('stream', { width: 3.2, height: 60, subdivisionsX: 1, subdivisionsY: 1 }, scene);
    stream.position.set(6, 0.12, 0); stream.rotation.y = 0.35;
    const sm = mat('streamMat', new Color3(0.35, 0.72, 0.9));
    sm.alpha = 0.7; sm.emissiveColor = new Color3(0.08, 0.25, 0.3);
    stream.material = sm; add(stream);
    trees(30, new Color3(0.42, 0.3, 0.18), new Color3(0.22, 0.58, 0.26), new Color3(0.35, 0.7, 0.34));
    rocks(12, new Color3(0.52, 0.56, 0.52));
    mountains(new Color3(0.42, 0.62, 0.6));
    clouds(4);
    // Hoa linh phát sáng
    const flowerMat = mat('flower', new Color3(0.85, 0.5, 0.95), new Color3(0.55, 0.2, 0.8));
    const stemMat = mat('stem', new Color3(0.25, 0.5, 0.25));
    for (let i = 0; i < 42; i++) {
      const { x, z } = scatterPos(6, 36);
      const y = groundHeight(x, z);
      const stem = MeshBuilder.CreateCylinder(`stem${i}`, { diameter: 0.05, height: 0.5 }, scene);
      stem.position.set(x, y + 0.25, z); stem.material = stemMat; add(stem);
      const fl = MeshBuilder.CreateSphere(`flower${i}`, { diameter: rand(0.22, 0.4), segments: 6 }, scene);
      fl.position.set(x, y + 0.55, z); fl.material = flowerMat; add(fl);
    }
    // Đom đóm
    const ff = spiritParticles(180, new Color4(0.8, 1, 0.4, 0.9), new Color4(0.5, 0.95, 0.3, 0.6), 26, 40);
    ff.minSize = 0.12; ff.maxSize = 0.34;
  } else if (loc.id === 'hac-phong') {
    groundPlane(new Color3(0.16, 0.12, 0.2));
    plazaDisc(0, 0, 4.5, new Color3(0.3, 0.26, 0.34));
    trees(30, new Color3(0.1, 0.07, 0.13), new Color3(0.2, 0.1, 0.3), new Color3(0.16, 0.08, 0.26), true);
    rocks(24, new Color3(0.22, 0.18, 0.3));
    mountains(new Color3(0.2, 0.13, 0.3));
    spiritParticles(160, new Color4(0.9, 0.4, 0.35, 0.6), new Color4(0.6, 0.25, 0.5, 0.5), 30, 30);
  } else if (loc.id === 'bc-sao-huyet') {
    arenaBase(new Color3(0.4, 0.3, 0.24), new Color3(0.35, 0.28, 0.24), 46);
    plazaDisc(0, 0, 5, new Color3(0.45, 0.36, 0.3));
    rocks(14, new Color3(0.42, 0.34, 0.28), 12, 40);
    // Xương trắng rải rác (trụ trắng bắt chéo)
    const boneMat = mat('bone', new Color3(0.9, 0.88, 0.8));
    for (let i = 0; i < 8; i++) {
      const { x, z } = scatterPos(6, 36);
      const bone = MeshBuilder.CreateCylinder(`bone${i}`, { diameter: 0.09, height: rand(1, 1.8) }, scene);
      bone.position.set(x, 0.25, z); bone.rotation.set(Math.PI / 2.2, 0, Math.random() * 3);
      bone.material = boneMat; add(bone);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      torch(Math.cos(a) * 20, Math.sin(a) * 20, new Color3(1, 0.5, 0.15), i);
    }
    spiritParticles(120, new Color4(1, 0.6, 0.4, 0.6), new Color4(0.9, 0.4, 0.3, 0.5), 30, 25);
  } else {
    // bc-dong-phu: 3 gian phòng trên 1 đấu trường, cổng chắn giữa các gian
    arenaBase(new Color3(0.36, 0.34, 0.32), new Color3(0.3, 0.28, 0.3), 48);
    plazaDisc(0, 18, 5, new Color3(0.5, 0.47, 0.42));
    plazaDisc(0, -6, 5.5, new Color3(0.48, 0.45, 0.4));
    plazaDisc(0, -32, 6.5, new Color3(0.55, 0.48, 0.38));
    // Cột đá mỗi gian
    const pillarMat = mat('pillar', new Color3(0.45, 0.42, 0.4));
    for (const cz of [18, -6, -32]) {
      for (const sx of [-8, 8]) {
        const p = MeshBuilder.CreateCylinder(`pillar_${cz}_${sx}`, { diameter: 0.9, height: 6, tessellation: 8 }, scene);
        p.position.set(sx, 3, cz); p.material = pillarMat; add(p);
        const cap = MeshBuilder.CreateBox(`cap_${cz}_${sx}`, { width: 1.6, height: 0.5, depth: 1.6 }, scene);
        cap.position.set(sx, 6.2, cz); cap.material = pillarMat; add(cap);
      }
    }
    // Bảo tọa gian cuối (nơi boss trấn giữ)
    const throne = MeshBuilder.CreateBox('throne', { width: 5, height: 1.2, depth: 3 }, scene);
    throne.position.set(0, 0.6, -38); throne.material = mat('throneMat', new Color3(0.6, 0.5, 0.3), new Color3(0.15, 0.1, 0.02)); add(throne);
    // Cổng kết giới tại z=6 và z=-18
    const gateMat = mat('gate', new Color3(0.3, 0.85, 0.95), new Color3(0.1, 0.45, 0.55));
    gateMat.alpha = 0.45; gateMat.backFaceCulling = false;
    for (const [idx, gz] of [[0, 6], [1, -18]] as [number, number][]) {
      const gate = MeshBuilder.CreateBox(`gate${idx}`, { width: 20, height: 5, depth: 0.7 }, scene);
      gate.position.set(0, 2.5, gz);
      gate.material = gateMat;
      add(gate);
      gates.push(gate);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      torch(Math.cos(a) * 16, -14 + Math.sin(a) * 16, new Color3(0.4, 0.85, 1), i);
    }
    spiritParticles(150, new Color4(0.6, 0.9, 1, 0.6), new Color4(0.4, 0.7, 0.95, 0.5), 34, 30);
  }

  return {
    gates,
    move: (dt: number) => { for (const m of movers) m(dt); },
    dispose: () => {
      for (const ps of systems) { ps.stop(); ps.dispose(); }
      for (const l of lights) l.dispose();
      for (const mesh of root.getChildMeshes()) mesh.dispose();
      for (const m of mats) m.dispose();
      root.dispose();
    },
  };
}
