import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useInspectorStore } from '../../../stores/inspector-store';
import type { InspectorState } from '../../../stores/inspector-store';
import { NDT_COLORS } from '../../../tokens/colors';
import { NDT_TYPE } from '../../../tokens/typography';
import { GridBackground } from './GridBackground';
import { Scanline } from './Scanline';
import { SceneCanvas } from './SceneCanvas';
import { TopBar } from './TopBar';
import { ControlPanel } from './ControlPanel';
import { InfoPanel } from './InfoPanel';
import { InspectionTooltip } from './InspectionTooltip';
import { Crosshair } from './Crosshair';
import { KeyboardHints } from './KeyboardHints';
import { StlViewerModal } from './StlViewerModal';

// ── Loading overlay ───────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  pending:     'Queued',
  classifying: 'Classifying part geometry…',
  assembling:  'Assembling analysis prompt…',
  analyzing:   'Running RT analysis…',
  validating:  'Validating results…',
  complete:    'Complete',
};

function LoadingOverlay({ stage }: { stage?: string }) {
  const label = stage ? (STAGE_LABELS[stage] ?? stage) : 'Initializing…';

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: NDT_COLORS.bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: NDT_TYPE.fontFamily,
        zIndex: 200,
      }}
    >
      <GridBackground />

      {/* Spinner ring */}
      <div
        style={{
          width: 56, height: 56,
          borderRadius: '50%',
          border: `2px solid ${NDT_COLORS.border}`,
          borderTopColor: NDT_COLORS.accent,
          animation: 'ndt-spin 0.8s linear infinite',
          marginBottom: 24,
        }}
      />

      <div
        style={{
          fontSize: NDT_TYPE.sm,
          letterSpacing: NDT_TYPE.label,
          textTransform: 'uppercase',
          color: NDT_COLORS.textDim,
          marginBottom: 8,
        }}
      >
        {label}
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['classifying', 'assembling', 'analyzing', 'validating'] as const).map((s) => {
          const stages = ['classifying', 'assembling', 'analyzing', 'validating'];
          const currentIdx = stages.indexOf(stage ?? '');
          const dotIdx = stages.indexOf(s);
          const active = dotIdx <= currentIdx;
          return (
            <div
              key={s}
              style={{
                width: 6, height: 6,
                borderRadius: '50%',
                background: active ? NDT_COLORS.accent : NDT_COLORS.border,
                transition: 'background 0.3s ease',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Error overlay ─────────────────────────────────────────────────────────────

const CLASSIFICATION_COLORS: Record<string, string> = {
  EAR_LOW:      NDT_COLORS.medium,
  EAR_HIGH:     NDT_COLORS.high,
  ITAR:         NDT_COLORS.critical,
  NEEDS_REVIEW: '#94A3B8',
};

const ROUTING_COLORS: Record<string, string> = {
  LOCAL_ONLY: '#8B5CF6',
  HOLD:       NDT_COLORS.critical,
  CLOUD_OK:   NDT_COLORS.success,
};

function ErrorOverlay({
  message,
  compliance,
}: {
  message: string;
  compliance?: InspectorState['complianceResult'];
}) {
  const showCompliance = compliance && compliance.classification !== 'CLEAN';

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: NDT_COLORS.bg,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: NDT_TYPE.fontFamily,
        zIndex: 200,
      }}
    >
      <GridBackground />

      {showCompliance && (
        <div
          style={{
            background: NDT_COLORS.bgPanel,
            border: `1px solid ${NDT_COLORS.border}`,
            borderRadius: 8,
            padding: '20px 28px',
            maxWidth: 520,
            width: '100%',
            marginBottom: 24,
          }}
        >
          {/* Header */}
          <div
            style={{
              fontSize: NDT_TYPE.sm,
              fontWeight: NDT_TYPE.semibold,
              color: NDT_COLORS.textBright,
              letterSpacing: NDT_TYPE.label,
              textTransform: 'uppercase',
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 16 }}>🛡</span>
            ITAR / Export Control Classification
          </div>

          {/* Badge row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <span
              style={{
                fontSize: NDT_TYPE.xs,
                fontWeight: NDT_TYPE.semibold,
                letterSpacing: NDT_TYPE.label,
                textTransform: 'uppercase',
                color: CLASSIFICATION_COLORS[compliance.classification] ?? NDT_COLORS.textDim,
                background: `${CLASSIFICATION_COLORS[compliance.classification] ?? NDT_COLORS.textDim}22`,
                border: `1px solid ${CLASSIFICATION_COLORS[compliance.classification] ?? NDT_COLORS.textDim}`,
                borderRadius: 4,
                padding: '2px 8px',
              }}
            >
              {compliance.classification}
            </span>
            {compliance.routing && (
              <span
                style={{
                  fontSize: NDT_TYPE.xs,
                  fontWeight: NDT_TYPE.semibold,
                  letterSpacing: NDT_TYPE.label,
                  textTransform: 'uppercase',
                  color: ROUTING_COLORS[compliance.routing] ?? NDT_COLORS.textDim,
                  background: `${ROUTING_COLORS[compliance.routing] ?? NDT_COLORS.textDim}22`,
                  border: `1px solid ${ROUTING_COLORS[compliance.routing] ?? NDT_COLORS.textDim}`,
                  borderRadius: 4,
                  padding: '2px 8px',
                }}
              >
                {compliance.routing}
              </span>
            )}
          </div>

          {/* Risk score bar */}
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: NDT_TYPE.xs,
                color: NDT_COLORS.textDim,
                letterSpacing: NDT_TYPE.label,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Risk Score: {compliance.score} / 25
            </div>
            <div
              style={{
                height: 4,
                background: NDT_COLORS.bgElevated,
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min((compliance.score / 25) * 100, 100)}%`,
                  background: CLASSIFICATION_COLORS[compliance.classification] ?? NDT_COLORS.accent,
                  borderRadius: 2,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>

          {/* Hits */}
          {compliance.hits.length > 0 ? (
            <div>
              <div
                style={{
                  fontSize: NDT_TYPE.xs,
                  color: NDT_COLORS.textDim,
                  letterSpacing: NDT_TYPE.label,
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Triggered patterns:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {compliance.hits.map((hit, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: NDT_TYPE.xs,
                      color: NDT_COLORS.text,
                      background: NDT_COLORS.bgElevated,
                      borderRadius: 4,
                      padding: '4px 8px',
                    }}
                  >
                    <span style={{ color: NDT_COLORS.textBright, fontWeight: NDT_TYPE.medium }}>
                      {hit.pattern}
                    </span>
                    <span style={{ color: NDT_COLORS.textDim }}>
                      match: {hit.match} · weight: {hit.weight} · {hit.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : compliance.score > 0 ? (
            <div
              style={{
                fontSize: NDT_TYPE.xs,
                color: NDT_COLORS.textDim,
                lineHeight: 1.6,
              }}
            >
              Non-USML control patterns matched (EAR / MIL-SPEC). Contact admin to review the keyword library.
            </div>
          ) : null}
        </div>
      )}

      <div
        style={{
          fontSize: NDT_TYPE.md,
          fontWeight: NDT_TYPE.semibold,
          color: NDT_COLORS.critical,
          marginBottom: 12,
          letterSpacing: NDT_TYPE.label,
          textTransform: 'uppercase',
        }}
      >
        Analysis Failed
      </div>
      <div
        style={{
          fontSize: NDT_TYPE.sm,
          color: NDT_COLORS.textDim,
          maxWidth: 480,
          textAlign: 'center',
          lineHeight: 1.6,
        }}
      >
        {message}
      </div>
    </div>
  );
}

// ── PartInspector ─────────────────────────────────────────────────────────────

export function PartInspector() {
  const { jobId } = useParams<{ jobId: string }>();
  const store = useInspectorStore();

  useEffect(() => {
    if (!jobId) return;
    // Only fetch if we don't already have the right job loaded
    if (store.jobId !== jobId || (!store.analysis && !store.loading && !store.error)) {
      store.loadJob(jobId);
    }
  }, [jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading state ──────────────────────────────────────────────────────────
  if (store.loading || (!store.analysis && !store.error)) {
    return <LoadingOverlay stage={store.stage ?? undefined} />;
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (store.error || !store.analysis || !store.classification) {
    return (
      <ErrorOverlay
        message={store.error ?? 'Job not found or incomplete.'}
        compliance={store.complianceResult ?? undefined}
      />
    );
  }

  const { classification, analysis } = store;
  const bg = store.theme === 'dark' ? NDT_COLORS.bg : '#E2E6F2';

  // ── Full inspector ─────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: bg,
        overflow: 'hidden',
      }}
    >
      {/* Ambient atmosphere layers */}
      <GridBackground />
      <Scanline />

      {/* 3D scene (z: 1) */}
      <SceneCanvas analysis={analysis} />

      {/* HUD overlays (z: 100+) */}
      <TopBar classification={classification} analysis={analysis} />
      <ControlPanel analysis={analysis} />
      <InfoPanel classification={classification} />
      <InspectionTooltip />
      <Crosshair />
      <KeyboardHints />
      <StlViewerModal analysis={analysis} />
    </div>
  );
}
