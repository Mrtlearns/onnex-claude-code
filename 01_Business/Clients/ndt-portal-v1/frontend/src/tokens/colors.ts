export const NDT_COLORS = {
  // Backgrounds
  bg:            '#0A0C10',
  bgPanel:       '#12151C',
  bgPanelAlpha:  'rgba(18, 21, 28, 0.92)',
  bgElevated:    '#1A1E2A',
  bgHover:       '#1E2438',
  bgInput:       '#0E1118',

  // Borders
  border:        '#1E2230',
  borderFocus:   '#00D4FF',
  borderSubtle:  '#151822',

  // Text
  text:          '#C8CDD8',
  textDim:       '#6B7280',
  textMuted:     '#3A4050',
  textBright:    '#F0F2F5',

  // Accent
  accent:        '#00D4FF',
  accentDim:     'rgba(0, 212, 255, 0.15)',
  accentGlow:    'rgba(0, 212, 255, 0.25)',

  // Severity — NEVER change these, they are the product identity
  critical:      '#FF1744',
  criticalDim:   'rgba(255, 23, 68, 0.2)',
  high:          '#FF9100',
  highDim:       'rgba(255, 145, 0, 0.2)',
  medium:        '#FFD600',
  mediumDim:     'rgba(255, 214, 0, 0.2)',
  low:           '#69F0AE',
  lowDim:        'rgba(105, 240, 174, 0.2)',
  info:          '#00D4FF',

  // 3D Scene — brighter than bg (#0A0C10) for sufficient contrast
  meshPrimary:   '#3A4858',
  meshSecondary: '#4A5A6A',
  meshSpecular:  '#2A3A4A',
  meshHeavy:     '#667080',
  wireframe:     'rgba(0, 212, 255, 0.08)',

  // Functional
  success:       '#00E676',
  warning:       '#FFAA00',
  error:         '#FF1744',
} as const;

export type NDTColor = keyof typeof NDT_COLORS;
