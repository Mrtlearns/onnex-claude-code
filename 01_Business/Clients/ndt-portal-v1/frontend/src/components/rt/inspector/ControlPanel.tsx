import { useEffect } from 'react';
import { useInspectorStore } from '../../../stores/inspector-store';
import type { MachineProfile } from '../../../stores/inspector-store';
import { SEVERITY_MAP } from '../../../tokens/severity';
import { NDT_COLORS } from '../../../tokens/colors';
import { NDT_TYPE } from '../../../tokens/typography';
import { NDT_LAYOUT } from '../../../tokens/layout';
import type { RTAnalysis } from '../../../lib/rt/inspector-types';

// ── Theme-aware tokens ────────────────────────────────────────────────────────

function useTC() {
  const theme = useInspectorStore((s) => s.theme);
  const isDark = theme === 'dark';
  return {
    isDark,
    panelBg:      isDark ? NDT_LAYOUT.panelBg         : 'rgba(255, 255, 255, 0.94)',
    panelBorder:  isDark ? NDT_LAYOUT.panelBorder      : '1px solid rgba(0, 0, 0, 0.10)',
    text:         isDark ? NDT_COLORS.text             : '#1A2030',
    textDim:      isDark ? NDT_COLORS.textDim          : '#607080',
    textBright:   isDark ? NDT_COLORS.textBright       : '#0A0C10',
    border:       isDark ? NDT_COLORS.border           : 'rgba(0, 0, 0, 0.12)',
    borderSubtle: isDark ? NDT_COLORS.borderSubtle     : 'rgba(0, 0, 0, 0.06)',
    toggleOff:    isDark ? '#2A2E3A'                   : '#D0D5E0',
    toggleThumb:  isDark ? '#555'                      : '#A0A8B8',
  };
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  checked:     boolean;
  onChange:    () => void;
  accentColor?: string;
  tc:          ReturnType<typeof useTC>;
}

function ToggleSwitch({ checked, onChange, accentColor, tc }: ToggleSwitchProps) {
  return (
    <div
      onClick={onChange}
      style={{
        width: 36, height: 20,
        borderRadius: 10,
        background: checked ? (accentColor ?? NDT_COLORS.accent) : tc.toggleOff,
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s ease',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 3, left: checked ? 19 : 3,
          width: 14, height: 14,
          borderRadius: '50%',
          background: checked ? '#fff' : tc.toggleThumb,
          transition: 'left 0.2s ease',
        }}
      />
    </div>
  );
}

// ── Panel section header ──────────────────────────────────────────────────────

function SectionHeader({ label, tc }: { label: string; tc: ReturnType<typeof useTC> }) {
  return (
    <div
      style={{
        fontSize: NDT_TYPE.xs,
        fontWeight: NDT_TYPE.semibold,
        letterSpacing: NDT_TYPE.label,
        color: tc.textDim,
        textTransform: 'uppercase',
        marginBottom: 8,
        paddingBottom: 4,
        borderBottom: `1px solid ${tc.border}`,
      }}
    >
      {label}
    </div>
  );
}

// ── Toggle row ────────────────────────────────────────────────────────────────

interface ToggleRowProps {
  dotColor: string;
  label:    string;
  checked:  boolean;
  onChange: () => void;
  tc:       ReturnType<typeof useTC>;
}

function ToggleRow({ dotColor, label, checked, onChange, tc }: ToggleRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 0',
        fontFamily: NDT_TYPE.fontFamily,
        fontSize: NDT_TYPE.base,
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      <span style={{ flex: 1, color: tc.text }}>{label}</span>
      <ToggleSwitch checked={checked} onChange={onChange} accentColor={dotColor} tc={tc} />
    </div>
  );
}

// ── Shot Plan ─────────────────────────────────────────────────────────────────

