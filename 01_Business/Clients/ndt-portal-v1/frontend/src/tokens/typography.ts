export const NDT_TYPE = {
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",

  // Scale
  xs:   '10px',
  sm:   '11px',
  base: '12px',
  md:   '14px',
  lg:   '16px',
  xl:   '20px',

  // Weights
  light:    300,
  regular:  400,
  medium:   500,
  semibold: 600,
  bold:     700,

  // Letter spacing
  label:  '2px',
  normal: '0px',
  tight:  '-0.5px',

  // 3D label canvas config (for LabelSprite)
  label3D: {
    fontFamily:   'monospace',
    fontSize:     28,
    canvasWidth:  320,
    canvasHeight: 80,
    bgColor:      'rgba(10, 12, 16, 0.8)',
    textColor:    '#C8CDD8',
    borderColor:  '#00D4FF',
    borderWidth:  2,
    borderRadius: 8,
    spriteScale:  [5, 1.25, 1] as [number, number, number],
  },
} as const;
