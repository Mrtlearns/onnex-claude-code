import * as THREE from 'three';
import type { RenderPrimitive } from './inspector-types';
import { NDT_COLORS } from '../../tokens/colors';

// ── Geometry map ──────────────────────────────────────────────────────────────

type GeometryFactory = (...args: number[]) => THREE.BufferGeometry;

const GEOMETRY_MAP: Record<string, GeometryFactory> = {
  CylinderGeometry: (rT, rB, h, s) =>
    new THREE.CylinderGeometry(rT, rB, h, s || 64),

  SphereGeometry: (r, ws, hs, ps, pl, ts, tl) =>
    new THREE.SphereGeometry(r, ws || 64, hs || 32, ps || 0, pl ?? Math.PI * 2, ts || 0, tl ?? Math.PI),

  TorusGeometry: (r, t, rs, ts, a) =>
    new THREE.TorusGeometry(r, t, rs || 16, ts || 64, a ?? Math.PI * 2),

  BoxGeometry: (w, h, d) =>
    new THREE.BoxGeometry(w, h, d),

  ConeGeometry: (r, h, s) =>
    new THREE.ConeGeometry(r, h, s || 64),

  // LatheGeometry: params are flat [x0,y0, x1,y1, ...] point pairs + optional segments
  LatheGeometry: (...args) => {
    const segments = Number.isInteger(args[args.length - 1]) && args.length % 2 !== 0
      ? args[args.length - 1]
      : 32;
    const pointArgs = args.length % 2 !== 0 ? args.slice(0, -1) : args;
    const points: THREE.Vector2[] = [];
    for (let i = 0; i < pointArgs.length - 1; i += 2) {
      points.push(new THREE.Vector2(pointArgs[i], pointArgs[i + 1]));
    }
    if (points.length < 2) {
      // Fallback to unit cylinder if invalid points
      return new THREE.CylinderGeometry(1, 1, 2, 32);
    }
    return new THREE.LatheGeometry(points, segments);
  },

  // ExtrudeGeometry: params are flat [x0,y0, x1,y1, ...] shape points + depth
  ExtrudeGeometry: (...args) => {
    const depth      = args[args.length - 1] ?? 1;
    const pointArgs  = args.slice(0, -1);
    const shape      = new THREE.Shape();
    if (pointArgs.length >= 2) {
      shape.moveTo(pointArgs[0], pointArgs[1]);
      for (let i = 2; i < pointArgs.length - 1; i += 2) {
        shape.lineTo(pointArgs[i], pointArgs[i + 1]);
      }
      shape.closePath();
    } else {
      // Fallback square
      shape.moveTo(-0.5, -0.5);
      shape.lineTo( 0.5, -0.5);
      shape.lineTo( 0.5,  0.5);
      shape.lineTo(-0.5,  0.5);
      shape.closePath();
    }
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  },
};

// ── Material presets ──────────────────────────────────────────────────────────

const PART_MATERIALS = {
  primary: {
    color:     NDT_COLORS.meshPrimary,
    opacity:   0.78,
    metalness: 0.3,
    roughness: 0.7,
  },
  secondary: {
    color:     NDT_COLORS.meshSecondary,
    opacity:   0.80,
    metalness: 0.4,
    roughness: 0.6,
  },
  heavy: {
    color:     NDT_COLORS.meshHeavy,
    opacity:   0.85,
    metalness: 0.6,
    roughness: 0.4,
  },
} as const;

// Allowed color range (blue-gray band): hue 200–240, lightness 20–55%
function isAllowedColor(hex: string): boolean {
  const num = parseInt(hex.replace('#', ''), 16);
  const r   = (num >> 16) & 0xff;
  const g   = (num >> 8)  & 0xff;
  const b   =  num        & 0xff;
  // Blue-gray: b dominant, all values in dark-to-mid range
  return b > r && b > g && r > 0x10 && r < 0x80;
}

export function resolvePartMaterial(
  llmHint: { color: string; opacity: number; metalness: number },
  role: 'primary' | 'secondary' | 'heavy' = 'primary',
): THREE.MeshPhongMaterialParameters {
  const preset = PART_MATERIALS[role];
  // Floor opacity at 0.65 — LLM hints below that make parts invisible on dark backgrounds
  const rawOpacity = llmHint.opacity > 0 ? llmHint.opacity : preset.opacity;
  return {
    color:       isAllowedColor(llmHint.color) ? llmHint.color : preset.color,
    opacity:     Math.max(rawOpacity, 0.65),
    specular:    NDT_COLORS.meshSpecular,
    shininess:   40,
    transparent: true,
    side:        THREE.DoubleSide,
    depthWrite:  false,
  };
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function buildPartFromSpec(primitives: RenderPrimitive[]): THREE.Group {
  const group = new THREE.Group();

  for (const prim of primitives) {
    const factory = GEOMETRY_MAP[prim.three_js.geometry];
    if (!factory) {
      console.warn(`[geometry-factory] Unknown geometry: ${prim.three_js.geometry} — skipping`);
      continue;
    }

    let geo: THREE.BufferGeometry;
    try {
      geo = factory(...prim.three_js.params);
    } catch (e) {
      console.warn(`[geometry-factory] Failed to build ${prim.id}:`, e);
      continue;
    }

    const mat = new THREE.MeshPhongMaterial(
      resolvePartMaterial(prim.material_appearance, 'primary'),
    );

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.fromArray(prim.three_js.position);
    mesh.rotation.set(
      prim.three_js.rotation[0] * Math.PI / 180,
      prim.three_js.rotation[1] * Math.PI / 180,
      prim.three_js.rotation[2] * Math.PI / 180,
    );
    mesh.scale.fromArray(prim.three_js.scale);
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    mesh.userData      = { primitiveId: prim.id };

    group.add(mesh);
  }

  return group;
}
