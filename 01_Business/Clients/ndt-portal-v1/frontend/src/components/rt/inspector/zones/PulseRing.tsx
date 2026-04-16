import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PulseRingProps {
  position: [number, number, number];
  radius:   number;
  phase?:   number;
}

export function PulseRing({ position, radius, phase = 0 }: PulseRingProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      const scale = 1 + 0.3 * Math.sin(t * 3 + phase);
      meshRef.current.scale.set(scale, scale, scale);
    }
    if (matRef.current) {
      matRef.current.opacity = 0.2 + 0.2 * Math.sin(t * 3 + phase);
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <torusGeometry args={[radius + 0.15, 0.04, 8, 32]} />
      <meshBasicMaterial ref={matRef} color={0xff1744} transparent opacity={0.4} depthWrite={false} />
    </mesh>
  );
}
