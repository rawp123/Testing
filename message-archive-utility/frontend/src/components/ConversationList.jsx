import React from "react";

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  isSearching,
  hasArchiveData,
}) {
  if (isLoading) {
    return (
      <div className="empty-state empty-panel">
        <strong>Loading archive</strong>
        <span>Reading conversations from local storage.</span>
      </div>
    );
  }

  if (conversations.length === 0) {
    const title = isSearching ? "No search results" : "No conversations yet";
    const detail = isSearching
      ? "Try a different word, handle, or phrase."
      : hasArchiveData
        ? "No conversations match the current view."
        : "Import an iPhone backup to browse your message archive.";
    return (
      <div className="empty-state empty-panel">
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    );
  }

  return (
    <div className="conversation-list">
      {conversations.map((conversation) => (
        <button
          className={`conversation-row ${conversation.id === selectedId ? "is-selected" : ""}`}
          key={conversation.id}
          onClick={() => onSelect(conversation.id)}
          type="button"
        >
          <span className="conversation-main">
            <span className="conversation-title-row">
              <strong>{formatConversationTitle(conversation)}</strong>
              <time>{formatDate(conversation.last_message_at)}</time>
            </span>
            <small>{formatConversationDetail(conversation)}</small>
            {conversation.message_count ? (
              <span className="conversation-count">
                {conversation.message_count} message{conversation.message_count === 1 ? "" : "s"}
              </span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}

function formatConversationTitle(conversation) {
  return conversation.title || conversation.participants?.[0] || "Untitled conversation";
}

function formatConversationDetail(conversation) {
  const participants = conversation.participants || [];
  if (participants.length === 0) return "No participants listed";
  return participants.join(", ");
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
