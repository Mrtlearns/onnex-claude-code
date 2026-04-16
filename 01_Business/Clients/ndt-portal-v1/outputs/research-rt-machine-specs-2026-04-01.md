# Research: Industrial RT Machine Technical Specifications

**Date:** 2026-04-01 | **Mode:** Standard | **Vertical:** NDT/Aerospace
**Primary Question:** What are the detailed technical specifications for common industrial X-ray/RT machines relevant to LLM-based technique planning?
**Decision It Informs:** Building accurate tube-specific parameter databases for the ndtv1 RT technique planner

---

## Key Findings

1. **All four machines share similar architecture** -- 320kV or 225kV stationary anode, oil or water cooled, dual focal spot, tungsten target, directional beam with 40 degree cone angle. Confidence: High

2. **The Varex NDI-320-26 and Comet MXR-320/26 are near-equivalent competitors** -- both 320kV bipolar oil-cooled with 3.0/5.5mm (Comet) or 1.5/4.0mm (Varex) focal spots, 40 degree beam coverage, 20 degree target angle. Confidence: High

3. **Focal spot sizes per IEC/EN 12543 differ between manufacturers** -- Varex NDI-320-26 offers smaller spots (1.5/4.0mm) vs Comet MXR-320/26 (3.0/5.5mm), affecting geometric unsharpness calculations. Confidence: High

4. **Inherent filtration varies significantly** -- Varex uses 4mm Be, Comet MXR-320/26 uses 3mm Be, MXR-225/22 uses only 0.8mm Be. This affects beam hardening and dose calculations. Confidence: High

5. **Maximum continuous power ratings are focal-spot dependent** -- small focal = lower power (640-1500W), large focal = higher power (3000-4200W). Critical for exposure time calculations. Confidence: High

---

## Machine Specifications

### 1. Varian/Varex NDI-320-26

