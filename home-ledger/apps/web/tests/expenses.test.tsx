import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ExpenseRecord, ProjectRecord, PropertyRecord, VendorRecord } from "../src/api/types";
import { ExpensesView } from "../src/expenses/ExpensesPage";
import {
  centsToDollarInput,
  dollarsToCents,
  expenseToFormValues,
  formValuesToExpenseInput,
  propertyOptionsFromRecords,
  toExpenseRows
} from "../src/expenses/expense-model";
import { vendorOptionsFromRecords } from "../src/vendors/vendor-model";

describe("Expenses screen", () => {
  it("maps expense records for compact grid display", () => {
    const rows = toExpenseRows([createExpense()]);

    expect(rows[0]).toMatchObject({
      expense: "Deck boards",
      vendor: "Cedarline Carpentry",
      linkedTo: "Office · Deck repair",
      category: "Repair Upkeep",
      recordTreatment: "Repair / upkeep",
      documentationStatus: "Needs follow-up",
      expenseDate: "06/05/2026",
      amount: "$2,480.00",
      openItems: "1 open",
      openItemCount: 1
    });
  });

  it("prefers saved vendor names over raw payee text in rows", () => {
    const rows = toExpenseRows([createExpense({
      vendor_id: "vendor-1",
      vendor_name: "Saved Cedarline",
      vendor_name_raw: "Legacy Cedarline"
    })]);

    expect(rows[0].vendor).toBe("Saved Cedarline");
  });

  it("renders the expenses grid, filters, and compact actions", () => {
    const html = renderToStaticMarkup(
      <ExpensesView
        activeFilter="all"
        expenses={[createExpense()]}
        formValues={expenseToFormValues()}
        onArchiveExpense={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onEditExpense={() => undefined}
        onFormChange={() => undefined}
        onNewExpense={() => undefined}
        onSaveExpense={() => undefined}
        projects={[createProject()]}
        propertyOptions={propertyOptionsFromRecords([createProperty()])}
        vendorOptions={vendorOptionsFromRecords([createVendor()])}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Expense records");
    expect(html).toContain("Add expense");
    expect(html).toContain("Open items");
    expect(html).toContain("Cedarline Carpentry");
    expect(html).toContain("Deck boards");
    expect(html).toContain("Repair / upkeep");
    expect(html).toContain("Needs follow-up");
    expect(html).toContain("$2,480.00");
    expect(html).toContain("Archive");
  });

  it("renders empty and filtered states with direct copy", () => {
    const html = renderToStaticMarkup(
      <ExpensesView
        activeFilter="open"
        errorMessage="Expenses could not be loaded."
        expenses={[createExpense({ open_item_count: 0 })]}
        formValues={expenseToFormValues()}
        onArchiveExpense={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onEditExpense={() => undefined}
        onFormChange={() => undefined}
        onNewExpense={() => undefined}
        onSaveExpense={() => undefined}
        projects={[createProject()]}
        propertyOptions={propertyOptionsFromRecords([createProperty()])}
        vendorOptions={vendorOptionsFromRecords([createVendor()])}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Expenses could not be loaded.");
    expect(html).toContain("No expenses for this filter");
    expect(html).toContain("Clear the expense filter to see all expenses.");
  });

  it("renders add and edit modal fields with dependent project options", () => {
    const html = renderToStaticMarkup(
      <ExpensesView
        expenses={[createExpense()]}
        formValues={expenseToFormValues(createExpense())}
        modalMode="edit"
        onArchiveExpense={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onEditExpense={() => undefined}
        onFormChange={() => undefined}
        onNewExpense={() => undefined}
        onSaveExpense={() => undefined}
        projects={[
          createProject(),
          createProject({ id: "project-2", property_id: "property-2", name: "Bathroom remodel" })
        ]}
        propertyOptions={propertyOptionsFromRecords([
          createProperty(),
          createProperty({ id: "property-2", name: "Rental" })
        ])}
        selectedExpense={createExpense()}
        vendorOptions={vendorOptionsFromRecords([createVendor()])}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Edit expense");
    expect(html).toContain("Save expense");
    expect(html).toContain("Property");
    expect(html).toContain("Project");
    expect(html).toContain("Vendor/payee");
    expect(html).toContain("Payee name if unassigned");
    expect(html).toContain("Cedarline Carpentry");
    expect(html).toContain("Review type");
    expect(html).toContain("Documentation");
    expect(html).toContain("Deck repair");
    expect(html).not.toContain("Bathroom remodel");
    expect(html).not.toContain("deductible");
    expect(html).not.toContain("IRS");
  });

  it("normalizes selected vendor values to safe expense API input", () => {
    expect(centsToDollarInput(248000)).toBe("2480.00");
    expect(dollarsToCents("$2,480.55")).toBe(248055);
    expect(formValuesToExpenseInput({
      propertyId: "property-1",
      projectId: "project-1",
      vendorId: "vendor-1",
      vendorNameRaw: " Cedarline Carpentry ",
      expenseDate: "2026-06-05",
      description: " Deck boards ",
      amount: "2480.00",
      category: " repair_upkeep ",
      recordTreatment: "repair_upkeep",
      documentationStatus: "needs_follow_up",
      notes: ""
    })).toEqual({
      property_id: "property-1",
      project_id: "project-1",
      vendor_id: "vendor-1",
      vendor_name_raw: null,
      expense_date: "2026-06-05",
      description: "Deck boards",
      amount_cents: 248000,
      currency_code: "USD",
      category: "repair_upkeep",
      record_treatment: "repair_upkeep",
      documentation_status: "needs_follow_up",
      notes: null
    });
  });

  it("preserves raw payee fallback when no saved vendor is selected", () => {
    expect(formValuesToExpenseInput({
      propertyId: "property-1",
      projectId: "project-1",
      vendorId: "",
      vendorNameRaw: " Cedarline Carpentry ",
      expenseDate: "2026-06-05",
      description: "Deck boards",
      amount: "2480.00",
      category: "repair_upkeep",
      recordTreatment: "repair_upkeep",
      documentationStatus: "needs_follow_up",
      notes: ""
    })).toMatchObject({
      vendor_id: null,
      vendor_name_raw: "Cedarline Carpentry"
    });
  });
});

function createExpense(overrides: Partial<ExpenseRecord> = {}): ExpenseRecord {
  return {
    id: "expense-1",
    property_id: "property-1",
    property_name: "Office",
    project_id: "project-1",
    project_name: "Deck repair",
    vendor_id: null,
    vendor_name: null,
    vendor_name_raw: "Cedarline Carpentry",
    expense_date: "2026-06-05",
    description: "Deck boards",
    amount_cents: 248000,
    currency_code: "USD",
    category: "repair_upkeep",
    record_treatment: "repair_upkeep",
    documentation_status: "needs_follow_up",
    notes: null,
    document_count: 0,
    open_item_count: 1,
    deleted_at: null,
    created_at: "2026-06-07T12:00:00.000Z",
    updated_at: "2026-06-07T12:00:00.000Z",
    ...overrides
  };
}

function createProject(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: "project-1",
    property_id: "property-1",
    property_name: "Office",
    vendor_id: null,
    vendor_name: null,
    name: "Deck repair",
    category: "repair_upkeep",
    status: "in_progress",
    start_date: "2026-06-01",
    completion_date: null,
    contractor_name_raw: "Cedarline Carpentry",
    permit_number: null,
    scope_summary: "Deck repair scope",
    notes: null,
    completeness_override_note: null,
    completeness_overridden_at: null,
    open_item_count: 1,
    archived_at: null,
    created_at: "2026-06-07T12:00:00.000Z",
    updated_at: "2026-06-07T12:00:00.000Z",
    ...overrides
  };
}

function createVendor(overrides: Partial<VendorRecord> = {}): VendorRecord {
  return {
    id: "vendor-1",
    name: "Cedarline Carpentry",
    normalized_name: "cedarline carpentry",
    category: "repair_upkeep",
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

function createProperty(overrides: Partial<PropertyRecord> = {}): PropertyRecord {
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
    updated_at: "2026-06-07T12:00:00.000Z",
    ...overrides
  };
}
