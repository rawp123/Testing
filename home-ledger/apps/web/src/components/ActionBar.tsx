import type { ReactNode } from "react";

export function ActionBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="action-bar" aria-label={label}>
      {children}
    </div>
  );
}
