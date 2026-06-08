import { useEffect, useMemo, useState } from "react";
import { HomeLedgerApiError, type HomeLedgerApiClient } from "../api/client";
import type { DocumentRecord, ExpenseRecord, ProjectRecord, PropertyRecord } from "../api/types";
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

export function DocumentsPage({
  client,
  workspaceId,
  workspaceName
}: {
  client: HomeLedgerApiClient;
  workspaceId: string;
  workspaceName: string;
}) {
  const [state, setState] = useState<DocumentsState>({ status: "loading", documents: [], properties: [], projects: [], expenses: [] });
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentRecord | null>(null);
  const [formValues, setFormValues] = useState<DocumentFormValues>(() => documentToFormValues());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

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

  const propertyOptions = useMemo(() => propertyOptionsFromRecords(state.properties), [state.properties]);

  const openCreate = () => {
    setSelectedDocument(null);
    setFormValues(documentToFormValues(null, propertyOptions[0]?.value || ""));
    setSelectedFile(null);
    setFormError("");
    setNoticeMessage("");
    setModalMode("create");
  };

  const openEdit = (document: DocumentRecord) => {
    setSelectedDocument(document);
    setFormValues(documentToFormValues(document, propertyOptions[0]?.value || ""));
    setSelectedFile(null);
    setFormError("");
    setNoticeMessage("");
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedDocument(null);
    setSelectedFile(null);
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
    const fileValidationMessage = getDocumentFileValidationMessage(selectedFile);
    if (fileValidationMessage) {
      setFormError(fileValidationMessage);
      return;
    }
    const input = formValuesToDocumentInput(formValues, selectedFile?.name || "");
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
      if (selectedFile) {
        const attachResult = await client.attachDocumentFile(workspaceId, document.id, selectedFile);
        setNoticeMessage(attachResult.completed_without_browser_upload
          ? "File details attached. This environment does not provide a browser upload URL, so file bytes were not uploaded."
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

  const archiveDocument = async (document: DocumentRecord) => {
    try {
      await client.archiveDocument(workspaceId, document.id);
      await refreshDocuments();
    } catch {
      setState((current) => ({
        status: "error",
        documents: current.documents,
        properties: current.properties,
        projects: current.projects,
        expenses: current.expenses,
        message: "Document could not be archived."
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
      setNoticeMessage("File details are attached. This environment does not provide a browser download URL.");
    } catch (error) {
      setState((current) => ({
        ...current,
        status: "error",
        message: documentFileActionError(error, "File could not be opened.")
      }));
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
      onArchiveDocument={archiveDocument}
      onChangeFilter={setActiveFilter}
      onCloseModal={closeModal}
      onDownloadFile={downloadFile}
      onEditDocument={openEdit}
      onFileChange={setSelectedFile}
      onFormChange={setFormValues}
      onNewDocument={openCreate}
      onRemoveFile={removeFile}
      onSaveDocument={saveDocument}
      projects={state.projects}
      propertyOptions={propertyOptions}
      selectedDocument={selectedDocument}
      selectedFileName={selectedFile?.name || ""}
      workspaceName={workspaceName}
    />
  );
}

export function DocumentsView({
  activeFilter = "all",
  documents,
  errorMessage = "",
  expenses,
  formError = "",
  formValues,
  loading = false,
  modalMode = null,
  noticeMessage = "",
  onArchiveDocument,
  onChangeFilter,
  onCloseModal,
  onDownloadFile,
  onEditDocument,
  onFileChange,
  onFormChange,
  onNewDocument,
  onRemoveFile,
  onSaveDocument,
  projects,
  propertyOptions,
  selectedDocument,
  selectedFileName = "",
  workspaceName
}: {
  activeFilter?: string;
  documents: DocumentRecord[];
  errorMessage?: string;
  expenses: ExpenseRecord[];
  formError?: string;
  formValues: DocumentFormValues;
  loading?: boolean;
  modalMode?: "create" | "edit" | null;
  noticeMessage?: string;
  onArchiveDocument: (document: DocumentRecord) => void;
  onChangeFilter: (filter: string) => void;
  onCloseModal: () => void;
  onDownloadFile: (document: DocumentRecord) => void;
  onEditDocument: (document: DocumentRecord) => void;
  onFileChange: (file: File | null) => void;
  onFormChange: (values: DocumentFormValues) => void;
  onNewDocument: () => void;
  onRemoveFile: (document: DocumentRecord) => void;
  onSaveDocument: () => void;
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
    { key: "date", header: "Date", render: (row) => row.documentDate },
    { key: "openItems", header: "Open items", align: "right", render: (row) => row.openItems },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <div className="row-actions">
          {row.hasFile ? <button onClick={() => onDownloadFile(row.source)} type="button">View file</button> : null}
          <button onClick={() => onEditDocument(row.source)} type="button">{row.hasFile ? "Edit" : "Attach file"}</button>
          {row.hasFile ? <button onClick={() => onRemoveFile(row.source)} type="button">Remove file</button> : null}
          <button onClick={() => onArchiveDocument(row.source)} type="button">Archive</button>
        </div>
      )
    }
  ], [onArchiveDocument, onDownloadFile, onEditDocument, onRemoveFile]);

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
  const fileInputLabel = selectedDocumentFile ? "Replace file" : "File";
  const selectedFileLabel = selectedDocumentFile ? "Replacement file" : "Selected file";

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
        {loading ? <p className="muted-copy">Loading documents.</p> : null}
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
              <button className="button button-secondary" onClick={onCloseModal} type="button">Cancel</button>
              <button className="button button-primary" onClick={onSaveDocument} type="button">Save document</button>
            </>
          )}
          onClose={onCloseModal}
          subtitle={selectedDocument?.property_name || workspaceName}
          title={modalMode === "edit" ? "Edit document" : "Add document"}
        >
          {formError ? <div className="inline-error" role="alert">{formError}</div> : null}
          {selectedDocumentFile ? (
            <div className="file-summary-panel">
              <strong>Attached file</strong>
              <span>{formatDocumentFileSummary(selectedDocumentFile)}</span>
            </div>
          ) : null}
          <FormField helper={documentFileHelperFor(selectedDocument)} label={fileInputLabel}>
            <input
              name="file"
              onChange={(event) => changeFile(event.currentTarget.files?.[0] || null)}
              type="file"
            />
          </FormField>
          {selectedFileName ? <p className="helper-note">{selectedFileLabel}: {safeFileName(selectedFileName)}</p> : null}
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
    </div>
  );
}

function buildDocumentFilterOptions(rows: DocumentRow[]): FilterChip[] {
  const options: FilterChip[] = [{ value: "all", label: "All", count: rows.length }];
  const openCount = rows.filter((row) => row.openItemCount > 0).length;
  if (openCount) options.push({ value: "open", label: "Open items", count: openCount });

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
