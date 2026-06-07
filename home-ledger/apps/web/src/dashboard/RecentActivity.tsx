import { EmptyState } from "../components/EmptyState";
import type { RecentActivityItem } from "./dashboard-model";

export function RecentActivity({ items }: { items: RecentActivityItem[] }) {
  if (!items.length) {
    return <EmptyState title="No recent activity">New projects, expenses, and documents will appear here.</EmptyState>;
  }

  return (
    <div className="table-wrap compact-table-wrap">
      <table className="compact-record-table dashboard-activity-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Record</th>
            <th>Related to</th>
            <th>Date</th>
            <th>Summary</th>
            <th className="align-right">Open</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.recordType}:${item.recordId}`}>
              <td data-label="Type"><span className="pill">{item.typeLabel}</span></td>
              <td className="record-name-cell" data-label="Record"><strong>{item.name}</strong></td>
              <td data-label="Related to">{item.relatedTo || "Not linked"}</td>
              <td data-label="Date">{item.dateLabel}</td>
              <td data-label="Summary">{item.summary}</td>
              <td className="align-right" data-label="Open">
                <button data-record-id={item.recordId} data-record-type={item.recordType} type="button">Open</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
