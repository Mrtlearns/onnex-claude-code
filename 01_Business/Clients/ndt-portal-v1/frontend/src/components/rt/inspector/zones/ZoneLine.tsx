import { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useZoneRaycast } from '../../../../hooks/useZoneRaycast';
import { useInspectorStore } from '../../../../stores/inspector-store';
import { createOverlayMaterial } from '../../../../lib/rt/overlay-factory';
import type { InspectionZone, RenderPrimitive } from '../../../../lib/rt/inspector-types';

interface ZoneLineProps {
  zone: InspectionZone;
  prim: RenderPrimitive;
}

export function ZoneLine({ zone, prim }: ZoneLineProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { registerMesh, unregisterMesh } = useZoneRaycast();
  const thickness = useInspectorStore((s) => s.overlayThickness);

  const geo = useMemo(() => {
    const R       = prim.three_js.params[0] ?? 1;
    const L       = prim.three_js.params[2] ?? 2;
    const angle   = (zone.position.angle_degrees ?? 0) * Math.PI / 180;
    const primPos = prim.three_js.position;
    const points: THREE.Vector3[] = [];
    for (let t = -L / 2; t <= L / 2; t += 0.3) {
      points.push(new THREE.Vector3(
        primPos[0] + Math.cos(angle) * (R + 0.1),
        primPos[1] + t,
        primPos[2] + Math.sin(angle) * (R + 0.1),
      ));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 64, 0.12 * thickness, 8, false);
  }, [zone, prim, thickness]);

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.userData = zone;
      registerMesh(meshRef.current);
    }
    return () => { if (meshRef.current) unregisterMesh(meshRef.current); };
  }, [zone, registerMesh, unregisterMesh]);

  return (
    <mesh ref={meshRef} geometry={geo}>
      <primitive object={createOverlayMaterial(zone.severity)} attach="material" />
    </mesh>
  );
}
