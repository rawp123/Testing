import type { ReactNode } from "react";

export type AppView = "dashboard" | "properties" | "projects" | "expenses";

const PRIMARY_NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "⌂", enabled: true },
  { id: "properties", label: "Property", icon: "⌁", enabled: true },
  { id: "projects", label: "Projects", icon: "▣", enabled: true },
  { id: "expenses", label: "Expenses", icon: "▥", enabled: true },
  { id: "documents", label: "Documents", icon: "◇", enabled: false },
  { id: "calculators", label: "Calculators", icon: "▤", enabled: false },
  { id: "exports", label: "Export & backup", icon: "↓", enabled: false }
] as const;

export function AppShell({
  activeView = "dashboard",
  children,
  onNavigate
}: {
  activeView?: AppView;
  children: ReactNode;
  onNavigate?: (view: AppView) => void;
}) {
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
              aria-current={activeView === item.id ? "page" : undefined}
              aria-disabled={item.enabled ? undefined : "true"}
              className={activeView === item.id ? "is-active" : ""}
              key={item.id}
              onClick={() => {
                if (item.enabled) onNavigate?.(item.id as AppView);
              }}
              title={item.enabled ? item.label : `${item.label} will be added in a later ticket`}
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
