import { Download, FileText, LockKeyhole } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

const SCOPE_OPTIONS = [
  { id: "fullArchive", label: "Full archive", detail: "All messages in this archive." },
  { id: "selectedConversation", label: "Selected conversation", detail: "Only the open thread." },
  { id: "searchResults", label: "Search results", detail: "Messages matching the current search." },
  { id: "dateRange", label: "Date range", detail: "Choose a start and end date." },
  { id: "person", label: "Contact or person", detail: "Messages with one person." },
  { id: "summaryOnly", label: "Summary report only", detail: "Counts without message rows." },
];

const FORMAT_OPTIONS = [
  { id: "pdf", label: "PDF", detail: "Printable reports and transcripts." },
  { id: "excel", label: "Excel", detail: "Full analysis workbook." },
  { id: "csv", label: "CSV", detail: "Spreadsheet-ready message rows." },
];

const PDF_STYLE_OPTIONS = [
  { id: "conversation", label: "Easy-to-read conversation view" },
  { id: "transcript", label: "Formal transcript" },
  { id: "summary", label: "Summary report with messages" },
];

const EXCEL_WORKBOOK_OPTIONS = [
  "Full analysis workbook",
];

export default function ExportPanel({
  apiBaseUrl,
  conversation,
  hasArchiveData = false,
  searchQuery = "",
  searchResultCount = 0,
}) {
  const [selectedScope, setSelectedScope] = useState("fullArchive");
  const [selectedFormat, setSelectedFormat] = useState("csv");
  const [selectedPdfStyle, setSelectedPdfStyle] = useState(PDF_STYLE_OPTIONS[0].id);
  const [selectedWorkbookType, setSelectedWorkbookType] = useState(EXCEL_WORKBOOK_OPTIONS[0]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [people, setPeople] = useState([]);
  const [peopleStatus, setPeopleStatus] = useState("idle");
  const [selectedPersonId, setSelectedPersonId] = useState("");

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
        if (!response.ok) throw new Error("Could not load people");
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

  const normalizedSearchQuery = searchQuery.trim();
  const conversationMessageCount = conversation?.messages?.length || 0;
  const canExportConversation = Boolean(conversation?.id && conversationMessageCount > 0);
  const canExportSearchResults = normalizedSearchQuery.length > 0;
  const canExportDateRange = ["pdf", "excel"].includes(selectedFormat) && Boolean(startDate || endDate);
  const canExportSummaryOnly = ["pdf", "excel"].includes(selectedFormat) && canExportSearchResults;
  const hasPeople = people.length > 0;
  const canChoosePerson = hasArchiveData && hasPeople;
  const canExportPerson = canChoosePerson && selectedPersonId;

  const scopeOptions = useMemo(() => {
    return SCOPE_OPTIONS.map((option) => {
      if (option.id === "fullArchive") {
        return { ...option, enabled: hasArchiveData, status: hasArchiveData ? getReadyStatus(selectedFormat) : "Import messages first" };
      }
      if (option.id === "selectedConversation") {
        return {
          ...option,
          enabled: canExportConversation,
          status: canExportConversation ? getReadyStatus(selectedFormat) : "Choose a conversation",
        };
      }
      if (option.id === "searchResults") {
        return {
          ...option,
          enabled: canExportSearchResults,
          status: canExportSearchResults
            ? `${getReadyStatus(selectedFormat)} - ${formatNumber(searchResultCount)} matching ${searchResultCount === 1 ? "message" : "messages"}`
            : "Search first",
        };
      }
      if (option.id === "dateRange") {
        return {
          ...option,
          enabled: canExportDateRange,
          status: ["pdf", "excel"].includes(selectedFormat)
            ? (canExportDateRange ? getReadyStatus(selectedFormat) : "Choose dates")
            : "PDF or Excel only",
        };
      }
      if (option.id === "summaryOnly") {
        return {
          ...option,
          enabled: canExportSummaryOnly,
          status: ["pdf", "excel"].includes(selectedFormat)
            ? (canExportSummaryOnly ? getReadyStatus(selectedFormat) : "Search first")
            : "PDF or Excel only",
        };
      }
      if (option.id === "person") {
        return {
          ...option,
          enabled: canChoosePerson,
          status: getPersonStatus({
            canChoosePerson,
            hasArchiveData,
            peopleStatus,
            selectedFormat,
            selectedPersonId,
          }),
        };
      }
      return { ...option, enabled: false, status: "Planned" };
    });
  }, [
    canExportConversation,
    canExportDateRange,
    canChoosePerson,
    canExportSearchResults,
    canExportSummaryOnly,
    hasArchiveData,
    peopleStatus,
    searchResultCount,
    selectedFormat,
    selectedPersonId,
  ]);

  const selectedScopeOption = scopeOptions.find((option) => option.id === selectedScope) || scopeOptions[0];
  const selectedFormatOption = FORMAT_OPTIONS.find((option) => option.id === selectedFormat) || FORMAT_OPTIONS[2];
  const canDownload = selectedScopeOption.enabled && (selectedScope !== "person" || canExportPerson);
  const exportUrl = canDownload
    ? buildExportUrl({
        apiBaseUrl,
        scope: selectedScope,
        format: selectedFormat,
        conversationId: conversation?.id,
        personId: selectedPersonId,
        searchQuery: normalizedSearchQuery,
        startDate,
        endDate,
        pdfStyle: selectedPdfStyle,
      })
    : "";
  const actionText = canDownload
    ? getDownloadLabel(selectedScope)
    : selectedScope === "person"
      ? getPersonStatus({
          canChoosePerson,
          hasArchiveData,
          peopleStatus,
          selectedFormat,
          selectedPersonId,
        })
      : getPlannedActionText(selectedFormatOption, selectedScopeOption);

  return (
    <section className="export-panel" aria-label="Export Center">
      <div className="export-copy">
        <span className="export-icon">
          <FileText size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">Export Center</p>
          <h2>Export to PDF, Excel, or CSV</h2>
          <p>
            Choose what you need, then pick the format. PDF, Excel, and CSV downloads are ready for supported choices.
          </p>
        </div>
      </div>

      <div className="export-quick-actions" aria-label="Quick exports">
        <a
          className={`primary-button ${hasArchiveData ? "" : "is-disabled"}`}
          href={hasArchiveData ? buildExportUrl({ apiBaseUrl, scope: "fullArchive", format: "csv" }) : undefined}
          aria-disabled={!hasArchiveData}
          onClick={(event) => preventDisabledLink(event, hasArchiveData)}
        >
          <Download size={16} aria-hidden="true" />
          Export full archive
        </a>
        <a
          className={`secondary-button ${canExportConversation ? "" : "is-disabled"}`}
          href={canExportConversation
            ? buildExportUrl({
                apiBaseUrl,
                scope: "selectedConversation",
                format: "csv",
                conversationId: conversation.id,
              })
            : undefined}
          aria-disabled={!canExportConversation}
          onClick={(event) => preventDisabledLink(event, canExportConversation)}
        >
          <Download size={16} aria-hidden="true" />
          Export this conversation
        </a>
      </div>

      <div className="export-choice-grid">
        <fieldset className="export-choice-group">
          <legend>What to export</legend>
          <div className="export-option-list">
            {scopeOptions.map((option) => (
              <button
                className={`export-option ${selectedScope === option.id ? "is-selected" : ""}`}
                disabled={!option.enabled}
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

        <fieldset className="export-choice-group">
          <legend>Format</legend>
          <div className="export-format-list">
            {FORMAT_OPTIONS.map((option) => (
              <button
                className={`export-format-option ${selectedFormat === option.id ? "is-selected" : ""}`}
                disabled={option.planned}
                key={option.id}
                onClick={() => setSelectedFormat(option.id)}
                type="button"
              >
                <strong>{option.label}</strong>
                <span>{option.planned ? "Planned" : "Ready"}</span>
                <small>{option.detail}</small>
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="export-planned-settings" aria-label="Export options">
        <label>
          <span>PDF style</span>
          <select
            value={selectedPdfStyle}
            onChange={(event) => setSelectedPdfStyle(event.target.value)}
            disabled={selectedFormat !== "pdf"}
          >
            {PDF_STYLE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Excel workbook type</span>
          <select
            value={selectedWorkbookType}
            onChange={(event) => setSelectedWorkbookType(event.target.value)}
            disabled={selectedFormat !== "excel"}
          >
            {EXCEL_WORKBOOK_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Choose a person</span>
          <select
            value={selectedPersonId}
            onChange={(event) => setSelectedPersonId(event.target.value)}
            disabled={!canChoosePerson}
          >
            <option value="">{getPersonPlaceholder({ hasArchiveData, peopleStatus, hasPeople })}</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {formatPersonOption(person)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="export-date-range" aria-label="Date range export">
        <label>
          <span>Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            disabled={!["pdf", "excel"].includes(selectedFormat)}
          />
        </label>
        <label>
          <span>End date</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            disabled={!["pdf", "excel"].includes(selectedFormat)}
          />
        </label>
      </div>

      <div className="export-actions">
        {canDownload ? (
          <a className="primary-button" href={exportUrl}>
            <Download size={16} aria-hidden="true" />
            {actionText}
          </a>
        ) : (
          <button className="primary-button is-disabled" type="button" disabled>
            <Download size={16} aria-hidden="true" />
            {actionText}
          </button>
        )}
      </div>

      <div className="export-note" role={hasArchiveData ? undefined : "status"}>
        <LockKeyhole size={14} aria-hidden="true" />
        <span>
          {hasArchiveData
            ? getExportNoteText({ peopleStatus, hasPeople })
            : "Import an archive before exporting messages."}
        </span>
      </div>
    </section>
  );
}

function buildExportUrl({
  apiBaseUrl,
  scope,
  format,
  conversationId = null,
  personId = "",
  searchQuery = "",
  startDate = "",
  endDate = "",
  pdfStyle = "conversation",
}) {
  const params = new URLSearchParams();
  const extension = format === "pdf" ? "pdf" : format === "excel" ? "xlsx" : "csv";
  if (scope === "selectedConversation" && conversationId) {
    params.set("conversation_id", conversationId);
  }
  if (scope === "person" && personId) {
    params.set("contact_id", personId);
  }
  if (scope === "searchResults" && searchQuery) {
    params.set("q", searchQuery);
  }
  if (scope === "summaryOnly" && searchQuery) {
    params.set("q", searchQuery);
  }
  if (scope === "dateRange") {
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
  }
  if (format === "pdf" && scope !== "summaryOnly") {
    params.set("style", pdfStyle);
  }
  const query = params.toString();
  const summaryExtension = format === "excel" ? "xlsx" : "pdf";
  const path = scope === "summaryOnly" ? `search-summary.${summaryExtension}` : `messages.${extension}`;
  return `${apiBaseUrl}/export/${path}${query ? `?${query}` : ""}`;
}

function getDownloadLabel(scope) {
  if (scope === "selectedConversation") return "Download conversation";
  if (scope === "searchResults") return "Download search results";
  if (scope === "dateRange") return "Download date range";
  if (scope === "person") return "Export messages with this person";
  if (scope === "summaryOnly") return "Download summary report";
  return "Download full archive";
}

function getPlannedActionText(formatOption, scopeOption) {
  if (!scopeOption.enabled && scopeOption.status !== "Planned") return scopeOption.status;
  if (!scopeOption.enabled) return `${scopeOption.label} export is planned`;
  return `${formatOption.label} export is planned`;
}

function preventDisabledLink(event, isEnabled) {
  if (!isEnabled) event.preventDefault();
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function getReadyStatus(format) {
  if (format === "pdf") return "Ready for PDF";
  if (format === "excel") return "Ready for Excel";
  return "Ready for CSV";
}

function getPersonStatus({ canChoosePerson, hasArchiveData, peopleStatus, selectedFormat, selectedPersonId }) {
  if (!hasArchiveData) return "Import messages first";
  if (peopleStatus === "loading") return "Loading people";
  if (peopleStatus === "error") return "Could not load people";
  if (!canChoosePerson) return "No people found";
  if (!selectedPersonId) return "Choose a person";
  return getReadyStatus(selectedFormat);
}

function getPersonPlaceholder({ hasArchiveData, peopleStatus, hasPeople }) {
  if (!hasArchiveData) return "No people found yet. Import messages first.";
  if (peopleStatus === "loading") return "Loading people";
  if (peopleStatus === "error") return "Could not load people";
  if (!hasPeople) return "No people found yet. Import messages first.";
  return "Choose a person";
}

function getExportNoteText({ peopleStatus, hasPeople }) {
  if (peopleStatus === "error") return "Exports are prepared on this computer. People could not be loaded right now.";
  if (!hasPeople) return "Exports are prepared on this computer. No people found yet. Import messages first.";
  return "Exports are prepared on this computer.";
}

function formatPersonOption(person) {
  const detail = person.detail ? ` - ${person.detail}` : "";
  const description = person.description ? `, ${person.description}` : "";
  return `${person.name}${detail}${description}`;
}
