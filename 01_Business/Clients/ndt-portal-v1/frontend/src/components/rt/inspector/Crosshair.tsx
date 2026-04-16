import { useInspectorStore } from '../../../stores/inspector-store';

export function Crosshair() {
  const cursor = useInspectorStore((s) => s.cursorPosition);
  if (!cursor) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: cursor.x,
        top: cursor.y,
        pointerEvents: 'none',
        zIndex: 150,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div style={{ position: 'absolute', width: 40, height: 1, top: 0, left: -20, background: 'rgba(0,212,255,0.2)' }} />
      <div style={{ position: 'absolute', width: 1, height: 40, top: -20, left: 0, background: 'rgba(0,212,255,0.2)' }} />
    </div>
  );
}
