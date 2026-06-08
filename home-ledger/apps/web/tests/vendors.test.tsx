import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { VendorRecord } from "../src/api/types";
import { VendorsView } from "../src/vendors/VendorsPage";
import {
  filterVendorRows,
  formValuesToVendorInput,
  toVendorRows,
  vendorToFormValues
} from "../src/vendors/vendor-model";

describe("Vendors screen", () => {
  it("maps vendor records for compact grid display without internal fields", () => {
    const rows = toVendorRows([createVendor()]);

    expect(rows[0]).toMatchObject({
      name: "Cedarline Carpentry",
      category: "Deck/Patio/Porch",
      contact: "Morgan Lee",
      phone: "555-0100",
      email: "morgan@example.test",
      website: "cedarline.example",
      status: "Active"
    });
  });

  it("renders vendor grid actions and compact filters", () => {
    const html = renderToStaticMarkup(
      <VendorsView
        formValues={vendorToFormValues()}
        onArchiveVendor={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onEditVendor={() => undefined}
        onFormChange={() => undefined}
        onNewVendor={() => undefined}
        onSaveVendor={() => undefined}
        vendors={[createVendor()]}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Vendor records");
    expect(html).toContain("Add vendor");
    expect(html).toContain("With contact");
    expect(html).toContain("Cedarline Carpentry");
    expect(html).toContain("Morgan Lee");
    expect(html).toContain("555-0100");
    expect(html).toContain("morgan@example.test");
    expect(html).toContain("cedarline.example");
    expect(html).toContain("Edit");
    expect(html).toContain("Archive");
    expect(html).not.toContain("normalized_name");
    expect(html).not.toContain("source_confidence");
    expect(html).not.toContain("workspace_id");
  });

  it("renders loading empty and error states with direct copy", () => {
    const html = renderToStaticMarkup(
      <VendorsView
        errorMessage="Vendors could not be loaded."
        formValues={vendorToFormValues()}
        loading={false}
        onArchiveVendor={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onEditVendor={() => undefined}
        onFormChange={() => undefined}
        onNewVendor={() => undefined}
        onSaveVendor={() => undefined}
        vendors={[]}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Vendors could not be loaded.");
    expect(html).toContain("No vendors");
    expect(html).toContain("Add people and companies you paid or hired.");
  });

  it("filters vendors by category and contact availability", () => {
    const rows = toVendorRows([
      createVendor(),
      createVendor({
        id: "vendor-2",
        name: "County Permit Office",
        category: "permit",
        contact_name: null,
        phone: null,
        email: null,
        website: null
      })
    ]);

    expect(filterVendorRows(rows, "with_contact").map((row) => row.name)).toEqual(["Cedarline Carpentry"]);
    expect(filterVendorRows(rows, "category:permit").map((row) => row.name)).toEqual(["County Permit Office"]);
  });

  it("renders filtered empty state", () => {
    const html = renderToStaticMarkup(
      <VendorsView
        activeFilter="category:permit"
        formValues={vendorToFormValues()}
        onArchiveVendor={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onEditVendor={() => undefined}
        onFormChange={() => undefined}
        onNewVendor={() => undefined}
        onSaveVendor={() => undefined}
        vendors={[createVendor()]}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("No vendors for this filter");
    expect(html).toContain("Clear the vendor filter to see all vendors.");
  });

  it("renders add and edit modal fields with duplicate-safe copy", () => {
    const html = renderToStaticMarkup(
      <VendorsView
        formValues={vendorToFormValues(createVendor())}
        modalMode="edit"
        onArchiveVendor={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onEditVendor={() => undefined}
        onFormChange={() => undefined}
        onNewVendor={() => undefined}
        onSaveVendor={() => undefined}
        selectedVendor={createVendor()}
        vendors={[createVendor()]}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Edit vendor");
    expect(html).toContain("Save vendor");
    expect(html).toContain("Similar names are allowed.");
    expect(html).toContain("Contact name");
    expect(html).toContain("Email");
    expect(html).toContain("Website");
    expect(html).not.toContain("deductible");
    expect(html).not.toContain("audit");
  });

  it("normalizes form values to safe vendor API input", () => {
    expect(formValuesToVendorInput({
      name: " Cedarline Carpentry ",
      category: " deck/patio/porch ",
      contactName: " Morgan Lee ",
      phone: " 555-0100 ",
      email: " MORGAN@EXAMPLE.TEST ",
      website: " https://cedarline.example ",
      notes: ""
    })).toEqual({
      name: "Cedarline Carpentry",
      category: "deck/patio/porch",
      contact_name: "Morgan Lee",
      phone: "555-0100",
      email: "morgan@example.test",
      website: "https://cedarline.example",
      notes: null,
      status: "active"
    });
  });
});

function createVendor(overrides: Partial<VendorRecord> = {}): VendorRecord {
  return {
    id: "vendor-1",
    name: "Cedarline Carpentry",
    normalized_name: "cedarline carpentry",
    category: "deck/patio/porch",
    contact_name: "Morgan Lee",
    phone: "555-0100",
    email: "morgan@example.test",
    website: "https://cedarline.example",
    notes: "Deck repair estimates",
    status: "active",
    source_confidence: "user_confirmed",
    archived_at: null,
    created_at: "2026-06-07T12:00:00.000Z",
    updated_at: "2026-06-07T12:00:00.000Z",
    ...overrides
  };
}
