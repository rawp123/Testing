import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProjectRecord, VendorRecord } from "../src/api/types";
import { ProjectsView } from "../src/projects/ProjectsPage";
import {
  applyProjectVendorSelection,
  formValuesToProjectInput,
  projectToFormValues,
  propertyOptionsFromRecords,
  toProjectRows
} from "../src/projects/project-model";
import { vendorOptionsFromRecords, vendorToFormValues } from "../src/vendors/vendor-model";

describe("Projects screen", () => {
  it("maps project records for compact grid display", () => {
    const rows = toProjectRows([createProject()]);

    expect(rows[0]).toMatchObject({
      name: "Kitchen overhaul",
      propertyName: "Office",
      category: "Kitchen",
      status: "In progress",
      dateRange: "06/01/2026 to not completed",
      contractor: "Summit Heating & Air",
      openItems: "2 open",
      openItemCount: 2
    });
  });

  it("renders project grid actions and open item filter", () => {
    const html = renderToStaticMarkup(
      <ProjectsView
        activeFilter="all"
        formValues={projectToFormValues()}
        onArchiveProject={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onEditProject={() => undefined}
        onFormChange={() => undefined}
        onNewProject={() => undefined}
        onSaveProject={() => undefined}
        projects={[createProject()]}
        propertyOptions={propertyOptionsFromRecords([createProperty()])}
        vendorOptions={vendorOptionsFromRecords([createVendor()])}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Project records");
    expect(html).toContain("Add project");
    expect(html).toContain("Open follow-ups");
    expect(html).toContain("Office");
    expect(html).toContain("Kitchen");
    expect(html).toContain("Kitchen overhaul");
    expect(html).toContain("Office");
    expect(html).toContain("In progress");
    expect(html).toContain("2 open");
    expect(html).toContain("Edit");
    expect(html).toContain("Archive");
    expect(html).not.toContain("workspace_id");
    expect(html).not.toContain("storage_key");
  });

  it("renders filtered empty and loading/error states with direct copy", () => {
    const html = renderToStaticMarkup(
      <ProjectsView
        activeFilter="open"
        errorMessage="Projects could not be loaded."
        formValues={projectToFormValues()}
        loading={false}
        onArchiveProject={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onEditProject={() => undefined}
        onFormChange={() => undefined}
        onNewProject={() => undefined}
        onSaveProject={() => undefined}
        projects={[createProject({ open_item_count: 0 })]}
        propertyOptions={propertyOptionsFromRecords([createProperty()])}
        vendorOptions={vendorOptionsFromRecords([createVendor()])}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Projects could not be loaded.");
    expect(html).toContain("No projects for this filter");
    expect(html).toContain("Clear the project filter to see all projects.");
  });

  it("filters projects by property context", () => {
    const html = renderToStaticMarkup(
      <ProjectsView
        activeFilter="property:property-2"
        formValues={projectToFormValues()}
        onArchiveProject={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onEditProject={() => undefined}
        onFormChange={() => undefined}
        onNewProject={() => undefined}
        onSaveProject={() => undefined}
        projects={[
          createProject(),
          createProject({
            id: "project-2",
            property_id: "property-2",
            property_name: "Lake house",
            name: "Dock repair",
            category: "deck/patio/porch",
            open_item_count: 0
          })
        ]}
        propertyOptions={propertyOptionsFromRecords([
          createProperty(),
          { ...createProperty(), id: "property-2", name: "Lake house" }
        ])}
        vendorOptions={vendorOptionsFromRecords([createVendor()])}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Dock repair");
    expect(html).toContain("Lake house");
    expect(html).not.toContain("Kitchen overhaul");
  });

  it("guides users to add a property before creating projects", () => {
    const html = renderToStaticMarkup(
      <ProjectsView
        formValues={projectToFormValues()}
        onArchiveProject={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onEditProject={() => undefined}
        onFormChange={() => undefined}
        onNewProject={() => undefined}
        onSaveProject={() => undefined}
        projects={[]}
        propertyOptions={[]}
        vendorOptions={[]}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Add a property first");
    expect(html).toContain("Projects need a property before they can be created.");
    expect(html).toContain("disabled");
  });

  it("renders add and edit modal fields with property selector", () => {
    const html = renderToStaticMarkup(
      <ProjectsView
        formValues={projectToFormValues(createProject())}
        modalMode="edit"
        onArchiveProject={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onEditProject={() => undefined}
        onFormChange={() => undefined}
        onNewProject={() => undefined}
        onSaveProject={() => undefined}
        projects={[createProject()]}
        propertyOptions={propertyOptionsFromRecords([createProperty()])}
        selectedProject={createProject()}
        vendorOptions={vendorOptionsFromRecords([createVendor()])}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Edit project");
    expect(html).toContain("Save project");
    expect(html).toContain("Property");
    expect(html).toContain("Status");
    expect(html).toContain("Add vendor");
    expect(html).toContain("Vendor name if unassigned");
    expect(html).toContain("Summit Heating &amp; Air");
    expect(html).toContain("Permit number");
    expect(html).not.toContain("deductible");
    expect(html).not.toContain("normalized_name");
  });

  it("normalizes selected vendor values to safe project API input", () => {
    expect(formValuesToProjectInput({
      propertyId: "property-1",
      vendorId: "vendor-1",
      name: " Kitchen overhaul ",
      category: " kitchen ",
      status: "in_progress",
      startDate: "2026-06-01",
      completionDate: "",
      contractorNameRaw: "",
      permitNumber: "",
      scopeSummary: " Cabinets and lighting ",
      notes: ""
    })).toEqual({
      property_id: "property-1",
      vendor_id: "vendor-1",
      name: "Kitchen overhaul",
      category: "kitchen",
      status: "in_progress",
      start_date: "2026-06-01",
      completion_date: null,
      contractor_name_raw: null,
      permit_number: null,
      scope_summary: "Cabinets and lighting",
      notes: null
    });
  });

  it("preserves raw contractor fallback when no saved vendor is selected", () => {
    expect(formValuesToProjectInput({
      propertyId: "property-1",
      vendorId: "",
      name: "Kitchen overhaul",
      category: "kitchen",
      status: "in_progress",
      startDate: "",
      completionDate: "",
      contractorNameRaw: " Summit Heating & Air ",
      permitNumber: "",
      scopeSummary: "",
      notes: ""
    })).toMatchObject({
      vendor_id: null,
      contractor_name_raw: "Summit Heating & Air"
    });
  });

  it("renders inline vendor creation inside the project form without hiding the project draft", () => {
    const html = renderToStaticMarkup(
      <ProjectsView
        formError="Project draft error"
        formValues={{
          ...projectToFormValues(createProject()),
          name: "Draft porch repair",
          contractorNameRaw: "New Porch Vendor"
        }}
        inlineVendorError="Vendor could not be saved."
        inlineVendorOpen
        inlineVendorValues={{
          ...vendorToFormValues(),
          name: "New Porch Vendor",
          contactName: "Alex"
        }}
        modalMode="create"
        onArchiveProject={() => undefined}
        onChangeFilter={() => undefined}
        onCloseInlineVendor={() => undefined}
        onCloseModal={() => undefined}
        onEditProject={() => undefined}
        onFormChange={() => undefined}
        onInlineVendorChange={() => undefined}
        onNewProject={() => undefined}
        onOpenInlineVendor={() => undefined}
        onSaveInlineVendor={() => undefined}
        onSaveProject={() => undefined}
        projects={[createProject()]}
        propertyOptions={propertyOptionsFromRecords([createProperty()])}
        vendorOptions={vendorOptionsFromRecords([createVendor()])}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Add project");
    expect(html).toContain("Draft porch repair");
    expect(html).toContain("Add vendor to this record");
    expect(html).toContain("Save a vendor and select it for this record.");
    expect(html).toContain("Similar names are allowed.");
    expect(html).toContain("New Porch Vendor");
    expect(html).toContain("Alex");
    expect(html).toContain("Vendor could not be saved.");
    expect(html).not.toContain("unique vendor");
    expect(html).not.toContain("duplicate vendor");
  });

  it("selects a created project vendor and clears only the raw contractor fallback", () => {
    const draft = {
      ...projectToFormValues(),
      propertyId: "property-1",
      name: "Draft project",
      category: "kitchen",
      contractorNameRaw: "Raw contractor",
      notes: "Keep this note"
    };

    expect(applyProjectVendorSelection(draft, "vendor-new")).toEqual({
      ...draft,
      vendorId: "vendor-new",
      contractorNameRaw: ""
    });
    expect(applyProjectVendorSelection(draft, "")).toEqual({
      ...draft,
      vendorId: "",
      contractorNameRaw: "Raw contractor"
    });
  });
});

function createProject(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: "project-1",
    property_id: "property-1",
    property_name: "Office",
    vendor_id: null,
    vendor_name: null,
    name: "Kitchen overhaul",
    category: "kitchen",
    status: "in_progress",
    start_date: "2026-06-01",
    completion_date: null,
    contractor_name_raw: "Summit Heating & Air",
    permit_number: null,
    scope_summary: "Cabinets and lighting",
    notes: null,
    completeness_override_note: null,
    completeness_overridden_at: null,
    open_item_count: 2,
    archived_at: null,
    created_at: "2026-06-07T12:00:00.000Z",
    updated_at: "2026-06-07T12:00:00.000Z",
    ...overrides
  };
}

function createVendor(overrides: Partial<VendorRecord> = {}): VendorRecord {
  return {
    id: "vendor-1",
    name: "Summit Heating & Air",
    normalized_name: "summit heating & air",
    category: "hvac",
    contact_name: null,
    phone: null,
    email: null,
    website: null,
    notes: null,
    status: "active",
    source_confidence: "user_confirmed",
    archived_at: null,
    created_at: "2026-06-07T12:00:00.000Z",
    updated_at: "2026-06-07T12:00:00.000Z",
    ...overrides
  };
}

function createProperty() {
  return {
    id: "property-1",
    name: "Office",
    display_address: "1124 Huminger Drive",
    purchase_date: "2024-01-01",
    purchase_price_cents: 20000000,
    currency_code: "USD",
    notes: null,
    is_primary: false,
    archived_at: null,
    created_at: "2026-06-07T12:00:00.000Z",
    updated_at: "2026-06-07T12:00:00.000Z"
  };
}
