import { EmptyState } from "../components/EmptyState";
import type { FollowUpBucket } from "../api/types";

export function NeedsAttention({ items }: { items: FollowUpBucket[] }) {
  if (!items.length) {
    return <EmptyState title="No open items">No open items.</EmptyState>;
  }

  return (
    <div className="table-wrap compact-table-wrap">
      <table className="compact-record-table needs-attention-table">
        <thead>
          <tr>
            <th>Area</th>
            <th className="align-right">Open items</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.type}>
              <td data-label="Area"><strong>{item.label}</strong></td>
              <td className="align-right" data-label="Open items">{item.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
