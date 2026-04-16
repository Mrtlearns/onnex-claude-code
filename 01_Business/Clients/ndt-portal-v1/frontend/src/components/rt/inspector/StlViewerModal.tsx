import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { useInspectorStore } from '../../../stores/inspector-store';
import type { MachineProfile } from '../../../stores/inspector-store';
import { NDT_TYPE } from '../../../tokens/typography';
import type { RTAnalysis } from '../../../lib/rt/inspector-types';
import { buildPartFromSpec } from '../../../lib/rt/geometry-factory';

// ── Types ────────────────────────────────────────────────────────────────────

type MaterialPreset = 'solid' | 'xray' | 'wireOnly';
type BgPreset = 'white' | 'dark' | 'gradient';

interface ViewerSettings {
  opacity:     number;
  wireframe:   boolean;
  edges:       boolean;
  showGrid:    boolean;
  bgPreset:    BgPreset;
  matPreset:   MaterialPreset;
  showEnvelope: boolean;
}

const DEFAULTS: ViewerSettings = {
  opacity:      1.0,
  wireframe:    false,
  edges:        false,
  showGrid:     true,
  bgPreset:     'white',
  matPreset:    'solid',
  showEnvelope: false,
};

const BG_COLORS: Record<BgPreset, string> = {
  white:    '#f5f5f5',
  dark:     '#1a1e2a',
  gradient: 'linear-gradient(180deg, #2a3040 0%, #0a0c10 100%)',
};

// ── View preset directions ───────────────────────────────────────────────────

const VIEW_PRESETS: Array<{ label: string; dir: [number, number, number] }> = [
  { label: 'Front', dir: [0, 0, 1] },
  { label: 'Back',  dir: [0, 0, -1] },
  { label: 'Top',   dir: [0, 1, 0.001] },
  { label: 'Bot',   dir: [0, -1, 0.001] },
  { label: 'L',     dir: [-1, 0, 0] },
  { label: 'R',     dir: [1, 0, 0] },
  { label: 'Iso',   dir: [0.55, 0.42, 0.72] },
];

// ── Materials ────────────────────────────────────────────────────────────────

function makeMaterial(preset: MaterialPreset, opacity: number, wireframe: boolean): THREE.Material {
  if (preset === 'wireOnly') {
    return new THREE.MeshBasicMaterial({ wireframe: true, color: '#4488cc', side: THREE.DoubleSide });
  }
  if (preset === 'xray') {
    return new THREE.MeshPhongMaterial({
      color: '#88aacc', opacity: 0.3, transparent: true,
      side: THREE.DoubleSide, depthWrite: false, specular: '#224466', shininess: 30,
    });
  }
  // solid
  return new THREE.MeshStandardMaterial({
    color: '#b0b8c8', metalness: 0.2, roughness: 0.6,
    side: THREE.DoubleSide,
    transparent: opacity < 1, opacity,
    wireframe,
  });
}

// ── Edge lines ───────────────────────────────────────────────────────────────

function EdgeLines({ group }: { group: THREE.Group }) {
  const linesRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const g = linesRef.current;
    if (!g) return;
    g.clear();
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        const edgeGeo = new THREE.EdgesGeometry(mesh.geometry, 15);
        const line = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: '#333333' }));
        line.position.copy(mesh.position);
        line.rotation.copy(mesh.rotation);
        line.scale.copy(mesh.scale);
        g.add(line);
      }
    });
  }, [group]);

  return <group ref={linesRef} />;
}

// ── Machine envelope ─────────────────────────────────────────────────────────

function MachineEnvelopeViewer() {
  const selectedId = useInspectorStore((s) => s.selectedMachineId);
  const profiles   = useInspectorStore((s) => s.machineProfiles);
  const profile: MachineProfile | undefined = profiles.find((m) => m.machine_id === selectedId);
  if (!profile) return null;

  const { max_part_diameter_mm, max_part_height_mm } = profile.spec.inspection_envelope;
  const r = max_part_diameter_mm / 2;
  const h = max_part_height_mm;
  const tubeR = Math.max(r * 0.04, 4);

  return (
    <group>
      <mesh>
        <cylinderGeometry args={[r, r, h, 64]} />
        <meshBasicMaterial color="#00CCFF" wireframe />
      </mesh>
      <mesh position={[r, 0, 0]}>
        <sphereGeometry args={[tubeR, 16, 16]} />
        <meshStandardMaterial color="#FFD600" emissive="#FFD600" emissiveIntensity={3} />
      </mesh>
    </group>
  );
}

// ── Camera controller ────────────────────────────────────────────────────────

