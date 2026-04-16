import { useMemo } from 'react';
import * as THREE from 'three';

interface WireframeOverlayProps {
  group: THREE.Group;
}

export function WireframeOverlay({ group }: WireframeOverlayProps) {
  const lineSegments = useMemo(() => {
    const segments: THREE.LineSegments[] = [];
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const edges = new THREE.EdgesGeometry(child.geometry, 15);
        const mat   = new THREE.LineBasicMaterial({
          color:       0x00d4ff,
          transparent: true,
          opacity:     0.18,
          depthWrite:  false,
        });
        const ls = new THREE.LineSegments(edges, mat);
        ls.position.copy(child.position);
        ls.rotation.copy(child.rotation);
        ls.scale.copy(child.scale);
        segments.push(ls);
      }
    });
    return segments;
  }, [group]);

  return (
    <group>
      {lineSegments.map((ls, i) => (
        <primitive key={i} object={ls} />
      ))}
    </group>
  );
}
