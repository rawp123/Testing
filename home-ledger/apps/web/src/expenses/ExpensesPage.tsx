import { useEffect, useMemo, useState } from "react";
import type { HomeLedgerApiClient } from "../api/client";
import type { ExpenseRecord, ProjectRecord, PropertyRecord, VendorRecord } from "../api/types";
import { ActionBar } from "../components/ActionBar";
import { CompactRecordTable, type CompactRecordColumn } from "../components/CompactRecordTable";
import { EmptyState } from "../components/EmptyState";
import { FilterChipGroup, FilterPanel, type FilterChip } from "../components/FilterPanel";
import { FormField } from "../components/FormField";
import { Modal } from "../components/Modal";
import { PageTitle } from "../components/PageTitle";
import { PanelHeader, WorkspacePanel } from "../components/WorkspacePanel";
import {
  DOCUMENTATION_STATUS_OPTIONS,
  RECORD_TREATMENT_OPTIONS,
  documentationStatusLabel,
  expenseToFormValues,
  formValuesToExpenseInput,
  projectOptionsFromRecords,
  propertyOptionsFromRecords,
  recordTreatmentLabel,
  toExpenseRows,
  type ExpenseFormValues,
  type ExpenseRow,
  type SelectOption
} from "./expense-model";
import { vendorOptionsFromRecords, type VendorSelectOption } from "../vendors/vendor-model";

type ExpensesState =
  | { status: "loading"; expenses: ExpenseRecord[]; properties: PropertyRecord[]; projects: ProjectRecord[]; vendors: VendorRecord[] }
  | { status: "ready"; expenses: ExpenseRecord[]; properties: PropertyRecord[]; projects: ProjectRecord[]; vendors: VendorRecord[] }
  | { status: "error"; expenses: ExpenseRecord[]; properties: PropertyRecord[]; projects: ProjectRecord[]; vendors: VendorRecord[]; message: string };

