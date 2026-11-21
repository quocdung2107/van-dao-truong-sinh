import {
  Scene, TransformNode, Vector3, Color3, MeshBuilder, StandardMaterial, ParticleSystem, Color4, Mesh,
} from '@babylonjs/core';
import { particleTexture } from './scene';

function mat(scene: Scene, name: string, color: Color3, emissive?: Color3): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color;
  if (emissive) m.emissiveColor = emissive;
  return m;
}

export class Player {
  root = new TransformNode('playerRoot');
  body = new TransformNode('playerBody');
  armR = new TransformNode('armR');
  legL!: Mesh; legR!: Mesh;
  sword = new TransformNode('sword');
  swordBladeMat: StandardMaterial;
  ring: Mesh;
  ringLightMat: StandardMaterial;
  medParticles: ParticleSystem;

  // Trạng thái animation do code điều khiển
  walkPhase = 0;
  attackT = 1; // >=1 = không tấn công
  drawT = 1; // tiến trình rút kiếm 0..1
  meditateT = 0; // tiến trình ngồi thiền 0..1
  flashT = 0;

  robeMat: StandardMaterial;

  constructor(scene: Scene) {
    this.body.parent = this.root;
    const robe = mat(scene, 'robe', new Color3(0.15, 0.5, 0.5));
    this.robeMat = robe;
    const trim = mat(scene, 'trim', new Color3(0.9, 0.78, 0.4), new Color3(0.15, 0.1, 0.02));
    const skin = mat(scene, 'skin', new Color3(0.96, 0.8, 0.66));
    const hairM = mat(scene, 'hair', new Color3(0.12, 0.1, 0.14));
    const dark = mat(scene, 'dark', new Color3(0.2, 0.2, 0.25));

    // Áo choàng (thân) — hình nón cụt
    const torso = MeshBuilder.CreateCylinder('torso', { diameterTop: 0.52, diameterBottom: 0.95, height: 1.15, tessellation: 12 }, scene);
    torso.position.y = 0.85; torso.material = robe; torso.parent = this.body;
    // Đai vàng
    const belt = MeshBuilder.CreateCylinder('belt', { diameter: 0.68, height: 0.12, tessellation: 12 }, scene);
    belt.position.y = 1.05; belt.material = trim; belt.parent = this.body;
    // Đầu + tóc + búi tóc
    const head = MeshBuilder.CreateSphere('head', { diameter: 0.52, segments: 12 }, scene);
    head.position.y = 1.72; head.material = skin; head.parent = this.body;
    const hair = MeshBuilder.CreateSphere('hairTop', { diameter: 0.56, segments: 12 }, scene);
    hair.position.y = 1.82; hair.scaling.set(1, 0.72, 1); hair.material = hairM; hair.parent = this.body;
    const knot = MeshBuilder.CreateSphere('knot', { diameter: 0.2, segments: 8 }, scene);
    knot.position.y = 2.08; knot.material = hairM; knot.parent = this.body;
    const pin = MeshBuilder.CreateCylinder('pin', { diameter: 0.04, height: 0.42 }, scene);
    pin.rotation.z = Math.PI / 2.4; pin.position.y = 2.1; pin.material = trim; pin.parent = this.body;

    // Tay trái (tĩnh tương đối)
    const armL = MeshBuilder.CreateCylinder('armL', { diameter: 0.16, height: 0.72 }, scene);
    armL.position.set(-0.42, 1.12, 0); armL.rotation.z = 0.35; armL.material = robe; armL.parent = this.body;
    // Tay phải — pivot ở vai để vung kiếm
    this.armR.position.set(0.36, 1.38, 0); this.armR.parent = this.body;
    const armRMesh = MeshBuilder.CreateCylinder('armRMesh', { diameter: 0.16, height: 0.72 }, scene);
    armRMesh.position.y = -0.32; armRMesh.material = robe; armRMesh.parent = this.armR;
    const hand = MeshBuilder.CreateSphere('hand', { diameter: 0.18, segments: 8 }, scene);
    hand.position.y = -0.7; hand.material = skin; hand.parent = this.armR;

    // Chân (hiện khi đi, ẩn/xếp khi thiền)
    this.legL = MeshBuilder.CreateCylinder('legL', { diameter: 0.17, height: 0.55 }, scene);
    this.legL.position.set(-0.18, 0.28, 0); this.legL.material = dark; this.legL.parent = this.body;
    this.legR = this.legL.clone('legR') as Mesh;
    this.legR.position.x = 0.18; this.legR.parent = this.body;

    // Kiếm: chuôi + lưỡi, nhóm riêng để chuyển sau lưng <-> tay
    this.sword.parent = this.body;
    const handle = MeshBuilder.CreateCylinder('handle', { diameter: 0.055, height: 0.3 }, scene);
    handle.material = dark; handle.parent = this.sword;
    const guard = MeshBuilder.CreateBox('guard', { width: 0.26, height: 0.05, depth: 0.1 }, scene);
    guard.position.y = 0.17; guard.material = trim; guard.parent = this.sword;
    this.swordBladeMat = mat(scene, 'blade', new Color3(0.75, 0.85, 0.95), new Color3(0.05, 0.08, 0.12));
    const blade = MeshBuilder.CreateBox('blade', { width: 0.09, height: 0.95, depth: 0.025 }, scene);
    blade.position.y = 0.68; blade.material = this.swordBladeMat; blade.parent = this.sword;
    this.setSwordPose(0);

    // Vòng trận pháp khi thiền
    this.ringLightMat = mat(scene, 'ring', new Color3(0.2, 0.9, 0.7), new Color3(0.1, 0.7, 0.5));
    this.ringLightMat.alpha = 0;
    this.ring = MeshBuilder.CreateTorus('medRing', { diameter: 1.9, thickness: 0.07, tessellation: 40 }, scene);
    this.ring.rotation.x = Math.PI / 2; this.ring.position.y = 0.16;
    this.ring.material = this.ringLightMat; this.ring.parent = this.root;

    // Hạt linh khí bốc lên khi thiền
    this.medParticles = new ParticleSystem('medPs', 120, scene);
    this.medParticles.particleTexture = particleTexture(scene);
    this.medParticles.emitter = new Vector3(0, 1, 0); // Game cập nhật vị trí emitter mỗi frame theo nhân vật
    this.medParticles.createCylinderEmitter(1, 0.4, 0, 0);
    this.medParticles.color1 = new Color4(0.5, 1, 0.8, 0.9);
    this.medParticles.color2 = new Color4(0.4, 0.7, 1, 0.6);
    this.medParticles.colorDead = new Color4(0, 0, 0, 0);
    this.medParticles.minSize = 0.06; this.medParticles.maxSize = 0.22;
    this.medParticles.minLifeTime = 1; this.medParticles.maxLifeTime = 2.2;
    this.medParticles.emitRate = 0;
    this.medParticles.direction1 = new Vector3(-0.3, 1, -0.3);
    this.medParticles.direction2 = new Vector3(0.3, 1.6, 0.3);
    this.medParticles.minEmitPower = 0.6; this.medParticles.maxEmitPower = 1.2;
    this.medParticles.updateSpeed = 0.02;
    this.medParticles.start();
  }

