/**
 * calculator.js
 * UI controller for the CLT Panel Properties Calculator.
 *
 * Reads user input → builds CLTLayupType → calls PanelProperties.calculate()
 * → renders results.
 *
 * Assignment API used:
 *   ShearAnalogyMethod.calculate(CLTLayupType)  → PanelPropertiesType
 *   GammaMethod(span).calculate(CLTLayupType)   → PanelPropertiesType
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const MIN_LAYERS_SHEAR = 3;
const MAX_LAYERS_SHEAR = 9;
const GAMMA_ALLOWED_LAYERS = [3, 5];

// ─────────────────────────────────────────────────────────────────────────────
// Number formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Format a number to fixed decimals; returns "–" if null/NaN */
function fmt(value, decimals = 2) {
    if (value == null || isNaN(value)) return '–';
    return Number(value).toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

/** Large numbers in scientific notation (Excel-style: 1.43E+12), smaller ones fixed */
function fmtEI(value) {
    if (value == null || isNaN(value)) return '–';
    if (Math.abs(value) >= 1e9) return value.toExponential(4) + ' N·mm²/m';
    return fmt(value, 0) + ' N·mm²/m';
}

/** Scientific notation matching Excel display: 1.43E+12 for large, fixed for small */
function fmtSci(value) {
    if (value == null || isNaN(value)) return '0';
    if (value === 0) return '0.00E+00';
    if (Math.abs(value) >= 1e6 || (Math.abs(value) < 0.01 && value !== 0)) {
        // Format like Excel: 1.43E+12
        const exp = value.toExponential(2).toUpperCase();
        return exp.replace('E+', 'E+').replace('E-', 'E-');
    }
    return fmt(value, 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Page init
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderPage();
});

function renderPage() {
    const app = document.getElementById('app');
    app.innerHTML = `
    <div class="row g-4">

      <!-- ══════════════════ INPUT CARD ══════════════════ -->
      <div class="col-lg-5">
        <div class="card shadow-sm">
          <div class="card-header bg-primary text-white">
            <h5 class="mb-0"><i class="bi bi-sliders"></i> Input</h5>
          </div>
          <div class="card-body">

            <!-- Method -->
            <div class="mb-3">
              <label class="form-label fw-semibold">Analytical Method</label>
              <select id="methodSelect" class="form-select" onchange="onMethodChange()">
                <option value="ShearAnalogy">Shear Analogy (3–9 layers, symmetric)</option>
                <option value="Gamma">Gamma Method (3 or 5 layers)</option>
              </select>
            </div>

            <!-- Span — Gamma only -->
            <div class="mb-3" id="spanRow" style="display:none;">
              <label class="form-label fw-semibold">
                Panel Span L<sub>ref</sub>
                <small class="text-muted fw-normal">(mm)</small>
              </label>
              <input type="number" id="spanInput" class="form-control"
                     value="5000" min="500" max="30000" step="100">
              <div class="form-text text-muted">
                Used for γ coefficient of outer longitudinal layers.
              </div>
            </div>

            <!-- Number of layers -->
            <div class="mb-3">
              <label class="form-label fw-semibold">Number of Layers</label>
              <div class="input-group">
                <button class="btn btn-outline-secondary" onclick="changeLayerCount(-1)">−</button>
                <input type="number" id="layerCount" class="form-control text-center"
                       value="5" min="3" max="9" readonly>
                <button class="btn btn-outline-secondary" onclick="changeLayerCount(1)">+</button>
              </div>
              <div id="layerCountHint" class="form-text text-muted mt-1"></div>
            </div>

            <!-- Layer configuration table -->
            <div class="mb-3">
              <label class="form-label fw-semibold">
                Layer Configuration
                <small class="text-muted fw-normal">(top → bottom)</small>
              </label>
              <div class="table-responsive">
                <table class="table table-sm table-bordered align-middle mb-0" id="layersTable">
                  <thead class="table-light">
                    <tr>
                      <th>#</th>
                      <th>t (mm)</th>
                      <th>Grade</th>
                      <th>Orientation</th>
                    </tr>
                  </thead>
                  <tbody id="layersTbody"></tbody>
                </table>
              </div>
            </div>

            <button class="btn btn-primary w-100 fw-semibold" onclick="runCalculation()">
              Calculate
            </button>

          </div>
        </div>
      </div>

      <!-- ══════════════════ OUTPUT CARD ══════════════════ -->
      <div class="col-lg-7">
        <div id="outputSection">
          <div class="card shadow-sm h-100">
            <div class="card-header bg-secondary text-white">
              <h5 class="mb-0"><i class="bi bi-bar-chart"></i> Results</h5>
            </div>
            <div class="card-body d-flex align-items-center justify-content-center text-muted">
              Fill in the input and click <strong class="ms-1">Calculate</strong>.
            </div>
          </div>
        </div>
      </div>

    </div>`;

    renderLayersTable();
    updateHints();
}

// ─────────────────────────────────────────────────────────────────────────────
// Layer table
// ─────────────────────────────────────────────────────────────────────────────

function getLayerCount() {
    return parseInt(document.getElementById('layerCount').value, 10);
}

function getMethod() {
    return document.getElementById('methodSelect').value;
}

function renderLayersTable() {
    const n     = getLayerCount();
    const tbody = document.getElementById('layersTbody');
    if (!tbody) return;

    const grades = Object.keys(MaterialGrades);
    tbody.innerHTML = '';

    for (let i = 0; i < n; i++) {
        // Default: alternate 0°/90°, standard 35mm thickness
        const defOrientation = i % 2 === 0 ? '0' : '90';
        const defThickness   = 35;

        const gradeOptions = grades
            .map(g => `<option value="${g}">${g}</option>`)
            .join('');

        const row = document.createElement('tr');
        row.innerHTML = `
          <td class="text-center fw-semibold text-muted">${i + 1}</td>
          <td>
            <input type="number" class="form-control form-control-sm layer-thickness"
                   data-index="${i}" value="${defThickness}" min="1" max="500" step="1">
          </td>
          <td>
            <select class="form-select form-select-sm layer-grade" data-index="${i}">
              ${gradeOptions}
            </select>
          </td>
          <td>
            <select class="form-select form-select-sm layer-orientation" data-index="${i}">
              <option value="0"  ${defOrientation === '0'  ? 'selected' : ''}>0° (∥ parallel)</option>
              <option value="90" ${defOrientation === '90' ? 'selected' : ''}>90° (⊥ cross)</option>
            </select>
          </td>`;
        tbody.appendChild(row);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// UI event handlers
// ─────────────────────────────────────────────────────────────────────────────

function onMethodChange() {
    const method   = getMethod();
    const spanRow  = document.getElementById('spanRow');
    const countEl  = document.getElementById('layerCount');

    if (method === 'Gamma') {
        spanRow.style.display = '';
        // Snap layer count to nearest allowed Gamma value (3 or 5)
        const cur = parseInt(countEl.value, 10);
        if (!GAMMA_ALLOWED_LAYERS.includes(cur)) {
            countEl.value = '5';
            renderLayersTable();
        }
    } else {
        spanRow.style.display = 'none';
    }
    updateHints();
}

function changeLayerCount(delta) {
    const countEl = document.getElementById('layerCount');
    const method  = getMethod();
    const current = parseInt(countEl.value, 10);

    if (method === 'Gamma') {
        const idx  = GAMMA_ALLOWED_LAYERS.indexOf(current);
        const next = GAMMA_ALLOWED_LAYERS[idx + delta];
        if (next !== undefined) {
            countEl.value = next;
            renderLayersTable();
        }
    } else {
        const next = current + delta;
        if (next >= MIN_LAYERS_SHEAR && next <= MAX_LAYERS_SHEAR) {
            countEl.value = next;
            renderLayersTable();
        }
    }
    updateHints();
}

function updateHints() {
    const hint   = document.getElementById('layerCountHint');
    const method = getMethod();
    if (!hint) return;
    if (method === 'Gamma') {
        hint.textContent = 'Gamma Method: only 3 or 5 layers allowed.';
    } else {
        hint.textContent = 'Shear Analogy: 3–9 layers; layup must be symmetric top-to-bottom.';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build CLTLayupType from form values
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build CLTLayupType from the form.
 * Returns { layup, error } — error is null if input is valid.
 */
function buildLayup() {
    const n      = getLayerCount();
    const layup  = new CLTLayupType('Panel Layup');

    const thicknessEls   = document.querySelectorAll('.layer-thickness');
    const gradeEls       = document.querySelectorAll('.layer-grade');
    const orientationEls = document.querySelectorAll('.layer-orientation');

    for (let i = 0; i < n; i++) {
        const thickness   = parseFloat(thicknessEls[i].value);
        const gradeName   = gradeEls[i].value;
        const orientation = parseInt(orientationEls[i].value, 10);
        const grade       = MaterialGrades[gradeName];

        // Validate thickness > 0
        if (!thickness || thickness <= 0) {
            return {
                layup: null,
                error: `Layer ${i + 1}: thickness tidak boleh 0 atau kosong. `
                     + `Kalau kamu ingin panel dengan lebih sedikit layer, kurangi jumlah layer pakai tombol −.`
            };
        }

        layup.addLayer(new CLTLayerType(thickness, grade, orientation));
    }
    return { layup, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Run calculation — uses assignment API: calculator.calculate(CLTLayupType)
// ─────────────────────────────────────────────────────────────────────────────

function runCalculation() {
    const method          = getMethod();
    const { layup, error } = buildLayup();

    // Show input validation error
    if (error) {
        document.getElementById('outputSection').innerHTML = `
          <div class="card shadow-sm border-danger">
            <div class="card-header bg-danger text-white">
              <h5 class="mb-0"><i class="bi bi-exclamation-triangle"></i> Input Error</h5>
            </div>
            <div class="card-body">
              <p class="mb-0 text-danger">${error}</p>
            </div>
          </div>`;
        return;
    }

    let result;
    let spanUsed = null;

    if (method === 'ShearAnalogy') {
        result = new ShearAnalogyMethod().calculate(layup);
    } else {
        spanUsed = parseFloat(document.getElementById('spanInput').value) || 5000;
        result   = new GammaMethod(spanUsed).calculate(layup);
    }

    renderResult(result, layup, method, spanUsed);
}

// ─────────────────────────────────────────────────────────────────────────────
// Render results
// Layout mengikuti Excel: Section Properties + EI Calculation table
// Rule: ShearAnalogy → tampilkan Shear Analogy section saja
//       Gamma        → tampilkan Gamma section saja
// ─────────────────────────────────────────────────────────────────────────────

function renderResult(result, layup, method, spanUsed) {
    const container = document.getElementById('outputSection');

    // ── Validation / input error ──────────────────────────────────────────────
    if (!result.isValid) {
        container.innerHTML = `
          <div class="card shadow-sm border-danger">
            <div class="card-header bg-danger text-white">
              <h5 class="mb-0"><i class="bi bi-exclamation-triangle"></i> Validation Error</h5>
            </div>
            <div class="card-body">
              <p class="mb-0 text-danger">${result.errorMessage}</p>
            </div>
          </div>`;
        return;
    }

    const methodLabel = method === 'ShearAnalogy' ? 'Shear Analogy Method' : 'Gamma Method';
    const layers      = layup.getLayers();
    const n           = layers.length;

    // ── Summary result card ───────────────────────────────────────────────────
    const summaryHtml = `
      <div class="row g-3 mb-4">
        <div class="col-sm-4">
          <div class="card text-center border-primary h-100">
            <div class="card-body py-2">
              <div class="small text-muted">Total Thickness</div>
              <div class="fs-5 fw-bold text-primary">${fmt(result.totalThickness, 1)} mm</div>
            </div>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="card text-center border-secondary h-100">
            <div class="card-body py-2">
              <div class="small text-muted">No. of Layers</div>
              <div class="fs-5 fw-bold text-secondary">${n}</div>
            </div>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="card text-center border-success h-100">
            <div class="card-body py-2">
              <div class="small text-muted">(EI)<sub>eff</sub></div>
              <div class="fs-5 fw-bold text-success">${fmtEI(result.EI_eff)}</div>
            </div>
          </div>
        </div>
      </div>`;

    // ── Section Properties table (matches Excel left-hand display table) ──────
    // Columns: [-] | tᵢ (mm) | yᵢ (mm) | θᵢ (°) | Eᵢ,XX (MPa) | hᵢ (mm) | Gᵢ (MPa)
    const sectionPropsHtml = `
      <h6 class="fw-semibold mt-2">Section Properties</h6>
      <div class="table-responsive mb-3">
        <table class="table table-sm table-bordered align-middle mb-0">
          <thead class="table-light">
            <tr class="text-center">
              <th>[-]</th>
              <th>t<sub>i</sub><br><small class="fw-normal text-muted">mm</small></th>
              <th>y<sub>i</sub><br><small class="fw-normal text-muted">mm</small></th>
              <th>θ<sub>i</sub><br><small class="fw-normal text-muted">°</small></th>
              <th>E<sub>i,XX</sub><br><small class="fw-normal text-muted">MPa</small></th>
              <th>h<sub>i</sub><br><small class="fw-normal text-muted">mm</small></th>
              <th>G<sub>i</sub><br><small class="fw-normal text-muted">MPa</small></th>
            </tr>
          </thead>
          <tbody>
            ${layers.map((layer, i) => {
                const lp       = result.layers[i];
                const isCross  = layer.orientation === 90;
                // yᵢ = cumulative thickness from top to midpoint of layer i
                let yTop = 0;
                for (let k = 0; k < i; k++) yTop += layers[k].thickness;
                const yi = yTop + layer.thickness / 2;
                return `
                  <tr class="text-center ${isCross ? 'table-light text-muted' : ''}">
                    <td class="fw-semibold">T${i + 1}</td>
                    <td>${fmt(layer.thickness, 1)}</td>
                    <td>${fmt(yi, 1)}</td>
                    <td>${layer.orientation}.0</td>
                    <td>${fmt(lp.E, 1)}</td>
                    <td>${fmt(lp.hi, 1)}</td>
                    <td>${fmt(isCross ? layer.grade.G90 : layer.grade.G, 1)}</td>
                  </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    // ── Shear Analogy calculation table (matches Excel Shear Analogy Method table) ──
    // Columns: [-] | beff·tᵢ³/12 | beff·tᵢ·hᵢ² | Eᵢ,XX | EᵢIᵢ
    const shearHtml = method !== 'ShearAnalogy' ? '' : `
      <div id="shearAnalogySection">
        <h6 class="fw-semibold mt-3">Shear Analogy Method
          <small class="text-muted fw-normal fs-6"> — Effective Flexural Stiffness XX-direction</small>
        </h6>
        <p class="text-muted small mb-2">
          proHolz Vol1 §4.1.3 &nbsp;·&nbsp; b<sub>eff</sub> = 1000 mm &nbsp;·&nbsp;
          E<sub>i,XX</sub> = E untuk layer 0°, = 0 untuk layer 90°
        </p>
        <div class="table-responsive">
          <table class="table table-sm table-bordered align-middle mb-0">
            <thead>
              <tr class="table-primary text-center">
                <th>[-]</th>
                <th>b<sub>eff</sub>·t<sub>i</sub>³/12<br><small class="fw-normal">mm⁴</small></th>
                <th>b<sub>eff</sub>·t<sub>i</sub>·h<sub>i</sub>²<br><small class="fw-normal">mm⁴</small></th>
                <th>E<sub>i,XX</sub><br><small class="fw-normal">MPa</small></th>
                <th>E<sub>i</sub>I<sub>i</sub><br><small class="fw-normal">N·mm²/m</small></th>
              </tr>
            </thead>
            <tbody>
              ${result.layers.map((lp, i) => {
                  const isCross = layers[i].orientation === 90;
                  return `
                    <tr class="text-center ${isCross ? 'table-light text-muted' : ''}">
                      <td class="fw-semibold">T${i + 1}</td>
                      <td>${fmtSci(lp.I_beff)}</td>
                      <td>${fmtSci(lp.Steiner_beff)}</td>
                      <td>${fmt(lp.E, 0)}</td>
                      <td>${fmtSci(lp.EI_layer)}</td>
                    </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr class="table-primary fw-bold text-center">
                <td colspan="3" class="text-end pe-3">ΣE<sub>i</sub>I<sub>i</sub> &nbsp;XX</td>
                <td></td>
                <td>${fmtSci(result.EI_eff)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div class="alert alert-primary mt-3 py-2 d-flex justify-content-between align-items-center">
          <span class="fw-semibold">EI<sub>eff</sub> — Bending Stiffness</span>
          <span class="fs-5 fw-bold">${fmtEI(result.EI_eff)}</span>
        </div>
      </div>`;

    // ── Gamma Method calculation table (matches Excel Gamma Method table) ─────
    // Columns: [-] | Eᵢ | aᵢ | beff·tᵢ³/12 | beff·tᵢ·aᵢ² | γᵢ | EᵢIᵢ·eff·γ
    const spanLabel = spanUsed != null ? fmt(spanUsed, 0) : '–';
    const gammaHtml = method !== 'Gamma' ? '' : `
      <div id="gammaSection">
        <h6 class="fw-semibold mt-3">Gamma Method
          <small class="text-muted fw-normal fs-6"> — Effective Bending Stiffness</small>
        </h6>
        <p class="text-muted small mb-2">
          proHolz Vol1 §4.2 &nbsp;·&nbsp; b<sub>eff</sub> = 1000 mm &nbsp;·&nbsp;
          L<sub>ref</sub> = ${spanLabel} mm &nbsp;·&nbsp;
          Eff. Layers = ${n}
        </p>
        <div class="table-responsive">
          <table class="table table-sm table-bordered align-middle mb-0">
            <thead>
              <tr class="table-success text-center">
                <th>[-]</th>
                <th>E<sub>i</sub><br><small class="fw-normal">MPa</small></th>
                <th>a<sub>i</sub><br><small class="fw-normal">mm</small></th>
                <th>b<sub>eff</sub>·t<sub>i</sub>³/12<br><small class="fw-normal">mm⁴</small></th>
                <th>b<sub>eff</sub>·t<sub>i</sub>·a<sub>i</sub>²<br><small class="fw-normal">mm⁴</small></th>
                <th>γ<sub>i</sub><br><small class="fw-normal">-</small></th>
                <th>E<sub>i</sub>I<sub>i</sub><sup>eff,γ</sup><br><small class="fw-normal">N·mm²/m</small></th>
              </tr>
            </thead>
            <tbody>
              ${result.layers.map((lp, i) => {
                  const layer   = layers[i];
                  const isCross = layer.orientation === 90;
                  return `
                    <tr class="text-center ${isCross ? 'table-light text-muted' : ''}">
                      <td class="fw-semibold">T${i + 1}</td>
                      <td>${isCross ? '–' : fmt(lp.E, 0)}</td>
                      <td>${lp.ai !== null ? fmt(lp.ai, 4) : '–'}</td>
                      <td>${fmtSci(lp.I_beff)}</td>
                      <td>${isCross ? '–' : fmtSci(lp.Steiner_beff)}</td>
                      <td>${isCross ? '–' : fmt(lp.gamma, 8)}</td>
                      <td>${isCross ? '–' : fmtSci(lp.EI_layer)}</td>
                    </tr>`;
              }).join('')}
            </tbody>
            <tfoot>
              <tr class="table-success fw-bold text-center">
                <td colspan="5" class="text-end pe-3">ΣEI<sub>eff</sub></td>
                <td></td>
                <td>${fmtSci(result.EI_eff)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div class="alert alert-success mt-3 py-2 d-flex justify-content-between align-items-center">
          <span class="fw-semibold">(EI)<sub>eff</sub> — Bending Stiffness</span>
          <span class="fs-5 fw-bold">${fmtEI(result.EI_eff)}</span>
        </div>
      </div>`;

    container.innerHTML = `
      <div class="card shadow-sm">
        <div class="card-header bg-secondary text-white d-flex justify-content-between align-items-center">
          <h5 class="mb-0"><i class="bi bi-bar-chart"></i> Results</h5>
          <span class="badge bg-light text-dark">${methodLabel}</span>
        </div>
        <div class="card-body">
          ${summaryHtml}
          ${sectionPropsHtml}
          ${shearHtml}
          ${gammaHtml}
        </div>
      </div>`;
}
