import { useEffect, useMemo, useRef, useState } from "react";
import { HomeLedgerApiError, type HomeLedgerApiClient } from "../api/client";
import type {
  DocumentOcrStatusResponse,
  DocumentOcrTextResponse,
  DocumentRecord,
  ExpenseRecord,
  ProjectRecord,
  PropertyRecord,
  WorkspaceRole
} from "../api/types";
import { ActionBar } from "../components/ActionBar";
import { CompactRecordTable, type CompactRecordColumn } from "../components/CompactRecordTable";
import { EmptyState } from "../components/EmptyState";
import { FilterChipGroup, FilterPanel, type FilterChip } from "../components/FilterPanel";
import { FormField } from "../components/FormField";
import { Modal } from "../components/Modal";
import { PageTitle } from "../components/PageTitle";
import { PanelHeader, WorkspacePanel } from "../components/WorkspacePanel";
import {
  DOCUMENT_TYPE_OPTIONS,
  documentFileHelperFor,
  documentToFormValues,
  documentTypeLabel,
  expenseOptionsFromRecords,
  fileAvailabilityLabel,
  formatDocumentFileSummary,
  getDocumentFileValidationMessage,
  formValuesToDocumentInput,
  projectOptionsFromRecords,
  propertyOptionsFromRecords,
  safeFileName,
  toDocumentRows,
  type DocumentFormValues,
  type DocumentRow,
  type SelectOption
} from "./document-model";

type DocumentsState =
  | { status: "loading"; documents: DocumentRecord[]; properties: PropertyRecord[]; projects: ProjectRecord[]; expenses: ExpenseRecord[] }
  | { status: "ready"; documents: DocumentRecord[]; properties: PropertyRecord[]; projects: ProjectRecord[]; expenses: ExpenseRecord[] }
  | { status: "error"; documents: DocumentRecord[]; properties: PropertyRecord[]; projects: ProjectRecord[]; expenses: ExpenseRecord[]; message: string };

type OcrTextModalState =
  | { status: "closed" }
  | { status: "loading"; document: DocumentRecord }
  | { status: "ready"; document: DocumentRecord; text: DocumentOcrTextResponse }
  | { status: "error"; document: DocumentRecord; message: string };

const DOCUMENT_OCR_POLL_INTERVAL_MS = 5000;

function hasViewableDocumentFile(document: DocumentRecord) {
  return document.file_availability === "available" && Boolean(document.file);
}

function canManageDocumentOcr(workspaceRole: WorkspaceRole | undefined) {
  return workspaceRole === "owner" || workspaceRole === "editor";
}

function documentOcrNotice(result: DocumentOcrStatusResponse) {
  if (result.text_available) return "Document text is available.";
  if (result.ocr_status === "skipped") return "Document text reading skipped for this file.";
  if (result.ocr_status === "failed") return "Document text could not be read.";
  return "Document text reading requested.";
}

