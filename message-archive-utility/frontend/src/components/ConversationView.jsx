import { Download } from "lucide-react";
import React from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export default function ConversationView({ conversation, isLoading, apiBaseUrl = API_BASE_URL }) {
  if (isLoading) {
    return (
      <section className="conversation-view empty-transcript">
        <div className="empty-state empty-panel">
          <strong>Loading conversation</strong>
          <span>Opening the local message timeline.</span>
        </div>
      </section>
    );
  }

  if (!conversation) {
    return (
      <section className="conversation-view empty-transcript">
        <div className="empty-state empty-panel">
          <strong>Select a conversation</strong>
          <span>Import messages or choose a thread from the sidebar.</span>
        </div>
      </section>
    );
  }

  const messages = conversation.messages || [];
  const dateRange = formatDateRange(messages);
  const messageCount = messages.length;
  const canExportConversation = Boolean(conversation.id && messageCount > 0);

  return (
    <section className="conversation-view" aria-label={`${conversation.title} timeline`}>
      <header className="conversation-header">
        <div>
          <p className="eyebrow">Conversation</p>
          <h2>{conversation.title}</h2>
          <p>{conversation.participants.join(", ")}</p>
        </div>
        <dl className="conversation-facts">
          <div>
            <dt>Messages</dt>
            <dd>{messageCount}</dd>
          </div>
          <div>
            <dt>Date range</dt>
            <dd>{dateRange}</dd>
          </div>
        </dl>
        <a
          className={`secondary-button conversation-export-button ${canExportConversation ? "" : "is-disabled"}`}
          href={canExportConversation ? buildConversationExportUrl(apiBaseUrl, conversation.id) : undefined}
          aria-disabled={!canExportConversation}
          onClick={(event) => preventDisabledLink(event, canExportConversation)}
        >
          <Download size={16} aria-hidden="true" />
          Export this conversation
        </a>
      </header>

      <div className="timeline">
        {messages.length === 0 ? (
          <div className="empty-state empty-panel">
            <strong>No messages found</strong>
            <span>This thread exists in the archive, but no message rows were linked to it.</span>
          </div>
        ) : renderMessagesWithDateDividers(messages)}
      </div>
    </section>
  );
}

function buildConversationExportUrl(apiBaseUrl, conversationId) {
  return `${apiBaseUrl}/export/messages.csv?conversation_id=${encodeURIComponent(conversationId)}`;
}

function preventDisabledLink(event, isEnabled) {
  if (!isEnabled) event.preventDefault();
}

function renderMessagesWithDateDividers(messages) {
  let previousDateKey = "";
  let previousSender = "";
  let previousDirection = "";
  return messages.flatMap((message) => {
    const dateKey = getDateKey(message.sent_at);
    const items = [];
    if (dateKey && dateKey !== previousDateKey) {
      previousDateKey = dateKey;
      previousSender = "";
      previousDirection = "";
      items.push(
        <div className="date-divider" key={`date-${dateKey}`}>
          <span>{formatDateDivider(message.sent_at)}</span>
        </div>,
      );
    }
    const startsGroup =
      message.sender_name !== previousSender || message.direction !== previousDirection;
    previousSender = message.sender_name;
    previousDirection = message.direction;
    items.push(<MessageBubble message={message} startsGroup={startsGroup} key={message.id} />);
    return items;
  });
}

function MessageBubble({ message, startsGroup }) {
  return (
    <article className={`message ${message.direction} ${startsGroup ? "is-group-start" : ""}`}>
      <div className="message-meta">
        <strong>{message.sender_name}</strong>
        <time>{formatTime(message.sent_at)}</time>
      </div>
      {message.body ? <p>{message.body}</p> : <p className="empty-message-body">No text body</p>}
      {message.attachments?.length > 0 && (
        <ul className="attachment-list" aria-label="Attachments">
          {message.attachments.map((attachment) => (
            <li
              className={attachment.available && attachment.is_image ? "has-preview" : ""}
              key={attachment.id}
            >
              {attachment.available && attachment.is_image ? (
                <img
                  src={buildAttachmentUrl(attachment)}
                  alt={attachment.original_filename || "Message attachment"}
                  loading="lazy"
                />
              ) : null}
              <div className="attachment-details">
                <span>{attachment.original_filename || attachment.mime_type || "Attachment"}</span>
                <small>
                  {formatAttachmentMeta(attachment)}
                </small>
              </div>
              {attachment.available ? (
                <div className="attachment-actions">
                  <a href={buildAttachmentUrl(attachment)} target="_blank" rel="noreferrer">Open</a>
                  <a href={buildAttachmentUrl(attachment, true)}>Download</a>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function buildAttachmentUrl(attachment, download = false) {
  if (!attachment.url) return "";
  const separator = attachment.url.includes("?") ? "&" : "?";
  return `${API_BASE_URL}${attachment.url}${download ? `${separator}download=1` : ""}`;
}

function formatBytes(value) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    notation: Number(value) >= 1_000_000 ? "compact" : "standard",
  }).format(value);
}

function formatAttachmentMeta(attachment) {
  return [
    formatMimeType(attachment.mime_type),
    attachment.byte_size ? formatBytes(attachment.byte_size) : null,
    attachment.available ? null : "File not copied",
  ].filter(Boolean).join(" · ");
}

function formatMimeType(value) {
  if (!value) return null;
  if (value.startsWith("image/")) return "Image";
  if (value === "application/pdf") return "PDF";
  if (value.startsWith("video/")) return "Video";
  if (value.startsWith("audio/")) return "Audio";
  return value;
}

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getDateKey(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDateDivider(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateRange(messages) {
  if (!messages.length) return "No messages";
  const timestamps = messages
    .map((message) => new Date(message.sent_at).getTime())
    .filter((timestamp) => !Number.isNaN(timestamp))
    .sort((left, right) => left - right);
  if (!timestamps.length) return "Unknown";

  const first = formatShortDate(timestamps[0]);
  const last = formatShortDate(timestamps[timestamps.length - 1]);
  return first === last ? first : `${first} - ${last}`;
}

function formatShortDate(timestamp) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}
