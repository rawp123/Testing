import { Download, FileDown } from "lucide-react";
import React from "react";

export default function ExportPanel({
  apiBaseUrl,
  conversation,
  hasArchiveData = false,
}) {
  const conversationMessageCount = conversation?.messages?.length || 0;
  const canExportConversation = Boolean(conversation?.id && conversationMessageCount > 0);

  return (
    <section className="export-panel" aria-label="Export messages">
      <div className="export-copy">
        <span className="export-icon">
          <FileDown size={18} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">Export</p>
          <h2>Save a clean CSV</h2>
          <p>Export the archive or the selected thread without changing local data.</p>
        </div>
      </div>
      <div className="export-actions">
        <a
          className={`secondary-button ${hasArchiveData ? "" : "is-disabled"}`}
          href={hasArchiveData ? buildExportUrl(apiBaseUrl) : undefined}
          aria-disabled={!hasArchiveData}
          onClick={(event) => preventDisabledLink(event, hasArchiveData)}
        >
          <Download size={16} aria-hidden="true" />
          All messages
        </a>
        <a
          className={`secondary-button ${canExportConversation ? "" : "is-disabled"}`}
          href={canExportConversation ? buildExportUrl(apiBaseUrl, conversation.id) : undefined}
          aria-disabled={!canExportConversation}
          onClick={(event) => preventDisabledLink(event, canExportConversation)}
        >
          <Download size={16} aria-hidden="true" />
          This thread
        </a>
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
