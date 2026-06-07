import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ProjectRecord } from "../src/api/types";
import { ProjectsView } from "../src/projects/ProjectsPage";
import {
  formValuesToProjectInput,
  projectToFormValues,
  propertyOptionsFromRecords,
  toProjectRows
} from "../src/projects/project-model";

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
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Project records");
    expect(html).toContain("Add project");
    expect(html).toContain("Open items");
    expect(html).toContain("Kitchen overhaul");
    expect(html).toContain("Office");
    expect(html).toContain("In progress");
    expect(html).toContain("2 open");
    expect(html).toContain("Edit");
    expect(html).toContain("Archive");
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
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Projects could not be loaded.");
    expect(html).toContain("No projects for this filter");
    expect(html).toContain("Clear the project filter to see all projects.");
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
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Edit project");
    expect(html).toContain("Save project");
    expect(html).toContain("Property");
    expect(html).toContain("Status");
    expect(html).toContain("Vendor or contractor");
    expect(html).toContain("Permit number");
    expect(html).not.toContain("deductible");
  });

  it("normalizes form values to safe project API input", () => {
    expect(formValuesToProjectInput({
      propertyId: "property-1",
      name: " Kitchen overhaul ",
      category: " kitchen ",
      status: "in_progress",
      startDate: "2026-06-01",
      completionDate: "",
      contractorNameRaw: " Summit Heating & Air ",
      permitNumber: "",
      scopeSummary: " Cabinets and lighting ",
      notes: ""
    })).toEqual({
      property_id: "property-1",
      name: "Kitchen overhaul",
      category: "kitchen",
      status: "in_progress",
      start_date: "2026-06-01",
      completion_date: null,
      contractor_name_raw: "Summit Heating & Air",
      permit_number: null,
      scope_summary: "Cabinets and lighting",
      notes: null
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
