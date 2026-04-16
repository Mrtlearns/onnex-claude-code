import { useInspectorStore } from '../../../stores/inspector-store';
import { NDT_COLORS } from '../../../tokens/colors';
import { NDT_TYPE } from '../../../tokens/typography';
import type { PartClassification, RTAnalysis } from '../../../lib/rt/inspector-types';

interface TopBarProps {
  classification: PartClassification;
  analysis:       RTAnalysis;
}

export function TopBar({ classification, analysis }: TopBarProps) {
  const criticalCount = analysis.inspection_zones.filter((z) => z.severity === 'CRITICAL').length;
  const store       = useInspectorStore();
  const isDark = store.theme === 'dark';

  const btnStyle: React.CSSProperties = {
    background: 'none',
    border: `1px solid ${isDark ? NDT_COLORS.border : 'rgba(0,0,0,0.15)'}`,
    borderRadius: 6,
    color: isDark ? NDT_COLORS.textDim : '#606880',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.05em',
    height: 30,
    minWidth: 30,
    padding: '0 8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'border-color 0.15s, color 0.15s',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: 56,
        zIndex: 100,
        background: isDark ? 'rgba(10, 12, 16, 0.92)' : 'rgba(240, 243, 250, 0.94)',
        borderBottom: `1px solid ${isDark ? NDT_COLORS.border : 'rgba(0,0,0,0.1)'}`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 16,
        fontFamily: NDT_TYPE.fontFamily,
      }}
    >
      {/* Logo */}
      <div style={{ fontSize: NDT_TYPE.sm, fontWeight: NDT_TYPE.bold, color: NDT_COLORS.accent, letterSpacing: NDT_TYPE.label, textTransform: 'uppercase' }}>
        NDT Vessel Inspector
      </div>

      <div style={{ width: 1, height: 24, background: isDark ? NDT_COLORS.border : 'rgba(0,0,0,0.15)' }} />

      {/* Part ID */}
      <div style={{ fontSize: NDT_TYPE.md, fontWeight: NDT_TYPE.semibold, color: isDark ? NDT_COLORS.textBright : '#0A0C10' }}>
        {classification.part_id}
      </div>

      {/* Code */}
      <div style={{ fontSize: NDT_TYPE.sm, color: isDark ? NDT_COLORS.textDim : '#606880' }}>
        {classification.applicable_codes.primary}
      </div>

      <div style={{ flex: 1 }} />

      {/* Module used */}
      <div style={{ fontSize: NDT_TYPE.sm, color: isDark ? NDT_COLORS.textDim : '#606880' }}>
        {analysis.analysis_module_used.replace(/_/g, ' ').toUpperCase()}
      </div>

      {/* Critical count badge */}
      {criticalCount > 0 && (
        <div
          style={{
            background: NDT_COLORS.critical,
            color: '#000',
            fontSize: NDT_TYPE.xs,
            fontWeight: NDT_TYPE.bold,
            padding: '2px 10px',
            borderRadius: 3,
            letterSpacing: NDT_TYPE.label,
            textTransform: 'uppercase',
          }}
        >
          {criticalCount} CRITICAL
        </div>
      )}

      {/* Export buttons */}
      <button onClick={() => store.exportPng?.()} title="Export PNG snapshot" style={btnStyle}>
        PNG
      </button>
      <button onClick={() => store.exportStl?.()} title="Export STL geometry" style={btnStyle}>
        STL
      </button>
      <button onClick={store.toggleStlViewer} title="Open clean part viewer" style={btnStyle}>
        3D
      </button>

      {/* Theme toggle */}
      <button
        onClick={store.toggleTheme}
        title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        style={{ ...btnStyle, fontSize: 14 }}
      >
        {isDark ? '☀' : '☽'}
      </button>
    </div>
  );
}
