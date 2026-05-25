import { Download, FileText, LockKeyhole } from "lucide-react";
import React from "react";

export default function ExportPanel({
  apiBaseUrl,
  conversation,
  hasArchiveData = false,
}) {
  const conversationMessageCount = conversation?.messages?.length || 0;
  const canExportConversation = Boolean(conversation?.id && conversationMessageCount > 0);
  const selectedConversationLabel = canExportConversation
    ? "Selected conversation"
    : "Choose a conversation with messages";

  return (
    <section className="export-panel" aria-label="Export Center">
      <div className="export-copy">
        <span className="export-icon">
          <FileText size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">Export Center</p>
          <h2>Export messages</h2>
          <p>
            Create a CSV file from your local archive. Exports are generated on this device and do not change your messages.
          </p>
        </div>
      </div>

      <div className="export-summary" aria-label="Export details">
        <div>
          <span>Format</span>
          <strong>CSV file</strong>
        </div>
        <div>
          <span>Privacy</span>
          <strong>Generated locally</strong>
        </div>
        <div>
          <span>Available</span>
          <strong>{hasArchiveData ? "Full archive" : "No archive loaded"}</strong>
        </div>
      </div>

      <div className="export-actions">
        <a
          className={`primary-button ${hasArchiveData ? "" : "is-disabled"}`}
          href={hasArchiveData ? buildExportUrl(apiBaseUrl) : undefined}
          aria-disabled={!hasArchiveData}
          onClick={(event) => preventDisabledLink(event, hasArchiveData)}
        >
          <Download size={16} aria-hidden="true" />
          Export full archive
        </a>
        <a
          className={`secondary-button ${canExportConversation ? "" : "is-disabled"}`}
          href={canExportConversation ? buildExportUrl(apiBaseUrl, conversation.id) : undefined}
          aria-disabled={!canExportConversation}
          onClick={(event) => preventDisabledLink(event, canExportConversation)}
        >
          <Download size={16} aria-hidden="true" />
          Export selected conversation
        </a>
      </div>

      <div className="export-note" role={hasArchiveData ? undefined : "status"}>
        <LockKeyhole size={14} aria-hidden="true" />
        <span>
          {hasArchiveData
            ? `${selectedConversationLabel} can be exported separately when it has messages.`
            : "Import an archive before exporting messages."}
        </span>
      </div>
    </section>
  );
}

function buildExportUrl(apiBaseUrl, conversationId = null) {
  const query = conversationId ? `?conversation_id=${encodeURIComponent(conversationId)}` : "";
  return `${apiBaseUrl}/export/messages.csv${query}`;
}

function preventDisabledLink(event, isEnabled) {
  if (!isEnabled) {
    event.preventDefault();
  }
}