interface CamCtrlRef {
  fitToModel: () => void;
  snapTo: (dir: [number, number, number]) => void;
}

function CameraController({ ctrlRef, analysis }: { ctrlRef: React.MutableRefObject<CamCtrlRef | null>; analysis: RTAnalysis }) {
  const { camera, scene, controls } = useThree();
  const sphereRef = useRef<THREE.Sphere>(new THREE.Sphere());
  const distRef = useRef(20);

  const fit = useCallback(() => {
    const box = new THREE.Box3();
    scene.traverse((obj) => { if ((obj as THREE.Mesh).isMesh) box.expandByObject(obj); });
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    sphereRef.current = sphere;
    const cam = camera as THREE.PerspectiveCamera;
    const fov = cam.fov * (Math.PI / 180);
    const dist = (sphere.radius / Math.tan(fov / 2)) * 1.6;
    distRef.current = dist;

    const dir = new THREE.Vector3(0.55, 0.42, 0.72).normalize();
    camera.position.copy(sphere.center).addScaledVector(dir, dist);
    camera.lookAt(sphere.center);
    cam.updateProjectionMatrix();
    if (controls) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oc = controls as any;
      oc.target.copy(sphere.center);
      oc.maxDistance = dist * 4;
      oc.update();
    }
  }, [camera, scene, controls]);

  const snapTo = useCallback((dir: [number, number, number]) => {
    const s = sphereRef.current;
    const d = distRef.current;
    const v = new THREE.Vector3(...dir).normalize();
    camera.position.copy(s.center).addScaledVector(v, d);
    camera.lookAt(s.center);
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    if (controls) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const oc = controls as any;
      oc.target.copy(s.center);
      oc.update();
    }
  }, [camera, controls]);

  useEffect(() => {
    ctrlRef.current = { fitToModel: fit, snapTo };
    const timer = setTimeout(fit, 350);
    return () => clearTimeout(timer);
  }, [fit, snapTo, ctrlRef]);

  return null;
}

// ── Scene contents ───────────────────────────────────────────────────────────

interface SceneProps {
  analysis: RTAnalysis;
  settings: ViewerSettings;
  ctrlRef:  React.MutableRefObject<CamCtrlRef | null>;
}

function StlScene({ analysis, settings, ctrlRef }: SceneProps) {
  const partGroup = useMemo(() => buildPartFromSpec(analysis.render_model.primitives), [analysis]);
  const gridYRef = useRef(-5);

  // Apply material
  useEffect(() => {
    const mat = makeMaterial(settings.matPreset, settings.opacity, settings.wireframe);
    partGroup.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) (obj as THREE.Mesh).material = mat;
    });
  }, [partGroup, settings.matPreset, settings.opacity, settings.wireframe]);

  // Compute grid Y from bounding box
  useEffect(() => {
    const box = new THREE.Box3();
    partGroup.traverse((obj) => { if ((obj as THREE.Mesh).isMesh) box.expandByObject(obj); });
    if (!box.isEmpty()) gridYRef.current = box.min.y - 0.5;
  }, [partGroup]);

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 15, 10]} intensity={1.0} />
      <directionalLight position={[-10, -5, -10]} intensity={0.3} color="#aaccff" />

      <primitive object={partGroup} />

      {settings.edges && settings.matPreset !== 'wireOnly' && <EdgeLines group={partGroup} />}

      {settings.showGrid && (
        <Grid
          args={[200, 200]}
          cellSize={1}
          cellThickness={0.5}
          cellColor={settings.bgPreset === 'white' ? '#d0d0d0' : '#2a3040'}
          sectionSize={5}
          sectionThickness={1}
          sectionColor={settings.bgPreset === 'white' ? '#a0a0a0' : '#3a4858'}
          fadeDistance={80}
          fadeStrength={1}
          position={[0, gridYRef.current, 0]}
        />
      )}

      {settings.showEnvelope && <MachineEnvelopeViewer />}

      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
      <CameraController ctrlRef={ctrlRef} analysis={analysis} />
    </>
  );
}

// ── Toolbar button style ─────────────────────────────────────────────────────

const TB: React.CSSProperties = {
  background: 'none', border: '1px solid #ccc', borderRadius: 4,
  padding: '3px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 600,
  color: '#555', fontFamily: NDT_TYPE.fontFamily, letterSpacing: '0.03em',
  transition: 'background 0.15s, border-color 0.15s',
};

const TB_ACTIVE: React.CSSProperties = { ...TB, background: '#e0e8f0', borderColor: '#0088cc', color: '#0066aa' };

