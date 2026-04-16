import { useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls }  from '@react-three/drei';
import * as THREE         from 'three';
import { LightingRig }    from './LightingRig';
import { PartModel }      from './PartModel';
import { InspectionOverlay } from './InspectionOverlay';
import { LabelSprites }   from './LabelSprites';
import { useZoneRaycast } from '../../../hooks/useZoneRaycast';
import { useInspectorStore } from '../../../stores/inspector-store';
import type { MachineProfile } from '../../../stores/inspector-store';
import type { RTAnalysis } from '../../../lib/rt/inspector-types';

interface SceneCanvasProps {
  analysis: RTAnalysis;
}

// ── CameraFitter — auto-zooms to fit all meshes on mount ──────────────────────

function CameraFitter() {
  const { camera, scene, controls } = useThree();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current) return;
    fitted.current = true;

    // Delay to let geometry settle after first render
    const timer = setTimeout(() => {
      const box = new THREE.Box3();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          box.expandByObject(obj);
        }
      });

      if (box.isEmpty()) return;

      const sphere = box.getBoundingSphere(new THREE.Sphere());
      const cam = camera as THREE.PerspectiveCamera;
      const fov = cam.fov * (Math.PI / 180);
      // Distance needed so the bounding sphere fills ~70% of the view
      const dist = (sphere.radius / Math.tan(fov / 2)) * 1.6;

      const dir = new THREE.Vector3(0.55, 0.42, 0.72).normalize();
      camera.position.copy(sphere.center).addScaledVector(dir, dist);
      camera.lookAt(sphere.center);
      cam.updateProjectionMatrix();

      // Sync OrbitControls: orbit around part center, allow zoom to 4× fit distance
      if (controls) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const oc = controls as any;
        oc.target.copy(sphere.center);
        oc.maxDistance = dist * 4;
        oc.update();
      }
    }, 350);

    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ── MachineEnvelope — transparent inspection cylinder + X-ray tube marker ─────

function MachineEnvelope() {
  const selectedMachineId = useInspectorStore((s) => s.selectedMachineId);
  const machineProfiles   = useInspectorStore((s) => s.machineProfiles);

  const profile: MachineProfile | undefined = machineProfiles.find(
    (m) => m.machine_id === selectedMachineId,
  );
  if (!profile) return null;

  const { max_part_diameter_mm, max_part_height_mm } = profile.spec.inspection_envelope;
  const r = max_part_diameter_mm / 2;
  const h = max_part_height_mm;
  const tubeRadius = Math.max(r * 0.04, 4); // min 4 units so it's always visible

  return (
    <group>
      {/* Inspection envelope — transparent wireframe cylinder */}
      <mesh>
        <cylinderGeometry args={[r, r, h, 64]} />
        <meshBasicMaterial color="#00CCFF" wireframe />
      </mesh>

      {/* X-ray tube marker — glowing sphere at envelope wall, mid-height */}
      <mesh position={[r, 0, 0]}>
        <sphereGeometry args={[tubeRadius, 16, 16]} />
        <meshStandardMaterial
          color="#FFD600"
          emissive="#FFD600"
          emissiveIntensity={3}
        />
      </mesh>
    </group>
  );
}

// ── ScaleUpdater — writes world-unit scale to DOM element ─────────────────────

