import { ChevronDown, Download, FileText, LockKeyhole } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import LoadingStatus from "./LoadingStatus.jsx";
import { downloadFile } from "../utils/downloadFile.js";

const SCOPE_OPTIONS = [
  { id: "fullArchive", label: "Full archive", detail: "Every message in this archive." },
  { id: "dateRange", label: "Date range", detail: "Messages between two dates." },
  { id: "person", label: "Contact or person", detail: "Messages with one person." },
];

const FORMAT_OPTIONS = [
  { id: "pdf", label: "PDF" },
  { id: "excel", label: "Excel" },
  { id: "csv", label: "CSV" },
];

export default function ExportPanel({ apiBaseUrl, hasArchiveData = false }) {
  const [selectedScope, setSelectedScope] = useState("fullArchive");
  const [selectedFormat, setSelectedFormat] = useState("pdf");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [people, setPeople] = useState([]);
  const [peopleStatus, setPeopleStatus] = useState("idle");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [exportState, setExportState] = useState({ status: "idle", message: "" });

  useEffect(() => {
    let isCurrent = true;
    if (!hasArchiveData) {
      setPeople([]);
      setSelectedPersonId("");
      setPeopleStatus("idle");
      return () => {
        isCurrent = false;
      };
    }

    setPeopleStatus("loading");
    fetch(`${apiBaseUrl}/export/people`)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load contacts");
        return response.json();
      })
      .then((data) => {
        if (!isCurrent) return;
        const nextPeople = Array.isArray(data.people) ? data.people : [];
        setPeople(nextPeople);
        setPeopleStatus("ready");
        setSelectedPersonId((current) => (
          current && nextPeople.some((person) => String(person.id) === String(current)) ? current : ""
        ));
      })
      .catch(() => {
        if (!isCurrent) return;
        setPeople([]);
        setSelectedPersonId("");
        setPeopleStatus("error");
      });

    return () => {
      isCurrent = false;
    };
  }, [apiBaseUrl, hasArchiveData]);

  const hasPeople = people.length > 0;
  const canChoosePerson = hasArchiveData && hasPeople;
  const canExportPerson = selectedScope !== "person" || (canChoosePerson && selectedPersonId);
  const canExportDateRange = selectedScope !== "dateRange" || Boolean(startDate || endDate);
  const canDownload = hasArchiveData && canExportPerson && canExportDateRange;

  const scopeOptions = useMemo(() => {
    return SCOPE_OPTIONS.map((option) => {
      if (option.id === "fullArchive") {
        return { ...option, enabled: hasArchiveData, status: hasArchiveData ? "Available" : "Import first" };
      }
      if (option.id === "dateRange") {
        return {
          ...option,
          enabled: hasArchiveData,
          status: !hasArchiveData ? "Import first" : startDate || endDate ? "Available" : "Choose dates",
        };
      }
      return {
        ...option,
        enabled: canChoosePerson,
        status: getPersonStatus({ canChoosePerson, hasArchiveData, peopleStatus, selectedPersonId }),
      };
    });
  }, [canChoosePerson, hasArchiveData, peopleStatus, selectedPersonId, startDate, endDate]);

  const selectedScopeOption = scopeOptions.find((option) => option.id === selectedScope) || scopeOptions[0];
  const selectedFormatOption = FORMAT_OPTIONS.find((option) => option.id === selectedFormat) || FORMAT_OPTIONS[0];
  const exportUrl = canDownload
    ? buildExportUrl({
        apiBaseUrl,
        scope: selectedScope,
        format: selectedFormat,
        personId: selectedPersonId,
        startDate,
        endDate,
      })
    : "";
  const actionText = canDownload
    ? getDownloadLabel(selectedScope, selectedFormatOption.label)
    : getDisabledActionText(selectedScopeOption);
  const isExporting = exportState.status === "loading";

  useEffect(() => {
    setExportState({ status: "idle", message: "" });
  }, [exportUrl]);

  async function handleDownload() {
    if (!canDownload || isExporting) return;
    setExportState({ status: "loading", message: "" });
    try {
      const filename = await downloadFile(exportUrl);
      setExportState({ status: "done", message: `Saved ${filename}.` });
    } catch {
      setExportState({ status: "error", message: "Archive export could not be created. Try again." });
    }
  }

  return (
    <details className="archive-export-panel">
      <summary>
        <span className="archive-export-summary-main">
          <span className="export-icon">
            <FileText size={16} aria-hidden="true" />
          </span>
          <span>
            <strong>Archive exports</strong>
            <small>Full archive, dates, or one person</small>
          </span>
        </span>
        <ChevronDown size={17} aria-hidden="true" />
      </summary>

      <section className="archive-export-body" aria-label="Archive exports">
        <p className="archive-export-help">
          These create archive-wide files. Use the selected thread header for one conversation.
        </p>

      <fieldset className="export-choice-group">
        <legend>What to export</legend>
        <div className="export-option-list">
          {scopeOptions.map((option) => (
            <button
              className={`export-option ${selectedScope === option.id ? "is-selected" : ""}`}
              disabled={!option.enabled && option.id !== "dateRange"}
              key={option.id}
              onClick={() => setSelectedScope(option.id)}
              type="button"
            >
              <span>
                <strong>{option.label}</strong>
                <small>{option.detail}</small>
              </span>
              <em>{option.status}</em>
            </button>
          ))}
        </div>
      </fieldset>

      {selectedScope === "person" && (
        <label className="export-inline-field">
          <span>Contact</span>
          <select
            value={selectedPersonId}
            onChange={(event) => setSelectedPersonId(event.target.value)}
            disabled={!canChoosePerson}
          >
            <option value="">{getPersonPlaceholder({ hasArchiveData, peopleStatus, hasPeople })}</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>{formatPersonOption(person)}</option>
            ))}
          </select>
        </label>
      )}

      {selectedScope === "dateRange" && (
        <div className="export-date-range" aria-label="Date range export">
          <label>
            <span>Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label>
            <span>End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
        </div>
      )}

      <div className="export-actions">
        <label className="export-format-picker">
          <span>Format</span>
          <select value={selectedFormat} onChange={(event) => setSelectedFormat(event.target.value)}>
            {FORMAT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>

        {canDownload ? (
          <button className="primary-button" type="button" onClick={handleDownload} disabled={isExporting}>
            <Download size={16} aria-hidden="true" />
            {isExporting ? "Preparing export" : actionText}
          </button>
        ) : (
          <button className="primary-button is-disabled" type="button" disabled>
            <Download size={16} aria-hidden="true" />
            {actionText}
          </button>
        )}
      </div>

      {peopleStatus === "loading" && (
        <LoadingStatus
          compact
          label="Loading contacts"
          detail="Preparing contact export choices."
          className="export-loading-status"
        />
      )}
      {isExporting && (
        <LoadingStatus
          label="Preparing archive export"
          detail="Creating the selected export file."
          className="export-loading-status"
        />
      )}
      {exportState.status === "error" && <p className="inline-error-state">{exportState.message}</p>}
      {exportState.status === "done" && <p className="inline-success-state">{exportState.message}</p>}

      <div className="export-note" role={hasArchiveData ? undefined : "status"}>
        <LockKeyhole size={14} aria-hidden="true" />
        <span>
          {hasArchiveData
            ? getExportNoteText({ peopleStatus, hasPeople })
          : "Import an archive before exporting messages."}
        </span>
      </div>
      </section>
    </details>
  );
}

