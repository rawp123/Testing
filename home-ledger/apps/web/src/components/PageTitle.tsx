import type { ReactNode } from "react";

export function PageTitle({ title, meta, actions }: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-intro">
      <div>
        <h1>{title}</h1>
        {meta ? <p>{meta}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