function ScaleUpdater() {
  const { camera, size } = useThree();
  const lastTick = useRef(0);

  useFrame(() => {
    const now = performance.now();
    if (now - lastTick.current < 150) return; // cap at ~7 fps for DOM writes
    lastTick.current = now;

    const labelEl = document.getElementById('ndt-scale-label');
    const barEl   = document.getElementById('ndt-scale-bar');
    if (!labelEl || !barEl) return;

    const cam = camera as THREE.PerspectiveCamera;
    const dist = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
    const fov  = cam.fov * (Math.PI / 180);
    const visW = 2 * dist * Math.tan(fov / 2) * (size.width / size.height);

    // Target ~80px wide bar
    const rulerBarPx  = 80;
    const worldPerBar = (rulerBarPx / size.width) * visW;

    // Round to a nice number
    const mag   = Math.pow(10, Math.floor(Math.log10(worldPerBar)));
    const candidates = [1, 2, 5, 10].map((n) => n * mag);
    const nice  = candidates.find((n) => n >= worldPerBar * 0.6) ?? candidates[candidates.length - 1];
    const displayPx = Math.min(Math.round((nice / worldPerBar) * rulerBarPx), 200);

    labelEl.textContent = `${Number.isInteger(nice) ? nice : nice.toFixed(1)} units`;
    barEl.style.width   = `${displayPx}px`;
  });

  return null;
}

// ── ExportRegistrar — registers PNG + STL export fns in the store ────────────

function ExportRegistrar() {
  const { gl, scene } = useThree();
  const registerPng = useInspectorStore((s) => s.registerExportPng);
  const registerStl = useInspectorStore((s) => s.registerExportStl);

  useEffect(() => {
    registerPng(() => {
      const url = gl.domElement.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `ndt-inspector-${Date.now()}.png`;
      a.click();
    });

    registerStl(() => {
      import('three/examples/jsm/exporters/STLExporter.js').then(({ STLExporter }) => {
        const stl = new STLExporter().parse(scene, { binary: true });
        const blob = new Blob([stl as unknown as ArrayBuffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ndt-model-${Date.now()}.stl`;
        a.click();
        URL.revokeObjectURL(url);
      });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ── SceneContents — everything inside the R3F Canvas ─────────────────────────

function SceneContents({ analysis }: SceneCanvasProps) {
  const { onMouseMove } = useZoneRaycast();

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [onMouseMove]);

  return (
    <>
      <LightingRig />
      <PartModel primitives={analysis.render_model.primitives} />
      <InspectionOverlay
        zones={analysis.inspection_zones}
        primitives={analysis.render_model.primitives}
      />
      <LabelSprites
        zones={analysis.inspection_zones}
        primitives={analysis.render_model.primitives}
      />
      <MachineEnvelope />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={0.5}
        maxDistance={10000}
        minPolarAngle={0.1}
        maxPolarAngle={Math.PI - 0.1}
        rotateSpeed={0.5}
        panSpeed={0.5}
        zoomSpeed={1.0}
        mouseButtons={{
          LEFT:   THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT:  THREE.MOUSE.PAN,
        }}
      />
      <CameraFitter />
      <ScaleUpdater />
      <ExportRegistrar />
    </>
  );
}

// ── SceneCanvas ───────────────────────────────────────────────────────────────

export function SceneCanvas({ analysis }: SceneCanvasProps) {
  const theme = useInspectorStore((s) => s.theme);
  const sceneBg = theme === 'dark' ? '#0A0C10' : '#E2E6F2';

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
      <Canvas
        shadows
        gl={{
          antialias:            true,
          alpha:                true,
          preserveDrawingBuffer: true,
          toneMapping:          THREE.NoToneMapping,
        }}
        dpr={[1, 2]}
        camera={{ fov: 45, near: 0.1, far: 1000, position: [12, 6, 18] }}
        style={{ background: sceneBg }}
      >
        <SceneContents analysis={analysis} />
      </Canvas>

      {/* Scale ruler — DOM overlay at bottom center */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <div
          id="ndt-scale-bar"
          style={{
            width: 80,
            height: 2,
            background: theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
            borderLeft:  `2px solid ${theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'}`,
            borderRight: `2px solid ${theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'}`,
            transition:  'width 0.2s ease',
          }}
        />
        <div
          id="ndt-scale-label"
          style={{
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '1px',
            color: theme === 'dark' ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
          }}
        >
          — units
        </div>
      </div>
    </div>
  );
}
