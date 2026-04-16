import { useInspectorStore } from '../../../stores/inspector-store';
import { NDT_COLORS } from '../../../tokens/colors';
import { NDT_TYPE } from '../../../tokens/typography';
import { NDT_LAYOUT } from '../../../tokens/layout';
import type { PartClassification } from '../../../lib/rt/inspector-types';

const PART_TYPE_FIELDS: Record<string, Array<{ label: string; path: string[] }>> = {
  pressure_vessel: [
    { label: 'OD',          path: ['geometry', 'bounding_box', 'width', 'value'] },
    { label: 'Design Press',path: ['design_conditions', 'pressure', 'value'] },
    { label: 'Design Temp', path: ['design_conditions', 'temperature', 'value'] },
    { label: 'Service',     path: ['design_conditions', 'service'] },
    { label: 'PWHT',        path: ['design_conditions', 'pwht_required'] },
  ],
  pipe_spool: [
    { label: 'Service',     path: ['design_conditions', 'service'] },
    { label: 'Design Press',path: ['design_conditions', 'pressure', 'value'] },
    { label: 'PWHT',        path: ['design_conditions', 'pwht_required'] },
  ],
  casting: [
    { label: 'Material',    path: ['materials', '0', 'spec'] },
    { label: 'Form',        path: ['materials', '0', 'form'] },
  ],
  forging: [
    { label: 'Material',    path: ['materials', '0', 'spec'] },
    { label: 'Form',        path: ['materials', '0', 'form'] },
  ],
  aerospace_component: [
    { label: 'Service',     path: ['design_conditions', 'service'] },
    { label: 'Material',    path: ['materials', '0', 'spec'] },
  ],
  structural_weldment: [
    { label: 'Service',     path: ['design_conditions', 'service'] },
    { label: 'Material',    path: ['materials', '0', 'spec'] },
  ],
  heat_exchanger: [
    { label: 'Design Press',path: ['design_conditions', 'pressure', 'value'] },
    { label: 'Design Temp', path: ['design_conditions', 'temperature', 'value'] },
    { label: 'Service',     path: ['design_conditions', 'service'] },
  ],
  storage_tank: [
    { label: 'Service',     path: ['design_conditions', 'service'] },
    { label: 'Material',    path: ['materials', '0', 'spec'] },
  ],
};

function getNestedValue(obj: unknown, path: string[]): string {
  let current: unknown = obj;
  for (const key of path) {
    if (current == null || typeof current !== 'object') return '—';
    current = (current as Record<string, unknown>)[key];
  }
  if (current == null) return '—';
  if (typeof current === 'boolean') return current ? 'Yes' : 'No';
  return String(current);
}

function SpecRow({ label, value, textDim, textBright }: { label: string; value: string; textDim: string; textBright: string }) {
  return (
    <>
      <span style={{ color: textDim, fontSize: NDT_TYPE.sm, letterSpacing: NDT_TYPE.label, textTransform: 'uppercase', paddingRight: 8 }}>
        {label}
      </span>
      <span style={{ color: textBright, fontSize: NDT_TYPE.sm, textAlign: 'right' }}>
        {value}
      </span>
    </>
  );
}

interface InfoPanelProps {
  classification: PartClassification;
}

export function InfoPanel({ classification }: InfoPanelProps) {
  const theme = useInspectorStore((s) => s.theme);
  const isDark = theme === 'dark';
  const tc = {
    panelBg:     isDark ? NDT_LAYOUT.panelBg    : 'rgba(255, 255, 255, 0.94)',
    panelBorder: isDark ? NDT_LAYOUT.panelBorder : '1px solid rgba(0, 0, 0, 0.10)',
    text:        isDark ? NDT_COLORS.text        : '#1A2030',
    textDim:     isDark ? NDT_COLORS.textDim     : '#607080',
    textBright:  isDark ? NDT_COLORS.textBright  : '#0A0C10',
  };

  const typeFields = PART_TYPE_FIELDS[classification.part_type] ?? [];

  const universalSpecs = [
    { label: 'Part ID',   value: classification.part_id },
    { label: 'Type',      value: classification.part_type.replace(/_/g, ' ') },
    { label: 'Code',      value: classification.applicable_codes.primary },
    { label: 'Material',  value: classification.materials?.[0]?.spec ?? '—' },
    { label: 'RT Extent', value: classification.rt_requirements_from_drawing?.stated_rt_extent ?? '—' },
    { label: 'Confidence',value: `${(classification.confidence * 100).toFixed(0)}%` },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: NDT_LAYOUT.infoPanelBottom,
        left:   NDT_LAYOUT.infoPanelLeft,
        zIndex: NDT_LAYOUT.zPanels,
        maxWidth: NDT_LAYOUT.infoPanelMaxWidth,
        background: tc.panelBg,
        border: tc.panelBorder,
        borderRadius: NDT_LAYOUT.panelBorderRadius,
        padding: NDT_LAYOUT.panelPadding,
        backdropFilter: `blur(${NDT_LAYOUT.panelBackdropBlur})`,
        WebkitBackdropFilter: `blur(${NDT_LAYOUT.panelBackdropBlur})`,
        fontFamily: NDT_TYPE.fontFamily,
      }}
    >
      <div
        style={{
          fontSize: NDT_TYPE.xs,
          fontWeight: NDT_TYPE.semibold,
          letterSpacing: NDT_TYPE.label,
          color: tc.textDim,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Part Specifications
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 0' }}>
        {universalSpecs.map(({ label, value }) => (
          <SpecRow key={label} label={label} value={value} textDim={tc.textDim} textBright={tc.textBright} />
        ))}
        {typeFields.map(({ label, path }) => (
          <SpecRow key={label} label={label} value={getNestedValue(classification, path)} textDim={tc.textDim} textBright={tc.textBright} />
        ))}
      </div>

      {classification.confidence < 0.6 && (
        <div
          style={{
            marginTop: 8,
            padding: '4px 8px',
            background: 'rgba(255, 214, 0, 0.1)',
            border: '1px solid rgba(255, 214, 0, 0.3)',
            borderRadius: 4,
            fontSize: NDT_TYPE.xs,
            color: NDT_COLORS.medium,
          }}
        >
          ⚠ Low confidence — manual review recommended
        </div>
      )}
    </div>
  );
}
