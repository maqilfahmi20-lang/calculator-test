/**
 * CLTLayerPropertiesType stores the computed section properties for a single layer.
 * Used as intermediate results inside panel property calculations.
 *
 * Shear Analogy fields: layerIndex, thickness, hi, E, I_beff, Steiner_beff, EI_layer
 * Gamma Method adds:    gamma, ai
 */
class CLTLayerPropertiesType {
    /**
     * @param {number} layerIndex   - Layer index (0-based, top to bottom)
     * @param {number} thickness    - Layer thickness t_i (mm)
     * @param {number} hi           - Distance from bottom of panel to layer midpoint (mm)
     *                                Used in Shear Analogy (matches Excel hi / AE column)
     * @param {number} E            - Effective E modulus used (MPa); 0 for cross-layers
     * @param {number} I_beff       - Own inertia with beff: beff*ti³/12 (mm⁴)
     * @param {number} Steiner_beff - Steiner term with beff: beff*ti*hi² (mm⁴)
     * @param {number} EI_layer     - Contribution to EI_eff: (I_beff + Steiner_beff)*E (N·mm²)
     * @param {number|null} gamma   - γ coefficient (Gamma method only; null for Shear Analogy)
     * @param {number|null} ai      - Eccentricity from effective neutral axis (mm, Gamma method)
     */
    constructor(layerIndex, thickness, hi, E, I_beff, Steiner_beff, EI_layer, gamma = null, ai = null) {
        this.layerIndex   = layerIndex;
        this.thickness    = thickness;
        this.hi           = hi;
        this.E            = E;
        this.I_beff       = I_beff;
        this.Steiner_beff = Steiner_beff;
        this.EI_layer     = EI_layer;
        this.gamma        = gamma;
        this.ai           = ai;
    }
}
