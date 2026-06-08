import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionBar } from "../src/components/ActionBar";
import { AppShell } from "../src/components/AppShell";
import { CompactRecordTable, type CompactRecordColumn } from "../src/components/CompactRecordTable";
import { FilterChipGroup, FilterPanel } from "../src/components/FilterPanel";
import { FormField } from "../src/components/FormField";
import { Modal } from "../src/components/Modal";
import { PageTitle } from "../src/components/PageTitle";
import { PanelHeader, WorkspacePanel } from "../src/components/WorkspacePanel";

describe("shared web UI components", () => {
  it("renders page panel and action primitives with app-aligned classes", () => {
    const html = renderToStaticMarkup(
      <>
        <PageTitle meta="Home records · owner" title="Your home records" />
        <ActionBar label="Quick actions">
          <button className="button button-primary" type="button">Add expense</button>
        </ActionBar>
        <WorkspacePanel className="dashboard-workspace-panel">
          <PanelHeader icon="▦" title="Recent activity" />
        </WorkspacePanel>
      </>
    );

    expect(html).toContain("page-intro");
    expect(html).toContain("action-bar");
    expect(html).toContain("dashboard-workspace-panel");
    expect(html).toContain("panel-header");
  });

  it("renders filter chips and clear action without changing filter state itself", () => {
    const html = renderToStaticMarkup(
      <FilterPanel onClear={() => undefined}>
        <FilterChipGroup
          label="Activity type"
          onChange={() => undefined}
          options={[
            { value: "all", label: "All activity", count: 3 },
            { value: "document", label: "Document", count: 1 }
          ]}
          value="all"
        />
      </FilterPanel>
    );

    expect(html).toContain("Filters");
    expect(html).toContain("All activity");
    expect(html).toContain("aria-pressed=\"true\"");
    expect(html).toContain("Clear filters");
  });

  it("renders compact tables with consistent data labels and row actions", () => {
    const columns: CompactRecordColumn<{ id: string; name: string; amount: string }>[] = [
      { key: "name", header: "Record", className: "record-name-cell", render: (row) => <strong>{row.name}</strong> },
      { key: "amount", header: "Amount", align: "right", render: (row) => row.amount }
    ];

    const html = renderToStaticMarkup(
      <CompactRecordTable
        className="test-table"
        columns={columns}
        getRowKey={(row) => row.id}
        rows={[{ id: "expense-1", name: "Cedarline Carpentry", amount: "$680.00" }]}
      />
    );

    expect(html).toContain("compact-record-table");
    expect(html).toContain("data-label=\"Record\"");
    expect(html).toContain("data-label=\"Amount\"");
    expect(html).toContain("align-right");
  });

  it("renders modal and field primitives for future focused forms", () => {
    const html = renderToStaticMarkup(
      <Modal
        footer={<button className="button button-primary" type="button">Save document</button>}
        subtitle="Office · Deck repair"
        title="Add document"
      >
        <FormField helper="Optional. Uses file name if blank." label="Name">
          <input name="display_name" />
        </FormField>
      </Modal>
    );

    expect(html).toContain("role=\"dialog\"");
    expect(html).toContain("Add document");
    expect(html).toContain("Office · Deck repair");
    expect(html).toContain("Optional. Uses file name if blank.");
    expect(html).toContain("Save document");
  });

  it("renders Settings as an enabled lower-sidebar destination", () => {
    const html = renderToStaticMarkup(
      <AppShell activeView="settings" onNavigate={() => undefined}>
        <main>Settings content</main>
      </AppShell>
    );

    expect(html).toContain("Settings");
    expect(html).toContain("settings-nav-button is-active");
    expect(html).toContain("aria-current=\"page\"");
    expect(html).not.toContain("Settings will be added in a later ticket");
  });
});
