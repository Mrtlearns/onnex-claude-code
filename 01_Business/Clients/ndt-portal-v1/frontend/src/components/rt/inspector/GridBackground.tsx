export function GridBackground() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        backgroundImage: [
          'linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)',
        ].join(', '),
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }}
    />
  );
}
