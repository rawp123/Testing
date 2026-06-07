import type { ReactNode } from "react";

export function WorkspacePanel({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={["panel", className].filter(Boolean).join(" ")}>
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  icon,
  actions
}: {
  title: string;
  icon?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="panel-header">
      {icon ? <span className="panel-icon" aria-hidden="true">{icon}</span> : null}
      <h2>{title}</h2>
      {actions ? <div className="panel-actions">{actions}</div> : null}
    </div>
  );
}
