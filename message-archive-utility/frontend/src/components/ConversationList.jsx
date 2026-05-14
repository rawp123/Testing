export default function ConversationList({ conversations, selectedId, onSelect }) {
  if (conversations.length === 0) {
    return <p className="empty-state">No fake sample conversations match this search.</p>;
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
          <span>
            <strong>{conversation.title}</strong>
            <small>{conversation.participants.join(", ")}</small>
          </span>
          <time>{formatDate(conversation.last_message_at)}</time>
        </button>
      ))}
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
