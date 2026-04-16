import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useZoneRaycast } from '../../../../hooks/useZoneRaycast';
import { useInspectorStore } from '../../../../stores/inspector-store';
import { createOverlayMaterial } from '../../../../lib/rt/overlay-factory';
import type { InspectionZone, RenderPrimitive } from '../../../../lib/rt/inspector-types';

interface ZoneArcProps {
  zone: InspectionZone;
  prim: RenderPrimitive;
}

export function ZoneArc({ zone, prim }: ZoneArcProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { registerMesh, unregisterMesh } = useZoneRaycast();
  const t = useInspectorStore((s) => s.overlayThickness);

  const R          = prim.three_js.params[0] ?? 1;
  const height     = prim.three_js.params[2] ?? 2;
  const span       = ((zone.position.span_degrees ?? 180)) * Math.PI / 180;
  const startAngle = ((zone.position.angle_degrees ?? 0)) * Math.PI / 180;
  const yOff       = (zone.position.x_normalized - 0.5) * height;
  const primPos    = prim.three_js.position;

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.userData = zone;
      registerMesh(meshRef.current);
    }
    return () => { if (meshRef.current) unregisterMesh(meshRef.current); };
  }, [zone, registerMesh, unregisterMesh]);

  return (
    <mesh
      ref={meshRef}
      position={[primPos[0], primPos[1] + yOff, primPos[2]]}
      rotation={[Math.PI / 2, startAngle, 0]}
    >
      <torusGeometry args={[R + 0.12, 0.1 * t, 8, 64, span]} />
      <primitive object={createOverlayMaterial(zone.severity)} attach="material" />
    </mesh>
  );
}
