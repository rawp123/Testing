import React from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export default function ConversationView({ conversation, isLoading }) {
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

function renderMessagesWithDateDividers(messages) {
  let previousDateKey = "";
  return messages.flatMap((message) => {
    const dateKey = getDateKey(message.sent_at);
    const items = [];
    if (dateKey && dateKey !== previousDateKey) {
      previousDateKey = dateKey;
      items.push(
        <div className="date-divider" key={`date-${dateKey}`}>
          <span>{formatDateDivider(message.sent_at)}</span>
        </div>,
      );
    }
    items.push(<MessageBubble message={message} key={message.id} />);
    return items;
  });
}

function MessageBubble({ message }) {
  return (
    <article className={`message ${message.direction}`}>
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
                  {[
                    attachment.mime_type,
                    attachment.byte_size ? formatBytes(attachment.byte_size) : null,
                    attachment.available ? null : "Metadata only",
                  ].filter(Boolean).join(" · ")}
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
