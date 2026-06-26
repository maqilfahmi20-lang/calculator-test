/**
 * PanelPropertiesType stores the final calculated properties of a CLT panel.
 *
 * Units follow the Excel workbook convention:
 *  - EI_eff : Effective bending stiffness  (N·mm²/m)  — per 1000 mm width (beff = 1000 mm)
 *  - totalThickness : mm
 *  - method : 'ShearAnalogy' | 'Gamma'
 */
class PanelPropertiesType {
    constructor() {
        /** @type {CLTLayerPropertiesType[]} */
        this.layers         = [];
        this.totalThickness = 0;      // mm
        this.EI_eff         = 0;      // N·mm²/m  (beff = 1000 mm)
        this.method         = '';     // 'ShearAnalogy' | 'Gamma'
        this.isValid        = false;
        this.errorMessage   = '';
    }
}
