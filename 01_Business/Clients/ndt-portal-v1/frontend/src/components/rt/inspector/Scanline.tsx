export function Scanline() {
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        height: '2px',
        background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.08), transparent)',
        zIndex: 3,
        pointerEvents: 'none',
        animation: 'ndt-scanline 8s linear infinite',
      }}
    />
  );
}
