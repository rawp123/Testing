import { useEffect, useMemo, useState } from "react";
import type { HomeLedgerApiClient } from "../api/client";
import type { VendorRecord } from "../api/types";
import { ActionBar } from "../components/ActionBar";
import { CompactRecordTable, type CompactRecordColumn } from "../components/CompactRecordTable";
import { EmptyState } from "../components/EmptyState";
import { FilterChipGroup, FilterPanel } from "../components/FilterPanel";
import { FormField } from "../components/FormField";
import { Modal } from "../components/Modal";
import { PageTitle } from "../components/PageTitle";
import { PanelHeader, WorkspacePanel } from "../components/WorkspacePanel";
import {
  buildVendorFilterOptions,
  filterVendorRows,
  formValuesToVendorInput,
  toVendorRows,
  vendorToFormValues,
  type VendorFormValues,
  type VendorRow
} from "./vendor-model";

type VendorsState =
  | { status: "loading"; vendors: VendorRecord[] }
  | { status: "ready"; vendors: VendorRecord[] }
  | { status: "error"; vendors: VendorRecord[]; message: string };

export function VendorsPage({
  client,
  workspaceId,
  workspaceName
}: {
  client: HomeLedgerApiClient;
  workspaceId: string;
  workspaceName: string;
}) {
  const [state, setState] = useState<VendorsState>({ status: "loading", vendors: [] });
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorRecord | null>(null);
  const [formValues, setFormValues] = useState<VendorFormValues>(() => vendorToFormValues());
  const [formError, setFormError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ status: "loading", vendors: current.vendors }));
    client.listVendors(workspaceId)
      .then((vendors) => {
        if (!cancelled) setState({ status: "ready", vendors });
      })
      .catch(() => {
        if (!cancelled) setState((current) => ({
          status: "error",
          vendors: current.vendors,
          message: "Vendors could not be loaded."
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId]);

  const openCreate = () => {
    setSelectedVendor(null);
    setFormValues(vendorToFormValues());
    setFormError("");
    setModalMode("create");
  };

  const openEdit = (vendor: VendorRecord) => {
    setSelectedVendor(vendor);
    setFormValues(vendorToFormValues(vendor));
    setFormError("");
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedVendor(null);
    setFormError("");
  };

  const refreshVendors = async () => {
    const vendors = await client.listVendors(workspaceId);
    setState({ status: "ready", vendors });
  };

  const saveVendor = async () => {
    const input = formValuesToVendorInput(formValues);
    if (!input.name) {
      setFormError("Vendor name is required.");
      return;
    }

    try {
      if (modalMode === "edit" && selectedVendor) {
        await client.updateVendor(workspaceId, selectedVendor.id, input);
      } else {
        await client.createVendor(workspaceId, input);
      }
      closeModal();
      await refreshVendors();
    } catch {
      setFormError("Vendor could not be saved.");
    }
  };

  const archiveVendor = async (vendor: VendorRecord) => {
    try {
      await client.archiveVendor(workspaceId, vendor.id);
      await refreshVendors();
    } catch {
      setState((current) => ({
        status: "error",
        vendors: current.vendors,
        message: "Vendor could not be archived."
      }));
    }
  };

  return (
    <VendorsView
      activeFilter={activeFilter}
      errorMessage={state.status === "error" ? state.message : ""}
      formError={formError}
      formValues={formValues}
      loading={state.status === "loading"}
      modalMode={modalMode}
      onArchiveVendor={archiveVendor}
      onChangeFilter={setActiveFilter}
      onCloseModal={closeModal}
      onEditVendor={openEdit}
      onFormChange={setFormValues}
      onNewVendor={openCreate}
      onSaveVendor={saveVendor}
      selectedVendor={selectedVendor}
      vendors={state.vendors}
      workspaceName={workspaceName}
    />
  );
}

export function VendorsView({
  activeFilter = "all",
  errorMessage = "",
  formError = "",
  formValues,
  loading = false,
  modalMode = null,
  onArchiveVendor,
  onChangeFilter,
  onCloseModal,
  onEditVendor,
  onFormChange,
  onNewVendor,
  onSaveVendor,
  selectedVendor,
  vendors,
  workspaceName
}: {
  activeFilter?: string;
  errorMessage?: string;
  formError?: string;
  formValues: VendorFormValues;
  loading?: boolean;
  modalMode?: "create" | "edit" | null;
  onArchiveVendor: (vendor: VendorRecord) => void;
  onChangeFilter: (filter: string) => void;
  onCloseModal: () => void;
  onEditVendor: (vendor: VendorRecord) => void;
  onFormChange: (values: VendorFormValues) => void;
  onNewVendor: () => void;
  onSaveVendor: () => void;
  selectedVendor?: VendorRecord | null;
  vendors: VendorRecord[];
  workspaceName: string;
}) {
  const rows = useMemo(() => toVendorRows(vendors), [vendors]);
  const filterOptions = useMemo(() => buildVendorFilterOptions(rows), [rows]);
  const filteredRows = useMemo(() => filterVendorRows(rows, activeFilter), [activeFilter, rows]);
  const columns = useMemo<CompactRecordColumn<VendorRow>[]>(() => [
    {
      key: "name",
      header: "Vendor",
      className: "record-name-cell",
      render: (row) => (
        <div className="record-stack">
          <strong>{row.name}</strong>
          <span>{row.source.notes || row.category}</span>
        </div>
      )
    },
    { key: "category", header: "Category", render: (row) => row.category },
    { key: "contact", header: "Contact", render: (row) => row.contact },
    { key: "phone", header: "Phone", render: (row) => row.phone },
    { key: "email", header: "Email", render: (row) => row.email },
    { key: "website", header: "Website", render: (row) => row.website },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <div className="row-actions">
          <button onClick={() => onEditVendor(row.source)} type="button">Edit</button>
          <button onClick={() => onArchiveVendor(row.source)} type="button">Archive</button>
        </div>
      )
    }
  ], [onArchiveVendor, onEditVendor]);

  return (
    <div className="page-stack">
      <PageTitle meta={workspaceName} title="Vendor records" />

      <ActionBar label="Vendor actions">
        <button className="button button-primary" onClick={onNewVendor} type="button"><span aria-hidden="true">+</span>Add vendor</button>
      </ActionBar>

      <FilterPanel className="vendors-filter-panel" onClear={() => onChangeFilter("all")}>
        <FilterChipGroup
          label="Vendor filters by contact details and category"
          onChange={onChangeFilter}
          options={filterOptions}
          value={activeFilter}
        />
      </FilterPanel>

      <WorkspacePanel className="vendors-panel">
        <PanelHeader icon="◎" title="Vendors" />
        {errorMessage ? <div className="inline-error" role="alert">{errorMessage}</div> : null}
        {loading ? <p className="muted-copy">Loading vendors.</p> : null}
        {!loading && !rows.length ? (
          <EmptyState title="No vendors">Add people and companies you paid or hired.</EmptyState>
        ) : null}
        {!loading && rows.length > 0 && !filteredRows.length ? (
          <EmptyState title="No vendors for this filter">Clear the vendor filter to see all vendors.</EmptyState>
        ) : null}
        {filteredRows.length ? (
          <CompactRecordTable
            className="vendors-table"
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
              <button className="button button-primary" onClick={onSaveVendor} type="button">Save vendor</button>
            </>
          )}
          onClose={onCloseModal}
          subtitle={selectedVendor?.name || "People and companies you paid or hired"}
          title={modalMode === "edit" ? "Edit vendor" : "Add vendor"}
        >
          {formError ? <div className="inline-error" role="alert">{formError}</div> : null}
          <FormField helper="Similar names are allowed. Use the name shown on your records." label="Name">
            <input
              name="name"
              onChange={(event) => onFormChange({ ...formValues, name: event.currentTarget.value })}
              placeholder="Contractor, store, agency, or person"
              value={formValues.name}
            />
          </FormField>
          <FormField label="Category">
            <input
              name="category"
              onChange={(event) => onFormChange({ ...formValues, category: event.currentTarget.value })}
              value={formValues.category}
            />
          </FormField>
          <div className="form-grid two-column">
            <FormField label="Contact name">
              <input
                name="contact_name"
                onChange={(event) => onFormChange({ ...formValues, contactName: event.currentTarget.value })}
                value={formValues.contactName}
              />
            </FormField>
            <FormField label="Phone">
              <input
                name="phone"
                onChange={(event) => onFormChange({ ...formValues, phone: event.currentTarget.value })}
                value={formValues.phone}
              />
            </FormField>
          </div>
          <div className="form-grid two-column">
            <FormField label="Email">
              <input
                name="email"
                onChange={(event) => onFormChange({ ...formValues, email: event.currentTarget.value })}
                type="email"
                value={formValues.email}
              />
            </FormField>
            <FormField label="Website">
              <input
                name="website"
                onChange={(event) => onFormChange({ ...formValues, website: event.currentTarget.value })}
                value={formValues.website}
              />
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
