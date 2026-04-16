import { useInspectorStore } from '../../../stores/inspector-store';
import { LabelSprite } from './LabelSprite';
import { SEVERITY_MAP } from '../../../tokens/severity';
import { NDT_COLORS } from '../../../tokens/colors';
import type { InspectionZone, RenderPrimitive } from '../../../lib/rt/inspector-types';

interface LabelSpritesProps {
  zones:      InspectionZone[];
  primitives: RenderPrimitive[];
}

export function LabelSprites({ zones, primitives }: LabelSpritesProps) {
  const showLabels = useInspectorStore((s) => s.showLabels);
  if (!showLabels) return null;

  const primMap = new Map(primitives.map((p) => [p.id, p]));

  return (
    <group>
      {/* Zone labels */}
      {zones.map((zone) => {
        const prim = primMap.get(zone.on_primitive);
        if (!prim) return null;

        const config  = SEVERITY_MAP[zone.severity];
        const primPos = prim.three_js.position;
        const R       = (prim.three_js.params[0] ?? 1) + 1.5; // offset outward
        const angle   = ((zone.position.angle_degrees ?? 0) + 90) * Math.PI / 180;
        const height  = prim.three_js.params[2] ?? 2;
        const yOff    = (zone.position.x_normalized - 0.5) * height;

        const labelPos: [number, number, number] = [
          primPos[0] + Math.cos(angle) * R,
          primPos[1] + yOff + 0.5,
          primPos[2] + Math.sin(angle) * R,
        ];

        return (
          <LabelSprite
            key={zone.id}
            text={zone.id}
            position={labelPos}
            color={config.color}
          />
        );
      })}

      {/* Component labels */}
      {primitives.map((prim) => {
        const pos = prim.three_js.position;
        const h   = (prim.three_js.params[2] ?? 2) / 2 + 1.5;
        const labelPos: [number, number, number] = [pos[0], pos[1] - h, pos[2]];
        return (
          <LabelSprite
            key={`comp-${prim.id}`}
            text={prim.id}
            position={labelPos}
            color={NDT_COLORS.textDim}
          />
        );
      })}
    </group>
  );
}
