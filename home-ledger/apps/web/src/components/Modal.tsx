import type { ReactNode } from "react";

export function Modal({
  title,
  subtitle,
  children,
  footer,
  onClose
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="form-modal" aria-modal="true" role="dialog" aria-labelledby="modal-title">
        <header className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {onClose ? <button aria-label="Close" className="icon-button" onClick={onClose} type="button">×</button> : null}
        </header>
        <div className="modal-body">
          {children}
        </div>
        {footer ? <footer className="form-actions">{footer}</footer> : null}
      </section>
    </div>
  );
}
