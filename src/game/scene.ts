import {
  Scene, Vector3, Color3, Color4, HemisphericLight, DirectionalLight,
  MeshBuilder, StandardMaterial, ParticleSystem, Texture, DynamicTexture,
} from '@babylonjs/core';

function mat(scene: Scene, name: string, color: Color3, emissive?: Color3): StandardMaterial {
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

/** Chiều cao địa hình — phẳng ở trung tâm (sân tu luyện), nhấp nhô ở rìa */
export function groundHeight(x: number, z: number): number {
  const d = Math.sqrt(x * x + z * z);
  const t = Math.max(0, (d - 14) / 26);
  return t * t * (Math.sin(x * 0.22) * Math.cos(z * 0.19) * 2.2 + Math.sin(x * 0.07 + z * 0.11) * 1.6);
}

export function buildEnvironment(scene: Scene): { clouds: { move: (dt: number) => void } } {
  scene.clearColor = new Color4(0.62, 0.78, 0.92, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.012;
  scene.fogColor = new Color3(0.75, 0.85, 0.95);

  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.75; hemi.groundColor = new Color3(0.35, 0.45, 0.3);
  const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.35), scene);
  sun.intensity = 1.15; sun.diffuse = new Color3(1, 0.92, 0.78);

  // Địa hình
  const ground = MeshBuilder.CreateGround('ground', { width: 90, height: 90, subdivisionsX: 48, subdivisionsY: 48, updatable: true }, scene);
  const pos = ground.getVerticesData('position');
  if (pos) {
    for (let i = 0; i < pos.length; i += 3) pos[i + 1] = groundHeight(pos[i], pos[i + 2]);
    ground.updateVerticesData('position', pos);
    ground.refreshBoundingInfo();
    ground.computeWorldMatrix(true);
  }
  const gm = mat(scene, 'groundMat', new Color3(0.36, 0.55, 0.3));
  gm.specularColor = Color3.Black();
  ground.material = gm;

  // Sân đá tròn ở trung tâm — nơi thiền
  const plaza = MeshBuilder.CreateCylinder('plaza', { diameter: 9, height: 0.18, tessellation: 36 }, scene);
  plaza.position.y = 0.09;
  plaza.material = mat(scene, 'plazaMat', new Color3(0.62, 0.6, 0.55));

  // Hồ nước
  const pond = MeshBuilder.CreateDisc('pond', { radius: 4.2, tessellation: 32 }, scene);
  pond.rotation.x = Math.PI / 2;
  pond.position.set(11, 0.22, -9);
  const pm = mat(scene, 'pondMat', new Color3(0.25, 0.55, 0.8));
  pm.alpha = 0.82; pm.emissiveColor = new Color3(0.05, 0.15, 0.25);
  pond.material = pm;

  const trunkMat = mat(scene, 'trunk', new Color3(0.4, 0.28, 0.16));
  const leafMat = mat(scene, 'leaf', new Color3(0.2, 0.48, 0.22));
  const leafMat2 = mat(scene, 'leaf2', new Color3(0.3, 0.6, 0.3));
  const bambooMat = mat(scene, 'bamboo', new Color3(0.25, 0.62, 0.3));
  const rockMat = mat(scene, 'rock', new Color3(0.5, 0.52, 0.55));

  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const scatterPos = (minD: number, maxD: number) => {
    const a = Math.random() * Math.PI * 2, d = rand(minD, maxD);
    return { x: Math.cos(a) * d, z: Math.sin(a) * d };
  };

  // Cây tán tròn
  for (let i = 0; i < 22; i++) {
    const { x, z } = scatterPos(13, 38);
    const y = groundHeight(x, z);
    const trunk = MeshBuilder.CreateCylinder(`trunk${i}`, { diameterTop: 0.22, diameterBottom: 0.36, height: rand(1.6, 2.6) }, scene);
    trunk.position.set(x, y + 1, z); trunk.material = trunkMat;
    const crown = MeshBuilder.CreateSphere(`crown${i}`, { diameter: rand(2.2, 3.6), segments: 8 }, scene);
    crown.position.set(x, y + 2.6 + Math.random(), z);
    crown.scaling.y = 0.8; crown.material = i % 2 ? leafMat : leafMat2;
  }
  // Rừng trúc
  for (let i = 0; i < 26; i++) {
    const { x, z } = scatterPos(10, 36);
    const y = groundHeight(x, z);
    const h = rand(3.5, 5.5);
    const b = MeshBuilder.CreateCylinder(`bamboo${i}`, { diameter: 0.16, height: h }, scene);
    b.position.set(x, y + h / 2, z); b.material = bambooMat;
    const top = MeshBuilder.CreateCylinder(`btop${i}`, { diameterTop: 0.02, diameterBottom: 1.1, height: 1.2, tessellation: 6 }, scene);
    top.position.set(x, y + h + 0.4, z); top.material = leafMat2;
  }
  // Đá
  for (let i = 0; i < 16; i++) {
    const { x, z } = scatterPos(7, 38);
    const r = MeshBuilder.CreatePolyhedron(`rock${i}`, { type: 0, size: rand(0.4, 1.3) }, scene);
    r.position.set(x, groundHeight(x, z) + 0.2, z);
    r.rotation.set(Math.random(), Math.random() * 3, Math.random());
    r.scaling.y = 0.7; r.material = rockMat;
  }
  // Núi xa làm nền
  const mtnMat = mat(scene, 'mtn', new Color3(0.45, 0.58, 0.72));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const m = MeshBuilder.CreateCylinder(`mtn${i}`, { diameterTop: 0.02, diameterBottom: rand(28, 44), height: rand(16, 28), tessellation: 7 }, scene);
    m.position.set(Math.cos(a) * 78, 6, Math.sin(a) * 78);
    m.material = mtnMat;
  }

  // Mây trôi
  const cloudMat = mat(scene, 'cloud', new Color3(1, 1, 1));
  cloudMat.alpha = 0.75; cloudMat.emissiveColor = new Color3(0.4, 0.4, 0.4);
  const cloudGroups: { parts: { position: Vector3 }[]; speed: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const parts: { position: Vector3 }[] = [];
    const cx = rand(-45, 45), cz = rand(-45, 45), cy = rand(15, 22);
    for (let j = 0; j < 4; j++) {
      const s = MeshBuilder.CreateSphere(`cloud${i}_${j}`, { diameter: rand(4, 8), segments: 8 }, scene);
      s.position.set(cx + j * 3 - 4, cy, cz + rand(-1, 1));
      s.scaling.y = 0.45; s.material = cloudMat;
      parts.push(s);
    }
    cloudGroups.push({ parts, speed: rand(0.3, 0.8) });
  }

  // Hạt linh khí bay khắp cảnh
  const ps = new ParticleSystem('spirit', 350, scene);
  ps.particleTexture = particleTexture(scene);
  ps.emitter = new Vector3(0, 1, 0);
  ps.minEmitBox = new Vector3(-30, 0, -30); ps.maxEmitBox = new Vector3(30, 7, 30);
  ps.color1 = new Color4(0.6, 1, 0.85, 0.7); ps.color2 = new Color4(0.4, 0.8, 1, 0.5);
  ps.colorDead = new Color4(0, 0, 0, 0);
  ps.minSize = 0.08; ps.maxSize = 0.3;
  ps.minLifeTime = 3; ps.maxLifeTime = 7;
  ps.emitRate = 60;
  ps.direction1 = new Vector3(-0.2, 0.5, -0.2); ps.direction2 = new Vector3(0.2, 1, 0.2);
  ps.minEmitPower = 0.3; ps.maxEmitPower = 0.8;
  ps.updateSpeed = 0.01;
  ps.start();

  return {
    clouds: {
      move: (dt: number) => {
        for (const c of cloudGroups) for (const p of c.parts) {
          p.position.x += c.speed * dt;
          if (p.position.x > 60) p.position.x = -60;
        }
      },
    },
  };
}
