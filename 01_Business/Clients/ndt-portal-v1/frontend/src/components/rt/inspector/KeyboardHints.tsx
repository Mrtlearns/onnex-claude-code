import { NDT_COLORS } from '../../../tokens/colors';
import { NDT_TYPE } from '../../../tokens/typography';
import { NDT_LAYOUT } from '../../../tokens/layout';

const HINTS = [
  ['LMB', 'Orbit'],
  ['RMB', 'Pan'],
  ['Scroll', 'Zoom'],
  ['Hover', 'Inspect'],
];

export function KeyboardHints() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: NDT_LAYOUT.instructionsBottom,
        right: NDT_LAYOUT.instructionsRight,
        zIndex: NDT_LAYOUT.zPanels,
        display: 'flex',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {HINTS.map(([key, action]) => (
        <div
          key={key}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: NDT_TYPE.fontFamily,
            fontSize: NDT_TYPE.xs,
            color: NDT_COLORS.textDim,
          }}
        >
          <span
            style={{
              background: NDT_COLORS.bgElevated,
              border: `1px solid ${NDT_COLORS.border}`,
              borderRadius: 3,
              padding: '1px 5px',
              color: NDT_COLORS.text,
            }}
          >
            {key}
          </span>
          <span>{action}</span>
        </div>
      ))}
    </div>
  );
}
