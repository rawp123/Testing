import { useEffect, useMemo, useState } from "react";
import type { HomeLedgerApiClient } from "../api/client";
import type { ProjectRecord, PropertyRecord } from "../api/types";
import { ActionBar } from "../components/ActionBar";
import { CompactRecordTable, type CompactRecordColumn } from "../components/CompactRecordTable";
import { EmptyState } from "../components/EmptyState";
import { FilterChipGroup, FilterPanel, type FilterChip } from "../components/FilterPanel";
import { FormField } from "../components/FormField";
import { Modal } from "../components/Modal";
import { PageTitle } from "../components/PageTitle";
import { PanelHeader, WorkspacePanel } from "../components/WorkspacePanel";
import {
  PROJECT_STATUS_OPTIONS,
  formValuesToProjectInput,
  projectToFormValues,
  propertyOptionsFromRecords,
  statusLabel,
  toProjectRows,
  type ProjectFormValues,
  type ProjectRow,
  type SelectOption
} from "./project-model";

type ProjectsState =
  | { status: "loading"; projects: ProjectRecord[]; properties: PropertyRecord[] }
  | { status: "ready"; projects: ProjectRecord[]; properties: PropertyRecord[] }
  | { status: "error"; projects: ProjectRecord[]; properties: PropertyRecord[]; message: string };

