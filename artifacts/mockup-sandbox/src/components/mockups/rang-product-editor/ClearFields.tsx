import { useState } from 'react';
import './_group.css';

type SpecRow = { id: number; name: string; value: string; kind: 'text' | 'number' | 'boolean' };
type VehicleRow = { id: number; make: string; model: string; from: string; to: string; verified: boolean };

const initialSpecs: SpecRow[] = [
  { id: 1, name: 'Power', value: '12 V vehicle socket', kind: 'text' },
  { id: 2, name: 'Display', value: 'Digital pressure readout', kind: 'text' },
  { id: 3, name: 'Included', value: 'Air hose and carry bag', kind: 'text' },
];

const initialVehicles: VehicleRow[] = [
  { id: 1, make: 'Honda', model: 'TRX420', from: '2014', to: '2024', verified: true },
];

export function ClearFields() {
  const [specs, setSpecs] = useState(initialSpecs);
  const [vehicles, setVehicles] = useState(initialVehicles);
  const nextId = () => Math.max(0, ...specs.map(row => row.id), ...vehicles.map(row => row.id)) + 1;

  return (
    <main className="rang-product-preview">
      <div className="eyebrow">RANG / operations console</div>
      <h1>Product details</h1>
      <p className="preview-subtitle">Add the details in plain fields. No code or special formatting needed.</p>
      <form className="form-sample">
        <section className="preview-section preview-wide">
          <div className="preview-section-heading">
            <div>
              <h2>Specifications</h2>
              <p>Details customers can use to compare this part.</p>
            </div>
            <button
              className="preview-button preview-button-primary"
              type="button"
              onClick={() => setSpecs(rows => [...rows, { id: nextId(), name: '', value: '', kind: 'text' }])}
            >+ Add specification</button>
          </div>
          {specs.length ? (
            <div className="preview-row-stack">
              {specs.map((row, index) => (
                <div className="preview-row preview-spec-row" key={row.id}>
                  <label className="label">Name
                    <input className="field" value={row.name} placeholder="e.g. Power" onChange={e => setSpecs(rows => rows.map(item => item.id === row.id ? { ...item, name: e.target.value } : item))} />
                  </label>
                  <label className="label">Value type
                    <select className="field" value={row.kind} onChange={e => setSpecs(rows => rows.map(item => item.id === row.id ? { ...item, kind: e.target.value as SpecRow['kind'], value: e.target.value === 'boolean' ? 'false' : item.value } : item))}>
                      <option value="text">Text</option><option value="number">Number</option><option value="boolean">Yes / No</option>
                    </select>
                  </label>
                  <label className="label">Value
                    {row.kind === 'boolean' ? (
                      <select className="field" value={row.value} onChange={e => setSpecs(rows => rows.map(item => item.id === row.id ? { ...item, value: e.target.value } : item))}>
                        <option value="true">Yes</option><option value="false">No</option>
                      </select>
                    ) : (
                      <input className="field" type={row.kind === 'number' ? 'number' : 'text'} step={row.kind === 'number' ? 'any' : undefined} value={row.value} placeholder={row.kind === 'number' ? 'e.g. 12' : 'e.g. 12 V vehicle socket'} onChange={e => setSpecs(rows => rows.map(item => item.id === row.id ? { ...item, value: e.target.value } : item))} />
                    )}
                  </label>
                  <button className="preview-button preview-button-danger" type="button" aria-label={`Remove ${row.name || `specification ${index + 1}`}`} onClick={() => setSpecs(rows => rows.filter(item => item.id !== row.id))}>Remove</button>
                </div>
              ))}
            </div>
          ) : <div className="preview-empty">No specifications yet. Add a detail such as size, power, material, or what is included.</div>}
        </section>

        <section className="preview-section preview-wide">
          <div className="preview-section-heading">
            <div>
              <h2>Vehicles this part fits</h2>
              <p>Add one row for each vehicle model and year range.</p>
            </div>
            <button
              className="preview-button preview-button-primary"
              type="button"
              onClick={() => setVehicles(rows => [...rows, { id: nextId(), make: '', model: '', from: '', to: '', verified: false }])}
            >+ Add vehicle</button>
          </div>
          {vehicles.length ? (
            <div className="preview-row-stack">
              {vehicles.map((row, index) => (
                <div className="preview-row preview-fitment-row" key={row.id}>
                  <label className="label">Make
                    <input className="field" value={row.make} placeholder="e.g. Honda" onChange={e => setVehicles(rows => rows.map(item => item.id === row.id ? { ...item, make: e.target.value } : item))} />
                  </label>
                  <label className="label">Model
                    <input className="field" value={row.model} placeholder="e.g. TRX420" onChange={e => setVehicles(rows => rows.map(item => item.id === row.id ? { ...item, model: e.target.value } : item))} />
                  </label>
                  <label className="label">Year from
                    <input className="field" type="number" min="1886" max="2100" value={row.from} placeholder="2014" onChange={e => setVehicles(rows => rows.map(item => item.id === row.id ? { ...item, from: e.target.value } : item))} />
                  </label>
                  <label className="label">Year to
                    <input className="field" type="number" min="1886" max="2100" value={row.to} placeholder="2024" onChange={e => setVehicles(rows => rows.map(item => item.id === row.id ? { ...item, to: e.target.value } : item))} />
                  </label>
                  <label className="preview-check"><input type="checkbox" checked={row.verified} onChange={e => setVehicles(rows => rows.map(item => item.id === row.id ? { ...item, verified: e.target.checked } : item))} /> Verified</label>
                  <button className="preview-button preview-button-danger" type="button" aria-label={`Remove vehicle ${row.make || index + 1}`} onClick={() => setVehicles(rows => rows.filter(item => item.id !== row.id))}>Remove</button>
                </div>
              ))}
            </div>
          ) : <div className="preview-empty">No vehicles listed. Leave this section empty if fitment has not been confirmed.</div>}
          <p className="preview-note">Only mark a vehicle verified after confirming the fitment information.</p>
        </section>
        <div className="preview-footer preview-wide"><button className="preview-button preview-button-primary" type="button">Save product</button></div>
      </form>
    </main>
  );
}
