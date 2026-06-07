import type { ReactNode } from "react";

export function FormField({
  label,
  htmlFor,
  helper,
  children
}: {
  label: string;
  htmlFor?: string;
  helper?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="field" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
      {helper ? <small>{helper}</small> : null}
    </label>
  );
}
