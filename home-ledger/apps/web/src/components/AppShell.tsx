import type { ReactNode } from "react";

const PRIMARY_NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "⌂", current: true },
  { id: "properties", label: "Property", icon: "⌁" },
  { id: "projects", label: "Projects", icon: "▣" },
  { id: "expenses", label: "Expenses", icon: "▥" },
  { id: "documents", label: "Documents", icon: "◇" },
  { id: "calculators", label: "Calculators", icon: "▤" },
  { id: "exports", label: "Export & backup", icon: "↓" }
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Primary navigation">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            <img alt="" src="/app-icon.png" />
          </span>
          <div>
            <strong>Home Ledger</strong>
            <p>Home records</p>
          </div>
        </div>
        <nav className="app-tabs" aria-label="App sections">
          {PRIMARY_NAV_ITEMS.map((item) => (
            <button
              aria-current={item.current ? "page" : undefined}
              aria-disabled={item.current ? undefined : "true"}
              className={item.current ? "is-active" : ""}
              key={item.id}
              title={item.current ? item.label : `${item.label} will be added in a later ticket`}
              type="button"
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button aria-disabled="true" className="settings-nav-button" title="Settings will be added in a later ticket" type="button">
            <span aria-hidden="true">⚙</span>
            Settings
          </button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