export function ProjectsPage({
  client,
  workspaceId,
  workspaceName
}: {
  client: HomeLedgerApiClient;
  workspaceId: string;
  workspaceName: string;
}) {
  const [state, setState] = useState<ProjectsState>({ status: "loading", projects: [], properties: [] });
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectRecord | null>(null);
  const [formValues, setFormValues] = useState<ProjectFormValues>(() => projectToFormValues());
  const [formError, setFormError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ status: "loading", projects: current.projects, properties: current.properties }));
    Promise.all([
      client.listProjects(workspaceId),
      client.listProperties(workspaceId)
    ])
      .then(([projects, properties]) => {
        if (!cancelled) setState({ status: "ready", projects, properties });
      })
      .catch(() => {
        if (!cancelled) setState((current) => ({
          status: "error",
          projects: current.projects,
          properties: current.properties,
          message: "Projects could not be loaded."
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId]);

  const propertyOptions = useMemo(() => propertyOptionsFromRecords(state.properties), [state.properties]);

  const openCreate = () => {
    setSelectedProject(null);
    setFormValues(projectToFormValues(null, propertyOptions[0]?.value || ""));
    setFormError("");
    setModalMode("create");
  };

  const openEdit = (project: ProjectRecord) => {
    setSelectedProject(project);
    setFormValues(projectToFormValues(project, propertyOptions[0]?.value || ""));
    setFormError("");
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedProject(null);
    setFormError("");
  };

  const refreshProjects = async () => {
    const [projects, properties] = await Promise.all([
      client.listProjects(workspaceId),
      client.listProperties(workspaceId)
    ]);
    setState({ status: "ready", projects, properties });
  };

  const saveProject = async () => {
    const input = formValuesToProjectInput(formValues);
    if (!input.property_id) {
      setFormError("Property is required.");
      return;
    }
    if (!input.name) {
      setFormError("Project name is required.");
      return;
    }
    if (!input.category) {
      setFormError("Category is required.");
      return;
    }

    try {
      if (modalMode === "edit" && selectedProject) {
        await client.updateProject(workspaceId, selectedProject.id, input);
      } else {
        await client.createProject(workspaceId, input);
      }
      closeModal();
      await refreshProjects();
    } catch {
      setFormError("Project could not be saved.");
    }
  };

  const archiveProject = async (project: ProjectRecord) => {
    try {
      await client.archiveProject(workspaceId, project.id);
      await refreshProjects();
    } catch {
      setState((current) => ({
        status: "error",
        projects: current.projects,
        properties: current.properties,
        message: "Project could not be archived."
      }));
    }
  };

  return (
    <ProjectsView
      activeFilter={activeFilter}
      errorMessage={state.status === "error" ? state.message : ""}
      formError={formError}
      formValues={formValues}
      loading={state.status === "loading"}
      modalMode={modalMode}
      onArchiveProject={archiveProject}
      onChangeFilter={setActiveFilter}
      onCloseModal={closeModal}
      onEditProject={openEdit}
      onFormChange={setFormValues}
      onNewProject={openCreate}
      onSaveProject={saveProject}
      projects={state.projects}
      propertyOptions={propertyOptions}
      selectedProject={selectedProject}
      workspaceName={workspaceName}
    />
  );
}

export function ProjectsView({
  activeFilter = "all",
  errorMessage = "",
  formError = "",
  formValues,
  loading = false,
  modalMode = null,
  onArchiveProject,
  onChangeFilter,
  onCloseModal,
  onEditProject,
  onFormChange,
  onNewProject,
  onSaveProject,
  projects,
  propertyOptions,
  selectedProject,
  workspaceName
}: {
  activeFilter?: string;
  errorMessage?: string;
  formError?: string;
  formValues: ProjectFormValues;
  loading?: boolean;
  modalMode?: "create" | "edit" | null;
  onArchiveProject: (project: ProjectRecord) => void;
  onChangeFilter: (filter: string) => void;
  onCloseModal: () => void;
  onEditProject: (project: ProjectRecord) => void;
  onFormChange: (values: ProjectFormValues) => void;
  onNewProject: () => void;
  onSaveProject: () => void;
  projects: ProjectRecord[];
  propertyOptions: SelectOption[];
  selectedProject?: ProjectRecord | null;
  workspaceName: string;
}) {
  const rows = useMemo(() => toProjectRows(projects), [projects]);
  const filterOptions = useMemo(() => buildProjectFilterOptions(rows), [rows]);
  const filteredRows = useMemo(() => filterProjectRows(rows, activeFilter), [activeFilter, rows]);
  const canAddProject = propertyOptions.length > 0;
  const columns = useMemo<CompactRecordColumn<ProjectRow>[]>(() => [
    {
      key: "name",
      header: "Project",
      className: "record-name-cell",
      render: (row) => (
        <div className="record-stack">
          <strong>{row.name}</strong>
          <span>{row.source.scope_summary || row.source.notes || row.propertyName}</span>
        </div>
      )
    },
    { key: "property", header: "Property", render: (row) => row.propertyName },
    { key: "status", header: "Status", render: (row) => row.status },
    { key: "category", header: "Category", render: (row) => row.category },
    { key: "dates", header: "Dates", render: (row) => row.dateRange },
    { key: "contractor", header: "Vendor", render: (row) => row.contractor },
    { key: "openItems", header: "Open items", align: "right", render: (row) => row.openItems },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <div className="row-actions">
          <button onClick={() => onEditProject(row.source)} type="button">Edit</button>
          <button onClick={() => onArchiveProject(row.source)} type="button">Archive</button>
        </div>
      )
    }
  ], [onArchiveProject, onEditProject]);

  return (
    <div className="page-stack">
      <PageTitle meta={workspaceName} title="Project records" />

      <ActionBar label="Project actions">
        <button
          className="button button-primary"
          disabled={!canAddProject}
          onClick={onNewProject}
          title={canAddProject ? "Add project" : "Add a property before creating projects"}
          type="button"
        >
          <span aria-hidden="true">+</span>Add project
        </button>
      </ActionBar>

      <FilterPanel className="projects-filter-panel" onClear={() => onChangeFilter("all")}>
        <FilterChipGroup
          label="Project filters"
          onChange={onChangeFilter}
          options={filterOptions}
          value={activeFilter}
        />
      </FilterPanel>

      <WorkspacePanel className="projects-panel">
        <PanelHeader icon="▣" title="Projects" />
        {errorMessage ? <div className="inline-error" role="alert">{errorMessage}</div> : null}
        {loading ? <p className="muted-copy">Loading projects.</p> : null}
        {!loading && !rows.length ? (
          <EmptyState title="No projects">Add a project after the property record is set up.</EmptyState>
        ) : null}
        {!loading && rows.length > 0 && !filteredRows.length ? (
          <EmptyState title="No projects for this filter">Clear the project filter to see all projects.</EmptyState>
        ) : null}
        {filteredRows.length ? (
          <CompactRecordTable
            className="projects-table"
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
              <button className="button button-primary" onClick={onSaveProject} type="button">Save project</button>
            </>
          )}
          onClose={onCloseModal}
          subtitle={selectedProject?.property_name || workspaceName}
          title={modalMode === "edit" ? "Edit project" : "Add project"}
        >
          {formError ? <div className="inline-error" role="alert">{formError}</div> : null}
          <FormField label="Property">
            <select
              name="property_id"
              onChange={(event) => onFormChange({ ...formValues, propertyId: event.currentTarget.value })}
              value={formValues.propertyId}
            >
              <option value="">Select property</option>
              {propertyOptions.map((property) => (
                <option key={property.value} value={property.value}>{property.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Name">
            <input
              name="name"
              onChange={(event) => onFormChange({ ...formValues, name: event.currentTarget.value })}
              value={formValues.name}
            />
          </FormField>
          <div className="form-grid two-column">
            <FormField label="Status">
              <select
                name="status"
                onChange={(event) => onFormChange({ ...formValues, status: event.currentTarget.value })}
                value={formValues.status}
              >
                {PROJECT_STATUS_OPTIONS.map((status) => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
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
            <FormField label="Start date">
              <input
                name="start_date"
                onChange={(event) => onFormChange({ ...formValues, startDate: event.currentTarget.value })}
                type="date"
                value={formValues.startDate}
              />
            </FormField>
            <FormField label="Completion date">
              <input
                name="completion_date"
                onChange={(event) => onFormChange({ ...formValues, completionDate: event.currentTarget.value })}
                type="date"
                value={formValues.completionDate}
              />
            </FormField>
          </div>
          <div className="form-grid two-column">
            <FormField label="Vendor or contractor">
              <input
                name="contractor_name_raw"
                onChange={(event) => onFormChange({ ...formValues, contractorNameRaw: event.currentTarget.value })}
                value={formValues.contractorNameRaw}
              />
            </FormField>
            <FormField label="Permit number">
              <input
                name="permit_number"
                onChange={(event) => onFormChange({ ...formValues, permitNumber: event.currentTarget.value })}
                value={formValues.permitNumber}
              />
            </FormField>
          </div>
          <FormField label="Scope">
            <textarea
              name="scope_summary"
              onChange={(event) => onFormChange({ ...formValues, scopeSummary: event.currentTarget.value })}
              value={formValues.scopeSummary}
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

function buildProjectFilterOptions(rows: ProjectRow[]): FilterChip[] {
  const options: FilterChip[] = [{ value: "all", label: "All", count: rows.length }];
  const openCount = rows.filter((row) => row.openItemCount > 0).length;
  if (openCount) {
    options.push({ value: "open", label: "Open items", count: openCount });
  }

  const statuses = new Map<string, number>();
  for (const row of rows) {
    const status = row.source.status || "planned";
    statuses.set(status, (statuses.get(status) || 0) + 1);
  }
  for (const [status, count] of [...statuses.entries()].sort((left, right) => statusLabel(left[0]).localeCompare(statusLabel(right[0])))) {
    options.push({ value: `status:${status}`, label: statusLabel(status), count });
  }
  return options;
}

function filterProjectRows(rows: ProjectRow[], filter: string) {
  if (filter === "open") return rows.filter((row) => row.openItemCount > 0);
  if (filter.startsWith("status:")) {
    const status = filter.slice("status:".length);
    return rows.filter((row) => row.source.status === status);
  }
  return rows;
}
