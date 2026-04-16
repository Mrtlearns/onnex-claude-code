import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildPartFromSpec } from '../../../lib/rt/geometry-factory';
import { WireframeOverlay } from './WireframeOverlay';
import { useInspectorStore } from '../../../stores/inspector-store';
import type { RenderPrimitive } from '../../../lib/rt/inspector-types';

interface PartModelProps {
  primitives: RenderPrimitive[];
}

export function PartModel({ primitives }: PartModelProps) {
  const showWireframe = useInspectorStore((s) => s.showWireframe);
  const groupRef      = useRef<THREE.Group>(null);

  const partGroup = useMemo(
    () => buildPartFromSpec(primitives),
    [primitives],
  );

  // eslint-disable-next-line react-hooks/refs -- R3F imperative pattern
  const groupCurrent = groupRef.current

  return (
    <group ref={groupRef}>
      <primitive object={partGroup} />
      {showWireframe && groupCurrent && (
        <WireframeOverlay group={partGroup} />
      )}
    </group>
  );
}
