/**
 * CLTLayerType represents a single lamination layer in a CLT panel.
 *
 * Properties:
 *  - thickness  : layer thickness in mm
 *  - grade      : MaterialGrade object
 *  - orientation: 0 = parallel to panel span (0°), 90 = perpendicular to span (90°)
 */
class CLTLayerType {
    /**
     * @param {number}        thickness   - Thickness in mm
     * @param {MaterialGrade} grade       - Timber grade (must include G90 for Gamma method)
     * @param {number}        orientation - 0 (parallel) or 90 (perpendicular)
     */
    constructor(thickness, grade, orientation = 0) {
        this.thickness   = thickness;
        this.grade       = grade;
        this.orientation = orientation; // degrees: 0 or 90
    }

    /**
     * Effective E modulus used in XX-direction bending stiffness calculations.
     *
     * Parallel layers (0°)      → E (full stiffness contributes to bending)
     * Perpendicular layers (90°)→ 0 (cross-layers do NOT contribute in XX direction)
     *
     * This matches Excel formula: Ei,XX = E when θ=0°, 0 when θ=90°
     *
     * @returns {number}
     */
    getExx() {
        return this.orientation === 0 ? this.grade.E : 0;
    }

    /**
     * Rolling shear modulus for this layer.
     * Used by the Gamma Method as the connector shear stiffness of cross-layers.
     * @returns {number}
     */
    getG90() {
        return this.grade.G90;
    }

    /**
     * In-plane shear modulus.
     * @returns {number}
     */
    getG() {
        return this.grade.G;
    }
}
