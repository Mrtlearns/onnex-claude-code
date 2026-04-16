export const NDT_LAYOUT = {
  // Panel positioning
  topBarHeight:       '56px',
  panelGap:           '8px',
  panelPadding:       '14px 16px',
  panelBorderRadius:  '8px',
  panelMaxWidth:      '280px',
  infoPanelMaxWidth:  '340px',

  // Panel positions
  controlsTop:          '65px',
  controlsRight:        '16px',
  infoPanelBottom:      '16px',
  infoPanelLeft:        '16px',
  instructionsBottom:   '16px',
  instructionsRight:    '16px',

  // Glassmorphism
  panelBackdropBlur: '16px',
  panelBg:           'rgba(18, 21, 28, 0.92)',
  panelBorder:       '1px solid #1E2230',

  // Tooltip
  tooltipMaxWidth:    '260px',
  tooltipPadding:     '10px 14px',
  tooltipOffset:      16,
  tooltipBorderRadius:'6px',
  tooltipShadow:      '0 0 20px rgba(0, 212, 255, 0.15)',

  // Z-indices
  zScene:      1,
  zGridOverlay:2,
  zScanline:   3,
  zPanels:     100,
  zCrosshair:  150,
  zTooltip:    200,
} as const;
