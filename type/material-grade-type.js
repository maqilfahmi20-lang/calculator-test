/**
 * MaterialGrade represents the mechanical properties of a timber grade.
 *
 * Properties:
 *  - E    : Modulus of Elasticity parallel to grain (MPa / N/mm²)
 *  - E90  : Modulus of Elasticity perpendicular to grain (MPa)
 *  - G    : In-plane shear modulus (MPa)
 *  - G90  : Rolling shear modulus / out-of-plane shear (MPa)
 *           Used by the Gamma Method for cross-layer connector stiffness.
 */
class MaterialGrade {
    /**
     * @param {string} name  - Grade name, e.g. "MGP10"
     * @param {number} E     - MOE parallel to grain (MPa)
     * @param {number} E90   - MOE perpendicular to grain (MPa)
     * @param {number} G     - In-plane shear modulus (MPa)
     * @param {number} G90   - Rolling shear modulus (MPa) – used for cross-layers in Gamma Method
     */
    constructor(name, E, E90, G, G90) {
        this.name = name;
        this.E    = E;
        this.E90  = E90;
        this.G    = G;
        this.G90  = G90;
    }
}

/**
 * Predefined timber grades matching the Excel workbook.
 * Source: floor-panel-properties.xlsx, "Panel Properties" sheet, Grade List (P8:T9)
 *
 *  Grade   E      E90   G       G90
 *  MGP10   1100   110   687.5   62.5
 *  MGP12   1100   110   687.5   62.5
 */
const MaterialGrades = {
    MGP10: new MaterialGrade('MGP10', 1100, 110, 687.5, 62.5),
    MGP12: new MaterialGrade('MGP12', 1100, 110, 687.5, 62.5),
};