function TbBtn({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return <button style={active ? TB_ACTIVE : TB} onClick={onClick}>{label}</button>;
}

// ── Side panel toggle row ────────────────────────────────────────────────────

function SideToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', fontSize: 11, color: '#555', cursor: 'pointer' }}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ accentColor: '#0088cc' }} />
    </label>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────

interface StlViewerModalProps {
  analysis: RTAnalysis;
}

export function StlViewerModal({ analysis }: StlViewerModalProps) {
  const store = useInspectorStore();
  const [s, setS] = useState<ViewerSettings>({ ...DEFAULTS });
  const ctrlRef = useRef<CamCtrlRef | null>(null);

  const upd = (patch: Partial<ViewerSettings>) => setS((prev) => ({ ...prev, ...patch }));

  if (!store.showStlViewer) return null;

  const bgStyle = s.bgPreset === 'gradient'
    ? { background: BG_COLORS.gradient }
    : { background: BG_COLORS[s.bgPreset] };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) store.toggleStlViewer(); }}
    >
      <div style={{ width: '88vw', height: '82vh', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fff', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>

        {/* ── Toolbar ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid #e0e0e0', fontFamily: NDT_TYPE.fontFamily, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#333', letterSpacing: '0.08em', textTransform: 'uppercase', marginRight: 8 }}>
            Part Viewer
          </span>

          <div style={{ width: 1, height: 20, background: '#ddd' }} />

          {/* View presets */}
          {VIEW_PRESETS.map((vp) => (
            <TbBtn key={vp.label} label={vp.label} onClick={() => ctrlRef.current?.snapTo(vp.dir)} />
          ))}

          <div style={{ width: 1, height: 20, background: '#ddd', marginLeft: 4, marginRight: 4 }} />

          <TbBtn label="Reset" onClick={() => ctrlRef.current?.fitToModel()} />

          <div style={{ flex: 1 }} />

          <button onClick={store.toggleStlViewer} style={{ ...TB, fontSize: 14, width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>

        {/* ── Body: canvas + side panel ───────────────────────── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Canvas */}
          <div style={{ flex: 1, position: 'relative', ...bgStyle }}>
            <Canvas camera={{ fov: 45, near: 0.1, far: 10000, position: [12, 6, 18] }} style={{ width: '100%', height: '100%' }}>
              <StlScene analysis={analysis} settings={s} ctrlRef={ctrlRef} />
            </Canvas>
          </div>

          {/* Side panel */}
          <div style={{ width: 180, borderLeft: '1px solid #e0e0e0', padding: '12px 14px', fontFamily: NDT_TYPE.fontFamily, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>

            {/* Opacity */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#888', marginBottom: 3 }}>
                <span>Opacity</span><span>{s.opacity.toFixed(1)}</span>
              </div>
              <input type="range" min="0.2" max="1.0" step="0.05" value={s.opacity} onChange={(e) => upd({ opacity: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: '#0088cc' }} />
            </div>

            {/* Toggles */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: 8 }}>
              <SideToggle label="Wireframe" checked={s.wireframe} onChange={() => upd({ wireframe: !s.wireframe })} />
              <SideToggle label="Edges" checked={s.edges} onChange={() => upd({ edges: !s.edges })} />
              <SideToggle label="Grid" checked={s.showGrid} onChange={() => upd({ showGrid: !s.showGrid })} />
              <SideToggle label="Machine Env." checked={s.showEnvelope} onChange={() => upd({ showEnvelope: !s.showEnvelope })} />
            </div>

            {/* Background */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: 8 }}>
              <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>Background</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['white', 'dark', 'gradient'] as BgPreset[]).map((bg) => (
                  <button key={bg} onClick={() => upd({ bgPreset: bg })} style={{
                    ...TB, flex: 1, fontSize: 10, padding: '3px 0',
                    ...(s.bgPreset === bg ? { background: '#e0e8f0', borderColor: '#0088cc', color: '#0066aa' } : {}),
                  }}>
                    {bg.charAt(0).toUpperCase() + bg.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Material preset */}
            <div style={{ borderTop: '1px solid #eee', paddingTop: 8 }}>
              <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>Material</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {([['solid', 'Solid'], ['xray', 'X-Ray'], ['wireOnly', 'Wire']] as [MaterialPreset, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => upd({ matPreset: key })} style={{
                    ...TB, fontSize: 10, textAlign: 'left' as const, padding: '4px 8px',
                    ...(s.matPreset === key ? { background: '#e0e8f0', borderColor: '#0088cc', color: '#0066aa' } : {}),
                  }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
