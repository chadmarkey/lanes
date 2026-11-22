import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  SPATIAL_CAMERA_PRESETS,
  type SpatialCameraPresetId,
  type SpatialLaneNode,
} from '../lib/spatialLayout';
import type { ShaderPresetId } from '../lib/appearance';

export interface StudioSceneCallbacks {
  onSelectLane: (laneId: string | null) => void;
  onHoverLane?: (laneId: string | null) => void;
}

export interface StudioSceneController {
  updateData: (nodes: SpatialLaneNode[]) => void;
  setTheme: (isDark: boolean) => void;
  setShader: (shader: ShaderPresetId) => void;
  setCameraPreset: (preset: SpatialCameraPresetId) => void;
  focusLane: (laneId: string | null) => void;
  setExplode: (amount: number) => void;
  setAutoRotate: (enabled: boolean) => void;
  dispose: () => void;
}

interface ExplodablePart {
  object: THREE.Object3D;
  baseY: number;
  explodeDelta: number;
}

interface LaneVisual {
  laneId: string;
  group: THREE.Group;
  ceramicMat: THREE.MeshPhysicalMaterial;
  haloMesh: THREE.Mesh;
  basePosition: THREE.Vector3;
  height: number;
}

function detectSoftwareGl(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(renderer);
  } catch {
    return true;
  }
}

function createTravertineTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  ctx.fillStyle = '#EAE0D1';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  // Subtle horizontal sedimentary travertine veins
  for (let y = 0; y < size; y += 3) {
    const wave = Math.sin(y * 0.09) * 0.5 + Math.cos(y * 0.037) * 0.5;
    const alpha = 0.04 + Math.abs(wave) * 0.07;
    ctx.fillStyle = wave > 0 ? `rgba(186, 168, 146, ${alpha})` : `rgba(255, 250, 242, ${alpha})`;
    ctx.fillRect(0, y, size, 2 + (y % 2));

    const bVal = Math.round(122 + wave * 24);
    bCtx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
    bCtx.fillRect(0, y, size, 2);
  }

  // Fine mineral pores (deterministic PRNG)
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 650; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 2 + rand() * 9;
    const h = 1 + rand() * 1.6;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(130, 114, 98, 0.08)' : 'rgba(255, 252, 247, 0.09)';
    ctx.fillRect(x, y, w, h);
    bCtx.fillStyle = 'rgba(78, 78, 78, 0.25)';
    bCtx.fillRect(x, y, w, h);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function createWalnutTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
} {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  ctx.fillStyle = '#4B3224';
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, size, size);

  for (let x = 0; x < size; x += 2) {
    const grain = Math.sin(x * 0.14) * 0.5 + Math.sin(x * 0.37 + 1.2) * 0.35 + Math.cos(x * 0.05) * 0.15;
    const r = Math.round(74 + grain * 22);
    const g = Math.round(49 + grain * 15);
    const b = Math.round(34 + grain * 11);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, 0, 2, size);

    const bv = Math.round(128 + grain * 36);
    bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    bCtx.fillRect(x, 0, 2, size);
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

