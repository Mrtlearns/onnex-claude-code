# Onnex NDT Skill

Onnex serves the Non-Destructive Testing (NDT) and aerospace inspection vertical. Apply this domain knowledge when working on ndtv1, NDT client deliverables, or RT/UT analysis systems.

---

## NDT Method Overview

| Method | Abbreviation | What It Detects | Common Application |
|--------|-------------|-----------------|-------------------|
| Radiographic Testing | RT | Internal defects, voids, inclusions | Welds, castings, pressure vessels |
| Ultrasonic Testing | UT | Thickness, internal flaws, cracks | Pipelines, structural components |
| Penetrant Testing | PT | Surface-breaking defects | Machined parts, castings |
| Magnetic Particle | MT | Near-surface defects (ferromagnetic) | Welds, shafts, forgings |
| Eddy Current | ET | Surface/near-surface cracks, conductivity | Tubing, aircraft skins |
| Visual Testing | VT | Surface conditions | All components, baseline method |

---

## RT (Radiographic Testing) — Primary Focus for ndtv1

### Key Concepts
- **Film vs Digital (DR/CR)**: Traditional film vs digital radiography/computed radiography
- **Source**: X-ray machine or gamma source (Ir-192, Se-75, Co-60) — affects penetrating power
- **IQI/Penetrameter**: Image Quality Indicator — verifies image sensitivity
- **SFD**: Source-to-Film Distance — affects geometric unsharpness
- **Density**: Film optical density — must meet code requirements (typically 2.0-4.0)
- **Geometric Unsharpness (Ug)**: Blur from source size and geometry — must meet code limits

### Defect Types in RT
- Porosity (gas pockets — rounded indications)
- Slag inclusions (elongated, irregular)
- Lack of fusion / incomplete penetration
- Cracks (linear, high-severity)
- Undercut (groove along weld toe)
- Burn-through / excessive penetration

### Code Standards
- **ASME**: Boiler & Pressure Vessel Code — Sections I, V, VIII most common
- **AWS D1.1**: Structural welding — steel
- **API 1104**: Pipeline welding
- **ASTM**: Material and method standards (E94, E1742 for RT)
- **ASNT SNT-TC-1A**: Personnel qualification and certification

---

## ndtv1 Platform Context

### Architecture
- **Three-service pipeline**: `ndtv1-comply` → `ndtv1-sanitize` → `ndtv1-gateway`
- **ITAR handling**: All ITAR-flagged documents processed on-prem via Ollama only
- **Presidio**: Custom NDT entity recognizers for part numbers, spec references, personnel certs
- **LLM routing**: Controlled content → Ollama (local), uncontrolled → Anthropic/OpenAI fallback

### RT Scan Analysis Pipeline (Two-Stage)
1. **Stage 1 — Part Classification**: LLM identifies component type, applicable code, weld joint configuration
2. **Stage 2 — Code-Specific Analysis**: Specialized RT analysis using code-appropriate acceptance criteria

### Three.js / R3F Visualization
- Pressure vessel 3D rendering with inspection zone overlays
- Zustand state management for scan/defect state
- Overlay geometry factories for defect annotation
- Component: cylindrical shells, heads (hemispherical, elliptical, flat), nozzles

### Key Entities for Presidio Custom Recognizers
- Part/component numbers (alphanumeric, client-specific formats)
- Weld joint identifiers
- Radiographer certification numbers (ASNT Level II/III)
- Procedure qualification records (PQR numbers)
- Heat/lot numbers

---

## UT (Ultrasonic Testing) — Secondary Focus

### Key Concepts
- **A-scan**: Amplitude vs time display — basic UT output
- **B-scan**: Cross-section view
- **C-scan**: Plan view (top-down map of indications)
- **Phased Array UT (PAUT)**: Multi-element probes, electronic scanning
- **TOFD**: Time of Flight Diffraction — accurate sizing

### Thickness Measurement
- Primary application: corrosion monitoring on pipelines, vessels
- UT Price Calculator: built for Onnex NDT clients — inputs: material, thickness range, access conditions

---

## Business Context

### Client Profile
- NDT inspection companies and aerospace MRO shops
- Typically 5-50 inspectors, paper-heavy workflows
- Pain points: manual report generation, compliance tracking, cert management, scheduling
- Decision makers: Chief Inspector, Quality Manager, Owner/Ops Manager

### Onnex NDT Deliverables
- RT scan analysis automation (ndtv1)
- UT price/costing calculator
- Compliance document management
- Inspector certification tracking
- Report generation automation (n8n + LLM)
- ShareCRM demo environment (NDT/aerospace vertical)

### ITAR Sensitivity
- Technical data on defense-related components is ITAR-controlled
- RT/UT data on military parts, aircraft components, weapons systems = ITAR
- Commercial pressure vessels, pipelines = typically not ITAR
- When in doubt: on-prem processing only, flag for client legal review

---

## Terminology Quick Reference

| Term | Meaning |
|------|---------|
| IQI | Image Quality Indicator (penetrameter) |
| HAZ | Heat Affected Zone |
| PWHT | Post Weld Heat Treatment |
| NDT/NDE | Non-Destructive Testing / Evaluation (interchangeable) |
| CUI | Corrosion Under Insulation |
| MRO | Maintenance, Repair & Overhaul |
| PQR | Procedure Qualification Record |
| WPS | Welding Procedure Specification |
| ASNT Level II | Certified inspector — can perform and interpret |
| ASNT Level III | Senior cert — can develop procedures, train |
