import { CompactRecordTable, type CompactRecordColumn } from "../components/CompactRecordTable";
import { EmptyState } from "../components/EmptyState";
import type { RecentActivityItem } from "./dashboard-model";

export function RecentActivity({ items, filtered }: { items: RecentActivityItem[]; filtered?: boolean }) {
  if (!items.length) {
    return filtered
      ? <EmptyState title="No activity for this filter">Clear the activity filter to see all recent records.</EmptyState>
      : <EmptyState title="No recent activity">New projects, expenses, and documents will appear here.</EmptyState>;
  }

  const columns: CompactRecordColumn<RecentActivityItem>[] = [
    {
      key: "type",
      header: "Type",
      render: (item) => <span className="pill">{item.typeLabel}</span>
    },
    {
      key: "record",
      header: "Record",
      className: "record-name-cell",
      render: (item) => <strong>{item.name}</strong>
    },
    {
      key: "relatedTo",
      header: "Related to",
      render: (item) => item.relatedTo || "Not linked"
    },
    {
      key: "date",
      header: "Date",
      render: (item) => item.dateLabel
    },
    {
      key: "summary",
      header: "Summary",
      render: (item) => item.summary
    },
    {
      key: "open",
      header: "Open",
      align: "right",
      render: (item) => (
        <button data-record-id={item.recordId} data-record-type={item.recordType} type="button">Open</button>
      )
    }
  ];

  return (
    <CompactRecordTable
      className="dashboard-activity-table"
      columns={columns}
      getRowKey={(item) => `${item.recordType}:${item.recordId}`}
      rows={items}
    />
  );
}
