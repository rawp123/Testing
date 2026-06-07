import type { ReactNode } from "react";

export interface CompactRecordColumn<Row> {
  key: string;
  header: string;
  align?: "left" | "right";
  className?: string;
  render: (row: Row) => ReactNode;
}

export function CompactRecordTable<Row>({
  columns,
  rows,
  getRowKey,
  className = ""
}: {
  columns: CompactRecordColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  className?: string;
}) {
  return (
    <div className="table-wrap compact-table-wrap">
      <table className={["compact-record-table", className].filter(Boolean).join(" ")}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={column.align === "right" ? "align-right" : undefined} key={column.key}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td
                  className={[
                    column.align === "right" ? "align-right" : "",
                    column.className || ""
                  ].filter(Boolean).join(" ") || undefined}
                  data-label={column.header}
                  key={column.key}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
