import { useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useInspectorStore } from '../stores/inspector-store';
import type { InspectionZone } from '../lib/rt/inspector-types';

export function useZoneRaycast() {
  const { camera, gl } = useThree();
  const raycaster  = useRef(new THREE.Raycaster());
  const mouse      = useRef(new THREE.Vector2());
  const frameCount = useRef(0);
  const meshes     = useRef<THREE.Mesh[]>([]);
  const setHovered = useInspectorStore((s) => s.setHoveredZone);

  // Zone components call this on mount/unmount to register their mesh
  const registerMesh = useCallback((mesh: THREE.Mesh) => {
    if (!meshes.current.includes(mesh)) {
      meshes.current.push(mesh);
    }
  }, []);

  const unregisterMesh = useCallback((mesh: THREE.Mesh) => {
    meshes.current = meshes.current.filter((m) => m !== mesh);
  }, []);

  // Update mouse from DOM events — called by the parent Canvas wrapper
  const onMouseMove = useCallback((e: MouseEvent) => {
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    mouse.current.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
  }, [gl]);

  // Throttled raycasting — every 3rd frame
  useFrame(() => {
    frameCount.current++;
    if (frameCount.current % 3 !== 0) return;
    if (meshes.current.length === 0) return;

    raycaster.current.setFromCamera(mouse.current, camera);
    const hits = raycaster.current.intersectObjects(meshes.current, false);

    if (hits.length > 0) {
      const zone = hits[0].object.userData as InspectionZone;
      const rect = gl.domElement.getBoundingClientRect();
      const sx   = (mouse.current.x + 1) / 2 * rect.width;
      const sy   = -(mouse.current.y - 1) / 2 * rect.height;
      setHovered(zone, { x: sx, y: sy });
      // eslint-disable-next-line react-hooks/immutability -- R3F requires direct DOM mutation for cursor
      gl.domElement.style.cursor = 'crosshair';
    } else {
      setHovered(null);
      gl.domElement.style.cursor = 'grab';
    }
  });

  return { registerMesh, unregisterMesh, onMouseMove };
}
