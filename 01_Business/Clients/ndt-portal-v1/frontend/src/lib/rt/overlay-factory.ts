import * as THREE from 'three';
import type { InspectionZone, RenderPrimitive, NormalizedPosition } from './inspector-types';
import { SEVERITY_MAP } from '../../tokens/severity';

// ── Material ──────────────────────────────────────────────────────────────────

export function createOverlayMaterial(
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW',
  overrides?: { opacity?: number; color?: number },
): THREE.MeshBasicMaterial {
  const config = SEVERITY_MAP[severity];
  return new THREE.MeshBasicMaterial({
    color:      overrides?.color   ?? config.hex3D,
    transparent: true,
    opacity:    overrides?.opacity ?? config.opacity,
    depthWrite: false,
    side:       THREE.DoubleSide,
  });
}

// ── Coord mapping ─────────────────────────────────────────────────────────────

function getPrimBounds(prim: RenderPrimitive): { min: THREE.Vector3; max: THREE.Vector3; center: THREE.Vector3 } {
  const pos    = new THREE.Vector3(...prim.three_js.position);
  const params = prim.three_js.params;
  // Rough bounding estimate from geometry params
  const r = (params[0] ?? 1);
  const h = (params[2] ?? 2);
  return {
    min:    new THREE.Vector3(pos.x - r, pos.y - h / 2, pos.z - r),
    max:    new THREE.Vector3(pos.x + r, pos.y + h / 2, pos.z + r),
    center: pos.clone(),
  };
}

export function mapNormToWorld(
  norm:    number,
  prim:    RenderPrimitive,
  axis:    'x' | 'y' | 'z',
): number {
  const bounds  = getPrimBounds(prim);
  const min     = bounds.min[axis];
  const max     = bounds.max[axis];
  return min + norm * (max - min);
}

// ── Zone position helpers ─────────────────────────────────────────────────────

function zoneWorldPos(pos: NormalizedPosition, prim: RenderPrimitive): THREE.Vector3 {
  return new THREE.Vector3(
    mapNormToWorld(pos.x_normalized, prim, 'x'),
    mapNormToWorld(pos.y_normalized, prim, 'y'),
    mapNormToWorld(pos.z_normalized, prim, 'z'),
  );
}

// ── Overlay geometry builders ─────────────────────────────────────────────────

function buildRing(zone: InspectionZone, prim: RenderPrimitive): THREE.Mesh {
  const R     = prim.three_js.params[0] ?? 1;
  const geo   = new THREE.TorusGeometry(R + 0.12, 0.1, 8, 128);
  // Rotate so torus is perpendicular to the cylinder's Y axis
  geo.rotateX(Math.PI / 2);
  const mesh  = new THREE.Mesh(geo, createOverlayMaterial(zone.severity));
  // Position along the cylinder's Y axis using x_normalized
  const height = prim.three_js.params[2] ?? 2;
  mesh.position.copy(new THREE.Vector3(...prim.three_js.position));
  mesh.position.y += (zone.position.x_normalized - 0.5) * height;
  return mesh;
}

function buildLine(zone: InspectionZone, prim: RenderPrimitive): THREE.Mesh {
  const R          = prim.three_js.params[0] ?? 1;
  const L          = prim.three_js.params[2] ?? 2;
  const angle      = ((zone.position.angle_degrees ?? 0)) * Math.PI / 180;
  const primPos    = new THREE.Vector3(...prim.three_js.position);
  const points: THREE.Vector3[] = [];

  for (let t = -L / 2; t <= L / 2; t += 0.3) {
    points.push(new THREE.Vector3(
      primPos.x + Math.cos(angle) * (R + 0.1),
      primPos.y + t,
      primPos.z + Math.sin(angle) * (R + 0.1),
    ));
  }

  const curve  = new THREE.CatmullRomCurve3(points);
  const geo    = new THREE.TubeGeometry(curve, 64, 0.12, 8, false);
  return new THREE.Mesh(geo, createOverlayMaterial(zone.severity));
}

function buildPatch(zone: InspectionZone, prim: RenderPrimitive): THREE.Mesh {
  const geo  = new THREE.SphereGeometry(1.5, 32, 16);
  const mesh = new THREE.Mesh(geo, createOverlayMaterial(zone.severity, { opacity: 0.25 }));
  mesh.position.copy(zoneWorldPos(zone.position, prim));
  mesh.scale.y = 0.15; // flatten to surface
  return mesh;
}

function buildSphere(zone: InspectionZone, prim: RenderPrimitive): THREE.Mesh {
  const geo  = new THREE.SphereGeometry(0.35, 16, 16);
  const mesh = new THREE.Mesh(geo, createOverlayMaterial(zone.severity));
  mesh.position.copy(zoneWorldPos(zone.position, prim));
  return mesh;
}

function buildArc(zone: InspectionZone, prim: RenderPrimitive): THREE.Mesh {
  const R         = prim.three_js.params[0] ?? 1;
  const span      = ((zone.position.span_degrees ?? 180)) * Math.PI / 180;
  const startAngle= ((zone.position.angle_degrees ?? 0))  * Math.PI / 180;
  const geo       = new THREE.TorusGeometry(R + 0.12, 0.1, 8, 64, span);
  geo.rotateX(Math.PI / 2);
  geo.rotateY(startAngle);
  const mesh = new THREE.Mesh(geo, createOverlayMaterial(zone.severity));
  mesh.position.copy(new THREE.Vector3(...prim.three_js.position));
  // Position along Y axis
  const height = prim.three_js.params[2] ?? 2;
  mesh.position.y += (zone.position.x_normalized - 0.5) * height;
  return mesh;
}

const OVERLAY_BUILDERS: Record<string, (z: InspectionZone, p: RenderPrimitive) => THREE.Mesh> = {
  ring:   buildRing,
  line:   buildLine,
  patch:  buildPatch,
  sphere: buildSphere,
  arc:    buildArc,
};

// ── Main factory ──────────────────────────────────────────────────────────────

export function buildOverlays(
  zones:      InspectionZone[],
  primitives: RenderPrimitive[],
): THREE.Mesh[] {
  const primMap = new Map(primitives.map(p => [p.id, p]));
  const meshes: THREE.Mesh[] = [];

  for (const zone of zones) {
    const prim = primMap.get(zone.on_primitive);
    if (!prim) {
      console.warn(`[overlay-factory] Zone ${zone.id}: unknown primitive ${zone.on_primitive}`);
      continue;
    }

    const builder = OVERLAY_BUILDERS[zone.geometry_type];
    if (!builder) {
      console.warn(`[overlay-factory] Unknown geometry_type: ${zone.geometry_type}`);
      continue;
    }

    try {
      const mesh       = builder(zone, prim);
      mesh.userData    = zone;          // Full zone data for raycaster
      mesh.renderOrder = 1;             // Render overlays on top
      meshes.push(mesh);
    } catch (e) {
      console.warn(`[overlay-factory] Failed to build zone ${zone.id}:`, e);
    }
  }

  return meshes;
}
