import { useInspectorStore } from '../../../stores/inspector-store';
import { SEVERITY_MAP } from '../../../tokens/severity';
import { ZoneRing }   from './zones/ZoneRing';
import { ZoneLine }   from './zones/ZoneLine';
import { ZonePatch }  from './zones/ZonePatch';
import { ZoneSphere } from './zones/ZoneSphere';
import { ZoneArc }    from './zones/ZoneArc';
import { PulseRing }  from './zones/PulseRing';
import type { InspectionZone, RenderPrimitive } from '../../../lib/rt/inspector-types';

const ZONE_COMPONENTS: Record<string, React.ComponentType<{ zone: InspectionZone; prim: RenderPrimitive }>> = {
  ring:   ZoneRing,
  line:   ZoneLine,
  patch:  ZonePatch,
  sphere: ZoneSphere,
  arc:    ZoneArc,
};

interface InspectionOverlayProps {
  zones:      InspectionZone[];
  primitives: RenderPrimitive[];
}

export function InspectionOverlay({ zones, primitives }: InspectionOverlayProps) {
  const showCritical = useInspectorStore((s) => s.showCritical);
  const showHigh     = useInspectorStore((s) => s.showHigh);
  const showMedium   = useInspectorStore((s) => s.showMedium);
  const showLow      = useInspectorStore((s) => s.showLow);

  const severityVisible: Record<string, boolean> = {
    CRITICAL: showCritical,
    HIGH:     showHigh,
    MEDIUM:   showMedium,
    LOW:      showLow,
  };

  const primMap = new Map(primitives.map((p) => [p.id, p]));

  const visibleZones = zones.filter((z) => severityVisible[z.severity]);

  return (
    <group>
      {visibleZones.map((zone) => {
        const prim = primMap.get(zone.on_primitive);
        if (!prim) return null;

        const ZoneComp = ZONE_COMPONENTS[zone.geometry_type];
        if (!ZoneComp) return null;

        const config = SEVERITY_MAP[zone.severity];

        return (
          <group key={zone.id}>
            <ZoneComp zone={zone} prim={prim} />
            {/* Pulse ring for CRITICAL point features */}
            {zone.severity === 'CRITICAL' && config.glowRing && zone.geometry_type === 'sphere' && (
              <PulseRing
                position={[
                  prim.three_js.position[0],
                  prim.three_js.position[1],
                  prim.three_js.position[2],
                ]}
                radius={0.35}
                // eslint-disable-next-line react-hooks/purity -- R3F animation seed
                phase={Math.random() * Math.PI * 2}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}