function buildExportUrl({
  apiBaseUrl,
  scope,
  format,
  personId = "",
  startDate = "",
  endDate = "",
}) {
  const params = new URLSearchParams();
  const extension = format === "excel" ? "xlsx" : format;
  if (scope === "person" && personId) {
    params.set("contact_id", personId);
  }
  if (scope === "dateRange") {
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
  }
  if (format === "pdf") {
    params.set("style", "conversation");
  }
  const query = params.toString();
  return `${apiBaseUrl}/export/messages.${extension}${query ? `?${query}` : ""}`;
}

function getDownloadLabel(scope, formatLabel) {
  if (scope === "dateRange") return `Download date range ${formatLabel}`;
  if (scope === "person") return `Download contact ${formatLabel}`;
  return `Download archive ${formatLabel}`;
}

function getDisabledActionText(scopeOption) {
  if (!scopeOption.enabled && scopeOption.status !== "Available") return scopeOption.status;
  return "Choose export";
}

function getPersonStatus({ canChoosePerson, hasArchiveData, peopleStatus, selectedPersonId }) {
  if (!hasArchiveData) return "Import first";
  if (peopleStatus === "loading") return "Loading contacts";
  if (peopleStatus === "error") return "Could not load contacts";
  if (!canChoosePerson) return "No contacts found";
  if (!selectedPersonId) return "Choose a person";
  return "Available";
}

function getPersonPlaceholder({ hasArchiveData, peopleStatus, hasPeople }) {
  if (!hasArchiveData) return "Import messages first.";
  if (peopleStatus === "loading") return "Loading contacts";
  if (peopleStatus === "error") return "Could not load contacts";
  if (!hasPeople) return "No contacts found yet.";
  return "Choose a person";
}

function getExportNoteText({ peopleStatus, hasPeople }) {
  if (peopleStatus === "error") return "Exports are prepared on this computer. Contacts could not be loaded right now.";
  if (!hasPeople) return "Exports are prepared on this computer. No contacts found yet.";
  return "Exports are prepared on this computer.";
}

function formatPersonOption(person) {
  const detail = person.detail ? ` - ${person.detail}` : "";
  const description = person.description ? `, ${person.description}` : "";
  return `${person.name}${detail}${description}`;
}
