/**
 * Panel Properties Calculation Module
 *
 * Implements two analytical methods that match the Excel workbook
 * "floor-panel-properties.xlsx", sheet "Panel Properties".
 *
 * Reference: proHolz Vol1, Sections 4.1.3 (Shear Analogy) and 4.2 (Gamma Method)
 *
 * beff = 1000 mm (per-meter width, matching Excel D18 = 1000)
 * All EI results are in N·mm²/m.
 *
 * Supported methods:
 *  1. Shear Analogy  – 3–9 layers, layup MUST be symmetric top-to-bottom
 *  2. Gamma Method   – exactly 3 or 5 layers, orientation pattern MUST be 0/90/0 or 0/90/0/90/0
 *
 * Usage (per assignment API):
 *   const result = new ShearAnalogyMethod().calculate(cltLayup);  // PanelPropertiesType
 *   const result = new GammaMethod(span_mm).calculate(cltLayup);  // PanelPropertiesType
 *
 *   // Factory convenience:
 *   PanelProperties.calculate(cltLayup, 'ShearAnalogy')
 *   PanelProperties.calculate(cltLayup, 'Gamma', span_mm)
 */

const BEFF = 1000; // mm — effective width per Excel D18 = 1000 mm

// ─────────────────────────────────────────────────────────────────────────────
// Base class — assignment API: calculate(CLTLayupType) → PanelPropertiesType
// ─────────────────────────────────────────────────────────────────────────────
class PanelProperties {
    /**
     * Calculate panel properties for a given CLT layup.
     * Must be implemented by each subclass.
     * @param {CLTLayupType} cltLayup
     * @returns {PanelPropertiesType}
     */
    calculate(cltLayup) { // eslint-disable-line no-unused-vars
        throw new Error('calculate() must be implemented by a subclass.');
    }

