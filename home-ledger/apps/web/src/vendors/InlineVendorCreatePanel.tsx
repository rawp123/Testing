import { FormField } from "../components/FormField";
import type { VendorFormValues } from "./vendor-model";

export function InlineVendorCreatePanel({
  errorMessage = "",
  saving = false,
  values,
  onCancel,
  onChange,
  onSave
}: {
  errorMessage?: string;
  saving?: boolean;
  values: VendorFormValues;
  onCancel: () => void;
  onChange: (values: VendorFormValues) => void;
  onSave: () => void;
}) {
  return (
    <section aria-label="Add vendor to this record" className="inline-create-panel">
      <div className="inline-create-header">
        <div>
          <h3>Add vendor</h3>
          <p>Save a vendor and select it for this record.</p>
        </div>
      </div>
      {errorMessage ? <div className="inline-error" role="alert">{errorMessage}</div> : null}
      <FormField helper="Similar names are allowed. Use the name shown on your records." label="Name">
        <input
          autoComplete="organization"
          name="inline_vendor_name"
          onChange={(event) => onChange({ ...values, name: event.currentTarget.value })}
          placeholder="Contractor, store, agency, or person"
          value={values.name}
        />
      </FormField>
      <div className="form-grid two-column">
        <FormField label="Contact name">
          <input
            autoComplete="name"
            name="inline_vendor_contact_name"
            onChange={(event) => onChange({ ...values, contactName: event.currentTarget.value })}
            value={values.contactName}
          />
        </FormField>
        <FormField label="Phone">
          <input
            autoComplete="tel"
            name="inline_vendor_phone"
            onChange={(event) => onChange({ ...values, phone: event.currentTarget.value })}
            value={values.phone}
          />
        </FormField>
      </div>
      <div className="form-grid two-column">
        <FormField label="Email">
          <input
            autoComplete="email"
            name="inline_vendor_email"
            onChange={(event) => onChange({ ...values, email: event.currentTarget.value })}
            type="email"
            value={values.email}
          />
        </FormField>
        <FormField label="Website">
          <input
            autoComplete="url"
            name="inline_vendor_website"
            onChange={(event) => onChange({ ...values, website: event.currentTarget.value })}
            value={values.website}
          />
        </FormField>
      </div>
      <FormField label="Notes">
        <textarea
          name="inline_vendor_notes"
          onChange={(event) => onChange({ ...values, notes: event.currentTarget.value })}
          value={values.notes}
        />
      </FormField>
      <div className="inline-create-actions">
        <button className="button button-secondary" disabled={saving} onClick={onCancel} type="button">Cancel</button>
        <button className="button button-primary" disabled={saving} onClick={onSave} type="button">
          {saving ? "Saving vendor" : "Save vendor"}
        </button>
      </div>
    </section>
  );
}
