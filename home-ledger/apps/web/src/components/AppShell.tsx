import type { ReactNode } from "react";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "⌂", current: true },
  { id: "properties", label: "Properties", icon: "⌁" },
  { id: "projects", label: "Projects", icon: "▣" },
  { id: "expenses", label: "Expenses", icon: "▥" },
  { id: "documents", label: "Documents", icon: "◇" },
  { id: "exports", label: "Exports", icon: "↓" },
  { id: "settings", label: "Settings", icon: "⚙" }
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Primary navigation">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">▣</span>
          <strong>Home Ledger</strong>
        </div>
        <nav className="app-tabs">
          {NAV_ITEMS.map((item) => (
            <a
              aria-current={item.current ? "page" : undefined}
              aria-disabled={item.current ? undefined : "true"}
              className={item.current ? "is-active" : ""}
              href={`#${item.id}`}
              key={item.id}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
