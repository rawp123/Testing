import { useEffect, useMemo, useState } from "react";
import type { HomeLedgerApiClient } from "../api/client";
import type { PropertyRecord } from "../api/types";
import { ActionBar } from "../components/ActionBar";
import { CompactRecordTable, type CompactRecordColumn } from "../components/CompactRecordTable";
import { EmptyState } from "../components/EmptyState";
import { FormField } from "../components/FormField";
import { Modal } from "../components/Modal";
import { PageTitle } from "../components/PageTitle";
import { PanelHeader, WorkspacePanel } from "../components/WorkspacePanel";
import { formValuesToPropertyInput, propertyToFormValues, toPropertyRows, type PropertyFormValues, type PropertyRow } from "./property-model";

type PropertiesState =
  | { status: "loading"; properties: PropertyRecord[] }
  | { status: "ready"; properties: PropertyRecord[] }
  | { status: "error"; properties: PropertyRecord[]; message: string };

export function PropertiesPage({
  client,
  workspaceId,
  workspaceName
}: {
  client: HomeLedgerApiClient;
  workspaceId: string;
  workspaceName: string;
}) {
  const [state, setState] = useState<PropertiesState>({ status: "loading", properties: [] });
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<PropertyRecord | null>(null);
  const [formValues, setFormValues] = useState<PropertyFormValues>(() => propertyToFormValues());
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ status: "loading", properties: current.properties }));
    client.listProperties(workspaceId)
      .then((properties) => {
        if (!cancelled) setState({ status: "ready", properties });
      })
      .catch(() => {
        if (!cancelled) setState((current) => ({
          status: "error",
          properties: current.properties,
          message: "Properties could not be loaded."
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [client, workspaceId]);

  const openCreate = () => {
    setSelectedProperty(null);
    setFormValues(propertyToFormValues());
    setFormError("");
    setModalMode("create");
  };

  const openEdit = (property: PropertyRecord) => {
    setSelectedProperty(property);
    setFormValues(propertyToFormValues(property));
    setFormError("");
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedProperty(null);
    setFormError("");
  };

  const refreshProperties = async () => {
    const properties = await client.listProperties(workspaceId);
    setState({ status: "ready", properties });
  };

  const saveProperty = async () => {
    const input = formValuesToPropertyInput(formValues);
    if (!input.name) {
      setFormError("Property name is required.");
      return;
    }

    try {
      if (modalMode === "edit" && selectedProperty) {
        await client.updateProperty(workspaceId, selectedProperty.id, input);
      } else {
        await client.createProperty(workspaceId, input);
      }
      closeModal();
      await refreshProperties();
    } catch {
      setFormError("Property could not be saved.");
    }
  };

  const archiveProperty = async (property: PropertyRecord) => {
    try {
      await client.archiveProperty(workspaceId, property.id);
      await refreshProperties();
    } catch {
      setState((current) => ({
        status: "error",
        properties: current.properties,
        message: "Property could not be archived."
      }));
    }
  };

  return (
    <PropertiesView
      errorMessage={state.status === "error" ? state.message : ""}
      formError={formError}
      formValues={formValues}
      loading={state.status === "loading"}
      modalMode={modalMode}
      onArchiveProperty={archiveProperty}
      onCloseModal={closeModal}
      onEditProperty={openEdit}
      onFormChange={setFormValues}
      onNewProperty={openCreate}
      onSaveProperty={saveProperty}
      properties={state.properties}
      selectedProperty={selectedProperty}
      workspaceName={workspaceName}
    />
  );
}

export function PropertiesView({
  errorMessage = "",
  formError = "",
  formValues,
  loading = false,
  modalMode = null,
  onArchiveProperty,
  onCloseModal,
  onEditProperty,
  onFormChange,
  onNewProperty,
  onSaveProperty,
  properties,
  selectedProperty,
  workspaceName
}: {
  errorMessage?: string;
  formError?: string;
  formValues: PropertyFormValues;
  loading?: boolean;
  modalMode?: "create" | "edit" | null;
  onArchiveProperty: (property: PropertyRecord) => void;
  onCloseModal: () => void;
  onEditProperty: (property: PropertyRecord) => void;
  onFormChange: (values: PropertyFormValues) => void;
  onNewProperty: () => void;
  onSaveProperty: () => void;
  properties: PropertyRecord[];
  selectedProperty?: PropertyRecord | null;
  workspaceName: string;
}) {
  const rows = useMemo(() => toPropertyRows(properties), [properties]);
  const columns = useMemo<CompactRecordColumn<PropertyRow>[]>(() => [
    {
      key: "name",
      header: "Property",
      className: "record-name-cell",
      render: (row) => (
        <div className="record-stack">
          <strong>{row.name}</strong>
          <span>{row.isPrimary ? "Primary property" : row.status}</span>
        </div>
      )
    },
    { key: "address", header: "Address", render: (row) => row.address },
    { key: "purchaseDate", header: "Purchase date", render: (row) => row.purchaseDate },
    { key: "purchasePrice", header: "Purchase price", align: "right", render: (row) => row.purchasePrice },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (row) => (
        <div className="row-actions">
          <button onClick={() => onEditProperty(row.source)} type="button">Edit</button>
          <button onClick={() => onArchiveProperty(row.source)} type="button">Archive</button>
        </div>
      )
    }
  ], [onArchiveProperty, onEditProperty]);

  return (
    <div className="page-stack">
      <PageTitle meta={workspaceName} title="Property records" />

      <ActionBar label="Property actions">
        <button className="button button-primary" onClick={onNewProperty} type="button"><span aria-hidden="true">+</span>Add property</button>
      </ActionBar>

      <WorkspacePanel className="properties-panel">
        <PanelHeader icon="⌁" title="Properties" />
        {errorMessage ? <div className="inline-error" role="alert">{errorMessage}</div> : null}
        {loading ? <p className="muted-copy">Loading properties...</p> : null}
        {!loading && !rows.length ? (
          <EmptyState title="No properties">Add a property to start organizing projects, expenses, and documents.</EmptyState>
        ) : null}
        {rows.length ? (
          <CompactRecordTable
            className="properties-table"
            columns={columns}
            getRowKey={(row) => row.id}
            rows={rows}
          />
        ) : null}
      </WorkspacePanel>

      {modalMode ? (
        <Modal
          footer={(
            <>
              <button className="button button-secondary" onClick={onCloseModal} type="button">Cancel</button>
              <button className="button button-primary" onClick={onSaveProperty} type="button">Save property</button>
            </>
          )}
          onClose={onCloseModal}
          subtitle={selectedProperty?.name || workspaceName}
          title={modalMode === "edit" ? "Edit property" : "Add property"}
        >
          {formError ? <div className="inline-error" role="alert">{formError}</div> : null}
          <FormField label="Name">
            <input
              name="name"
              onChange={(event) => onFormChange({ ...formValues, name: event.currentTarget.value })}
              value={formValues.name}
            />
          </FormField>
          <FormField helper="Use the address you recognize. No address parsing is applied." label="Address">
            <input
              name="display_address"
              onChange={(event) => onFormChange({ ...formValues, displayAddress: event.currentTarget.value })}
              value={formValues.displayAddress}
            />
          </FormField>
          <div className="form-grid two-column">
            <FormField label="Purchase date">
              <input
                name="purchase_date"
                onChange={(event) => onFormChange({ ...formValues, purchaseDate: event.currentTarget.value })}
                type="date"
                value={formValues.purchaseDate}
              />
            </FormField>
            <FormField helper="Optional. Enter dollars and cents." label="Purchase price">
              <input
                inputMode="decimal"
                name="purchase_price"
                onChange={(event) => onFormChange({ ...formValues, purchasePrice: event.currentTarget.value })}
                placeholder="0.00"
                value={formValues.purchasePrice}
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
          <label className="checkbox-row">
            <input
              checked={formValues.isPrimary}
              onChange={(event) => onFormChange({ ...formValues, isPrimary: event.currentTarget.checked })}
              type="checkbox"
            />
            <span>Primary property</span>
          </label>
        </Modal>
      ) : null}
    </div>
  );
}