  /** Màu lưỡi kiếm theo phẩm vũ khí đang trang bị (Giai đoạn 2) */
  private bladeTint: [number, number, number] = [0.35, 0.6, 1];

  /** Đổi màu phát sáng của lưỡi kiếm theo vũ khí trang bị */
  setBladeTint(rgb: [number, number, number]) { this.bladeTint = rgb; }

  /** t=0: kiếm sau lưng, t=1: kiếm trên tay phải */
  setSwordPose(t: number) {
    const back = { p: new Vector3(-0.25, 1.35, -0.32), rz: 0.7, rx: 0.3 };
    const hand = { p: new Vector3(0.36, 0.68, 0.05), rz: -0.25, rx: 0 };
    this.sword.position = Vector3.Lerp(back.p, hand.p, t);
    this.sword.rotation.set(back.rx + (hand.rx - back.rx) * t, 0, back.rz + (hand.rz - back.rz) * t);
    const glow = 0.15 + t * 0.55;
    const [r, g, b] = this.bladeTint;
    this.swordBladeMat.emissiveColor = new Color3(r * glow, g * glow, b * glow);
  }

  startAttack() { if (this.attackT >= 1) this.attackT = 0; }
  flash() { this.flashT = 1; }

  update(dt: number, opts: { moving: boolean; meditating: boolean; swordDrawn: boolean; time: number }) {
    // Rút kiếm / cất kiếm
    const target = opts.swordDrawn ? 1 : 0;
    this.drawT += Math.sign(target - this.drawT) * dt * 2.2;
    this.drawT = Math.max(0, Math.min(1, this.drawT));
    // Vung kiếm khi đang rút (hiệu ứng rút kiếm)
    this.setSwordPose(this.drawT);

    // Thiền: hạ người xuống, xếp chân
    const mTarget = opts.meditating ? 1 : 0;
    this.meditateT += Math.sign(mTarget - this.meditateT) * dt * 2.5;
    this.meditateT = Math.max(0, Math.min(1, this.meditateT));
    const m = this.meditateT;
    this.body.position.y = -0.42 * m;
    this.legL.rotation.x = -1.2 * m; this.legR.rotation.x = -1.2 * m;
    this.legL.rotation.z = 0.7 * m; this.legR.rotation.z = -0.7 * m;
    this.ringLightMat.alpha = m * 0.9;
    this.ring.rotation.y += dt * 0.8 * m;
    this.medParticles.emitRate = m * 70;

    // Thở / đi bộ
    if (opts.moving && m < 0.1) {
      this.walkPhase += dt * 9;
      this.body.position.y += Math.abs(Math.sin(this.walkPhase)) * 0.09;
      this.body.rotation.z = Math.sin(this.walkPhase) * 0.05;
      if (this.drawT < 0.5) this.armR.rotation.x = Math.sin(this.walkPhase) * 0.5;
      this.legL.rotation.x = Math.sin(this.walkPhase) * 0.55;
      this.legR.rotation.x = -Math.sin(this.walkPhase) * 0.55;
    } else if (m < 0.1) {
      this.body.position.y += Math.sin(opts.time * 2) * 0.025; // hơi thở
      this.body.rotation.z *= 0.9;
      if (this.drawT < 0.5) this.armR.rotation.x *= 0.9;
      this.legL.rotation.x *= 0.85; this.legR.rotation.x *= 0.85;
    }

    // Tấn công: vung tay phải + kiếm chém vòng cung
    if (this.attackT < 1) {
      this.attackT = Math.min(1, this.attackT + dt * 3.2);
      const a = Math.sin(this.attackT * Math.PI);
      this.armR.rotation.x = -1.9 * a;
      this.armR.rotation.z = -0.5 * a;
      this.sword.rotation.x = -0.9 * a;
    } else {
      this.armR.rotation.z *= 0.85;
      if (!opts.moving) this.armR.rotation.x *= 0.85;
    }

    // Nháy đỏ khi trúng đòn
    if (this.flashT > 0) {
      this.flashT = Math.max(0, this.flashT - dt * 4);
      this.robeMat.emissiveColor = new Color3(0.6 * this.flashT, 0.05, 0.05);
    } else {
      this.robeMat.emissiveColor = Color3.Black();
    }
  }
}
