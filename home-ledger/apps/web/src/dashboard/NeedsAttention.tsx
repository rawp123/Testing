import { CompactRecordTable, type CompactRecordColumn } from "../components/CompactRecordTable";
import { EmptyState } from "../components/EmptyState";
import type { FollowUpRow } from "./dashboard-model";

export function NeedsAttention({ items }: { items: FollowUpRow[] }) {
  if (!items.length) {
    return <EmptyState title="No open items">No open items.</EmptyState>;
  }

  const columns: CompactRecordColumn<FollowUpRow>[] = [
    {
      key: "area",
      header: "Area",
      render: (item) => <span className="pill">{item.area}</span>
    },
    {
      key: "title",
      header: "What needs attention",
      className: "record-name-cell",
      render: (item) => <strong>{item.title}</strong>
    },
    {
      key: "details",
      header: "Details",
      render: (item) => item.description || item.severity
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      render: (item) => (
        <button data-follow-up-id={item.id} data-target-type={item.targetType} type="button">{item.actionLabel}</button>
      )
    }
  ];

  return (
    <CompactRecordTable
      className="needs-attention-table"
      columns={columns}
      getRowKey={(item) => item.id}
      rows={items}
    />
  );
}
