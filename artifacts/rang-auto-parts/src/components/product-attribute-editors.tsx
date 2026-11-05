import { Plus, Trash2 } from "lucide-react";

export type ProductSpecificationRow = {
  id: string;
  name: string;
  value: string;
  kind: "text" | "number" | "boolean" | "json";
};

export type ProductFitmentRow = {
  id: string;
  make: string;
  model: string;
  yearFrom: string;
  yearTo: string;
  verified: boolean;
};

type SpecificationEditorProps = {
  rows: ProductSpecificationRow[];
  onChange: (rows: ProductSpecificationRow[]) => void;
};

type FitmentEditorProps = {
  rows: ProductFitmentRow[];
  onChange: (rows: ProductFitmentRow[]) => void;
};

function newId() {
  return globalThis.crypto.randomUUID();
}

export function ProductSpecificationsEditor({ rows, onChange }: SpecificationEditorProps) {
  const update = (id: string, changes: Partial<ProductSpecificationRow>) => {
    onChange(rows.map((row) => row.id === id ? { ...row, ...changes } : row));
  };

  return (
    <section className="attribute-editor wide" aria-labelledby="product-specifications-title">
      <div className="attribute-editor-heading">
        <div>
          <h3 id="product-specifications-title">Specifications</h3>
          <p>Add product details such as power, size, material, or included parts.</p>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => onChange([...rows, { id: newId(), name: "", value: "", kind: "text" }])}
          data-testid="button-add-product-specification"
        >
          <Plus size={15} /> Add specification
        </button>
      </div>

      {rows.length ? (
        <div className="attribute-row-stack">
          {rows.map((row, index) => (
            <div className="attribute-row specification-row" key={row.id}>
              <label className="label">
                Name
                <input
                  className="field"
                  value={row.name}
                  maxLength={100}
                  placeholder="e.g. Power"
                  onChange={(event) => update(row.id, { name: event.target.value })}
                  data-testid={`input-product-specification-name-${index}`}
                />
              </label>
              <label className="label">
                Value type
                <select
                  className="field"
                  value={row.kind}
                  onChange={(event) => {
                    const kind = event.target.value as ProductSpecificationRow["kind"];
                    update(row.id, {
                      kind,
                      value: kind === "boolean" ? "false" : kind === "json" && !row.value ? "{}" : row.value,
                    });
                  }}
                  data-testid={`select-product-specification-type-${index}`}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Yes / No</option>
                  {row.kind === "json" && <option value="json">Advanced JSON</option>}
                </select>
              </label>
              <label className="label">
                Value
                {row.kind === "boolean" ? (
                  <select
                    className="field"
                    value={row.value}
                    onChange={(event) => update(row.id, { value: event.target.value })}
                    data-testid={`select-product-specification-value-${index}`}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : row.kind === "json" ? (
                  <textarea
                    className="field"
                    rows={2}
                    value={row.value}
                    onChange={(event) => update(row.id, { value: event.target.value })}
                    aria-label={`Advanced JSON value for ${row.name || `specification ${index + 1}`}`}
                    data-testid={`input-product-specification-value-${index}`}
                  />
                ) : (
                  <input
                    className="field"
                    type={row.kind === "number" ? "number" : "text"}
                    step={row.kind === "number" ? "any" : undefined}
                    value={row.value}
                    placeholder={row.kind === "number" ? "e.g. 12" : "e.g. 12 V vehicle socket"}
                    onChange={(event) => update(row.id, { value: event.target.value })}
                    data-testid={`input-product-specification-value-${index}`}
                  />
                )}
              </label>
              <button
                type="button"
                className="btn btn-outline attribute-remove"
                aria-label={`Remove ${row.name || `specification ${index + 1}`}`}
                onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
                data-testid={`button-remove-product-specification-${index}`}
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="attribute-empty">No specifications yet. Add a detail customers can use to compare this part.</p>
      )}
    </section>
  );
}

export function ProductFitmentEditor({ rows, onChange }: FitmentEditorProps) {
  const update = (id: string, changes: Partial<ProductFitmentRow>) => {
    onChange(rows.map((row) => row.id === id ? { ...row, ...changes } : row));
  };

  return (
    <section className="attribute-editor wide" aria-labelledby="product-fitment-title">
      <div className="attribute-editor-heading">
        <div>
          <h3 id="product-fitment-title">Vehicles this part fits</h3>
          <p>Add a vehicle and its model-year range. Leave this blank if fitment is unknown.</p>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => onChange([...rows, { id: newId(), make: "", model: "", yearFrom: "", yearTo: "", verified: false }])}
          data-testid="button-add-product-fitment"
        >
          <Plus size={15} /> Add vehicle
        </button>
      </div>

      {rows.length ? (
        <div className="attribute-row-stack">
          {rows.map((row, index) => (
            <div className="attribute-row fitment-row" key={row.id}>
              <label className="label">
                Make
                <input
                  className="field"
                  value={row.make}
                  maxLength={100}
                  placeholder="e.g. Honda"
                  onChange={(event) => update(row.id, { make: event.target.value })}
                  data-testid={`input-product-fitment-make-${index}`}
                />
              </label>
              <label className="label">
                Model
                <input
                  className="field"
                  value={row.model}
                  maxLength={100}
                  placeholder="e.g. TRX420"
                  onChange={(event) => update(row.id, { model: event.target.value })}
                  data-testid={`input-product-fitment-model-${index}`}
                />
              </label>
              <label className="label">
                Year from
                <input
                  className="field"
                  type="number"
                  min="1886"
                  max="2100"
                  value={row.yearFrom}
                  placeholder="2014"
                  onChange={(event) => update(row.id, { yearFrom: event.target.value })}
                  data-testid={`input-product-fitment-year-from-${index}`}
                />
              </label>
              <label className="label">
                Year to
                <input
                  className="field"
                  type="number"
                  min="1886"
                  max="2100"
                  value={row.yearTo}
                  placeholder="2024"
                  onChange={(event) => update(row.id, { yearTo: event.target.value })}
                  data-testid={`input-product-fitment-year-to-${index}`}
                />
              </label>
              <label className="attribute-check">
                <input
                  type="checkbox"
                  checked={row.verified}
                  onChange={(event) => update(row.id, { verified: event.target.checked })}
                  data-testid={`input-product-fitment-verified-${index}`}
                />
                Verified
              </label>
              <button
                type="button"
                className="btn btn-outline attribute-remove"
                aria-label={`Remove vehicle ${row.make || index + 1}`}
                onClick={() => onChange(rows.filter((item) => item.id !== row.id))}
                data-testid={`button-remove-product-fitment-${index}`}
              >
                <Trash2 size={14} /> Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="attribute-empty">No vehicles listed. Leave this section empty if fitment has not been confirmed.</p>
      )}
      <p className="attribute-note">Only mark a vehicle verified after confirming the fitment information.</p>
    </section>
  );
}