export function DocumentsPage({
  client,
  workspaceId,
  workspaceName,
  workspaceRole
}: {
  client: HomeLedgerApiClient;
  workspaceId: string;
  workspaceName: string;
  workspaceRole?: WorkspaceRole;
}) {
  const [state, setState] = useState<DocumentsState>({ status: "loading", documents: [], properties: [], projects: [], expenses: [] });
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentRecord | null>(null);
  const [formValues, setFormValues] = useState<DocumentFormValues>(() => documentToFormValues());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentFileInputAllowed, setDocumentFileInputAllowed] = useState(false);
  const [formError, setFormError] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [ocrTextModal, setOcrTextModal] = useState<OcrTextModalState>({ status: "closed" });
  const ocrPollInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({
      status: "loading",
      documents: current.documents,
      properties: current.properties,
      projects: current.projects,
      expenses: current.expenses
    }));
    Promise.all([
      client.listDocuments(workspaceId),
      client.listProperties(workspaceId),
      client.listProjects(workspaceId),
      client.listExpenses(workspaceId)
    ])
      .then(([documents, properties, projects, expenses]) => {
        if (!cancelled) setState({ status: "ready", documents, properties, projects, expenses });
      })
      .catch(() => {
        if (!cancelled) setState((current) => ({
          status: "error",
          documents: current.documents,
          properties: current.properties,
          projects: current.projects,
          expenses: current.expenses,
          message: "Documents could not be loaded."
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [client, workspaceId]);

  const shouldPollOcr = shouldPollDocumentOcr(state.documents, activeFilter);
  useEffect(() => {
    if (!shouldPollOcr) {
      return undefined;
    }

    let cancelled = false;
    const refreshDocumentList = async () => {
      if (ocrPollInFlight.current) return;
      ocrPollInFlight.current = true;
      try {
        const documents = await client.listDocuments(workspaceId);
        if (!cancelled) {
          setState((current) => ({
            status: "ready",
            documents,
            properties: current.properties,
            projects: current.projects,
            expenses: current.expenses
          }));
        }
      } catch {
        // Polling is opportunistic; keep the current list visible if a refresh misses.
      } finally {
        ocrPollInFlight.current = false;
      }
    };

    const intervalId = globalThis.setInterval(refreshDocumentList, DOCUMENT_OCR_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      globalThis.clearInterval(intervalId);
    };
  }, [activeFilter, client, shouldPollOcr, workspaceId]);

  const propertyOptions = useMemo(() => propertyOptionsFromRecords(state.properties), [state.properties]);

  const openCreate = () => {
    setSelectedDocument(null);
    setFormValues(documentToFormValues(null, propertyOptions[0]?.value || ""));
    setSelectedFile(null);
    setDocumentFileInputAllowed(true);
    setFormError("");
    setNoticeMessage("");
    setModalMode("create");
  };

  const openEdit = (document: DocumentRecord) => {
    setSelectedDocument(document);
    setFormValues(documentToFormValues(document, propertyOptions[0]?.value || ""));
    setSelectedFile(null);
    setDocumentFileInputAllowed(false);
    setFormError("");
    setNoticeMessage("");
    setModalMode("edit");
  };

  const openAttachFile = (document: DocumentRecord) => {
    setSelectedDocument(document);
    setFormValues(documentToFormValues(document, propertyOptions[0]?.value || ""));
    setSelectedFile(null);
    setDocumentFileInputAllowed(!hasViewableDocumentFile(document));
    setFormError("");
    setNoticeMessage("");
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedDocument(null);
    setSelectedFile(null);
    setDocumentFileInputAllowed(false);
    setFormError("");
  };

  const refreshDocuments = async () => {
    const [documents, properties, projects, expenses] = await Promise.all([
      client.listDocuments(workspaceId),
      client.listProperties(workspaceId),
      client.listProjects(workspaceId),
      client.listExpenses(workspaceId)
    ]);
    setState({ status: "ready", documents, properties, projects, expenses });
  };

  const saveDocument = async () => {
    setNoticeMessage("");
    setFormError("");
    const fileForSave = modalMode === "create" || documentFileInputAllowed ? selectedFile : null;
    const fileValidationMessage = getDocumentFileValidationMessage(fileForSave);
    if (fileValidationMessage) {
      setFormError(fileValidationMessage);
      return;
    }
    const input = formValuesToDocumentInput(formValues, fileForSave?.name || "", {
      includeFileState: modalMode !== "edit"
    });
    if (!input.display_name) {
      setFormError("Name is required unless a file is selected.");
      return;
    }
    if (!input.property_id && !input.expense_id) {
      setFormError("Property is required.");
      return;
    }

    try {
      const document = modalMode === "edit" && selectedDocument
        ? await client.updateDocument(workspaceId, selectedDocument.id, input)
        : await client.createDocument(workspaceId, input);
      if (fileForSave) {
        const attachResult = await client.attachDocumentFile(workspaceId, document.id, fileForSave);
        setNoticeMessage(attachResult.completed_without_browser_upload
          ? "File details saved. File contents were not uploaded in this beta environment."
          : "Document and attached file saved.");
      } else {
        setNoticeMessage("Document saved.");
      }
      closeModal();
      await refreshDocuments();
    } catch (error) {
      setFormError(documentFileActionError(error, "Document could not be saved."));
    }
  };

  const deleteDocument = async (document: DocumentRecord) => {
    const recordName = safeFileName(document.display_name || document.file?.original_file_name || "this document");
    if (typeof globalThis.confirm === "function" && !globalThis.confirm(`Delete ${recordName}? This removes the document record from active records.`)) {
      return;
    }
    try {
      await client.archiveDocument(workspaceId, document.id);
      if (modalMode === "edit" && selectedDocument?.id === document.id) {
        closeModal();
      }
      setNoticeMessage("Document deleted.");
      await refreshDocuments();
    } catch {
      setState((current) => ({
        status: "error",
        documents: current.documents,
        properties: current.properties,
        projects: current.projects,
        expenses: current.expenses,
        message: "Document could not be deleted."
      }));
    }
  };

  const removeFile = async (document: DocumentRecord) => {
    setNoticeMessage("");
    try {
      await client.removeDocumentFile(workspaceId, document.id);
      await refreshDocuments();
      setNoticeMessage("Attached file removed. The document record was kept.");
    } catch (error) {
      setState((current) => ({
        status: "error",
        documents: current.documents,
        properties: current.properties,
        projects: current.projects,
        expenses: current.expenses,
        message: documentFileActionError(error, "File could not be removed.")
      }));
    }
  };

  const downloadFile = async (document: DocumentRecord) => {
    setNoticeMessage("");
    try {
      const file = await client.getDocumentFile(workspaceId, document.id);
      if (file.download_url) {
        globalThis.open?.(file.download_url, "_blank", "noopener,noreferrer");
        setNoticeMessage("File link opened in a new tab.");
        return;
      }
      setNoticeMessage("File details are saved. A file link is unavailable in this beta environment.");
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "error",
        message: documentFileActionError(error, "File could not be opened.")
      }));
    }
  };

  const requestOcr = async (document: DocumentRecord) => {
    setNoticeMessage("");
    try {
      const result = await client.requestDocumentOcr(workspaceId, document.id);
      await refreshDocuments();
      setNoticeMessage(documentOcrNotice(result));
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "error",
        message: documentOcrActionError(error, "Document text could not be requested.")
      }));
    }
  };

  const readOcrText = async (document: DocumentRecord) => {
    setNoticeMessage("");
    setOcrTextModal({ status: "loading", document });
    try {
      const text = await client.getDocumentOcrText(workspaceId, document.id);
      setOcrTextModal({ status: "ready", document, text });
    } catch (error) {
      setOcrTextModal({
        status: "error",
        document,
        message: documentOcrActionError(error, "Document text could not be opened.")
      });
    }
  };

  return (
    <DocumentsView
      activeFilter={activeFilter}
      documents={state.documents}
      errorMessage={state.status === "error" ? state.message : ""}
      expenses={state.expenses}
      formError={formError}
      formValues={formValues}
      loading={state.status === "loading"}
      modalMode={modalMode}
      noticeMessage={noticeMessage}
      canManageDocumentText={canManageDocumentOcr(workspaceRole)}
      allowFileInput={modalMode === "create" || documentFileInputAllowed}
      onChangeFilter={setActiveFilter}
      onCloseModal={closeModal}
      onDownloadFile={downloadFile}
      onAttachDocumentFile={openAttachFile}
      onEditDocument={openEdit}
      onFileChange={setSelectedFile}
      onFormChange={setFormValues}
      onDeleteDocument={deleteDocument}
      onNewDocument={openCreate}
      onReadOcrText={readOcrText}
      onRemoveFile={removeFile}
      onRequestOcr={requestOcr}
      onSaveDocument={saveDocument}
      onCloseOcrText={() => setOcrTextModal({ status: "closed" })}
      projects={state.projects}
      propertyOptions={propertyOptions}
      selectedDocument={selectedDocument}
      selectedFileName={selectedFile?.name || ""}
      ocrTextModal={ocrTextModal}
      workspaceName={workspaceName}
    />
  );
}

