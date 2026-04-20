# Challenges

## C1: LLM Accuracy on RT Analysis
- **Impact:** False positives/negatives in defect detection are a safety risk and liability issue
- **Approach:** Two-stage pipeline — Stage 1 classifies part and geometry first, Stage 2 uses dynamically assembled code-specific system prompts tailored to the exact part type. Ollama fallback for local verification.
- **Strategy ref:** S1

## C2: ITAR Compliance Complexity
- **Impact:** NDT/aerospace clients handle ITAR-controlled technical data — improper handling is a federal violation
- **Approach:** ndtv1-comply service classifies documents before any LLM processing. Sanitization removes controlled data before sending to cloud APIs. All data flow logged.

## C3: 3D Renderer Performance at Scale
- **Impact:** RT scans can have complex geometry — 500K triangle budget must hold at 60 FPS
- **Approach:** Renderer Design Spec v1.0 sets hard performance budgets. R3F/drei with instanced geometry. Raycaster tooltips only fire on user interaction.

## C4: NDT Market Sales Motion
- **Impact:** NDT companies are conservative — slow to adopt new technology
- **Approach:** Lead with ITAR compliance and AI accuracy as differentiators. Direct outreach to NDT firms doing aerospace RT work.