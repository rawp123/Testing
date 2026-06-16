import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DocumentRecord, ExpenseRecord, ProjectRecord, PropertyRecord } from "../src/api/types";
import { DocumentsView, shouldPollDocumentOcr } from "../src/documents/DocumentsPage";
import {
  documentToFormValues,
  fileAvailabilityLabel,
  formValuesToDocumentInput,
  formatFileSize,
  getDocumentFileValidationMessage,
  ocrStatusLabel,
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
      ocrStatus: "Not requested",
      documentDate: "06/05/2026",
      openItems: "1 open",
      openItemCount: 1,
      hasFile: true
    });
    expect(rows[0].fileMeta).toContain("receipt.pdf");
    expect(rows[0].fileMeta).not.toContain("/Users/robert");

    const pendingRows = toDocumentRows([createDocument({
      file_availability: "available",
      file: createDocumentFile(),
      ocr: { status: "queued", has_text: false, completed_at: null }
    })]);
    expect(pendingRows[0]).toMatchObject({
      ocrStatus: "Queued",
      ocrIsPending: true,
      canRequestOcr: false,
      canReadOcrText: false
    });
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
        onDeleteDocument={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onDownloadFile={() => undefined}
        onEditDocument={() => undefined}
        onFileChange={() => undefined}
        onFormChange={() => undefined}
        onNewDocument={() => undefined}
        onReadOcrText={() => undefined}
        onRemoveFile={() => undefined}
        onRequestOcr={() => undefined}
        onSaveDocument={() => undefined}
        onCloseOcrText={() => undefined}
        projects={[createProject()]}
        propertyOptions={propertyOptionsFromRecords([createProperty()])}
        workspaceName="Home records"
        noticeMessage="File details are attached. This environment does not provide a browser download URL."
      />
    );

    expect(html).toContain("Document records");
    expect(html).toContain("Add document");
    expect(html).toContain("Open items");
    expect(html).toContain("Cedarline receipt");
    expect(html).toContain("Attached");
    expect(html).toContain("Not requested");
    expect(html).toContain("Text has not been extracted.");
    expect(html).toContain("receipt.pdf");
    expect(html).toContain("View file");
    expect(html).toContain("Extract text");
    expect(html).toContain("Remove file");
    expect(html).toContain("Delete record");
    expect(html).not.toContain("Archive");
    expect(html).toContain("1 open");
    expect(html).toContain("This environment does not provide a browser download URL.");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("null");
    expect(html).not.toContain("storage_key");
    expect(html).not.toContain("signed-upload");
  });

  it("renders empty and filtered states with direct copy", () => {
    const html = renderToStaticMarkup(
      <DocumentsView
        activeFilter="open"
        documents={[createDocument({ open_item_count: 0 })]}
        errorMessage="Documents could not be loaded."
        expenses={[createExpense()]}
        formValues={documentToFormValues()}
        onDeleteDocument={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onDownloadFile={() => undefined}
        onEditDocument={() => undefined}
        onFileChange={() => undefined}
        onFormChange={() => undefined}
        onNewDocument={() => undefined}
        onReadOcrText={() => undefined}
        onRemoveFile={() => undefined}
        onRequestOcr={() => undefined}
        onSaveDocument={() => undefined}
        onCloseOcrText={() => undefined}
        projects={[createProject()]}
        propertyOptions={propertyOptionsFromRecords([createProperty()])}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Documents could not be loaded.");
    expect(html).toContain("No documents for this filter");
    expect(html).toContain("Clear the document filter to see all documents.");
  });

  it("renders edit modal fields without upload controls and with delete action", () => {
    const html = renderToStaticMarkup(
      <DocumentsView
        documents={[createDocument({
          file_availability: "available",
          file: createDocumentFile()
        })]}
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
        allowFileInput={false}
        onDeleteDocument={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onDownloadFile={() => undefined}
        onEditDocument={() => undefined}
        onFileChange={() => undefined}
        onFormChange={() => undefined}
        onNewDocument={() => undefined}
        onReadOcrText={() => undefined}
        onRemoveFile={() => undefined}
        onRequestOcr={() => undefined}
        onSaveDocument={() => undefined}
        onCloseOcrText={() => undefined}
        projects={[
          createProject(),
          createProject({ id: "project-2", property_id: "property-2", name: "Bathroom remodel" })
        ]}
        propertyOptions={propertyOptionsFromRecords([
          createProperty(),
          createProperty({ id: "property-2", name: "Rental" })
        ])}
        selectedDocument={createDocument({
          file_availability: "available",
          file: createDocumentFile()
        })}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Edit document");
    expect(html).toContain("Save document");
    expect(html).toContain("Delete document");
    expect(html).toContain("Attached file");
    expect(html).toContain("receipt.pdf");
    expect(html).not.toContain("Upload new file");
    expect(html).not.toContain("Replace file");
    expect(html).not.toContain("type=\"file\"");
    expect(html).not.toContain("Selected file");
    expect(html).not.toContain("Replacement file");
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

  it("renders attach-file modal with upload controls for documents without a viewable file", () => {
    const pendingDocument = createDocument({
      file_availability: "not_uploaded",
      file: null
    });
    const html = renderToStaticMarkup(
      <DocumentsView
        allowFileInput
        documents={[pendingDocument]}
        expenses={[createExpense()]}
        formValues={documentToFormValues(pendingDocument)}
        modalMode="edit"
        onDeleteDocument={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onDownloadFile={() => undefined}
        onEditDocument={() => undefined}
        onFileChange={() => undefined}
        onFormChange={() => undefined}
        onNewDocument={() => undefined}
        onReadOcrText={() => undefined}
        onRemoveFile={() => undefined}
        onRequestOcr={() => undefined}
        onSaveDocument={() => undefined}
        onCloseOcrText={() => undefined}
        projects={[createProject()]}
        propertyOptions={propertyOptionsFromRecords([createProperty()])}
        selectedDocument={pendingDocument}
        selectedFileName="/tmp/new-receipt.pdf"
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Attach file");
    expect(html).toContain("type=\"file\"");
    expect(html).toContain("Selected file: new-receipt.pdf");
    expect(html).toContain("Delete document");
    expect(html).not.toContain("Upload new file");
    expect(html).not.toContain("Replace file");
    expect(html).not.toContain("/tmp/");
  });

  it("normalizes document form values to safe document API input", () => {
    expect(fileAvailabilityLabel("not_uploaded")).toBe("Not uploaded");
    expect(ocrStatusLabel("succeeded", true)).toBe("Text available");
    expect(ocrStatusLabel("succeeded", false)).toBe("No text found");
    expect(ocrStatusLabel("queued", false)).toBe("Queued");
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

  it("validates selected document files before upload", () => {
    expect(getDocumentFileValidationMessage(new File(["hello"], "receipt.txt", { type: "text/plain" }))).toBe("");
    expect(getDocumentFileValidationMessage(new File(["x"], "script.js", { type: "text/javascript" }))).toBe("Use a PDF, image, receipt, invoice, permit, or note file.");
    expect(getDocumentFileValidationMessage({
      name: "large.pdf",
      size: 26 * 1024 * 1024,
      type: "application/pdf"
    } as File)).toBe("Maximum file size: 25 MB.");
  });

  it("polls document OCR while queued or processing records are visible", () => {
    expect(shouldPollDocumentOcr([
      createDocument({
        file_availability: "available",
        file: createDocumentFile(),
        ocr: { status: "queued", has_text: false, completed_at: null }
      })
    ])).toBe(true);

    expect(shouldPollDocumentOcr([
      createDocument({
        file_availability: "available",
        file: createDocumentFile(),
        ocr: { status: "processing", has_text: false, completed_at: null }
      })
    ])).toBe(true);
  });

  it("stops document OCR polling for terminal and not-requested states", () => {
    const terminalDocuments = ["not_requested", "succeeded", "failed", "skipped"].map((status) => createDocument({
      id: `document-${status}`,
      file_availability: "available",
      file: createDocumentFile({ id: `file-${status}`, document_id: `document-${status}` }),
      ocr: { status, has_text: status === "succeeded", completed_at: status === "not_requested" ? null : "2026-06-08T12:00:00.000Z" }
    }));

    expect(shouldPollDocumentOcr(terminalDocuments)).toBe(false);
  });

  it("polls only when pending OCR is in the active document filter", () => {
    const pendingClosedDocument = createDocument({
      id: "closed-pending",
      open_item_count: 0,
      file_availability: "available",
      file: createDocumentFile({ id: "file-closed-pending", document_id: "closed-pending" }),
      ocr: { status: "queued", has_text: false, completed_at: null }
    });
    const visibleReadyDocument = createDocument({
      id: "open-ready",
      open_item_count: 1,
      file_availability: "available",
      file: createDocumentFile({ id: "file-open-ready", document_id: "open-ready" }),
      ocr: { status: "succeeded", has_text: true, completed_at: "2026-06-08T12:00:00.000Z" }
    });

    expect(shouldPollDocumentOcr([pendingClosedDocument, visibleReadyDocument], "all")).toBe(true);
    expect(shouldPollDocumentOcr([pendingClosedDocument, visibleReadyDocument], "open")).toBe(false);
    expect(shouldPollDocumentOcr([pendingClosedDocument, visibleReadyDocument], "type:receipt")).toBe(true);
    expect(shouldPollDocumentOcr([pendingClosedDocument, visibleReadyDocument], "file:missing")).toBe(false);
  });

  it("renders practical OCR actions for each document text state", () => {
    const html = renderToStaticMarkup(
      <DocumentsView
        documents={[
          createDocument({ id: "no-file", display_name: "No file", file_availability: "not_uploaded", file: null }),
          createDocument({
            id: "not-requested",
            display_name: "Ready for text",
            file_availability: "available",
            file: createDocumentFile({ id: "file-not-requested", document_id: "not-requested" })
          }),
          createDocument({
            id: "queued",
            display_name: "Queued file",
            file_availability: "available",
            file: createDocumentFile({ id: "file-queued", document_id: "queued" }),
            ocr: { status: "queued", has_text: false, completed_at: null }
          }),
          createDocument({
            id: "with-text",
            display_name: "Text file",
            file_availability: "available",
            file: createDocumentFile({ id: "file-with-text", document_id: "with-text" }),
            ocr: { status: "succeeded", has_text: true, completed_at: "2026-06-08T12:00:00.000Z" }
          }),
          createDocument({
            id: "no-text",
            display_name: "No text file",
            file_availability: "available",
            file: createDocumentFile({ id: "file-no-text", document_id: "no-text" }),
            ocr: { status: "succeeded", has_text: false, completed_at: "2026-06-08T12:00:00.000Z" }
          }),
          createDocument({
            id: "skipped",
            display_name: "Skipped file",
            file_availability: "available",
            file: createDocumentFile({ id: "file-skipped", document_id: "skipped" }),
            ocr: { status: "skipped", has_text: false, completed_at: "2026-06-08T12:00:00.000Z" }
          }),
          createDocument({
            id: "failed",
            display_name: "Failed file",
            file_availability: "available",
            file: createDocumentFile({ id: "file-failed", document_id: "failed" }),
            ocr: { status: "failed", has_text: false, completed_at: "2026-06-08T12:00:00.000Z" }
          })
        ]}
        expenses={[createExpense()]}
        formValues={documentToFormValues()}
        onDeleteDocument={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onDownloadFile={() => undefined}
        onEditDocument={() => undefined}
        onFileChange={() => undefined}
        onFormChange={() => undefined}
        onNewDocument={() => undefined}
        onReadOcrText={() => undefined}
        onRemoveFile={() => undefined}
        onRequestOcr={() => undefined}
        onSaveDocument={() => undefined}
        onCloseOcrText={() => undefined}
        projects={[createProject()]}
        propertyOptions={propertyOptionsFromRecords([createProperty()])}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Ready for text");
    expect(html).toContain("Extract text");
    expect(html).toContain("Extracting text");
    expect(html).toContain("View text");
    expect(html).toContain("No text found");
    expect(html).toContain("Retry text");
    expect(html.match(/Extract text/g)?.length).toBe(1);
    expect(html.match(/Extracting text/g)?.length).toBe(1);
    expect(html.match(/View text/g)?.length).toBe(1);
    expect(html.match(/Retry text/g)?.length).toBe(2);
    expect(html).toContain("Text reading skipped. Review the file type or try again.");
    expect(html).toContain("Text could not be read. Try again later.");
  });

  it("allows viewers to view available OCR text without request or retry actions", () => {
    const html = renderToStaticMarkup(
      <DocumentsView
        canManageDocumentText={false}
        documents={[
          createDocument({
            id: "not-requested",
            display_name: "Ready for text",
            file_availability: "available",
            file: createDocumentFile({ id: "file-not-requested", document_id: "not-requested" })
          }),
          createDocument({
            id: "failed",
            display_name: "Failed file",
            file_availability: "available",
            file: createDocumentFile({ id: "file-failed", document_id: "failed" }),
            ocr: { status: "failed", has_text: false, completed_at: "2026-06-08T12:00:00.000Z" }
          }),
          createDocument({
            id: "with-text",
            display_name: "Text file",
            file_availability: "available",
            file: createDocumentFile({ id: "file-with-text", document_id: "with-text" }),
            ocr: { status: "succeeded", has_text: true, completed_at: "2026-06-08T12:00:00.000Z" }
          })
        ]}
        expenses={[createExpense()]}
        formValues={documentToFormValues()}
        onDeleteDocument={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onDownloadFile={() => undefined}
        onEditDocument={() => undefined}
        onFileChange={() => undefined}
        onFormChange={() => undefined}
        onNewDocument={() => undefined}
        onReadOcrText={() => undefined}
        onRemoveFile={() => undefined}
        onRequestOcr={() => undefined}
        onSaveDocument={() => undefined}
        onCloseOcrText={() => undefined}
        projects={[createProject()]}
        propertyOptions={propertyOptionsFromRecords([createProperty()])}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("View text");
    expect(html).not.toContain("Extract text");
    expect(html).not.toContain("Retry text");
  });

  it("shows read-text actions only through the focused OCR text view", () => {
    const html = renderToStaticMarkup(
      <DocumentsView
        documents={[createDocument({
          file_availability: "available",
          file: createDocumentFile(),
          ocr: { status: "succeeded", has_text: true, completed_at: "2026-06-08T12:00:00.000Z" }
        })]}
        expenses={[createExpense()]}
        formValues={documentToFormValues()}
        onDeleteDocument={() => undefined}
        onChangeFilter={() => undefined}
        onCloseModal={() => undefined}
        onDownloadFile={() => undefined}
        onEditDocument={() => undefined}
        onFileChange={() => undefined}
        onFormChange={() => undefined}
        onNewDocument={() => undefined}
        onReadOcrText={() => undefined}
        onRemoveFile={() => undefined}
        onRequestOcr={() => undefined}
        onSaveDocument={() => undefined}
        onCloseOcrText={() => undefined}
        ocrTextModal={{
          status: "ready",
          document: createDocument({
            file_availability: "available",
            file: createDocumentFile(),
            ocr: { status: "succeeded", has_text: true, completed_at: "2026-06-08T12:00:00.000Z" }
          }),
          text: {
            document_id: "document-1",
            document_file_id: "file-1",
            ocr_status: "succeeded",
            ocr_requested_at: "2026-06-08T12:00:00.000Z",
            ocr_completed_at: "2026-06-08T12:00:00.000Z",
            text_available: true,
            text: "Extracted line one\nExtracted line two"
          }
        }}
        projects={[createProject()]}
        propertyOptions={propertyOptionsFromRecords([createProperty()])}
        workspaceName="Home records"
      />
    );

    expect(html).toContain("Text available");
    expect(html).toContain("View text");
    expect(html).not.toContain("Extract text");
    expect(html).toContain("Document text");
    expect(html).toContain("Extracted line one");
    expect(html).not.toContain("storage_key");
    expect(html).not.toContain("signed-upload");
    expect(html).not.toContain("/Users/");
    expect(html).not.toContain("provider");
    expect(html).not.toContain("deductible");
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
