import './_group.css';

export function Current() {
  return (
    <main className="rang-product-preview">
      <div className="eyebrow">RANG / operations console</div>
      <h1>Product editor</h1>
      <p className="preview-subtitle">Specifications and fitment are currently entered as raw JSON.</p>
      <form className="form-sample">
        <section className="preview-section">
          <label className="label">
            Specifications <span className="eyebrow">JSON object</span>
            <textarea
              className="field mono"
              rows={9}
              aria-label="Product specifications JSON"
              defaultValue={'{\n  "Power": "12 V vehicle socket",\n  "Display": "Digital pressure readout",\n  "Included": "Air hose and carry bag"\n}'}
            />
          </label>
        </section>
        <section className="preview-section">
          <label className="label">
            Fitment ranges <span className="eyebrow">JSON array: make, model, yearFrom, yearTo, verified</span>
            <textarea
              className="field mono"
              rows={9}
              aria-label="Vehicle compatibility JSON"
              defaultValue={'[\n  {\n    "make": "Honda",\n    "model": "TRX420",\n    "yearFrom": 2014,\n    "yearTo": 2024,\n    "verified": true\n  }\n]'}
            />
          </label>
        </section>
      </form>
    </main>
  );
}
