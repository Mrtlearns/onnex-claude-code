import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useZoneRaycast } from '../../../../hooks/useZoneRaycast';
import { createOverlayMaterial } from '../../../../lib/rt/overlay-factory';
import { mapNormToWorld } from '../../../../lib/rt/overlay-factory';
import type { InspectionZone, RenderPrimitive } from '../../../../lib/rt/inspector-types';

interface ZonePatchProps {
  zone: InspectionZone;
  prim: RenderPrimitive;
}

export function ZonePatch({ zone, prim }: ZonePatchProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { registerMesh, unregisterMesh } = useZoneRaycast();

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.userData = zone;
      registerMesh(meshRef.current);
    }
    return () => { if (meshRef.current) unregisterMesh(meshRef.current); };
  }, [zone, registerMesh, unregisterMesh]);

  const x = mapNormToWorld(zone.position.x_normalized, prim, 'x');
  const y = mapNormToWorld(zone.position.y_normalized, prim, 'y');
  const z = mapNormToWorld(zone.position.z_normalized, prim, 'z');

  return (
    <mesh ref={meshRef} position={[x, y, z]} scale={[1, 0.15, 1]}>
      <sphereGeometry args={[1.5, 32, 16]} />
      <primitive object={createOverlayMaterial(zone.severity, { opacity: 0.25 })} attach="material" />
    </mesh>
  );
}
