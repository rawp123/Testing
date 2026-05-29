import React from "react";

const numberFormatter = new Intl.NumberFormat();

export default function ArchiveStatsPanel({ stats, isLoading }) {
  const messages = stats?.messages || {};
  const conversations = stats?.conversations || {};
  const contacts = stats?.contacts || {};
  const attachments = stats?.attachments || {};

  const items = [
    { label: "Messages", value: formatNumber(messages.total) },
    { label: "Conversations", value: formatNumber(conversations.total) },
    { label: "Contacts", value: formatNumber(contacts.total) },
    { label: "Attachments", value: formatNumber(attachments.total) },
    { label: "Messages with attachments", value: formatNumber(attachments.linked_messages) },
    {
      label: "Messages without text",
      value: formatNumber(messages.blank),
      detail: formatPercent(messages.blank_percent),
    },
    { label: "Latest message", value: formatDate(messages.latest_sent_at) },
  ];

  return (
    <section className="stats-panel stats-strip" aria-label="Archive details">
      <header className="panel-header">
        <div>
          <p className="eyebrow">Local archive</p>
          <h2>At a glance</h2>
        </div>
        {isLoading && <span className="stats-status">Updating</span>}
      </header>
      <dl className="stats-grid">
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
            {item.detail && <small>{item.detail}</small>}
          </div>
        ))}
      </dl>
    </section>
  );
}

function formatNumber(value) {
  if (value === undefined || value === null) return "0";
  return numberFormatter.format(value);
}

function formatPercent(value) {
  if (value === undefined || value === null) return "0%";
  return `${value}%`;
}

function formatDate(value) {
  if (!value) return "No messages";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
