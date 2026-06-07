import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PropertyRecord } from "../src/api/types";
import { PropertiesView } from "../src/properties/PropertiesPage";
import { dollarsToCents, formValuesToPropertyInput, propertyToFormValues, toPropertyRows } from "../src/properties/property-model";

describe("Properties screen", () => {
  it("maps property records for compact grid display", () => {
    const rows = toPropertyRows([createProperty()]);

    expect(rows[0]).toMatchObject({
      name: "Office",
      address: "1124 Huminger Drive",
      purchaseDate: "01/01/2024",
      purchasePrice: "$200,000.00",
      isPrimary: true
    });
  });

  it("renders the properties grid and compact actions", () => {
    const html = renderToStaticMarkup(
      <PropertiesView
        formValues={propertyToFormValues()}
        onArchiveProperty={() => undefined}
        onCloseModal={() => undefined}
        onEditProperty={() => undefined}
        onFormChange={() => undefined}
        onNewProperty={() => undefined}
        onSaveProperty={() => undefined}
        properties={[createProperty()]}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Property records");
    expect(html).toContain("Add property");
    expect(html).toContain("1124 Huminger Drive");
    expect(html).toContain("$200,000.00");
    expect(html).toContain("Primary property");
    expect(html).toContain("Archive");
  });

  it("renders empty and error states with direct copy", () => {
    const html = renderToStaticMarkup(
      <PropertiesView
        errorMessage="Properties could not be loaded."
        formValues={propertyToFormValues()}
        onArchiveProperty={() => undefined}
        onCloseModal={() => undefined}
        onEditProperty={() => undefined}
        onFormChange={() => undefined}
        onNewProperty={() => undefined}
        onSaveProperty={() => undefined}
        properties={[]}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Properties could not be loaded.");
    expect(html).toContain("No properties");
    expect(html).toContain("Add a property to start organizing projects, expenses, and documents.");
  });

  it("renders add and edit modal fields", () => {
    const html = renderToStaticMarkup(
      <PropertiesView
        formValues={propertyToFormValues(createProperty())}
        modalMode="edit"
        onArchiveProperty={() => undefined}
        onCloseModal={() => undefined}
        onEditProperty={() => undefined}
        onFormChange={() => undefined}
        onNewProperty={() => undefined}
        onSaveProperty={() => undefined}
        properties={[createProperty()]}
        selectedProperty={createProperty()}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Edit property");
    expect(html).toContain("Save property");
    expect(html).toContain("Purchase date");
    expect(html).toContain("Purchase price");
    expect(html).toContain("Primary property");
  });

  it("normalizes form values to safe property API input", () => {
    expect(dollarsToCents("$1,234.56")).toBe(123456);
    expect(formValuesToPropertyInput({
      name: " Office ",
      displayAddress: " 1124 Huminger Drive ",
      purchaseDate: "2024-01-01",
      purchasePrice: "200000",
      notes: "",
      isPrimary: true
    })).toEqual({
      name: "Office",
      display_address: "1124 Huminger Drive",
      purchase_date: "2024-01-01",
      purchase_price_cents: 20000000,
      currency_code: "USD",
      notes: null,
      is_primary: true
    });
  });
});

function createProperty(overrides: Partial<PropertyRecord> = {}): PropertyRecord {
  return {
    id: "property-1",
    name: "Office",
    display_address: "1124 Huminger Drive",
    purchase_date: "2024-01-01",
    purchase_price_cents: 20000000,
    currency_code: "USD",
    notes: null,
    is_primary: true,
    archived_at: null,
    created_at: "2026-06-07T12:00:00.000Z",
    updated_at: "2026-06-07T12:00:00.000Z",
    ...overrides
  };
}
