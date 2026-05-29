import React from "react";

export default function LoadingStatus({
  label,
  detail = "",
  className = "",
  compact = false,
}) {
  return (
    <div
      className={`loading-status ${compact ? "is-compact" : ""} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <div className="loading-status-copy">
        <strong>{label}</strong>
        {detail && <span>{detail}</span>}
      </div>
      <div
        className="linear-loading-bar"
        role="progressbar"
        aria-label={label}
        aria-valuetext="Loading"
      >
        <span />
      </div>
    </div>
  );
}
