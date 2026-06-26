/**
 * CLTLayupType represents the full CLT panel built from multiple layers.
 * Layers are ordered from top (index 0) to bottom.
 */
class CLTLayupType {
    /**
     * @param {string} name - Descriptive name for the layup
     */
    constructor(name = 'CLT Layup') {
        this.name = name;
        /** @type {CLTLayerType[]} */
        this.layers = [];
    }

    /**
     * Add a layer to the bottom of the layup.
     * @param {CLTLayerType} layer
     */
    addLayer(layer) {
        this.layers.push(layer);
    }

    /**
     * Remove the last layer.
     * No-op if the layup is already empty.
     */
    removeLastLayer() {
        if (this.layers.length === 0) return;
        this.layers.pop();
    }

    /**
     * Remove layer at specific index.
     * @param {number} index - Must be within [0, layerCount - 1]
     * @throws {RangeError} if index is out of bounds
     */
    removeLayerAt(index) {
        if (index < 0 || index >= this.layers.length) {
            throw new RangeError(
                `removeLayerAt: index ${index} is out of bounds (layerCount = ${this.layers.length}).`
            );
        }
        this.layers.splice(index, 1);
    }

    /**
     * Get all layers.
     * @returns {CLTLayerType[]}
     */
    getLayers() {
        return this.layers;
    }

    /**
     * Total panel thickness in mm.
     * @returns {number}
     */
    getTotalThickness() {
        return this.layers.reduce((sum, l) => sum + l.thickness, 0);
    }

    /**
     * Number of layers.
     * @returns {number}
     */
    getLayerCount() {
        return this.layers.length;
    }

    /**
     * Check if layup is symmetric (top-to-bottom mirror).
     * Checks: thickness, orientation, and material grade name for each mirrored pair.
     *
     * Returns false for an empty layup (no layers cannot be considered symmetric).
     *
     * @returns {boolean}
     */
    isSymmetric() {
        const n = this.layers.length;
        if (n === 0) return false;
        for (let i = 0; i < Math.floor(n / 2); i++) {
            const top    = this.layers[i];
            const bottom = this.layers[n - 1 - i];
            if (
                top.thickness   !== bottom.thickness   ||
                top.orientation !== bottom.orientation ||
                top.grade.name  !== bottom.grade.name
            ) {
                return false;
            }
        }
        return true;
    }
}
