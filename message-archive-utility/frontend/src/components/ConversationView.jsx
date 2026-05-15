import React from "react";

export default function ConversationView({ conversation, isLoading }) {
  if (isLoading) {
    return (
      <section className="conversation-view">
        <p className="empty-state">Loading conversation...</p>
      </section>
    );
  }

  if (!conversation) {
    return (
      <section className="conversation-view">
        <p className="empty-state">Import messages or select a conversation to view the timeline.</p>
      </section>
    );
  }

  return (
    <section className="conversation-view" aria-label={`${conversation.title} timeline`}>
      <header className="conversation-header">
        <div>
          <p className="eyebrow">Conversation</p>
          <h2>{conversation.title}</h2>
          <p>{conversation.participants.join(", ")}</p>
        </div>
        <div className="tag-stack">
          {conversation.tags.map((tag) => (
            <span className="tag" key={tag}>{tag}</span>
          ))}
        </div>
      </header>

      <div className="timeline">
        {conversation.messages.map((message) => (
          <article className={`message ${message.direction}`} key={message.id}>
            <div className="message-meta">
              <strong>{message.sender_name}</strong>
              <time>{formatTimestamp(message.sent_at)}</time>
            </div>
            {message.body ? <p>{message.body}</p> : <p className="empty-message-body">No text body</p>}
            {message.attachments?.length > 0 && (
              <ul className="attachment-list" aria-label="Attachments">
                {message.attachments.map((attachment) => (
                  <li key={attachment.id}>
                    <span>{attachment.original_filename || attachment.mime_type || "Attachment"}</span>
                    {attachment.byte_size ? <small>{formatBytes(attachment.byte_size)}</small> : null}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function formatBytes(value) {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    notation: Number(value) >= 1_000_000 ? "compact" : "standard",
  }).format(value);
}

function formatTimestamp(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
