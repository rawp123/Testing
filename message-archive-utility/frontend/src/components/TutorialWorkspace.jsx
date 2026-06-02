import {
  Archive,
  BarChart3,
  Database,
  Download,
  FileText,
  Filter,
  LockKeyhole,
  RotateCcw,
  Search,
  Upload,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { TUTORIAL_ARCHIVE } from "../tutorial/sampleArchive.js";

const MESSAGE_FILTERS = [
  { id: "all", label: "All messages" },
  { id: "incoming", label: "Incoming" },
  { id: "outgoing", label: "Outgoing" },
  { id: "attachments", label: "With attachments" },
];

const EXPORT_SCOPES = [
  { id: "fullArchive", label: "Full archive" },
  { id: "conversation", label: "Selected conversation" },
  { id: "searchResults", label: "Search results" },
];

const EXPORT_FORMATS = [
  { id: "csv", label: "CSV" },
  { id: "pdf", label: "PDF walkthrough" },
  { id: "excel", label: "Excel walkthrough" },
];

export default function TutorialWorkspace({
  hasArchiveData = false,
  onExitTutorial,
  onStartRealImport,
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [query, setQuery] = useState("");
  const [messageFilter, setMessageFilter] = useState("all");
  const [exportScope, setExportScope] = useState("fullArchive");
  const [exportFormat, setExportFormat] = useState("csv");
  const [exportStatus, setExportStatus] = useState({ status: "idle", message: "" });

  const conversations = isLoaded ? TUTORIAL_ARCHIVE.conversations : [];
  const allMessages = useMemo(() => flattenMessages(conversations), [conversations]);
  const normalizedQuery = normalizeSearchText(query);
  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];
    return allMessages
      .filter((message) => messageMatchesSearch(message, normalizedQuery))
      .sort((left, right) => getTimestamp(right.sent_at) - getTimestamp(left.sent_at));
  }, [allMessages, normalizedQuery]);
  const searchSummary = useMemo(() => buildSearchSummary(searchResults), [searchResults]);
  const conversationSummaries = useMemo(() => {
    const matchingIds = new Set(searchResults.map((message) => message.conversation_id));
    return conversations
      .filter((conversation) => !normalizedQuery || matchingIds.has(conversation.id))
      .map(buildConversationSummary)
      .sort((left, right) => getTimestamp(right.last_message_at) - getTimestamp(left.last_message_at));
  }, [conversations, normalizedQuery, searchResults]);

  useEffect(() => {
    if (!isLoaded) return;
    if (conversationSummaries.length === 0) {
      setSelectedConversationId("");
      return;
    }
    if (!conversationSummaries.some((conversation) => conversation.id === selectedConversationId)) {
      setSelectedConversationId(conversationSummaries[0].id);
    }
  }, [conversationSummaries, isLoaded, selectedConversationId]);

  useEffect(() => {
    setExportStatus({ status: "idle", message: "" });
  }, [exportScope, exportFormat, query, selectedConversationId]);

  const selectedConversation = conversations.find((conversation) => conversation.id === selectedConversationId) || null;
  const displayedMessages = useMemo(() => {
    if (!selectedConversation) return [];
    return selectedConversation.messages
      .map((message) => decorateMessage(message, selectedConversation))
      .filter((message) => messageMatchesFilter(message, messageFilter))
      .filter((message) => !normalizedQuery || messageMatchesSearch(message, normalizedQuery))
      .sort((left, right) => getTimestamp(right.sent_at) - getTimestamp(left.sent_at));
  }, [messageFilter, normalizedQuery, selectedConversation]);
  const selectedSummary = selectedConversation ? buildConversationSummary(selectedConversation) : null;
  const canExport = isLoaded && (
    exportScope !== "searchResults" || normalizedQuery.length > 0
  );

  function loadTutorialArchive() {
    setIsLoaded(true);
    setSelectedConversationId(TUTORIAL_ARCHIVE.conversations[0]?.id || "");
    setQuery("coffee");
    setMessageFilter("all");
    setExportScope("fullArchive");
    setExportFormat("csv");
    setExportStatus({ status: "idle", message: "" });
  }

  function resetTutorial() {
    setIsLoaded(false);
    setSelectedConversationId("");
    setQuery("");
    setMessageFilter("all");
    setExportScope("fullArchive");
    setExportFormat("csv");
    setExportStatus({ status: "idle", message: "" });
  }

  function handleExport() {
    if (!canExport) return;
    const exportPayload = buildTutorialExport({
      format: exportFormat,
      messages: getExportMessages({
        allMessages,
        displayedMessages,
        exportScope,
        normalizedQuery,
        searchResults,
        selectedConversation,
      }),
      query,
      scope: exportScope,
      selectedConversation,
      summary: searchSummary,
    });
    downloadBrowserFile(exportPayload);
    setExportStatus({
      status: "done",
      message: `Downloaded ${exportPayload.filename}. Your real archive was not touched.`,
    });
  }

  return (
    <section className="tutorial-workspace" aria-label="Tutorial workspace">
      <header className="tutorial-hero">
        <div>
          <p className="eyebrow">Tutorial workspace</p>
          <h2>Practice with sample messages, away from your archive</h2>
          <p>
            This section is a sandbox for learning the app. Loading the sample archive here does not import records into the real message database.
          </p>
        </div>
        <div className="tutorial-hero-actions">
          <button className="primary-button" type="button" onClick={loadTutorialArchive}>
            <Upload size={16} aria-hidden="true" />
            {isLoaded ? "Reload Sample" : "Load Sample Tutorial Archive"}
          </button>
          <button className="secondary-button" type="button" onClick={resetTutorial} disabled={!isLoaded}>
            <RotateCcw size={16} aria-hidden="true" />
            Reset Tutorial
          </button>
          <button className="ghost-button" type="button" onClick={onExitTutorial}>
            Exit Tutorial
          </button>
        </div>
      </header>

      <div className="tutorial-safety-strip" aria-label="Tutorial data boundary">
        <SafetyItem
          icon={<Archive size={17} aria-hidden="true" />}
          title="Separate sample archive"
          detail="The lesson uses bundled fake messages, not your database."
        />
        <SafetyItem
          icon={<LockKeyhole size={17} aria-hidden="true" />}
          title="No import endpoint"
          detail="Tutorial buttons do not call the real iPhone import or sample import API."
        />
        <SafetyItem
          icon={<Database size={17} aria-hidden="true" />}
          title="Resettable browser state"
          detail="Reset clears the sample workspace and returns it to an unloaded state."
        />
      </div>

      <div className="tutorial-layout">
        <TutorialGuide
          didExport={exportStatus.status === "done"}
          hasArchiveData={hasArchiveData}
          isLoaded={isLoaded}
          messageFilter={messageFilter}
          query={query}
          onStartRealImport={onStartRealImport}
        />

        <section className="tutorial-sandbox" aria-label="Sample archive sandbox">
          {!isLoaded ? (
            <div className="tutorial-empty-state empty-panel">
              <strong>No sample archive loaded</strong>
              <span>
                Start the tutorial to practice importing, browsing, searching, filtering, exporting, and resetting with fake messages.
              </span>
              <button className="primary-button" type="button" onClick={loadTutorialArchive}>
                <Upload size={16} aria-hidden="true" />
                Load Sample Tutorial Archive
              </button>
            </div>
          ) : (
            <>
              <TutorialTopline
                allMessages={allMessages}
                conversations={conversations}
                sourceName={TUTORIAL_ARCHIVE.sourceName}
              />

              <div className="tutorial-controls">
                <label className="tutorial-search-field">
                  <span>
                    <Search size={15} aria-hidden="true" />
                    Search sample messages
                  </span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Try coffee, receipt, local, PDF"
                  />
                </label>
                <label className="tutorial-select-field">
                  <span>
                    <Filter size={15} aria-hidden="true" />
                    Message filter
                  </span>
                  <select value={messageFilter} onChange={(event) => setMessageFilter(event.target.value)}>
                    {MESSAGE_FILTERS.map((filter) => (
                      <option key={filter.id} value={filter.id}>{filter.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="tutorial-browser-grid">
                <section className="tutorial-conversation-panel" aria-label="Tutorial conversations">
                  <div className="tutorial-panel-header">
                    <div>
                      <p className="eyebrow">Conversations</p>
                      <h3>{conversationSummaries.length} sample thread{conversationSummaries.length === 1 ? "" : "s"}</h3>
                    </div>
                    {normalizedQuery && <span>{searchResults.length} search match{searchResults.length === 1 ? "" : "es"}</span>}
                  </div>
                  <div className="tutorial-conversation-list">
                    {conversationSummaries.length === 0 ? (
                      <div className="empty-panel">
                        <strong>No sample matches</strong>
                        <span>Try another search term or clear the search field.</span>
                      </div>
                    ) : (
                      conversationSummaries.map((conversation) => (
                        <button
                          className={`conversation-row ${conversation.id === selectedConversationId ? "is-selected" : ""}`}
                          key={conversation.id}
                          onClick={() => setSelectedConversationId(conversation.id)}
                          type="button"
                        >
                          <span className="conversation-main">
                            <span className="conversation-title-row">
                              <strong>{conversation.title}</strong>
                              <time>{formatShortDate(conversation.last_message_at)}</time>
                            </span>
                            <span className="conversation-meta-row">
                              <small>{conversation.participants.join(", ")}</small>
                              <span className="conversation-count">
                                {conversation.message_count} message{conversation.message_count === 1 ? "" : "s"}
                              </span>
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </section>

                <section className="tutorial-thread-panel" aria-label="Tutorial thread">
                  {selectedConversation && selectedSummary ? (
                    <>
                      <header className="tutorial-thread-header">
                        <div>
                          <p className="eyebrow">Selected sample thread</p>
                          <h3>{selectedConversation.title}</h3>
                          <p>{selectedConversation.participants.join(", ")}</p>
                        </div>
                        <dl>
                          <div>
                            <dt>Messages</dt>
                            <dd>{selectedSummary.message_count}</dd>
                          </div>
                          <div>
                            <dt>Date range</dt>
                            <dd>{formatDateRange(selectedSummary.first_message_at, selectedSummary.last_message_at)}</dd>
                          </div>
                        </dl>
                      </header>

                      <div className="tutorial-message-list">
                        {displayedMessages.length === 0 ? (
                          <div className="empty-panel">
                            <strong>No messages in this view</strong>
                            <span>Clear the search field or change the filter to see the full sample thread.</span>
                          </div>
                        ) : (
                          displayedMessages.map((message) => (
                            <article className={`message ${message.direction}`} key={message.id}>
                              <div className="message-meta">
                                <strong>{message.sender_name}</strong>
                                <time>{formatMessageTime(message.sent_at)}</time>
                              </div>
                              <p>{message.body}</p>
                              {message.attachments.length > 0 && (
                                <div className="attachment-indicator is-referenced">
                                  <span>{formatAttachmentLabel(message.attachments)}</span>
                                  <small>{formatAttachmentStatus(message.attachments)}</small>
                                </div>
                              )}
                            </article>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="empty-panel">
                      <strong>Select a sample conversation</strong>
                      <span>Choose a thread to practice the conversation view.</span>
                    </div>
                  )}
                </section>
              </div>

              <div className="tutorial-lower-grid">
                <SearchSummaryLesson
                  query={query}
                  results={searchResults}
                  summary={searchSummary}
                  onOpenConversation={setSelectedConversationId}
                />

                <ExportLesson
                  canExport={canExport}
                  exportFormat={exportFormat}
                  exportScope={exportScope}
                  exportStatus={exportStatus}
                  query={query}
                  selectedConversation={selectedConversation}
                  onExport={handleExport}
                  onFormatChange={setExportFormat}
                  onScopeChange={setExportScope}
                />

                <PrivacyLesson />
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}

function SafetyItem({ detail, icon, title }) {
  return (
    <div>
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function TutorialGuide({
  didExport,
  hasArchiveData,
  isLoaded,
  messageFilter,
  onStartRealImport,
  query,
}) {
  const steps = [
    {
      icon: <Upload size={16} aria-hidden="true" />,
      title: "Import sample archive",
      detail: "Load the fake archive inside the tutorial workspace.",
      status: isLoaded ? "Complete" : "Start here",
      isComplete: isLoaded,
    },
    {
      icon: <Archive size={16} aria-hidden="true" />,
      title: "Browse conversations",
      detail: "Select a sample thread and scan participants, dates, and messages.",
      status: isLoaded ? "Available" : "Locked",
      isComplete: isLoaded,
    },
    {
      icon: <Search size={16} aria-hidden="true" />,
      title: "Search and summarize",
      detail: "Search a term, then read counts by person, thread, and month.",
      status: query.trim() ? "In use" : "Try search",
      isComplete: Boolean(query.trim()),
    },
    {
      icon: <Filter size={16} aria-hidden="true" />,
      title: "Filter messages",
      detail: "Switch between all, incoming, outgoing, and attachment messages.",
      status: messageFilter === "all" ? "Optional" : "In use",
      isComplete: messageFilter !== "all",
    },
    {
      icon: <Download size={16} aria-hidden="true" />,
      title: "Practice exports",
      detail: "Create a harmless tutorial export from browser state.",
      status: didExport ? "Complete" : "Available",
      isComplete: didExport,
    },
    {
      icon: <Database size={16} aria-hidden="true" />,
      title: "Reset or exit",
      detail: "Reset clears sample state. Exit returns to the real app.",
      status: "Always available",
      isComplete: false,
    },
  ];

  return (
    <aside className="tutorial-guide" aria-label="Tutorial steps">
      <div className="tutorial-guide-header">
        <p className="eyebrow">Lesson path</p>
        <h3>Learn the whole workflow</h3>
        <p>Use the cards as a checklist. The real archive area stays separate.</p>
      </div>
      <ol>
        {steps.map((step, index) => (
          <li className={step.isComplete ? "is-complete" : ""} key={step.title}>
            <span className="tutorial-step-number">{index + 1}</span>
            <div>
              <span className="tutorial-step-icon">{step.icon}</span>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
              <em>{step.status}</em>
            </div>
          </li>
        ))}
      </ol>
      <div className="tutorial-real-import-card">
        <strong>{hasArchiveData ? "Ready for your archive" : "When you are ready"}</strong>
        <p>
          Use Import Messages for your actual iPhone backup. That is the path that writes to local app storage.
        </p>
        <button className="secondary-button" type="button" onClick={onStartRealImport}>
          Start Real Import
        </button>
      </div>
    </aside>
  );
}

function TutorialTopline({ allMessages, conversations, sourceName }) {
  const attachments = allMessages.reduce((count, message) => count + message.attachments.length, 0);
  return (
    <dl className="tutorial-topline" aria-label="Tutorial archive summary">
      <div>
        <dt>Sample source</dt>
        <dd>{sourceName}</dd>
      </div>
      <div>
        <dt>Threads</dt>
        <dd>{conversations.length}</dd>
      </div>
      <div>
        <dt>Messages</dt>
        <dd>{allMessages.length}</dd>
      </div>
      <div>
        <dt>Attachments</dt>
        <dd>{attachments}</dd>
      </div>
    </dl>
  );
}

function SearchSummaryLesson({ onOpenConversation, query, results, summary }) {
  return (
    <section className="tutorial-card tutorial-search-summary" aria-label="Sample search summary">
      <header>
        <span className="tutorial-card-icon">
          <BarChart3 size={17} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">Search and summary</p>
          <h3>{query.trim() ? `${results.length} matching sample message${results.length === 1 ? "" : "s"}` : "Search the sample archive"}</h3>
        </div>
      </header>
      {query.trim() ? (
        <>
          <dl className="tutorial-summary-grid">
            <div>
              <dt>People</dt>
              <dd>{summary.people.length}</dd>
            </div>
            <div>
              <dt>Threads</dt>
              <dd>{summary.conversations.length}</dd>
            </div>
            <div>
              <dt>First</dt>
              <dd>{formatShortDate(summary.firstMentionAt)}</dd>
            </div>
            <div>
              <dt>Recent</dt>
              <dd>{formatShortDate(summary.mostRecentMentionAt)}</dd>
            </div>
          </dl>
          <div className="tutorial-summary-lists">
            <SummaryList title="People" items={summary.people} />
            <SummaryList title="Conversations" items={summary.conversations} onOpenConversation={onOpenConversation} />
          </div>
        </>
      ) : (
        <p className="tutorial-muted-copy">Type a term such as coffee, receipt, local, or PDF to see the same kind of summary the real archive provides.</p>
      )}
    </section>
  );
}

function SummaryList({ items, onOpenConversation, title }) {
  return (
    <section>
      <h4>{title}</h4>
      {items.length === 0 ? (
        <p>No sample matches.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id || item.name}>
              <span>{item.name}</span>
              {onOpenConversation ? (
                <button className="inline-text-button" type="button" onClick={() => onOpenConversation(item.id)}>
                  {item.count} match{item.count === 1 ? "" : "es"}
                </button>
              ) : (
                <strong>{item.count}</strong>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ExportLesson({
  canExport,
  exportFormat,
  exportScope,
  exportStatus,
  onExport,
  onFormatChange,
  onScopeChange,
  query,
  selectedConversation,
}) {
  return (
    <section className="tutorial-card tutorial-export-card" aria-label="Sample export lesson">
      <header>
        <span className="tutorial-card-icon">
          <FileText size={17} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">Exports</p>
          <h3>Practice export choices</h3>
        </div>
      </header>
      <p className="tutorial-muted-copy">
        The real app creates PDF, Excel, or CSV files from the local backend. This tutorial downloads a harmless browser-generated practice file.
      </p>
      <div className="tutorial-export-controls">
        <label>
          <span>Scope</span>
          <select value={exportScope} onChange={(event) => onScopeChange(event.target.value)}>
            {EXPORT_SCOPES.map((scope) => (
              <option key={scope.id} value={scope.id}>{scope.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Format lesson</span>
          <select value={exportFormat} onChange={(event) => onFormatChange(event.target.value)}>
            {EXPORT_FORMATS.map((format) => (
              <option key={format.id} value={format.id}>{format.label}</option>
            ))}
          </select>
        </label>
      </div>
      <dl className="tutorial-export-context">
        <div>
          <dt>Selected thread</dt>
          <dd>{selectedConversation?.title || "None"}</dd>
        </div>
        <div>
          <dt>Search term</dt>
          <dd>{query.trim() || "None"}</dd>
        </div>
      </dl>
      <button className="primary-button" type="button" onClick={onExport} disabled={!canExport}>
        <Download size={16} aria-hidden="true" />
        Create Tutorial Export
      </button>
      {!canExport && <p className="inline-error-state">Search results exports need a sample search term first.</p>}
      {exportStatus.status === "done" && <p className="inline-success-state">{exportStatus.message}</p>}
    </section>
  );
}

function PrivacyLesson() {
  return (
    <section className="tutorial-card tutorial-privacy-card" aria-label="Privacy and storage lesson">
      <header>
        <span className="tutorial-card-icon">
          <LockKeyhole size={17} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">Privacy and storage</p>
          <h3>What is separate</h3>
        </div>
      </header>
      <ul>
        <li>The real app imports into a local SQLite archive through the protected local API.</li>
        <li>The tutorial sample is bundled fake data held in browser state while this lesson is open.</li>
        <li>Resetting the tutorial clears the sample workspace and does not delete real archive data.</li>
        <li>Exiting the tutorial returns to Get Started or Browse Archive without carrying sample records into your archive.</li>
      </ul>
    </section>
  );
}

function flattenMessages(conversations) {
  return conversations.flatMap((conversation) => (
    conversation.messages.map((message) => decorateMessage(message, conversation))
  ));
}

function decorateMessage(message, conversation) {
  return {
    ...message,
    attachments: message.attachments || [],
    conversation_id: conversation.id,
    conversation_title: conversation.title,
    participants: conversation.participants,
  };
}

function buildConversationSummary(conversation) {
  const timestamps = conversation.messages.map((message) => getTimestamp(message.sent_at)).filter(Boolean);
  const firstTimestamp = Math.min(...timestamps);
  const lastTimestamp = Math.max(...timestamps);
  return {
    id: conversation.id,
    title: conversation.title,
    participants: conversation.participants,
    message_count: conversation.messages.length,
    first_message_at: Number.isFinite(firstTimestamp) ? new Date(firstTimestamp).toISOString() : "",
    last_message_at: Number.isFinite(lastTimestamp) ? new Date(lastTimestamp).toISOString() : "",
  };
}

function messageMatchesFilter(message, filter) {
  if (filter === "incoming") return message.direction === "incoming";
  if (filter === "outgoing") return message.direction === "outgoing";
  if (filter === "attachments") return message.attachments.length > 0;
  return true;
}

function messageMatchesSearch(message, normalizedQuery) {
  if (!normalizedQuery) return true;
  return [
    message.body,
    message.sender_name,
    message.conversation_title,
    ...(message.participants || []),
    ...message.attachments.map((attachment) => `${attachment.label} ${attachment.mime_type} ${attachment.availability_status}`),
  ].some((value) => normalizeSearchText(value).includes(normalizedQuery));
}

function buildSearchSummary(messages) {
  const people = countBy(messages, (message) => message.sender_name);
  const conversations = countBy(messages, (message) => message.conversation_title, (message) => message.conversation_id);
  const timestamps = messages.map((message) => getTimestamp(message.sent_at)).filter(Boolean).sort((left, right) => left - right);
  const months = countBy(messages, (message) => formatMonthKey(message.sent_at));
  return {
    conversations,
    firstMentionAt: timestamps[0] ? new Date(timestamps[0]).toISOString() : "",
    months,
    mostRecentMentionAt: timestamps.length ? new Date(timestamps[timestamps.length - 1]).toISOString() : "",
    people,
  };
}

function countBy(items, getName, getId = getName) {
  const counts = new Map();
  for (const item of items) {
    const name = getName(item) || "Unknown";
    const id = getId(item) || name;
    const key = String(id);
    const current = counts.get(key) || { id, name, count: 0 };
    current.count += 1;
    counts.set(key, current);
  }
  return [...counts.values()].sort((left, right) => {
    if (right.count !== left.count) return right.count - left.count;
    return left.name.localeCompare(right.name);
  });
}

function getExportMessages({
  allMessages,
  displayedMessages,
  exportScope,
  normalizedQuery,
  searchResults,
  selectedConversation,
}) {
  if (exportScope === "conversation") {
    return selectedConversation
      ? selectedConversation.messages.map((message) => decorateMessage(message, selectedConversation))
      : [];
  }
  if (exportScope === "searchResults") {
    return normalizedQuery ? searchResults : [];
  }
  return allMessages;
}

function buildTutorialExport({
  format,
  messages,
  query,
  scope,
  selectedConversation,
  summary,
}) {
  const filenamePart = scope === "conversation"
    ? slugify(selectedConversation?.title || "selected-conversation")
    : scope === "searchResults"
      ? `search-${slugify(query)}`
      : "full-archive";

  if (format === "csv") {
    return {
      content: buildCsv(messages),
      filename: `tutorial-${filenamePart}.csv`,
      mimeType: "text/csv;charset=utf-8",
    };
  }

  const label = format === "pdf" ? "PDF" : "Excel";
  return {
    content: buildExportWalkthroughText({ label, messages, query, scope, selectedConversation, summary }),
    filename: `tutorial-${filenamePart}-${format}-walkthrough.txt`,
    mimeType: "text/plain;charset=utf-8",
  };
}

function buildCsv(messages) {
  const rows = [
    ["conversation", "sender", "direction", "sent_at", "body", "attachments"],
    ...messages.map((message) => [
      message.conversation_title,
      message.sender_name,
      message.direction,
      message.sent_at,
      message.body,
      message.attachments.map((attachment) => attachment.label).join("; "),
    ]),
  ];
  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

function buildExportWalkthroughText({
  label,
  messages,
  query,
  scope,
  selectedConversation,
  summary,
}) {
  const lines = [
    `Message Archive Utility tutorial ${label} export walkthrough`,
    "",
    "This file was generated by the tutorial workspace from fake browser-state sample data.",
    "It did not call the local API and did not write to the real archive database.",
    "",
    `Scope: ${formatExportScope(scope)}`,
    `Selected conversation: ${selectedConversation?.title || "None"}`,
    `Search term: ${query.trim() || "None"}`,
    `Messages included in this practice export: ${messages.length}`,
    "",
    "In the real archive, the Export panel creates PDF, Excel, and CSV files from local app storage.",
    "Use the tutorial to learn the choices, then switch to the real archive when you are ready.",
    "",
    "Search summary:",
    `People with matches: ${summary.people.length}`,
    `Conversations with matches: ${summary.conversations.length}`,
    "",
    "Included messages:",
    ...messages.map((message) => (
      `- ${formatShortDate(message.sent_at)} | ${message.conversation_title} | ${message.sender_name}: ${message.body}`
    )),
  ];
  return lines.join("\n");
}

function downloadBrowserFile({ content, filename, mimeType }) {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function formatAttachmentLabel(attachments) {
  if (attachments.length === 1) return attachments[0].label;
  return `${attachments.length} attachments`;
}

function formatAttachmentStatus(attachments) {
  const statuses = [...new Set(attachments.map((attachment) => attachment.availability_status.replace(/_/g, " ")))];
  return statuses.join(", ");
}

function formatDateRange(first, last) {
  if (!first || !last) return "No dates";
  if (formatShortDate(first) === formatShortDate(last)) return formatShortDate(first);
  return `${formatShortDate(first)} to ${formatShortDate(last)}`;
}

function formatExportScope(scope) {
  return EXPORT_SCOPES.find((option) => option.id === scope)?.label || scope;
}

function formatMessageTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMonthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString([], { month: "long", year: "numeric" });
}

function formatShortDate(value) {
  if (!value) return "None";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function getTimestamp(value) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function normalizeSearchText(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function slugify(value) {
  return normalizeSearchText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "sample";
}
