import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DocumentRecord, ExpenseRecord, ProjectRecord, PropertyRecord } from "../src/api/types";
import { DocumentsView } from "../src/documents/DocumentsPage";
import {
  documentToFormValues,
  fileAvailabilityLabel,
  formValuesToDocumentInput,
  formatFileSize,
  propertyOptionsFromRecords,
  safeFileName,
  toDocumentRows
} from "../src/documents/document-model";

describe("Documents screen", () => {
  it("maps document records for compact grid display without local paths", () => {
    const rows = toDocumentRows([createDocument({
      file_availability: "available",
      file: createDocumentFile({ original_file_name: "/Users/robert/receipt.pdf" })
    })]);

    expect(rows[0]).toMatchObject({
      name: "Cedarline receipt",
      type: "Receipt",
      linkedTo: "Office · Deck repair · Deck boards",
      fileStatus: "Attached",
      documentDate: "06/05/2026",
      openItems: "1 open",
      openItemCount: 1,
      hasFile: true
    });
    expect(rows[0].fileMeta).toContain("receipt.pdf");
    expect(rows[0].fileMeta).not.toContain("/Users/robert");
  });

  it("renders the documents grid, filters, file status, and compact actions", () => {
    const html = renderToStaticMarkup(
      <DocumentsView
        activeFilter="all"
        documents={[createDocument({
          file_availability: "available",
          file: createDocumentFile()
        })]}
        expenses={[createExpense()]}
        formValues={documentToFormValues()}
        onArchiveDocument={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onDownloadFile={() => undefined}
        onEditDocument={() => undefined}
        onFileChange={() => undefined}
        onFormChange={() => undefined}
        onNewDocument={() => undefined}
        onRemoveFile={() => undefined}
        onSaveDocument={() => undefined}
        projects={[createProject()]}
        propertyOptions={propertyOptionsFromRecords([createProperty()])}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Document records");
    expect(html).toContain("Add document");
    expect(html).toContain("Open items");
    expect(html).toContain("Cedarline receipt");
    expect(html).toContain("Attached");
    expect(html).toContain("receipt.pdf");
    expect(html).toContain("View file");
    expect(html).toContain("Remove file");
    expect(html).toContain("Archive");
    expect(html).toContain("1 open");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("null");
  });

  it("renders empty and filtered states with direct copy", () => {
    const html = renderToStaticMarkup(
      <DocumentsView
        activeFilter="open"
        documents={[createDocument({ open_item_count: 0 })]}
        errorMessage="Documents could not be loaded."
        expenses={[createExpense()]}
        formValues={documentToFormValues()}
        onArchiveDocument={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onDownloadFile={() => undefined}
        onEditDocument={() => undefined}
        onFileChange={() => undefined}
        onFormChange={() => undefined}
        onNewDocument={() => undefined}
        onRemoveFile={() => undefined}
        onSaveDocument={() => undefined}
        projects={[createProject()]}
        propertyOptions={propertyOptionsFromRecords([createProperty()])}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Documents could not be loaded.");
    expect(html).toContain("No documents for this filter");
    expect(html).toContain("Clear the document filter to see all documents.");
  });

  it("renders add and edit modal fields with dependent expense options and upload control", () => {
    const html = renderToStaticMarkup(
      <DocumentsView
        documents={[createDocument()]}
        expenses={[
          createExpense({
            vendor_id: "vendor-1",
            vendor_name: "Saved Cedarline",
            vendor_name_raw: "Legacy Cedarline"
          }),
          createExpense({ id: "expense-2", property_id: "property-2", project_id: "project-2", description: "Bathroom tile" })
        ]}
        formValues={documentToFormValues(createDocument())}
        modalMode="edit"
        onArchiveDocument={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onDownloadFile={() => undefined}
        onEditDocument={() => undefined}
        onFileChange={() => undefined}
        onFormChange={() => undefined}
        onNewDocument={() => undefined}
        onRemoveFile={() => undefined}
        onSaveDocument={() => undefined}
        projects={[
          createProject(),
          createProject({ id: "project-2", property_id: "property-2", name: "Bathroom remodel" })
        ]}
        propertyOptions={propertyOptionsFromRecords([
          createProperty(),
          createProperty({ id: "property-2", name: "Rental" })
        ])}
        selectedDocument={createDocument()}
        selectedFileName="/tmp/new-receipt.pdf"
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Edit document");
    expect(html).toContain("Save document");
    expect(html).toContain("type=\"file\"");
    expect(html).toContain("Selected file: new-receipt.pdf");
    expect(html).toContain("Linked expense");
    expect(html).toContain("Saved Cedarline");
    expect(html).not.toContain("Legacy Cedarline");
    expect(html).toContain("Deck repair");
    expect(html).toContain("Deck boards");
    expect(html).not.toContain("Bathroom tile");
    expect(html).not.toContain("/tmp/");
    expect(html).not.toContain("deductible");
    expect(html).not.toContain("IRS");
  });

  it("normalizes document form values to safe document API input", () => {
    expect(fileAvailabilityLabel("not_uploaded")).toBe("Not uploaded");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(safeFileName("/Users/robert/receipt.pdf")).toBe("receipt.pdf");
    expect(formValuesToDocumentInput({
      propertyId: "property-1",
      projectId: "project-1",
      expenseId: "expense-1",
      displayName: "",
      documentType: "receipt",
      documentDate: "2026-06-05",
      notes: ""
    }, "/Users/robert/receipt.pdf")).toEqual({
      property_id: "property-1",
      project_id: "project-1",
      expense_id: "expense-1",
      display_name: "receipt.pdf",
      document_type: "receipt",
      document_date: "2026-06-05",
      notes: null,
      file_availability: "not_uploaded",
      file_status_note: null
    });
  });
});

function createDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: "document-1",
    property_id: "property-1",
    property_name: "Office",
    project_id: "project-1",
    project_name: "Deck repair",
    expense_id: "expense-1",
    expense_description: "Deck boards",
    display_name: "Cedarline receipt",
    document_type: "receipt",
    document_date: "2026-06-05",
    notes: null,
    file_availability: "not_uploaded",
    file_status_note: null,
    file: null,
    ocr: { status: "not_requested", has_text: false, completed_at: null },
    open_item_count: 1,
    deleted_at: null,
    created_at: "2026-06-07T12:00:00.000Z",
    updated_at: "2026-06-07T12:00:00.000Z",
    ...overrides
  };
}

function createDocumentFile(overrides = {}) {
  return {
    id: "file-1",
    document_id: "document-1",
    original_file_name: "receipt.pdf",
    mime_type: "application/pdf",
    size_bytes: 1536,
    sha256: "a".repeat(64),
    source: "web_upload",
    status: "available",
    uploaded_at: "2026-06-07T12:00:00.000Z",
    deleted_at: null,
    ...overrides
  };
}

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
    document_count: 1,
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
