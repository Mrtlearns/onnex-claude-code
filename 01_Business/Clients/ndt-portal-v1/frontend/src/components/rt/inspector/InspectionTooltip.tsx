import { useInspectorStore } from '../../../stores/inspector-store';
import { SEVERITY_MAP } from '../../../tokens/severity';
import { NDT_COLORS } from '../../../tokens/colors';
import { NDT_TYPE } from '../../../tokens/typography';

const TOOLTIP_W = 260;
const TOOLTIP_H = 220;

export function InspectionTooltip() {
  const zone   = useInspectorStore((s) => s.hoveredZone);
  const cursor = useInspectorStore((s) => s.cursorPosition);

  if (!zone || !cursor) return null;

  const severity = SEVERITY_MAP[zone.severity];

  // Viewport clamping
  let left = cursor.x + 16;
  let top  = cursor.y - 10;
  if (left + TOOLTIP_W > window.innerWidth)  left = cursor.x - TOOLTIP_W - 16;
  if (top  + TOOLTIP_H > window.innerHeight) top  = cursor.y - TOOLTIP_H - 10;

  return (
    <div
      style={{
        position: 'fixed',
        left,
        top,
        zIndex: 200,
        background: 'rgba(10, 12, 16, 0.95)',
        border: `1px solid ${NDT_COLORS.accent}`,
        borderRadius: 6,
        padding: '10px 14px',
        maxWidth: TOOLTIP_W,
        pointerEvents: 'none',
        boxShadow: '0 0 20px rgba(0, 212, 255, 0.15)',
        fontFamily: NDT_TYPE.fontFamily,
      }}
    >
      {/* Zone ID */}
      <div style={{ fontSize: NDT_TYPE.base, fontWeight: NDT_TYPE.semibold, color: NDT_COLORS.accent, marginBottom: 4 }}>
        {zone.id}
      </div>

      {/* Tooltip text from LLM */}
      <div style={{ fontSize: NDT_TYPE.sm, color: NDT_COLORS.text, lineHeight: 1.5 }}>
        {zone.tooltip_text}
      </div>

      {/* Expected defects (first 3) */}
      {zone.expected_defects?.slice(0, 3).map((d, i) => (
        <div key={i} style={{ fontSize: NDT_TYPE.xs, color: NDT_COLORS.textDim, marginTop: 2 }}>
          • {d.type} ({d.probability}) — {d.code_reference}
        </div>
      ))}

      {/* Severity badge */}
      <div
        style={{
          display: 'inline-block',
          fontSize: NDT_TYPE.xs,
          fontWeight: NDT_TYPE.bold,
          padding: '2px 8px',
          borderRadius: 3,
          marginTop: 6,
          letterSpacing: NDT_TYPE.label,
          textTransform: 'uppercase',
          background: severity.color,
          color: '#000',
        }}
      >
        {zone.severity}
      </div>

      {/* RT Technique */}
      {zone.rt_technique && (
        <div
          style={{
            fontSize: NDT_TYPE.xs,
            color: NDT_COLORS.textDim,
            marginTop: 6,
            borderTop: `1px solid ${NDT_COLORS.border}`,
            paddingTop: 4,
          }}
        >
          RT: {zone.rt_technique.technique} | {zone.rt_technique.source} | IQI: {zone.rt_technique.iqi_placement}
        </div>
      )}
    </div>
  );
}