function ShotPlanPanel({ analysis, tc }: { analysis: RTAnalysis; tc: ReturnType<typeof useTC> }) {
  const sp = analysis.shot_plan;
  if (!sp) return null;

  const zones = analysis.inspection_zones ?? [];

  return (
    <div
      style={{
        background:   tc.panelBg,
        border:       tc.panelBorder,
        borderRadius: NDT_LAYOUT.panelBorderRadius,
        padding:      NDT_LAYOUT.panelPadding,
        backdropFilter: `blur(${NDT_LAYOUT.panelBackdropBlur})`,
        WebkitBackdropFilter: `blur(${NDT_LAYOUT.panelBackdropBlur})`,
        fontFamily:   NDT_TYPE.fontFamily,
      }}
    >
      <SectionHeader label="Shot Plan" tc={tc} />

      {/* Per-zone shots */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {zones.map((zone, idx) => {
          const tech = zone.rt_technique;
          return (
            <div
              key={zone.id}
              style={{
                paddingBottom: idx < zones.length - 1 ? 8 : 0,
                borderBottom: idx < zones.length - 1 ? `1px solid ${tc.borderSubtle}` : 'none',
              }}
            >
              <div style={{ fontSize: NDT_TYPE.sm, fontWeight: NDT_TYPE.semibold, color: tc.textBright, marginBottom: 2 }}>
                Shot {idx + 1}: {zone.type}
                <span style={{ fontWeight: NDT_TYPE.regular, color: tc.textDim, marginLeft: 4 }}>({zone.id})</span>
              </div>
              <div style={{ fontSize: NDT_TYPE.xs, color: tc.textDim, lineHeight: 1.6 }}>
                {tech.source}
                {tech.technique && ` · ${tech.technique}`}
                {tech.sfd_inches != null && ` · SFD ${tech.sfd_inches}"`}
                {tech.detector && ` · ${tech.detector}`}
              </div>
              {tech.notes && (
                <div style={{ fontSize: NDT_TYPE.xs, color: tc.textDim, fontStyle: 'italic', marginTop: 2 }}>
                  {tech.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary row */}
      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: `1px solid ${tc.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          fontSize: NDT_TYPE.xs,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: tc.textDim }}>Recommended Source</span>
          <span style={{ color: tc.text, textAlign: 'right', maxWidth: 140 }}>{sp.source_recommendation}</span>
        </div>
        {sp.coverage_strategy && (
          <div style={{ color: tc.textDim, marginTop: 2, lineHeight: 1.5 }}>
            {sp.coverage_strategy}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
          <span style={{ color: tc.textDim }}>Film Sheets</span>
          <span style={{ color: tc.text }}>{sp.estimated_film_count}</span>
        </div>
        {sp.special_techniques && sp.special_techniques.length > 0 && (
          <div style={{ color: NDT_COLORS.warning, marginTop: 2 }}>
            ⚠ {sp.special_techniques.join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Machine View ─────────────────────────────────────────────────────────────

function MachineViewPanel({ tc }: { tc: ReturnType<typeof useTC> }) {
  const store = useInspectorStore();

  useEffect(() => {
    store.loadMachines();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const options: Array<{ id: string | null; label: string; sub?: string }> = [
    { id: null, label: 'None' },
    ...store.machineProfiles.map((m: MachineProfile) => ({
      id:    m.machine_id,
      label: `${m.machine_id} — ${m.nickname}`,
      sub:   `${m.spec.inspection_envelope.max_part_diameter_mm}mm ⌀ × ${m.spec.inspection_envelope.max_part_height_mm}mm H`,
    })),
  ];

  return (
    <div
      style={{
        background:   tc.panelBg,
        border:       tc.panelBorder,
        borderRadius: NDT_LAYOUT.panelBorderRadius,
        padding:      NDT_LAYOUT.panelPadding,
        backdropFilter: `blur(${NDT_LAYOUT.panelBackdropBlur})`,
        WebkitBackdropFilter: `blur(${NDT_LAYOUT.panelBackdropBlur})`,
        fontFamily:   NDT_TYPE.fontFamily,
      }}
    >
      <SectionHeader label="Machine View" tc={tc} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {options.map((opt) => {
          const selected = store.selectedMachineId === opt.id;
          return (
            <div
              key={String(opt.id)}
              onClick={() => store.selectMachine(opt.id)}
              style={{
                display:       'flex',
                alignItems:    'flex-start',
                gap:           8,
                padding:       '5px 4px',
                cursor:        'pointer',
                borderRadius:  4,
                background:    selected ? 'rgba(0,204,255,0.08)' : 'transparent',
              }}
            >
              {/* Radio dot */}
              <div
                style={{
                  width:        14,
                  height:       14,
                  borderRadius: '50%',
                  border:       `2px solid ${selected ? '#00CCFF' : tc.border}`,
                  flexShrink:   0,
                  marginTop:    2,
                  background:   selected ? '#00CCFF' : 'transparent',
                  transition:   'all 0.15s ease',
                }}
              />
              <div>
                <div style={{ fontSize: NDT_TYPE.sm, color: tc.text }}>{opt.label}</div>
                {opt.sub && (
                  <div style={{ fontSize: NDT_TYPE.xs, color: tc.textDim, marginTop: 1 }}>
                    {opt.sub}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ControlPanel ─────────────────────────────────────────────────────────

interface ControlPanelProps {
  analysis: RTAnalysis;
}

export function ControlPanel({ analysis }: ControlPanelProps) {
  const store = useInspectorStore();
  const tc = useTC();

  const panelStyle: React.CSSProperties = {
    background:   tc.panelBg,
    border:       tc.panelBorder,
    borderRadius: NDT_LAYOUT.panelBorderRadius,
    padding:      NDT_LAYOUT.panelPadding,
    backdropFilter: `blur(${NDT_LAYOUT.panelBackdropBlur})`,
    WebkitBackdropFilter: `blur(${NDT_LAYOUT.panelBackdropBlur})`,
    fontFamily:   NDT_TYPE.fontFamily,
  };

  return (
    <div
      style={{
        position: 'fixed',
        top:   NDT_LAYOUT.controlsTop,
        right: NDT_LAYOUT.controlsRight,
        bottom: 16,
        zIndex: NDT_LAYOUT.zPanels,
        display: 'flex',
        flexDirection: 'column',
        gap: NDT_LAYOUT.panelGap,
        width: NDT_LAYOUT.panelMaxWidth,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Overlay Layers */}
      <div style={panelStyle}>
        <SectionHeader label="Overlay Layers" tc={tc} />
        <ToggleRow dotColor={SEVERITY_MAP.CRITICAL.color} label="Critical" checked={store.showCritical} onChange={() => store.toggleSeverity('CRITICAL')} tc={tc} />
        <ToggleRow dotColor={SEVERITY_MAP.HIGH.color}     label="High"     checked={store.showHigh}     onChange={() => store.toggleSeverity('HIGH')}     tc={tc} />
        <ToggleRow dotColor={SEVERITY_MAP.MEDIUM.color}   label="Medium"   checked={store.showMedium}   onChange={() => store.toggleSeverity('MEDIUM')}   tc={tc} />
        <ToggleRow dotColor={SEVERITY_MAP.LOW.color}      label="Low"      checked={store.showLow}      onChange={() => store.toggleSeverity('LOW')}      tc={tc} />
        <div style={{ marginTop: 4, borderTop: `1px solid ${tc.borderSubtle}`, paddingTop: 4 }}>
          <ToggleRow dotColor={NDT_COLORS.accent}  label="Wireframe" checked={store.showWireframe} onChange={store.toggleWireframe} tc={tc} />
          <ToggleRow dotColor={tc.textDim}         label="Labels"    checked={store.showLabels}    onChange={store.toggleLabels}    tc={tc} />
        </div>

        {/* Overlay line thickness slider */}
        <div style={{ marginTop: 6, borderTop: `1px solid ${tc.borderSubtle}`, paddingTop: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: NDT_TYPE.xs, color: tc.textDim }}>Line Thickness</span>
            <span style={{ fontSize: NDT_TYPE.xs, color: tc.text }}>{store.overlayThickness.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="0.3"
            max="3.0"
            step="0.1"
            value={store.overlayThickness}
            onChange={(e) => store.setOverlayThickness(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: NDT_COLORS.accent, cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Severity Legend */}
      <div style={panelStyle}>
        <SectionHeader label="Severity Legend" tc={tc} />
        {(Object.keys(SEVERITY_MAP) as Array<keyof typeof SEVERITY_MAP>).map((level) => {
          const cfg = SEVERITY_MAP[level];
          return (
            <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <div style={{ width: 12, height: 4, borderRadius: 2, background: cfg.color, flexShrink: 0 }} />
              <span style={{ fontSize: NDT_TYPE.sm, color: tc.textDim }}>{cfg.description}</span>
            </div>
          );
        })}
      </div>

      {/* Shot Plan */}
      <ShotPlanPanel analysis={analysis} tc={tc} />

      {/* Machine View */}
      <MachineViewPanel tc={tc} />
    </div>
  );
}