export function DocumentsView({
  allowFileInput = true,
  activeFilter = "all",
  documents,
  errorMessage = "",
  expenses,
  formError = "",
  formValues,
  loading = false,
  modalMode = null,
  noticeMessage = "",
  canManageDocumentText = true,
  onChangeFilter,
  onCloseModal,
  onDownloadFile,
  onAttachDocumentFile,
  onEditDocument,
  onFileChange,
  onFormChange,
  onDeleteDocument,
  onNewDocument,
  onReadOcrText,
  onRemoveFile,
  onRequestOcr,
  onSaveDocument,
  onCloseOcrText,
  ocrTextModal = { status: "closed" },
  projects,
  propertyOptions,
  selectedDocument,
  selectedFileName = "",
  workspaceName
}: {
  allowFileInput?: boolean;
  activeFilter?: string;
  documents: DocumentRecord[];
  errorMessage?: string;
  expenses: ExpenseRecord[];
  formError?: string;
  formValues: DocumentFormValues;
  loading?: boolean;
  modalMode?: "create" | "edit" | null;
  noticeMessage?: string;
  canManageDocumentText?: boolean;
  onChangeFilter: (filter: string) => void;
  onCloseModal: () => void;
  onDownloadFile: (document: DocumentRecord) => void;
  onAttachDocumentFile?: (document: DocumentRecord) => void;
  onEditDocument: (document: DocumentRecord) => void;
  onFileChange: (file: File | null) => void;
  onFormChange: (values: DocumentFormValues) => void;
  onDeleteDocument: (document: DocumentRecord) => void;
  onNewDocument: () => void;
  onReadOcrText: (document: DocumentRecord) => void;
  onRemoveFile: (document: DocumentRecord) => void;
  onRequestOcr: (document: DocumentRecord) => void;
  onSaveDocument: () => void;
  onCloseOcrText: () => void;
  ocrTextModal?: OcrTextModalState;
  projects: ProjectRecord[];
  propertyOptions: SelectOption[];
  selectedDocument?: DocumentRecord | null;
  selectedFileName?: string;
  workspaceName: string;
}) {
  const rows = useMemo(() => toDocumentRows(documents), [documents]);
  const filterOptions = useMemo(() => buildDocumentFilterOptions(rows), [rows]);
  const filteredRows = useMemo(() => filterDocumentRows(rows, activeFilter), [activeFilter, rows]);
  const projectOptions = useMemo(() => projectOptionsFromRecords(projects, formValues.propertyId), [formValues.propertyId, projects]);
  const expenseOptions = useMemo(() => expenseOptionsFromRecords(expenses, formValues.propertyId, formValues.projectId), [expenses, formValues.projectId, formValues.propertyId]);
  const canAddDocument = propertyOptions.length > 0;
  const columns = useMemo<CompactRecordColumn<DocumentRow>[]>(() => [
    {
      key: "name",
      header: "Document",
      className: "record-name-cell",
      render: (row) => (
        <div className="record-stack">
          <strong>{row.name}</strong>
          <span>{row.source.notes || row.type}</span>
        </div>
      )
    },
    { key: "linkedTo", header: "Linked to", render: (row) => row.linkedTo },
    { key: "type", header: "Type", render: (row) => row.type },
    {
      key: "file",
      header: "File",
      render: (row) => (
        <div className="record-stack">
          <strong>{row.fileStatus}</strong>
          <span>{row.fileMeta}</span>
        </div>
      )
    },
    {
      key: "ocr",
      header: "Text",
      render: (row) => (
        <div className="record-stack">
          <strong>{row.ocrStatus}</strong>
          <span>{row.ocrMeta}</span>
        </div>
      )
    },
    { key: "date", header: "Date", render: (row) => row.documentDate },
    { key: "openItems", header: "Open follow-ups", align: "right", render: (row) => row.openItems },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <div className="row-actions">
          {row.hasFile ? <button onClick={() => onDownloadFile(row.source)} type="button">View file</button> : null}
          <button onClick={() => row.hasFile ? onEditDocument(row.source) : (onAttachDocumentFile || onEditDocument)(row.source)} type="button">{row.hasFile ? "Edit" : "Attach file"}</button>
          {row.hasFile ? (
            <>
              {row.canReadOcrText ? <button onClick={() => onReadOcrText(row.source)} type="button">View text</button> : null}
              {!row.canReadOcrText && row.ocrIsPending ? <button disabled type="button">Extracting text</button> : null}
              {!row.canReadOcrText && row.ocrStatusValue === "succeeded" ? <button disabled type="button">No text found</button> : null}
              {!row.canReadOcrText && canManageDocumentText && row.canRetryOcr ? <button onClick={() => onRequestOcr(row.source)} type="button">Retry text</button> : null}
              {!row.canReadOcrText && canManageDocumentText && row.canRequestOcr ? <button onClick={() => onRequestOcr(row.source)} type="button">Extract text</button> : null}
            </>
          ) : null}
          {row.hasFile ? <button onClick={() => onRemoveFile(row.source)} type="button">Remove file</button> : null}
          <button onClick={() => onDeleteDocument(row.source)} type="button">Delete record</button>
        </div>
      )
    }
  ], [canManageDocumentText, onAttachDocumentFile, onDeleteDocument, onDownloadFile, onEditDocument, onReadOcrText, onRemoveFile, onRequestOcr]);

  const changeProperty = (propertyId: string) => {
    const currentProject = projects.find((project) => project.id === formValues.projectId);
    const currentExpense = expenses.find((expense) => expense.id === formValues.expenseId);
    onFormChange({
      ...formValues,
      propertyId,
      projectId: currentProject?.property_id === propertyId ? formValues.projectId : "",
      expenseId: currentExpense?.property_id === propertyId ? formValues.expenseId : ""
    });
  };
  const changeProject = (projectId: string) => {
    const currentExpense = expenses.find((expense) => expense.id === formValues.expenseId);
    onFormChange({
      ...formValues,
      projectId,
      expenseId: !projectId || currentExpense?.project_id === projectId ? formValues.expenseId : ""
    });
  };
  const changeExpense = (expenseId: string) => {
    const expense = expenses.find((record) => record.id === expenseId);
    onFormChange({
      ...formValues,
      expenseId,
      propertyId: expense?.property_id || formValues.propertyId,
      projectId: expense?.project_id || formValues.projectId
    });
  };
  const changeFile = (file: File | null) => {
    onFileChange(file);
    if (file && !formValues.displayName.trim()) {
      onFormChange({ ...formValues, displayName: safeFileName(file.name) });
    }
  };
  const selectedDocumentFile = selectedDocument?.file || null;
  const modalTitle = modalMode === "edit" ? allowFileInput ? "Attach file" : "Edit document" : "Add document";

  return (
    <div className="page-stack">
      <PageTitle meta={workspaceName} title="Document records" />

      <ActionBar label="Document actions">
        <button
          className="button button-primary"
          disabled={!canAddDocument}
          onClick={onNewDocument}
          title={canAddDocument ? "Add document" : "Add a property before creating documents"}
          type="button"
        >
          <span aria-hidden="true">+</span>Add document
        </button>
      </ActionBar>

      <FilterPanel className="documents-filter-panel" onClear={() => onChangeFilter("all")}>
        <FilterChipGroup
          label="Document filters"
          onChange={onChangeFilter}
          options={filterOptions}
          value={activeFilter}
        />
      </FilterPanel>

      <WorkspacePanel className="documents-panel">
        <PanelHeader icon="◇" title="Documents" />
        {errorMessage ? <div className="inline-error" role="alert">{errorMessage}</div> : null}
        {noticeMessage ? <div className="inline-notice" role="status">{noticeMessage}</div> : null}
        {loading ? <p className="muted-copy">Loading documents...</p> : null}
        {!loading && !rows.length ? (
          <EmptyState title="No documents">Add receipts, invoices, permits, photos, contracts, or notes.</EmptyState>
        ) : null}
        {!loading && rows.length > 0 && !filteredRows.length ? (
          <EmptyState title="No documents for this filter">Clear the document filter to see all documents.</EmptyState>
        ) : null}
        {filteredRows.length ? (
          <CompactRecordTable
            className="documents-table"
            columns={columns}
            getRowKey={(row) => row.id}
            rows={filteredRows}
          />
        ) : null}
      </WorkspacePanel>

      {modalMode ? (
        <Modal
          footer={(
            <>
              {modalMode === "edit" && selectedDocument ? (
                <button className="button button-secondary button-danger" onClick={() => onDeleteDocument(selectedDocument)} type="button">Delete document</button>
              ) : null}
              <button className="button button-secondary" onClick={onCloseModal} type="button">Cancel</button>
              <button className="button button-primary" onClick={onSaveDocument} type="button">Save document</button>
            </>
          )}
          onClose={onCloseModal}
          subtitle={selectedDocument?.property_name || workspaceName}
          title={modalTitle}
        >
          {formError ? <div className="inline-error" role="alert">{formError}</div> : null}
          {selectedDocumentFile ? (
            <div className="file-summary-panel">
              <strong>Attached file</strong>
              <span>{formatDocumentFileSummary(selectedDocumentFile)}</span>
            </div>
          ) : null}
          {allowFileInput ? (
            <>
              <FormField helper={documentFileHelperFor(selectedDocument)} label="File">
                <input
                  name="file"
                  onChange={(event) => changeFile(event.currentTarget.files?.[0] || null)}
                  type="file"
                />
              </FormField>
              {selectedFileName ? <p className="helper-note">Selected file: {safeFileName(selectedFileName)}</p> : null}
            </>
          ) : null}
          <div className="form-grid two-column">
            <FormField label="Property">
              <select
                name="property_id"
                onChange={(event) => changeProperty(event.currentTarget.value)}
                value={formValues.propertyId}
              >
                <option value="">Select property</option>
                {propertyOptions.map((property) => (
                  <option key={property.value} value={property.value}>{property.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Project">
              <select
                name="project_id"
                onChange={(event) => changeProject(event.currentTarget.value)}
                value={formValues.projectId}
              >
                <option value="">No project</option>
                {projectOptions.map((project) => (
                  <option key={project.value} value={project.value}>{project.label}</option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField helper="Changing the expense will update the property and project." label="Linked expense">
            <select
              name="expense_id"
              onChange={(event) => changeExpense(event.currentTarget.value)}
              value={formValues.expenseId}
            >
              <option value="">No linked expense</option>
              {expenseOptions.map((expense) => (
                <option key={expense.value} value={expense.value}>{expense.label}</option>
              ))}
            </select>
          </FormField>
          <div className="form-grid two-column">
            <FormField label="Type">
              <select
                name="document_type"
                onChange={(event) => onFormChange({ ...formValues, documentType: event.currentTarget.value })}
                value={formValues.documentType}
              >
                {DOCUMENT_TYPE_OPTIONS.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Document date">
              <input
                name="document_date"
                onChange={(event) => onFormChange({ ...formValues, documentDate: event.currentTarget.value })}
                type="date"
                value={formValues.documentDate}
              />
            </FormField>
          </div>
          <FormField helper="Optional. Uses file name if blank." label="Name">
            <input
              name="display_name"
              onChange={(event) => onFormChange({ ...formValues, displayName: event.currentTarget.value })}
              value={formValues.displayName}
            />
          </FormField>
          <FormField label="Notes">
            <textarea
              name="notes"
              onChange={(event) => onFormChange({ ...formValues, notes: event.currentTarget.value })}
              value={formValues.notes}
            />
          </FormField>
        </Modal>
      ) : null}

      {ocrTextModal.status !== "closed" ? (
        <Modal
          footer={<button className="button button-primary" onClick={onCloseOcrText} type="button">Done</button>}
          onClose={onCloseOcrText}
          subtitle={ocrTextModal.document.property_name || workspaceName}
          title="Document text"
        >
          <div className="file-summary-panel">
            <strong>{ocrTextModal.document.display_name || "Document"}</strong>
            <span>{ocrTextModal.document.file ? formatDocumentFileSummary(ocrTextModal.document.file) : "No file attached"}</span>
          </div>
          {ocrTextModal.status === "loading" ? <p className="muted-copy">Loading document text.</p> : null}
          {ocrTextModal.status === "error" ? <div className="inline-error" role="alert">{ocrTextModal.message}</div> : null}
          {ocrTextModal.status === "ready" ? (
            <div className="ocr-text-panel">
              <p className="helper-note">Extracted text is shown only in this view.</p>
              <pre>{ocrTextModal.text.text || "No document text was found."}</pre>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}

function buildDocumentFilterOptions(rows: DocumentRow[]): FilterChip[] {
  const options: FilterChip[] = [{ value: "all", label: "All", count: rows.length }];
  const openCount = rows.filter((row) => row.openItemCount > 0).length;
  if (openCount) options.push({ value: "open", label: "Open follow-ups", count: openCount });

  const fileStatuses = new Map<string, number>();
  const documentTypes = new Map<string, number>();
  for (const row of rows) {
    const fileAvailability = row.source.file_availability || "not_uploaded";
    const documentType = row.source.document_type || "other";
    fileStatuses.set(fileAvailability, (fileStatuses.get(fileAvailability) || 0) + 1);
    documentTypes.set(documentType, (documentTypes.get(documentType) || 0) + 1);
  }

  for (const [status, count] of [...fileStatuses.entries()].sort((left, right) => fileAvailabilityLabel(left[0]).localeCompare(fileAvailabilityLabel(right[0])))) {
    options.push({ value: `file:${status}`, label: fileAvailabilityLabel(status), count });
  }
  for (const [type, count] of [...documentTypes.entries()].sort((left, right) => documentTypeLabel(left[0]).localeCompare(documentTypeLabel(right[0])))) {
    options.push({ value: `type:${type}`, label: documentTypeLabel(type), count });
  }
  return options;
}

export function shouldPollDocumentOcr(documents: DocumentRecord[], activeFilter = "all") {
  return filterDocumentRows(toDocumentRows(documents), activeFilter).some((row) => row.ocrIsPending);
}

function filterDocumentRows(rows: DocumentRow[], filter: string) {
  if (filter === "open") return rows.filter((row) => row.openItemCount > 0);
  if (filter.startsWith("file:")) {
    const fileAvailability = filter.slice("file:".length);
    return rows.filter((row) => row.source.file_availability === fileAvailability);
  }
  if (filter.startsWith("type:")) {
    const documentType = filter.slice("type:".length);
    return rows.filter((row) => row.source.document_type === documentType);
  }
  return rows;
}

function documentFileActionError(error: unknown, fallback: string) {
  if (error instanceof HomeLedgerApiError) {
    if (error.status === 403) return "You can view documents, but you do not have permission to change files.";
    if (error.status === 413) return "Maximum file size: 25 MB.";
    if (error.status === 415) return "Use a PDF, image, receipt, invoice, permit, or note file.";
    return error.message || fallback;
  }
  return fallback;
}

function documentOcrActionError(error: unknown, fallback: string) {
  if (error instanceof HomeLedgerApiError) {
    if (error.status === 403) return "You can view documents, but you do not have permission to request text reading.";
    if (error.status === 404) return "Document text is not available.";
    if (error.status === 409) return "Attach a file before requesting document text.";
    return error.message || fallback;
  }
  return fallback;
}