    /**
     * Factory convenience — delegates to the correct subclass.
     * @param {CLTLayupType} cltLayup
     * @param {string}       method      'ShearAnalogy' | 'Gamma'
     * @param {number}       [span=5000] Span in mm (Gamma method only)
     * @returns {PanelPropertiesType}
     */
    static calculate(cltLayup, method, span = 5000) {
        if (method === 'ShearAnalogy') {
            return new ShearAnalogyMethod().calculate(cltLayup);
        }
        if (method === 'Gamma') {
            return new GammaMethod(span).calculate(cltLayup);
        }
        const result = new PanelPropertiesType();
        result.isValid      = false;
        result.errorMessage = `Unknown method: "${method}". Use "ShearAnalogy" or "Gamma".`;
        return result;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shear Analogy Method  (proHolz Vol1, §4.1.3)
//
// Excel formula per layer (AF52 etc.):
//   EI_i = (beff·tᵢ³/12  +  beff·tᵢ·hᵢ²) · Eᵢ,XX
//
//   hᵢ    = distance from BOTTOM SURFACE of the panel to midpoint of layer i
//            (Excel AB column = Σ thicknesses below + tᵢ/2)
//   Eᵢ,XX = grade.E  when orientation = 0° (parallel layer contributes to bending)
//           = 0       when orientation = 90° (cross-layer has zero contribution in XX)
//   beff  = 1000 mm
//
// Validation:
//   - Layer count: 3–9
//   - Layup must be symmetric: thickness, grade, and orientation mirror top-to-bottom
// ─────────────────────────────────────────────────────────────────────────────
class ShearAnalogyMethod extends PanelProperties {
    /**
     * @param {CLTLayupType} cltLayup
     * @returns {PanelPropertiesType}
     */
    calculate(cltLayup) {
        const result = new PanelPropertiesType();
        result.method = 'ShearAnalogy';

        const layers = cltLayup.getLayers();
        const n      = layers.length;

        // ── Validation ───────────────────────────────────────────────────────
        if (n < 3 || n > 9) {
            result.isValid      = false;
            result.errorMessage = `Shear Analogy supports 3–9 layers. Current: ${n}.`;
            return result;
        }
        if (!cltLayup.isSymmetric()) {
            result.isValid      = false;
            result.errorMessage =
                'Shear Analogy requires a symmetric layup — thickness, grade, and ' +
                'orientation must mirror from top to bottom.';
            return result;
        }

        // ── hᵢ: matches Excel AB column formula ─────────────────────────────
        // Excel AB_i = SUM(layers[i..n-1].thickness) + layers[i].thickness / 2
        //            = (sum of all remaining panel from layer i downward) + tᵢ/2
        //
        // This is NOT simply z-from-bottom-to-midpoint. It equals:
        //   (layers below i) + tᵢ + tᵢ/2  =  z_bottom_of_layer_i + tᵢ + tᵢ/2
        //
        // Iterating top-down:
        //   remaining = totalThickness at start
        //   hᵢ = remaining + tᵢ/2   (remaining still includes tᵢ itself)
        //   remaining -= tᵢ
        const hi = new Array(n);
        let remaining = cltLayup.getTotalThickness();
        for (let i = 0; i < n; i++) {
            const t = layers[i].thickness;
            hi[i]   = remaining + t / 2;   // Excel: SUM(from i to end) + tᵢ/2
            remaining -= t;
        }

        // ── EI_eff  (beff = 1000 mm → N·mm²/m) ──────────────────────────────
        // EI_eff = Σ (beff·tᵢ³/12 + beff·tᵢ·hᵢ²) · Eᵢ,XX
        let EI_eff = 0;
        const layerProps = [];

        for (let i = 0; i < n; i++) {
            const layer    = layers[i];
            const t        = layer.thickness;
            const E        = layer.getExx();            // 0 for 90° cross-layers
            const I_beff   = BEFF * t * t * t / 12;
            const Steiner  = BEFF * t * hi[i] * hi[i];
            const EI_layer = (I_beff + Steiner) * E;

            EI_eff += EI_layer;

            layerProps.push(new CLTLayerPropertiesType(
                i, t, hi[i], E, I_beff, Steiner, EI_layer
                // gamma and ai remain null for Shear Analogy
            ));
        }

        result.layers         = layerProps;
        result.totalThickness = cltLayup.getTotalThickness();
        result.EI_eff         = EI_eff;
        result.isValid        = true;
        return result;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gamma Method  (proHolz Vol1, §4.2)
//
// Valid for exactly 3 or 5 layers.
// Required orientation pattern:
//   3-layer: 0° / 90° / 0°
//   5-layer: 0° / 90° / 0° / 90° / 0°
//
// ── Gamma coefficients (Excel AH column) ────────────────────────────────────
//
//   T1 (outer longitudinal, top):
//     γ₁ = 1 / (1 + π²·E₁·t₁ / (AD · G_roll₁ · Lref²))
//     AD = beff / t_cross₂,   G_roll₁ = G90 of adjacent cross-layer T2
//
//   Middle longitudinal layer (T2 in 3-layer, T3 in 5-layer):
//     γ = 1.0  always  (Excel AB="d2" → hardcoded 1)
//
//   T5 (outer longitudinal, bottom — 5-layer only):
//     γ₅ = 1 / (1 + π²·E₅·t₅ / (AD · G_roll₄ · (E₁)²))
//     NOTE: Excel cell AH78 references (AA74)² where AA74 = E₁ value (not Lref).
//     This is a cell-reference inconsistency in the Excel workbook.
//     We replicate it exactly to match Excel output.
//
// ── Eccentricities aᵢ (Excel AJ column) ────────────────────────────────────
//
//   For 5-layer:
//     a₂ = (γ₁·E₁·beff·t₁·(t₁/2+t₂+t₃/2) − γ₅·E₅·beff·t₅·(t₃/2+t₄+t₅/2))
//          / (γ₁·E₁·beff·t₁ + γ₃·E₃·beff·t₃ + γ₅·E₅·beff·t₅)
//     a₁ = (t₁/2 + t₂ + t₃/2) − a₂
//     a₃ = (t₃/2 + t₄ + t₅/2) + a₂
//
//   For 3-layer:
//     a₂ = (γ₁·E₁·beff·t₁·(t₁/2+t₂+t₃/2))
//          / (γ₁·E₁·beff·t₁ + γ₃·E₃·beff·t₃)
//     a₁ = (t₁/2 + t₂ + t₃/2) − a₂
//     (T3 has eccentricity a₂ about the neutral axis; T2 cross-layer has no aᵢ)
//
// ── EI per layer (Excel AM column) ──────────────────────────────────────────
//   EI_i = (beff·tᵢ³/12 + γᵢ · beff·tᵢ · aᵢ²) · Eᵢ
//   Cross-layers: aᵢ = null → EI_i = 0
// ─────────────────────────────────────────────────────────────────────────────
class GammaMethod extends PanelProperties {
    /**
     * @param {number} [span=5000] - Panel reference span Lref in mm (Excel H9 × 1000 = AA70)
     */
    constructor(span = 5000) {
        super();
        this.span = span;
    }

    /**
     * @param {CLTLayupType} cltLayup
     * @returns {PanelPropertiesType}
     */
    calculate(cltLayup) {
        const result = new PanelPropertiesType();
        result.method = 'Gamma';

        const layers = cltLayup.getLayers();
        const n      = layers.length;

        // ── Layer count validation ────────────────────────────────────────────
        if (n !== 3 && n !== 5) {
            result.isValid      = false;
            result.errorMessage = `Gamma Method supports only 3 or 5 layers. Current: ${n}.`;
            return result;
        }

        // ── Orientation pattern validation ───────────────────────────────────
        // Required: 0° / 90° / 0°  (3-layer)
        //           0° / 90° / 0° / 90° / 0°  (5-layer)
        const orientationError = this._validateOrientation(layers);
        if (orientationError) {
            result.isValid      = false;
            result.errorMessage = orientationError;
            return result;
        }

        const Lref = this.span;
        return n === 3
            ? this._calculate3Layer(layers, Lref, result)
            : this._calculate5Layer(layers, Lref, result);
    }

    /**
     * Validate that the layer orientation sequence matches the required CLT pattern.
     * @param {CLTLayerType[]} layers
     * @returns {string|null} error message, or null if valid
     */
    _validateOrientation(layers) {
        const n        = layers.length;
        const expected = n === 3 ? [0, 90, 0] : [0, 90, 0, 90, 0];

        for (let i = 0; i < n; i++) {
            if (layers[i].orientation !== expected[i]) {
                const pattern = n === 3 ? '0° / 90° / 0°' : '0° / 90° / 0° / 90° / 0°';
                return (
                    `Gamma Method requires orientation pattern: ${pattern}. ` +
                    `Layer ${i + 1} has ${layers[i].orientation}°, expected ${expected[i]}°.`
                );
            }
        }
        return null;
    }

    /**
     * γ coefficient for an outer longitudinal layer.
     *
     * Excel formula (AH74, AH78):
     *   γ = 1 / (1 + π²·E_long·t_long / (AD · G_roll · L²))
     *   AD = beff / t_cross
     *   G_roll = G90 of the adjacent cross-layer
     *
     * @param {CLTLayerType} longLayer   - Longitudinal layer (0°)
     * @param {CLTLayerType} crossLayer  - Adjacent cross-layer (90°)
     * @param {number}       L           - Reference length in mm
     * @returns {number}
     */
    _calcGamma(longLayer, crossLayer, L) {
        const E_long  = longLayer.grade.E;
        const t_long  = longLayer.thickness;
        const G_roll  = crossLayer.grade.G90;       // rolling shear of cross-layer
        const t_cross = crossLayer.thickness;
        const AD      = BEFF / t_cross;             // Excel: beff / t_cross

        return 1 / (1 + (Math.PI * Math.PI * E_long * t_long) / (AD * G_roll * L * L));
    }

    /**
     * 3-layer Gamma calculation.
     * Layer pattern: [0]=0°, [1]=90°, [2]=0°
     *
     * Excel gamma assignments (AH column):
     *   T1 (index 0, AB74="d1")  → γ₁ calculated using Lref
     *   T2 (index 1, cross-layer) → no gamma (AB75="d1,2", AG75="-")
     *   T3 (index 2, AB76="d2")  → γ₃ = 1.0  (labeled "d2" = middle in Excel convention)
     *
     * @param {CLTLayerType[]}      layers
     * @param {number}              Lref
     * @param {PanelPropertiesType} result
     * @returns {PanelPropertiesType}
     */
    _calculate3Layer(layers, Lref, result) {
        const [L1, L2, L3] = layers;

        const g1 = this._calcGamma(L1, L2, Lref); // outer top layer, uses Lref
        const g3 = 1.0;                            // bottom layer = "d2" in Excel → γ = 1.0

        const E1 = L1.grade.E, t1 = L1.thickness;
        const E3 = L3.grade.E, t3 = L3.thickness;
        const t2 = L2.thickness;

        // a₂ (Excel AJ76, AA69=3 branch):
        //   a₂ = (γ₁·E₁·beff·t₁·(t₁/2+t₂+t₃/2)) / (γ₁·E₁·beff·t₁ + γ₃·E₃·beff·t₃)
        const num = g1 * E1 * BEFF * t1 * (t1 / 2 + t2 + t3 / 2);
        const den = g1 * E1 * BEFF * t1 + g3 * E3 * BEFF * t3;
        const a2  = num / den;

        // a₁ = (t₁/2 + t₂ + t₃/2) − a₂  (Excel AJ74)
        const a1 = (t1 / 2 + t2 + t3 / 2) - a2;

        // gammas: T1=g1, T2=n/a (cross), T3=g3=1.0
        // ais:    T1=a1, T2=null (cross-layer, no eccentricity), T3=a2
        return this._buildResult(result, layers, [g1, null, g3], [a1, null, a2]);
    }

    /**
     * 5-layer Gamma calculation.
     * Layer pattern: [0]=0°, [1]=90°, [2]=0°, [3]=90°, [4]=0°
     *
     * Excel gamma assignments (AH column):
     *   T1 (index 0, AB74="d1")  → γ₁ calculated using Lref (AA70)
     *   T2 (index 1, cross)       → no gamma
     *   T3 (index 2, AB76="d2")  → γ₃ = 1.0  (middle layer, always)
     *   T4 (index 3, cross)       → no gamma
     *   T5 (index 4, AB78="d3")  → γ₅ calculated using E₁ as L
     *                               (Excel AH78 references (AA74)² = E₁²; see note in class doc)
     *
     * @param {CLTLayerType[]}      layers
     * @param {number}              Lref
     * @param {PanelPropertiesType} result
     * @returns {PanelPropertiesType}
     */
    _calculate5Layer(layers, Lref, result) {
        const [L1, L2, L3, L4, L5] = layers;

        const E1 = L1.grade.E, t1 = L1.thickness;
        const E3 = L3.grade.E, t3 = L3.thickness;
        const E5 = L5.grade.E, t5 = L5.thickness;
        const t2 = L2.thickness;
        const t4 = L4.thickness;

        // γ₁: outer top layer — uses Lref (Excel AH74 uses (AA70)² = Lref²)
        const g1 = this._calcGamma(L1, L2, Lref);
        // γ₃: middle layer — always 1.0 (Excel AB76="d2")
        const g3 = 1.0;
        // γ₅: outer bottom layer — Excel AH78 uses (AA74)² where AA74 = E₁ (not Lref)
        // This replicates the exact Excel cell reference to match the workbook output.
        const g5 = this._calcGamma(L5, L4, E1);

        // a₂ (Excel AJ76, AA69=5 branch):
        //   numerator   = γ₁·E₁·beff·t₁·(t₁/2+t₂+t₃/2) − γ₅·E₅·beff·t₅·(t₃/2+t₄+t₅/2)
        //   denominator = γ₁·E₁·beff·t₁ + γ₃·E₃·beff·t₃ + γ₅·E₅·beff·t₅
        const num = g1 * E1 * BEFF * t1 * (t1 / 2 + t2 + t3 / 2)
                  - g5 * E5 * BEFF * t5 * (t3 / 2 + t4 + t5 / 2);
        const den = g1 * E1 * BEFF * t1 + g3 * E3 * BEFF * t3 + g5 * E5 * BEFF * t5;
        const a2  = num / den;

        // a₁ = (t₁/2 + t₂ + t₃/2) − a₂  (Excel AJ74)
        const a1 = (t1 / 2 + t2 + t3 / 2) - a2;
        // a₃ = (t₃/2 + t₄ + t₅/2) + a₂  (Excel AJ78)
        const a3 = (t3 / 2 + t4 + t5 / 2) + a2;

        // gammas: T1=g1, T2=null(cross), T3=g3, T4=null(cross), T5=g5
        // ais:    T1=a1, T2=null,        T3=a2, T4=null,        T5=a3
        return this._buildResult(result, layers, [g1, null, g3, null, g5], [a1, null, a2, null, a3]);
    }

    /**
     * Build PanelPropertiesType from computed γ values and eccentricities.
     *
     * EI per layer (Excel AM column):
     *   Longitudinal layers (ai ≠ null):  EI_i = (beff·tᵢ³/12 + γᵢ·beff·tᵢ·aᵢ²) · Eᵢ
     *   Cross-layers (ai = null):          EI_i = 0
     *
     * @param {PanelPropertiesType}  result
     * @param {CLTLayerType[]}       layers
     * @param {(number|null)[]}      gammas  - γᵢ per layer; null for cross-layers
     * @param {(number|null)[]}      ais     - aᵢ per layer; null for cross-layers
     * @returns {PanelPropertiesType}
     */
    _buildResult(result, layers, gammas, ais) {
        let EI_eff = 0;
        const layerProps = [];

        for (let i = 0; i < layers.length; i++) {
            const layer  = layers[i];
            const t      = layer.thickness;
            const g      = gammas[i];
            const ai     = ais[i];
            const isCross = ai === null;

            const I_beff  = BEFF * t * t * t / 12;
            let   Steiner  = 0;
            let   EI_layer = 0;

            if (!isCross) {
                const E  = layer.grade.E;
                Steiner  = BEFF * t * ai * ai;
                EI_layer = (I_beff + g * Steiner) * E;
                EI_eff  += EI_layer;
            }

            layerProps.push(new CLTLayerPropertiesType(
                i,
                t,
                isCross ? 0 : ai,          // hi field: ai for long layers, 0 for cross
                isCross ? 0 : layer.grade.E, // E: 0 displayed for cross-layers
                I_beff,
                Steiner,
                EI_layer,
                isCross ? null : g,
                ai
            ));
        }

        result.layers         = layerProps;
        result.totalThickness = layers.reduce((s, l) => s + l.thickness, 0);
        result.EI_eff         = EI_eff;
        result.isValid        = true;
        return result;
    }
}
