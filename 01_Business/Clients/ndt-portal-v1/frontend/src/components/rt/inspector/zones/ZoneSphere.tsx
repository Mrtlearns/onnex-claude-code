import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useZoneRaycast } from '../../../../hooks/useZoneRaycast';
import { createOverlayMaterial } from '../../../../lib/rt/overlay-factory';
import { mapNormToWorld } from '../../../../lib/rt/overlay-factory';
import type { InspectionZone, RenderPrimitive } from '../../../../lib/rt/inspector-types';

interface ZoneSphereProps {
  zone: InspectionZone;
  prim: RenderPrimitive;
}

export function ZoneSphere({ zone, prim }: ZoneSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.MeshBasicMaterial>(null);
  const { registerMesh, unregisterMesh } = useZoneRaycast();

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.userData = zone;
      registerMesh(meshRef.current);
    }
    return () => { if (meshRef.current) unregisterMesh(meshRef.current); };
  }, [zone, registerMesh, unregisterMesh]);

  // Pulse opacity for CRITICAL spheres
  useFrame(({ clock }) => {
    if (zone.severity === 'CRITICAL' && matRef.current) {
      matRef.current.opacity = 0.7 + 0.2 * Math.sin(clock.getElapsedTime() * 2);
    }
  });

  const mat = createOverlayMaterial(zone.severity);
  // eslint-disable-next-line react-hooks/refs -- R3F imperative pattern
  if (matRef.current) matRef.current.copy(mat);

  const x = mapNormToWorld(zone.position.x_normalized, prim, 'x');
  const y = mapNormToWorld(zone.position.y_normalized, prim, 'y');
  const z = mapNormToWorld(zone.position.z_normalized, prim, 'z');

  return (
    <mesh ref={meshRef} position={[x, y, z]}>
      <sphereGeometry args={[0.35, 16, 16]} />
      <primitive object={mat} ref={matRef} attach="material" />
    </mesh>
  );
}