function createStudioFloorTexture(
  isDark: boolean,
  maxAnisotropy: number,
  shader: ShaderPresetId = 'travertine-grain'
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = isDark ? '#241815' : '#DFD3C3';
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  // Radial studio vignette
  const grad = ctx.createRadialGradient(cx, cy, 24, cx, cy, size * 0.49);
  if (isDark) {
    grad.addColorStop(0, shader === 'warm-glow' ? 'rgba(138, 66, 40, 0.34)' : 'rgba(72, 48, 40, 0.32)');
    grad.addColorStop(1, 'rgba(18, 10, 8, 0.54)');
  } else {
    grad.addColorStop(0, shader === 'warm-glow' ? 'rgba(255, 224, 206, 0.62)' : 'rgba(246, 239, 228, 0.55)');
    grad.addColorStop(1, 'rgba(176, 158, 138, 0.42)');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  if (shader === 'blueprint-grid') {
    ctx.strokeStyle = isDark ? 'rgba(128, 208, 251, 0.16)' : 'rgba(0, 87, 118, 0.16)';
    ctx.lineWidth = 1;
    for (let g = 0; g <= size; g += 24) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.lineTo(size, g);
      ctx.stroke();
    }
  }

  // Subtle architectural compass rings
  ctx.strokeStyle = isDark ? 'rgba(220, 178, 134, 0.14)' : 'rgba(130, 104, 80, 0.16)';
  ctx.lineWidth = 1.5;
  for (const r of [64, 128, 184, 232]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Subtle compass crosshairs
  ctx.strokeStyle = isDark ? 'rgba(220, 178, 134, 0.08)' : 'rgba(130, 104, 80, 0.1)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 52, cy + Math.sin(a) * 52);
    ctx.lineTo(cx + Math.cos(a) * 238, cy + Math.sin(a) * 238);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(24, 14, 10, 0.42)');
  grad.addColorStop(0.55, 'rgba(24, 14, 10, 0.18)');
  grad.addColorStop(1, 'rgba(24, 14, 10, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

function createOctagonShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function createArchShape(width: number, height: number, thickness: number): THREE.Shape {
  const shape = new THREE.Shape();
  const outerR = width / 2;
  const innerR = Math.max(0.1, outerR - thickness);
  const stemH = Math.max(0.15, height - outerR);

  shape.moveTo(-outerR, 0);
  shape.lineTo(-outerR, stemH);
  shape.absarc(0, stemH, outerR, Math.PI, 0, true);
  shape.lineTo(outerR, 0);
  shape.lineTo(innerR, 0);
  shape.lineTo(innerR, stemH);
  shape.absarc(0, stemH, innerR, 0, Math.PI, false);
  shape.lineTo(-innerR, 0);
  shape.closePath();
  return shape;
}

function createFinShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0.42, 0);
  s.lineTo(0.16, 0.72);
  s.lineTo(0, 0.72);
  s.closePath();
  return s;
}

function disposeObjectTree(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m) m.dispose();
      }
    }
  });
}