| Parameter | Value | Confidence | Source |
|-----------|-------|------------|--------|
| **Nominal Voltage** | 320 kV (160kV anode-to-ground, 160kV cathode-to-ground) | High | [Varex PDS](https://www.vareximaging.com/wp-content/uploads/2022/01/NDI-320-26_PDS_133112-000.pdf) |
| **Focal Spot (Small)** | 1.5 mm (IEC 336 / EN 12543) | High | [xrayllc.com](https://xrayllc.com/ndi320-26.pdf) |
| **Focal Spot (Large)** | 4.0 mm (IEC 336 / EN 12543) | High | [xrayllc.com](https://xrayllc.com/ndi320-26.pdf) |
| **Target Material** | Tungsten | High | [Varex PDS](https://www.vareximaging.com/wp-content/uploads/2022/01/NDI-320-26_PDS_133112-000.pdf) |
| **Target Angle** | 20 degrees | High | [xrayllc.com](https://www.xrayllc.com/varian_x-ray_tube.html) |
| **Radiation Coverage (Beam Angle)** | 40 degrees | High | [Yumpu NDI-320-23](https://www.yumpu.com/en/document/view/4523099/ndi-320-23-rev-e-varian) |
| **Inherent Filtration** | 4.0 mm Be | High | [Varex PDS](https://www.vareximaging.com/wp-content/uploads/2022/01/NDI-320-26_PDS_133112-000.pdf) |
| **Continuous Power (Small Focal)** | 1500 W @ 14 L/min oil flow | High | [Yumpu NDI-320-23](https://www.yumpu.com/en/document/view/4523099/ndi-320-23-rev-e-varian) |
| **Continuous Power (Large Focal)** | 4200 W @ 14 L/min oil flow | High | [xrayllc.com](https://xrayllc.com/ndi320-26.pdf) |
| **Maximum mA at 320kV** | 13 mA | High | [Varex PDS](https://www.vareximaging.com/wp-content/uploads/2022/01/NDI-320-26_PDS_133112-000.pdf) |
| **Cooling Type** | Oil cooled | High | [Varex PDS](https://www.vareximaging.com/wp-content/uploads/2022/01/NDI-320-26_PDS_133112-000.pdf) |
| **Cooling Flow** | 14 L/min minimum | High | [Yumpu NDI-320-23](https://www.yumpu.com/en/document/view/4523099/ndi-320-23-rev-e-varian) |
| **Max Leakage Radiation** | 5 mSv/h @ 1m (320kV, 13mA) | High | [Varex PDS](https://www.vareximaging.com/wp-content/uploads/2022/01/NDI-320-26_PDS_133112-000.pdf) |
| **Housing Type** | V-320 | High | [Yumpu NDI-320-23](https://www.yumpu.com/en/document/view/4523099/ndi-320-23-rev-e-varian) |
| **HV Cable Type** | R24 | High | [Varex PDS](https://www.vareximaging.com/wp-content/uploads/2022/01/NDI-320-26_PDS_133112-000.pdf) |
| **Weight** | 41.0 kg (90.4 lbs) | High | [Varex PDS](https://www.vareximaging.com/wp-content/uploads/2022/01/NDI-320-26_PDS_133112-000.pdf) |
| **Tube Construction** | Metal-ceramic, stationary anode | High | [Varex PDS](https://www.vareximaging.com/wp-content/uploads/2022/01/NDI-320-26_PDS_133112-000.pdf) |
| **Horn Angles Available** | 90 deg, 150 deg | High | [Yumpu NDI-320-23](https://www.yumpu.com/en/document/view/4523099/ndi-320-23-rev-e-varian) |

**NOT FOUND:**
- mA range (min-max) -- only max 13mA confirmed
- kV resolution/step size
- Duty cycle / max single exposure time
- Radiation output (mGy/min or R/min at 1m)
- Source-to-detector distance range
- Physical tube head dimensions (L x W x H)
- ASME/ASTM compliance notes
- Anode angle (distinct from target angle -- may be same)

---

### 2. Comet MXR-225/22

| Parameter | Value | Confidence | Source |
|-----------|-------|------------|--------|
| **Nominal Voltage** | 225 kV | High | [Comet Product Page](https://xray.comet.tech/en/products/mxr-225-22) |
| **Focal Spot (Small)** | 1.0 mm (EN 12543) | High | [Made-in-China listing](https://zxt-xray.en.made-in-china.com/product/CdIAbmflHxco/China-Comet-X-ray-Tube-for-X-ray-Machine-225kv-Mxr-225-22-.html) |
| **Focal Spot (Large)** | 5.5 mm (EN 12543) | High | [Made-in-China listing](https://zxt-xray.en.made-in-china.com/product/CdIAbmflHxco/China-Comet-X-ray-Tube-for-X-ray-Machine-225kv-Mxr-225-22-.html) |
| **Target Material** | Tungsten | High | [Comet Product Page](https://xray.comet.tech/en/products/mxr-225-22) |
| **Target Angle** | 20 degrees | High | [Made-in-China listing](https://zxt-xray.en.made-in-china.com/product/CdIAbmflHxco/China-Comet-X-ray-Tube-for-X-ray-Machine-225kv-Mxr-225-22-.html) |
| **Radiation Coverage (Beam Angle)** | 40 degrees | High | [Made-in-China listing](https://zxt-xray.en.made-in-china.com/product/CdIAbmflHxco/China-Comet-X-ray-Tube-for-X-ray-Machine-225kv-Mxr-225-22-.html) |
| **Inherent Filtration** | 0.8 +/- 0.1 mm Be | High | [Made-in-China listing](https://zxt-xray.en.made-in-china.com/product/CdIAbmflHxco/China-Comet-X-ray-Tube-for-X-ray-Machine-225kv-Mxr-225-22-.html) |
| **Continuous Power (Small Focal)** | 640 W | High | [Comet Product Page](https://xray.comet.tech/en/products/mxr-225-22) |
| **Continuous Power (Large Focal)** | 3000 W | High | [Comet Product Page](https://xray.comet.tech/en/products/mxr-225-22) |
| **Cooling Type** | Water cooled (unipolar) | High | [Comet Product Page](https://xray.comet.tech/en/products/mxr-225-22) |
| **Cooling Flow** | 4 L/min minimum | High | [Made-in-China listing](https://zxt-xray.en.made-in-china.com/product/CdIAbmflHxco/China-Comet-X-ray-Tube-for-X-ray-Machine-225kv-Mxr-225-22-.html) |
| **Weight** | 10.7 kg | High | [Made-in-China listing](https://zxt-xray.en.made-in-china.com/product/CdIAbmflHxco/China-Comet-X-ray-Tube-for-X-ray-Machine-225kv-Mxr-225-22-.html) |
| **Tube Construction** | Metal-ceramic, unipolar, integrated shielding | High | [Comet Product Page](https://xray.comet.tech/en/products/mxr-225-22) |
| **Beam Type** | Directional | High | [Comet Product Page](https://xray.comet.tech/en/products/mxr-225-22) |
| **HV Cable Type** | R24 | High | [Made-in-China listing](https://zxt-xray.en.made-in-china.com/product/CdIAbmflHxco/China-Comet-X-ray-Tube-for-X-ray-Machine-225kv-Mxr-225-22-.html) |
| **Max Leakage Radiation** | ~10 mSv/h @ 1m (inferred from MXR-225/21 and /26) | Medium | [Willick MXR-225/26](https://www.willick.com/wp-content/uploads/2021/05/comet-mxr-225_26_single_sheet_en_v13.pdf) |

**NOT FOUND:**
- mA range (min-max)
- kV resolution/step size
- Filament current/voltage specifications
- Duty cycle / max single exposure time
- Radiation output (mGy/min or R/min at 1m)
- Source-to-detector distance range
- Physical tube head dimensions (L x W x H)
- ASME/ASTM compliance notes
- IEC/ISO tube rating

---

### 3. Comet MXR-320/26

| Parameter | Value | Confidence | Source |
|-----------|-------|------------|--------|
| **Nominal Voltage** | 320 kV | High | [Comet Product Page](https://xray.comet.tech/en/products/mxr-320-26) |
| **Focal Spot (Small)** | 3.0 mm (EN 12543) | High | [Comet Product Page](https://xray.comet.tech/en/products/mxr-320-26) |
| **Focal Spot (Large)** | 5.5 mm (EN 12543) | High | [Comet Product Page](https://xray.comet.tech/en/products/mxr-320-26) |
| **Target Material** | Tungsten | High | [Comet Product Page](https://xray.comet.tech/en/products/mxr-320-26) |
| **Target Angle** | 20 degrees | High | [Willick Datasheet](https://www.willick.com/wp-content/uploads/2021/05/comet-mxr-320_26_single_sheet_en_v6.pdf) |
| **Radiation Coverage (Beam Angle)** | 40 degrees | High | [Willick Datasheet](https://www.willick.com/wp-content/uploads/2021/05/comet-mxr-320_26_single_sheet_en_v6.pdf) |
| **Inherent Filtration** | 3.0 mm Be | High | [Comet Product Page](https://xray.comet.tech/en/products/mxr-320-26) |
| **Continuous Power (Small Focal)** | 1500 W | High | [Comet Product Page](https://xray.comet.tech/en/products/mxr-320-26) |
| **Continuous Power (Large Focal)** | 4200 W | High | [Comet Product Page](https://xray.comet.tech/en/products/mxr-320-26) |
| **Filament Current (Small/Large)** | 4.9 A / 4.6 A max | High | [Willick Datasheet](https://www.willick.com/wp-content/uploads/2021/05/comet-mxr-320_26_single_sheet_en_v6.pdf) |
| **Filament Voltage (Small/Large)** | 2.6 V / 6.4 V typical | High | [Willick Datasheet](https://www.willick.com/wp-content/uploads/2021/05/comet-mxr-320_26_single_sheet_en_v6.pdf) |
| **Cooling Type** | Oil cooled (bipolar) | High | [Comet Product Page](https://xray.comet.tech/en/products/mxr-320-26) |
| **Cooling Flow** | 14 L/min minimum | High | [Willick Datasheet](https://www.willick.com/wp-content/uploads/2021/05/comet-mxr-320_26_single_sheet_en_v6.pdf) |
| **Max Cooling Inlet Temp** | 50 deg C | High | [Willick Datasheet](https://www.willick.com/wp-content/uploads/2021/05/comet-mxr-320_26_single_sheet_en_v6.pdf) |
| **Max Cooling Inlet Pressure** | 6 bar | High | [Willick Datasheet](https://www.willick.com/wp-content/uploads/2021/05/comet-mxr-320_26_single_sheet_en_v6.pdf) |
| **Max Leakage Radiation** | 5 mSv/h @ 1m | High | [Willick Datasheet](https://www.willick.com/wp-content/uploads/2021/05/comet-mxr-320_26_single_sheet_en_v6.pdf) |
| **Weight** | 40 kg | High | [Willick Datasheet](https://www.willick.com/wp-content/uploads/2021/05/comet-mxr-320_26_single_sheet_en_v6.pdf) |
| **Tube Construction** | Metal-ceramic, bipolar, integrated shielding | High | [Comet Product Page](https://xray.comet.tech/en/products/mxr-320-26) |
| **Beam Type** | Directional | High | [Comet Product Page](https://xray.comet.tech/en/products/mxr-320-26) |

**NOT FOUND:**
- mA range (min-max)
- kV resolution/step size
- Duty cycle / max single exposure time
- Radiation output (mGy/min or R/min at 1m)
- Source-to-detector distance range
- Physical tube head dimensions (L x W x H)
- HV cable type
- ASME/ASTM compliance notes
- IEC/ISO tube rating

---

### 4. Varex NDI-320-26 (Same as Varian NDI-320-26)

**Note:** Varex Imaging acquired Varian Medical Systems' Imaging Components business in 2017. The NDI-320-26 is the same product, now manufactured and sold by Varex. All specifications from Section 1 (Varian/Varex NDI-320-26) apply.

The tube is marketed identically under both brands depending on when documentation was produced. Current official source is Varex Imaging.

---

## Comparison Table for Technique Planning

| Parameter | Varex NDI-320-26 | Comet MXR-225/22 | Comet MXR-320/26 |
|-----------|------------------|------------------|------------------|
| **Max kV** | 320 | 225 | 320 |
| **Small Focal Spot** | 1.5 mm | 1.0 mm | 3.0 mm |
| **Large Focal Spot** | 4.0 mm | 5.5 mm | 5.5 mm |
| **Target Angle** | 20 deg | 20 deg | 20 deg |
| **Beam Cone Angle** | 40 deg | 40 deg | 40 deg |
| **Be Window** | 4.0 mm | 0.8 mm | 3.0 mm |
| **Max Power (Small)** | 1500 W | 640 W | 1500 W |
| **Max Power (Large)** | 4200 W | 3000 W | 4200 W |
| **Cooling** | Oil, 14 L/min | Water, 4 L/min | Oil, 14 L/min |
| **Weight** | 41 kg | 10.7 kg | 40 kg |
| **Max Leakage @ 1m** | 5 mSv/h | ~10 mSv/h | 5 mSv/h |

---

## NDT/Technique Planning Implications

### Focal Spot Selection
- **For high-resolution work (thin sections, fine defect detection):** Use small focal spot
  - MXR-225/22 offers smallest at 1.0mm -- best geometric unsharpness
  - NDI-320-26 at 1.5mm is second best
  - MXR-320/26 at 3.0mm has highest Ug for small spot mode
- **For thick sections requiring penetration:** Use large focal spot with higher mA
  - All tubes converge around 4-5.5mm
  - Power limits dictate max mA at given kV

### Geometric Unsharpness Calculation
Ug = F x (OFD / SFD)

Where F = focal spot size. The smaller focal spots on MXR-225/22 (1.0mm) and NDI-320-26 (1.5mm) allow shorter SFDs while maintaining acceptable Ug.

### Beam Coverage Geometry
All tubes have 40-degree cone angle. At a given SFD:
- Coverage diameter = 2 x SFD x tan(20 deg)
- At 36" SFD: coverage diameter ~ 26"
- At 48" SFD: coverage diameter ~ 35"

### Filtration Effects
- **MXR-225/22 (0.8mm Be):** Softer beam, lower inherent filtration. May need added filtration for thick steel.
- **MXR-320/26 (3.0mm Be):** Moderate hardening.
- **NDI-320-26 (4.0mm Be):** Most pre-hardened beam. Less scatter, slightly lower dose rate for same mA.

### Power-Limited Exposure Time
For a given technique requiring specific mA-minutes:
- At small focal spot: limited to 1500W (Varex, Comet 320) or 640W (Comet 225)
- At 320kV, 1500W = 4.7mA max
- At 225kV, 640W = 2.8mA max
- Longer exposure times needed at small focal spot

---

## Data Gaps and Recommendations

### Critical Missing Parameters for Technique Planning

1. **Radiation Output (mGy/min or R/min at 1m)** -- essential for exposure calculations
   - Recommendation: Contact manufacturers for output curves or use empirical calibration

2. **mA Range and Step Size** -- needed for fine exposure control
   - Recommendation: Generator specifications may provide this; tube specs typically show max only

3. **Duty Cycle / Max Continuous Exposure Time** -- critical for thick section work
   - Recommendation: Operating manuals or generator specs needed

4. **Physical Dimensions** -- needed for access planning in confined geometries
   - Recommendation: Request mechanical drawings from manufacturers

### Next Steps

1. Request official datasheets directly from Varex and Comet for missing parameters
2. If available, obtain generator specifications for the specific cabinets/vaults these tubes are installed in
3. Consider building a calibration dataset with actual output measurements at various kV/mA settings
4. Add ASTM E1030 and ASTM E1742 compliance notes once technique planning is operational

---

## Sources

| # | URL | Type | Verified | Used For |
|---|-----|------|----------|----------|
| 1 | [Varex NDI-320-26 PDS](https://www.vareximaging.com/wp-content/uploads/2022/01/NDI-320-26_PDS_133112-000.pdf) | Official Datasheet | Yes | NDI-320-26 specs |
| 2 | [xrayllc.com NDI-320-26](https://xrayllc.com/ndi320-26.pdf) | Distributor Datasheet | Yes | NDI-320-26 specs |
| 3 | [xrayllc Varian NDI Tubes](https://www.xrayllc.com/varian_x-ray_tube.html) | Distributor Page | Yes | Varian tube overview |
| 4 | [Yumpu NDI-321 Rev G](https://www.yumpu.com/en/document/view/4412143/ndi-321-rev-g-varian) | Archive Document | Yes | NDI-320 series specs |
| 5 | [Yumpu NDI-320-23 Rev E](https://www.yumpu.com/en/document/view/4523099/ndi-320-23-rev-e-varian) | Archive Document | Yes | NDI-320 series specs |
| 6 | [Comet MXR-225-22 Product Page](https://xray.comet.tech/en/products/mxr-225-22) | Official Product Page | Yes | MXR-225/22 specs |
| 7 | [Made-in-China MXR-225/22](https://zxt-xray.en.made-in-china.com/product/CdIAbmflHxco/China-Comet-X-ray-Tube-for-X-ray-Machine-225kv-Mxr-225-22-.html) | Reseller Listing | Yes | MXR-225/22 detailed specs |
| 8 | [Comet MXR-320-26 Product Page](https://xray.comet.tech/en/products/mxr-320-26) | Official Product Page | Yes | MXR-320/26 specs |
| 9 | [Willick MXR-320/26 Datasheet](https://www.willick.com/wp-content/uploads/2021/05/comet-mxr-320_26_single_sheet_en_v6.pdf) | Distributor Datasheet | Yes | MXR-320/26 detailed specs |
| 10 | [Willick MXR-225/26 Datasheet](https://www.willick.com/wp-content/uploads/2021/05/comet-mxr-225_26_single_sheet_en_v13.pdf) | Distributor Datasheet | Yes | MXR-225 series reference |