export function ExpensesPage({
  client,
  workspaceId,
  workspaceName
}: {
  client: HomeLedgerApiClient;
  workspaceId: string;
  workspaceName: string;
}) {
  const [state, setState] = useState<ExpensesState>({ status: "loading", expenses: [], properties: [], projects: [], vendors: [] });
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseRecord | null>(null);
  const [formValues, setFormValues] = useState<ExpenseFormValues>(() => expenseToFormValues());
  const [formError, setFormError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({
      status: "loading",
      expenses: current.expenses,
      properties: current.properties,
      projects: current.projects,
      vendors: current.vendors
    }));
    Promise.all([
      client.listExpenses(workspaceId),
      client.listProperties(workspaceId),
      client.listProjects(workspaceId),
      client.listVendors(workspaceId)
    ])
      .then(([expenses, properties, projects, vendors]) => {
        if (!cancelled) setState({ status: "ready", expenses, properties, projects, vendors });
      })
      .catch(() => {
        if (!cancelled) setState((current) => ({
          status: "error",
          expenses: current.expenses,
          properties: current.properties,
          projects: current.projects,
          vendors: current.vendors,
          message: "Expenses could not be loaded."
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [client, workspaceId]);

  const propertyOptions = useMemo(() => propertyOptionsFromRecords(state.properties), [state.properties]);
  const vendorOptions = useMemo(() => vendorOptionsFromRecords(state.vendors), [state.vendors]);

  const openCreate = () => {
    setSelectedExpense(null);
    setFormValues(expenseToFormValues(null, propertyOptions[0]?.value || ""));
    setFormError("");
    setModalMode("create");
  };

  const openEdit = (expense: ExpenseRecord) => {
    setSelectedExpense(expense);
    setFormValues(expenseToFormValues(expense, propertyOptions[0]?.value || ""));
    setFormError("");
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedExpense(null);
    setFormError("");
  };

  const refreshExpenses = async () => {
    const [expenses, properties, projects, vendors] = await Promise.all([
      client.listExpenses(workspaceId),
      client.listProperties(workspaceId),
      client.listProjects(workspaceId),
      client.listVendors(workspaceId)
    ]);
    setState({ status: "ready", expenses, properties, projects, vendors });
  };

  const saveExpense = async () => {
    const input = formValuesToExpenseInput(formValues);
    if (!input.property_id) {
      setFormError("Property is required.");
      return;
    }
    if (!input.description) {
      setFormError("Description is required.");
      return;
    }
    if (!formValues.amount.trim()) {
      setFormError("Amount is required.");
      return;
    }
    if (!input.category) {
      setFormError("Category is required.");
      return;
    }

    try {
      if (modalMode === "edit" && selectedExpense) {
        await client.updateExpense(workspaceId, selectedExpense.id, input);
      } else {
        await client.createExpense(workspaceId, input);
      }
      closeModal();
      await refreshExpenses();
    } catch {
      setFormError("Expense could not be saved.");
    }
  };

  const archiveExpense = async (expense: ExpenseRecord) => {
    try {
      await client.archiveExpense(workspaceId, expense.id);
      await refreshExpenses();
    } catch {
      setState((current) => ({
        status: "error",
        expenses: current.expenses,
        properties: current.properties,
        projects: current.projects,
        vendors: current.vendors,
        message: "Expense could not be archived."
      }));
    }
  };

  return (
    <ExpensesView
      activeFilter={activeFilter}
      errorMessage={state.status === "error" ? state.message : ""}
      expenses={state.expenses}
      formError={formError}
      formValues={formValues}
      loading={state.status === "loading"}
      modalMode={modalMode}
      onArchiveExpense={archiveExpense}
      onChangeFilter={setActiveFilter}
      onCloseModal={closeModal}
      onEditExpense={openEdit}
      onFormChange={setFormValues}
      onNewExpense={openCreate}
      onSaveExpense={saveExpense}
      projects={state.projects}
      propertyOptions={propertyOptions}
      selectedExpense={selectedExpense}
      vendorOptions={vendorOptions}
      workspaceName={workspaceName}
    />
  );
}

export function ExpensesView({
  activeFilter = "all",
  errorMessage = "",
  expenses,
  formError = "",
  formValues,
  loading = false,
  modalMode = null,
  onArchiveExpense,
  onChangeFilter,
  onCloseModal,
  onEditExpense,
  onFormChange,
  onNewExpense,
  onSaveExpense,
  projects,
  propertyOptions,
  selectedExpense,
  vendorOptions,
  workspaceName
}: {
  activeFilter?: string;
  errorMessage?: string;
  expenses: ExpenseRecord[];
  formError?: string;
  formValues: ExpenseFormValues;
  loading?: boolean;
  modalMode?: "create" | "edit" | null;
  onArchiveExpense: (expense: ExpenseRecord) => void;
  onChangeFilter: (filter: string) => void;
  onCloseModal: () => void;
  onEditExpense: (expense: ExpenseRecord) => void;
  onFormChange: (values: ExpenseFormValues) => void;
  onNewExpense: () => void;
  onSaveExpense: () => void;
  projects: ProjectRecord[];
  propertyOptions: SelectOption[];
  selectedExpense?: ExpenseRecord | null;
  vendorOptions: VendorSelectOption[];
  workspaceName: string;
}) {
  const rows = useMemo(() => toExpenseRows(expenses), [expenses]);
  const filterOptions = useMemo(() => buildExpenseFilterOptions(rows), [rows]);
  const filteredRows = useMemo(() => filterExpenseRows(rows, activeFilter), [activeFilter, rows]);
  const projectOptions = useMemo(() => projectOptionsFromRecords(projects, formValues.propertyId), [formValues.propertyId, projects]);
  const canAddExpense = propertyOptions.length > 0;
  const columns = useMemo<CompactRecordColumn<ExpenseRow>[]>(() => [
    {
      key: "expense",
      header: "Expense",
      className: "record-name-cell",
      render: (row) => (
        <div className="record-stack">
          <strong>{row.vendor}</strong>
          <span>{row.expense}</span>
        </div>
      )
    },
    { key: "linkedTo", header: "Linked to", render: (row) => row.linkedTo },
    { key: "category", header: "Category", render: (row) => row.category },
    { key: "recordTreatment", header: "Review type", render: (row) => row.recordTreatment },
    { key: "documentationStatus", header: "Documentation", render: (row) => row.documentationStatus },
    { key: "date", header: "Date", render: (row) => row.expenseDate },
    { key: "amount", header: "Amount", align: "right", render: (row) => row.amount },
    { key: "openItems", header: "Open items", align: "right", render: (row) => row.openItems },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <div className="row-actions">
          <button onClick={() => onEditExpense(row.source)} type="button">Edit</button>
          <button onClick={() => onArchiveExpense(row.source)} type="button">Archive</button>
        </div>
      )
    }
  ], [onArchiveExpense, onEditExpense]);

  const changeProperty = (propertyId: string) => {
    const currentProject = projects.find((project) => project.id === formValues.projectId);
    onFormChange({
      ...formValues,
      propertyId,
      projectId: currentProject?.property_id === propertyId ? formValues.projectId : ""
    });
  };

  return (
    <div className="page-stack">
      <PageTitle meta={workspaceName} title="Expense records" />

      <ActionBar label="Expense actions">
        <button
          className="button button-primary"
          disabled={!canAddExpense}
          onClick={onNewExpense}
          title={canAddExpense ? "Add expense" : "Add a property before creating expenses"}
          type="button"
        >
          <span aria-hidden="true">+</span>Add expense
        </button>
      </ActionBar>

      <FilterPanel className="expenses-filter-panel" onClear={() => onChangeFilter("all")}>
        <FilterChipGroup
          label="Expense filters"
          onChange={onChangeFilter}
          options={filterOptions}
          value={activeFilter}
        />
      </FilterPanel>

      <WorkspacePanel className="expenses-panel">
        <PanelHeader icon="▥" title="Expenses" />
        {errorMessage ? <div className="inline-error" role="alert">{errorMessage}</div> : null}
        {loading ? <p className="muted-copy">Loading expenses.</p> : null}
        {!loading && !rows.length ? (
          <EmptyState title="No expenses">Add an expense and link it to a property or project.</EmptyState>
        ) : null}
        {!loading && rows.length > 0 && !filteredRows.length ? (
          <EmptyState title="No expenses for this filter">Clear the expense filter to see all expenses.</EmptyState>
        ) : null}
        {filteredRows.length ? (
          <CompactRecordTable
            className="expenses-table"
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
              <button className="button button-primary" onClick={onSaveExpense} type="button">Save expense</button>
            </>
          )}
          onClose={onCloseModal}
          subtitle={selectedExpense?.property_name || workspaceName}
          title={modalMode === "edit" ? "Edit expense" : "Add expense"}
        >
          {formError ? <div className="inline-error" role="alert">{formError}</div> : null}
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
                onChange={(event) => onFormChange({ ...formValues, projectId: event.currentTarget.value })}
                value={formValues.projectId}
              >
                <option value="">No project</option>
                {projectOptions.map((project) => (
                  <option key={project.value} value={project.value}>{project.label}</option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Description">
            <input
              name="description"
              onChange={(event) => onFormChange({ ...formValues, description: event.currentTarget.value })}
              value={formValues.description}
            />
          </FormField>
          <div className="form-grid two-column">
            <FormField helper="Select a saved vendor, or leave unassigned." label="Vendor/payee">
              <select
                name="vendor_id"
                onChange={(event) => onFormChange({
                  ...formValues,
                  vendorId: event.currentTarget.value,
                  vendorNameRaw: event.currentTarget.value ? "" : formValues.vendorNameRaw
                })}
                value={formValues.vendorId}
              >
                <option value="">Unassigned / unknown</option>
                {vendorOptions.map((vendor) => (
                  <option key={vendor.value} value={vendor.value}>{vendor.label}</option>
                ))}
              </select>
            </FormField>
            <FormField helper="Use only when no saved vendor is selected." label="Payee name if unassigned">
              <input
                name="vendor_name_raw"
                disabled={Boolean(formValues.vendorId)}
                onChange={(event) => onFormChange({ ...formValues, vendorNameRaw: event.currentTarget.value })}
                value={formValues.vendorNameRaw}
              />
            </FormField>
            <FormField helper="Stored as cents." label="Amount">
              <input
                inputMode="decimal"
                name="amount"
                onChange={(event) => onFormChange({ ...formValues, amount: event.currentTarget.value })}
                placeholder="0.00"
                value={formValues.amount}
              />
            </FormField>
          </div>
          <div className="form-grid two-column">
            <FormField label="Expense date">
              <input
                name="expense_date"
                onChange={(event) => onFormChange({ ...formValues, expenseDate: event.currentTarget.value })}
                type="date"
                value={formValues.expenseDate}
              />
            </FormField>
            <FormField label="Category">
              <input
                name="category"
                onChange={(event) => onFormChange({ ...formValues, category: event.currentTarget.value })}
                value={formValues.category}
              />
            </FormField>
          </div>
          <div className="form-grid two-column">
            <FormField label="Review type">
              <select
                name="record_treatment"
                onChange={(event) => onFormChange({ ...formValues, recordTreatment: event.currentTarget.value })}
                value={formValues.recordTreatment}
              >
                {RECORD_TREATMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Documentation">
              <select
                name="documentation_status"
                onChange={(event) => onFormChange({ ...formValues, documentationStatus: event.currentTarget.value })}
                value={formValues.documentationStatus}
              >
                {DOCUMENTATION_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FormField>
          </div>
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

function buildExpenseFilterOptions(rows: ExpenseRow[]): FilterChip[] {
  const options: FilterChip[] = [{ value: "all", label: "All", count: rows.length }];
  const openCount = rows.filter((row) => row.openItemCount > 0).length;
  if (openCount) options.push({ value: "open", label: "Open items", count: openCount });

  const documentationStatuses = new Map<string, number>();
  const recordTreatments = new Map<string, number>();
  for (const row of rows) {
    const documentationStatus = row.source.documentation_status || "no_document_yet";
    const recordTreatment = row.source.record_treatment || "review_later";
    documentationStatuses.set(documentationStatus, (documentationStatuses.get(documentationStatus) || 0) + 1);
    recordTreatments.set(recordTreatment, (recordTreatments.get(recordTreatment) || 0) + 1);
  }

  for (const [status, count] of [...documentationStatuses.entries()].sort((left, right) => documentationStatusLabel(left[0]).localeCompare(documentationStatusLabel(right[0])))) {
    options.push({ value: `documentation:${status}`, label: documentationStatusLabel(status), count });
  }
  for (const [treatment, count] of [...recordTreatments.entries()].sort((left, right) => recordTreatmentLabel(left[0]).localeCompare(recordTreatmentLabel(right[0])))) {
    options.push({ value: `treatment:${treatment}`, label: recordTreatmentLabel(treatment), count });
  }
  return options;
}

function filterExpenseRows(rows: ExpenseRow[], filter: string) {
  if (filter === "open") return rows.filter((row) => row.openItemCount > 0);
  if (filter.startsWith("documentation:")) {
    const status = filter.slice("documentation:".length);
    return rows.filter((row) => row.source.documentation_status === status);
  }
  if (filter.startsWith("treatment:")) {
    const treatment = filter.slice("treatment:".length);
    return rows.filter((row) => row.source.record_treatment === treatment);
  }
  return rows;
}