export function createStudioScene(
  container: HTMLElement,
  initialNodes: SpatialLaneNode[],
  initialIsDark: boolean,
  callbacks: StudioSceneCallbacks,
  initialShader: ShaderPresetId = 'travertine-grain'
): StudioSceneController {
  let currentIsDark = initialIsDark;
  let currentShader: ShaderPresetId = initialShader;
  const isSoftwareGl = detectSoftwareGl();

  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
    alpha: false,
  });
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);

  const scene = new THREE.Scene();

  // Studio IBL via RoomEnvironment on all devices so metals and glazed ceramics read richly
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = initialIsDark ? 0.72 : 0.88;

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 140);
  const heroPreset = SPATIAL_CAMERA_PRESETS.hero;
  camera.position.set(...heroPreset.position);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...heroPreset.target);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.07;
  controls.maxPolarAngle = Math.PI * 0.475;
  controls.minPolarAngle = 0.14;
  controls.minDistance = 4.2;
  controls.maxDistance = 24;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.75;
  controls.update();

  // Studio 3-point lighting + cool/warm contrast
  const hemiLight = new THREE.HemisphereLight(0xdbe8f5, 0x7c5b43, initialIsDark ? 0.48 : 0.78);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff1dc, initialIsDark ? 2.1 : 2.35);
  keyLight.position.set(9.5, 13.5, 7.5);
  keyLight.castShadow = !isSoftwareGl;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 36;
  const d = 11.5;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xe58d68, initialIsDark ? 0.95 : 0.62);
  rimLight.position.set(-9, 6.5, -8.5);
  scene.add(rimLight);

  // Shared procedural textures
  const travertineTex = createTravertineTextures(maxAnisotropy);
  const walnutTex = createWalnutTextures(maxAnisotropy);
  const contactShadowTex = createContactShadowTexture();
  let floorTex = createStudioFloorTexture(initialIsDark, maxAnisotropy, initialShader);

  // Shared reusable studio materials (with >= 0.25 roughness variation across parts)
  const travertineMat = new THREE.MeshStandardMaterial({
    map: travertineTex.map,
    bumpMap: travertineTex.bumpMap,
    bumpScale: 0.025,
    color: initialIsDark ? 0x8e7c71 : 0xf4ede2,
    roughness: 0.84,
    metalness: 0.03,
  });

  const walnutMat = new THREE.MeshStandardMaterial({
    map: walnutTex.map,
    bumpMap: walnutTex.bumpMap,
    bumpScale: 0.03,
    color: 0xffffff,
    roughness: 0.54,
    metalness: 0.06,
  });

  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xcfa365,
    roughness: 0.22,
    metalness: 0.92,
  });

  const darkBronzeMat = new THREE.MeshStandardMaterial({
    color: 0x3b2c25,
    roughness: 0.42,
    metalness: 0.72,
  });

  const contactShadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    opacity: initialIsDark ? 0.52 : 0.38,
    depthWrite: false,
  });

  // Studio floor dais (flush at y = 0)
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.88,
    metalness: 0.02,
  });
  const floorGeo = new THREE.CylinderGeometry(16, 16.4, 0.36, 72);
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = -0.18;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // Architectural brass compass trim ring inset into studio floor
  const daisRingGeo = new THREE.TorusGeometry(6.65, 0.035, 16, 96);
  const daisRing = new THREE.Mesh(daisRingGeo, brassMat);
  daisRing.rotation.x = Math.PI / 2;
  daisRing.position.y = 0.015;
  scene.add(daisRing);

  const innerRingGeo = new THREE.TorusGeometry(4.65, 0.022, 12, 84);
  const innerRing = new THREE.Mesh(innerRingGeo, brassMat);
  innerRing.rotation.x = Math.PI / 2;
  innerRing.position.y = 0.012;
  scene.add(innerRing);

  // InstancedMesh 1: 48 recessed brass drafting studs around the studio rings
  const studCount = 48;
  const studGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.04, 12);
  const studInstanced = new THREE.InstancedMesh(studGeo, brassMat, studCount);
  const tmpMatrix = new THREE.Matrix4();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpScale = new THREE.Vector3(1, 1, 1);
  const upAxis = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < studCount; i++) {
    const a = (i / studCount) * Math.PI * 2;
    const r = i % 2 === 0 ? 6.65 : 2.35;
    tmpPos.set(Math.cos(a) * r, 0.02, Math.sin(a) * r);
    tmpQuat.setFromAxisAngle(upAxis, -a);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    studInstanced.setMatrixAt(i, tmpMatrix);
  }
  studInstanced.instanceMatrix.needsUpdate = true;
  studInstanced.computeBoundingSphere();
  scene.add(studInstanced);

  // InstancedMesh 2: 32 vertical midcentury architectural walnut perimeter louvers
  const louverCount = 32;
  const louverGeo = new THREE.BoxGeometry(0.11, 1.55, 0.34);
  const louverInstanced = new THREE.InstancedMesh(louverGeo, walnutMat, louverCount);
  for (let i = 0; i < louverCount; i++) {
    const a = (i / louverCount) * Math.PI * 2;
    const r = 9.4;
    const hScale = 0.65 + 0.45 * Math.sin(a * 3 + 0.7);
    tmpPos.set(Math.cos(a) * r, (1.55 * hScale) / 2, Math.sin(a) * r);
    tmpQuat.setFromAxisAngle(upAxis, -a);
    tmpScale.set(1, hScale, 1);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    louverInstanced.setMatrixAt(i, tmpMatrix);
  }
  louverInstanced.instanceMatrix.needsUpdate = true;
  louverInstanced.computeBoundingSphere();
  louverInstanced.castShadow = !isSoftwareGl;
  louverInstanced.receiveShadow = true;
  scene.add(louverInstanced);

  // --- Composite Central Lanes Hub (8 parts, grounded at y = 0) ---
  const explodableParts: ExplodablePart[] = [];
  const hubGroup = new THREE.Group();
  hubGroup.name = 'lanes-central-hub';
  scene.add(hubGroup);

  // 1. Hub contact shadow
  const hubShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 3.5), contactShadowMat);
  hubShadow.rotation.x = -Math.PI / 2;
  hubShadow.position.y = 0.005;
  hubGroup.add(hubShadow);

  // 2. Stepped travertine circular plinth (LatheGeometry)
  const hubPlinthPts = [
    new THREE.Vector2(0.01, 0),
    new THREE.Vector2(1.32, 0),
    new THREE.Vector2(1.32, 0.16),
    new THREE.Vector2(1.16, 0.24),
    new THREE.Vector2(1.12, 0.38),
    new THREE.Vector2(0.88, 0.44),
    new THREE.Vector2(0.01, 0.44),
  ];
  const hubPlinth = new THREE.Mesh(new THREE.LatheGeometry(hubPlinthPts, 48), travertineMat);
  hubPlinth.castShadow = !isSoftwareGl;
  hubPlinth.receiveShadow = true;
  hubGroup.add(hubPlinth);
  explodableParts.push({ object: hubPlinth, baseY: 0, explodeDelta: 0.05 });

  // 3. Brushed brass base collar
  const hubCollar = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.045, 16, 56), brassMat);
  hubCollar.rotation.x = Math.PI / 2;
  hubCollar.position.y = 0.39;
  hubGroup.add(hubCollar);
  explodableParts.push({ object: hubCollar, baseY: 0.39, explodeDelta: 0.35 });

  // 4. Three machined brass structural support fins (beveled ExtrudeGeometry)
  const finGeo = new THREE.ExtrudeGeometry(createFinShape(), {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: 2,
  });
  finGeo.translate(0.32, 0, -0.03);
  const finHolder = new THREE.Group();
  finHolder.position.y = 0.42;
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(finGeo, brassMat);
    fin.rotation.y = (i * Math.PI * 2) / 3;
    fin.castShadow = !isSoftwareGl;
    finHolder.add(fin);
  }
  hubGroup.add(finHolder);
  explodableParts.push({ object: finHolder, baseY: 0.42, explodeDelta: 0.65 });

  // 5. Sculpted walnut architectural arch canopy (beveled ExtrudeGeometry)
  const archGeo = new THREE.ExtrudeGeometry(createArchShape(1.76, 1.95, 0.22), {
    depth: 0.24,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.025,
    bevelSegments: 3,
  });
  archGeo.translate(0, 0, -0.12);
  const archMesh = new THREE.Mesh(archGeo, walnutMat);
  archMesh.position.y = 0.42;
  archMesh.castShadow = !isSoftwareGl;
  archMesh.receiveShadow = true;
  hubGroup.add(archMesh);
  explodableParts.push({ object: archMesh, baseY: 0.42, explodeDelta: 1.05 });

  // 6. Dark bronze core cradle
  const cradleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.44, 0.22, 24), darkBronzeMat);
  cradleMesh.position.y = 0.54;
  hubGroup.add(cradleMesh);
  explodableParts.push({ object: cradleMesh, baseY: 0.54, explodeDelta: 0.5 });

  // 7. Faceted terracotta-amber glass prism core
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0xc85532,
    emissive: 0x6b210b,
    emissiveIntensity: 0.35,
    roughness: 0.14,
    metalness: 0.08,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
    ...(isSoftwareGl
      ? { transparent: true, opacity: 0.88 }
      : { transmission: 0.72, ior: 1.48, thickness: 0.7 }),
  });
  const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), coreMat);
  coreMesh.position.y = 1.24;
  coreMesh.castShadow = !isSoftwareGl;
  hubGroup.add(coreMesh);
  explodableParts.push({ object: coreMesh, baseY: 1.24, explodeDelta: 1.45 });

  // 8. Floating brass equatorial telemetry ring
  const hubOrbitalRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.024, 14, 56), brassMat);
  hubOrbitalRing.position.y = 1.24;
  hubOrbitalRing.rotation.x = Math.PI * 0.36;
  hubGroup.add(hubOrbitalRing);
  explodableParts.push({ object: hubOrbitalRing, baseY: 1.24, explodeDelta: 1.75 });

  // --- Dynamic Lanes & Branches Container ---
  const dynamicGroup = new THREE.Group();
  dynamicGroup.name = 'lanes-dynamic-nodes';
  scene.add(dynamicGroup);

  const clickTargets: THREE.Object3D[] = [];
  const laneVisuals = new Map<string, LaneVisual>();
  const dynamicExplodables: ExplodablePart[] = [];
  const floatingHalos: { mesh: THREE.Mesh; baseY: number; phase: number; isWorking: boolean }[] = [];

  let selectedLaneId: string | null = null;
  let hoveredLaneId: string | null = null;
  let targetExplode = 0;
  let currentExplode = 0;

  function buildDynamicNodes(nodes: SpatialLaneNode[]) {
    disposeObjectTree(dynamicGroup);
    dynamicGroup.clear();
    clickTargets.length = 0;
    laneVisuals.clear();
    dynamicExplodables.length = 0;
    floatingHalos.length = 0;

    const plinthShape = createOctagonShape(0.76);
    const ceramicShape = createOctagonShape(0.46);

    nodes.forEach((node, idx) => {
      const [lx, , lz] = node.position;
      const laneGroup = new THREE.Group();
      laneGroup.position.set(lx, 0, lz);
      laneGroup.rotation.y = -node.angleRad + Math.PI / 2;
      dynamicGroup.add(laneGroup);

      // 1. Ground contact shadow plane
      const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), contactShadowMat);
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.position.y = 0.004;
      laneGroup.add(shadowPlane);

      // 2. Beveled octagonal travertine base plinth
      const plinthGeo = new THREE.ExtrudeGeometry(plinthShape, {
        depth: 0.24,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.04,
        bevelSegments: 2,
      });
      plinthGeo.rotateX(-Math.PI / 2);
      plinthGeo.translate(0, 0.04, 0);
      const plinth = new THREE.Mesh(plinthGeo, travertineMat);
      plinth.castShadow = !isSoftwareGl;
      plinth.receiveShadow = true;
      laneGroup.add(plinth);
      dynamicExplodables.push({ object: plinth, baseY: 0, explodeDelta: 0.06 });

      // 3. Tapered walnut column (LatheGeometry)
      const colH = node.columnHeight;
      const colPts = [
        new THREE.Vector2(0.01, 0),
        new THREE.Vector2(0.56, 0),
        new THREE.Vector2(0.46, colH * 0.28),
        new THREE.Vector2(0.41, colH * 0.85),
        new THREE.Vector2(0.47, colH),
        new THREE.Vector2(0.01, colH),
      ];
      const column = new THREE.Mesh(new THREE.LatheGeometry(colPts, 32), walnutMat);
      column.position.y = 0.28;
      column.castShadow = !isSoftwareGl;
      column.receiveShadow = true;
      laneGroup.add(column);
      dynamicExplodables.push({ object: column, baseY: 0.28, explodeDelta: 0.45 });

      // 4. Machined brass collar ring
      const collarY = 0.28 + colH;
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.036, 14, 36), brassMat);
      collar.rotation.x = Math.PI / 2;
      collar.position.y = collarY + 0.02;
      laneGroup.add(collar);
      dynamicExplodables.push({ object: collar, baseY: collarY + 0.02, explodeDelta: 0.85 });

      // 5. Glazed ceramic sculpture block (lane color-coded)
      const ceramicMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(node.colorHex),
        emissive: new THREE.Color(node.colorHex),
        emissiveIntensity: 0.08,
        roughness: 0.22,
        metalness: 0.08,
        clearcoat: 0.7,
        clearcoatRoughness: 0.16,
      });
      const capGeo = new THREE.ExtrudeGeometry(ceramicShape, {
        depth: 0.44,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.04,
        bevelSegments: 3,
      });
      capGeo.rotateX(-Math.PI / 2);
      const ceramicCap = new THREE.Mesh(capGeo, ceramicMat);
      ceramicCap.position.y = collarY + 0.09;
      ceramicCap.castShadow = !isSoftwareGl;
      ceramicCap.receiveShadow = true;
      laneGroup.add(ceramicCap);
      dynamicExplodables.push({ object: ceramicCap, baseY: collarY + 0.09, explodeDelta: 1.25 });

      // 6. Vertical brass architectural inlay rib
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.075, colH * 0.78, 0.08), brassMat);
      rib.position.set(0, 0.28 + colH * 0.5, 0.45);
      laneGroup.add(rib);
      dynamicExplodables.push({ object: rib, baseY: 0.28 + colH * 0.5, explodeDelta: 0.65 });

      // 7. Floating status halo crown
      const haloMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(node.statusHex),
        emissive: new THREE.Color(node.statusHex),
        emissiveIntensity: node.status === 'idle' ? 0.12 : 0.42,
        roughness: 0.28,
        metalness: 0.65,
      });
      const haloY = collarY + 0.72;
      const haloMesh = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.028, 12, 36), haloMat);
      haloMesh.rotation.x = Math.PI / 2;
      haloMesh.position.y = haloY;
      laneGroup.add(haloMesh);
      dynamicExplodables.push({ object: haloMesh, baseY: haloY, explodeDelta: 1.65 });
      floatingHalos.push({
        mesh: haloMesh,
        baseY: haloY,
        phase: idx * 1.15,
        isWorking: node.status !== 'idle',
      });

      // Invisible click proxy for reliable raycasting
      const totalH = collarY + 0.9;
      const proxy = new THREE.Mesh(
        new THREE.CylinderGeometry(0.82, 0.85, totalH, 12),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      proxy.position.y = totalH / 2;
      proxy.userData.laneId = node.laneId;
      laneGroup.add(proxy);
      clickTargets.push(proxy);

      laneVisuals.set(node.laneId, {
        laneId: node.laneId,
        group: laneGroup,
        ceramicMat,
        haloMesh,
        basePosition: new THREE.Vector3(lx, 0, lz),
        height: totalH,
      });

      // Arched brass/terracotta conduit from Central Hub to this Lane plinth
      const startPt = new THREE.Vector3(
        Math.cos(node.angleRad) * 1.25,
        0.22,
        Math.sin(node.angleRad) * 1.25
      );
      const midPt = new THREE.Vector3(
        Math.cos(node.angleRad) * (Math.hypot(lx, lz) * 0.52),
        0.09,
        Math.sin(node.angleRad) * (Math.hypot(lx, lz) * 0.52)
      );
      const endPt = new THREE.Vector3(
        lx - Math.cos(node.angleRad) * 0.72,
        0.16,
        lz - Math.sin(node.angleRad) * 0.72
      );
      const hubCurve = new THREE.CatmullRomCurve3([startPt, midPt, endPt]);
      const conduitMat = node.isPrivate ? darkBronzeMat : brassMat;
      const hubTube = new THREE.Mesh(new THREE.TubeGeometry(hubCurve, 24, 0.024, 8, false), conduitMat);
      dynamicGroup.add(hubTube);

      // Branch worker satellites + arched fiber conduits
      node.branches.forEach((br, bIdx) => {
        const [bx, by, bz] = br.position;
        const brGroup = new THREE.Group();
        brGroup.position.set(bx, 0, bz);
        dynamicGroup.add(brGroup);

        // Ground shadow disc
        const brShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), contactShadowMat);
        brShadow.rotation.x = -Math.PI / 2;
        brShadow.position.y = 0.004;
        brGroup.add(brShadow);

        // Turned ceramic/brass satellite beacon (4 parts)
        const brBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.14, 18), travertineMat);
        brBase.position.y = 0.07;
        brGroup.add(brBase);

        const brStem = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, by - 0.14, 12), brassMat);
        brStem.position.y = 0.14 + (by - 0.14) / 2;
        brGroup.add(brStem);

        const brCapMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(br.statusHex),
          emissive: new THREE.Color(br.statusHex),
          emissiveIntensity: br.status === 'needs' || br.status === 'working' ? 0.38 : 0.1,
          roughness: 0.25,
          metalness: 0.2,
        });
        const brHead = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), brCapMat);
        brHead.scale.set(1, 0.75, 1);
        brHead.position.y = by;
        brHead.castShadow = !isSoftwareGl;
        brGroup.add(brHead);
        dynamicExplodables.push({ object: brHead, baseY: by, explodeDelta: 0.7 + bIdx * 0.15 });

        const brCollar = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 10, 24), brassMat);
        brCollar.rotation.x = Math.PI / 2;
        brCollar.position.y = by;
        brGroup.add(brCollar);
        dynamicExplodables.push({ object: brCollar, baseY: by, explodeDelta: 0.7 + bIdx * 0.15 });

        // Arched conduit linking Lane cap to Branch head
        const arcStart = new THREE.Vector3(lx, collarY + 0.25, lz);
        const arcMid = new THREE.Vector3((lx + bx) / 2, Math.max(collarY + 0.55, by + 0.45), (lz + bz) / 2);
        const arcEnd = new THREE.Vector3(bx, by, bz);
        const brCurve = new THREE.CatmullRomCurve3([arcStart, arcMid, arcEnd]);
        const brTubeMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(br.statusHex),
          roughness: 0.35,
          metalness: 0.55,
        });
        const brTube = new THREE.Mesh(new THREE.TubeGeometry(brCurve, 20, 0.014, 8, false), brTubeMat);
        dynamicGroup.add(brTube);
      });
    });

    applySelectionHighlights();
  }

  function applyThemeAndShader(isDark: boolean, shader: ShaderPresetId) {
    currentIsDark = isDark;
    currentShader = shader;
    const bgHex = isDark ? 0x18100d : 0xe8ded1;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, isDark ? 0.026 : 0.021);
    const sheenBoost = shader === 'ceramic-sheen' ? 0.3 : shader === 'clean' ? -0.14 : 0;
    scene.environmentIntensity = Math.max(0.4, (isDark ? 0.72 : 0.88) + sheenBoost);
    renderer.toneMappingExposure = shader === 'warm-glow' ? 1.14 : shader === 'ceramic-sheen' ? 1.09 : 1.04;
    hemiLight.intensity = isDark ? 0.48 : 0.78;
    keyLight.intensity = isDark ? 2.1 : 2.35;
    rimLight.intensity = (isDark ? 0.95 : 0.62) + (shader === 'warm-glow' ? 0.55 : 0);
    travertineMat.color.setHex(isDark ? 0x8e7c71 : 0xf7f1e7);
    travertineMat.roughness = shader === 'ceramic-sheen' ? 0.52 : shader === 'clean' ? 0.92 : 0.84;
    contactShadowMat.opacity = isDark ? 0.54 : 0.46;

    const nextFloorTex = createStudioFloorTexture(isDark, maxAnisotropy, shader);
    floorMat.map = nextFloorTex;
    floorMat.needsUpdate = true;
    floorTex.dispose();
    floorTex = nextFloorTex;
  }

  function applySelectionHighlights() {
    for (const [id, vis] of laneVisuals) {
      const isSelected = id === selectedLaneId;
      const isHovered = id === hoveredLaneId;
      vis.ceramicMat.emissiveIntensity = isSelected ? 0.42 : isHovered ? 0.24 : 0.08;
    }
  }

  applyThemeAndShader(initialIsDark, initialShader);
  buildDynamicNodes(initialNodes);

  // Camera transition state (zero-GC pre-allocated vectors)
  let cameraTransitionActive = false;
  const targetCamPos = new THREE.Vector3(...heroPreset.position);
  const targetLookAt = new THREE.Vector3(...heroPreset.target);

  controls.addEventListener('start', () => {
    cameraTransitionActive = false;
  });

  // Pointer raycasting for click & hover selection
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let pointerDownX = 0;
  let pointerDownY = 0;

  function updatePointerNdc(e: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onPointerDown(e: PointerEvent) {
    pointerDownX = e.clientX;
    pointerDownY = e.clientY;
  }

  function onPointerMove(e: PointerEvent) {
    if (clickTargets.length === 0) return;
    updatePointerNdc(e);
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(clickTargets, false);
    const hitId = (hits[0]?.object.userData.laneId as string | undefined) ?? null;
    if (hitId !== hoveredLaneId) {
      hoveredLaneId = hitId;
      renderer.domElement.style.cursor = hitId ? 'pointer' : 'grab';
      applySelectionHighlights();
      callbacks.onHoverLane?.(hitId);
    }
  }

  function onPointerUp(e: PointerEvent) {
    const dist = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
    if (dist > 6) return; // drag orbit, not a click
    updatePointerNdc(e);
    raycaster.setFromCamera(pointerNdc, camera);
    const hits = raycaster.intersectObjects(clickTargets, false);
    const hitId = (hits[0]?.object.userData.laneId as string | undefined) ?? null;
    selectedLaneId = hitId;
    applySelectionHighlights();
    callbacks.onSelectLane(hitId);
    if (hitId) {
      const vis = laneVisuals.get(hitId);
      if (vis) {
        const dir = vis.basePosition.clone().normalize();
        targetLookAt.set(vis.basePosition.x, vis.height * 0.52, vis.basePosition.z);
        targetCamPos.set(
          vis.basePosition.x + dir.x * 3.8 + 1.4,
          vis.height + 2.3,
          vis.basePosition.z + dir.z * 3.8 + 1.4
        );
        cameraTransitionActive = true;
      }
    }
  }

  renderer.domElement.style.cursor = 'grab';
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerup', onPointerUp);

  // ResizeObserver for crisp resizing across sidebar pin/unpin and 100vw fullscreen toggle
  const resizeObserver = new ResizeObserver(() => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  });
  resizeObserver.observe(container);

  // Animation loop with software WebGL fenceSync pacing
  let disposed = false;
  let rafId = 0;
  let timerId = 0;
  let lastTime = performance.now();
  let elapsed = 0;

  function afterDraw(next: () => void) {
    if (disposed) return;
    if (!isSoftwareGl) {
      rafId = window.requestAnimationFrame(next);
      return;
    }
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync !== 'function') {
      timerId = window.setTimeout(next, 90);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) {
      timerId = window.setTimeout(next, 90);
      return;
    }
    gl.flush();
    const poll = () => {
      if (disposed) {
        gl.deleteSync(sync);
        return;
      }
      const status = gl.clientWaitSync(sync, 0, 0);
      if (status === gl.TIMEOUT_EXPIRED) {
        timerId = window.setTimeout(poll, 16);
      } else {
        gl.deleteSync(sync);
        timerId = window.setTimeout(next, 80);
      }
    };
    timerId = window.setTimeout(poll, 16);
  }

  function tick() {
    if (disposed) return;

    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    elapsed += dt;

    // Gentle living architectural motion
    coreMesh.rotation.y += dt * 0.42;
    hubOrbitalRing.rotation.z += dt * 0.28;
    hubOrbitalRing.rotation.y += dt * 0.16;

    // Smooth exploded-view interpolation
    currentExplode = THREE.MathUtils.damp(currentExplode, targetExplode, 6, dt);
    for (const part of explodableParts) {
      part.object.position.y = part.baseY + part.explodeDelta * currentExplode;
    }
    for (const part of dynamicExplodables) {
      part.object.position.y = part.baseY + part.explodeDelta * currentExplode;
    }

    // Subtle status halo hover float
    for (const h of floatingHalos) {
      const bob = Math.sin(elapsed * (h.isWorking ? 2.1 : 1.1) + h.phase) * (h.isWorking ? 0.055 : 0.025);
      h.mesh.position.y += bob;
      h.mesh.rotation.z = elapsed * (h.isWorking ? 0.55 : 0.18);
    }

    // Smooth damped camera preset transitions
    if (cameraTransitionActive) {
      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamPos.x, 5.2, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamPos.y, 5.2, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamPos.z, 5.2, dt);

      controls.target.x = THREE.MathUtils.damp(controls.target.x, targetLookAt.x, 5.2, dt);
      controls.target.y = THREE.MathUtils.damp(controls.target.y, targetLookAt.y, 5.2, dt);
      controls.target.z = THREE.MathUtils.damp(controls.target.z, targetLookAt.z, 5.2, dt);

      if (
        camera.position.distanceTo(targetCamPos) < 0.04 &&
        controls.target.distanceTo(targetLookAt) < 0.04
      ) {
        cameraTransitionActive = false;
      }
    }

    controls.update();
    renderer.render(scene, camera);
    afterDraw(tick);
  }

  // Kick off render loop
  tick();

  return {
    updateData(nodes: SpatialLaneNode[]) {
      buildDynamicNodes(nodes);
    },
    setTheme(isDark: boolean) {
      applyThemeAndShader(isDark, currentShader);
    },
    setShader(shader: ShaderPresetId) {
      applyThemeAndShader(currentIsDark, shader);
    },
    setCameraPreset(presetId: SpatialCameraPresetId) {
      const preset = SPATIAL_CAMERA_PRESETS[presetId];
      if (!preset) return;
      targetCamPos.set(...preset.position);
      targetLookAt.set(...preset.target);
      cameraTransitionActive = true;
    },
    focusLane(laneId: string | null) {
      selectedLaneId = laneId;
      applySelectionHighlights();
      if (!laneId) {
        const preset = SPATIAL_CAMERA_PRESETS.hero;
        targetCamPos.set(...preset.position);
        targetLookAt.set(...preset.target);
        cameraTransitionActive = true;
        return;
      }
      const vis = laneVisuals.get(laneId);
      if (vis) {
        const dir = vis.basePosition.clone().normalize();
        targetLookAt.set(vis.basePosition.x, vis.height * 0.52, vis.basePosition.z);
        targetCamPos.set(
          vis.basePosition.x + dir.x * 3.8 + 1.4,
          vis.height + 2.3,
          vis.basePosition.z + dir.z * 3.8 + 1.4
        );
        cameraTransitionActive = true;
      }
    },
    setExplode(amount: number) {
      targetExplode = Math.max(0, Math.min(1, amount));
    },
    setAutoRotate(enabled: boolean) {
      controls.autoRotate = enabled;
    },
    dispose() {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      disposeObjectTree(scene);
      travertineTex.map.dispose();
      travertineTex.bumpMap.dispose();
      walnutTex.map.dispose();
      walnutTex.bumpMap.dispose();
      contactShadowTex.dispose();
      floorTex.dispose();
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
