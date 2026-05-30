import React from "react";
import LoadingStatus from "./LoadingStatus.jsx";

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  isSearching,
  isSearchLoading,
  hasArchiveData,
  searchMatchCounts = {},
}) {
  if (isLoading) {
    return (
      <div className="empty-state empty-panel">
        <LoadingStatus
          label="Loading archive"
          detail="Reading conversations from local storage."
        />
      </div>
    );
  }

  if (conversations.length === 0) {
    if (isSearching && isSearchLoading) {
      return (
        <div className="empty-state empty-panel">
          <LoadingStatus
            label="Searching messages"
            detail="Checking matching conversations in your archive."
          />
        </div>
      );
    }

    const title = isSearching ? "No messages matched" : "No conversations yet";
    const detail = isSearching
      ? "Try a different name, phone number, word, or phrase."
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
      {conversations.map((conversation) => {
        const title = formatConversationTitle(conversation);
        const detail = formatConversationDetail(conversation, title);
        const matchCount = searchMatchCounts[conversation.id] || 0;

        return (
          <button
            className={`conversation-row ${conversation.id === selectedId ? "is-selected" : ""}`}
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
            type="button"
          >
            <span className="conversation-main">
              <span className="conversation-title-row">
                <strong>{title}</strong>
                <time>{formatDate(conversation.last_message_at)}</time>
              </span>
              <span className="conversation-meta-row">
                {detail && <small>{detail}</small>}
                {isSearching && matchCount > 0 ? (
                  <span className="conversation-count search-match-count">
                    {formatMatchCount(matchCount)}
                  </span>
                ) : conversation.message_count ? (
                  <span className="conversation-count">
                    {formatCount(conversation.message_count)}
                  </span>
                ) : null}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function formatConversationTitle(conversation) {
  return conversation.title || conversation.participants?.[0] || "Untitled conversation";
}

function formatConversationDetail(conversation, title) {
  const participants = conversation.participants || [];
  if (participants.length === 0) return "No participants listed";
  const participantList = participants.join(", ");
  if (normalizeText(participantList) === normalizeText(title)) {
    return participants.length > 2
      ? `${participants.length} participants`
      : "Direct conversation";
  }
  return participantList;
}

function formatCount(value) {
  return `${new Intl.NumberFormat("en").format(value)} message${value === 1 ? "" : "s"}`;
}

function formatMatchCount(value) {
  return `${new Intl.NumberFormat("en").format(value)} match${value === 1 ? "" : "es"}`;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}
